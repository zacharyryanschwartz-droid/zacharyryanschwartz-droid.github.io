/* ===== INVENTION DIRECTORY core (shared: browser + server/server.js via vm) =====
   A catalogue of every crop / tool / recipe ever created. Before an AI call the player's idea is normalized and matched
   (exact normalized idea, then fuzzy: word-Jaccard blended with character-trigram Jaccard over idea + name + tags).
   Later option (documented in DESIGN.md): swap the fuzzy score for text embeddings (cosine) once the catalogue is large. */
'use strict';
const DirectoryCore = (() => {
  const STOP = new Set('a an the of and or with that which who to for in on at by from my your our its it is are be made full filled tiny little big very some like taste tastes grows grow growing makes make'.split(' '));
  const R = () => (typeof DIRECTORY_RULES !== 'undefined' ? DIRECTORY_RULES : { matchMin: 0.42, exact: 0.999, showMax: 3, price: { crop: 15, tool: 30, recipe: 25 }, maxEntries: 20000 });
  const KINDS = ['crop', 'tool', 'recipe'];
  function singular(w) {
    if (w === 'cacti') return 'cactus';
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
    if (/(ches|shes|xes|sses|oes)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w) && !/(ss|us|is)$/.test(w) && w.length > 3) return w.slice(0, -1);
    return w;
  }
  const clean = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  function tokens(t) { return clean(t).split(' ').filter(w => w.length > 1 && !STOP.has(w)).map(singular); }
  function normalize(t) { return tokens(t).join(' '); } // "Blue pumpkins, full of snow!" -> "blue pumpkin snow"
  function trigrams(t) { const s = '  ' + normalize(t) + ' ', out = new Set(); for (let i = 0; i < s.length - 2; i++) out.add(s.slice(i, i + 3)); return out; }
  function jaccard(a, b) { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); }
  function score(q, e) {
    const nq = normalize(q); if (!nq) return 0;
    if (nq === e.norm) return 1;
    const tq = new Set(nq.split(' ')), te = new Set([...e.norm.split(' '), ...tokens(e.name), ...(e.tags || []).flatMap(tokens)]);
    const tok = jaccard(tq, new Set(e.norm.split(' '))), tokAll = [...tq].filter(w => te.has(w)).length / tq.size; // coverage of the query words
    const tri = Math.max(jaccard(trigrams(q), trigrams(e.idea)), jaccard(trigrams(q), trigrams(e.name)));
    return Math.min(0.99, 0.4 * tok + 0.25 * tokAll + 0.35 * tri);
  }
  function search(db, { q = '', kind = '', limit = 20, min = 0.15 } = {}) {
    const items = db.items.filter(e => !kind || e.kind === kind);
    if (!String(q).trim()) return items.slice().sort((a, b) => (b.uses || 0) - (a.uses || 0) || b.createdAt - a.createdAt).slice(0, limit).map(e => ({ ...e, score: 0 }));
    return items.map(e => ({ ...e, score: +score(q, e).toFixed(3) })).filter(e => e.score >= min).sort((a, b) => b.score - a.score).slice(0, limit);
  }
  function match(db, kind, q) { return search(db, { q, kind, limit: R().showMax, min: R().matchMin }); }
  /* entry = { kind, name, desc, idea, tags, payload, imageUrl } ; payload is the portable Bazaar-style pack (sanitized) */
  function add(db, body, now, sanitize) {
    const kind = body.kind; if (!KINDS.includes(kind)) return { error: 'bad kind' };
    const payload = sanitize ? sanitize(kind, body.payload) : body.payload; if (!payload) return { error: 'bad payload' };
    const idea = String(body.idea || body.name || '').slice(0, 140), norm = normalize(idea); if (!norm) return { error: 'empty idea' };
    const dupe = db.items.find(e => e.kind === kind && (e.norm === norm || e.name.toLowerCase() === String(body.name || '').toLowerCase()));
    if (dupe) return { ok: true, id: dupe.id, dupe: true };
    const e = { id: 'd' + (db.seq = (db.seq || 0) + 1).toString(36), kind, name: String(body.name || '').slice(0, 32), desc: String(body.desc || '').slice(0, 170), idea, norm,
      tags: (body.tags || payload.tags || []).slice(0, 4), payload, imageUrl: payload.imageUrl || null, uses: 0, createdAt: now || Date.now(), sample: !!body.sample };
    db.items.unshift(e); if (db.items.length > R().maxEntries) db.items.length = R().maxEntries;
    return { ok: true, id: e.id, entry: e };
  }
  /* seeded with the pre-generated example art so a fresh Directory already saves credits on the classic ideas */
  function newDB() {
    const db = { v: 1, seq: 0, items: [] }, T = 1767225600000;
    const S = [
      ['crop', 'Umbrella Cacti', 'a cactus that grows tiny umbrellas', 'Prickly little cacti that pop open paper umbrellas when it drizzles.', { base: 'wheat', trait: 'sun', name: 'Umbrella Cacti', stem: 'Umbrella Cactus', color: '#5fae45', growTime: 9, yield: 3, baseValue: 12, tags: ['whimsical'], imageUrl: MP_IMG['img/ai/umbrella-cacti.webp'] }],
      ['crop', 'Candy Strawberries', 'strawberries that taste like cotton candy', 'Fluffy pink berries that melt like a fairground treat.', { base: 'berry', trait: 'sweet', name: 'Candy Strawberries', stem: 'Candy Strawberry', color: '#ff8fc8', growTime: 8, yield: 4, baseValue: 11, tags: ['sweet'], imageUrl: MP_IMG['img/ai/candy-strawberries.webp'] }],
      ['crop', 'Snow Pumpkins', 'blue pumpkins full of snow', 'Icy blue pumpkins packed with fresh powder.', { base: 'pumpkin', trait: 'frost', name: 'Snow Pumpkins', stem: 'Snow Pumpkin', color: '#7fb6ff', growTime: 12, yield: 2, baseValue: 16, tags: ['frosty'], imageUrl: MP_IMG['img/ai/snow-pumpkins.webp'] }],
      ['crop', 'Midnight Flowers', 'a flower that sings at midnight', 'Petals that hum a lullaby once the moon is up.', { base: 'petal', trait: 'moon', name: 'Midnight Flowers', stem: 'Midnight Flower', color: '#6b5bd1', growTime: 9, yield: 3, baseValue: 13, tags: ['musical'], imageUrl: MP_IMG['img/ai/midnight-flowers.webp'] }],
      ['crop', 'Jam Clouds', 'a cloud that rains jam', 'A fluffy little cloud that drizzles berry jam.', { base: 'berry', trait: 'stardew', name: 'Jam Clouds', stem: 'Jam Cloud', color: '#c86bd8', growTime: 10, yield: 3, baseValue: 14, tags: ['sweet'], imageUrl: MP_IMG['img/ai/jam-cloud.webp'] }],
      ['tool', 'Dragon Oven', 'a dragon oven that bakes pies', 'A tiny friendly dragon that bakes pies in one fiery breath.', { recipes: ['pie'], art: 'oven', hue: 10, speedMult: 0.55, bonusOut: 1, imageUrl: MP_IMG['img/ai/dragon-oven.webp'] }],
      ['recipe', 'Umbrella Cactus Jam Tarts', 'umbrella cactus jam tarts with sparkle frosting', 'Crumbly tarts filled with umbrella-cactus jam under a sparkly glaze.', { form: 'pie', stars: 3, ingredients: [{ name: 'Umbrella Cactus', qty: 3 }], steps: [{ tool: 'Cookpot', action: 'Simmer' }, { tool: 'Oven', action: 'Bake' }], value: 60, craftTime: 20, tags: ['dessert'], imageUrl: MP_IMG['img/ai/umbrella-cactus-jam-tarts.webp'] }],
    ];
    S.forEach(([kind, name, idea, desc, payload], i) => add(db, { kind, name, idea, desc, payload, sample: true }, T + i));
    return db;
  }
  const api = { normalize, tokens, trigrams, jaccard, score, search, match, add, newDB, singular };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
