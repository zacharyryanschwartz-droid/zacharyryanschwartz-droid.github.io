/* Market Plot — UI layer (DOM rendering, input, animation) */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
let activeTab = 'lab';
let lab = { base: 'plum', trait: 'sweet', stages: { seedling: 0, youngling: 0, mature: 0, flower: 0, harvest: 0 } };
let promptDraft = { crop: '', tool: '', recipe: '' };
let aiErr = null; // last AI failure shown under the prompt box
let pendingReq = null; // {rid, i, kind, name}: the Recipe Book "Create" flow in progress
let book = { open: false, tab: 'index', page: null, fresh: false };
let sigs = {};

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}
function badge(src, small) { return src === 'ai' ? `<span class="badge ai ${small ? 'sm' : ''}">✨AI</span>` : `<span class="badge basic ${small ? 'sm' : ''}">Basic</span>`; }
/* demand stacking breakdown, e.g. "Basic ×0.7 · AI crop ×1.4 · Combo ×1.15 · AI recipe ×1.3 = ×1.47" */
function demandBreak(ds, cls = '') {
  if (!ds) return '';
  return `<div class="dbreak ${cls}" data-hook="demand-breakdown">${ds.parts.map(([l, m]) => `<span class="dpart ${l === 'Basic' ? 'b' : l === 'AI crop' ? 'a' : l === 'Combo' ? 'c' : 'r'}">${l} ×${m}</span>`).join('<i>·</i>')}<i>=</i><b>📈 ×${ds.demand.toFixed(2)}</b>${ds.capped ? `<small class="cap">capped (×${ds.raw.toFixed(2)} → ×${DEMAND_STACK.cap})</small>` : ''}</div>`;
}
function demandText(ds) { return ds.parts.map(([l, m]) => `${l} ×${m}`).join(' · ') + ` = ×${ds.demand.toFixed(2)}` + (ds.capped ? ' (capped)' : ''); }
function fmtS(s) { return s < 10 ? s.toFixed(1) + 's' : Math.ceil(s) + 's'; }
function updateCoins() { $('#coins').textContent = state.coins; }

/* ---------------- Sheet ---------------- */
let sheetRender = null;
function openSheet(fn) { sheetRender = fn; $('#sheet').innerHTML = fn(); $('#sheet').classList.add('show'); $('#sheet-backdrop').classList.add('show'); }
function refreshSheet() { if (sheetRender) $('#sheet').innerHTML = sheetRender(); }
function closeSheet() { sheetRender = null; $('#sheet').classList.remove('show'); $('#sheet-backdrop').classList.remove('show'); }

/* ---------------- Header / title ---------------- */
function renderHeader() {
  $('#logo').innerHTML = logoSVG(132) + `<div class="tagline">Think It, Sell It!</div>`;
  $('.coin-ico').innerHTML = coinSVG(18);
}
function showTitle() {
  const el = document.createElement('div'); el.id = 'title'; el.className = 'title-screen';
  el.innerHTML = `<div class="sun"></div>${hillsSVG()}<div class="title-inner">${logoSVG(300)}
    <div class="ribbon-big">Think It, Sell It!</div>
    <p class="title-sub">A cozy sandbox farming &amp; marketing game</p>
    <button class="btn big" data-act="start">Tap to Start</button>
    <p class="proto-note">Look-and-feel mockup · web prototype</p></div>`;
  $('#app').appendChild(el);
}
function hillsSVG() {
  return `<svg class="hills" viewBox="0 0 390 200" preserveAspectRatio="none"><path d="M0 120C60 70 120 80 180 110S300 60 390 100V200H0z" fill="#a8dc7e"/><path d="M0 150C80 110 160 130 230 150S340 120 390 140V200H0z" fill="#7fc65a"/>
  <g transform="translate(300 78)"><rect x="-3" y="0" width="6" height="26" fill="#f3e2c0" stroke="#5b3a1e" stroke-width="1.5"/><g class="mill"><path d="M0 0L-14 -4L-14 4ZM0 0L14 -4L14 4ZM0 0L-4 -14L4 -14ZM0 0L-4 14L4 14Z" fill="#fff" stroke="#5b3a1e" stroke-width="1"/></g></g>
  <g transform="translate(70 96)"><rect x="0" y="0" width="22" height="14" fill="#e86f5a" stroke="#5b3a1e" stroke-width="1.5"/><path d="M-3 0L11 -10L25 0z" fill="#9b4f3a" stroke="#5b3a1e" stroke-width="1.5"/></g></svg>`;
}

/* ---------------- Tabs ---------------- */
function setTab(t) {
  activeTab = t;
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + t));
  render();
}
function render() {
  updateCoins();
  ({ farm: renderFarm, lab: renderLab, kitchen: renderKitchen, market: renderMarket })[activeTab]();
}

/* ---------------- FARM (kept minimal) ---------------- */
function renderFarm() {
  const el = $('#screen-farm');
  const plots = state.plots.map((p, i) => {
    if (!p.inv) return `<button class="plot empty" data-act="plot" data-i="${i}"><span>＋<br>Plant</span></button>`;
    const inv = state.inventions[p.inv], pr = Game.plotProgress(p);
    const stg = stageForProgress(pr);
    if (pr >= 1) return `<button class="plot ready" data-act="plot" data-i="${i}" data-stage="harvest">${stageSVG(stagesOf(inv), 'harvest', inv, 104)}<em>Harvest!</em><span class="info-i" data-act="stats" data-key="c|${inv.id}">i</span></button>`;
    const left = inv.growTime * (1 - pr);
    return `<button class="plot growing" data-act="plot" data-i="${i}" data-stage="${stg}"><div class="sprout" data-sprout="${i}">${stageSVG(stagesOf(inv), stg, inv, 100)}</div><span class="stg-l">${STAGE_LABEL[stg]}</span><span class="info-i" data-act="stats" data-key="c|${inv.id}">i</span>
      <div class="bar"><i data-prog="plot" data-i="${i}" style="width:${pr * 100}%"></i></div><small data-left="plot" data-i="${i}">${fmtS(left)}</small></button>`;
  });
  if (!state.farmIdx && state.plots.length < MAX_HOME_PLOTS) plots.push(`<button class="plot buy" data-act="buyplot"><span>🔓<br>Plot<br><b>${Game.plotCost()}¢</b></span></button>`);
  const crops = inventoryList('', 'basket');
  const unlocked = Farms.mapUnlocked(), F = state.farms[state.farmIdx];
  el.innerHTML = `<div class="panel-title"><h2>🌱 Farm</h2><button class="btn sm map-btn ${unlocked ? '' : 'locked'}" data-act="map">${unlocked ? '🗺️ Map' : '🔒 Map'}</button></div>
    ${locChips()}
    ${unlocked ? '' : `<p class="muted small map-hint">🗺️ Fully upgrade your plots to unlock the map (${state.farms[0].plots.length}/${MAX_HOME_PLOTS} plots).</p>`}
    <div class="field ${state.farmIdx ? 'farm-' + F.id : ''}">${plots.join('')}</div>
    <div class="loc-h"><h3 class="sub">🧺 Farm Basket</h3>${crops.length ? `<button class="btn sm ghost" data-act="send-all" data-from="basket" data-to="pantry">All → 🫙 Kitchen</button>` : ''}</div>
    <div class="stacks">${crops.length ? crops.map(c => stackRow(c, 'basket', [['pantry', '🫙 Kitchen'], ['stock', '📦 Market']])).join('') : '<span class="muted">Nothing yet. Harvests land here.</span>'}</div>
    <div class="loc-h"><h3 class="sub">🌾 Crops here</h3></div>${slotsPanel('crop')}${farmControlsHTML()}
    ${workersSection('farm')}${ordersPanel()}`;
  sigs.farm = farmSig();
}
function farmSig() { return storeSig('basket') + state.farmIdx + ':' + state.farms.length + ':' + state.farms.map(f => f.plots.filter(p => p.inv && Game.plotProgress(p) >= 1).length).join('') + state.plots.map(p => p.inv ? stageForProgress(Game.plotProgress(p))[0] + p.inv : 'E').join('') + state.plots.length + workersSig('farm'); }
function plantSheet(i) {
  return () => `<div class="sheet-h"><h3>Plant in plot ${i + 1}</h3><button class="x" data-act="close">✕</button></div>
   <p class="muted">🍅 <b>Garden Tomatoes</b>: free seeds, always. Corn, beans &amp; onions: ${BASIC_CROPS[1].seed}¢. Invented crops: ${ECON.seedCost}¢. Grow times are short on purpose — farming is just the supply step.</p>
   <div class="list">${[...state.order].sort((a, b) => !!(state.inventions[b] || {}).free - !!(state.inventions[a] || {}).free).map(id => { const v = state.inventions[id]; return `<button class="row${v.free ? ' free-seed' : ''}" data-act="plant" data-i="${i}" data-id="${id}" ${v.free ? 'data-hook="free-seeds"' : ''}>${cropIcon(v, 40)}<div class="grow"><b>${v.name}</b> ${v.free ? '<span class="pill ok">Free seeds</span>' : badge(v.source, 1)}<br><small>${v.free ? '∞ unlimited · ' : ECON.seedCost + '¢ · '}${v.growTime}s · yields ${v.yield} · ${v.baseValue}¢ each</small></div></button>`; }).join('')}</div>`;
}

/* ---------------- LAB ---------------- */
/* growth-stage picker: one tap-to-cycle tile per stage + an animated live preview. fruit=null -> ❓ (AI fruit not made yet) */
function stagePicker(fruit, compact = false) {
  const st = lab.stages;
  const tiles = STAGE_ORDER.map(k => { const v = STAGE_LIB[k][st[k]], n = STAGE_LIB[k].length;
    return `<div class="st-tile"><small>${STAGE_LABEL[k].replace(' plant', '').replace('-ready', '')}</small>
      <button class="st-art" data-act="stage-cycle" data-stage="${k}" data-d="1">${stageSVG(st, k, fruit, compact ? 50 : 58)}</button>
      <div class="st-nav"><button data-act="stage-cycle" data-stage="${k}" data-d="-1">‹</button><i>${st[k] + 1}/${n}</i><button data-act="stage-cycle" data-stage="${k}" data-d="1">›</button></div>
      <em>${v.name}</em></div>`; }).join('');
  return `<div class="stage-picker ${compact ? 'compact' : ''}"><div class="st-row">${tiles}</div>
    <div class="st-live"><div class="grow-anim">${STAGE_ORDER.map(k => stageSVG(st, k, fruit, 74)).join('')}</div>
      <div><b>Live preview</b><br><small class="muted">Seedling → Youngling → Mature → Flower → Harvest. ${fruit ? 'Fruit: your seed + trait art.' : 'Fruit: the AI paints it from your idea.'} The plant looks are preset, only the fruit is custom.</small></div></div></div>`;
}
function renderLab() {
  const el = $('#screen-lab');
  const okB = SOURCES.basic.bases.includes(lab.base), okT = SOURCES.basic.traits.includes(lab.trait);
  const preview = Inventor.procedural(lab.base, lab.trait, 'basic');
  const exists = state.inventions[preview.id];
  const locked = !okB || !okT;
  const ent = Entitlements;
  el.innerHTML = `<div class="panel-title"><h2>⚗️ Invention Lab</h2><span class="badge free">Free inventor</span></div>
   <div class="lab-step"><b>1 · Pick a seed</b><div class="pick">${Object.keys(BASES).map(k => {
      const lk = !SOURCES.basic.bases.includes(k);
      return `<button class="pchip ${lab.base === k ? 'sel' : ''} ${lk ? 'locked' : ''}" data-act="lab-base" data-k="${k}">${cropIcon({ base: k, trait: 'giant', source: 'basic' }, 30)}<span>${BASES[k].name}</span>${lk ? '<i class="lock">🔒AI</i>' : ''}</button>`;
    }).join('')}</div></div>
   <div class="lab-step"><b>2 · Add a trait</b><div class="pick traits">${SOURCES.basic.traits.map(k => {
      const lk = !SOURCES.basic.traits.includes(k);
      return `<button class="tchip ${lab.trait === k ? 'sel' : ''} ${lk ? 'locked' : ''}" data-act="lab-trait" data-k="${k}"><span class="sym">${TRAITS[k].sym}</span>${TRAITS[k].name}${lk ? '<i class="lock">🔒</i>' : ''}</button>`;
    }).join('')}</div></div>
   <div class="lab-step"><b>3 · Choose the growth look</b> <small class="muted">tap a stage to cycle · used for free &amp; AI crops</small>${stagePicker(preview)}</div>
   <div class="preview card">
     <div class="pv-ico">${cropIcon(preview, 92)}</div>
     <div class="pv-body"><div class="pv-name">${preview.name} ${badge('basic', 1)}</div>
       <p class="pv-desc">${preview.desc}</p>
       <div class="stats"><span>⏱ ${preview.growTime}s</span><span>🧺 ×${preview.yield}</span><span>${coinSVG(13)} ${preview.baseValue}¢</span><span title="buyer demand">📈 ×${DEMAND.crop.basic}</span></div></div>
   </div>
   ${locked ? createLink('crop', '', '🔒 This combo needs AI · ✨ Create in Workshop')
      : exists ? `<button class="btn wide disabled">Already in your book ✓</button>`
      : Slots.full('crop') ? `<button class="btn wide ghost" data-act="slots-full" data-type="crop">🧺 ${Slots.text('crop')} · delete one first</button>`
      : `<button class="btn wide" data-act="invent">Invent! <small>(${ECON.inventCost}¢)</small></button>`}
   <p class="muted small">Free Mix Lab crops use a crop slot too (${Slots.text('crop')}). AI ideas: type them in the Workshop above.</p>
   <h3 class="sub">Invention book</h3>
   <div class="book">${state.order.map(id => { const v = state.inventions[id], st = state.itemStats['c|' + id]; return `<button class="bk card ${v.source}" data-act="stats" data-key="c|${id}">${cropIcon(v, 48)}<div><b>${v.name}</b> ${badge(v.source, 1)}<br><small>Crop · ${v.baseValue}¢ · demand ×${DEMAND.crop[v.source]}${st && st.sold ? ` · sold ${st.sold}` : ''}</small></div><span class="info-i">i</span></button>`; }).join('')}
     ${Object.keys(TOOLS).filter(k => TOOLS[k].source === 'ai').map(k => `<div class="bk card ai">${toolIcon(k, 48)}<div><b>${TOOLS[k].name}</b> ${badge('ai', 1)}<br><small>Tool · ⚡ production boost</small></div></div>`).join('')}</div>`;
}

/* ---------------- KITCHEN ---------------- */
function renderKitchen() {
  const el = $('#screen-kitchen');
  const cards = Object.keys(TOOLS).filter(k => state.tools[k]).map(stationCard).join('');
  const pantry = inventoryList('', 'pantry'), ready = inventoryList('', 'ready');
  el.innerHTML = `<div class="panel-title"><h2>🍯 Kitchen</h2><span class="hint">Every tool is a station</span></div>${locChips()}
   <div class="loc-h"><h3 class="sub">🫙 Pantry <small class="muted">cooks only from here</small></h3></div>
   <div class="chips pantry">${pantry.length ? pantry.map(p => `<button class="chip" data-act="stats" data-key="${p.key}">${p.icon(24)}${esc(p.name)} ×${p.qty}</button>`).join('') : '<span class="muted small">Empty. Send crops from the Farm Basket (or hire a Kitchen Runner).</span>'}</div>
   <div class="loc-h"><h3 class="sub">🍯 Ready shelf</h3>${ready.length ? `<button class="btn sm ghost" data-act="send-all" data-from="ready" data-to="stock">All → 📦 Market</button>` : ''}</div>
   <div class="stacks">${ready.length ? ready.map(p => stackRow(p, 'ready', [['stock', '📦 Market']])).join('') : '<span class="muted small">Finished goods land here.</span>'}</div>
   <div class="loc-h"><h3 class="sub">🔥 Stations</h3><small class="muted">each cooks 1 batch + a queue of ${Game.QUEUE_MAX}</small></div>
   <div class="stations" data-hook="stations">${cards}</div>
   ${slotsPanel('tool')}${slotsPanel('recipe')}
   ${bookButton()}
   ${workersSection('kitchen')}${ordersPanel()}`;
  sigs.kitchen = kitchenSig();
}
/* one kitchen tool = one station: what it's cooking now, its queue, its basic recipes and the learned recipes it makes */
function jobLabel(j) { if (j.rid) { const R = state.aiRecipes[j.rid] || state.recipeBook[j.rid], plan = R ? stepPlan(R) : [], st = plan[j.step || 0], last = !plan.length || (j.step || 0) >= plan.length - 1;
    return { name: st ? st.makes : R ? R.name : 'Recipe', step: plan.length > 1 ? `Step ${(j.step || 0) + 1}/${plan.length} · ${st.action}` : '', inter: !last, next: !last ? plan[(j.step || 0) + 1] : null, icon: s => R ? `<span class="${last ? '' : 'inter-ico'}">${recipeIcon(R, s)}</span>` : '' }; } const info = itemInfo(Game.jobKey(j)); return info ? { name: info.name, icon: s => info.icon(s) } : { name: '?', icon: () => '' }; }
function stationCard(k) {
  const T = TOOLS[k], ts = state.tools[k], st = Game.toolStats(k), j = state.jobs[k], q = Game.queueOf(k);
  const boost = T.source === 'ai' ? `<span class="boost">⚡ ${Math.round((1 / T.speedMult - 1) * 100)}% faster · +${T.bonusOut}/batch</span>` : '';
  if (!ts.owned) return `<div class="tool card station unowned"><div class="tool-ico">${toolIcon(k, 56)}</div><div class="tool-body"><b>${esc(T.name)}</b><div class="tool-act"><button class="btn sm" data-act="buytool" data-k="${k}">Buy (${T.cost}¢)</button></div></div></div>`;
  let now;
  if (j) { const pr = Game.jobProgress(j), L = jobLabel(j), nx = L.next, nxOk = nx && nx.tool && state.tools[nx.tool], nxFree = nxOk && Game.toolFree(nx.tool);
    const btn = pr < 1 ? '' : !L.inter ? `<button class="btn sm pulse" data-act="collect" data-k="${k}">Collect ×${j.out}</button>`
      : nxOk ? `<button class="btn sm pulse move-btn ${nxFree ? '' : 'disabled'}" data-act="collect" data-k="${k}" data-hook="move-next">${nxFree ? `Move → ${esc(TOOLS[nx.tool].name)}` : `${esc(TOOLS[nx.tool].name)} full`}</button>` : `<span class="pill miss">needs ${esc(nx.req ? nx.req.name : 'a tool')}</span>`;
    now = `<div class="st-now ${pr >= 1 ? 'done' : ''} ${L.inter ? 'inter' : ''}">${L.icon(30)}<div class="st-now-b"><small>${pr >= 1 ? (L.inter ? 'Step done!' : 'Done!') : 'Cooking now'}${L.step ? ' · ' + esc(L.step) : ''}</small><b>${esc(L.name)}</b>${pr >= 1 ? '' : `<div class="bar"><i data-prog="job" data-k="${k}" style="width:${pr * 100}%"></i></div>`}</div>${btn}</div>`; }
  else now = `<div class="st-now idle"><span class="st-idle">💤</span><div class="st-now-b"><small>Idle</small><b>Pick something to cook</b></div></div>`;
  const queue = `<div class="st-queue"><small class="muted">Queue ${q.length}/${Game.QUEUE_MAX}</small>${q.map((x, i) => { const L = jobLabel(x); return `<span class="qchip ${x.step ? 'inter' : ''}" title="${esc(L.name)}">${L.icon(22)}<em>${x.step ? '⤷ ' : ''}${esc(L.name)}</em>${x.step ? '' : `<button data-act="unqueue" data-k="${k}" data-i="${i}" aria-label="Cancel">✕</button>`}</span>`; }).join('')}${q.length ? '' : '<small class="muted">empty</small>'}</div>`;
  const full = !Game.toolFree(k);
  const rids = Game.recipesForTool(k), later = Game.recipesUsingTool(k);
  const chainTxt = id => Game.plan(id).map(s => s.tool && TOOLS[s.tool] ? TOOLS[s.tool].name : (s.req ? s.req.name + '?' : '?')).join(' → ');
  const laterHTML = later.length ? `<small class="muted st-later">Also a later step of: ${later.map(id => `<button class="link" data-act="recipe-open" data-k="${id}">${esc(state.aiRecipes[id].name)}</button>`).join(', ')}</small>` : '';
  const learned = rids.length ? `<div class="st-learned"><small class="muted">Learned recipes here</small>${rids.map(id => { const R = state.aiRecipes[id], c = Game.recipeCheck(id);
      const others = c.plan.length > 1 ? [chainTxt(id)] : [];
      const b = c.locked ? `<button class="btn sm ghost" data-act="recipe-open" data-k="${id}">🔒</button>` : c.ok && !full ? `<button class="btn sm" data-act="craft" data-k="${id}" data-hook="station-make">${j ? 'Queue' : 'Make'}</button>` : `<button class="btn sm ghost" data-act="recipe-open" data-k="${id}">${full ? 'Queue full' : 'Missing…'}</button>`;
      return `<div class="st-rec ${chefOn(id) ? '' : 'off'}">${recipeIcon(R, 30)}<button class="sname" data-act="recipe-open" data-k="${id}"><b>${esc(R.name)}</b><small>${starsHTML(R.stars)} ${fmtS(R.craftTime)} · ~${R.value}¢${others.length ? ` · ${esc(others[0])}` : ''}</small></button>${chefTog(id, '👨‍🍳')}${b}</div>`; }).join('')}${laterHTML}</div>` : later.length ? `<div class="st-learned">${laterHTML}</div>` : '';
  const up = ts.level >= TOOL_UPGRADE.maxLevel ? `<span class="muted">MAX</span>` : `<button class="btn sm ghost" data-act="upgrade" data-k="${k}">Upgrade (${toolUpgradeCost(ts.level)}¢)</button>`;
  return `<div class="tool card station ${T.source}" data-hook="station-${k}">
    <div class="st-head"><div class="tool-ico">${toolIcon(k, 52)}</div><div><b>${esc(T.name)}</b> ${isBasicTool(k) ? '<span class="badge basic sm">Basic</span>' : badge(T.source, 1)} <span class="lv">Lv ${ts.level}</span><br><small class="muted">${fmtS(RECIPES[T.recipes[0]].time * st.speed)} / batch · ${1 + st.bonus} per batch</small> ${boost}</div>
      ${isBasicTool(k) ? '' : `<button class="del-btn" data-act="del-ask" data-type="tool" data-ref="${k}" aria-label="Delete">🗑</button>`}</div>
    ${now}${queue}
    <div class="st-basic"><div class="recipes">${T.recipes.map(r => `<span class="rchip">${RECIPES[r].name}</span>`).join('')}</div><button class="btn sm ${full ? 'ghost disabled' : ''}" data-act="cooksheet" data-k="${k}">${full ? 'Queue full' : j ? 'Queue…' : 'Cook…'}</button></div>
    ${learned}
    <div class="tool-act">${up}</div></div>`;
}
function storeSig(l) { return Object.keys(state.store[l]).map(k => k.length + ':' + state.store[l][k]).join(','); }
function kitchenSig() { return state.farmIdx + workersSig('kitchen') + storeSig('pantry') + '|' + storeSig('ready') + Object.keys(TOOLS).map(k => { const j = state.jobs[k]; return (j ? (Game.jobProgress(j) >= 1 ? 'R' : 'C') + (j.rid || j.recipe + j.id) : 'I') + Game.queueOf(k).length + (state.tools[k] ? 1 : 0); }).join('') + '|' + Object.keys(state.aiRecipes).map(id => id + recipeStatus(id)[0]).join(''); }
let cookSel = {};
function cookSheet(k) {
  return () => {
    const T = TOOLS[k];
    if (!cookSel.recipe || !T.recipes.includes(cookSel.recipe)) cookSel.recipe = T.recipes[0];
    const r = RECIPES[cookSel.recipe];
    const crops = inventoryList('c|', 'pantry');
    if (!cookSel.id || !crops.find(c => c.inv.id === cookSel.id)) cookSel.id = (crops.find(c => c.qty >= r.uses) || crops[0] || {}).inv?.id;
    const sel = crops.find(c => c.inv.id === cookSel.id);
    const can = sel && sel.qty >= r.uses;
    const out = 1 + Game.toolStats(k).bonus;
    cookSel.extras = (cookSel.extras || []).filter(x => x !== 'c|' + cookSel.id && kitchenQty(x) > 0);
    const ci = sel ? comboInfo(sel.inv.id, cookSel.recipe, comboDec(comboEnc(cookSel.extras))) : null;
    const val = ci ? ci.value : 0;
    const pool = inventoryList('', ['pantry', 'ready']).filter(x => (x.kind === 'crop' || x.kind === 'product' && !x.combo) && x.key !== 'c|' + cookSel.id);
    return `<div class="sheet-h"><h3>${T.name}</h3><button class="x" data-act="close">✕</button></div>
     <div class="pick">${T.recipes.map(x => `<button class="tchip ${cookSel.recipe === x ? 'sel' : ''}" data-act="pick-recipe" data-k="${k}" data-r="${x}">${RECIPES[x].name}<small> · ${RECIPES[x].uses} crops</small></button>`).join('')}</div>
     <div class="list">${crops.length ? crops.map(c => `<button class="row ${c.inv.id === cookSel.id ? 'sel' : ''} ${c.qty < r.uses ? 'dim' : ''}" data-act="pick-crop" data-k="${k}" data-id="${c.inv.id}">${c.icon(36)}<div><b>${c.name}</b> ×${c.qty} ${badge(c.src, 1)}<br><small>→ ${c.inv.stem} ${r.name} · ${Math.round(c.inv.baseValue * r.mult)}¢ each</small></div></button>`).join('') : '<p class="muted">The Pantry has no crops. Send some from the Farm Basket first.</p>'}</div>
     ${sel ? `<div class="combine card"><div class="cb-h"><b>🧪 Combine</b> <small class="muted">free · add up to ${COMBO.maxExtras} more (1 each) · +${Math.round(DEMAND_STACK.comboPerExtra * 100)}% demand per extra (max ×${DEMAND_STACK.comboMax})</small></div>
       <div class="cb-slots"><span class="cb-slot main">${sel.icon(30)}<small>×${r.uses}</small></span>${[0, 1].map(n => { const x = cookSel.extras[n]; const inf = x && itemInfo(x);
         return `<span class="cb-plus">＋</span>${inf ? `<button class="cb-slot" data-act="combo-del" data-key="${x}">${inf.icon(30)}<small>×1 ✕</small></button>` : '<span class="cb-slot empty">?</span>'}`; }).join('')}</div>
       <div class="cb-pool">${pool.map(x => `<button class="pchip cb ${cookSel.extras.includes(x.key) ? 'sel' : ''}" data-act="combo-add" data-key="${x.key}">${x.icon(24)}<span>${x.name}</span></button>`).join('')}</div></div>
     <div class="cook-preview">${productIcon(sel.inv, cookSel.recipe, 54, ci.src, ci.colors)}<div><b>${ci.name}</b> ${badge(ci.src, 1)}<br><small>${out} × ${val}¢ · 📈×${ci.demand.toFixed(2)} · ${fmtS(r.time * Game.toolStats(k).speed * (1 + 0.15 * cookSel.extras.length))}</small>${demandBreak(ci.ds, 'sm')}</div></div>` : ''}
     <button class="btn wide ${can ? '' : 'disabled'}" data-act="cook" data-k="${k}">Cook ${r.uses} → ${out}</button>`;
  };
}

/* ---------------- MARKET (centerpiece) ---------------- */
function tagHTML(info, price) {
  const thumb = info.src === 'ai' ? (info.kind === 'crop' ? cropIcon(info.inv, 22) : info.kind === 'craft' ? recipeIcon(info.recipe, 22) : '') : '';
  return `<div class="tag"><span class="twine"></span><div class="tag-name">${thumb ? `<span class="tag-thumb">${thumb}</span>` : ''}${info.name}</div><div class="tag-price"><span class="tsym">${info.sym}</span>${price}¢</div></div>`;
}
function basketHTML(i) {
  const s = state.stall[i];
  if (!s) return `<button class="basket empty" data-act="slot" data-i="${i}"><div class="pile"></div>${basketFront()}<div class="tag blank"><span class="twine"></span><div class="tag-name">＋ Stock</div></div></button>`;
  const info = itemInfo(s.key);
  const n = Math.min(s.qty, 5);
  const pos = [[50, 58], [26, 64], [74, 64], [38, 40], [62, 40]];
  const pile = pos.slice(0, Math.max(1, n)).map(([x, y], k) => `<div class="pi" style="left:${x}%;top:${y}%;z-index:${10 - k}">${info.icon(info.kind === 'product' ? 38 : 40)}</div>`).join('');
  const ev = Market.evaluate(i);
  const heat = ev.chance > 0.6 ? 'hot' : ev.chance > 0.3 ? 'warm' : 'cold';
  return `<button class="basket ${info.kind === 'product' ? 'crate' : ''}" data-act="slot" data-i="${i}" data-slot="${i}">
    <div class="pile">${pile}</div>${info.kind === 'product' ? '<div class="crate-front"></div>' : basketFront()}
    ${info.src === 'ai' ? '<span class="badge ai sm corner">✨AI</span>' : ''}
    <span class="qty">×${s.qty}</span><span class="heat ${heat}" title="buyer interest"></span>
    ${tagHTML(info, s.price)}</button>`;
}
function renderMarket() {
  const el = $('#screen-market');
  if (!$('#mkt-scene', el)) {
    el.innerHTML = `<div id="mkt-scene" class="scene">
      <div class="sky"><div class="sun"></div><div class="cloud c1"></div><div class="cloud c2"></div>${hillsSVG()}</div>
      <div class="awning"><div class="stripes"></div><div class="scallops"></div></div>
      <div class="hang-sign">GOOD<br>GOODS!</div>
      <div class="table"><div class="baskets" id="baskets"></div><div class="table-edge"></div></div>
      <div class="props"><button class="bell" data-act="mk" data-k="bell" title="Ring the brass bell">${bellSVG()}<span id="bell-cd"></span></button>
        <div class="coins-pile">${coinSVG(16)}${coinSVG(14)}</div>
        <div class="chalk" id="chalk"></div></div>
      <div class="lane" id="lane"></div>
    </div>
    <div class="mkt-panel">
      <div class="mkt-stats"><span>Sold <b id="st-sold"></b></span><span>Earned <b id="st-earned"></b>¢</span><span>Foot traffic <b id="st-traffic"></b>/min</span></div>
      <div class="mk-row" id="mk-row"></div>
      <div class="sale-log" id="sale-log"></div>
      <div id="mkt-loc"></div><div id="mkt-stock"></div>
      <div id="mkt-workers"></div>
      <p class="muted tip">Tip: tap a basket to set its price. Basic goods draw ×${DEMAND.crop.basic} interest — price them gently. ✨AI goods draw more.</p>
    </div>`;
  }
  $('#baskets').innerHTML = state.stall.map((_, i) => basketHTML(i)).join('');
  if (sigs.mkts !== state.farmIdx + storeSig('stock') + state.farms.length) { const st = inventoryList('', 'stock');
    $('#mkt-loc').innerHTML = locChips();
    $('#mkt-stock').innerHTML = `<div class="loc-h"><h3 class="sub">📦 Stockroom <small class="muted">the stall sells only from here</small></h3></div><div class="chips">${st.length ? st.map(p => `<button class="chip" data-act="stats" data-key="${p.key}">${p.icon(24)}${esc(p.name)} ×${p.qty}</button>`).join('') : '<span class="muted small">Empty. Send goods from the Kitchen Ready shelf (or hire a Market Runner).</span>'}</div>`;
    sigs.mkts = state.farmIdx + storeSig('stock') + state.farms.length; }
  if (sigs.mktw !== workersSig('market')) { $('#mkt-workers').innerHTML = workersSection('market'); sigs.mktw = workersSig('market'); }
  sigs.market = marketSig();
  updateMarketHud();
}
function bellSVG() { return `<svg viewBox="0 0 60 70" width="44" height="52"><rect x="10" y="58" width="40" height="8" rx="3" fill="#7a4a24" stroke="#5b3a1e" stroke-width="2"/><path d="M30 8c-14 0-16 14-16 26s-4 18-6 22h44c-2-4-6-10-6-22S44 8 30 8z" fill="#e6b84a" stroke="#5b3a1e" stroke-width="2.5"/><path d="M22 18c-3 6-3 16-3 24" stroke="#fff3c4" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="30" cy="6" r="4" fill="#e6b84a" stroke="#5b3a1e" stroke-width="2"/><circle cx="30" cy="58" r="4" fill="#b8892a"/></svg>`; }
function updateMarketHud() {
  if (activeTab !== 'market' || !$('#st-sold')) return;
  $('#st-sold').textContent = state.stats.sold; $('#st-earned').textContent = state.stats.earned;
  $('#st-traffic').textContent = Math.round(Market.traffic() * 60);
  const t = now();
  $('#chalk').innerHTML = `<div class="chalk-in">Think it.<br>Sell it.<br><span>${state.stats.lastSale ? 'Just sold: ' + state.stats.lastSale.name : 'Fresh today!'}</span></div>`;
  const bellLeft = Math.max(0, (state.mkt.bellReady - t) / 1000);
  $('#bell-cd').textContent = bellLeft > 0 ? Math.ceil(bellLeft) + 's' : '';
  $('#mk-row').innerHTML = Object.keys(MARKETING).map(k => {
    const M = MARKETING[k]; let st = '', cls = '';
    if (M.passive) { st = 'Always on'; cls = 'on'; }
    else if (k === 'bell') { st = bellLeft > 0 ? `${Math.ceil(bellLeft)}s` : 'Ring!'; cls = bellLeft > 0 ? 'cd' : ''; }
    else if (state.mkt[k] > t) { st = `${Math.ceil((state.mkt[k] - t) / 1000)}s left`; cls = 'on'; }
    else st = M.cost ? `${M.cost}¢` : 'Free';
    return `<button class="mk ${cls}" data-act="mk" data-k="${k}"><i>${M.emoji}</i><b>${M.name}</b><small>${st}</small></button>`;
  }).join('');
  $('#sale-log').innerHTML = state.log.slice(0, 3).map(l => `<div>🪙 ${l}</div>`).join('');
}
let slotSel = null;
function slotSheet(i) {
  return () => {
    const s = state.stall[i];
    let top = '';
    if (s) {
      const ev = Market.evaluate(i), info = ev.info;
      const pct = Math.round(ev.chance * 100);
      const heat = ev.chance > 0.6 ? 'Hot 🔥' : ev.chance > 0.3 ? 'Warm 🙂' : 'Cold 🥶';
      top = `<div class="slot-cur card">${info.icon(64)}<div class="grow"><b>${info.name}</b> ${badge(info.src, 1)}<br>
        <small>Worth ~${info.value}¢ · novelty ${Math.round(ev.nov * 100)}% · demand ×${info.demand.toFixed(2)}</small>
        ${demandBreak(info.ds, 'sm')}
        <div class="price-row"><button class="btn sm round" data-act="price" data-i="${i}" data-d="-1">−</button>
          <input type="range" min="1" max="${Math.max(10, info.value * 4)}" value="${s.price}" data-act="price-range" data-i="${i}" id="price-range">
          <button class="btn sm round" data-act="price" data-i="${i}" data-d="1">＋</button><b class="price-big" id="price-val">${s.price}¢</b></div>
        <div class="interest"><span>Buyer interest: <b>${heat}</b> (${pct}% buy chance)</span><div class="bar"><i style="width:${pct}%"></i></div>
        <small class="muted">Sweet spot ≈ ${ev.fair}¢</small></div>
        <div class="row-btns"><button class="btn sm ghost" data-act="unstock" data-i="${i}">Take back</button><button class="btn sm ghost" data-act="stats" data-key="${s.key}">📊 Stats</button>
          ${qtyAt('stock', s.key) ? `<button class="btn sm" data-act="restock" data-i="${i}">Restock +${qtyAt('stock', s.key)}</button>` : ''}</div></div></div>`;
    }
    const items = inventoryList('', 'stock');
    return `<div class="sheet-h"><h3>Basket ${i + 1}</h3><button class="x" data-act="close">✕</button></div>${top}
      <h4>${s ? 'Swap in' : 'Stock this basket'}</h4>
      <div class="list">${items.length ? items.map(x => `<button class="row" data-act="stock" data-i="${i}" data-key="${x.key}">${x.icon(36)}<div><b>${x.name}</b> ×${x.qty} ${badge(x.src, 1)}<br><small>worth ~${x.value}¢ · demand ×${x.demand.toFixed(2)}</small></div></button>`).join('') : '<p class="muted">The Market Stockroom is empty. Send goods from the Kitchen Ready shelf or the Farm Basket.</p>'}</div>`;
  };
}

/* customers walking the lane */
let liveCustomers = 0;
function animateCustomer(c) {
  const lane = $('#lane'), scene = $('#mkt-scene');
  const b = document.querySelector(`[data-slot="${c.slot}"]`);
  if (!lane || !b || activeTab !== 'market' || liveCustomers >= 5) { Market.resolve(c); return; }
  liveCustomers++;
  const sr = scene.getBoundingClientRect(), br = b.getBoundingClientRect();
  const x = br.left - sr.left + br.width / 2 - 22;
  const fromLeft = Math.random() < 0.5;
  const el = document.createElement('div'); el.className = 'cust'; el.innerHTML = customerSVG(c.seed) + '<div class="bubble"></div>';
  el.style.left = (fromLeft ? -50 : sr.width + 10) + 'px';
  lane.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = x + 'px'; }));
  setTimeout(() => {
    const r = Market.resolve(c);
    const bub = el.querySelector('.bubble');
    bub.textContent = r.bought ? ['Yum!', 'Ooh, new!', 'Love it!', 'Sold!'][c.seed % 4] : r.reason === 'pricey' ? 'Too pricey…' : r.reason === 'empty' ? 'Sold out?' : 'Hmm, maybe later';
    bub.classList.add('show', r.bought ? 'yes' : 'no');
    if (r.bought) { coinPop(x + 22, r.price); renderMarket(); updateCoins(); }
    setTimeout(() => { el.style.left = (fromLeft ? sr.width + 10 : -60) + 'px'; el.classList.add('leaving'); }, 1100);
    setTimeout(() => { el.remove(); liveCustomers--; }, 2900);
  }, 1700);
}
function coinPop(x, amt) {
  const p = document.createElement('div'); p.className = 'coinpop'; p.innerHTML = coinSVG(16) + '+' + amt + '¢';
  p.style.left = x + 'px'; $('#lane').appendChild(p); setTimeout(() => p.remove(), 1400);
  $('.ribbon').classList.remove('bump'); void $('.ribbon').offsetWidth; $('.ribbon').classList.add('bump');
}
function onInterstitialDue() { // never interrupt a haggle or the first-sale tour: wait until they're over
  const go = () => (typeof Think !== 'undefined' && (Think.haggle || [1, 2, 3, 4].includes(state.onb))) ? setTimeout(go, 1500) : Ads.showInterstitial('every ' + ECON.interstitialEverySales + ' sales');
  setTimeout(go, 600); }

function esc(x) { return String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function ideaQuote(p) { return p ? `<div class="idea"><span>💭 Your idea</span>“${esc(p)}”</div>` : ''; }
function promptSheet(type) {
  const tool = type === 'tool', rec = type === 'recipe';
  const title = rec ? '✨ Invent an AI recipe' : tool ? '✨ Invent an AI tool' : '✨ Invent with AI';
  const q = rec ? 'What do you want to make? The AI writes the recipe.' : tool ? 'Describe the kitchen gadget of your dreams.' : 'What do you want to grow? However crazy!';
  const note = rec ? `The AI picks the tools (in step order) and the ingredients from what you've invented. Fancier ideas = more steps, but a pricier, more wanted product. 1 credit to learn it, then craft it free forever.`
    : tool ? 'AI tools get a production boost (faster batches, extra output).' : 'AI crops get higher buyer demand (×' + DEMAND.crop.ai + ' vs ×' + DEMAND.crop.basic + '), and so do goods cooked from them. The AI paints the fruit; you pick how the plant grows.';
  const forReq = pendingReq && pendingReq.kind === type && state.aiRecipes[pendingReq.rid] ? pendingReq : null;
  return () => `<div class="sheet-h"><h3>${forReq ? `✨ Create ${esc(forReq.name)}` : title}</h3>${aiModeBadge()}<button class="x" data-act="close">✕</button></div>
   ${forReq ? `<p class="req-for">📖 Needed for <b>${esc(state.aiRecipes[forReq.rid].name)}</b>. Describe your own ${esc(forReq.name.toLowerCase())} (the idea is prefilled, change it if you like). Normal invent rules: 1 AI credit.</p>` : ''}
   <p class="prompt-q">${q}</p>
   <textarea id="ai-prompt" class="ai-prompt" maxlength="120" rows="3" data-type="${type}" placeholder="e.g. ${esc(AI_PROMPT_EXAMPLES[type][0])}">${esc(promptDraft[type])}</textarea>${aiErr && aiErr.type === type ? `<p class="ai-err" data-hook="ai-error">${esc(aiErr.msg)}</p>` : ''}
   <div class="examples"><small class="muted">Need a spark?</small>${AI_PROMPT_EXAMPLES[type].map(x => `<button class="pchip ex" data-act="ai-example" data-text="${esc(x)}">${esc(x)}</button>`).join('')}</div>
   <button class="btn ai wide" data-act="ai-submit" data-type="${type}">✨ Make it! <small>(1 credit)</small></button>
   ${type === 'crop' ? `<div class="lab-step in-sheet"><b>Growth look</b> <small class="muted">tap to cycle</small>${stagePicker(null, true)}</div>` : ''}
   <p class="muted small">${note}
   Credits: ${Entitlements.aiCredits}. A credit is only used if your item is created.</p>`;
}
/* loading state while the image service paints the idea */
function sketchSheet(type, item) {
  return () => `<div class="sheet-h"><h3>✨ ${type === 'recipe' ? 'Writing your recipe' : 'Inventing'}…</h3></div>
   <div class="reveal card ai sketching"><div class="sketch-box"><div class="sketch-paper"><span class="pencil">✏️</span><i class="scribble s1"></i><i class="scribble s2"></i><i class="scribble s3"></i></div></div>
     <div class="pv-name">${esc(item.name)} ${badge('ai')}</div>${ideaQuote(item.prompt)}
     <p class="sketch-msg">Sketching your idea…</p><div class="bar indet"><i></i></div>
     <p class="muted small">${type === 'crop' ? 'Painting the fruit. Your chosen growth look is already saved.' : type === 'recipe' ? 'Recipe written, now painting the finished dish.' : 'Painting your new tool.'} No credit is used unless this succeeds.</p></div>`;
}
function aiRevealSheet(inv, req) {
  return () => `<div class="sheet-h"><h3>✨ AI invented!</h3><button class="x" data-act="close">✕</button></div>
   <div class="reveal card ai"><div class="reveal-ico">${cropIcon(inv, 120)}</div>
     ${inv.imagePreview ? '<p class="muted small center">Stand-in preview art (no pre-made image for this idea in the offline prototype)</p>' : ''}
     <div class="pv-name">${inv.name} ${badge('ai')}</div>${ideaQuote(inv.prompt)}<p class="pv-desc">${esc(inv.desc)}</p>
     <div class="st-strip">${STAGE_ORDER.map(k => stageSVG(stagesOf(inv), k, inv, 52)).join('<span>›</span>')}</div>
     <div class="stats"><span>⏱ ${inv.growTime}s</span><span>🧺 ×${inv.yield}</span><span>${coinSVG(13)} ${inv.baseValue}¢</span><span class="hl">📈 demand ×${DEMAND.crop.ai} <small>(basic ×${DEMAND.crop.basic})</small></span></div>
     <p class="muted small">+3 samples added to your basket. Credits left: ${Entitlements.aiCredits}</p>${req ? reqDone(req) : ''}</div>
   <button class="btn wide sell-now" data-act="sell-new" data-key="c|${inv.id}" data-hook="sell-now">🧺 Sell it now!</button>
   <button class="btn wide ghost" data-act="close">Nice!</button>
   ${aiNote(inv)}`;
}

function toolRevealSheet(key, req) {
  const T = TOOLS[key];
  return () => `<div class="sheet-h"><h3>✨ AI tool invented!</h3><button class="x" data-act="close">✕</button></div>
   <div class="reveal card ai"><div class="reveal-ico">${toolIcon(key, 120)}</div>
     <div class="pv-name">${T.name} ${badge('ai')}</div>${ideaQuote(T.prompt)}<p class="pv-desc">${esc(T.desc)}</p>
     <div class="stats"><span class="hl">⚡ ${Math.round((1 / T.speedMult - 1) * 100)}% faster</span><span class="hl">🍯 +${T.bonusOut} per batch</span>${T.recipes.map(r => `<span>${RECIPES[r].name}</span>`).join('')}</div>
     <p class="muted small">Added to your Kitchen. Upgrade it with coins for even more. Credits left: ${Entitlements.aiCredits}</p>${req ? reqDone(req) : ''}</div>
   <button class="btn wide" data-act="close">Nice!</button>
   ${aiNote(T)}`;
}

/* ---------------- Paywall / settings (stubs) ---------------- */
function paywallSheet() {
  const E = Entitlements, P = Store.products;
  const row = id => `<button class="row store" data-act="buy" data-id="${id}"><div><b>${P[id].title}</b><br><small>${P[id].note || P[id].type}</small></div><span class="price ${P[id].price === 'TBD' ? 'tbd' : ''}">${P[id].price}</span></button>`;
  const plan = id => `<button class="plan ${E.subscribed && state.ent.subPlan === id ? 'cur' : ''}" data-act="buy" data-id="${id}"><b>${P[id].months === 12 ? '1 year' : P[id].months + ' months'}</b><span class="price">${P[id].price}</span><small>${P[id].save || 'prepaid term'}</small></button>`;
  const until = () => state.ent.subExpires ? new Date(state.ent.subExpires).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  return () => `<div class="sheet-h"><h3>✨ AI Store</h3><button class="x" data-act="close">✕</button></div>
   <p class="small">AI turns any idea into a crop, a tool or a recipe. Every AI action uses <b>1 credit</b>.</p>
   <p class="ai-status store-status" data-hook="store-status">${E.aiCredits} credits · ${E.subscribed ? `Market Plot+ (${E.plan.months === 12 ? '1 year' : E.plan.months + ' months'}) until ${until()} · ${E.nextGrantText()}` : 'No subscription'}</p>
   <div class="plus-card"><div class="plus-h">⭐ Market Plot+ <small>subscription</small></div>
     <ul class="perks"><li>✨ <b>${SUB_WEEKLY_CREDITS} AI credits every week</b></li>${SUB_ROLLOVER ? `<li>🔁 Unused credits roll over (up to ${SUB_CREDIT_CAP})</li>` : ''}<li>🚫 No ads</li><li>🛒 Top up with credit packs any time</li></ul>
     <div class="plans">${Store.subPlans.map(plan).join('')}</div>
     <p class="muted small">Prepaid terms (based on $4.99/month), no monthly option. Week 1 credits arrive right away.</p></div>
   <h4>Credits <small class="muted">· top up any time, subscribers too · bought credits never expire and are never capped</small></h4>
   ${Store.packs.map(row).join('')}
   <h4>Ads</h4>${row('remove_ads')}
   <p class="muted small">Prototype stub: buttons flip local flags only. No network, no real purchases. Coins are never sold for money.</p>`;
}
/* shown wherever a player runs out of credits: the cheapest way back to inventing first, then the better-value options.
   `resume` re-runs what they were doing (e.g. the Workshop idea) right after a successful purchase. */
let pendingResume = null;
function outOfCreditsSheet(resume, idea) {
  pendingResume = resume || null;
  const P = Store.products, cheapest = Store.subPlans[0];
  return () => `<div class="sheet-h"><h3>😮 Out of AI credits</h3><button class="x" data-act="close">✕</button></div>
   <div class="ooc" data-hook="out-of-credits">
   ${idea ? `<p class="ooc-idea">Your idea is saved: <b>“${esc(idea)}”</b></p>` : '<p class="small">Every AI idea uses 1 credit.</p>'}
   <button class="ooc-one" data-act="buy-quick" data-id="ai_credits_1" data-hook="buy-1-credit"><span><b>✨ 1 credit</b><small>${pendingResume ? 'Buy and Think It now' : 'Just this one idea'}</small></span><span class="price">${P.ai_credits_1.price}</span></button>
   <button class="row store" data-act="buy-quick" data-id="ai_credits_50"><div><b>${P.ai_credits_50.title}</b><br><small>${P.ai_credits_50.note}</small></div><span class="price">${P.ai_credits_50.price}</span></button>
   <button class="row store plus-row" data-act="buy-quick" data-id="${cheapest}"><div><b>⭐ Market Plot+</b><br><small>${SUB_WEEKLY_CREDITS} credits every week + no ads · ${P[cheapest].months} months</small></div><span class="price">${P[cheapest].price}</span></button>
   <button class="link" data-act="paywall">See all plans and packs</button>
   <p class="muted small">Bought credits never expire and are never capped. Prototype stub: no real purchases.</p></div>`;
}
function settingsSheet() {
  return () => `<div class="sheet-h"><h3>Settings</h3><button class="x" data-act="close">✕</button></div>
   <div class="row static"><div><b>Remove Ads</b> <small class="muted">one-time · ${Store.products.remove_ads.price}</small><br><small>Only removes ads. Status: ${Entitlements.removeAds ? 'Ads hidden' : 'Ads showing'}</small></div>
     <button class="toggle ${state.ent.removeAds ? 'on' : ''}" data-act="toggle-ads"><i></i></button></div>
   <div class="row static"><div><b>AI</b><br><small>${Entitlements.subscribed ? 'Market Plot+ active · ' + Entitlements.nextGrantText() : 'No subscription'} · ${Entitlements.aiCredits} credits</small></div><button class="btn sm ai" data-act="paywall">Store</button></div>
   <div class="row static"><div><b>Test interstitial</b><br><small>Ads.showInterstitial()</small></div><button class="btn sm ghost" data-act="test-ad">Show</button></div>
   <div class="row-btns"><button class="btn sm ghost" data-act="reset-purchases">Reset stub purchases</button><button class="btn sm danger" data-act="reset">Reset save</button></div>
   <p class="muted small">Market Plot web mockup · real game targets Unity on iPhone.</p>`;
}

/* ---------------- Input ---------------- */
/* ---------------- AI MODE (server / mock / offline) ---------------- */
function aiModeBadge() { const b = AIBackend.badge(); return `<span class="ai-mode ${AIBackend.mode}" data-hook="ai-mode">${b || '⚡ xAI live'}</span>`; }
function aiNote(item) {
  const m = item && item.meta;
  if (AIBackend.mode === 'offline') return '<p class="muted small">Offline AI (demo): made from your text by the AIInterpreter stub (no network). Run server/server.js for real AI.</p>';
  const t = m ? ` · text ${(m.ms.text / 1000).toFixed(1)}s + image ${(m.ms.image / 1000).toFixed(1)}s${m.usd && m.usd.total ? ` · ~$${m.usd.total.toFixed(3)}` : ''}` : '';
  const md = (m && m.models) || (AIBackend.info && AIBackend.info.models) || {};
  return `<p class="muted small">${AIBackend.mode === 'mock' ? `🧪 Mock AI (test): server.js → local mock of the xAI API, not real ${esc(md.text || '')} / ${esc(md.image || '')} output` : `Made by xAI via the local server: ${esc(md.text || '')} + ${esc(md.image || '')}`}${t}</p>`;
}
/* ---------------- RECIPE BOOK (full-screen cookbook overlay) ---------------- */
function recipeStatus(id) {
  const c = Game.recipeCheck(id), j = c.job, qd = c.tool && Game.queueOf(c.tool).some(x => x.rid === id);
  if (j) { const tk = Object.keys(state.jobs).find(t => state.jobs[t] === j), n = c.plan.length, st = n > 1 ? `Step ${j.step + 1}/${n} · ` : '';
    return Game.jobProgress(j) >= 1 ? ['collect', j.step < n - 1 ? `➡️ ${st}move on` : '🍯 Collect'] : ['busy', `⏳ ${st}${TOOLS[tk] ? TOOLS[tk].name : ''}`]; }
  if (qd) return ['busy', `⏳ Queued · ${TOOLS[c.tool].name}`];
  if (c.locked) return ['locked', `🔒 ${c.req.filter(q => q.ref).length}/${c.req.length} created`];
  return c.ok ? ['ok', '✅ Ready to cook'] : ['miss', '🧺 Missing items'];
}
function bookButton() {
  const ids = Object.keys(state.aiRecipes), st = ids.map(recipeStatus);
  const n = k => st.filter(s => s[0] === k).length;
  return `<button class="book-btn" data-act="book" data-hook="recipe-book-btn"><span class="bb-ico">📖</span><span><b>Recipe Book</b><small>${ids.length ? `${ids.length} recipe${ids.length === 1 ? '' : 's'} · ${n('ok')} ready${n('locked') ? ` · ${n('locked')} 🔒` : ''}` : 'Learned recipes · create new ones in the Workshop'}</small></span><span class="bb-go">›</span></button>`;
}
function openBook(page = null, fresh = false) { book = { open: true, tab: page ? 'page' : 'index', page, fresh }; renderBook(); }
function closeBook() { book.open = false; renderBook(); renderKitchen(); }
function bookSig() { return [book.tab, book.page, book.fresh, state.farmIdx, Entitlements.aiCredits, state.order.length, Object.keys(state.tools).map(k => k + (state.tools[k].owned ? 1 : 0)).join(), storeSig('pantry'), storeSig('ready'), Object.keys(state.aiRecipes).map(id => id + recipeStatus(id)[1]).join()].join('|'); }
function renderBook() {
  const el = $('#book'); if (!el) return;
  if (!book.open) { el.classList.remove('show'); el.innerHTML = ''; return; }
  const ids = Object.keys(state.aiRecipes);
  if (book.tab === 'page' && !state.aiRecipes[book.page]) book.tab = 'index';
  const tab = (k, label, extra = '') => `<button class="btab ${book.tab === k ? 'sel' : ''}" data-act="book-tab" data-tab="${k}" ${extra}>${label}</button>`;
  let body;
  if (book.tab === 'new') book.tab = 'index';
  else if (book.tab === 'page') body = recipePage(book.page);
  else body = ids.length ? `<div class="bk-index">${ids.map(id => { const R = state.aiRecipes[id], [cls, txt] = recipeStatus(id);
      return `<button class="bk-card ${cls}" data-act="book-tab" data-tab="page" data-page="${id}">${recipeIcon(R, 64)}<b>${esc(R.name)}</b>${starsHTML(R.stars)}<span class="bk-st">${txt}</span>${chefOn(id) ? '' : '<span class="bk-off">👨‍🍳 off</span>'}</button>`; }).join('')}</div>${chefControlsHTML()}`
    : `<div class="bk-empty"><p>📖 Your cookbook is empty.</p><p class="muted">Describe any dish in the Workshop, and the AI writes the recipe: the tools, the crops, the steps. Learned recipes cook in the tool they need. If it needs things you haven't made yet, you'll create them yourself.</p>${createLink('recipe', '', '✨ Create a recipe in the Workshop')}</div>`;
  el.innerHTML = `<div class="book-cover"><div class="book-h"><h2>📖 Recipe Book</h2>${state.farms.length > 1 ? `<span class="bk-loc">📍 ${esc(state.farms[state.farmIdx].name)}</span>` : ''}<button class="x" data-act="book-close" aria-label="Close">✕</button></div>
    <div class="book-tabs">${tab("index", `📖 All <small>${ids.length}</small>`)}<button class="btab" data-act="th-create" data-type="recipe" data-hook="book-create">✨ New in Workshop</button>${book.tab === 'page' ? tab('page', esc(state.aiRecipes[book.page].name)) : ''}</div>
    <div class="book-paper" data-hook="recipe-book">${body}</div></div>`;
  el.classList.add('show'); sigs.book = bookSig();
}
function reqDone(req) { return `<p class="req-done">📖 ✅ ${esc(req.name)} ticked off for <b>${esc(state.aiRecipes[req.rid] ? state.aiRecipes[req.rid].name : 'your recipe')}</b></p>`; }
function recipePage(id) {
  const R = state.aiRecipes[id], c = Game.recipeCheck(id), j = c.job, ids = Object.keys(state.aiRecipes), n = ids.indexOf(id);
  const reqRows = c.req.map((q, i) => `<li class="${q.ref ? 'ok' : 'miss'}"><span class="ck">${q.ref ? '✅' : '⬜'}</span>
      ${q.ref ? (q.kind === 'crop' ? cropIcon(state.inventions[q.ref], 30) : toolIcon(q.ref, 30)) : `<span class="req-ico">${q.kind === 'crop' ? '🌱' : '🔧'}</span>`}
      <div><b>${esc(q.name)}</b><br><small>${q.ref ? `✓ created: ${esc(q.kind === 'crop' ? state.inventions[q.ref].name : TOOLS[q.ref].name)}` : `new ${q.kind} · not in your game yet`}</small></div>
      ${q.ref ? '' : `<button class="btn sm ai" data-act="req-create" data-r="${id}" data-i="${i}">✨ Create in Workshop</button>`}</li>`).join('');
  const toolRows = c.tools.map((s, k) => {
    const name = s.tool ? TOOLS[s.tool].name : s.req.name;
    const st = !s.tool ? '<span class="pill plock">🔒 create first</span>' : s.owned ? '<span class="pill ok">✓ owned</span>'
      : TOOLS[s.tool].cost ? `<button class="btn sm" data-act="buytool-r" data-k="${s.tool}" data-r="${id}">Buy tool · ${TOOLS[s.tool].cost}¢</button>` : '<span class="pill miss">not owned</span>';
    const pl = c.plan[k] || {}, adds = (pl.adds || []).map(x => c.ings[x]).filter(Boolean).map(g => `${esc(g.info ? g.info.name : g.req ? g.req.name : '?')} ×${g.qty}`);
    return `<li class="${s.owned ? 'ok' : 'miss'}"><span class="sn">${k + 1}</span>${s.tool ? toolIcon(s.tool, 30) : '<span class="req-ico">🔧</span>'}<div><b>${esc(s.action)}</b> <small>in the ${esc(name)} · ${fmtS(pl.time || 0)}</small><br><small class="muted">${adds.length ? 'adds ' + adds.join(', ') + ' · ' : ''}makes <b>${esc(pl.makes || '')}</b></small></div>${st}</li>`; }).join('');
  const ingRows = c.ings.map(g => {
    const name = g.info ? g.info.name : g.req ? g.req.name : g.key, ok = g.key && g.have >= g.qty;
    const st = !g.key ? '<span class="pill plock">🔒 create first</span>' : ok ? '<span class="pill ok">✓ have</span>'
      : g.key.startsWith('c|') ? `<button class="btn sm ghost" data-act="grow" data-name="${esc(name)}">🌱 Grow</button>` : '<span class="pill miss">🍳 cook it</span>';
    return `<li class="${ok ? 'ok' : 'miss'}">${g.info ? g.info.icon(30) : '<span class="req-ico">🌱</span>'}<div><b>${esc(name)}</b><br><small>${g.key ? `${Math.min(g.have, g.qty)}/${g.qty} in the kitchen` : `need ${g.qty}`}</small></div>${st}</li>`; }).join('');
  const btn = j ? (Game.jobProgress(j) >= 1 ? `<button class="btn wide pulse" data-act="craft-collect" data-k="${id}">${j.step < c.plan.length - 1 ? `➡️ Move ${esc(c.plan[j.step].makes)} on` : `Collect ×${j.out}`}</button>` : `<div class="job"><div class="bar"><i data-prog="craft" data-k="${id}" style="width:${Game.jobProgress(j) * 100}%"></i></div></div>`)
    : c.locked ? `<button class="btn wide disabled">🔒 Locked · create ${c.req.filter(q => !q.ref).map(q => esc(q.name)).join(', ')}</button>`
    : c.busy ? `<button class="btn wide disabled">⏳ The ${esc(TOOLS[c.tool].name)} queue is full</button>`
    : c.ok ? `<button class="btn wide" data-act="craft" data-k="${id}" data-hook="cook-in-tool">🍳 ${state.jobs[c.tool] ? 'Queue' : c.plan.length > 1 ? 'Start' : 'Cook'} in the ${esc(TOOLS[c.tool].name)} <small>(free · ${fmtS(R.craftTime)})</small></button>`
    : `<button class="btn wide disabled" data-act="craft" data-k="${id}">Gather the missing tools &amp; ingredients</button>`;
  return `<div class="rp ${c.locked ? 'locked' : ''}" data-hook="recipe-page">
    <div class="rp-nav">${ids.length > 1 ? `<button class="x" data-act="book-turn" data-d="-1">‹</button>` : '<span></span>'}<small>page ${n + 1} of ${ids.length}</small>${ids.length > 1 ? `<button class="x" data-act="book-turn" data-d="1">›</button>` : '<span></span>'}</div>
    ${book.fresh ? `<p class="req-done">✨ Recipe learned! 1 credit used · ${Entitlements.aiCredits} left${c.locked ? '. Create the new items below to unlock it.' : ''}</p>` : ''}
    <div class="rp-top"><div class="rp-img">${recipeIcon(R, 112)}${c.locked ? '<span class="rp-lock">🔒</span>' : ''}</div>
      <div><div class="pv-name">${esc(R.name)} ${badge('ai', 1)}</div>${ideaQuote(R.prompt)}
        <div class="rp-meta"><span>Difficulty ${starsHTML(R.stars)}</span><span class="hl">${coinSVG(13)} ~${R.value}¢</span><span class="hl">📈 ×${recipeDemand(R).demand.toFixed(2)}</span><span>⏱ ${fmtS(R.craftTime)} · ×${R.out}</span></div></div></div>
    ${c.req.length ? `<div class="rp-req ${c.locked ? 'locked' : 'open'}"><h4>${c.locked ? '🔒 Locked · create these to unlock' : '🔓 Unlocked · everything created'} <small>${c.req.filter(q => q.ref).length}/${c.req.length}</small></h4><ul class="rp-list">${reqRows}</ul></div>` : ''}
    <h4>🔧 Steps <small class="muted">tool by tool, in order</small></h4><ul class="rp-list">${toolRows}</ul>
    <h4>🧺 Crops &amp; ingredients</h4><ul class="rp-list">${ingRows}</ul>
    ${c.tool ? `<p class="muted small st-note">🔥 ${c.plan.length > 1 ? `Cooks step by step: <b>${esc(c.plan.map(s => s.tool && TOOLS[s.tool] ? TOOLS[s.tool].name : s.req ? s.req.name : '?').join(' → '))}</b>. The half-made dish waits in each station; tap <b>Move</b> to send it on (a Kitchen Helper or Head Chef does it for you).` : `Cooks in the <b>${esc(TOOLS[c.tool].name)}</b> station.`}</p>` : ''}
    <div class="ctl-row page" data-hook="chef-page">👨‍🍳 <span><b>Chef can make</b><small class="muted">Kitchen Helper / Head Chef may cook it here. You always can.</small></span>${chefTog(id)}</div>
    ${btn}<div class="row-btns"><button class="btn ghost slim" data-act="stats" data-key="r|${id}">📊 Stats</button><button class="btn ghost slim danger-t" data-act="del-ask" data-type="recipe" data-ref="${id}">🗑 Delete</button></div></div>`;
}
/* ---------------- LOCATIONS + LOGISTICS ---------------- */
function locChips() {
  if (state.farms.length < 2) return '';
  return `<div class="farm-sw" data-hook="locations">${state.farms.map((f, i) => `<button class="tchip ${i === state.farmIdx ? 'sel' : ''}" data-act="farm-sw" data-i="${i}">${f.emoji} ${esc(f.name)} <small>${f.plots.filter(p => p.inv && Game.plotProgress(p) >= 1).length ? '🧺' : ''}${Object.values(f.workers).filter(w => w.hired).length ? '👷' : ''}</small></button>`).join('')}</div>`;
}
/* one stack in a storage location, with quick one-tap Send buttons (whole stack per tap) */
function stackRow(x, from, dests) {
  return `<div class="stack">${x.icon(30)}<button class="sname" data-act="stats" data-key="${x.key}"><b>${esc(x.name)}</b> ×${x.qty}</button>
    <span class="sends">${dests.filter(([to]) => to !== 'pantry' || x.key.startsWith('c|')).map(([to, label]) => `<button class="btn sm send" data-act="send" data-key="${x.key}" data-from="${from}" data-to="${to}">→ ${label}</button>`).join('')}</span></div>`;
}
/* ---------------- WORKERS + ORDERS ---------------- */
function workerPortrait(k, size = 56) {
  const skin = { krunner: '#f0c08e', mrunner: '#b9825a', harvester: '#d9a477', farmhand: '#f2c29b', manager: '#c98e63', helper: '#ffd9b8', chef: '#a8724c', market: '#e8b48a' }[k];
  const bg = { krunner: '#e6f6d8', mrunner: '#e2f0ff', harvester: '#fff2bf', farmhand: '#d9f3c9', manager: '#cfe6ff', helper: '#ffe7c4', chef: '#f1e3ff', market: '#ffe0ea' }[k];
  const hat = {
    farmhand: '<ellipse cx="40" cy="27" rx="27" ry="6" fill="#f2cf6b" stroke="#5b3a1e" stroke-width="2.5"/><path d="M26 27c0-12 28-12 28 0z" fill="#f6dc85" stroke="#5b3a1e" stroke-width="2.5"/><path d="M27 24h26" stroke="#d1553d" stroke-width="3"/>',
    krunner: '<path d="M22 30c0-14 36-14 36 0z" fill="#6fbf5a" stroke="#5b3a1e" stroke-width="2.5"/><path d="M56 29h9" stroke="#5b3a1e" stroke-width="3" stroke-linecap="round"/><path d="M48 58h18l-2 14H50z" fill="#c98b4f" stroke="#5b3a1e" stroke-width="2"/><circle cx="53" cy="56" r="3.5" fill="#f2c94c" stroke="#5b3a1e" stroke-width="1.4"/><circle cx="61" cy="56" r="3.5" fill="#e8553f" stroke="#5b3a1e" stroke-width="1.4"/>',
    mrunner: '<path d="M22 30c0-14 36-14 36 0z" fill="#4f8ff0" stroke="#5b3a1e" stroke-width="2.5"/><path d="M56 29h9" stroke="#5b3a1e" stroke-width="3" stroke-linecap="round"/><rect x="48" y="54" width="18" height="16" rx="2" fill="#e9c98f" stroke="#5b3a1e" stroke-width="2"/><path d="M48 60h18M57 54v16" stroke="#5b3a1e" stroke-width="1.6"/>',
    harvester: '<path d="M20 30c4-16 36-16 40 0z" fill="#e85d4a" stroke="#5b3a1e" stroke-width="2.5"/><path d="M18 30h44" stroke="#5b3a1e" stroke-width="3" stroke-linecap="round"/><path d="M50 56c4 0 14 0 16 4l-3 12H49l-3-12c1-3 2-4 4-4z" fill="#d9a35c" stroke="#5b3a1e" stroke-width="2"/><path d="M49 62h16M50 67h14" stroke="#5b3a1e" stroke-width="1.4"/><circle cx="53" cy="56" r="3" fill="#e8553f" stroke="#5b3a1e" stroke-width="1.4"/><circle cx="60" cy="55" r="3" fill="#8e4fc9" stroke="#5b3a1e" stroke-width="1.4"/>',
    manager: '<path d="M22 29c0-14 36-14 36 0z" fill="#3f7fd0" stroke="#5b3a1e" stroke-width="2.5"/><path d="M50 28h14c0 3-4 4-14 3z" fill="#2f63a8" stroke="#5b3a1e" stroke-width="2"/><rect x="52" y="52" width="16" height="20" rx="2" fill="#c8a06a" stroke="#5b3a1e" stroke-width="2"/><path d="M55 58h10M55 63h10M55 68h6" stroke="#5b3a1e" stroke-width="1.6"/>',
    helper: '<path d="M22 30c2-12 34-12 36 0z" fill="#ff8fa3" stroke="#5b3a1e" stroke-width="2.5"/><circle cx="31" cy="25" r="2" fill="#fff"/><circle cx="42" cy="22" r="2" fill="#fff"/><circle cx="51" cy="26" r="2" fill="#fff"/><path d="M57 29l7 5-8 1" fill="#ff8fa3" stroke="#5b3a1e" stroke-width="2"/>',
    chef: '<rect x="27" y="22" width="26" height="10" fill="#fff" stroke="#5b3a1e" stroke-width="2.5"/><path d="M27 23c-8-2-8-14 1-13c1-7 11-8 12-2c3-6 13-4 12 3c8-1 9 11 1 12z" fill="#fff" stroke="#5b3a1e" stroke-width="2.5"/><path d="M33 63c4 3 10 3 14 0" stroke="#5b3a1e" stroke-width="3" fill="none" stroke-linecap="round"/>',
    market: '<path d="M22 30c0-15 36-15 36 0z" fill="#9b6bd6" stroke="#5b3a1e" stroke-width="2.5"/><path d="M20 30h40" stroke="#5b3a1e" stroke-width="3" stroke-linecap="round"/><path d="M28 18h24" stroke="#f6e6ff" stroke-width="2.5" stroke-dasharray="4 4"/><rect x="50" y="56" width="16" height="12" rx="2" fill="#f3d9a4" stroke="#5b3a1e" stroke-width="2"/><text x="58" y="65.5" font-size="8" text-anchor="middle" fill="#5b3a1e" font-weight="700">¢</text>',
  }[k];
  const body = { krunner: '#4f9e5a', mrunner: '#3f6fb0', harvester: '#6fae4a', farmhand: '#5e9be0', manager: '#7a5a3a', helper: '#ffb547', chef: '#ffffff', market: '#7fc8a9' }[k];
  return `<svg class="wportrait" viewBox="0 0 80 80" width="${size}" height="${size}"><circle cx="40" cy="40" r="38" fill="${bg}" stroke="#5b3a1e" stroke-width="3"/>
    <path d="M14 78c2-14 12-20 26-20s24 6 26 20" fill="${body}" stroke="#5b3a1e" stroke-width="2.5"/>
    <circle cx="40" cy="42" r="16" fill="${skin}" stroke="#5b3a1e" stroke-width="2.5"/><circle cx="34" cy="41" r="2.2" fill="#3a2614"/><circle cx="46" cy="41" r="2.2" fill="#3a2614"/>
    <path d="M35 48c3 3 7 3 10 0" stroke="#3a2614" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="30" cy="46" r="2.5" fill="#ff9e9e" opacity=".6"/><circle cx="50" cy="46" r="2.5" fill="#ff9e9e" opacity=".6"/>${hat}</svg>`;
}
function workerCard(k) {
  const W = WORKERS[k], w = state.workers[k];
  return `<div class="worker card ${w.stopped ? 'stopped' : ''} ${W.tier}" data-worker="${k}">${workerPortrait(k, 50)}<div class="wk-body"><div><b>${W.name}</b> <span class="wtier">${W.tier === 'pro' ? '⭐ Pro' : 'Cheap'}</span></div>
    <div class="wstatus" data-wstatus="${k}">${esc(w.status || '…')}</div><small class="muted">Wage ${W.wage}¢ / ${WORKER_ECON.wagePeriod}s · hired for ${W.hire}¢</small></div>
    <button class="btn sm ghost" data-act="fire" data-k="${k}">Let go</button></div>`;
}
function workersSection(area) {
  const hired = Object.keys(WORKERS).filter(k => WORKERS[k].area === area && state.workers[k] && state.workers[k].hired);
  return `<div class="workers-h"><h3 class="sub">👷 Workers</h3><button class="btn sm" data-act="hire-sheet" data-k="${area}">＋ Hire</button></div>
    ${hired.length ? hired.map(workerCard).join('') : `<p class="muted small">${area === 'farm' ? 'Hire help to plant empty plots (Farmhand, Farm Manager) or pick ripe crops (Harvester). You can always harvest by hand too.' : area === 'market' ? 'Hire a Market Manager to stock, price and promote the stall for you.' : 'Hire help to cook from your harvest while you run the stall.'}</p>`}`;
}
function ordersPanel() {
  const o = state.orders;
  return `<div class="orders card" data-hook="orders"><div class="ord-h">📋 Orders board <small class="muted">${state.workers.chef && state.workers.chef.hired ? 'posted by the Head Chef' : 'hire a Head Chef to post orders'}</small></div>
    ${o.length ? o.map(x => { const inf = itemInfo(x.key), have = forKitchen(x.key); return `<div class="ord">${inf ? inf.icon(26) : ''}<span><b>${inf ? esc(inf.name) : x.key}</b> <small>for ${esc(x.for)}</small></span><span class="ord-n">${Math.min(have, x.need)}/${x.need}</span></div>`; }).join('') : '<p class="muted small">No open orders.</p>'}</div>`;
}
/* ---------------- FARM MAP (unlocks when home plots are fully upgraded) ---------------- */
function mapSVG() {
  const pin = F => { const own = Farms.owned(F.id);
    return `<g class="mpin ${own ? 'own' : ''}" data-act="map-pick" data-k="${F.id}" transform="translate(${F.x} ${F.y})">
      <ellipse cx="0" cy="22" rx="34" ry="9" fill="#00000018"/>
      <rect x="-30" y="2" width="60" height="18" rx="4" fill="${own ? '#a7d98a' : '#c8e6a0'}" stroke="#5b3a1e" stroke-width="2"/>
      ${[-22, -12, -2, 8, 18].map(x => `<path d="M${x} 6v10" stroke="#6f9c4a" stroke-width="3" stroke-linecap="round"/>`).join('')}
      <path d="M-14 -4l12-12 12 12z" fill="#e0614f" stroke="#5b3a1e" stroke-width="2"/><rect x="-11" y="-4" width="18" height="12" fill="#f07a62" stroke="#5b3a1e" stroke-width="2"/><rect x="-5" y="1" width="6" height="7" fill="#fff3d6" stroke="#5b3a1e" stroke-width="1.5"/>
      <g transform="translate(16 -22)"><path d="M0 0v26" stroke="#7a4a24" stroke-width="2.5"/><rect x="-2" y="-12" width="${own ? 40 : 46}" height="16" rx="3" fill="${own ? '#5aa23a' : '#fff1c9'}" stroke="#5b3a1e" stroke-width="2"/>
        <text x="${own ? 18 : 21}" y="0" font-size="10" font-weight="800" text-anchor="middle" fill="${own ? '#fff' : '#5b3a1e'}">${own ? 'Yours' : F.price + '¢'}</text></g>
      <text x="0" y="40" font-size="11.5" font-weight="800" text-anchor="middle" fill="#3d2a16" stroke="#fffaf0" stroke-width="3" paint-order="stroke">${F.emoji} ${F.name}</text></g>`; };
  const tree = (x, y, r = 9) => `<g><path d="M${x} ${y + r}v6" stroke="#7a4a24" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r}" fill="#6fbf5a" stroke="#4f7f34" stroke-width="2"/><circle cx="${x - 3}" cy="${y - 3}" r="${r / 3}" fill="#9be07f"/></g>`;
  return `<svg class="map-svg" viewBox="0 0 360 290" width="100%">
    <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ef9d"/><stop offset="1" stop-color="#a9dc7c"/></linearGradient></defs>
    <rect x="2" y="2" width="356" height="286" rx="20" fill="url(#mg)" stroke="#5b3a1e" stroke-width="3"/>
    <path d="M150 2c10 40-40 60-10 100s70 30 60 80-40 60-30 106" fill="none" stroke="#7cc6ec" stroke-width="18" stroke-linecap="round"/>
    <path d="M150 2c10 40-40 60-10 100s70 30 60 80-40 60-30 106" fill="none" stroke="#bfe6f8" stroke-width="5" stroke-dasharray="10 14"/>
    <path d="M180 160C130 150 110 110 78 108M180 160c40-10 60-60 88-70M180 160c50 10 80 30 104 60M180 160c-50 20-80 40-110 76" fill="none" stroke="#e8c98f" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 0"/>
    <path d="M30 60q30-34 60 0M250 270q40-40 80 0M300 140q22-24 44 0" fill="#b4e08a" stroke="#7fb257" stroke-width="2"/>
    ${tree(30, 140)}${tree(44, 150, 7)}${tree(220, 30)}${tree(236, 40, 7)}${tree(330, 110)}${tree(200, 260, 8)}${tree(120, 270, 7)}${tree(318, 252, 8)}${tree(130, 40, 7)}
    <g transform="translate(180 160)"><ellipse cx="0" cy="18" rx="30" ry="8" fill="#00000018"/><path d="M-18 4l18-18 18 18z" fill="#9b6bd6" stroke="#5b3a1e" stroke-width="2"/><rect x="-15" y="4" width="30" height="16" fill="#fff6e4" stroke="#5b3a1e" stroke-width="2"/><rect x="-4" y="9" width="8" height="11" fill="#e0a85f" stroke="#5b3a1e" stroke-width="1.5"/>
      <text x="0" y="36" font-size="11.5" font-weight="800" text-anchor="middle" fill="#3d2a16" stroke="#fffaf0" stroke-width="3" paint-order="stroke">🏡 Home Farm</text></g>
    <g transform="translate(330 30)"><circle r="14" fill="#fffaf0" stroke="#5b3a1e" stroke-width="2"/><path d="M0-10l4 10-4 10-4-10z" fill="#e0614f"/><text y="-17" font-size="9" text-anchor="middle" font-weight="800" fill="#5b3a1e">N</text></g>
    ${FARMS_FOR_SALE.map(pin).join('')}</svg>`;
}
let mapSel = null;
function mapSheet() {
  return () => {
    if (!Farms.mapUnlocked()) return `<div class="sheet-h"><h3>🗺️ Map</h3><button class="x" data-act="close">✕</button></div>
      <div class="map-locked">${mapSVG()}<div class="lock-over">🔒<b>Fully upgrade your plots to unlock the map</b><small>${state.farms[0].plots.length}/${MAX_HOME_PLOTS} plots on your Home Farm</small></div></div>`;
    return `<div class="sheet-h"><h3>🗺️ Valley Map</h3><button class="x" data-act="close">✕</button></div>
      <p class="muted small">New farms for sale, coins only. Each one is a <b>fresh start</b>: its own plots, kitchen, market and storage, basic seeds and starter tools only, no workers or recipes. Coins and AI credits are shared.</p>
      ${mapSVG()}
      <div class="farm-list">${FARMS_FOR_SALE.map(F => { const own = Farms.owned(F.id), idx = state.farms.findIndex(f => f.id === F.id);
        return `<div class="farm-row card ${mapSel === F.id ? 'sel' : ''} ${own ? 'own' : ''}"><span class="fe">${F.emoji}</span><div class="grow"><b>${F.name}</b> <small class="muted">+${F.plots} plots</small><br><small>${F.desc}</small></div>
          ${own ? `<button class="btn sm ghost" data-act="farm-sw" data-i="${idx}">Go</button>` : `<button class="btn sm ${state.coins >= F.price ? '' : 'disabled'}" data-act="farm-buy" data-k="${F.id}">${F.price}¢</button>`}</div>`; }).join('')}</div>
      <p class="muted small">You have ${state.coins}¢.</p>`;
  };
}
function hireSheet(area) {
  return () => `<div class="sheet-h"><h3>👷 Hire ${area} help</h3><button class="x" data-act="close">✕</button></div>
    <p class="muted small">Paid in coins only: a one-time hire fee plus a small wage every ${WORKER_ECON.wagePeriod}s. If you can't cover a wage, that worker stops until you can. ${area === 'farm' ? 'Farmhand and Farm Manager only <b>plant</b> into empty plots (seeds cost ' + ECON.seedCost + '¢ as usual). The <b>Harvester</b> only <b>harvests</b> ripe plots into the Farm Basket. You can still harvest by hand. Workers stay at the location where you hire them.' : area === 'market' ? 'Sells finished goods first; leaves crops alone while kitchen workers or the Orders board need them. Flyers are paid from your coins.' : 'Kitchen workers cook only from the Kitchen Pantry and put finished goods on the Ready shelf.'}</p>
    <div class="hire-list">${Object.keys(WORKERS).filter(k => WORKERS[k].area === area).map(k => { const W = WORKERS[k], h = state.workers[k] && state.workers[k].hired;
      return `<div class="hire card ${W.tier}">${workerPortrait(k, 72)}<div class="wk-body"><div><b>${W.name}</b> <span class="wtier">${W.tier === 'pro' ? '⭐ Pro' : 'Cheap'}</span></div><p>${W.desc}</p>
        <div class="stats"><span>${coinSVG(12)} Hire ${W.hire}¢</span><span>💸 Wage ${W.wage}¢ / ${WORKER_ECON.wagePeriod}s</span><span>⏱ every ${W.every}s</span></div>
        ${h ? '<button class="btn sm disabled">Hired ✓</button>' : `<button class="btn sm ${state.coins >= W.hire ? '' : 'disabled'}" data-act="hire" data-k="${k}">Hire for ${W.hire}¢</button>`}</div></div>`; }).join('')}</div>
    <p class="muted small">You have ${state.coins}¢.</p>`;
}
function marketSig() { return state.farmIdx + storeSig('stock') + state.stall.map(s => s ? s.key + ':' + s.qty + ':' + s.price : '-').join(',') + '|' + workersSig('market'); }
function workersSig(area) { return state.farmIdx + Object.keys(WORKERS).filter(k => WORKERS[k].area === area).map(k => state.workers[k] ? (state.workers[k].stopped ? 'S' : 'H') : '-').join('') + '|' + state.orders.map(o => o.key + o.need + forKitchen(o.key)).join(','); }

/* ---------------- STATS card + COLLECTION ---------------- */
let statsFrom = null, colSort = 'earned', colFilter = 'all';
function stockOf(key) { return totalQty(key) + state.stall.filter(x => x && x.key === key).reduce((a, x) => a + x.qty, 0); }
function statRow(label, val) { return `<div class="sr"><span>${label}</span><b>${val}</b></div>`; }
function ingChip(key, qty) { const inf = itemInfo(key); return inf ? `<button class="ing-chip" data-act="stats" data-key="${key}">${inf.icon(26)}<span>${esc(inf.name)}</span><b>×${qty}</b></button>` : ''; }
function toolChip(k, used) { return TOOLS[k] ? `<span class="tool-chip ${used ? 'used' : ''}">${toolIcon(k, 24)}<span>${TOOLS[k].name}</span>${TOOLS[k].source === 'ai' ? '<i>✨</i>' : ''}</span>` : ''; }
function statsSheet(key) {
  const fn = () => {
    const info = itemInfo(key);
    if (!info) return `<div class="sheet-h"><h3>Stats</h3><button class="x" data-act="close">✕</button></div><p class="muted">Unknown item.</p>`;
    const st = state.itemStats[key] || { made: 0, sold: 0, earned: 0, best: 0, tools: [] };
    const avg = st.sold ? Math.round(st.earned / st.sold) : 0;
    let type, body = '', prompt = null;
    if (info.kind === 'crop') {
      const inv = info.inv, sg = stagesOf(inv); prompt = inv.prompt;
      type = `Crop · ${BASES[inv.base].name} + ${TRAITS[inv.trait].name}`;
      body = `<h4>Growth stages <small class="muted">(preset looks${inv.source === 'ai' ? ' · AI-painted fruit' : ''})</small></h4>
        <div class="st-strip" data-hook="stats-stages">${STAGE_ORDER.map(k => `<div class="ss">${stageSVG(sg, k, inv, 54)}<small><b>${STAGE_LABEL[k]}</b><br>${STAGE_LIB[k][sg[k]].name}</small></div>`).join('')}</div>
        <div class="sgrid">${statRow('⏱ Grow time', fmtS(inv.growTime))}${statRow('🧺 Yield', '×' + inv.yield)}${statRow('🪙 Base value', inv.baseValue + '¢')}${statRow('💎 Rarity', inv.rarity)}${statRow('🌾 Harvested / got', st.made)}</div>`;
    } else if (info.kind === 'product') {
      const r = RECIPES[info.recipe], inv = info.inv, ex = info.combo || [];
      type = `Product · ${r.name}${ex.length ? ' · combo of ' + (ex.length + 1) : ''}`;
      const tools = Object.keys(TOOLS).filter(k => TOOLS[k].recipes && TOOLS[k].recipes.includes(info.recipe) && state.tools[k] && state.tools[k].owned);
      body = `<h4>Ingredients</h4><div class="ing-list">${ingChip('c|' + inv.id, r.uses)}${ex.map(x => ingChip(x.recipe ? `p|${x.id}|${x.recipe}|${x.inv.source}` : 'c|' + x.id, 1)).join('')}</div>
        <h4>Tools</h4><div class="ing-list">${[...new Set([...st.tools, ...tools])].map(k => toolChip(k, st.tools.includes(k))).join('') || '<span class="muted">No tool owned for this yet</span>'}</div>
        <div class="sgrid">${statRow('⏱ Craft time', fmtS(r.time * (1 + 0.15 * ex.length)) + ' base')}${statRow('🪙 Value', info.value + '¢')}${statRow('⭐ Difficulty', starsHTML(1 + ex.length))}${statRow('🍳 Made', st.made)}</div>`;
    } else {
      const R = info.recipe; prompt = R.prompt; const P = recipeParts(R);
      type = `AI recipe dish · ${R.steps.length} steps`;
      body = `<h4>Ingredients</h4><div class="ing-list">${P.ings.map(g => g.key ? ingChip(g.key, g.qty) : `<span class="tchip sm">🔒 ${esc(g.req.name)} ×${g.qty}</span>`).join('')}</div>
        <h4>Tools (in order)</h4><div class="ing-list">${P.steps.map((x, n) => `<span class="sn">${n + 1}</span>` + (x.tool ? toolChip(x.tool, true) : `<span class="tchip sm">🔒 ${esc(x.req.name)}</span>`)).join('')}</div>
        <div class="sgrid">${statRow('⏱ Craft time', fmtS(R.craftTime))}${statRow('🧺 Per craft', '×' + R.out)}${statRow('🪙 Value', R.value + '¢')}${statRow('⭐ Difficulty', starsHTML(R.stars))}${statRow('🍳 Made', st.made)}</div>`;
    }
    return `<div class="sheet-h">${statsFrom === 'collection' ? '<button class="x back" data-act="collection">‹</button>' : ''}<h3>📊 Stats</h3><button class="x" data-act="close">✕</button></div>
     <div class="stats-card card ${info.src}" data-hook="stats-card">
       <div class="sc-top"><div class="sc-img">${info.icon(104)}</div><div><div class="pv-name">${esc(info.name)}</div>
         <div class="sc-tags"><span class="tchip sm">${type}</span>${badge(info.src, 1)}</div>${prompt ? ideaQuote(prompt) : ''}</div></div>
       ${body}
       <h4>Demand</h4>${demandBreak(info.ds)}
       <h4>Sales</h4>
       <div class="sgrid sales">${statRow('🛒 Units sold', st.sold)}${statRow('💰 Total earned', st.earned + '¢')}${statRow('🏆 Best price', st.best ? st.best + '¢' : '—')}${statRow('📊 Avg price', avg ? avg + '¢' : '—')}${statRow('📦 In stock', stockOf(key))}${statRow('🧺 On stall', state.stall.some(x => x && x.key === key) ? 'yes' : 'no')}</div>
     </div>`;
  };
  fn.isStats = true;
  return fn;
}
function collectionKeys() {
  const keys = new Set(state.order.map(id => 'c|' + id));
  [...Object.keys(state.itemStats), ...Object.keys(storeMap(Object.keys(LOCS))), ...state.stall.filter(Boolean).map(x => x.key)].forEach(k => { if (/^[pr]\|/.test(k)) keys.add(k); });
  Object.keys(state.aiRecipes).forEach(id => keys.add('r|' + id));
  return [...keys].filter(k => itemInfo(k));
}
function collectionSheet() {
  const fn = () => {
    const rows = collectionKeys().map(k => { const inf = itemInfo(k), st = state.itemStats[k] || {}; return { k, inf, value: inf.value, demand: inf.demand, sold: st.sold || 0, earned: st.earned || 0 }; })
      .filter(x => colFilter === 'all' || (colFilter === 'crops' ? x.inf.kind === 'crop' : x.inf.kind !== 'crop'))
      .sort((a, b) => b[colSort] - a[colSort] || a.inf.name.localeCompare(b.inf.name));
    const sorts = [['value', '🪙 Value'], ['demand', '📈 Demand'], ['sold', '🛒 Sold'], ['earned', '💰 Earned']];
    const tot = Object.values(state.itemStats).reduce((a, x) => ({ sold: a.sold + x.sold, earned: a.earned + x.earned }), { sold: 0, earned: 0 });
    return `<div class="sheet-h"><h3>📖 Collection</h3><button class="x" data-act="close">✕</button></div>
     <p class="muted small">${state.order.length} crops · ${rows.length} shown · ${tot.sold} sold for ${tot.earned}¢ (tracked per item)</p>
     <div class="pick">${[['all', 'All'], ['crops', 'Crops'], ['products', 'Products']].map(([f, l]) => `<button class="tchip ${colFilter === f ? 'sel' : ''}" data-act="col-filter" data-f="${f}">${l}</button>`).join('')}</div>
     <div class="pick sort">Sort: ${sorts.map(([s2, l]) => `<button class="tchip sm ${colSort === s2 ? 'sel' : ''}" data-act="col-sort" data-s="${s2}">${l}</button>`).join('')}</div>
     <div class="col-head"><span></span><span>Item</span><span>🪙</span><span>📈</span><span>🛒</span><span>💰</span></div>
     <div class="col-list" data-hook="collection">${rows.map(x => `<button class="col-row ${x.inf.src}" data-act="stats" data-key="${x.k}">${x.inf.icon(34)}<span class="cn"><b>${esc(x.inf.name)}</b><small>${x.inf.kind === 'crop' ? 'Crop' : x.inf.kind === 'craft' ? 'AI recipe' : x.inf.combo && x.inf.combo.length ? 'Combo' : 'Product'} ${x.inf.src === 'ai' ? '✨' : ''}</small></span>
       <span class="${colSort === 'value' ? 'on' : ''}">${x.value}¢</span><span class="${colSort === 'demand' ? 'on' : ''}">×${x.demand.toFixed(2)}</span><span class="${colSort === 'sold' ? 'on' : ''}">${x.sold}</span><span class="${colSort === 'earned' ? 'on' : ''}">${x.earned}¢</span></button>`).join('')}</div>`;
  };
  fn.isCollection = true;
  return fn;
}

/* one AI flow for every entry point (prompt sheet, Recipe Book, Workshop "Think It" box) */
function runAI(type, text, t, extra = {}) {
      aiErr = null;
      if (!Entitlements.canUseAI()) { openSheet(outOfCreditsSheet(() => runAI(type, text), text)); return; }
      if (t) { t.classList.add('disabled'); t.textContent = '✨ Thinking…'; }
      const req = pendingReq && pendingReq.kind === type ? pendingReq : null, inBook = type === 'recipe' && book.open;
      const opts = { stages: { ...lab.stages }, fulfills: req ? req.name : null, onSketch: item => openSheet(sketchSheet(type, item)), ...extra };
      return (type === 'tool' ? Game.aiTool(text, opts) : type === 'recipe' ? Game.aiRecipe(text, opts) : Game.aiInvent('crop', text, opts)).then(res => {
        if (!res.ok) { aiErr = { type, msg: res.msg }; if (res.full) openSheet(slotsFullSheet(res.full)); else if (res.slotWarn) openSheet(recipeWarnSheet(res, text)); else { if ($('.sheet .sketching')) closeSheet(); toast(res.msg); } const b = $('[data-act="ai-submit"]'); if (b) { b.classList.remove('disabled'); b.innerHTML = '✨ Make it! <small>(1 credit)</small>'; } if (typeof onInvented === 'function') onInvented(type, res); return res; }
        promptDraft[type] = '';
        if (req) { const q = state.aiRecipes[req.rid] && state.aiRecipes[req.rid].requires[req.i]; // tick the recipe checklist
          if (q) { if (type === 'tool') q.key = res.tool.key; else q.id = res.inv.id; } pendingReq = null; save(); }
        render(); updateCoins();
        if (type === 'recipe') { closeSheet(); openBook(res.recipe.id, true); if (typeof onInvented === 'function') onInvented(type, res); return res; }
        openSheet(type === 'tool' ? toolRevealSheet(res.tool.key, req) : aiRevealSheet(res.inv, req)); renderBook();
        if (typeof onInvented === 'function') onInvented(type, res);
        return res;
      });
}
function act(e) {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, i = +t.dataset.i, k = t.dataset.k;
  let r;
  if (typeof thinkAct === 'function' && thinkAct(a, t, e)) { updateCoins(); return; } // think-ui.js: Workshop, customers, Town Board, Bazaar, Journal
  switch (a) {
    case 'start': state.seenTitle = true; save(); $('#title').classList.add('gone'); setTimeout(() => $('#title')?.remove(), 500); break;
    case 'close': closeSheet(); break;
    case 'plot': {
      const p = state.plots[i];
      if (!p.inv) openSheet(plantSheet(i));
      else if (Game.plotProgress(p) >= 1) { r = Game.harvest(i); toast(`+${r.n} ${r.inv.name}`); renderFarm(); }
      else toast('Still growing…');
      break;
    }
    case 'plant': r = Game.plant(i, t.dataset.id); r.ok ? closeSheet() : toast(r.msg); renderFarm(); break;
    case 'buyplot': r = Game.buyPlot(); r.ok ? toast('New plot!') : toast(r.msg); renderFarm(); break;
    case 'stage-cycle': { const sk = t.dataset.stage, n = STAGE_LIB[sk].length; lab.stages[sk] = (lab.stages[sk] + (+t.dataset.d) + n) % n; sheetRender ? refreshSheet() : renderLab(); break; }
    case 'lab-base': lab.base = k; renderLab(); break;
    case 'lab-trait': lab.trait = k; renderLab(); break;
    case 'invent': r = Game.invent(lab.base, lab.trait, lab.stages); toast(r.ok ? `Invented ${r.inv.name}! (+2 samples)` : r.msg); renderLab(); break;
    case 'ai-locked': case 'paywall': openSheet(paywallSheet()); break;
    case 'ai-invent': // legacy: AI creation lives only in the Workshop
      t.dataset.type = t.dataset.type || 'crop'; dirAct('th-create', t); break;
    case 'ai-invent-old':
      pendingReq = null;
      if (!Entitlements.canUseAI()) { const ty = ['tool', 'recipe'].includes(t.dataset.type) ? t.dataset.type : 'crop'; openSheet(outOfCreditsSheet(() => openSheet(promptSheet(ty)))); break; }
      openSheet(promptSheet(['tool', 'recipe'].includes(t.dataset.type) ? t.dataset.type : 'crop')); setTimeout(() => { const ta = $('#ai-prompt'); if (ta) ta.focus(); }, 50);
      break;
    case 'ai-example': $('#ai-prompt').value = t.dataset.text; promptDraft[$('#ai-prompt').dataset.type] = t.dataset.text; break;
    case 'ai-submit': runAI(t.dataset.type, $('#ai-prompt').value, t); break;
    case 'stats': statsFrom = sheetRender && sheetRender.isCollection ? 'collection' : sheetRender && sheetRender.isStats ? statsFrom : null; openSheet(statsSheet(t.dataset.key)); break;
    case 'collection': openSheet(collectionSheet()); break;
    case 'hire-sheet': openSheet(hireSheet(k)); break;
    case 'map': openSheet(mapSheet()); break;
    case 'map-pick': mapSel = k; refreshSheet(); { const row = document.querySelector('.farm-row.sel'); if (row) row.scrollIntoView({ block: 'nearest' }); } break;
    case 'farm-buy': r = Farms.buy(k); if (r.ok) { Farms.switchTo(r.idx); closeSheet(); toast(`🎉 ${state.farms[r.idx].name} is yours!`); renderFarm(); } else toast(r.msg); refreshSheet(); updateCoins(); break;
    case 'farm-sw': Farms.switchTo(+t.dataset.i); closeSheet(); sigs.mkts = sigs.mktw = null; render(); toast(`📍 ${state.farms[state.farmIdx].name}`); break;
    case 'send': { const n = Game.send(t.dataset.key, t.dataset.from, t.dataset.to); if (n.ok) toast(`🚚 Sent ${n.n} ${itemInfo(t.dataset.key).name} to the ${LOCS[t.dataset.to].name}`); render(); break; }
    case 'send-all': { const n = Game.sendAll(t.dataset.from, t.dataset.to); toast(n ? `🚚 Sent ${n} item${n === 1 ? '' : 's'} to the ${LOCS[t.dataset.to].name}` : 'Nothing to send'); render(); break; }
    case 'hire': r = Workers.hire(k); toast(r.ok ? `Hired the ${WORKERS[k].name}!` : r.msg); refreshSheet(); render(); break;
    case 'fire': Workers.fire(k); toast(`${WORKERS[k].name} let go`); render(); break;
    case 'col-sort': colSort = t.dataset.s; refreshSheet(); break;
    case 'col-filter': colFilter = t.dataset.f; refreshSheet(); break;
    case 'recipe-open': openBook(k); break;
    case 'book': openBook(); break;
    case 'book-close': closeBook(); break;
    case 'book-tab': book.tab = t.dataset.tab; if (t.dataset.page) book.page = t.dataset.page; book.fresh = false; renderBook(); if (book.tab === 'new') setTimeout(() => { const ta = $('#ai-prompt'); if (ta) ta.focus(); }, 50); break;
    case 'book-turn': { const ids = Object.keys(state.aiRecipes), i = (ids.indexOf(book.page) + (+t.dataset.d) + ids.length) % ids.length; book.page = ids[i]; book.fresh = false; renderBook(); break; }
    case 'req-create': {
      const R = state.aiRecipes[t.dataset.r], q = R && R.requires[+t.dataset.i]; if (!q) break;
      dirAct('th-create', { dataset: { type: q.kind, prompt: q.idea, keepReq: '1' } });
      pendingReq = { rid: R.id, i: +t.dataset.i, kind: q.kind, name: q.name }; promptDraft[q.kind] = q.idea; render(); break;
    }
    case 'grow': closeBook(); setTab('farm'); toast(`🌱 Plant ${t.dataset.name}, then send the harvest to the Kitchen`); break;
    case 'craft': r = Game.craft(k); toast(r.ok ? `${r.queued ? '⏳ Queued' : '🍳 Cooking'} ${state.aiRecipes[k].name} in the ${TOOLS[r.tool].name}` : r.msg); refreshSheet(); renderKitchen(); renderBook(); break;
    case 'craft-collect': r = Game.collectCraft(k); if (r.ok) toast(r.moved ? `➡️ ${r.name} → ${TOOLS[r.to] ? TOOLS[r.to].name : ''}` : `+${r.n} ${itemInfo(r.key).name} → Ready shelf`); else if (r.msg) toast(r.msg); refreshSheet(); renderKitchen(); renderBook(); break;
    case 'buytool-r': r = Game.buyTool(k); toast(r.ok ? 'Bought ' + TOOLS[k].name : r.msg); updateCoins(); refreshSheet(); renderKitchen(); renderBook(); break;
    case 'buytool': r = Game.buyTool(k); toast(r.ok ? 'Bought ' + TOOLS[k].name : r.msg); renderKitchen(); break;
    case 'upgrade': r = Game.upgradeTool(k); toast(r.ok ? `${TOOLS[k].name} → Lv ${r.lv}` : r.msg); renderKitchen(); break;
    case 'cooksheet': cookSel = {}; openSheet(cookSheet(k)); break;
    case 'pick-recipe': cookSel.recipe = t.dataset.r; refreshSheet(); break;
    case 'pick-crop': cookSel.id = t.dataset.id; refreshSheet(); break;
    case 'combo-add': { const ex = cookSel.extras || (cookSel.extras = []), key = t.dataset.key;
      if (ex.includes(key)) ex.splice(ex.indexOf(key), 1); else if (ex.length < COMBO.maxExtras) ex.push(key); else toast(`Max ${COMBO.maxExtras} extra ingredients`); refreshSheet(); break; }
    case 'combo-del': cookSel.extras = (cookSel.extras || []).filter(x => x !== t.dataset.key); refreshSheet(); break;
    case 'cook':
      r = Game.cook(k, cookSel.recipe, cookSel.id, cookSel.extras || []); r.ok ? (closeSheet(), toast(r.queued ? `⏳ Queued in the ${TOOLS[k].name}` : 'Cooking…')) : toast(r.msg); renderKitchen(); break;
    case 'unqueue': r = Game.unqueue(k, i); if (r.ok) toast('Batch cancelled · ingredients back'); renderKitchen(); break;
    case 'collect': r = Game.collect(k); if (r.ok) toast(r.moved ? (r.lost ? 'Cleared' : `➡️ ${r.name} → ${TOOLS[r.to].name}${r.queued ? ' (queued)' : ''}`) : `+${r.n} ${itemInfo(r.key).name}`); else if (r.msg) toast(r.msg); renderKitchen(); break;
    case 'slot': openSheet(slotSheet(i)); break;
    case 'stock': {
      const info = itemInfo(t.dataset.key);
      r = Game.stock(i, t.dataset.key, qtyAt('stock', t.dataset.key), Math.max(1, Math.round(info.value * 1.3)));
      if (!r.ok) toast(r.msg); refreshSheet(); renderMarket(); break;
    }
    case 'restock': { const s = state.stall[i]; Game.stock(i, s.key, 1e9, s.price); refreshSheet(); renderMarket(); break; }
    case 'unstock': Game.unstock(i); refreshSheet(); renderMarket(); break;
    case 'price': Game.setPrice(i, state.stall[i].price + (+t.dataset.d)); refreshSheet(); renderMarket(); break;
    case 'mk': r = Game.marketing(k); if (!r.ok) toast(r.msg); else toast(`${MARKETING[k].emoji} ${MARKETING[k].name}!`); if (k === 'bell' && r.ok) { const bb = $('.bell'); bb.classList.remove('ring'); void bb.offsetWidth; bb.classList.add('ring'); } renderMarket(); break;
    case 'toggle-ads': state.ent.removeAds ? (state.ent.removeAds = false, save(), Ads.refresh()) : Store.purchase('remove_ads'); refreshSheet(); break;
    case 'buy': { const id = t.dataset.id, P = Store.products[id], wasSub = Entitlements.subscribed; Store.purchase(id);
      toast(P.type === 'subscription' ? (wasSub ? `Stub: switched to ${P.title}` : `Stub: ${P.title} · +${SUB_WEEKLY_CREDITS} credits now (week 1) · ${Entitlements.nextGrantText()}`) : 'Stub purchase: ' + P.title);
      refreshSheet(); render(); break; }
    case 'buy-quick': { const id = t.dataset.id, P = Store.products[id]; Store.purchase(id);
      toast(P.credits ? `+${P.credits} credit${P.credits === 1 ? '' : 's'} (stub purchase)` : `Stub: ${P.title} · +${SUB_WEEKLY_CREDITS} credits now`);
      closeSheet(); render(); updateCoins();
      const f = pendingResume; pendingResume = null; if (f && Entitlements.canUseAI()) setTimeout(f, 250);
      break; }
    case 'test-ad': closeSheet(); if (!Ads.showInterstitial('manual test')) toast('Ads removed — interstitial suppressed'); break;
    case 'reset-purchases': Store.resetPurchases(); refreshSheet(); render(); break;
    case 'reset': resetGame(); closeSheet(); $('#screen-market').innerHTML = ''; render(); break;
  }
  updateCoins();
}
function onInput(e) {
  const t = e.target;
  if (t.id === 'ai-prompt') { promptDraft[t.dataset.type] = t.value; return; }
  if (t.dataset.act !== 'price-range') return;
  const i = +t.dataset.i; Game.setPrice(i, +t.value); $('#price-val').textContent = t.value + '¢';
  clearTimeout(onInput._t); onInput._t = setTimeout(() => { refreshSheet(); renderMarket(); }, 150);
}

/* ---------------- Loop ---------------- */
let last = now();
function loop() {
  const t = now(), dt = Math.min(1, (t - last) / 1000); last = t;
  if (state.stall.some(s => s && s.qty > 0)) Market.tick(dt);
  while (Market.pending.length) { const c = Market.pending.shift(); c.delay ? setTimeout(() => animateCustomer(c), c.delay) : animateCustomer(c); }
  document.querySelectorAll('[data-prog="plot"]').forEach(el => { const p = state.plots[+el.dataset.i]; if (p && p.inv) el.style.width = Game.plotProgress(p) * 100 + '%'; });
  document.querySelectorAll('[data-left="plot"]').forEach(el => { const p = state.plots[+el.dataset.i]; if (p && p.inv) el.textContent = fmtS(state.inventions[p.inv].growTime * (1 - Game.plotProgress(p))); });

  document.querySelectorAll('[data-prog="craft"]').forEach(el => { const j = Game.craftJob(el.dataset.k); if (j) el.style.width = Game.jobProgress(j) * 100 + '%'; });
  document.querySelectorAll('[data-prog="job"]').forEach(el => { const j = state.jobs[el.dataset.k]; if (j) el.style.width = Game.jobProgress(j) * 100 + '%'; });
  Workers.tick();
  /* every other location keeps running on its own: its workers act and its stall keeps selling (no animation) */
  state.farms.forEach((_, i) => { if (i !== state.farmIdx) withLoc(i, () => {
    if (state.stall.some(s => s && s.qty > 0)) Market.tick(dt, true);
    while (Market.pending.length) Market.resolve(Object.assign(Market.pending.shift(), { background: true }));
    Workers.tick();
  }); });
  { const g = Entitlements.weeklyGrant(); if (g) { toast(`✨ +${g} weekly AI credits (Market Plot+)`); render(); } }
  document.querySelectorAll('[data-wstatus]').forEach(el => { const w = state.workers[el.dataset.wstatus]; if (w && el.textContent !== w.status) el.textContent = w.status; });
  if (book.open && bookSig() !== sigs.book) renderBook();
  if (activeTab === 'farm' && farmSig() !== sigs.farm) renderFarm();
  if (activeTab === 'kitchen' && kitchenSig() !== sigs.kitchen) renderKitchen();
  if (activeTab === 'market' && marketSig() !== sigs.market) renderMarket();
  updateMarketHud(); updateCoins();
}

/* ---------------- Boot ---------------- */
function boot() {
  state = load();
  renderHeader();
  document.addEventListener('click', act);
  document.addEventListener('input', onInput);
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#btn-settings').addEventListener('click', () => openSheet(settingsSheet()));
  Ads.refresh();
  setTab('lab'); // home = Invention Workshop
  if (!state.seenTitle) showTitle();
  AIBackend.detect().then(m => { console.info('[AI] mode:', m); render(); });
  setInterval(loop, 250);
  setInterval(save, 3000);
  window.MP = { state: () => state, Game, Workers, Farms, Market, Ads, Store, Entitlements, setTab, render, Think, Bazaar }; // debug handle
}
// boot() runs at the end of think-ui.js (it overrides a few renderers first)
