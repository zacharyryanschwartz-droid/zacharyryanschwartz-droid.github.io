/* Market Plot — SIMPLE MODE (UX pass): one clear next step at a time.
   - A guided first loop: Invent a crop → Plant it → Harvest → Cook it → Sell it.
   - Only 4 big tabs at start (Workshop, Farm, Kitchen, Market). Everything else is still in the code but hidden
     until progress unlocks it, ONE feature at a time, each with a one-line "New: X unlocked" popup (UX_UNLOCKS).
   - One big primary button per screen (#ux-cta) and a persistent "What next?" line above the tab bar (#ux-hint).
   - Harvest → Kitchen → Market in one tap each: "Cook with these" (Farm) and "Sell these" (Kitchen).
   Loads after think-ui.js and calls boot(). Old saves (already playing) get everything unlocked. */
'use strict';
const UX_UNLOCKS = [ // the unlock ORDER (also in DESIGN.md "Onboarding & unlock order")
  { id: 'types',   icon: '🔧', name: 'Tools & recipes',  line: 'Invent kitchen tools and whole recipes in the Workshop, not just crops.', tab: 'lab', when: s => !s.ux.guide },
  { id: 'pricing', icon: '🏷️', name: 'Prices & ads',     line: 'Tap a basket on your stall to set its price. Ring the bell to bring buyers.', tab: 'market', when: s => s.stats.sold >= 3 },
  { id: 'combo',   icon: '🧪', name: 'Combine',          line: 'Add extra ingredients when you cook: surprise hits (or funny flops).', tab: 'kitchen', when: s => s.stats.sold >= 5 },
  { id: 'book',    icon: '📖', name: 'Recipe Book',      line: 'All your recipes, items and stats, behind the 📖 button at the top.', tab: null, when: s => s.stats.sold >= 7 || Object.keys(s.aiRecipes).length > 0 },
  { id: 'mixlab',  icon: '🌱', name: 'Free Mix Lab',     line: 'Mix simple crops for coins, no credits needed (bottom of the Workshop).', tab: 'lab', when: s => s.stats.sold >= 9 },
  { id: 'town',    icon: '📋', name: 'Town Board',       line: 'A new trend every week, and a contest to win trophies.', tab: 'town', when: s => s.stats.sold >= 12 },
  { id: 'workers', icon: '👷', name: 'Helpers',          line: 'Hire helpers to plant, cook and sell for you (and choose what they make).', tab: 'farm', when: s => s.stats.sold >= 16 },
  { id: 'bazaar',  icon: '🎪', name: 'Bazaar',           line: 'Share your best ideas with other players, vote and remix theirs.', tab: 'bazaar', when: s => s.stats.sold >= 20 },
  { id: 'best',    icon: '🏆', name: 'Best Creations',   line: 'Your top inventions, your Inventor level and the Discovery Journal.', tab: 'lab', when: s => s.stats.sold >= 24 },
  { id: 'expand',  icon: '🗺️', name: 'Grow your farm',   line: 'Buy more plots, upgrade tools, and open new farms on the map.', tab: 'farm', when: s => s.stats.sold >= 28 },
];
const UX_GAP_MS = 20000; // at least 20s between two unlock popups
const UX = {
  ids: UX_UNLOCKS.map(u => u.id),
  ensure(s) {
    if (s.ux) return s.ux;
    const old = s.seenTitle && (s.onb === 'done' || s.stats.sold > 0); // already playing before simple mode: show everything
    s.ux = { guide: !old, step: old ? 'done' : 'invent', key: null, unlocked: {}, last: 0, seen: {} };
    if (old) this.ids.forEach(i => { s.ux.unlocked[i] = true; s.ux.seen[i] = true; });
    return s.ux;
  },
  has(id) { return !state || !state.ux || !!state.ux.unlocked[id]; },
  guiding() { return !!(state && state.ux && state.ux.guide); },
  unlockAll() { this.ensure(state); state.ux.guide = false; state.ux.step = 'done'; this.ids.forEach(i => { state.ux.unlocked[i] = true; state.ux.seen[i] = true; }); state.onb = 'done'; save(); uxApplyChrome(); render(); },
  /* next locked feature, unlocked when its condition is met, one at a time */
  check() {
    const u = state.ux, nxt = UX_UNLOCKS.find(x => !u.unlocked[x.id]);
    if (!nxt || !nxt.when(state) || now() - (u.last || 0) < UX_GAP_MS) return;
    if (uxBusy()) return;
    u.unlocked[nxt.id] = true; u.last = now(); save(); uxApplyChrome(); render(); uxPopup(nxt);
  },
  guideKey() { const k = state.ux.key; return k && itemInfo(k) ? k : null; },
};
function uxBusy() { return $('#sheet').classList.contains('show') || $('#ux-pop.show') || book.open || (typeof Think !== 'undefined' && Think.haggle) || $('#title'); }

/* ---------- counts ---------- */
const uxQty = l => Object.values(state.store[l] || {}).reduce((a, b) => a + Math.max(0, b), 0);
function uxFarm() { const P = state.plots; return { ready: P.filter(p => p.inv && Game.plotProgress(p) >= 1).length, growing: P.filter(p => p.inv && Game.plotProgress(p) < 1), empty: P.filter(p => !p.inv).length }; }
function uxJobs() { const ks = Object.keys(state.jobs).filter(k => state.jobs[k] && state.tools[k]); return { done: ks.filter(k => Game.jobProgress(state.jobs[k]) >= 1), busy: ks.filter(k => Game.jobProgress(state.jobs[k]) < 1) }; }
function uxCookPick() { // the simplest batch we can start right now: [tool, recipe, cropId]
  const g = UX.guideKey(), crops = inventoryList('c|', 'pantry').sort((a, b) => (b.key === g) - (a.key === g) || b.qty - a.qty);
  const tools = Object.keys(TOOLS).filter(k => state.tools[k] && state.tools[k].owned && Game.toolFree(k)).sort((a, b) => (state.jobs[a] ? 1 : 0) - (state.jobs[b] ? 1 : 0));
  for (const c of crops) { // the quickest thing this crop can become
    const opts = []; tools.forEach(k => TOOLS[k].recipes.forEach(r => { if (RECIPES[r].uses <= c.qty) opts.push({ k, r, t: RECIPES[r].time * Game.toolStats(k).speed }); }));
    opts.sort((a, b) => a.t - b.t); if (opts.length) return { k: opts[0].k, r: opts[0].r, id: c.inv.id, name: `${c.inv.stem || c.name} ${RECIPES[opts[0].r].name}` }; }
  return null;
}
function uxPlantCrop() { const g = UX.guideKey(); if (g) return g.slice(2); const ai = state.order.find(id => state.inventions[id] && state.inventions[id].source === 'ai'); return ai || state.order.find(id => (state.inventions[id] || {}).free) || state.order[0]; }
const uxLeft = s => Math.max(1, Math.ceil(s)) + 's';

/* ---------- one primary action per screen ---------- */
function uxPrimary(tab) {
  const F = uxFarm(), J = uxJobs(), G = state.ux.guide, step = state.ux.step;
  if (tab === 'lab') return null; // the Think It! button is the Workshop's primary action
  if (tab === 'farm') {
    if (G && step === 'invent') return { text: '💡 Invent a crop first', act: 'ux-go', tab: 'lab' };
    if (F.ready) return { text: `🧺 Harvest${F.ready > 1 ? ' all' : ''}`, act: 'ux-harvest' };
    if (G && step === 'plant' && F.empty) { const inv = state.inventions[uxPlantCrop()]; return { text: `🌱 Plant ${esc(inv ? inv.name : 'it')}`, act: 'ux-plant' }; }
    if (G && F.growing.length && step !== 'cook' && step !== 'sell') { const l = Math.min(...F.growing.map(p => state.inventions[p.inv].growTime * (1 - Game.plotProgress(p)))); return { text: `⏳ Growing… ${uxLeft(l)}`, disabled: true }; }
    if (uxQty('basket')) return { text: '🍳 Cook with these', act: 'ux-tokitchen', sub: 'moves your harvest to the Kitchen' };
    if (F.empty) { const inv = state.inventions[uxPlantCrop()]; return { text: `🌱 Plant ${esc(inv ? inv.name : 'seeds')}${F.empty > 1 ? ` ×${F.empty}` : ''}`, act: 'ux-plant' }; }
    if (F.growing.length) { const l = Math.min(...F.growing.map(p => state.inventions[p.inv].growTime * (1 - Game.plotProgress(p)))); return { text: `⏳ Growing… ${uxLeft(l)}`, disabled: true }; }
    return null;
  }
  if (tab === 'kitchen') {
    if (J.done.length) return { text: '✅ Collect', act: 'ux-collect' };
    if (uxQty('ready') && !(G && J.busy.length)) return { text: '🧺 Sell these', act: 'ux-sell', sub: 'puts them on your Market stall' };
    const pick = uxCookPick(); if (pick && !(G && J.busy.length)) return { text: `🍳 Cook ${esc(pick.name)}`, act: 'ux-cook' };
    if (J.busy.length) { const l = Math.min(...J.busy.map(k => { const j = state.jobs[k]; return j.dur * (1 - Game.jobProgress(j)); })); return { text: `⏳ Cooking… ${uxLeft(l)}`, disabled: true }; }
    if (uxQty('basket')) return { text: '🧺 Bring the harvest in', act: 'ux-tokitchen' };
    return { text: '🌱 Grow crops first', act: 'ux-go', tab: 'farm' };
  }
  if (tab === 'market') {
    if (uxQty('ready') || uxQty('stock')) return { text: '🧺 Put it all on the stall', act: 'ux-sell' };
    if (!state.stall.some(s => s && s.qty > 0)) return { text: '🍳 Cook something to sell', act: 'ux-go', tab: uxQty('pantry') || uxQty('basket') ? 'kitchen' : 'farm' };
    return null;
  }
  return null;
}
/* the global "What next?" line */
function uxNext() {
  const G = state.ux.guide, step = state.ux.step, F = uxFarm(), J = uxJobs();
  if (G && step === 'invent') return { tab: 'lab', text: 'Type any crop idea and tap <b>Think It!</b> (your first one is free)' };
  if (G && step === 'plant') return { tab: 'farm', text: 'Plant your new crop on the <b>Farm</b>' };
  if (G && step === 'harvest') return F.ready ? { tab: 'farm', text: 'It grew! <b>Harvest</b> it' } : { tab: 'farm', text: 'Your crop is growing… then <b>Harvest</b> it' };
  if (G && step === 'cook') return J.done.length || uxQty('ready') ? { tab: 'kitchen', text: J.done.length ? 'Done! <b>Collect</b> your food' : 'Now <b>Sell these</b> at your stall' } : J.busy.length ? { tab: 'kitchen', text: 'Cooking… then <b>Collect</b> it' } : uxQty('pantry') ? { tab: 'kitchen', text: '<b>Cook</b> your crop in the Kitchen' } : { tab: 'farm', text: 'Tap <b>Cook with these</b> on the Farm' };
  if (G && step === 'sell') return { tab: 'market', text: 'Watch your first customer buy it!' };
  if (F.ready) return { tab: 'farm', text: 'Crops are ready to <b>harvest</b>' };
  if (J.done.length) return { tab: 'kitchen', text: 'Food is done: <b>collect</b> it in the Kitchen' };
  if (uxQty('ready')) return { tab: 'kitchen', text: '<b>Sell</b> your food: tap Sell these in the Kitchen' };
  if (uxQty('basket') >= 2) return { tab: 'farm', text: 'Take your harvest to the Kitchen: <b>Cook with these</b>' };
  if (uxQty('pantry') >= 2 && uxCookPick()) return { tab: 'kitchen', text: '<b>Cook</b> your crops in the Kitchen' };
  if (F.empty) return { tab: 'farm', text: 'Empty plots: <b>plant</b> something' };
  if (Entitlements.aiCredits > 0) return { tab: 'lab', text: 'While things grow: <b>invent</b> something new' };
  return { tab: 'market', text: 'Customers are shopping. Sell, earn, invent more!' };
}

/* ---------- actions ---------- */
function uxSellAll() {
  Object.keys(state.store.ready).forEach(k => moveItem(k, 'ready', 'stock'));
  let first = -1, n = 0;
  Object.keys(state.store.stock).filter(k => qtyAt('stock', k) > 0).sort((a, b) => (itemInfo(b) || {}).value - (itemInfo(a) || {}).value).forEach(k => {
    const info = itemInfo(k); if (!info) return;
    let slot = state.stall.findIndex(s => s && s.key === k);
    if (slot < 0) slot = state.stall.findIndex(s => !s || !s.qty);
    if (slot < 0) return;
    const r = Game.stock(slot, k, qtyAt('stock', k), state.stall[slot] && state.stall[slot].key === k ? state.stall[slot].price : Math.max(2, Math.round(info.value * 1.15)));
    if (r && r.ok !== false) { n++; if (first < 0) first = slot; }
  });
  save(); return { n, first };
}
function uxAct(a, t) {
  switch (a) {
    case 'ux-go': closeSheet(); setTab(t.dataset.tab); return true;
    case 'ux-hint': { const n = uxNext(); closeSheet(); if (n.tab !== activeTab) setTab(n.tab); else { const c = $('.screen.active .ux-cta'); if (c) { c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge'); } } return true; }
    case 'ux-skip': state.ux.guide = false; state.ux.step = 'done'; save(); uxApplyChrome(); render(); toast('OK! New things will unlock as you play.'); return true;
    case 'ux-plant-go': closeSheet(); setTab('farm'); return true;
    case 'ux-plant': {
      const id = uxPlantCrop(); let n = 0, msg = '';
      state.plots.forEach((p, i) => { if (!p.inv) { const r = Game.plant(i, id); if (r.ok) n++; else msg = r.msg; } });
      if (!n && msg) { // can't afford those seeds: free Garden Tomatoes always work
        const free = state.order.find(x => (state.inventions[x] || {}).free); state.plots.forEach((p, i) => { if (!p.inv && free && Game.plant(i, free).ok) n++; }); }
      if (state.ux.guide && n) { state.ux.step = 'harvest'; save(); }
      toast(n ? `🌱 Planted ${n} plot${n > 1 ? 's' : ''}` : msg || 'No empty plots'); render(); return true; }
    case 'ux-harvest': { let n = 0; state.plots.forEach((p, i) => { if (p.inv && Game.plotProgress(p) >= 1) { const r = Game.harvest(i); if (r.ok) n += r.n; } });
      if (state.ux.guide && n) { state.ux.step = 'cook'; save(); }
      toast(`🧺 +${n} harvested`); render(); return true; }
    case 'ux-tokitchen': { const n = Game.sendAll('basket', 'pantry'); if (state.ux.guide && state.ux.step === 'harvest') state.ux.step = 'cook'; save(); toast(n ? `🍳 ${n} crops in the Kitchen` : 'Nothing to cook yet'); setTab('kitchen'); return true; }
    case 'ux-cook': { const p = uxCookPick(); if (!p) { toast('Need 2 of the same crop'); return true; } const r = Game.cook(p.k, p.r, p.id, []); toast(r.ok ? `🍳 Cooking ${p.name}…` : r.msg); renderKitchen(); return true; }
    case 'ux-collect': { let n = 0; for (let g = 0; g < 4; g++) uxJobs().done.forEach(k => { const r = Game.collect(k); if (r.ok) n++; }); toast(n ? '✅ Collected!' : 'Not done yet'); renderKitchen(); return true; }
    case 'ux-sell': {
      const r = uxSellAll(); if (!r.n) { toast('Nothing to sell yet'); return true; }
      closeSheet(); setTab('market'); toast('🧺 On the stall! Customers are coming.');
      if (state.ux.guide) { state.ux.step = 'sell'; save(); const s = state.stall[r.first]; setTimeout(() => animateCustomer({ slot: r.first, seed: Math.floor(Math.random() * 1000), roll: 0, persona: Think.bestPersona(s.key), force: true }), 700); }
      return true; }
    case 'ux-pop-ok': uxPopClose(); return true;
    case 'ux-pop-go': { const tab = t.dataset.tab; uxPopClose(); if (tab) setTab(tab); return true; }
    case 'slot': if (!UX.has('pricing')) { const s = state.stall[+t.dataset.i]; if (s && s.qty) { const info = itemInfo(s.key); toast(`${info ? info.name : 'It'} ×${s.qty} · ${s.price}¢ each`); } else if (uxQty('ready') || uxQty('stock')) uxAct('ux-sell', t); else toast('Cook something in the Kitchen to sell here'); return true; } return false;
  }
  return false;
}
document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t && state && uxAct(t.dataset.act, t)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

/* ---------- unlock popup ---------- */
function uxPopup(u) {
  const el = $('#ux-pop'); state.ux.seen[u.id] = true; save();
  el.innerHTML = `<div class="ux-pop-card card" data-hook="unlock-pop" data-k="${u.id}"><div class="ux-pop-ico">${u.icon}</div><small>${u.id === 'types' ? '🎉 First sale! You did the whole loop.' : 'New!'}</small>
    <h3>${esc(u.name)} unlocked</h3><p>${esc(u.line)}</p>
    <div class="ux-pop-btns">${u.tab ? `<button class="btn" data-act="ux-pop-go" data-tab="${u.tab}">Show me</button>` : ''}<button class="btn ${u.tab ? 'ghost' : ''}" data-act="ux-pop-ok">Got it</button></div></div>`;
  el.classList.add('show');
}
function uxPopClose() { $('#ux-pop').classList.remove('show'); }

/* ---------- hiding: gated helpers render nothing until unlocked ---------- */
const uxGate = (name, id, empty = '') => { const f = window[name]; if (typeof f !== 'function') return; window[name] = function () { return UX.has(id) ? f.apply(this, arguments) : (typeof empty === 'function' ? empty.apply(this, arguments) : empty); }; };
uxGate('workersSection', 'workers'); uxGate('ordersPanel', 'workers'); uxGate('farmControlsHTML', 'workers'); uxGate('chefControlsHTML', 'workers'); uxGate('chefTog', 'workers'); uxGate('farmTog', 'workers');
uxGate('bookButton', 'book'); uxGate('bestTeaser', 'best'); uxGate('xpBar', 'best'); uxGate('locChips', 'expand');
if (typeof Think !== 'undefined' && Think.wantsHaggle) { const wh = Think.wantsHaggle; Think.wantsHaggle = function () { return UX.has('pricing') && wh.apply(Think, arguments); }; } // no haggling until prices are unlocked
{ const sr = stackRow; stackRow = (x, from, dests) => sr(x, from, UX.has('workers') ? dests : []); }
/* selector rules for the rest: [selector, feature, also hide the h3 just before it] */
const UX_HIDE = {
  lab: [['.tb-types', 'types'], ['.ws-slots', 'types'], ['[data-act="jr-open"]', 'best'], ['.ws-classic', 'mixlab'], ['.spokes', 'bazaar', 1], ['.insp', 'guide', 1], ['.shelf', 'guide', 1]],
  farm: [['.slots:not(.farm-ctl)', 'types', 1], ['.map-btn', 'expand'], ['.map-hint', 'expand'], ['.plot.buy', 'expand'], ['[data-act="send-all"]', 'workers'], ['.info-i', 'types']],
  kitchen: [['.k-think', 'combo'], ['.panel-title .hint', 'types'], ['.loc-h small.muted', 'types'], ['.slots', 'types'], ['.st-queue', 'types'], ['.tool-act', 'expand'], ['.lv', 'expand'], ['.station.unowned', 'types'], ['.st-basic', 'types'], ['[data-act="send-all"]', 'workers'], ['.del-btn', 'types']],
  market: [['.mkt-stats', 'pricing'], ['#mk-row', 'pricing'], ['#sale-log', 'pricing'], ['.tip', 'pricing'], ['#mkt-stock', 'workers'], ['#stall-awards', 'town'], ['.heat', 'pricing']],
  sheet: [['[data-act="bz-pub-open"]', 'bazaar'], ['[data-act="town-submit"]', 'town'], ['.combine', 'combo'], ['.dbreak', 'pricing'], ['[data-act="jr-share"]', 'best']],
};
function uxPrune(root, rules) {
  rules.forEach(([sel, id, h]) => { const off = id === 'guide' ? UX.guiding() : !UX.has(id);
    root.querySelectorAll(sel).forEach(x => { x.classList.toggle('ux-hide', off); const p = h && x.previousElementSibling; if (p && (p.tagName === 'H3' || p.classList.contains('loc-h'))) p.classList.toggle('ux-hide', off); }); });
}
function uxCTA(tab) {
  const el = $('#screen-' + tab); if (!el) return;
  const p = uxPrimary(tab), sig = p ? p.text + (p.act || '') + (p.disabled ? 'd' : '') : '';
  let w = el.querySelector(':scope > .ux-cta-wrap');
  if (!p) { if (w) w.remove(); return; }
  if (!w) { w = document.createElement('div'); w.className = 'ux-cta-wrap'; const anchor = el.querySelector(':scope > .panel-title'); anchor ? anchor.after(w) : el.prepend(w); }
  if (w.dataset.sig === sig) return; w.dataset.sig = sig;
  w.innerHTML = `<button class="btn big ux-cta ${p.disabled ? 'wait' : ''}" ${p.act ? `data-act="${p.act}"` : ''} ${p.tab ? `data-tab="${p.tab}"` : ''} data-hook="ux-cta" ${p.disabled ? 'disabled' : ''}>${p.text}</button>${p.sub ? `<small>${p.sub}</small>` : ''}`;
}
function uxDecorate(tab) {
  if (!state || !state.ux) return;
  const el = $('#screen-' + tab); if (!el) return;
  if (UX_HIDE[tab]) uxPrune(el, UX_HIDE[tab]);
  uxCTA(tab);
  if (tab === 'lab') { const tb = el.querySelector('.think-box'); if (tb) tb.classList.toggle('glow-on', UX.guiding() && state.ux.step === 'invent'); }
}
['renderLab', 'renderFarm', 'renderKitchen', 'renderMarket', 'renderTown', 'renderBazaar'].forEach(n => { const f = window[n]; const tab = { renderLab: 'lab', renderFarm: 'farm', renderKitchen: 'kitchen', renderMarket: 'market', renderTown: 'town', renderBazaar: 'bazaar' }[n];
  window[n] = function () { const r = f.apply(this, arguments); uxDecorate(tab); return r; }; });
{ const os = openSheet, rs = refreshSheet; openSheet = function (fn) { os(fn); if (state && state.ux) uxPrune($('#sheet'), UX_HIDE.sheet); }; refreshSheet = function () { rs(); if (state && state.ux) uxPrune($('#sheet'), UX_HIDE.sheet); }; }
/* the first invention: its result sheet's one button is "Plant it" */
{ const oi = onInvented; onInvented = function (type, res) {
  if (res && res.ok && type === 'crop' && UX.guiding() && state.ux.step === 'invent') { state.ux.key = 'c|' + res.inv.id; state.ux.step = 'plant'; save(); }
  oi(type, res);
  if (res && res.ok && type === 'crop' && UX.guiding() && state.ux.step === 'plant') { const b = $('.sheet .sell-now'); if (b) { b.outerHTML = `<button class="btn wide ux-cta" data-act="ux-plant-go" data-hook="plant-it">🌱 Plant it on your Farm</button>`; } const n = $('.sheet .btn.ghost[data-act="close"]'); if (n) n.remove(); $$('.sheet .coach-in').forEach(x => x.remove()); }
}; }
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- chrome: tabs, hint line, body classes ---------- */
function uxApplyChrome() {
  if (!state || !state.ux) return;
  document.body.classList.toggle('ux-guide', UX.guiding());
  $$('#tabbar button').forEach(b => { const t = b.dataset.tab, lock = (t === 'bazaar' || t === 'town') && !UX.has(t); b.classList.toggle('ux-hide', lock); });
  const n = $$('#tabbar button').filter(b => !b.classList.contains('ux-hide')).length; $('#tabbar').style.gridTemplateColumns = `repeat(${n},1fr)`;
  $('#btn-collection').classList.toggle('ux-hide', !UX.has('book'));
  if ((activeTab === 'bazaar' || activeTab === 'town') && !UX.has(activeTab)) setTab('lab');
}
function uxHint() {
  const el = $('#ux-hint'); if (!el || !state || !state.ux || !state.seenTitle) { if (el) el.classList.remove('show'); return; }
  const n = uxNext(), html = `<span class="ux-q">What next?</span><span class="ux-t">${n.text}</span>${n.tab !== activeTab ? '<span class="ux-go">›</span>' : ''}${UX.guiding() ? '<button class="link ux-skip" data-act="ux-skip">skip guide</button>' : ''}`;
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  el.classList.add('show');
  $$('#tabbar button').forEach(b => b.classList.toggle('ux-point', UX.guiding() && b.dataset.tab === n.tab && n.tab !== activeTab));
}
function uxTick() {
  if (!state) return; UX.ensure(state);
  if (state.ux.guide && state.ux.step === 'sell' && state.stats.sold > 0) { state.ux.guide = false; state.ux.step = 'done'; state.ux.last = now() - UX_GAP_MS + 3500; save(); uxApplyChrome(); } // let the first customer's reaction play before the popup
  if (state.seenTitle) UX.check();
  if (['farm', 'kitchen', 'market'].includes(activeTab)) uxCTA(activeTab);
  uxHint();
}

/* ---------- boot ---------- */
{ const ld = load; load = function () { const s = ld(); UX.ensure(s); if (s.ux.guide && s.onb !== 'done') s.onb = 'done'; return s; }; } // the old 4-step tour is replaced by the guide
{ const rg = typeof resetGame === 'function' ? resetGame : null; if (rg) resetGame = function () { rg.apply(this, arguments); UX.ensure(state); state.onb = 'done'; state.seenTitle = true; uxApplyChrome(); }; }
(function mountUX() {
  const app = $('#app');
  if (!$('#ux-hint')) $('#screens').insertAdjacentHTML('afterend', '<div id="ux-hint" class="ux-hint" data-act="ux-hint" data-hook="what-next"></div>');
  if (!$('#ux-pop')) app.insertAdjacentHTML('beforeend', '<div id="ux-pop" class="ux-pop"></div>');
})();
boot();
UX.ensure(state); uxApplyChrome(); render();
setInterval(uxTick, 500);
window.UX = UX;
