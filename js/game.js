/* Market Plot — game state & simulation (no DOM here except via hooks) */
'use strict';
const SAVE_KEY = 'marketplot.save.v1';
const BASE_TOOL_KEYS = Object.keys(TOOLS);
let state = null;
const now = () => Date.now();

/* ---------------- Inventor ---------------- */
const Inventor = {
  key(base, trait) { return base + '+' + trait; },
  /* Deterministic, offline inventor. Returns the canonical Invention structure.
     The AI interpreter (hooks.js) must return this SAME shape with source:'ai'. */
  procedural(base, trait, source = 'basic') {
    const b = BASES[base], t = TRAITS[trait];
    const name = b.join ? t.prefix + b.noun : `${t.prefix} ${b.noun}`;
    const stem = b.join ? t.prefix + b.stem : `${t.prefix} ${b.stem}`;
    const inv = {
      id: base + '_' + trait,
      type: 'crop',            // 'crop' | 'product' | 'tool'
      source,                  // 'basic' | 'ai'
      base, trait, name, stem,
      growTime: Math.round(b.grow * t.growMul),
      yield: b.yield + t.yieldAdd,
      baseValue: Math.max(1, Math.round(b.value * t.valueMul)),
      rarity: t.rarity + (source === 'ai' ? 1 : 0),
      createdAt: now(),
    };
    inv.desc = this.describe(inv);
    return inv;
  },
  /* AI HOOK ─────────────────────────────────────────────────────────────
     Optional AI-generated name/description plugs in here. In the real game:
       const ai = await AIInterpreter.invent({type:'crop', base, trait, prompt});
       if (ai) return ai;   // same Invention structure, source:'ai'
     Free tier / offline: deterministic templates below. ─────────────────── */
  describe(inv) {
    const t = TRAITS[inv.trait], b = BASES[inv.base];
    const lines = {
      sweet: 'tastes like a summer fair', giant: 'needs two hands to carry', spicy: 'leaves a cozy tingle',
      moon: 'ripens best under moonlight', stardew: 'sparkles with morning stardust', crystal: 'chimes when tapped',
      sun: 'glows warm like a sunbeam', frost: 'stays crisp and frosty all day',
    };
    return `A ${t.name.toLowerCase()} ${b.name.toLowerCase()} that ${lines[inv.trait]}.`;
  },
};

/* ---------------- State ---------------- */
function newState() {
  const s = {
    v: 2, coins: ECON.startCoins, seenTitle: false, onb: 0, // onb: first-run tour step (0 = not started, 'done')
    inventions: {}, order: [],
    store: { basket: {}, pantry: {}, ready: {}, stock: {} }, // LOCS: where every item physically is
    plots: Array.from({ length: ECON.startPlots }, () => ({ inv: null, t0: 0 })),
    tools: {}, jobs: {},
    stall: Array(ECON.marketSlots).fill(null),
    aiTools: {},
    aiRecipes: {},   // learned AI recipes: craft repeatedly for free
    craftJobs: {},   // recipeId -> { t0, dur, out }
    mkt: { flyers: 0, tasting: 0, bellReady: 0, acc: 0 },
    novelty: {},
    stats: { sold: 0, earned: 0, sinceAd: 0, lastSale: null },
    workers: {},     // key -> { hired, next, nextWage, stopped, status }
    orders: [],      // shared Orders board: [{ key:'c|id', need, for, by }]
    itemStats: {},   // per item key: { made, sold, earned, best, last, tools[] } -> Stats card + Collection
    log: [],
    ent: { removeAds: false, subscribed: false, aiCredits: STARTER_AI_CREDITS, starterGrantGiven: true }, // one-time new-player grant
  };
  for (const k of BASE_TOOL_KEYS) s.tools[k] = { owned: TOOLS[k].owned, level: 1 };
  ensureBasics(s); s.order.push(...BASIC_CROP_IDS); // exactly the 4 basic crops: Tomato, Corn, Beans, Onion
  // starter goods: only basics
  Object.assign(s.store.basket, { 'c|tomato_free': 4, 'c|corn_basic': 4, 'c|bean_basic': 3, 'c|onion_basic': 3 });
  s.stall[0] = { key: 'c|tomato_free', qty: 10, price: 6 };
  s.stall[1] = { key: 'c|corn_basic', qty: 8, price: 7 };
  s.stall[2] = { key: 'p|tomato_free|jam|basic', qty: 6, price: 14 };
  s.stall[3] = { key: 'p|onion_basic|pickles|basic', qty: 6, price: 16 };
  s.stall[4] = { key: 'p|corn_basic|soup|basic', qty: 6, price: 15 };
  // Fresh saves contain NO AI items; AI items only appear when the player spends a credit.
  return s;
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); } }
/* AI tools live in the save and are registered into TOOLS at load */
function registerAITools(s) {
  for (const k of Object.keys(TOOLS)) if (!BASE_TOOL_KEYS.includes(k)) delete TOOLS[k];
  for (const k in (s.aiTools || {})) TOOLS[k] = s.aiTools[k]; // designs are global; ownership (state.tools) is per location
}
function load() {
  let s = null;
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const x = JSON.parse(raw);
    if (x && x.v === 2) s = x;
    else if (x && x.v === 1) s = migrateV1(x); } } catch (e) { console.warn('load failed', e); }
  if (!s) s = newState();
  s.aiTools = s.aiTools || {}; s.aiRecipes = s.aiRecipes || {}; s.craftJobs = s.craftJobs || {}; s.itemStats = s.itemStats || {}; s.workers = s.workers || {}; s.orders = s.orders || [];
  if (!s.store) { // pre-logistics saves: crops were usable by the kitchen -> Pantry; goods were sellable -> Stockroom
    s.store = { basket: {}, pantry: {}, ready: {}, stock: {} };
    for (const k in (s.inv || {})) if (s.inv[k] > 0) s.store[k.startsWith('c|') ? 'pantry' : 'stock'][k] = s.inv[k];
    delete s.inv;
  }
  for (const l in LOCS) s.store[l] = s.store[l] || {};
  if (s.ent && s.ent.subscribed && !s.ent.subPlan) s.ent.subscribed = false; // old monthly-sub saves: plan retired
  linkFarms(s); ensureFreeCrop(s); registerAITools(s); if (typeof thinkState === 'function') thinkState(s);
  return s;
}
/* v1 saves (old 5 starters + Crock/Still, no slot limits) -> a FRESH v2 farm; wallet, credits, purchases, XP and trophies carry over */
function migrateV1(x) {
  const s = newState();
  s.coins = Math.max(s.coins, x.coins | 0); s.seenTitle = true; s.onb = x.onb || 'done';
  if (x.ent) s.ent = { ...s.ent, ...x.ent };
  for (const k of ['xp', 'level', 'trophies', 'thinkStats', 'player']) if (x[k] !== undefined) s[k] = x[k];
  s.migratedFrom = 1; return s;
}
function resetGame() { localStorage.removeItem(SAVE_KEY); state = newState(); linkFarms(state); ensureFreeCrop(state); registerAITools(state); if (typeof thinkState === 'function') thinkState(state); save(); }
/* the 4 BASIC crops exist in every save and lead every location's seed list (Tomato seeds free, the rest cheap) */
function ensureBasics(s) {
  for (const B of BASIC_CROPS) {
    if (!s.inventions[B.id] || s.inventions[B.id].trait !== 'plain') {
      const inv = Inventor.procedural(B.base, B.trait, 'basic');
      Object.assign(inv, { id: B.id, name: B.name, stem: B.stem, growTime: B.growTime, yield: B.yield, baseValue: B.baseValue, rarity: 0, desc: B.desc });
      inv.stages = defaultStages(inv.id); s.inventions[B.id] = inv;
    }
    Object.assign(s.inventions[B.id], { basicCrop: true, seed: B.seed, free: B.seed === 0 });
    if (s.novelty && s.novelty[B.id] === undefined) s.novelty[B.id] = 1;
  }
  for (const F of s.farms || []) { F.order = F.order || []; F.order = [...BASIC_CROP_IDS, ...F.order.filter(id => !BASIC_CROP_IDS.includes(id))]; }
}
const ensureFreeCrop = ensureBasics; // old name kept for tests
const isBasicCrop = id => BASIC_CROP_IDS.includes(id);
const isBasicTool = k => BASE_TOOL_KEYS.includes(k);
/* ===== SLOTS: invented crops / tools / recipes per location (SLOTS in data.js). Checked BEFORE any AI call or coin spend. */
const Slots = {
  label: { crop: 'crops', tool: 'tools', recipe: 'recipes' },
  list(kind) {
    if (kind === 'crop') return state.order.filter(id => !isBasicCrop(id) && state.inventions[id]);
    if (kind === 'tool') return Object.keys(state.tools).filter(k => !isBasicTool(k) && TOOLS[k]);
    return Object.keys(state.aiRecipes);
  },
  used(kind) { return this.list(kind).length; },
  max(kind) { return SLOTS[kind]; },
  free(kind) { return Math.max(0, SLOTS[kind] - this.used(kind)); },
  full(kind) { return this.free(kind) <= 0; },
  text(kind) { return `Invented ${this.label[kind]} ${this.used(kind)}/${SLOTS[kind]}`; },
  fullMsg(kind) { return `${this.text(kind)} at this location. Delete one first (nothing was spent).`; },
  block(kind) { return this.full(kind) ? { ok: false, msg: this.fullMsg(kind), full: kind } : null; },
  /* how many NEW crops/tools a recipe would still need created here vs the free slots */
  recipeNeeds(R) {
    const P = recipeParts(R), need = { crop: 0, tool: 0 };
    const seen = new Set(); P.req.forEach(q => { const k = q.kind + ':' + normName(q.name); if (!q.ref && !seen.has(k)) { seen.add(k); need[q.kind]++; } });
    return { crop: need.crop, tool: need.tool, over: need.crop > this.free('crop') || need.tool > this.free('tool') };
  },
};
/* LOCATIONS: every farm on the map is its own full operation. These fields live on state.farms[i] and
   state.<field> is an accessor to the ACTIVE location, so all game code reads/writes the active location.
   withLoc(i, fn) runs code (workers, background market) against another location. Global: coins, credits,
   inventions (collection), itemStats, recipeBook (collection copy of every learned recipe), aiTools (tool designs). */
const LOC_FIELDS = ['plots', 'store', 'tools', 'jobs', 'stall', 'mkt', 'workers', 'orders', 'aiRecipes', 'craftJobs', 'order', 'queues', 'chefOff', 'farmOff', 'locStats'];
/* chef controls (per location, default ON): which learned recipes the Kitchen Helper / Head Chef may cook, which crops farm workers may plant */
const chefOn = rid => !(state.chefOff || {})[rid], farmOn = id => !(state.farmOff || {})[id];
const starterIds = () => []; // retired starters
function freshLocation(nPlots) {
  const tools = {}; for (const k of BASE_TOOL_KEYS) tools[k] = { owned: TOOLS[k].owned, level: 1 };
  return { plots: Array.from({ length: nPlots }, () => ({ inv: null, t0: 0 })), store: { basket: {}, pantry: {}, ready: {}, stock: {} }, tools, jobs: {},
    stall: Array(ECON.marketSlots).fill(null), mkt: { flyers: 0, tasting: 0, bellReady: 0, acc: 0 }, workers: {}, orders: [], aiRecipes: {}, craftJobs: {}, queues: {}, chefOff: {}, farmOff: {}, locStats: {},
    order: [...BASIC_CROP_IDS] }; // the 4 basic crops; anything invented must be re-created here (slots are per location)
}
function linkFarms(s) {
  if (!s.farms || !s.farms.length) s.farms = [{ id: 'home', name: 'Home Farm', emoji: '🏡' }];
  const home = s.farms[0];
  for (const f of LOC_FIELDS) { const d = Object.getOwnPropertyDescriptor(s, f); if (d && 'value' in d) { if (home[f] === undefined) home[f] = d.value; delete s[f]; } }
  s.farms.forEach((F, i) => { // pre-location saves: extra farms only had plots -> fresh operation, keep what's planted
    if (i && !F.store) { const fr = freshLocation(F.plots.length); Object.assign(F, { ...fr, plots: F.plots, order: [...new Set([...fr.order, ...F.plots.filter(p => p.inv).map(p => p.inv)])] }); }
    const fr = freshLocation(0); for (const f of LOC_FIELDS) if (F[f] === undefined) F[f] = fr[f];
  });
  s.farmIdx = Math.min(s.farmIdx || 0, s.farms.length - 1);
  for (const f of LOC_FIELDS) Object.defineProperty(s, f, { configurable: true, enumerable: false, get() { return s.farms[s.farmIdx][f]; }, set(v) { s.farms[s.farmIdx][f] = v; } });
  s.recipeBook = s.recipeBook || {}; for (const F of s.farms) Object.assign(s.recipeBook, F.aiRecipes);
}
function withLoc(i, fn) { const cur = state.farmIdx; state.farmIdx = i; try { return fn(); } finally { state.farmIdx = cur; } }
function allPlots() { return state.plots; }
const Farms = {
  mapUnlocked() { return state.farms[0].plots.length >= MAX_HOME_PLOTS; },
  owned(id) { return state.farms.some(f => f.id === id); },
  buy(id) {
    const F = FARMS_FOR_SALE.find(f => f.id === id); if (!F) return { ok: false, msg: 'Unknown farm' };
    if (!this.mapUnlocked()) return { ok: false, msg: 'Fully upgrade your plots to unlock the map' };
    if (this.owned(id)) return { ok: false, msg: 'Already yours' };
    if (state.coins < F.price) return { ok: false, msg: `Need ${F.price}¢` };
    state.coins -= F.price;
    state.farms.push({ id, name: F.name, emoji: F.emoji, ...freshLocation(F.plots) }); // a FRESH START: own plots, kitchen, market, storage
    save(); return { ok: true, idx: state.farms.length - 1 };
  },
  switchTo(idx) { if (!state.farms[idx]) return; state.farmIdx = idx; save(); },
};

/* ---------------- Items ---------------- */
/* combos: extras encoded in the product key's 5th field, e.g. p|plum_stardew|jam|basic|berry_moon,beet_crystal.jam */
const comboEnc = keys => keys.map(k => { const [kd, id, r] = k.split('|'); return kd === 'p' ? id + '.' + r : id; }).join(',');
const comboDec = str => (str ? str.split(',') : []).map(x => { const [id, r] = x.split('.'); return { id, recipe: r || null, inv: state.inventions[id] }; }).filter(x => x.inv);
const shortStem = inv => inv.stem.split(' ').pop();
function comboInfo(mainId, recipe, extras) { // extras: [{id, recipe|null, inv}]
  const main = state.inventions[mainId], r = RECIPES[recipe];
  const all = [{ inv: main }, ...extras];
  const src = all.some(x => x.inv.source === 'ai') ? 'ai' : 'basic';
  const distinct = new Set(extras.map(x => x.id).filter(id => id !== mainId)).size;
  const names = [...new Set(all.map(x => shortStem(x.inv)))];
  const ds = demandStack({ ai: new Set(all.filter(x => x.inv.source === 'ai').map(x => x.inv.id)).size, extras: distinct });
  const extraVal = extras.reduce((a, x) => a + (x.recipe ? Math.round(x.inv.baseValue * RECIPES[x.recipe].mult) : x.inv.baseValue), 0);
  return {
    name: `${extras.length ? names.join('-') : main.stem} ${r.name}`, src,
    value: Math.round(main.baseValue * r.mult + extraVal * COMBO.extraValueMult),
    demand: ds.demand, ds,
    colors: all.map(x => cropColor(x.inv)), distinct,
  };
}
function dsOf(ai) { const ds = demandStack({ ai }); return { demand: ds.demand, ds }; }
/* crop ids inside an item key (c|id, p|id|r|src|combo) — used to count AI crop ingredients */
function ingredientCrops(key) { const [kind, id, , , combo] = key.split('|'); return kind === 'r' ? [] : [id, ...comboDec(combo).map(x => x.id)]; }
function recipeDemand(R) {
  const ids = new Set(R.ingredients.flatMap(g => g.key ? ingredientCrops(g.key) : ['need' + g.need])); // required-but-not-yet-created crops will be AI crops
  const ai = [...ids].filter(id => id.startsWith('need') || (state.inventions[id] && state.inventions[id].source === 'ai')).length;
  return demandStack({ ai, extras: Math.max(0, R.ingredients.length - 1), stars: R.stars });
}
/* ---- recipe REQUIREMENTS: an AI recipe may need crops/tools that don't exist yet (R.requires). The recipe stays LOCKED until
   the player has created each one AT THIS LOCATION (via the normal invent flows). Matching: the linked id/key, an alias set by the
   Create flow, or a name match against this location's crops (name / stem / seed) and tools. Nothing is ever auto-added. */
const normName = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const nameWords = t => normName(t).split(' ').filter(Boolean).map(w => PromptStub.singular(w));
function findCropFor(name) {
  const want = nameWords(name), n = normName(name); if (!want.length) return null;
  for (const id of state.order) { const v = state.inventions[id]; if (!v) continue;
    if ((v.aliases || []).includes(n)) return id;
    const have = new Set([...nameWords(v.name), ...nameWords(v.stem), ...nameWords(BASES[v.base] ? BASES[v.base].name : '')]);
    if (want.every(w => have.has(w))) return id; }
  return null;
}
function findToolFor(name) {
  const want = nameWords(name), n = normName(name); if (!want.length) return null;
  for (const k in state.tools) { const T = TOOLS[k]; if (!T) continue;
    if ((T.aliases || []).includes(n) || want.every(w => nameWords(T.name).includes(w))) return k; }
  return null;
}
function recipeParts(R) {
  const req = (R.requires || []).map(q => ({ ...q, ref: q.kind === 'crop' ? (q.id && state.order.includes(q.id) ? q.id : findCropFor(q.name)) : (q.key && state.tools[q.key] ? q.key : findToolFor(q.name)) }));
  // ingredients/tools that were DELETED (or never made) at this location become locked requirements again; re-creating
  // something with a matching name unlocks them. Lost entries are appended to req (flag lost) so the checklist shows them.
  const lostReq = (kind, name, idea) => { let q = req.find(x => x.lost && x.kind === kind && x.name === name);
    if (!q) { const ref = kind === 'crop' ? findCropFor(name) : findToolFor(name); q = { kind, name, idea, lost: true, ref }; req.push(q); } return q; };
  const ings = R.ingredients.map(g => {
    if (!g.key) return { ...g, key: req[g.need] && req[g.need].ref ? 'c|' + req[g.need].ref : null, req: req[g.need] };
    const parts = g.key.split('|'), id = parts[1];
    if (parts[0] === 'r' || state.order.includes(id)) return { ...g };
    const v = state.inventions[id], q = lostReq('crop', v ? v.stem || v.name : id, v ? v.prompt || v.name : id);
    if (!q.ref) return { ...g, key: null, req: q, lostKey: g.key };
    parts[1] = q.ref; if (parts[0] === 'p') parts[3] = state.inventions[q.ref].source; return { ...g, key: parts.slice(0, 4).join('|'), req: q };
  });
  const steps = R.steps.map(s => {
    if (!s.tool) return { ...s, tool: req[s.need] && req[s.need].ref, req: req[s.need] };
    if (state.tools[s.tool] && TOOLS[s.tool]) return { ...s };
    const T = TOOLS[s.tool] || (state.aiTools || {})[s.tool], q = lostReq('tool', T ? T.name : 'Tool', T ? T.prompt || T.name : 'a kitchen tool');
    return { ...s, tool: q.ref, req: q };
  });
  return { req, ings, steps, locked: req.some(q => !q.ref) };
}
/* MULTI-STEP COOKING: a learned recipe is an ordered chain of tool steps. Each step: tool, action, time (s), adds (which
   ingredients go in at that step, indexes into R.ingredients) and makes (the intermediate it hands to the next tool; the
   last step makes the dish). Missing fields (older saves, Bazaar/Directory cards, the offline stub) get sensible defaults. */
const STEP_MAKES = { Mix: 'dough', Knead: 'dough', Whisk: 'batter', Stir: 'batter', Chop: '(chopped)', Simmer: 'base', Boil: 'base', Fry: '(fried)', Bake: '(baked)', Grill: '(grilled)', Press: '(pressed)', Churn: 'base', Smoke: '(smoked)', Whip: 'cream', Glaze: '(glazed)' };
function stepPlan(R) {
  const P = recipeParts(R), n = P.steps.length, ni = P.ings.length, base = Math.max(4, Math.round((R.craftTime || 12) / Math.max(1, n)));
  return P.steps.map((s, i) => {
    const adds = Array.isArray(s.adds) ? s.adds.filter(x => Number.isInteger(x) && x >= 0 && x < ni)
      : ni >= 2 && n >= 2 ? (i === 0 ? [...Array(ni - 1).keys()] : i === n - 1 ? [ni - 1] : []) : (i === 0 ? [...Array(ni).keys()] : []);
    const head = String(R.name || 'Dish').replace(/\s+(with|and)\s.*$/i, '');
    return { ...s, time: Math.max(3, Math.min(40, Math.round(s.time || base))), adds, makes: i === n - 1 ? R.name : (s.makes || `${head} ${STEP_MAKES[s.action] || '(step ' + (i + 1) + ')'}`) };
  });
}
/* per-item history for the Stats card / Collection */
function itemStat(key) { return state.itemStats[key] || (state.itemStats[key] = { made: 0, sold: 0, earned: 0, best: 0, tools: [] }); }
function recordSale(key, price) { const st = itemStat(key); st.sold++; st.earned += price; st.best = Math.max(st.best, price); st.last = price;
  if (typeof locStat === 'function') { const l = locStat(key); l.sold++; l.earned += price; } } // per-location copy -> Best Creations
function itemInfo(key) {
  const [kind, id, recipe, src, combo] = key.split('|');
  const inv = kind === 'r' ? {} : state.inventions[id];
  if (!inv) return null;
  if (kind === 'c') return {
    key, kind: 'crop', inv, src: inv.source, name: inv.name, value: inv.baseValue,
    ...dsOf(inv.source === 'ai' ? 1 : 0), icon: (s) => cropIcon(inv, s), sym: TRAITS[inv.trait].sym,
  };
  if (kind === 'r') {
    const R = state.aiRecipes[id] || state.recipeBook[id]; if (!R) return null;
    const ds = recipeDemand(R);
    return { key, kind: 'craft', recipe: R, inv: { id: R.id, rarity: R.stars }, src: 'ai', name: R.name, value: R.value, demand: ds.demand, ds,
      icon: (s) => recipeIcon(R, s), sym: '★'.repeat(Math.min(3, R.stars)) };
  }
  const r = RECIPES[recipe];
  if (combo) { const ex = comboDec(combo), ci = comboInfo(id, recipe, ex);
    return { key, kind: 'product', inv, src: ci.src, recipe, combo: ex, name: ci.name, desc: '', value: ci.value, demand: ci.demand, ds: ci.ds,
      icon: (s) => productIcon(inv, recipe, s, ci.src, ci.colors), sym: TRAITS[inv.trait].sym }; }
  // Products have no AI variant of their own: they inherit the crop's source and demand.
  return {
    key, kind: 'product', inv, src: inv.source, recipe, name: `${inv.stem} ${r.name}`, desc: '', value: Math.round(inv.baseValue * r.mult),
    ...dsOf(inv.source === 'ai' ? 1 : 0), icon: (s) => productIcon(inv, recipe, s, inv.source), sym: TRAITS[inv.trait].sym,
  };
}
function addItem(key, n, made = true, loc = 'basket') {
  if (n > 0 && made) itemStat(key).made += n;
  const b = state.store[loc]; b[key] = (b[key] || 0) + n; if (b[key] <= 0) delete b[key];
}
const qtyAt = (loc, key) => state.store[loc][key] || 0;
const kitchenQty = key => qtyAt('pantry', key) + qtyAt('ready', key);      // what the kitchen can cook/craft with
const forKitchen = key => qtyAt('basket', key) + qtyAt('pantry', key);     // on hand for kitchen orders (incl. not yet carried)
const totalQty = key => Object.keys(LOCS).reduce((a, l) => a + qtyAt(l, key), 0);
function storeMap(locs) { const m = {}; for (const l of locs) for (const k in state.store[l]) m[k] = (m[k] || 0) + state.store[l][k]; return m; }
function takeKitchen(key, n) { const a = Math.min(n, qtyAt('pantry', key)); if (a) addItem(key, -a, false, 'pantry'); if (n - a > 0) addItem(key, -(n - a), false, 'ready'); }
function moveItem(key, from, to, n = Infinity) { n = Math.min(n, qtyAt(from, key)); if (n <= 0) return 0; addItem(key, -n, false, from); addItem(key, n, false, to); return n; }
/* inventoryList(filter, locs): items in the given locations (default: everywhere) */
function inventoryList(filter, locs = Object.keys(LOCS)) {
  const m = storeMap(typeof locs === 'string' ? [locs] : locs);
  return Object.keys(m).filter(k => m[k] > 0 && (!filter || k.startsWith(filter))).map(k => ({ ...itemInfo(k), qty: m[k] })).filter(x => x.inv);
}

/* ---------------- Workers ---------------- */
const Workers = {
  hire(k) {
    const W = WORKERS[k], w = state.workers[k];
    if (w && w.hired) return { ok: false, msg: 'Already hired' };
    if (state.coins < W.hire) return { ok: false, msg: `Need ${W.hire}¢ to hire` };
    state.coins -= W.hire;
    state.workers[k] = { hired: true, next: now() + 800, nextWage: now() + WORKER_ECON.wagePeriod * 1000, stopped: false, status: 'Just arrived 👋' };
    save(); return { ok: true };
  },
  fire(k) { delete state.workers[k]; if (k === 'chef') state.orders = state.orders.filter(o => o.by !== 'chef'); save(); return { ok: true }; },
  active(k) { const w = state.workers[k]; return !!(w && w.hired && !w.stopped); },
  /* wages: every wagePeriod; if coins can't cover it the worker stops (and resumes once paid) */
  payWages(t) {
    for (const k in state.workers) {
      const w = state.workers[k], W = WORKERS[k]; if (!w.hired) continue;
      if (t < w.nextWage && !w.stopped) continue;
      if (state.coins >= W.wage) { state.coins -= W.wage; w.nextWage = t + WORKER_ECON.wagePeriod * 1000; if (w.stopped) { w.stopped = false; w.status = 'Back to work 💪'; } }
      else if (!w.stopped) { w.stopped = true; w.status = `💤 Stopped: can't cover the ${W.wage}¢ wage`; }
    }
  },
  tick() {
    const t = now(); this.payWages(t);
    this.refreshOrders();
    for (const k in state.workers) {
      const w = state.workers[k]; if (!w.hired || w.stopped || t < w.next) continue;
      w.next = t + WORKERS[k].every * 1000;
      try { w.status = this[k](w) || w.status; } catch (e) { console.warn('worker', k, e); }
    }
  },
  emptyPlot() { return state.plots.findIndex(p => !p.inv); },
  emptySpot() { const i = state.plots.findIndex(p => !p.inv); return i >= 0 ? { i } : null; }, // workers only work their own location
  full(k) { const w = state.workers[k], who = this.active('harvester') ? 'the Harvester' : 'you'; return w && w.last ? `✅ Planted ${w.last} · plots full, waiting for ${who} to harvest` : `🌱 All plots busy · waiting for ${who} to harvest`; },
  plantAs(k, id, why) {
    const spot = this.emptySpot(); if (!spot) return this.full(k);
    const i = spot.i, r = Game.plant(i, id);
    if (!r.ok) return '🪙 ' + (r.msg || 'Can’t plant');
    const where = `plot ${i + 1}`;
    state.workers[k].last = state.inventions[id].name + (why && why.startsWith('for') ? ' ' + why.replace(/ \(.*\)$/, '') : '');
    return `🌱 Planting ${state.inventions[id].name}${why ? ' ' + why : ''} (${where})`;
  },
  /* CHEAP workers never optimise. Farmhand: uniform random over the DISTINCT crop types in this location's seed list
     that it can afford right now (free Garden Tomatoes are one equal option, never favoured or excluded). No value
     sorting, no weighting by stock or seed count. */
  farmhandPool() { return [...new Set(state.order)].filter(id => state.inventions[id] && farmOn(id) && Game.seedCost(id) <= state.coins); },
  farmhandPick() { const pool = this.farmhandPool(); return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null; },
  farmhand() {
    if (!this.emptySpot()) return this.full('farmhand');
    const id = this.farmhandPick(); if (!id) return '🌱 Nothing plantable';
    return this.plantAs('farmhand', id, '(random pick)');
  },
  manager() {
    if (!this.emptySpot()) return this.full('manager');
    for (const o of state.orders) { // fill orders first: count what's on hand + already growing
      const id = o.key.slice(2), inv = state.inventions[id]; if (!inv || !farmOn(id)) continue;
      const growing = state.plots.filter(p => p.inv === id).length * inv.yield;
      if (forKitchen(o.key) + growing < o.need) return this.plantAs('manager', id, `for ${o.by === 'chef' ? 'Head Chef' : o.by} (${o.for})`);
    }
    const best = [...state.order].filter(farmOn).sort((a, b) => state.inventions[b].baseValue - state.inventions[a].baseValue)[0];
    if (!best) return '🚫 Every crop is switched off for workers';
    return this.plantAs('manager', best, '(highest value)');
  },
  /* Runners: carry RUNNER_LOAD items per trip between locations */
  krunner(w) {
    const crops = Object.keys(state.store.basket).filter(k => k.startsWith('c|') && state.inventions[k.slice(2)]); if (!crops.length) return '🧺 Basket empty · nothing to carry';
    const ord = state.orders.find(o => qtyAt('basket', o.key) > 0 && qtyAt('pantry', o.key) < o.need);
    const need = this.recipeNeeds().orders.find(o => qtyAt('basket', o.key) > 0 && qtyAt('pantry', o.key) < o.need);
    const key = ord ? ord.key : need ? need.key : crops.sort((a, b) => qtyAt('basket', b) - qtyAt('basket', a))[0];
    const n = moveItem(key, 'basket', 'pantry', RUNNER_LOAD); w.carried = (w.carried || 0) + n; save();
    return `🚚 Carried ${n} ${state.inventions[key.slice(2)].name} to the kitchen${ord ? ' (Orders board)' : need ? ' (for a recipe)' : ''}`;
  },
  mrunner(w) {
    const reserved = Object.keys(state.aiRecipes).length ? this.recipeNeeds().keys : new Set(); // keep recipe ingredients in the kitchen
    const goods = Object.keys(state.store.ready).filter(k => !reserved.has(k) && itemInfo(k)); if (!goods.length) return '🍯 Ready shelf empty · nothing to carry';
    const onStall = k => state.stall.find(s => s && s.key === k);
    const low = goods.find(k => { const s = onStall(k); return s && s.qty < 3 && !qtyAt('stock', k); });
    const gap = state.stall.some(s => !s || s.qty <= 0);
    const score = k => { const i = itemInfo(k); return i.value * i.demand; };
    const key = low || goods.sort((a, b) => score(b) - score(a))[0];
    const n = moveItem(key, 'ready', 'stock', RUNNER_LOAD); w.carried = (w.carried || 0) + n; save();
    return `🚚 Carried ${n} ${itemInfo(key).name} to the market${low ? ' (stall running low)' : gap ? ' (fills a stall gap)' : ''}`;
  },
  /* Harvester: picks ONE ripe plot per action (its own location only) into the Farm Basket */
  harvester(w) {
    const i = state.plots.findIndex(p => p.inv && Game.plotProgress(p) >= 1);
    if (i >= 0) { const r = Game.harvest(i); if (r.ok) { w.harvested = (w.harvested || 0) + r.n; return `🧺 Harvested ${r.n} ${r.inv.name} (plot ${i + 1})`; } }
    return state.plots.some(p => p.inv) ? '⏳ Waiting for crops to ripen' : '🌾 Nothing planted yet';
  },
  /* kitchen: collect a finished batch first, then start one */
  collectOne() {
    for (const tk in state.jobs) if (Game.jobProgress(state.jobs[tk]) >= 1) { const r = Game.collect(tk); if (!r.ok) continue;
      return r.moved ? (r.lost ? '🗑 Cleared a batch of a deleted recipe' : `➡️ Moved ${r.name} to the ${TOOLS[r.to].name}`) : `📦 Collected ${r.n}× ${itemInfo(r.key).name}`; }
    return null;
  },
  idleTools() { return Object.keys(TOOLS).filter(k => state.tools[k] && state.tools[k].owned && !state.jobs[k]); },
  plainOptions() {
    const out = [];
    for (const tk of this.idleTools()) for (const r of TOOLS[tk].recipes) for (const ck of Object.keys(state.store.pantry)) {
      if (!ck.startsWith('c|') || qtyAt('pantry', ck) < RECIPES[r].uses || !state.inventions[ck.slice(2)]) continue;
      out.push({ tool: tk, recipe: r, id: ck.slice(2), extras: [] });
    }
    return out;
  },
  /* Kitchen Helper: uniform random over the DISTINCT dishes it can make right now from the Pantry with idle owned
     tools (plain recipe × crop, plus learned AI recipes that are ready). One entry per dish, so a dish isn't more
     likely because several tools can make it; the tool is then picked at random among those that can. No value sorting. */
  helperOptions() {
    const by = new Map();
    for (const o of this.plainOptions()) { const k = o.recipe + '|' + o.id; if (!by.has(k)) by.set(k, { kind: 'plain', recipe: o.recipe, id: o.id, tools: [] }); by.get(k).tools.push(o.tool); }
    for (const id in state.aiRecipes) { if (!chefOn(id)) continue; const c = Game.recipeCheck(id); if (c.ok && c.idle) by.set('r|' + id, { kind: 'ai', recipeId: id, tool: c.tool }); } // goes to its own tool
    return [...by.values()];
  },
  helperPick() { const o = this.helperOptions(); return o.length ? o[Math.floor(Math.random() * o.length)] : null; },
  helper() {
    const c = this.collectOne(); if (c) return c;
    const o = this.helperPick(); if (!o) return this.idleTools().length ? '🧺 Nothing to cook · harvest more crops' : '🍳 All tools busy';
    if (o.kind === 'ai') { const r = Game.craft(o.recipeId); return r && r.ok !== false ? `🍳 Cooking ${state.aiRecipes[o.recipeId].name} in the ${TOOLS[r.tool].name} (random pick)` : '🍳 Couldn’t start that recipe'; }
    const tool = o.tools[Math.floor(Math.random() * o.tools.length)]; Game.cook(tool, o.recipe, o.id);
    return `🍳 Cooking ${itemInfo(Game.jobKey(state.jobs[tool])).name} (random pick)`;
  },
  /* Head Chef: score = value × output × demand; considers combos (best extras) and learned AI recipes */
  chefOptions() {
    const opts = [];
    const needed = this.recipeNeeds();
    for (const o of this.plainOptions()) {
      const out = 1 + Game.toolStats(o.tool).bonus;
      const base = itemInfo(`p|${o.id}|${o.recipe}|${state.inventions[o.id].source}`);
      const prep = needed.products.has(`p|${o.id}|${o.recipe}|${state.inventions[o.id].source}`);
      opts.push({ ...o, name: base.name, score: base.value * base.demand * out * (prep ? 3 : 1), prep });
      // combo: add the 1–2 most valuable extra ingredients on hand (1 each, distinct, not reserved by the main batch)
      if (prep) continue;
      const ck = 'c|' + o.id;
      const pool = Object.keys(storeMap(['pantry', 'ready'])).filter(k => k !== ck && (k.startsWith('c|') || (k.startsWith('p|') && k.split('|').length === 4)) && !needed.keys.has(k))
        .map(k => ({ k, v: itemInfo(k).value })).sort((a, b) => b.v - a.v).slice(0, COMBO.maxExtras).map(x => x.k);
      if (pool.length) {
        const ci = comboInfo(o.id, o.recipe, comboDec(comboEnc(pool)));
        opts.push({ ...o, extras: pool, name: ci.name, score: ci.value * ci.demand * out });
      }
    }
    for (const id in state.aiRecipes) {
      if (!chefOn(id)) continue; const R = state.aiRecipes[id], c = Game.recipeCheck(id);
      if (c.ok && c.idle) opts.push({ recipeId: id, tool: c.tool, name: R.name, score: R.value * recipeDemand(R).demand * R.out * 1.5 });
    }
    return opts.sort((a, b) => b.score - a.score);
  },
  /* what learned AI recipes still need (crops directly, or crops to cook the product ingredients) */
  recipeNeeds() {
    const products = new Set(), keys = new Set(), orders = [], locked = [];
    for (const id in state.aiRecipes) {
      const R = state.aiRecipes[id]; if (Game.craftJob(id) || !chefOn(id)) continue;
      const P = recipeParts(R); if (P.locked) { locked.push({ id, name: R.name, missing: P.req.filter(q => !q.ref).map(q => q.name) }); continue; }
      for (const g of P.ings) {
        keys.add(g.key);
        const have = kitchenQty(g.key); if (have >= g.qty) continue;
        const [kind, cid, r] = g.key.split('|');
        if (kind === 'c') orders.push({ key: g.key, need: g.qty, for: R.name });
        else { products.add(g.key); orders.push({ key: 'c|' + cid, need: RECIPES[r].uses * Math.ceil((g.qty - have) / 2), for: R.name }); }
      }
    }
    return { products, keys, orders, locked };
  },
  chef() {
    const c = this.collectOne(); if (c) return c;
    const best = this.chefOptions()[0];
    if (!best) { const lk = this.recipeNeeds().locked[0];
      return lk && !this.idleTools().length ? '🍳 All tools busy' : this.idleTools().length || Object.keys(state.aiRecipes).length ? (lk ? `🔒 ${lk.name} needs ${lk.missing.join(', ')} created · see Recipe Book` : '📝 Waiting on ingredients · see Orders') : '🍳 All tools busy'; }
    if (best.recipeId) { const r = Game.craft(best.recipeId); return r.ok ? `✨ Cooking ${best.name} in the ${TOOLS[r.tool].name} (AI recipe)` : '📝 ' + r.msg; }
    const r = Game.cook(best.tool, best.recipe, best.id, best.extras);
    return r.ok ? `🍳 ${best.prep ? 'Prepping' : 'Cooking'} ${best.name}${best.extras.length ? ' (combo)' : best.prep ? ' for a recipe' : ''}` : '📝 ' + r.msg;
  },
  /* the Head Chef keeps the shared Orders board current; orders vanish once the basket has enough */
  /* ---- Market Manager: stock, price, and use the market's existing boosts when they pay off ---- */
  bestPrice(slot, appealMult = 1) { // price that maximises expected coins per visitor (price x buy chance)
    const ev = Market.evaluate(slot, appealMult); if (!ev) return null;
    let best = { p: 1, er: 0 };
    for (let p = 1; p <= Math.ceil(ev.perceived * 1.7); p++) { const e = Market.evaluate(slot, appealMult, p), er = p * e.chance; if (er > best.er) best = { p, er }; }
    return best;
  },
  expRev(appealMult = 1) { // expected coins per visitor across stocked baskets at current prices (visitors pick a random basket)
    const sl = state.stall.map((s, i) => s && s.qty > 0 ? i : -1).filter(i => i >= 0); if (!sl.length) return 0;
    return sl.reduce((a, i) => { const e = Market.evaluate(i, appealMult); return a + Math.min(1, Math.max(0, e.chance)) * state.stall[i].price; }, 0) / sl.length;
  },
  sellable() { // products first; crops only when no kitchen worker needs them and they're not on the Orders board
    const kitchenBusy = this.active('helper') || this.active('chef'), ordered = new Set(state.orders.map(o => o.key));
    const items = Object.keys(state.store.stock).filter(k => !state.stall.some(s => s && s.key === k)).map(k => ({ ...itemInfo(k), qty: qtyAt('stock', k) })).filter(x => x.inv);
    const prods = items.filter(x => !x.key.startsWith('c|'));
    const crops = items.filter(x => x.key.startsWith('c|') && !kitchenBusy && !ordered.has(x.key));
    const score = x => x.value * x.demand;
    return (prods.length ? prods : crops).sort((a, b) => score(b) - score(a));
  },
  market(w) {
    const st = state.stall, t = now();
    // 1. restock a basket whose item is still in inventory
    for (let i = 0; i < st.length; i++) { const s = st[i]; if (s && qtyAt('stock', s.key) > 0) { const n = qtyAt('stock', s.key); Game.stock(i, s.key, 1e9, s.price); return `🧺 Restocked ${n} ${itemInfo(s.key).name} at ${s.price}¢`; } }
    // 2. fill an empty basket with the best sellable item at the best-earning price
    const empty = st.findIndex(s => !s || s.qty <= 0);
    if (empty >= 0) {
      const x = this.sellable()[0];
      if (x) { Game.stock(empty, x.key, x.qty, Math.max(1, Math.round(x.value * 1.3))); const bp = this.bestPrice(empty); Game.setPrice(empty, bp.p);
        return `🧺 Put out ${state.stall[empty].qty} ${x.name} at ${bp.p}¢`; }
    }
    if (!st.some(s => s && s.qty > 0)) return '🪹 Stockroom empty · send goods to the Market';
    // 3. price tweak: move any basket >10% off its best-earning price
    for (let i = 0; i < st.length; i++) { const s = st[i]; if (!s) continue; const bp = this.bestPrice(i);
      if (Math.abs(bp.p - s.price) > Math.max(1, s.price * 0.1)) { const old = s.price; Game.setPrice(i, bp.p); return `🏷️ Re-priced ${itemInfo(s.key).name} ${old}¢ → ${bp.p}¢`; } }
    // 4. boosts (already in the market): Bell (free), Flyers (coins), Tasting (costs 1 item)
    const reserve = WORKERS.market.wage * 2, er = this.expRev();
    if (t >= state.mkt.bellReady && Game.marketing('bell').ok) return `🔔 Rang the Brass Bell (${MARKETING.bell.burst} browsers)`;
    const F = MARKETING.flyers, stockVal = st.reduce((a, s) => a + (s ? s.qty * s.price : 0), 0), flyGain = Math.min(stockVal, F.dur * F.traffic * er);
    if (!(state.mkt.flyers > t) && state.coins >= F.cost + reserve && flyGain > F.cost && Game.marketing('flyers').ok) return `📜 Using Flyers (${F.cost}¢ → ~${Math.round(flyGain)}¢ extra expected)`;
    const T = MARKETING.tasting, first = st.find(s => s && s.qty > 0);
    if (!(state.mkt.tasting > t) && first) {
      const gain = T.dur * Market.traffic() * (this.expRev(T.appeal) - er), cost = first.price, nm = itemInfo(first.key).name;
      if (gain > cost && Game.marketing('tasting').ok) return `🥄 Using Tasting: gave 1 ${nm} (~${Math.round(gain)}¢ extra expected)`;
    }
    const n = st.reduce((a, s) => a + (s ? s.qty : 0), 0);
    return `👀 Minding the stall · ${n} item${n === 1 ? '' : 's'} out`;
  },
  refreshOrders() {
    if (!this.active('chef')) { state.orders = state.orders.filter(o => o.by !== 'chef'); return; }
    const want = new Map();
    for (const o of this.recipeNeeds().orders) {
      if (!state.inventions[o.key.slice(2)]) continue;
      const cur = want.get(o.key); if (cur) { cur.need = Math.max(cur.need, o.need); continue; }
      want.set(o.key, { ...o, by: 'chef' });
    }
    if (!want.size && !this.plainOptions().length && this.idleTools().length) { // nothing cookable at all: ask for the best crop for an idle tool
      const tk = this.idleTools()[0], r = TOOLS[tk].recipes[0];
      const id = [...state.order].sort((a, b) => state.inventions[b].baseValue - state.inventions[a].baseValue)[0];
      want.set('c|' + id, { key: 'c|' + id, need: RECIPES[r].uses, for: `${TOOLS[tk].name} ${RECIPES[r].name}`, by: 'chef' });
    }
    state.orders = [...state.orders.filter(o => o.by !== 'chef'), ...[...want.values()].filter(o => forKitchen(o.key) < o.need)].slice(0, WORKER_ECON.maxOrders);
  },
};

/* ---------------- Actions ---------------- */
const Game = {
  invent(base, trait, stages) {
    const id = base + '_' + trait;
    if (state.order.includes(id)) return { ok: false, msg: 'Already invented here!' };
    const sb = Slots.block('crop'); if (sb) return sb;
    if (!SOURCES.basic.bases.includes(base) || !SOURCES.basic.traits.includes(trait)) return { ok: false, msg: 'Needs AI invent' };
    if (state.coins < ECON.inventCost) return { ok: false, msg: 'Not enough coins' };
    state.coins -= ECON.inventCost;
    const old = state.inventions[id]; // known from another location: re-create it here (collection entry is kept)
    const inv = old || Inventor.procedural(base, trait, 'basic');
    if (!old || stages) inv.stages = { ...(stages || defaultStages(id)) };
    state.inventions[id] = inv; state.order.unshift(id); state.novelty[id] = state.novelty[id] ?? 1;
    addItem('c|' + id, 2); // 2 free sample crops so it can be sold or processed right away
    save(); return { ok: true, inv };
  },
  /* AI invent: spends 1 credit (or covered by sub) only if the interpreter returns an item */
  // opts: { stages (player-chosen growth looks), onSketch(item) called while the image is being generated }
  async aiInvent(type, prompt, opts = {}) {
    const sb = Slots.block('crop'); if (sb) return sb; // full: blocked before any AI call or credit
    if (!Entitlements.canUseAI()) return { ok: false, msg: 'locked' };
    const inv = await AIInterpreter.invent({ type: 'crop', prompt });
    if (!inv || inv.error) return { ok: false, msg: inv ? inv.error : 'AI had no answer (no credit used)' };
    inv.stages = { ...(opts.stages || defaultStages(inv.id)) };
    if (opts.fulfills) inv.aliases = [...new Set([...(inv.aliases || []), normName(opts.fulfills)])]; // made for a recipe requirement
    if (opts.onSketch) opts.onSketch(inv);
    const img = inv.imageUrl ? { imageUrl: inv.imageUrl, imagePrompt: inv.imagePrompt, imagePreview: false } // the AI server already painted it
      : await AIImageService.generate({ type: 'crop', prompt, name: inv.name }); // fruit image only
    if (!img || img.error) return { ok: false, msg: 'Image failed (no credit used)' };
    Object.assign(inv, img);
    Entitlements.spendAICredit(); // interpreter + image = 1 credit, spent only on success
    state.inventions[inv.id] = inv; if (!state.order.includes(inv.id)) state.order.unshift(inv.id); state.novelty[inv.id] = 1;
    addItem('c|' + inv.id, 3); save();
    if (typeof Directory !== 'undefined') Directory.file('crop', inv);
    return { ok: true, inv };
  },
  plotCost() { // home farm only
    if (state.farmIdx) return Infinity;
    return Math.round(ECON.plotBaseCost * Math.pow(ECON.plotCostGrowth, state.plots.length - ECON.startPlots)); },
  buyPlot() {
    if (state.farmIdx) return { ok: false, msg: 'Extra farms come with fixed plots' };
    if (state.plots.length >= MAX_HOME_PLOTS) return { ok: false, msg: 'Farm is full' };
    const c = this.plotCost(); if (state.coins < c) return { ok: false, msg: 'Need ' + c + '¢' };
    state.coins -= c; state.plots.push({ inv: null, t0: 0 }); save(); return { ok: true };
  },
  seedCost(id) { const v = state.inventions[id]; return !v ? ECON.seedCost : v.free ? 0 : v.basicCrop ? v.seed : ECON.seedCost; }, // Tomato free, other basics cheap
  plant(i, id) {
    const p = state.plots[i]; if (!p || p.inv) return { ok: false };
    const c = this.seedCost(id);
    if (state.coins < c) return { ok: false, msg: 'Need ' + c + '¢ for seeds (Garden Tomatoes are free)' };
    state.coins -= c; p.inv = id; p.t0 = now(); save(); return { ok: true, free: !c };
  },
  plotProgress(p) { if (!p.inv) return 0; const inv = state.inventions[p.inv]; return Math.min(1, (now() - p.t0) / (inv.growTime * 1000)); },
  harvest(i) {
    const p = state.plots[i]; if (!p.inv || this.plotProgress(p) < 1) return { ok: false };
    const inv = state.inventions[p.inv]; addItem('c|' + inv.id, inv.yield); p.inv = null; save();
    return { ok: true, n: inv.yield, inv };
  },
  toolStats(k) {
    const T = TOOLS[k], lv = state.tools[k].level;
    const speed = T.speedMult * Math.pow(TOOL_UPGRADE.speedPerLevel, lv - 1);
    const bonus = T.bonusOut + TOOL_UPGRADE.bonusLevels.filter(l => lv >= l).length;
    return { speed, bonus, lv };
  },
  upgradeTool(k) {
    const t = state.tools[k]; if (!t.owned) return { ok: false, msg: 'Not owned' };
    if (t.level >= TOOL_UPGRADE.maxLevel) return { ok: false, msg: 'Max level' };
    const c = toolUpgradeCost(t.level); if (state.coins < c) return { ok: false, msg: 'Need ' + c + '¢' };
    state.coins -= c; t.level++; save(); return { ok: true, lv: t.level };
  },
  buyTool(k) {
    const T = TOOLS[k]; if (state.tools[k].owned || !T.cost) return { ok: false };
    if (state.coins < T.cost) return { ok: false, msg: 'Need ' + T.cost + '¢' };
    state.coins -= T.cost; state.tools[k].owned = true; save(); return { ok: true };
  },
  async aiTool(prompt, opts = {}) {
    const sb = Slots.block('tool'); if (sb) return sb;
    if (!Entitlements.canUseAI()) return { ok: false, msg: 'locked' };
    const t = await AIInterpreter.invent({ type: 'tool', prompt });
    if (!t || t.error) return { ok: false, msg: t ? t.error : 'AI had no answer (no credit used)' };
    if (opts.fulfills) t.aliases = [...new Set([...(t.aliases || []), normName(opts.fulfills)])];
    if (opts.onSketch) opts.onSketch(t);
    const img = t.imageUrl ? { imageUrl: t.imageUrl, imagePrompt: t.imagePrompt, imagePreview: false }
      : await AIImageService.generate({ type: 'tool', prompt, name: t.name }); // full tool image
    if (!img || img.error) return { ok: false, msg: 'Image failed (no credit used)' };
    Object.assign(t, img);
    Entitlements.spendAICredit();
    state.aiTools[t.key] = t; state.tools[t.key] = { owned: true, level: 1 }; TOOLS[t.key] = t;
    save(); if (typeof Directory !== 'undefined') Directory.file('tool', t);
    return { ok: true, tool: t };
  },
  /* ===== TOOL STATIONS: every tool cooks ONE batch at a time plus a small queue (ingredients are taken when queued).
     Basic recipes (jam/pie/...) AND learned recipes both run here; a learned recipe runs on its PRIMARY tool (its final
     step's tool), and its other step tools must exist at this location. No separate crafting area. */
  QUEUE_MAX: 3,
  queueOf(k) { return (state.queues || {})[k] || []; },
  toolFree(k) { return !state.jobs[k] || this.queueOf(k).length < this.QUEUE_MAX; },
  startOrQueue(k, job) {
    if (!state.jobs[k]) { state.jobs[k] = { ...job, t0: now() }; return false; }
    state.queues[k] = [...this.queueOf(k), job]; return true;
  },
  unqueue(k, i) { // cancel a queued batch: ingredients go back to the Pantry / Ready shelf
    const q = this.queueOf(k), j = q[i]; if (!j) return { ok: false };
    if (j.rid && j.step > 0) return { ok: false, msg: "A half-made dish can't be un-cooked" };
    (j.took || []).forEach(([key, n]) => addItem(key, n, false, key.startsWith('c|') ? 'pantry' : 'ready'));
    if (!j.rid) { addItem('c|' + j.id, RECIPES[j.recipe].uses, false, 'pantry'); comboDec(j.combo).forEach(x => addItem(x.recipe ? `p|${x.id}|${x.recipe}|${x.inv.source}` : 'c|' + x.id, 1, false, x.recipe ? 'ready' : 'pantry')); }
    q.splice(i, 1); state.queues[k] = q; save(); return { ok: true };
  },
  toggleChef(rid) { state.chefOff = state.chefOff || {}; if (state.chefOff[rid]) delete state.chefOff[rid]; else state.chefOff[rid] = true; save(); return chefOn(rid); },
  toggleFarm(id) { state.farmOff = state.farmOff || {}; if (state.farmOff[id]) delete state.farmOff[id]; else state.farmOff[id] = true; save(); return farmOn(id); },
  plan(id) { const R = state.aiRecipes[id] || state.recipeBook[id]; return R ? stepPlan(R) : []; },
  recipeTool(id) { const p = this.plan(id); return p.length ? p[0].tool || null : null; }, // a chain STARTS at its first step's tool
  recipesForTool(k) { return Object.keys(state.aiRecipes).filter(id => this.recipeTool(id) === k); },
  recipesUsingTool(k) { return Object.keys(state.aiRecipes).filter(id => this.plan(id).some((s, i) => i > 0 && s.tool === k)); },
  craftJob(id) { for (const k in state.jobs) if (state.jobs[k] && state.jobs[k].rid === id) return state.jobs[k]; return null; },
  cook(toolKey, recipe, id, extras = []) {
    if (!this.toolFree(toolKey)) return { ok: false, msg: 'Busy · queue full' };
    const T = TOOLS[toolKey], r = RECIPES[recipe];
    if (!state.tools[toolKey].owned || !T.recipes.includes(recipe)) return { ok: false, msg: 'Tool cannot make that' };
    const ck = 'c|' + id; if (qtyAt('pantry', ck) < r.uses) return { ok: false, msg: `Need ${r.uses} crops in the Pantry` };
    extras = [...new Set(extras)].filter(k => k !== ck).slice(0, COMBO.maxExtras);
    if (extras.some(k => kitchenQty(k) < 1)) return { ok: false, msg: 'Missing a combo ingredient in the kitchen' };
    addItem(ck, -r.uses, false, 'pantry'); extras.forEach(k => takeKitchen(k, 1));
    const st = this.toolStats(toolKey), combo = comboEnc(extras);
    const src = combo ? comboInfo(id, recipe, comboDec(combo)).src : state.inventions[id].source;
    const job = { recipe, id, src, combo, dur: Math.max(1, r.time * st.speed * (1 + 0.15 * extras.length)), out: 1 + st.bonus };
    const q = this.startOrQueue(toolKey, job); save(); return { ok: true, queued: q, job };
  },
  jobKey(j) { return j.rid ? 'r|' + j.rid : `p|${j.id}|${j.recipe}|${j.src}` + (j.combo ? '|' + j.combo : ''); },
  jobProgress(j) { return j ? Math.min(1, (now() - j.t0) / (j.dur * 1000)) : 0; },
  /* a finished step of a chain MOVES to the next step's tool (starts there, or waits in its queue) */
  moveOn(toolKey) {
    const j = state.jobs[toolKey], plan = this.plan(j.rid), nx = plan[j.step + 1];
    if (!plan.length) { delete state.jobs[toolKey]; this.next(toolKey); save(); return { ok: true, moved: true, lost: true, name: 'a deleted recipe' }; }
    if (!nx.tool || !state.tools[nx.tool]) return { ok: false, msg: `Needs the ${nx.req ? nx.req.name : 'next tool'} here` };
    if (!this.toolFree(nx.tool)) return { ok: false, msg: `The ${TOOLS[nx.tool].name} queue is full`, full: nx.tool };
    delete state.jobs[toolKey];
    const queued = this.startOrQueue(nx.tool, { ...j, t0: undefined, step: j.step + 1, dur: nx.time * this.toolStats(nx.tool).speed });
    this.next(toolKey); save();
    return { ok: true, moved: true, to: nx.tool, name: plan[j.step].makes, queued };
  },
  next(toolKey) { if (state.jobs[toolKey]) return; const q = this.queueOf(toolKey); if (q.length) { state.jobs[toolKey] = { ...q.shift(), t0: now() }; state.queues[toolKey] = q; } },
  collect(toolKey) {
    const j = state.jobs[toolKey]; if (!j || this.jobProgress(j) < 1) return { ok: false };
    if (j.rid && j.step < this.plan(j.rid).length - 1) return this.moveOn(toolKey);
    const key = this.jobKey(j); addItem(key, j.out, true, 'ready'); const st = itemStat(key);
    (j.tools || [toolKey]).forEach(t => { if (t && !st.tools.includes(t)) st.tools.push(t); });
    delete state.jobs[toolKey];
    this.next(toolKey); // next batch starts
    save(); return { ok: true, key, n: j.out, tool: toolKey };
  },
  /* ---- AI recipes ---- */
  // opts.preR: a recipe the AI already wrote (the player confirmed a slot warning) -> no second text call
  // opts.allowOverSlots: learn even if its NEW crops/tools won't fit the free slots (it stays locked until room is made)
  async aiRecipe(prompt, opts = {}) {
    const sb = Slots.block('recipe'); if (sb) return sb;
    if (!Entitlements.canUseAI()) return { ok: false, msg: 'locked' };
    // only what exists at THIS location; anything else the dish needs comes back as a requirement (R.requires)
    const R = opts.preR || await AIRecipeInterpreter.invent({ prompt, inventions: Object.fromEntries(state.order.map(id => [id, state.inventions[id]])), tools: Object.fromEntries(Object.keys(state.tools).filter(k => TOOLS[k]).map(k => [k, TOOLS[k]])) });
    if (!R || R.error) return { ok: false, msg: R ? R.error : 'AI had no answer (no credit used)' };
    if (state.aiRecipes[R.id]) return { ok: false, msg: 'You already know that recipe (no credit used)' };
    const need = Slots.recipeNeeds(R);
    if (need.over && !opts.allowOverSlots) return { ok: false, slotWarn: need, pendingR: R, msg: 'Not enough free slots for what this recipe needs (no credit used)' };
    if (opts.onSketch) opts.onSketch(R);
    const img = R.imageUrl ? { imageUrl: R.imageUrl, imagePrompt: R.imagePrompt, imagePreview: false }
      : await AIImageService.generate({ type: 'recipe', prompt, name: R.name }); // same image pipeline
    if (!img || img.error) return { ok: false, msg: 'Image failed (no credit used)' };
    Object.assign(R, img);
    Entitlements.spendAICredit(); // 1 credit to LEARN; crafting afterwards is free
    state.aiRecipes[R.id] = R; state.recipeBook[R.id] = R; state.novelty[R.id] = 1; save();
    if (typeof Directory !== 'undefined') Directory.file('recipe', R);
    return { ok: true, recipe: R };
  },
  /* ---- DELETE invented things (basics can't be deleted; never refunds credits). The global collection entry is kept. ---- */
  deleteImpact(kind, ref) {
    const out = { name: '', stock: 0, stall: 0, plots: 0, job: false, recipes: [] };
    if (kind === 'crop') {
      const v = state.inventions[ref]; out.name = v ? v.name : ref; const ck = 'c|' + ref;
      for (const l in LOCS) out.stock += state.store[l][ck] || 0;
      state.stall.forEach(sl => { if (sl && sl.key === ck) out.stall += sl.qty; });
      out.plots = state.plots.filter(p => p.inv === ref).length;
      for (const id in state.aiRecipes) { const R = state.aiRecipes[id];
        if (R.ingredients.some(g => g.key && ingredientCrops(g.key).includes(ref)) || recipeParts(R).req.some(q => q.ref === ref)) out.recipes.push(R.name); }
    } else if (kind === 'tool') {
      out.name = TOOLS[ref] ? TOOLS[ref].name : ref; out.job = !!state.jobs[ref]; out.queued = Game.queueOf(ref).length;
      for (const id in state.aiRecipes) { const R = state.aiRecipes[id];
        if (R.steps.some(s => s.tool === ref) || recipeParts(R).req.some(q => q.ref === ref)) out.recipes.push(R.name); }
    } else { const R = state.aiRecipes[ref]; out.name = R ? R.name : ref; out.job = !!Game.craftJob(ref); out.stock = Object.keys(LOCS).reduce((a, l) => a + (state.store[l]['r|' + ref] || 0), 0); }
    return out;
  },
  deleteCrop(id) {
    if (isBasicCrop(id)) return { ok: false, msg: "Basic crops can't be deleted" };
    if (!state.order.includes(id)) return { ok: false, msg: 'Not here' };
    const ck = 'c|' + id; state.order = state.order.filter(x => x !== id);
    for (const l in LOCS) delete state.store[l][ck];
    state.stall.forEach((sl, i) => { if (sl && sl.key === ck) state.stall[i] = null; });
    state.plots.forEach(p => { if (p.inv === id) { p.inv = null; p.t0 = 0; } });
    state.orders = state.orders.filter(o => o.key !== ck);
    save(); return { ok: true };
  },
  deleteTool(k) {
    if (isBasicTool(k)) return { ok: false, msg: "Basic tools can't be deleted" };
    if (!state.tools[k]) return { ok: false, msg: 'Not here' };
    delete state.tools[k]; delete state.jobs[k]; delete state.queues[k]; save(); return { ok: true };
  },
  deleteRecipe(id) {
    if (!state.aiRecipes[id]) return { ok: false, msg: 'Not here' };
    delete state.aiRecipes[id]; delete state.craftJobs[id];
    for (const k in state.jobs) if (state.jobs[k] && state.jobs[k].rid === id) delete state.jobs[k];
    for (const k in state.queues) state.queues[k] = state.queues[k].filter(j => j.rid !== id);
    save(); return { ok: true }; // already-cooked dishes stay sellable (recipeBook keeps the card)
  },
  recipeCheck(id) {
    const R = state.aiRecipes[id], P = recipeParts(R);
    const tools = P.steps.map(s => ({ ...s, owned: !!(s.tool && state.tools[s.tool] && state.tools[s.tool].owned), exists: !!(s.tool && TOOLS[s.tool]) }));
    const ings = P.ings.map(g => ({ ...g, have: g.key ? kitchenQty(g.key) : 0, info: g.key ? itemInfo(g.key) : null }));
    const tool = this.recipeTool(id), plan = stepPlan(R);
    return { tools, ings, req: P.req, locked: P.locked, tool, plan, idle: !!tool && !state.jobs[tool], ok: !P.locked && !!tool && tools.every(t => t.owned) && ings.every(g => g.have >= g.qty),
      busy: !!tool && !this.toolFree(tool), job: this.craftJob(id) };
  },
  craft(id) {
    const R = state.aiRecipes[id]; if (!R) return { ok: false, msg: 'Unknown recipe' };
    const c = this.recipeCheck(id);
    if (c.busy) return { ok: false, msg: `${TOOLS[c.tool].name} is busy and its queue is full` };
    if (c.locked) return { ok: false, msg: '🔒 Create ' + c.req.filter(q => !q.ref).map(q => q.name).join(', ') + ' first' };
    if (!c.tools.every(t => t.owned)) return { ok: false, msg: 'Missing a tool' };
    if (!c.ings.every(g => g.have >= g.qty)) return { ok: false, msg: 'Missing ingredients' };
    c.ings.forEach(g => takeKitchen(g.key, g.qty));
    // every ingredient is reserved at the start (so a chain never stalls half-way); each step shows what goes in there
    const queued = this.startOrQueue(c.tool, { rid: id, step: 0, dur: c.plan[0].time * this.toolStats(c.tool).speed, out: R.out, tools: c.tools.map(t => t.tool), took: c.ings.map(g => [g.key, g.qty]) });
    save(); return { ok: true, queued, tool: c.tool };
  },
  collectCraft(id) { for (const k in state.jobs) if (state.jobs[k] && state.jobs[k].rid === id) return this.collect(k); return { ok: false }; },
  /* logistics: player taps (Send to Kitchen / Send to Market) and runners use the same move */
  send(key, from, to, n = Infinity) { const m = moveItem(key, from, to, n); if (m) save(); return m ? { ok: true, n: m } : { ok: false, msg: 'Nothing to send' }; },
  sendAll(from, to, filter = '') { let n = 0; for (const k of Object.keys(state.store[from])) if (k.startsWith(filter)) n += moveItem(k, from, to); if (n) save(); return n; },
  stock(slot, key, qty, price) {
    const cur = state.stall[slot];
    if (cur) this.unstock(slot);
    qty = Math.min(qty, qtyAt('stock', key)); if (qty <= 0) return { ok: false, msg: 'None in the Stockroom' };
    addItem(key, -qty, false, 'stock'); state.stall[slot] = { key, qty, price: Math.max(1, Math.round(price)) }; save(); return { ok: true };
  },
  setPrice(slot, price) { if (state.stall[slot]) { state.stall[slot].price = Math.max(1, Math.round(price)); save(); } },
  unstock(slot) { const s = state.stall[slot]; if (!s) return; addItem(s.key, s.qty, false, 'stock'); state.stall[slot] = null; save(); },
  marketing(k) {
    const M = MARKETING[k], t = now();
    if (k === 'bell') {
      if (t < state.mkt.bellReady) return { ok: false, msg: 'Bell cooling down' };
      state.mkt.bellReady = t + M.cooldown * 1000; Market.burst(M.burst); save(); return { ok: true };
    }
    if (state.mkt[k] > t) return { ok: false, msg: 'Already active' };
    if (state.coins < M.cost) return { ok: false, msg: 'Need ' + M.cost + '¢' };
    if (M.usesItem) {
      const s = state.stall.find(x => x && x.qty > 0); if (!s) return { ok: false, msg: 'Stock something to sample' };
      s.qty--; if (!s.qty) state.stall[state.stall.indexOf(s)] = null;
    }
    state.coins -= M.cost; state.mkt[k] = t + M.dur * 1000; save(); return { ok: true };
  },
};

/* ---------------- Market simulation ---------------- */
const Market = {
  pending: [],      // customers waiting to be animated (UI pulls these)
  activeAppeal() {
    let a = MARKETING.chalk.appeal; const t = now();
    for (const k of ['flyers', 'tasting']) if (state.mkt[k] > t) a *= MARKETING[k].appeal;
    return a;
  },
  traffic() {
    let tr = ECON.baseTraffic + MARKETING.chalk.traffic; const t = now();
    for (const k of ['flyers', 'tasting']) if (state.mkt[k] > t) tr += MARKETING[k].traffic;
    return tr;
  },
  /* perceived value & purchase chance for a stall slot */
  evaluate(slot, appealMult = 1, price) {
    const s = state.stall[slot]; if (!s) return null;
    const info = itemInfo(s.key); const nov = state.novelty[info.inv.id] ?? 1;
    const perceived = info.value * (1 + ECON.noveltyBoost * nov) * this.activeAppeal() * appealMult * (1 + 0.05 * info.inv.rarity);
    const ratio = (price ?? s.price) / perceived;
    const base = Math.pow(Math.max(0, Math.min(1, 1 - (ratio - 0.6))), ECON.priceSensitivity);
    const chance = Math.min(0.97, base * info.demand);
    return { info, perceived, ratio, chance, nov, fair: Math.round(perceived * 0.85) };
  },
  burst(n) { for (let i = 0; i < n; i++) this.spawn(i * 450); },
  spawn(delay = 0) {
    const slots = state.stall.map((s, i) => s && s.qty > 0 ? i : -1).filter(i => i >= 0);
    if (!slots.length) return;
    const slot = slots[Math.floor(Math.random() * slots.length)];
    this.pending.push({ slot, delay, seed: Math.floor(Math.random() * 1000), roll: Math.random() });
  },
  /* resolve a customer decision at a slot; returns result for UI */
  resolve(c) {
    const s = state.stall[c.slot]; if (!s || s.qty <= 0) return { bought: false, reason: 'empty' };
    const ev = this.evaluate(c.slot), price = c.price ?? s.price; // c.price: a haggled deal · c.mult: the customer's star rating · c.force: scripted first sale
    if (c.force || c.roll < Math.min(0.97, ev.chance * (c.mult ?? 1))) {
      s.qty--; state.coins += price; state.stats.sold++; state.stats.earned += price; state.stats.sinceAd++; recordSale(s.key, price);
      const id = ev.info.inv.id; state.novelty[id] = Math.max(ECON.noveltyFloor, (state.novelty[id] ?? 1) - ECON.noveltyDecayPerSale);
      state.stats.lastSale = { name: ev.info.name, price, t: now() };
      state.log.unshift(`Sold ${ev.info.name} for ${price}¢`); state.log = state.log.slice(0, 6);
      if (s.qty <= 0) state.stall[c.slot] = null;
      save();
      if (state.stats.sinceAd >= ECON.interstitialEverySales) { state.stats.sinceAd = 0; if (typeof onInterstitialDue === 'function') onInterstitialDue(); }
      return { bought: true, price, name: ev.info.name };
    }
    return { bought: false, reason: ev.ratio > 1.1 ? 'pricey' : 'meh' };
  },
  tick(dt, background = false) {
    state.mkt.acc += this.traffic() * dt;
    while (state.mkt.acc >= 1) { state.mkt.acc -= 1; this.spawn(); }
    if (!background) for (const id in state.novelty) state.novelty[id] = Math.min(1, state.novelty[id] + ECON.noveltyRecoverPerSec * dt);
  },
};
