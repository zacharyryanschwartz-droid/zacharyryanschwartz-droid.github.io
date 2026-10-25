/* ======================================================================================
   think.js — "Think It, Sell It!" core systems (logic only; UI lives in think-ui.js)
   Customers & Buzz · Weekly trends & contest · Surprise hits/flops (chemistry) · Bazaar client · XP
   Loaded after game.js. Hooks: itemInfo() is decorated (tags, Trending, Buzz, Hit/Flop, Bazaar rank),
   Market.resolve gets reactions + haggling, Game.cook rolls chemistry for new combos.
   ====================================================================================== */
const THINK_DEMAND_CAP = 2.6; // overall cap once Trending / Buzz / Cult Classic / Bazaar rank stack on top of DEMAND_STACK.cap
const PERSONAS = Object.keys(CUSTOMERS);
const FOOD_NOUNS = ['pie', 'jam', 'muffin', 'cordial', 'berry', 'pumpkin', 'toast', 'cupcake', 'soda', 'pickle', 'tart', 'cookie', 'plum', 'pancake'];
const hashStr = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = (arr, n) => arr[Math.abs(n | 0) % arr.length];

function thinkState(s) { // new fields on every save (old saves too)
  s.buzz = s.buzz || {}; s.feed = s.feed || []; s.wishes = s.wishes || []; s.reactCache = s.reactCache || {};
  s.discoveries = s.discoveries || {}; s.hints = s.hints || []; s.trophies = s.trophies || []; s.xp = s.xp || 0;
  s.week = s.week || { n: 1, t0: now(), entry: null, history: [] };
  s.published = s.published || {}; s.bzRank = s.bzRank || {}; s.bzCache = s.bzCache || [];
  if (s.onb === undefined) s.onb = s.seenTitle ? 'done' : 0; // existing players skip the first-run tour
  return s;
}

/* ---------------- tags ---------------- */
const _baseItemInfo = itemInfo;
const Think = {
  forceNext: null,  // dev/test hook: 'hit' | 'flop' | 'normal' for the next new combo
  _tags: new Map(),
  tagsOf(key) {
    const rc = state.reactCache[key], ck = key + '|' + (rc && rc.tags ? rc.tags.join(',') : '') + '|' + (state.discoveries[key] ? 1 : 0);
    if (this._tags.has(ck)) return this._tags.get(ck);
    const info = _baseItemInfo(key); const T = new Set(); if (!info) return T;
    const add = a => (a || []).forEach(t => T.add(t));
    const text = [], inv = info.inv || {};
    const fromInv = v => { if (!v) return; text.push(v.name, v.desc, v.prompt, ...(v.tags || [])); add(TRAIT_TAGS[v.trait]); add(BASE_TAGS[v.base]); if (v.source === 'ai') T.add('ai'); };
    if (info.kind === 'craft') { const R = info.recipe; text.push(R.name, R.desc, R.prompt, ...(R.tags || [])); add(RECIPE_TAGS[R.form]); T.add('ai'); if (R.ingredients.length > 1) T.add('combo'); }
    else { fromInv(inv); if (info.recipe) { add(RECIPE_TAGS[info.recipe]); text.push(RECIPES[info.recipe].name); } }
    if (info.combo) { T.add('combo'); info.combo.forEach(x => { fromInv(x.inv); if (x.recipe) add(RECIPE_TAGS[x.recipe]); }); }
    const low = text.filter(Boolean).join(' ').toLowerCase();
    for (const t in TAG_RULES) if (TAG_RULES[t].test(low)) T.add(t);
    if (rc && rc.tags) add(rc.tags);
    const d = state.discoveries[key]; if (d && d.outcome !== 'normal') T.add('weird');
    if (!T.has('ai') && !T.has('weird') && !T.has('combo')) T.add('classic');
    if (T.size <= 3 && T.has('classic')) T.add('plain');
    this._tags.set(ck, T); return T;
  },
  trend() { return TRENDS[(state.week.n - 1) % TRENDS.length]; },
  nextTrend() { return TRENDS[state.week.n % TRENDS.length]; },
  trending(key) { const T = this.tagsOf(key); return this.trend().tags.some(t => T.has(t)); },
  buzz(key) { const b = state.buzz[key]; if (!b || !b.recent.length) return { n: 0, avg: 0, score: 0 };
    const avg = b.recent.reduce((a, x) => a + x, 0) / b.recent.length; return { n: b.n, avg, score: Math.round(avg * 20) }; },
  buzzMult(key) { const b = this.buzz(key); return b.n < 2 ? 1 : +(1 + (b.avg - 3) * 0.12).toFixed(2); },
  bzEntryFor(info) { if (!info || info.kind !== 'crop') return null; return info.inv.bazaar ? info.inv.bazaar.id : state.published[info.inv.id] || null; },
  rankBonus(info) { const id = this.bzEntryFor(info); const r = id && state.bzRank[id]; return r ? r : null; },
  /* every itemInfo() result passes through here: the new multipliers stack on the old demand, under one cap */
  decorate(info) {
    const key = info.key, d = state.discoveries[key], parts = [];
    if (d && d.outcome === 'hit') parts.push(['Cult Classic', CHEM_RULES.hitDemand]);
    if (d && d.outcome === 'flop') parts.push(['Flop', CHEM_RULES.flopDemand]);
    if (d && d.name) info.name = d.name;
    info.discovery = d && d.outcome !== 'normal' ? d : null;
    info.trending = this.trending(key); if (info.trending) parts.push(['Trending', TREND_RULES.demandBonus]);
    const bm = this.buzzMult(key); info.buzz = this.buzz(key); if (bm !== 1) parts.push([`Buzz ★${info.buzz.avg.toFixed(1)}`, bm]);
    const rb = this.rankBonus(info); info.rank = rb; if (rb && rb.bonus) parts.push([`Bazaar #${rb.rank}`, +(1 + rb.bonus).toFixed(2)]);
    if (parts.length) {
      const raw = parts.reduce((a, p) => a * p[1], info.demand);
      info.ds = { ...info.ds, parts: [...info.ds.parts, ...parts], raw: +raw.toFixed(3), capped: info.ds.capped || raw > THINK_DEMAND_CAP };
      info.demand = info.ds.demand = Math.round(Math.min(THINK_DEMAND_CAP, raw) * 100) / 100;
    }
    return info;
  },
  /* ---------------- XP ---------------- */
  addXP(n) { const lv = this.level(); state.xp += n; return this.level() > lv; },
  level() { return BazaarCore.levelOf(state.xp); },
  xpToNext() { const L = this.level(); return 20 * L * L - state.xp; },

  /* ---------------- customers ---------------- */
  persona(seed) { return PERSONAS[seed % PERSONAS.length]; },
  bestPersona(key) { let best = PERSONAS[0], bs = -9; for (const p of PERSONAS) { const s = this.react(p, key, 0.5, true).raw; if (s > bs) { bs = s; best = p; } } return best; },
  react(pid, key, roll = Math.random(), dry = false) {
    const P = CUSTOMERS[pid], info = itemInfo(key); if (!info) return null;
    const T = this.tagsOf(key), d = state.discoveries[key];
    const likes = P.likes.filter(t => t === 'trend' ? info.trending : T.has(t)), dislikes = P.dislikes.filter(t => T.has(t));
    const weird = T.has('weird') || T.has('ai') || T.has('combo');
    let raw = 3 + P.bias + 0.8 * likes.length - 0.9 * dislikes.length + (weird ? P.curious * 0.8 : 0) + (info.buzz.n ? (info.buzz.avg - 3) * 0.2 : 0)
      + (d && d.outcome === 'hit' ? 1.3 : 0) + (d && d.outcome === 'flop' ? -2.4 : 0);
    const stars = Math.max(1, Math.min(5, Math.round(raw + (roll - 0.5) * 1.3)));
    if (dry) return { raw };
    const band = stars >= 4 ? 'love' : stars === 3 ? 'unsure' : 'dislike';
    const mood = d && d.outcome === 'flop' ? 'gag' : band === 'love' ? 'delight' : band === 'unsure' ? (weird ? 'curious' : 'confused') : stars === 1 ? 'disgust' : 'meh';
    const salient = [...likes, ...dislikes].find(t => t !== 'trend') || [...T].find(t => TAG_WORD[t] && !['classic', 'plain', 'ai', 'combo'].includes(t)) || 'classic';
    return { pid, key, stars, band, mood, line: this.line(pid, key, info, band, mood, salient, roll), likes, dislikes, name: info.name };
  },
  line(pid, key, info, band, mood, tag, roll) {
    const rc = state.reactCache[key], n = shortName(info.name), tw = TAG_WORD[tag] || tag, d = state.discoveries[key];
    if (mood === 'gag') return d && d.gag && roll < 0.5 ? d.gag : pick(GAGS, Math.floor(roll * 97)).replace('{n}', n);
    const ai = rc && rc.lines && rc.lines[pid] && rc.lines[pid][band]; if (ai) return ai;
    return pick(REACTION_LINES[pid][band], Math.floor(roll * 31)).replace(/\{n\}/g, n).replace(/\{t\}/g, tw);
  },
  wishFor(pid, key) {
    const P = CUSTOMERS[pid], rc = state.reactCache[key];
    if (rc && rc.wish && Math.random() < 0.6) return rc.wish.replace(/^(i wish (someone made )?)/i, '');
    const likes = P.likes.map(t => t === 'trend' ? this.trend().tags[0] : t).filter(t => TAG_WORD[t] && t !== 'classic');
    const adj = TAG_WORD[pick(likes.length ? likes : ['weird'], Math.floor(Math.random() * 9))].replace(/-y$/, '');
    const noun = pick(FOOD_NOUNS.filter(f => !String(itemInfo(key).name).toLowerCase().includes(f)), Math.floor(Math.random() * 99));
    return `a ${adj} ${noun}`;
  },
  record(r, opts = {}) {
    const b = state.buzz[r.key] || (state.buzz[r.key] = { n: 0, sum: 0, recent: [] });
    b.n++; b.sum += r.stars; b.recent.push(r.stars); { const l = locStat(r.key); l.rn++; l.rsum += r.stars; } if (b.recent.length > 12) b.recent.shift();
    const e = { pid: r.pid, key: r.key, name: r.name, stars: r.stars, line: r.line, mood: r.mood, t: now(), bought: opts.bought, price: opts.price };
    if (opts.wish) { e.wish = opts.wish; if (!state.wishes.some(w => w.text === opts.wish)) { state.wishes.unshift({ text: opts.wish, who: r.pid, t: now() }); state.wishes = state.wishes.slice(0, 8); } }
    state.feed.unshift(e); state.feed = state.feed.slice(0, 12);
  },
  /* AI flavour (live server only): one cheap batched text call per item, cached in the save. Never costs the player a credit. */
  _inflight: {},
  ensureLines(key) {
    if (!AIBackend.online || !(AIBackend.info && AIBackend.info.reactions) || state.reactCache[key] || this._inflight[key]) return;
    const info = _baseItemInfo(key); if (!info) return;
    this._inflight[key] = 1;
    const desc = info.kind === 'craft' ? info.recipe.desc : info.inv.desc || '';
    AIBackend.post('api/reactions', { item: { name: (state.discoveries[key] && state.discoveries[key].name) || info.name, desc, tags: [...this.tagsOf(key)], kind: info.kind } }).then(r => {
      delete this._inflight[key];
      if (r && !r.error) { state.reactCache[key] = { lines: r.lines, tags: (r.tags || []).filter(t => TAG_RULES[t]), wish: r.wish, usd: r.meta && r.meta.usd ? r.meta.usd.total : null }; this._tags.clear(); save(); }
      else state.reactCache[key] = { failed: r && r.code, t: now() }; // fall back to templates; don't retry every visit
    });
  },
  /* ---------------- haggling ---------------- */
  haggle: null, // { c, pid, key, slot, offer, round, max, ask, t0 }
  wantsHaggle(pid, r, ev) {
    const P = CUSTOMERS[pid]; if (r.stars < 3) return false;
    return Math.random() < P.haggle + Math.max(0, ev.ratio - 0.9) * 0.6;
  },
  startHaggle(c, pid, r, ev) {
    const s = state.stall[c.slot], max = Math.max(1, Math.round(ev.perceived * (0.7 + 0.08 * r.stars)));
    const offer = Math.max(1, Math.min(s.price - 1, Math.round(Math.min(max, s.price) * (0.72 + Math.random() * 0.12))));
    this.haggle = { slot: c.slot, key: s.key, pid, offer, round: 1, max: Math.max(offer, max), ask: s.price, t0: now(), stars: r.stars, status: 'open' };
    return this.haggle;
  },
  haggleAccept(price) {
    const h = this.haggle; if (!h) return { ok: false };
    const s = state.stall[h.slot]; if (!s || s.key !== h.key || s.qty <= 0) { this.haggle = null; return { ok: false, msg: 'Sold out already' }; }
    const res = Market.resolve({ slot: h.slot, roll: 0, force: true, price, quiet: true }); this.haggle = null; return { ok: res.bought, price, res };
  },
  haggleCounter() { // player meets them in the middle; up to 2 rounds
    const h = this.haggle; if (!h) return { ok: false };
    const ask = Math.round((h.offer + h.ask) / 2);
    if (ask <= h.max && Math.random() < 0.75) { const r = this.haggleAccept(ask); return { ...r, outcome: 'accepted', price: ask }; }
    if (h.round >= 2) { this.haggle = null; return { ok: false, outcome: 'walked' }; }
    h.round++; h.offer = Math.min(ask - 1, Math.round((h.offer + h.max) / 2)); h.ask = ask; return { ok: false, outcome: 'recounter', offer: h.offer };
  },
  haggleDecline() { this.haggle = null; },

  /* ---------------- weekly trend + contest ---------------- */
  rivals(n = state.week.n) {
    const tr = TRENDS[(n - 1) % TRENDS.length];
    return CONTEST.rivals.map((who, i) => { const h = hashStr(who + n);
      const idea = i < tr.prompts.length ? tr.prompts[(i + n) % tr.prompts.length].replace(/^an? /, '') : `${tr.name.split(' ')[0]} surprise ${FOOD_NOUNS[h % FOOD_NOUNS.length]}`;
      return { who, entry: PromptStub.title(idea).replace(/\b\w/g, m => m.toUpperCase()), score: 30 + (h % 52), sample: true }; });
  },
  contestScore(key) {
    const W = CONTEST.weights, b = this.buzz(key), st = state.itemStats[key] || { sold: 0 }, d = state.discoveries[key];
    const parts = { buzz: Math.round(W.buzz * (b.n ? b.avg / 5 : 0)), ratings: Math.round(W.ratings * Math.min(1, b.n / CONTEST.ratingsFull)),
      sales: Math.round(W.sales * Math.min(1, (st.sold || 0) / CONTEST.salesFull)), trend: this.trending(key) ? W.trend : 0 };
    if (d && d.outcome === 'hit') parts.cult = 5;
    return { parts, total: Math.min(100, Object.values(parts).reduce((a, x) => a + x, 0)) };
  },
  submitEntry(key) { if (!itemInfo(key)) return { ok: false, msg: 'Unknown item' }; state.week.entry = { key, name: itemInfo(key).name, t: now() }; save(); return { ok: true }; },
  advanceWeek() {
    const w = state.week, tr = this.trend(); let result = null;
    if (w.entry) {
      const me = { who: 'You', entry: w.entry.name, key: w.entry.key, ...this.contestScore(w.entry.key) };
      const board = [...this.rivals().map(r => ({ ...r, total: r.score })), { ...me, you: true }].sort((a, b) => b.total - a.total);
      const place = board.findIndex(x => x.you) + 1, prize = CONTEST.prizes.find(p => place <= p.place);
      state.coins += prize.coins; state.trophies.unshift({ award: prize.award, label: prize.label, week: w.n, trend: tr.name, item: w.entry.name, place });
      this.addXP(place === 1 ? 40 : place <= 3 ? 25 : 10);
      result = { week: w.n, trend: tr, board, place, prize, me };
    }
    w.history.unshift(result || { week: w.n, trend: tr, skipped: true }); w.history = w.history.slice(0, 8);
    w.n++; w.t0 = now(); w.entry = null; this._tags.clear(); save();
    return result || { week: w.n - 1, trend: tr, skipped: true };
  },
  checkWeek() { if (now() - state.week.t0 >= TREND_RULES.weekMs) return this.advanceWeek(); return null; },

  /* ---------------- chemistry: surprise hits & flops ---------------- */
  ingredientTags(job) {
    const main = state.inventions[job.id], sets = [], names = [];
    const tagInv = (v, r) => { const T = new Set([...(TRAIT_TAGS[v.trait] || []), ...(BASE_TAGS[v.base] || []), ...(r ? RECIPE_TAGS[r] || [] : [])]);
      const low = [v.name, v.desc, v.prompt, ...(v.tags || [])].filter(Boolean).join(' ').toLowerCase(); for (const t in TAG_RULES) if (TAG_RULES[t].test(low)) T.add(t); return T; };
    sets.push(tagInv(main, job.recipe)); names.push(main.stem);
    comboDec(job.combo).forEach(x => { sets.push(tagInv(x.inv, x.recipe)); names.push(x.inv.stem + (x.recipe ? ' ' + RECIPES[x.recipe].name : '')); });
    return { sets, names };
  },
  chem(job) {
    const { sets, names } = this.ingredientTags(job); let chem = 0, best = null, worst = null;
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) for (const a of sets[i]) for (const b of sets[j]) {
      if (a === b) continue; const k = [a, b].sort().join('+'), v = CHEMISTRY[k]; if (!v) continue;
      chem += v; if (!best || v > best.v) best = { k, v }; if (!worst || v < worst.v) worst = { k, v }; }
    const fam = new Set(sets.flatMap(s => [...s])); const odd = Math.max(0, fam.size - 4) + (fam.has('weird') ? 1 : 0);
    const C = CHEM_RULES;
    const pHit = Math.min(C.maxP, C.hitBase + C.hitPerChem * Math.max(0, chem) + C.perOdd * odd), pFlop = Math.min(C.maxP, C.flopBase + C.flopPerChem * Math.max(0, -chem) + C.perOdd * odd);
    return { chem: +chem.toFixed(2), odd, pHit: +pHit.toFixed(2), pFlop: +pFlop.toFixed(2), best, worst, names };
  },
  discover(job) {
    const key = Game.jobKey(job); if (!job.combo || state.discoveries[key]) return null;
    const c = this.chem(job), r = Math.random();
    const outcome = this.forceNext || (r < c.pHit ? 'hit' : r < c.pHit + c.pFlop ? 'flop' : 'normal'); this.forceNext = null;
    const base = _baseItemInfo(key), short = c.names.map(n => n.split(' ').pop()).join('-'), rn = RECIPES[job.recipe].name;
    const d = { key, outcome, chem: c.chem, odd: c.odd, pHit: c.pHit, pFlop: c.pFlop, ingredients: c.names, recipe: job.recipe, t: now(),
      name: outcome === 'hit' ? `Cult Classic ${short} ${rn}`.slice(0, 34) : outcome === 'flop' ? `Oops-a-Daisy ${short} ${rn}`.slice(0, 34) : base.name,
      desc: outcome === 'hit' ? `Nobody expected ${c.names.join(' + ')} to work. Now everyone wants it.` : outcome === 'flop' ? `${c.names.join(' + ')}… bravely combined. Very bravely.` : '',
      gag: outcome === 'flop' ? pick(GAGS, hashStr(key)).replace('{n}', short) : '' };
    state.discoveries[key] = d;
    if (outcome === 'hit') { this.addXP(CHEM_RULES.hitXP); state.buzz[key] = { n: 2, sum: 10, recent: [5, 5] }; }
    if (outcome === 'flop') { this.addXP(CHEM_RULES.flopXP); state.coins += CHEM_RULES.flopCoins; }
    if (outcome !== 'normal') this.addHints(d, outcome === 'hit' ? c.best : c.worst);
    this._tags.clear(); save();
    if (outcome !== 'normal' && AIBackend.online && AIBackend.info && AIBackend.info.reactions) // AI names the discovery (free, cached on the server)
      AIBackend.post('api/combo', { ingredients: c.names, recipe: rn, outcome }).then(x => { if (x && !x.error && x.name) { Object.assign(d, { name: x.name, desc: x.description || d.desc, gag: x.gag || d.gag, ai: true }); save(); if (typeof onDiscoveryUpdated === 'function') onDiscoveryUpdated(d); } });
    return d;
  },
  addHints(d, pair) {
    const nice = k => k.split('+').map(t => TAG_WORD[t] || t).join(' + ');
    if (pair) state.hints.unshift({ text: d.outcome === 'hit' ? `✨ ${nice(pair.k)} = crowd-pleaser` : `😬 ${nice(pair.k)}: never again`, pair: pair.k, good: d.outcome === 'hit', t: now() });
    if (d.outcome === 'flop') { // consolation: a hidden good pair you haven't found yet
      const known = new Set(state.hints.map(h => h.pair)), good = Object.keys(CHEMISTRY).filter(k => CHEMISTRY[k] > 0 && !known.has(k));
      if (good.length) { const k = pick(good, hashStr(d.key)); state.hints.unshift({ text: `🔍 Professor Fig suspects ${nice(k)} could be magic`, pair: k, good: true, tip: true, t: now() }); }
    }
    state.hints = state.hints.slice(0, 10);
  },

  /* ---------------- Workshop inspiration (every loop feeds back into inventing) ---------------- */
  inspirations() {
    const out = [], tr = this.trend();
    state.wishes.slice(0, 2).forEach(w => out.push({ kind: 'wish', icon: '💬', who: CUSTOMERS[w.who] ? CUSTOMERS[w.who].name : 'A customer', text: w.text, prompt: w.text.replace(/^an? /, '') }));
    tr.prompts.slice(0, 2).forEach(p => out.push({ kind: 'trend', icon: tr.emoji, who: 'This week: ' + tr.name, text: p, prompt: p }));
    state.hints.slice(0, 1).forEach(h => { const [a, b] = h.pair.split('+'); out.push({ kind: 'hint', icon: h.good ? '🧪' : '😬', who: h.tip ? 'Combo tip' : 'Chemistry hint', text: h.text, prompt: h.good ? `a ${TAG_WORD[a] || a} ${TAG_WORD[b] || b} ${pick(FOOD_NOUNS, hashStr(h.pair))}` : '', kitchen: true }); });
    (state.bzCache || []).filter(x => !x.mine).slice(0, 2).forEach(x => out.push({ kind: 'remix', icon: '🎪', who: 'Bazaar · ' + x.creator, text: x.name, prompt: `my twist on ${x.name.toLowerCase()}`, bz: x.id }));
    const fresh = state.wishes[2]; if (fresh) out.push({ kind: 'wish', icon: '💬', who: CUSTOMERS[fresh.who] ? CUSTOMERS[fresh.who].name : 'A customer', text: fresh.text, prompt: fresh.text.replace(/^an? /, '') });
    if (out.length < 4) ['a cactus that grows tiny umbrellas', 'a giggling pumpkin', 'berries that taste like birthday cake'].forEach(p => out.push({ kind: 'spark', icon: '💡', who: 'Spark', text: p, prompt: p }));
    return out;
  },
  /* the shelf: everything you invented, with buzz + badges */
  shelf() {
    const keys = [];
    state.order.filter(id => state.inventions[id] && !isBasicCrop(id)).forEach(id => keys.push('c|' + id));
    Object.keys(state.aiRecipes).forEach(id => keys.push('r|' + id));
    Object.keys(state.discoveries).filter(k => state.discoveries[k].outcome !== 'normal').forEach(k => keys.push(k));
    return [...new Set(keys)].map(k => itemInfo(k)).filter(Boolean);
  },
};
/* decorate every itemInfo() call (game.js calls the global binding, so this covers the whole game) */
itemInfo = function (key) { const i = _baseItemInfo(key); return i ? Think.decorate(i) : i; };
const shortName = n => { const w = String(n).split(' '); return w.length > 3 ? w.slice(-3).join(' ') : n; };

/* reaction templates (offline / before the AI lines arrive). {n} = item, {t} = the tag that drove the reaction */
const REACTION_LINES = {
  pam: { love: ['Oh. {n}. Finally, some taste.', 'A {t} {n}? …I approve. Quietly.', 'Wrap the {n}, please. Carefully.'],
         unsure: ['{n}? I suppose it is… {t}.', 'Hmm. The {n} is acceptable-ish.', "I'll allow the {n}. Barely."],
         dislike: ['{t}? On a {n}? Disgraceful.', 'No. The {n} is simply not for me.', 'Who approved this {n}?'] },
  ollie: { love: ['{n}! Now THAT takes me back!', "Ho ho! A {t} {n}? I'll take two!", 'My Martha would have loved this {n}.'],
           unsure: ["In my day {n} wasn't {t}…", 'What in the barnyard is a {n}?', "Is the {n} supposed to look like that?"],
           dislike: ['A {t} {n}? Kids these days…', "I'll stick to plain turnips, thanks.", 'Hmph. {n}. Hmph!'] },
  tia: { love: ['{n} is SO this week ✨', 'Omg a {t} {n}? Posting this NOW.', 'Obsessed with the {n}. Iconic.'],
         unsure: ['{n}… is it ironic? I can\'t tell.', 'Kinda giving {t}? Maybe?', 'The {n} could trend. Or not.'],
         dislike: ['{n} is giving last season.', 'Not the {t} {n}. No.', 'Hard pass on the {n}, babe.'] },
  max: { love: ['WHOA! A {t} {n}!! MOM!!', 'Best. {n}. EVER.', 'Can I have ALL the {n}?'],
         unsure: ['Does the {n} bite? Can I poke it?', 'Is {n} candy or a vegetable?', 'Ooh, {t}! …wait, is it gross?'],
         dislike: ['Ewww, {t}! That {n} looks like homework.', 'Bleh. {n} is a grown-up food.', 'Nope nope nope, no {n}.'] },
  rosa: { love: ["{n}: chef's kiss. Seriously.", 'A {t} {n}! I have ideas already.', 'This {n} belongs on my menu.'],
          unsure: ['The {n} needs a pinch of something.', 'Interesting {t} choice on the {n}.', 'Hm. {n}. Could be a starter.'],
          dislike: ['That {n} would ruin my soup.', '{t}? Wrong pairing, darling.', "I wouldn't serve the {n} to a raccoon."] },
  fig: { love: ['Remarkable! A {t} {n}! Science!', 'Fascinating {n}. I must document this.', 'The {n} defies botany. Delightful.'],
         unsure: ['Curious. Why is the {n} {t}?', 'The {n} warrants further study.', 'Hypothesis: the {n} is… edible?'],
         dislike: ['The {n} was a brave experiment.', 'Inconclusive. Also, unpleasant.', 'A {t} {n}. Noted. Avoided.'] },
};
const GAGS = ['It tastes like a sock remembered being a sandwich.', 'My tongue just filed a complaint.', 'Is the {n} supposed to fizz… inside me?',
  "I've been betrayed by a {n}.", 'Bold. Wrong, but bold.', 'My spoon is melting, is that normal?', 'It whispered "sorry" as I ate it.'];

/* ---------------- Bazaar client: server JSON store, localStorage fallback (same rules via BazaarCore) ---------------- */
const Bazaar = {
  get server() { return !!(AIBackend.info && AIBackend.info.bazaar); },
  player() {
    let p = null; try { p = JSON.parse(localStorage.getItem('mp_player')); } catch (e) {}
    if (!p || !p.id) { p = { id: 'p_' + Math.random().toString(36).slice(2, 10), name: 'Inventor-' + Math.floor(1000 + Math.random() * 9000) }; localStorage.setItem('mp_player', JSON.stringify(p)); }
    return { ...p, xp: state.xp };
  },
  _db() { let db = null; try { db = JSON.parse(localStorage.getItem('mp_bazaar')); } catch (e) {} return db && db.v ? db : BazaarCore.newDB(Date.now()); },
  _put(db) { localStorage.setItem('mp_bazaar', JSON.stringify(db)); },
  _moderate(text) { const w = PromptStub.norm(text).split(' ').map(x => PromptStub.singular(x)); return w.some(x => AI_KEYWORDS.blocked.includes(x)) ? "Let's keep it cozy and original. Nothing was published." : null; },
  async call(op, body = {}) {
    const P = this.player();
    if (this.server) {
      try { const r = await fetch(op === 'list' ? 'api/bazaar?player=' + encodeURIComponent(P.id) : 'api/bazaar/' + op, op === 'list' ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, player: P }) });
        const j = await r.json(); if (j.items) this.absorb(j.items); return r.ok ? j : { error: j.error || 'Bazaar error ' + r.status, code: j.code }; }
      catch (e) { return { error: "Can't reach the Bazaar server", code: 'network' }; }
    }
    const db = this._db(), t = Date.now(); let r;
    if (op === 'list') { BazaarCore.simulate(db, t); r = { ok: true }; }
    else if (op === 'publish') r = BazaarCore.publish(db, P, body, t, x => this._moderate(x));
    else if (op === 'vote') r = BazaarCore.vote(db, P, body.id, body.v, t);
    else if (op === 'buy') r = BazaarCore.buy(db, P, body.id, t);
    else if (op === 'claim') r = BazaarCore.claim(db, P);
    else if (op === 'copy') r = BazaarCore.copy(db, body.id);
    else if (op === 'report') { const it = db.items.find(x => x.id === body.id); if (it) it.hidden = true; r = { ok: true }; }
    if (r && r.error) return r;
    this._put(db); const items = BazaarCore.view(db, t, P); this.absorb(items); return { ...r, items };
  },
  absorb(items) { // cache the list + the market-wide rank bonus of every crop entry
    state.bzCache = items.map(x => ({ id: x.id, name: x.name, creator: x.creator, mine: x.mine, kind: x.kind }));
    state.bzRank = Object.fromEntries(items.filter(x => x.kind === 'crop').map(x => [x.id, { rank: x.rank, bonus: x.bonus, score: x.score, voters: x.voters }]));
    this.items = items; this.t = now();
  },
  items: [],
  async list() { return this.call('list'); },
  packOf(key) { // item -> publishable payload
    const info = itemInfo(key); if (!info) return null;
    if (info.kind === 'crop') { const v = info.inv; return { kind: 'crop', name: v.name, desc: v.desc, payload: { base: v.base, trait: v.trait, name: v.name, stem: v.stem, color: v.color || cropColor(v), growTime: v.growTime, yield: v.yield, baseValue: v.baseValue, tags: [...Think.tagsOf(key)].filter(t => TAG_WORD[t]).slice(0, 4), stages: v.stages, imageUrl: v.imageUrl } }; }
    if (info.kind === 'craft') { const R = info.recipe, P = recipeParts(R);
      return { kind: 'recipe', name: R.name, desc: R.desc, payload: { form: R.form, stars: R.stars, value: R.value, craftTime: R.craftTime, imageUrl: R.imageUrl, tags: [...Think.tagsOf(key)].filter(t => TAG_WORD[t]).slice(0, 4),
        ingredients: P.ings.map(g => ({ name: g.key ? (state.inventions[g.key.split('|')[1]] || {}).stem || 'Plum' : g.req.name, qty: g.qty })),
        steps: stepPlan(R).map(s => ({ tool: s.tool && TOOLS[s.tool] ? TOOLS[s.tool].name : s.req ? s.req.name : 'Cookpot', action: s.action, time: s.time, adds: s.adds, makes: s.makes })) } }; }
    return null;
  },
  packTool(k) { const T = TOOLS[k]; return { kind: 'tool', name: T.name, desc: T.desc, payload: { recipes: T.recipes, art: T.art, hue: T.hue, speedMult: T.speedMult, bonusOut: T.bonusOut, imageUrl: T.imageUrl } }; },
  async publish(ref, price, pitch) {
    const pack = ref.startsWith('t:') ? this.packTool(ref.slice(2)) : this.packOf(ref); if (!pack) return { error: 'Nothing to publish' };
    const r = await this.call('publish', { ...pack, price, pitch });
    if (r.ok) { if (ref.startsWith('c|')) state.published[ref.slice(2)] = r.id; Think.addXP(5); save(); }
    return r;
  },
  async vote(id, v) { return this.call('vote', { id, v }); },
  async buy(id) {
    const it = this.items.find(x => x.id === id); if (!it) return { error: 'Not found' };
    if (!(it.kind === 'crop' ? state.order.includes('bz_' + it.id) : it.kind === 'tool' ? state.tools['bz_' + it.id] : state.aiRecipes['bz_' + it.id])) { const sb = Slots.block(it.kind); if (sb) return { error: sb.msg, full: it.kind }; }
    if (state.coins < it.price) return { error: `Need ${it.price}¢` };
    const r = await this.call('buy', { id }); if (!r.ok) return r;
    state.coins -= r.price; const got = this.apply(r.item); save(); return { ...r, got };
  },
  apply(it) { // what the buyer receives
    const p = it.payload, id = 'bz_' + it.id;
    if (it.kind === 'crop') {
      const inv = Inventor.procedural(p.base, p.trait, BAZAAR_RULES.buyerGetsAIBonus ? 'ai' : 'basic'); // bought crops never carry the creator's AI-quality bonus
      Object.assign(inv, { id, name: p.name, stem: p.stem, desc: it.desc, color: p.color, growTime: p.growTime, yield: p.yield, baseValue: p.baseValue, tags: p.tags, imageUrl: p.imageUrl, stages: p.stages || defaultStages(id), bazaar: { id: it.id, creator: it.creator } });
      state.inventions[id] = inv; if (!state.order.includes(id)) state.order.unshift(id); state.novelty[id] = 1; addItem('c|' + id, 2);
      return { kind: 'crop', key: 'c|' + id, name: inv.name };
    }
    if (it.kind === 'tool') {
      const T = { key: id, name: it.name, desc: it.desc, source: 'basic', recipes: p.recipes, art: p.art, hue: p.hue, speedMult: p.speedMult, bonusOut: p.bonusOut, imageUrl: p.imageUrl, owned: true, bazaar: { id: it.id, creator: it.creator } };
      state.aiTools[id] = T; TOOLS[id] = T; state.tools[id] = { owned: true, level: 1 }; return { kind: 'tool', key: id, name: T.name };
    }
    const requires = [], need = (kind, name) => { let i = requires.findIndex(q => q.kind === kind && q.name === name); if (i < 0) { i = requires.length; requires.push({ kind, name, idea: name }); } return i; };
    const R = { id, type: 'recipe', source: 'ai', name: it.name, desc: it.desc, form: p.form, stars: p.stars, value: p.value, craftTime: p.craftTime, out: 2, imageUrl: p.imageUrl, tags: p.tags, prompt: `Bazaar recipe card by ${it.creator}`,
      ingredients: p.ingredients.map(g => ({ need: need('crop', g.name), qty: g.qty })), steps: p.steps.map((s, i) => ({ need: need('tool', s.tool), action: s.action, time: s.time, adds: s.adds, makes: i < p.steps.length - 1 ? s.makes : undefined })), requires, mainId: null, bazaar: { id: it.id, creator: it.creator } };
    R.demand = recipeDemand(R).demand; state.aiRecipes[id] = R; state.recipeBook[id] = R; state.novelty[id] = 1;
    return { kind: 'recipe', key: 'r|' + id, name: R.name, rid: id };
  },
};

/* ---------------- hooks into game.js ---------------- */
{ // cooking a NEW combo rolls the hidden chemistry
  const cook = Game.cook.bind(Game);
  Game.cook = function (toolKey, recipe, id, extras = []) { const r = cook(toolKey, recipe, id, extras); if (r.ok) { const d = Think.discover(r.job || state.jobs[toolKey]); if (d) r.discovery = d; } return r; };
  const inv = Game.invent.bind(Game); Game.invent = function (...a) { const r = inv(...a); if (r.ok) Think.addXP(5); return r; };
  const ai = Game.aiInvent.bind(Game); Game.aiInvent = async function (...a) { const r = await ai(...a); if (r.ok) Think.addXP(10); return r; };
  const at = Game.aiTool.bind(Game); Game.aiTool = async function (...a) { const r = await at(...a); if (r.ok) Think.addXP(10); return r; };
  const ar = Game.aiRecipe.bind(Game); Game.aiRecipe = async function (...a) { const r = await ar(...a); if (r.ok) Think.addXP(10); return r; };
  const stock = Game.stock.bind(Game); Game.stock = function (slot, key, ...a) { const r = stock(slot, key, ...a); if (r.ok) Think.ensureLines(key); return r; };
}
{ // every visible customer is a named character who rates the item; ratings feed Buzz; some haggle
  const STAR_MULT = { 1: 0.25, 2: 0.55, 3: 0.9, 4: 1.15, 5: 1.35 };
  const resolve = Market.resolve.bind(Market);
  Market.resolve = function (c) {
    const s = state.stall[c.slot];
    if (c.quiet || c.background || !s || s.qty <= 0) return resolve(c);
    const key = s.key, pid = c.persona || (c.persona = Think.persona(c.seed));
    const r = Think.react(pid, key, c.roll2 ?? Math.random()); if (!r) return resolve(c);
    const ev = this.evaluate(c.slot);
    if (c.interactive && !c.force && !Think.haggle && Think.wantsHaggle(pid, r, ev)) {
      const h = Think.startHaggle(c, pid, r, ev); Think.record(r, { haggle: true }); return { haggle: true, offer: h.offer, react: r, pid };
    }
    const res = resolve({ ...c, mult: STAR_MULT[r.stars] });
    const wish = (!res.bought && Math.random() < 0.45) || Math.random() < 0.15 || c.force ? Think.wishFor(pid, key) : null;
    Think.record(r, { bought: res.bought, price: res.price, wish });
    if (res.bought && (state.itemStats[key] || {}).sold === 1) Think.addXP(3); // first sale of anything
    Think.ensureLines(key);
    return { ...res, react: r, pid, wish };
  };
}
