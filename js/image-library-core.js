/* ===== IMAGE LIBRARY core (internal; shared: server/server.js via vm + the offline demo stub in the browser) =====
   One shared library of every AI image made for any player (kind, normalized idea, name, keywords, image URL).
   Before the image model is called, the new invention is fuzzy-matched against entries of the SAME kind
   (exact normalized idea, else word-Jaccard + query-word coverage + character-trigram Jaccard over idea / name / keywords).
   A score >= IMAGE_LIBRARY_RULES.matchMin reuses the stored image and skips the image call. Players never see this:
   they always spend 1 credit, and the text/name/stats are still generated fresh for them.
   Later option (DESIGN.md): swap the fuzzy score for text embeddings (cosine) once the library is large. */
'use strict';
const ImageLibraryCore = (() => {
  const STOP = new Set('a an the of and or with that which who to for in on at by from my your our its it is are be made full filled tiny little big very some like taste tastes grows grow growing makes make'.split(' '));
  const R = () => (typeof IMAGE_LIBRARY_RULES !== 'undefined' ? IMAGE_LIBRARY_RULES : { matchMin: 0.7, imageUsd: 0.04, maxEntries: 20000 });
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
    const tq = new Set(nq.split(' ')), te = new Set([...e.norm.split(' '), ...tokens(e.name), ...(e.keywords || []).flatMap(tokens)]);
    const tok = jaccard(tq, new Set(e.norm.split(' '))), cover = [...tq].filter(w => te.has(w)).length / tq.size;
    const tri = Math.max(jaccard(trigrams(q), trigrams(e.idea)), jaccard(trigrams(q), trigrams(e.name)));
    // reverse coverage: how much of the stored idea (or its name) the new idea also says. Keeps "an oven that bakes pies"
    // from getting the Dragon Oven picture: a reused image must not show something the player didn't ask for.
    const rc = ws => { const a = [...new Set(ws)]; return a.length ? a.filter(w => tq.has(w)).length / a.length : 0; };
    const rev = Math.max(rc(e.norm.split(' ')), rc(tokens(e.name)));
    return Math.min(0.99, (0.4 * tok + 0.25 * cover + 0.35 * tri) * (0.5 + 0.5 * rev));
  }
  /* best same-kind entry for any of the query texts (player idea, generated name, ...) -> { entry, score } | null */
  function best(db, kind, texts) {
    let top = null;
    for (const e of db.items) { if (e.kind !== kind || !e.imageUrl) continue;
      for (const t of texts) { if (!t) continue; const s = score(t, e); if (!top || s > top.score) top = { entry: e, score: +s.toFixed(3) }; } }
    return top;
  }
  function match(db, kind, texts) { const b = best(db, kind, texts); return b && b.score >= R().matchMin ? b : null; }
  /* entry = { kind, name, idea, keywords[], imageUrl, imagePrompt } */
  function add(db, body, now) {
    const kind = body.kind; if (!KINDS.includes(kind) || !body.imageUrl) return { error: 'bad entry' };
    const idea = String(body.idea || body.name || '').slice(0, 140), norm = normalize(idea); if (!norm) return { error: 'empty idea' };
    const dupe = db.items.find(e => e.kind === kind && e.norm === norm && e.imageUrl === body.imageUrl); if (dupe) return { ok: true, id: dupe.id, dupe: true };
    const e = { id: 'i' + (db.seq = (db.seq || 0) + 1).toString(36), kind, name: String(body.name || '').slice(0, 32), idea, norm,
      keywords: [...new Set((body.keywords || []).map(k => String(k).slice(0, 24)).filter(Boolean))].slice(0, 8),
      imageUrl: String(body.imageUrl), imagePrompt: String(body.imagePrompt || '').slice(0, 200), uses: 0, createdAt: now || Date.now(), seed: !!body.seed };
    db.items.unshift(e); if (db.items.length > R().maxEntries) db.items.length = R().maxEntries;
    return { ok: true, id: e.id, entry: e };
  }
  /* count a reuse (or a miss) and the image spend it avoided */
  function record(db, hit, e) {
    db.stats = db.stats || { hits: 0, misses: 0, savedUsd: 0 };
    if (hit) { db.stats.hits++; db.stats.savedUsd = +(db.stats.savedUsd + R().imageUsd).toFixed(4); if (e) e.uses = (e.uses || 0) + 1; } else db.stats.misses++;
    return db.stats;
  }
  /* seeded with the pre-generated example art */
  function newDB() {
    const db = { v: 2, seq: 0, items: [], stats: { hits: 0, misses: 0, savedUsd: 0 } }, T = 1767225600000;
    [['crop', 'Umbrella Cacti', 'a cactus that grows tiny umbrellas', ['cactus', 'umbrella'], 'img/ai/umbrella-cacti.webp'],
     ['crop', 'Candy Strawberries', 'strawberries that taste like cotton candy', ['strawberry', 'cotton candy', 'sweet'], 'img/ai/candy-strawberries.webp'],
     ['crop', 'Snow Pumpkins', 'blue pumpkins full of snow', ['pumpkin', 'snow', 'frosty'], 'img/ai/snow-pumpkins.webp'],
     ['crop', 'Midnight Flowers', 'a flower that sings at midnight', ['flower', 'midnight', 'musical'], 'img/ai/midnight-flowers.webp'],
     ['crop', 'Jam Clouds', 'a cloud that rains jam', ['cloud', 'jam', 'rain'], 'img/ai/jam-cloud.webp'],
     ['tool', 'Dragon Oven', 'a dragon oven that bakes pies', ['dragon', 'oven', 'pie'], 'img/ai/dragon-oven.webp'],
     ['recipe', 'Umbrella Cactus Jam Tarts', 'umbrella cactus jam tarts with sparkle frosting', ['tart', 'cactus', 'jam'], 'img/ai/umbrella-cactus-jam-tarts.webp'],
    ].forEach(([kind, name, idea, keywords, imageUrl], i) => add(db, { kind, name, idea, keywords, imageUrl, seed: true }, T + i));
    return db;
  }
  const api = { normalize, tokens, trigrams, jaccard, score, best, match, add, record, newDB, singular };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
