/* Best Creations: ranks the player's products (+ invented crops) by coins earned, units sold, average stars and buzz.
   Per-location numbers come from state.locStats (recorded at sale/rating time); "All locations" sums them. Buzz is word of mouth,
   so it's shared by every location. */
let bestView = { sort: 'overall', scope: 'here' };
function locStat(key) { state.locStats = state.locStats || {}; return state.locStats[key] || (state.locStats[key] = { sold: 0, earned: 0, rn: 0, rsum: 0 }); }
const Best = {
  creation(key) { // the player's own creations only: products, AI recipes, invented (non-basic) crops
    if (key.startsWith('p|') || key.startsWith('r|')) return true;
    if (key.startsWith('c|')) { const id = key.slice(2); return !!state.inventions[id] && !BASIC_CROP_IDS.includes(id); }
    return false;
  },
  raw(scope) {
    const farms = scope === 'all' ? state.farms : [state.farms[state.farmIdx]], m = {};
    for (const F of farms) for (const [k, s] of Object.entries(F.locStats || {})) {
      if (!this.creation(k)) continue; const a = m[k] || (m[k] = { key: k, sold: 0, earned: 0, rn: 0, rsum: 0 });
      a.sold += s.sold; a.earned += s.earned; a.rn += s.rn; a.rsum += s.rsum; }
    return Object.values(m).filter(a => a.sold || a.rn).map(a => {
      const b = Think.buzz(a.key), stars = a.rn ? a.rsum / a.rn : 0;
      return { ...a, stars, buzz: Math.round(b.n ? b.avg * 20 * Math.min(1, b.n / BEST_RULES.buzzFull) : 0) }; });
  },
  rank(scope = bestView.scope, sort = bestView.sort) {
    const W = BEST_RULES.weights, L = this.raw(scope), mx = f => Math.max(1, ...L.map(f));
    const mE = mx(a => a.earned), mS = mx(a => a.sold), mB = mx(a => a.buzz);
    L.forEach(a => { a.score = Math.round(W.earned * a.earned / mE + W.sold * a.sold / mS
      + W.stars * (a.stars / 5) * Math.min(1, a.rn / BEST_RULES.starsFull) + W.buzz * a.buzz / mB); });
    const by = { overall: a => a.score, earners: a => a.earned, rated: a => a.stars * 100 + a.rn, buzz: a => a.buzz }[sort] || (a => a.score);
    return L.filter(a => sort !== 'rated' || a.rn >= BEST_RULES.minRatingsForBest).sort((a, b) => by(b) - by(a) || b.score - a.score).slice(0, BEST_RULES.show);
  },
};
const MEDAL = ['🥇', '🥈', '🥉'];
const BEST_TABS = [['overall', 'Overall'], ['earners', 'Top Earners'], ['rated', 'Best Rated'], ['buzz', 'Most Buzz']];
function bestMain(a) { return { overall: `${a.score}<small>pts</small>`, earners: `${a.earned}¢`, rated: `${a.stars.toFixed(1)}★`, buzz: `🔥${a.buzz}` }[bestView.sort]; }
function bestRow(a, i) {
  const info = itemInfo(a.key); if (!info) return '';
  return `<button class="best-row ${i < 3 ? 'top' : ''}" data-act="stats" data-key="${a.key}" data-hook="best-row">
    <span class="best-pos">${MEDAL[i] || i + 1}</span>${info.icon(40)}
    <span class="best-name"><b>${esc(info.name)}</b><small class="muted">🪙 ${a.earned}¢ · 🛒 ${a.sold} sold · ${a.rn ? `⭐ ${a.stars.toFixed(1)} (${a.rn})` : '⭐ –'} · 🔥 ${a.buzz}</small></span>
    <span class="best-main">${bestMain(a)}</span></button>`;
}
function bestSheet() {
  openSheet(() => {
    const L = Best.rank(), here = state.farms[state.farmIdx];
    return `<div class="sheet-h"><h3>🏆 Best Creations</h3><button class="x" data-act="close">✕</button></div>
      <div class="best-scope" data-hook="best-scope">${[['here', `${here.emoji || '📍'} ${esc(here.name)}`], ['all', '🌍 All locations']].map(([k, l]) => `<button class="chip ${bestView.scope === k ? 'sel' : ''}" data-act="best-scope" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="best-tabs" data-hook="best-tabs">${BEST_TABS.map(([k, l]) => `<button class="tchip ${bestView.sort === k ? 'sel' : ''}" data-act="best-sort" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="best-list" data-hook="best-list">${L.length ? L.map(bestRow).join('') : `<p class="muted">${bestView.sort === 'rated' ? `Nothing has ${BEST_RULES.minRatingsForBest}+ ratings yet.` : 'Sell some of your creations at the market to get ranked.'}</p>`}</div>
      <p class="muted small">Overall = ${BEST_RULES.weights.earned} coins earned + ${BEST_RULES.weights.sold} units sold + ${BEST_RULES.weights.stars} star rating + ${BEST_RULES.weights.buzz} buzz (each vs. the leader). Tap a creation for its stats card.</p>`;
  });
}
function bestTeaser() {
  const L = Best.rank('all', 'overall').slice(0, 3);
  return `<h3 class="sub">🏆 Best Creations <button class="link" data-act="best-open" data-hook="best-open">See all</button></h3>
    <div class="best-teaser" data-hook="best-teaser">${L.length ? L.map((a, i) => { const info = itemInfo(a.key); return info ? `<button class="bt-item" data-act="stats" data-key="${a.key}">${MEDAL[i]}${info.icon(40)}<b>${esc(info.name)}</b><small>${a.score} pts</small></button>` : ''; }).join('') : '<p class="muted small">Sell your creations to start a leaderboard.</p>'}</div>`;
}
function bestAct(a, t) {
  switch (a) {
    case 'best-open': bestSheet(); return true;
    case 'best-sort': bestView.sort = t.dataset.k; refreshSheet(); return true;
    case 'best-scope': bestView.scope = t.dataset.k; refreshSheet(); return true;
  }
  return false;
}
