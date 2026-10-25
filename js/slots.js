/* ===== Creation slots / delete UI / chef + farm toggles / "Create in Workshop" routing =====
   (The old player-facing Invention Directory is gone: image reuse is now an internal server-side image library,
   see js/image-library-core.js and IMAGE_LIBRARY_RULES in data.js. Players never see or choose it.) */
'use strict';
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
    <p class="muted small">Basics (Tomato, Corn, Beans, Onion · Oven, Cookpot) never use a slot and can't be deleted. Deleted things stay in your Collection.</p>`;
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
      <p class="small muted">No credit refund. It stays in your Collection${kind === 'recipe' ? ' and Recipe Book history; dishes already cooked stay sellable' : '; goods already cooked from it stay sellable'}.</p></div>
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
function slotsAct(a, t) {
  switch (a) {
    case 'chef-tog': { const on = Game.toggleChef(t.dataset.k); toast(`👨‍🍳 ${state.aiRecipes[t.dataset.k] ? state.aiRecipes[t.dataset.k].name : 'Recipe'}: chef ${on ? 'can make it' : 'won’t make it (you still can)'}`); render(); if (book.open) renderBook(); refreshSheet(); return true; }
    case 'farm-tog': { const on = Game.toggleFarm(t.dataset.k), open = !!document.querySelector('[data-hook="farm-controls"][open]'); toast(`🧑‍🌾 ${state.inventions[t.dataset.k].name}: workers ${on ? 'may plant it' : 'won’t plant it'}`); render(); if (open) { const d = document.querySelector('[data-hook="farm-controls"]'); if (d) d.open = true; } return true; }
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
