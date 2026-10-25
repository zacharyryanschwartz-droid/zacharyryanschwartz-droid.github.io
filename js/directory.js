/* ===== Invention Directory (client) + creation slots / delete UI =====
   Online: the server's shared Directory (GET /api/directory). Offline: a localStorage copy (mp_directory), seeded with the
   example art and filled with everything created on this device. Taking an item costs coins only: no AI call, no credit. */
'use strict';
const Directory = {
  LS: 'mp_directory', cache: {},
  get server() { return AIBackend.online && !!(AIBackend.info && AIBackend.info.directory); },
  local() { try { const x = JSON.parse(localStorage.getItem(this.LS)); if (x && x.items) return x; } catch (e) { /* fresh */ } const db = DirectoryCore.newDB(); this.saveLocal(db); return db; },
  saveLocal(db) { try { localStorage.setItem(this.LS, JSON.stringify(db)); } catch (e) { /* full */ } },
  idOf(e) { return 'dir_' + e.id; },
  have(e) { const id = this.idOf(e); return e.kind === 'crop' ? state.order.includes(id) : e.kind === 'tool' ? !!state.tools[id] : !!state.aiRecipes[id]; },
  price(kind) { return DIRECTORY_RULES.price[kind]; },
  remember(items) { items.forEach(e => { this.cache[e.id] = e; }); return items; },
  async query(params) {
    if (this.server) {
      try { const u = 'api/directory?' + new URLSearchParams(params).toString(); const r = await fetch(u, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j.ok) return this.remember(j.items); } }
      catch (e) { /* fall back to the local copy */ }
    }
    const db = this.local();
    return this.remember(params.match ? DirectoryCore.match(db, params.kind, params.q) : DirectoryCore.search(db, { q: params.q, kind: params.kind, limit: +params.limit || 30 }));
  },
  /* close matches for an idea, minus what's already at this location */
  async match(kind, q) { return (await this.query({ match: 1, kind, q })).filter(e => !this.have(e)); },
  async browse(kind, q) { return this.query({ kind: kind || '', q: q || '', limit: 40 }); },
  /* file a fresh creation (called by Game.aiInvent / aiTool / aiRecipe on success) */
  file(kind, obj) {
    try {
      const pack = kind === 'tool' ? Bazaar.packTool(obj.key) : Bazaar.packOf((kind === 'crop' ? 'c|' : 'r|') + obj.id); if (!pack) return;
      const body = { ...pack, idea: obj.prompt || pack.name };
      const db = this.local(); DirectoryCore.add(db, body, Date.now(), BazaarCore.sanitize); this.saveLocal(db);
      if (this.server) fetch('api/directory/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
    } catch (e) { console.warn('directory file failed', e); }
  },
  /* take an item: slots + coins only. Keeps the stored image; crops keep AI quality (DIRECTORY_RULES.keepAIQuality). */
  take(e, opts = {}) {
    if (this.have(e)) return { ok: false, msg: 'Already at this location' };
    const sb = Slots.block(e.kind); if (sb) return sb;
    const price = this.price(e.kind); if (state.coins < price) return { ok: false, msg: `Need ${price}¢` };
    const p = e.payload, id = this.idOf(e), src = DIRECTORY_RULES.keepAIQuality ? 'ai' : 'basic';
    let got;
    if (e.kind === 'crop') {
      const inv = Inventor.procedural(p.base, p.trait, src);
      Object.assign(inv, { id, name: p.name || e.name, stem: p.stem || e.name, desc: e.desc, color: p.color, growTime: p.growTime, yield: p.yield, baseValue: p.baseValue, tags: p.tags, imageUrl: p.imageUrl || null, imagePreview: false,
        prompt: e.idea, stages: p.stages && Object.keys(p.stages).length ? p.stages : defaultStages(id), directory: { id: e.id } });
      if (opts.fulfills) inv.aliases = [normName(opts.fulfills)];
      state.inventions[id] = inv; state.order.unshift(id); state.novelty[id] = state.novelty[id] ?? 1; addItem('c|' + id, 2);
      got = { kind: 'crop', key: 'c|' + id, inv };
    } else if (e.kind === 'tool') {
      const T = { key: id, type: 'tool', name: e.name, desc: e.desc, source: src, recipes: p.recipes, art: p.art, hue: p.hue, speedMult: p.speedMult, bonusOut: p.bonusOut, imageUrl: p.imageUrl || null, owned: true, prompt: e.idea, directory: { id: e.id } };
      if (opts.fulfills) T.aliases = [normName(opts.fulfills)];
      state.aiTools[id] = T; TOOLS[id] = T; state.tools[id] = { owned: true, level: 1 }; got = { kind: 'tool', key: id, tool: T };
    } else {
      const requires = [], need = (kind, name) => { let i = requires.findIndex(q => q.kind === kind && q.name === name); if (i < 0) { i = requires.length; requires.push({ kind, name, idea: name }); } return i; };
      const R = { id, type: 'recipe', source: 'ai', name: e.name, desc: e.desc, form: p.form, stars: p.stars, value: p.value, craftTime: p.craftTime, out: 2, imageUrl: p.imageUrl || null, tags: p.tags, prompt: e.idea,
        ingredients: p.ingredients.map(g => ({ need: need('crop', g.name), qty: g.qty })), steps: p.steps.map((s, i) => ({ need: need('tool', s.tool), action: s.action, time: s.time, adds: s.adds, makes: i < p.steps.length - 1 ? s.makes : undefined })), requires, mainId: null, directory: { id: e.id } };
      R.demand = recipeDemand(R).demand; state.aiRecipes[id] = R; state.recipeBook[id] = R; state.novelty[id] = 1; got = { kind: 'recipe', rid: id, recipe: R };
    }
    state.coins -= price; state.dirTaken = (state.dirTaken || 0) + 1; save();
    if (this.server) fetch('api/directory/use', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) }).catch(() => {});
    return { ok: true, price, ...got };
  },
};
/* ---------- icons for Directory entries (stored image, else the procedural shape) ---------- */
function dirIcon(e, size = 48) {
  if (e.imageUrl) return aiImgTag(e.imageUrl, size, 'glowy');
  const p = e.payload || {};
  if (e.kind === 'crop' && BASES[p.base] && TRAITS[p.trait]) return cropIcon({ id: 'dirprev', base: p.base, trait: p.trait, color: p.color, source: 'ai' }, size, true);
  return `<span class="dir-emoji" style="font-size:${Math.round(size * 0.6)}px">${e.kind === 'tool' ? '🔧' : e.kind === 'recipe' ? '🍲' : '🌱'}</span>`;
}
const KIND_LABEL = { crop: '🌱 Crop', tool: '🔧 Tool', recipe: '🍲 Recipe' };
function dirRow(e, ctx) {
  const pr = Directory.price(e.kind), have = Directory.have(e), sb = Slots.full(e.kind);
  const p = e.payload || {};
  const stat = e.kind === 'crop' ? `⏱ ${p.growTime}s · 🧺×${p.yield} · ${p.baseValue}¢` : e.kind === 'tool' ? `makes ${(p.recipes || []).map(r => RECIPES[r] ? RECIPES[r].name : r).join(', ')}` : `${'★'.repeat(p.stars || 1)} · ${(p.ingredients || []).map(g => g.name).join(' + ')}`;
  const btn = have ? '<span class="pill ok">✓ here</span>' : sb ? `<button class="btn sm ghost" data-act="slots-full" data-type="${e.kind}">Slots full</button>`
    : `<button class="btn sm" data-act="dir-take" data-id="${e.id}" data-hook="dir-take">Use this · ${pr}¢</button>`;
  return `<div class="dir-row card"><div class="dir-ico">${dirIcon(e, 52)}</div><div class="dir-b"><b>${esc(e.name)}</b> <small class="muted">${KIND_LABEL[e.kind]}${ctx === 'match' && e.score ? ` · ${Math.round(e.score * 100)}% match` : ''}${e.uses ? ` · used ${e.uses}×` : ''}</small>
    <br><small>“${esc(e.idea)}”</small><br><small class="muted">${esc(stat)}</small></div>${btn}</div>`;
}
let dirState = { kind: '', q: '', items: [], loading: false, matchKind: 'crop', matchText: '', matches: [] };
function dirMatchSheet() {
  return () => `<div class="sheet-h"><h3>🗂️ Found in the Directory</h3><button class="x" data-act="close">✕</button></div>
    <p class="muted small">Someone already made something close to <b>“${esc(dirState.matchText)}”</b>. Use it for coins: <b>no credit, no AI wait</b>, same picture. Or invent your own take.</p>
    <div class="dir-list" data-hook="dir-matches">${dirState.matches.map(e => dirRow(e, 'match')).join('')}</div>
    <button class="btn ai wide" data-act="dir-fresh" data-hook="dir-fresh">✨ Invent fresh <small>(1 credit · ${Entitlements.aiCredits} left)</small></button>
    <p class="muted small">Directory prices: crop ${Directory.price('crop')}¢ · tool ${Directory.price('tool')}¢ · recipe ${Directory.price('recipe')}¢. It still uses one of this location's slots (${Slots.text(dirState.matchKind)}).</p>`;
}
function dirBrowseSheet() {
  return () => `<div class="sheet-h"><h3>🗂️ Invention Directory</h3><button class="x" data-act="close">✕</button></div>
    <p class="muted small">Every crop, tool and recipe players have created. Reuse one for coins instead of spending a credit.${Directory.server ? '' : ' <b>Offline copy</b> (this device).'}</p>
    <div class="dir-search"><input id="dir-q" type="search" placeholder="Search: cactus, oven, jam…" value="${esc(dirState.q)}" autocomplete="off"><button class="btn sm" data-act="dir-search">Search</button></div>
    <div class="pick dir-kinds">${[['', 'All'], ['crop', '🌱 Crops'], ['tool', '🔧 Tools'], ['recipe', '🍲 Recipes']].map(([k, l]) => `<button class="tchip ${dirState.kind === k ? 'sel' : ''}" data-act="dir-kind" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="slot-line small">${['crop', 'tool', 'recipe'].map(k => `<span class="pill ${Slots.full(k) ? 'miss' : ''}">${Slots.text(k)}</span>`).join(' ')}</div>
    <div class="dir-list" data-hook="dir-browse">${dirState.loading ? '<p class="muted">Searching…</p>' : dirState.items.length ? dirState.items.map(e => dirRow(e, 'browse')).join('') : '<p class="muted">Nothing found. Try another word, or invent it in the Workshop.</p>'}</div>`;
}
async function dirLoad() { dirState.loading = true; refreshSheet(); dirState.items = await Directory.browse(dirState.kind, dirState.q); dirState.loading = false; if (sheetRender && sheetRender.isDir) refreshSheet(); }
function openDirectory() { const f = dirBrowseSheet(); f.isDir = true; openSheet(f); dirLoad(); }
/* ---------- slots ---------- */
function slotItemRow(kind, ref) {
  if (kind === 'crop') { const v = state.inventions[ref]; return `<div class="slot-item">${cropIcon(v, 34)}<span><b>${esc(v.name)}</b>${v.source === 'ai' ? ' ' + badge('ai', 1) : ''}</span><button class="del-btn" data-act="del-ask" data-type="crop" data-ref="${ref}" aria-label="Delete">🗑</button></div>`; }
  if (kind === 'tool') return `<div class="slot-item">${toolIcon(ref, 34)}<span><b>${esc(TOOLS[ref].name)}</b></span><button class="del-btn" data-act="del-ask" data-type="tool" data-ref="${ref}" aria-label="Delete">🗑</button></div>`;
  const R = state.aiRecipes[ref]; return `<div class="slot-item">${recipeIcon(R, 34)}<span><b>${esc(R.name)}</b></span><button class="del-btn" data-act="del-ask" data-type="recipe" data-ref="${ref}" aria-label="Delete">🗑</button></div>`;
}
function createLink(kind, prompt = '', label = '✨ Create in Workshop') {
  return `<button class="btn ai ghost sm create-ws" data-act="th-create" data-type="${kind}" data-prompt="${esc(prompt)}" data-hook="create-in-workshop">${label}</button>`;
}
function slotsPanel(kind, open = false) {
  const list = Slots.list(kind);
  return `<details class="slots card ${Slots.full(kind) ? 'full' : ''}" data-hook="slots-${kind}" ${open ? 'open' : ''}><summary><span class="slot-count">${Slots.text(kind)}</span>${Slots.full(kind) ? '<span class="pill miss">full</span>' : ''}<span class="muted small">${kind === 'crop' ? '+ 4 basic crops' : kind === 'tool' ? '+ Oven & Cookpot' : ''}</span></summary>
    <div class="slot-list">${list.length ? list.map(r => slotItemRow(kind, r)).join('') : `<p class="muted small">No invented ${Slots.label[kind]} here yet.</p>`}</div>
    <div class="slot-foot">${createLink(kind)}<small class="muted">AI creation happens only in the Workshop</small></div></details>`;
}
function slotsFullSheet(kind) {
  return () => `<div class="sheet-h"><h3>🧺 ${Slots.text(kind)}</h3><button class="x" data-act="close">✕</button></div>
    <p class="ai-err" data-hook="slots-full">This location is full: ${SLOTS[kind]} invented ${Slots.label[kind]} max. Delete one first. <b>No credit or coins were spent.</b></p>
    <div class="slot-list">${Slots.list(kind).map(r => slotItemRow(kind, r)).join('')}</div>
    <p class="muted small">Basics (Tomato, Corn, Beans, Onion · Oven, Cookpot) never use a slot and can't be deleted. Deleted things stay in your Collection and in the Directory.</p>`;
}
/* ---------- delete with "Are you sure?" ---------- */
let delTarget = null;
function deleteSheet(kind, ref) {
  delTarget = { kind, ref };
  return () => { const I = Game.deleteImpact(kind, ref), lines = [];
    if (I.stock) lines.push(`🧺 ${I.stock} in storage`); if (I.stall) lines.push(`🏪 ${I.stall} on the stall`); if (I.plots) lines.push(`🌱 ${I.plots} plot${I.plots > 1 ? 's' : ''} growing it (cleared)`);
    if (I.job) lines.push(kind === 'tool' ? '🍳 the batch cooking in it' : '🍳 the batch in progress'); if (I.queued) lines.push(`⏳ ${I.queued} queued batch${I.queued > 1 ? 'es' : ''} and their ingredients`);
    return `<div class="sheet-h"><h3>🗑 Delete ${esc(I.name)}?</h3><button class="x" data-act="close">✕</button></div>
    <div class="del-box" data-hook="delete-confirm"><p><b>Are you sure?</b> This removes it from <b>${esc(state.farms[state.farmIdx].name)}</b>.</p>
      ${lines.length ? `<p class="small">You'll lose:</p><ul class="del-list">${lines.map(l => `<li>${l}</li>`).join('')}</ul>` : '<p class="small muted">Nothing stored or cooking, nothing else lost.</p>'}
      ${I.recipes.length ? `<p class="small">🔒 These recipes will lock until you make a replacement:</p><ul class="del-list">${I.recipes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <p class="small muted">No credit refund. It stays in your Collection${kind === 'recipe' ? ' and Recipe Book history; dishes already cooked stay sellable' : '; goods already cooked from it stay sellable'}. You can find it again in the Directory.</p></div>
    <div class="row-btns"><button class="btn ghost" data-act="close">Keep it</button><button class="btn danger" data-act="del-confirm" data-hook="confirm-delete">Delete</button></div>`; };
}
/* ---------- recipe slot pre-warning (before any image / credit) ---------- */
let rwPending = null;
function recipeWarnSheet(res, text) {
  rwPending = { R: res.pendingR, text }; const n = res.slotWarn;
  return () => `<div class="sheet-h"><h3>⚠️ Not enough room</h3><button class="x" data-act="close">✕</button></div>
    <p data-hook="recipe-slot-warn"><b>${esc(res.pendingR.name)}</b> needs ${[n.crop ? `${n.crop} new crop${n.crop > 1 ? 's' : ''}` : '', n.tool ? `${n.tool} new tool${n.tool > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')}, but this location has only
      ${Slots.free('crop')} free crop slot${Slots.free('crop') === 1 ? '' : 's'} and ${Slots.free('tool')} free tool slot${Slots.free('tool') === 1 ? '' : 's'}.</p>
    <p class="muted small">You can still learn it: it stays 🔒 locked until you delete something and create what it needs. Nothing has been spent yet.</p>
    <div class="row-btns"><button class="btn ghost" data-act="close" data-hook="rw-cancel">Cancel (no credit used)</button><button class="btn ai" data-act="rw-anyway">Learn anyway (1 credit)</button></div>`;
}
/* ---------- chef controls: per-location on/off for workers ---------- */
function chefTog(rid, label = '') { const on = chefOn(rid); return `<span class="ctl">${label}<button class="toggle sm ${on ? 'on' : ''}" data-act="chef-tog" data-k="${rid}" data-hook="chef-tog" aria-label="Chef can make" title="Chef can make: ${on ? 'on' : 'off'}"><i></i></button></span>`; }
function farmTog(id) { const on = farmOn(id); return `<button class="toggle sm ${on ? 'on' : ''}" data-act="farm-tog" data-k="${id}" data-hook="farm-tog" aria-label="Workers may plant"><i></i></button>`; }
function chefControlsHTML() {
  const ids = Object.keys(state.aiRecipes); if (!ids.length) return '';
  return `<div class="chef-ctl card" data-hook="chef-controls"><h4>👨‍🍳 Chef can make <small class="muted">${ids.filter(chefOn).length}/${ids.length} on · ${esc(state.farms[state.farmIdx].name)}</small></h4>
    <p class="muted small">The Kitchen Helper (random) and Head Chef (best value) only cook recipes that are on. You can still cook any recipe by hand.</p>
    ${ids.map(id => { const R = state.aiRecipes[id], tk = Game.recipeTool(id); return `<div class="ctl-row ${chefOn(id) ? '' : 'off'}">${recipeIcon(R, 30)}<span><b>${esc(R.name)}</b><small class="muted">${tk ? 'starts in the ' + esc(TOOLS[tk].name) : '🔒 locked'}</small></span>${chefTog(id)}</div>`; }).join('')}</div>`;
}
function farmControlsHTML() {
  const ids = state.order.filter(id => state.inventions[id]);
  return `<details class="slots card farm-ctl" data-hook="farm-controls"><summary><span class="slot-count">🧑‍🌾 Workers may plant</span><span class="muted small">${ids.filter(farmOn).length}/${ids.length} crops on</span></summary>
    <p class="muted small">Farmhand (random) and Farm Manager only plant crops that are on. You can still plant anything by hand.</p>
    <div class="slot-list">${ids.map(id => `<div class="slot-item ${farmOn(id) ? '' : 'off'}">${cropIcon(state.inventions[id], 30)}<span><b>${esc(state.inventions[id].name)}</b></span>${farmTog(id)}</div>`).join('')}</div></details>`;
}
function dirAct(a, t) {
  switch (a) {
    case 'chef-tog': { const on = Game.toggleChef(t.dataset.k); toast(`👨‍🍳 ${state.aiRecipes[t.dataset.k] ? state.aiRecipes[t.dataset.k].name : 'Recipe'}: chef ${on ? 'can make it' : 'won’t make it (you still can)'}`); render(); if (book.open) renderBook(); refreshSheet(); return true; }
    case 'farm-tog': { const on = Game.toggleFarm(t.dataset.k), open = !!document.querySelector('[data-hook="farm-controls"][open]'); toast(`🧑‍🌾 ${state.inventions[t.dataset.k].name}: workers ${on ? 'may plant it' : 'won’t plant it'}`); render(); if (open) { const d = document.querySelector('[data-hook="farm-controls"]'); if (d) d.open = true; } return true; }
    case 'dir-open': openDirectory(); return true;
    case 'dir-kind': dirState.kind = t.dataset.k; { const q = $('#dir-q'); if (q) dirState.q = q.value; } dirLoad(); return true;
    case 'dir-search': { const q = $('#dir-q'); dirState.q = q ? q.value : ''; dirLoad(); return true; }
    case 'dir-take': {
      const e = Directory.cache[t.dataset.id]; if (!e) return true;
      const req = pendingReq && pendingReq.kind === e.kind ? pendingReq : null;
      const r = Directory.take(e, { fulfills: req ? req.name : null });
      if (!r.ok) { if (r.full) openSheet(slotsFullSheet(r.full)); else toast(r.msg); return true; }
      if (req) { const q = state.aiRecipes[req.rid] && state.aiRecipes[req.rid].requires[req.i]; if (q) { if (e.kind === 'tool') q.key = r.key; else if (e.kind === 'crop') q.id = r.inv.id; } pendingReq = null; save(); }
      if (typeof thinkDraft !== 'undefined' && dirState.matches.some(m => m.id === e.id)) thinkDraft = '';
      if (typeof Think !== 'undefined') Think.addXP(3);
      toast(`🗂️ ${e.name} added from the Directory · ${r.price}¢ · no credit used`); updateCoins();
      if (e.kind === 'recipe') { closeSheet(); render(); openBook(r.rid, false); } else { refreshSheet(); render(); if (!(sheetRender && sheetRender.isDir)) closeSheet(); }
      return true;
    }
    case 'dir-fresh': closeSheet(); thinkGo(null, { fresh: true }); return true;
    case 'slots-full': openSheet(slotsFullSheet(t.dataset.type)); return true;
    case 'del-ask': openSheet(deleteSheet(t.dataset.type, t.dataset.ref)); return true;
    case 'del-confirm': {
      if (!delTarget) return true; const { kind, ref } = delTarget, name = Game.deleteImpact(kind, ref).name;
      const r = kind === 'crop' ? Game.deleteCrop(ref) : kind === 'tool' ? Game.deleteTool(ref) : Game.deleteRecipe(ref);
      delTarget = null; closeSheet(); if (book.open) { if (kind === 'recipe') book.tab = 'index'; renderBook(); }
      toast(r.ok ? `🗑 Deleted ${name} · ${Slots.text(kind)}` : r.msg); render(); return true;
    }
    case 'rw-anyway': {
      if (!rwPending) return true; const { R, text } = rwPending; rwPending = null; closeSheet();
      if (!Entitlements.canUseAI()) { openSheet(outOfCreditsSheet(null, text)); return true; }
      runAI('recipe', text, null, { preR: R, allowOverSlots: true }); return true;
    }
    case 'th-create': { // every "Create" button outside the Workshop lands here
      thinkType = ['crop', 'tool', 'recipe'].includes(t.dataset.type) ? t.dataset.type : 'crop';
      if (t.dataset.prompt) thinkDraft = t.dataset.prompt;
      if (!t.dataset.keepReq) pendingReq = null;
      closeSheet(); if (book.open) { book.open = false; renderBook(); } setTab('lab');
      const ws = $('#screen-lab'); if (ws) ws.scrollTop = 0;
      setTimeout(() => { const ta = $('#think-ta'); if (ta) { ta.focus({ preventScroll: true }); ta.classList.add('filled'); setTimeout(() => ta.classList.remove('filled'), 900); } }, 30);
      return true;
    }
  }
  return bestAct(a, t);
}
document.addEventListener('keydown', e => { if (e.target.id === 'dir-q' && e.key === 'Enter') { e.preventDefault(); dirState.q = e.target.value; dirLoad(); } });
