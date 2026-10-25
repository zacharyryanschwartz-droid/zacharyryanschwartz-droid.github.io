/* Bazaar core: pure rules shared by the Node server (server/server.js loads this file) and the offline
   localStorage fallback in the browser. Every limit comes from BAZAAR_RULES in data.js. */
const BazaarCore = (() => {
  const DAY = 86400000, WEEK = 7 * DAY;
  const R = () => BAZAAR_RULES;
  const clean = (s, max) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : a));
  const dayKey = t => Math.floor(t / DAY), weekKey = t => Math.floor(t / WEEK);
  const levelOf = xp => 1 + Math.floor(Math.sqrt(Math.max(0, xp || 0) / 20));
  const IMG = /^img\/ai\/(generated\/)?[\w.-]+\.(png|webp|jpe?g)$/;

  function newDB(now) {
    const items = BAZAAR_SAMPLES.map((s, n) => {
      const votes = {}; // sample voters, spread over the last ~10 days so decay is visible
      for (let i = 0; i < s.votes; i++) votes['sample:voter' + i] = { v: 1, t: now - ((i * 37 + n * 11) % 10) * DAY - i * 3600000 };
      for (let i = 0; i < s.down; i++) votes['sample:critic' + i] = { v: -1, t: now - ((i * 23 + n * 5) % 8) * DAY };
      return { ...JSON.parse(JSON.stringify(s)), votes, sample: true, creatorId: 'sample:' + s.creator, createdAt: now - (10 - n) * DAY,
        sold: {}, buys: 0, copies: 0, royaltyPending: 0, activity: [] };
    });
    return { v: 1, items, ledger: {}, lastSim: now };
  }
  function scoreOf(it, now) {
    let up = 0, down = 0, voters = 0; const hl = R().voteHalfLifeDays * DAY;
    for (const k in it.votes || {}) { const x = it.votes[k], w = Math.pow(0.5, Math.max(0, now - x.t) / hl); voters++; if (x.v > 0) up += w; else down += w; }
    return { score: up - down, up, down, voters };
  }
  function bonusOf(it, sc) { // market-wide demand multiplier from rank (crops only), diminishing + capped
    const r = R(); if (it.kind !== 'crop' || sc.voters < r.minVotesForBonus) return 0;
    const m = r.rankBonusK * Math.log(1 + Math.abs(sc.score));
    return sc.score >= 0 ? Math.min(r.rankBonusMax, m) : -Math.min(r.rankPenaltyMax, m);
  }
  function ranked(db, now) {
    const rows = db.items.filter(it => !it.hidden).map(it => ({ it, sc: scoreOf(it, now) }));
    rows.sort((a, b) => b.sc.score - a.sc.score || b.it.createdAt - a.it.createdAt);
    rows.forEach((r, i) => { const pct = (i + 1) / rows.length;
      r.rank = i + 1; r.band = R().seedPriceBands.find(b => pct <= b.topPct + 1e-9 && (b.topPct === 1 || r.sc.voters >= R().minVotesForBonus)) || R().seedPriceBands[R().seedPriceBands.length - 1];
      r.price = Math.round(clamp(r.it.price, r.band.min, r.band.max)); r.bonus = bonusOf(r.it, r.sc); });
    return rows;
  }
  function led(db, id) { return db.ledger[id] || (db.ledger[id] = { day: 0, buys: 0, royDay: 0, roy: 0 }); }
  function view(db, now, player) {
    const pid = player && player.id, wk = weekKey(now);
    return ranked(db, now).map(r => { const it = r.it;
      return { id: it.id, kind: it.kind, creator: it.creator, sample: !!it.sample, mine: it.creatorId === pid, name: it.name, desc: it.desc, pitch: it.pitch || '',
        askPrice: it.price, price: r.price, band: r.band, rank: r.rank, score: +r.sc.score.toFixed(2), up: +r.sc.up.toFixed(2), down: +r.sc.down.toFixed(2), voters: r.sc.voters,
        myVote: pid && it.votes[pid] ? it.votes[pid].v : 0, bonus: +r.bonus.toFixed(3), stockLeft: Math.max(0, R().stockPerItemPerWeek - ((it.sold || {})[wk] || 0)),
        buys: it.buys || 0, copies: it.copies || 0, royaltyPending: it.creatorId === pid ? it.royaltyPending || 0 : undefined, payload: it.payload,
        createdAt: it.createdAt, activity: (it.activity || []).slice(0, 3) }; });
  }
  function sanitize(kind, p) {
    p = p || {}; const tags = (Array.isArray(p.tags) ? p.tags : []).slice(0, 4).map(t => clean(t, 18)).filter(Boolean);
    const img = typeof p.imageUrl === 'string' && IMG.test(p.imageUrl) ? p.imageUrl : undefined;
    if (kind === 'crop') {
      if (!BASES[p.base] || !TRAITS[p.trait]) return null;
      const stages = {}; for (const k of ['seedling', 'youngling', 'mature', 'flower', 'harvest']) stages[k] = clamp(p.stages && p.stages[k], 0, 9) | 0;
      return { base: p.base, trait: p.trait, name: clean(p.name, 28), stem: clean(p.stem || p.name, 24), color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : BASES[p.base].color,
        growTime: clamp(p.growTime, 3, 30) | 0, yield: clamp(p.yield, 1, 8) | 0, baseValue: clamp(p.baseValue, 1, 40) | 0, tags, stages, imageUrl: img };
    }
    if (kind === 'tool') {
      const recipes = (p.recipes || []).filter(r => RECIPES[r]).slice(0, 3); if (!recipes.length) return null;
      return { recipes, art: ['cookpot', 'oven', 'crock', 'still'].includes(p.art) ? p.art : 'cookpot', hue: clamp(p.hue, 0, 359) | 0,
        speedMult: clamp(p.speedMult, 0.5, 1), bonusOut: clamp(p.bonusOut, 0, 2) | 0, imageUrl: img };
    }
    if (kind === 'recipe') {
      const ingredients = (p.ingredients || []).slice(0, 4).map(g => ({ name: clean(g.name, 24), qty: clamp(g.qty, 1, 4) | 0 })).filter(g => g.name);
      const steps = (p.steps || []).slice(0, 4).map(s => { const o = { tool: clean(s.tool, 24), action: clean(s.action, 14) || 'Use' };
        if (s.time) o.time = clamp(s.time, 3, 40) | 0; if (s.makes) o.makes = clean(s.makes, 32); if (Array.isArray(s.adds)) o.adds = s.adds.filter(Number.isInteger).filter(x => x >= 0 && x < 4).slice(0, 4); return o; }).filter(s => s.tool);
      if (!ingredients.length || !steps.length) return null;
      return { form: RECIPES[p.form] ? p.form : 'jam', stars: clamp(p.stars, 1, 5) | 0, ingredients, steps, value: clamp(p.value, 1, 400) | 0, craftTime: clamp(p.craftTime, 6, 60) | 0, tags, imageUrl: img };
    }
    return null;
  }
  function publish(db, player, body, now, moderate) {
    const r = R(), kind = body.kind;
    if (!player || !player.id) return { error: 'No player id', code: 'bad_request' };
    if (!['crop', 'tool', 'recipe'].includes(kind)) return { error: 'Only crops, tools and recipes can be published', code: 'bad_request' };
    const name = clean(body.name, 32), desc = clean(body.desc, 170), pitch = clean(body.pitch, r.pitchMax);
    if (name.length < 2) return { error: 'Give it a name', code: 'bad_request' };
    const bad = moderate(`${name} ${desc} ${pitch}`); if (bad) return { error: bad, code: 'blocked' };
    if (db.items.filter(it => it.creatorId === player.id).length >= r.maxPublishedPerPlayer) return { error: `Max ${r.maxPublishedPerPlayer} published items`, code: 'limit' };
    if (db.items.some(it => it.creatorId === player.id && it.name.toLowerCase() === name.toLowerCase())) return { error: 'You already published that', code: 'dupe' };
    const payload = sanitize(kind, body.payload); if (!payload) return { error: 'That item could not be packed for the Bazaar', code: 'bad_request' };
    const it = { id: 'b' + now.toString(36) + Math.floor(Math.random() * 1e4).toString(36), kind, creator: clean(player.name, 24) || 'Player', creatorId: player.id, name, desc, pitch,
      price: Math.round(clamp(body.price, 1, 200)), payload, votes: {}, sold: {}, buys: 0, copies: 0, royaltyPending: 0, createdAt: now, activity: [] };
    db.items.unshift(it); return { ok: true, id: it.id };
  }
  function vote(db, player, id, v, now) {
    const r = R(), it = db.items.find(x => x.id === id); if (!it) return { error: 'Not found', code: 'not_found' };
    if (r.noSelfVote && it.creatorId === player.id) return { error: "You can't vote on your own idea", code: 'self_vote' };
    if (levelOf(player.xp) < r.voteMinLevel) return { error: `Voting unlocks at Inventor Lv ${r.voteMinLevel} (invent & sell a bit first)`, code: 'level' };
    v = v > 0 ? 1 : v < 0 ? -1 : 0;
    if (!v || (it.votes[player.id] && it.votes[player.id].v === v)) delete it.votes[player.id]; // tap again = undo
    else it.votes[player.id] = { v, t: now };                                                 // one vote per player per item
    return { ok: true, myVote: it.votes[player.id] ? it.votes[player.id].v : 0 };
  }
  function buy(db, player, id, now) {
    const r = R(), rows = ranked(db, now), row = rows.find(x => x.it.id === id); if (!row) return { error: 'Not found', code: 'not_found' };
    const it = row.it, wk = weekKey(now), d = dayKey(now);
    if (it.creatorId === player.id) return { error: "That's your own item", code: 'own' };
    const L = led(db, player.id); if (L.day !== d) Object.assign(L, { day: d, buys: 0 });
    if (L.buys >= r.buysPerPlayerPerDay) return { error: `Daily limit: ${r.buysPerPlayerPerDay} Bazaar buys per day`, code: 'daily_limit' };
    it.sold = it.sold || {}; if ((it.sold[wk] || 0) >= r.stockPerItemPerWeek) return { error: 'Sold out this week (restocks Monday)', code: 'sold_out' };
    L.buys++; it.sold[wk] = (it.sold[wk] || 0) + 1; it.buys = (it.buys || 0) + 1;
    const C = led(db, it.creatorId); if (C.royDay !== d) Object.assign(C, { royDay: d, roy: 0 });
    const royalty = Math.max(0, Math.min(Math.floor(row.price * r.royaltyRate), r.royaltyCapPerDay - C.roy)); C.roy += royalty;
    if (!it.sample) it.royaltyPending = (it.royaltyPending || 0) + royalty;
    it.activity = [`${clean(player.name, 24) || 'Someone'} bought one`, ...(it.activity || [])].slice(0, 5);
    return { ok: true, price: row.price, royalty, item: { id: it.id, kind: it.kind, name: it.name, desc: it.desc, creator: it.creator, payload: it.payload } };
  }
  function claim(db, player) { let n = 0; for (const it of db.items) if (it.creatorId === player.id) { n += it.royaltyPending || 0; it.royaltyPending = 0; } return { ok: true, coins: n }; }
  function copy(db, id) { const it = db.items.find(x => x.id === id); if (!it) return { error: 'Not found' }; it.copies = (it.copies || 0) + 1; return { ok: true }; }
  /* simulated community (prototype only): labelled sample players vote on / buy the real player's items, under the same caps */
  function simulate(db, now) {
    if (now - (db.lastSim || 0) < 15000) return; db.lastSim = now;
    for (const it of db.items) { if (it.sample) continue;
      const age = (now - it.createdAt) / 1000; if (age < 10) continue;
      const n = Object.keys(it.votes).filter(k => k.startsWith('sample:')).length; if (n >= 12) continue;
      if (Math.random() < 0.6) vote(db, { id: 'sample:fan' + n, xp: 999 }, it.id, Math.random() < 0.78 ? 1 : -1, now);
      if (Math.random() < 0.35) buy(db, { id: 'sample:shopper' + Math.floor(Math.random() * 6), name: 'sample: ' + ['FarmerJo', 'BakerBo', 'AuntieMo', 'Sprout42', 'TinyTam', 'PipTheBaker'][Math.floor(Math.random() * 6)] }, it.id, now);
    }
  }
  return { newDB, view, publish, vote, buy, claim, copy, simulate, levelOf, scoreOf, bonusOf, sanitize, DAY, WEEK };
})();
