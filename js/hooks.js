/* =====================================================================
   MONETIZATION + AI HOOKS (STUBS ONLY — no network calls, no real ads/IAP)
   Real game: Unity + StoreKit 2 + an ad SDK + an optional AI interpreter.
   Real-money products ONLY: remove_ads (non-consumable), ai_credits_1 / ai_credits_50 (consumable top-ups, $0.99 / $8.99),
   Market Plot+ (auto-renewable subscription group, 3/6/12-month terms: 10 AI credits every
   week + no ads). Every AI action costs 1 credit, subscriber or not. Coins are never sold.
   ===================================================================== */
'use strict';

const WEEK_MS = 7 * 24 * 3600 * 1000;
const SUB_WEEKLY_CREDITS = 10;
const SUB_ROLLOVER = true;  // unused weekly credits roll over...
const SUB_CREDIT_CAP = 30;  // ...up to 30 SUBSCRIPTION-granted credits (3 weeks). Pack + starter credits are never capped.
/* Subscription credits are tracked separately: ent.subCredits is the part of ent.aiCredits that came from weekly grants.
   Spending uses sub credits first; a weekly grant adds min(10, 30 - subCredits), so bought credits never block a grant. */
function subGrant(e) { const add = Math.min(SUB_WEEKLY_CREDITS, Math.max(0, SUB_CREDIT_CAP - (e.subCredits || 0))); e.subCredits = (e.subCredits || 0) + add; e.aiCredits += add; return add; }

/* ---- Entitlements (would be backed by StoreKit receipts / server) ---- */
const Entitlements = {
  get removeAds() { return !!(state && (state.ent.removeAds || this.subscribed)); },
  get subscribed() { return !!(state && state.ent.subscribed && (!state.ent.subExpires || Date.now() < state.ent.subExpires)); },
  get aiCredits() { return state ? state.ent.aiCredits : 0; },
  get plan() { return state && state.ent.subPlan ? Store.products[state.ent.subPlan] : null; },
  canUseAI() { return this.aiCredits > 0; },
  /* every AI action costs 1 credit (subscribers get theirs weekly); returns false when out */
  spendAICredit() {
    if (state.ent.aiCredits > 0) { state.ent.aiCredits--; if (state.ent.subCredits > 0) state.ent.subCredits--; save(); return true; }
    return false;
  },
  /* STUB of the server's weekly grant: +10 per elapsed week while the term is active */
  weeklyGrant(now = Date.now()) {
    const e = state && state.ent; if (!e || !e.subscribed || !e.nextGrantAt) return 0;
    let n = 0, got = 0;
    while (now >= e.nextGrantAt && (!e.subExpires || e.nextGrantAt < e.subExpires)) {
      got += subGrant(e); e.nextGrantAt += WEEK_MS; n++;
    }
    if (e.subExpires && now >= e.subExpires) { e.subscribed = false; e.nextGrantAt = null; } // term ended (credits already granted stay)
    if (n || !e.subscribed) save();
    return got; // credits actually granted (0 when the rollover cap is full)
  },
  nextGrantText() {
    if (!this.subscribed || !state.ent.nextGrantAt) return '';
    const d = Math.max(0, state.ent.nextGrantAt - Date.now()), days = Math.ceil(d / 86400000);
    const when = days >= 1 ? `${days} day${days === 1 ? '' : 's'}` : `${Math.max(1, Math.ceil(d / 3600000))}h`;
    const amt = Math.min(SUB_WEEKLY_CREDITS, Math.max(0, SUB_CREDIT_CAP - (state.ent.subCredits || 0)));
    return amt ? `Next ${amt} credits in ${when}` : `Rollover cap reached (${SUB_CREDIT_CAP}) · next grant in ${when}`;
  },
};

/* ---- Store (StoreKit stub). Product IDs mirror the planned App Store SKUs. ---- */
const Store = {
  products: {
    remove_ads:     { title: 'Remove Ads',      price: '$2.99', type: 'non-consumable', note: 'one-time', iap: 'com.marketplot.removeads' },
    ai_credits_1:   { title: '1 AI Credit',     price: '$0.99', type: 'consumable', credits: 1,  note: 'one idea · never expires', iap: 'com.marketplot.credits1' },
    ai_credits_50:  { title: '50 AI Credits',   price: '$8.99', type: 'consumable', credits: 50, note: 'best value · $0.18 per idea', iap: 'com.marketplot.credits50' },
    ai_credits_10:  { title: '10 AI Credits',   price: 'TBD',   type: 'consumable', credits: 10, note: 'unpriced, open question' },
    plus_3m:  { title: 'Market Plot+ · 3 months',  price: '$14.99', save: '', type: 'subscription', months: 3,  group: 'market_plot_plus' },
    plus_6m:  { title: 'Market Plot+ · 6 months',  price: '$26.99', save: '~10% off', type: 'subscription', months: 6,  group: 'market_plot_plus' },
    plus_1y:  { title: 'Market Plot+ · 1 year',    price: '$49.99', save: '~17% off', type: 'subscription', months: 12, group: 'market_plot_plus' },
  },
  subPlans: ['plus_3m', 'plus_6m', 'plus_1y'],
  packs: ['ai_credits_1', 'ai_credits_50', 'ai_credits_10'],
  /* STUB: in the prototype a "purchase" only flips local flags so the UI can be previewed. */
  purchase(id) {
    console.info('[Store stub] purchase', id);
    const P = this.products[id]; if (!P) return false;
    const e = state.ent, now = Date.now();
    if (id === 'remove_ads') e.removeAds = true;
    else if (P.type === 'subscription') {
      const wasActive = Entitlements.subscribed;
      e.subscribed = true; e.subPlan = id;
      const start = wasActive && e.subExpires ? e.subExpires : now; // switching/renewing within the group extends the term
      const end = new Date(start); end.setMonth(end.getMonth() + P.months); e.subExpires = end.getTime();
      if (!wasActive) { subGrant(e); e.nextGrantAt = now + WEEK_MS; } // week 1 granted immediately
    } else if (P.credits) e.aiCredits += P.credits; // bought credits: never capped, never expire; stack on top, subscribers included
    save(); Ads.refresh(); return true;
  },
  /* debug: undo prototype purchases */
  resetPurchases() { state.ent = { ...state.ent, removeAds: false, subscribed: false, subCredits: 0, subPlan: null, subExpires: null, nextGrantAt: null, aiCredits: 0 }; save(); Ads.refresh(); },
};

/* ---- Ads (ad SDK stub) ---- */
const Ads = {
  showBanner() { document.getElementById('ad-banner').classList.remove('hidden'); },
  hideBanner() { document.getElementById('ad-banner').classList.add('hidden'); },
  refresh() { Entitlements.removeAds ? this.hideBanner() : this.showBanner(); },
  /* STUB interstitial: full-screen gray card, closable after 2s. No-ops if ads removed. */
  showInterstitial(reason) {
    if (Entitlements.removeAds) return false;
    console.info('[Ads stub] interstitial', reason);
    const el = document.getElementById('interstitial');
    el.innerHTML = `<div class="ad-card"><div class="ad-big">Ad</div><p>Interstitial placeholder<br><small>(${reason})</small></p>
      <button class="btn" id="ad-close" disabled>Close in 2…</button>
      <button class="link" id="ad-remove">Remove ads forever — ${Store.products.remove_ads.price}</button></div>`;
    el.classList.add('show');
    const close = el.querySelector('#ad-close');
    setTimeout(() => { close.disabled = false; close.textContent = 'Close ✕'; }, 2000);
    close.onclick = () => el.classList.remove('show');
    el.querySelector('#ad-remove').onclick = () => { Store.purchase('remove_ads'); el.classList.remove('show'); toast('Ads removed (stub purchase)'); };
    return true;
  },
};

/* ---- AI Interpreter (OPTIONAL network call in the real game) ----
   Contract: takes the player's FREE-TEXT idea and returns the SAME data structure the procedural
   inventor returns (crop Invention, or tool def), with source:'ai'. Or { error } and NO credit is spent.
   Prototype: no network. The text is turned into an item deterministically (keyword matching). */
const PromptStub = {
  norm: t => String(t || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim(),
  hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; },
  singular(w) {
    if (w === 'cacti') return 'cactus';
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + 'y';
    if (/(ches|shes|xes|sses|oes)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w) && !/(ss|us|is)$/.test(w) && w.length > 3) return w.slice(0, -1);
    return w;
  },
  plural(w) {
    if (/us$/.test(w)) return w.slice(0, -2) + 'i';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    if (/(s|x|ch|sh)$/.test(w)) return w + 'es';
    if (/(berry|wheat|corn|grass)$/.test(w)) return w;
    return w + 's';
  },
  title: w => w.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join('-'),
  match(table, words) { // first table key whose keyword appears (singular or plural form)
    const set = new Set(words.flatMap(w => [w, this.singular(w)]));
    for (const k in table) if (table[k].some(kw => set.has(kw))) return k;
    return null;
  },
  parse(text) {
    const n = this.norm(text), words = n.split(' ').filter(Boolean);
    // "a dragon oven | that bakes pies": head noun = last content word before the clause,
    // modifier = content word before it, feature = last content word of the clause
    const keep = w => !AI_KEYWORDS.stop.includes(w) && !AI_KEYWORDS.color[w] && /[a-z]/.test(w) && w.length > 1;
    const cut = words.findIndex((w, i) => i > 0 && ['that', 'which', 'who', 'with', 'full', 'filled', 'made', 'growing', 'grows'].includes(w));
    const head = (cut < 0 ? words : words.slice(0, cut)).filter(keep).map(w => this.singular(w.slice(0, 14)));
    const tail = (cut < 0 ? [] : words.slice(cut)).filter(keep).map(w => this.singular(w.slice(0, 14)));
    const subject = head.length ? head[head.length - 1] : (tail[0] || null);
    const modifier = head.length > 1 ? head[head.length - 2] : null;
    const feature = modifier || (tail.length ? tail[tail.length - 1] : null);
    return { n, words, subject, feature: feature === subject ? null : feature, h: this.hash(n) };
  },
  check(text) {
    const p = this.parse(text);
    if (p.n.replace(/[^a-z]/g, '').length < 3) return { error: 'Type an idea first (no credit used)' };
    if (!AIBackend.online && p.words.some(w => AI_KEYWORDS.blocked.includes(this.singular(w)))) return { error: "Let's keep it cozy, try another idea (no credit used)" };
    return p;
  },
};
const TRAIT_FLAVOR = {
  sweet: 'tastes like a summer fair', giant: 'needs two hands to carry', spicy: 'leaves a cozy tingle', moon: 'glows softly after dark',
  stardew: 'sparkles with morning stardust', crystal: 'chimes when tapped', sun: 'feels warm as sunshine', frost: 'stays frosty all day',
};
/* ===== AI BACKEND (local Node server in /server, real xAI calls) =====
   When the page is served by server/server.js, /api/health answers {ok, ai:true} and every AI action goes to the server
   (POST /api/invent, /api/recipe). Opened any other way (file://, a plain static server, no key) the offline stubs below run
   and the UI shows an "Offline AI (demo)" badge. Server errors are shown as-is: no silent fallback, no credit spent. */
const AIBackend = {
  mode: 'offline', // 'server' (real xAI) | 'mock' (server pointed at a local mock xAI, tests only) | 'offline' (stubs)
  info: null,
  async detect() {
    if (location.protocol === 'file:') return this.mode;
    try {
      const r = await fetch('api/health', { cache: 'no-store' }); if (!r.ok) return this.mode;
      const j = await r.json(); this.info = j;
      if (j && j.ok && j.ai) this.mode = j.mock ? 'mock' : 'server';
    } catch (e) { /* no server: stay offline */ }
    return this.mode;
  },
  get online() { return this.mode !== 'offline'; },
  badge() { return this.mode === 'server' ? '' : this.mode === 'mock' ? '🧪 Mock AI (test)' : '📴 Offline AI (demo)'; },
  label() { return this.mode === 'server' ? `xAI · ${this.info.models.text} + ${this.info.models.image}` : this.mode === 'mock' ? 'local mock of the xAI API (test run)' : 'offline stubs (no server)'; },
  lastMeta: null,
  async post(path, body) {
    let r, j;
    try { r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { return { error: "Can't reach the AI server. Check it is running. (no credit used)", code: 'network' }; }
    try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok || !j.item) return { error: j.error || `AI server error ${r.status} (no credit used)`, code: j.code || 'http_' + r.status, detail: j.detail };
    this.lastMeta = j.meta; console.info('[AI]', path, JSON.stringify(j.meta));
    return { ...j.item, meta: j.meta };
  },
};
const AIInterpreter = {
  get enabled() { return AIBackend.online; }, // offline: the stub derives results from the typed text
  /* async invent({type:'crop'|'tool', prompt}) -> item | {error}.  AI never makes products.
     crop -> Invention (same structure as Inventor.procedural, source:'ai', plus prompt, color)
     tool -> { type:'tool', source:'ai', key, name, recipes, speedMult, bonusOut, desc, art, hue, prompt }
     TODO(real game): POST {type, prompt} to the AI backend; server moderates text, validates/clamps stats. */
  async invent(req) {
    const p = PromptStub.check(req.prompt); if (p.error) return p;
    const K = AI_KEYWORDS, S = PromptStub, prompt = String(req.prompt).trim().slice(0, 120);
    if (AIBackend.online && (req.type === 'crop' || req.type === 'tool')) { // ids stay client-side (same hash as the stub) so duplicates cost nothing
      const id = (req.type === 'crop' ? 'ai_' : 'ai_t_') + p.h.toString(36);
      if (req.type === 'crop' ? state.order.includes(id) : state.tools[id]) return { error: `You already ${req.type === 'crop' ? 'grew' : 'built'} that idea! Try a new twist (no credit used)` };
      const it = await AIBackend.post('api/invent', { kind: req.type, idea: prompt }); if (it.error) return it;
      if (req.type === 'crop') { it.id = id; it.stages = {}; } else { it.key = id; it.owned = true; }
      return it;
    }
    if (req.type === 'crop') {
      const id = 'ai_' + p.h.toString(36);
      if (state.order.includes(id)) return { error: 'You already grew that idea! Try a new twist (no credit used)' };
      const base = S.match(K.base, p.words) || Object.keys(BASES)[p.h % Object.keys(BASES).length];
      const trait = S.match(K.trait, p.words) || SOURCES.ai.traits[(p.h >>> 4) % SOURCES.ai.traits.length];
      const subj = p.subject || BASES[base].stem.toLowerCase(), feat = p.feature;
      const inv = Inventor.procedural(base, trait, 'ai');
      inv.id = id;
      inv.stem = feat ? `${S.title(feat)} ${S.title(subj)}` : `${TRAITS[trait].prefix} ${S.title(subj)}`;
      inv.name = feat ? `${S.title(feat)} ${S.title(S.plural(subj))}` : `${TRAITS[trait].prefix} ${S.title(S.plural(subj))}`;
      inv.desc = `Your ${inv.name.toLowerCase()}, grown just as you imagined. Every one ${TRAIT_FLAVOR[trait]}, and shoppers stop in their tracks.`;
      const col = S.match(Object.fromEntries(Object.keys(K.color).map(c => [c, [c]])), p.words);
      if (col) inv.color = K.color[col];
      inv.baseValue = Math.max(AI_CROP_MIN_VALUE, Math.round(inv.baseValue * AI_CROP_VALUE_BONUS));
      inv.prompt = prompt;
      return inv;
    }
    if (req.type === 'tool') {
      const key = 'ai_t_' + p.h.toString(36);
      if (state.tools[key]) return { error: 'You already built that idea! Try a new twist (no credit used)' };
      const all = Object.keys(RECIPES);
      let recipes = all.filter(r => S.match({ [r]: K.recipe[r] }, p.words));
      if (!recipes.length) recipes = [all[p.h % all.length], all[(p.h >>> 3) % all.length]].filter((r, i, a) => a.indexOf(r) === i);
      const stillish = S.match({ s: ['still', 'distill', 'potion', 'cauldron', 'fizzy', 'fizz'] }, p.words);
      const art = recipes.includes('pie') ? 'oven' : stillish ? 'still' : (recipes.length === 1 && recipes[0] === 'pickles') ? 'crock' : 'cookpot';
      const col = S.match(Object.fromEntries(Object.keys(K.hue).map(c => [c, [c]])), p.words);
      const subj = p.subject, feat = p.feature;
      const name = subj ? (feat ? `${S.title(feat)} ${S.title(subj)}` : `${K.toolAdj[p.h % K.toolAdj.length]} ${S.title(subj)}`) : `${K.toolAdj[p.h % K.toolAdj.length]} Gadget`;
      const bonusOut = /\b(double|twice|two|triple|extra|more)\b/.test(p.n) ? 2 : 1;
      return { type: 'tool', source: 'ai', owned: true, key, name, art, hue: col ? K.hue[col] : 40 + p.h % 300,
               recipes, speedMult: [0.5, 0.55, 0.6, 0.65][p.h % 4], bonusOut, prompt,
               desc: `Your ${name.toLowerCase()}, built just as you imagined. Makes ${recipes.map(r => RECIPES[r].name).join(' & ')} faster than any basic tool.` };
    }
    return { error: 'Unknown request' };
  },
};

/* ===== AI RECIPE INTERPRETER (stub) =====
   Contract: { prompt, inventions, tools } -> recipe | { error }.  Recipe = { id, type:'recipe', source:'ai', name, prompt,
     steps:[{tool, action}], ingredients:[{key, qty}], stars, craftTime, out, value, demand, form, mainId, desc }
   Real game: server LLM returns the same JSON (constrained to the player's tools/inventions) + an image prompt;
   server moderates and clamps to RECIPE_CAPS. No credit is spent on {error}. */
const AIRecipeInterpreter = {
  async invent({ prompt, inventions, tools }) {
    const p = PromptStub.check(prompt); if (p.error) return p;
    const S = PromptStub, K = AI_KEYWORDS, text = String(prompt).trim().slice(0, 120);
    const words = p.words.map(w => S.singular(w));
    const content = p.words.filter(w => !K.stop.includes(w));
    const id = 'ar_' + p.h.toString(36);
    if (AIBackend.online) {
      if (state.aiRecipes[id]) return { error: 'You already know that recipe (no credit used)' };
      const inventory = { crops: Object.values(inventions).map(v => ({ id: v.id, name: v.name, base: v.base, source: v.source, value: v.baseValue })),
        tools: Object.keys(tools).map(k => ({ key: k, name: tools[k].name, recipes: tools[k].recipes || [] })) };
      const R = await AIBackend.post('api/recipe', { description: text, inventory }); if (R.error) return R;
      R.id = id; return R;
    }
    const invList = Object.values(inventions);
    // 1) ingredients: invented crops named in the text (by name words or seed name), optionally as a product (jam/juice/...)
    const prodWord = { jam: 'jam', juice: 'juice', pickle: 'pickles', pie: 'pie', cordial: 'cordial' };
    const used = new Set(), ings = [], requires = [];
    const needIdx = (kind, name, idea) => { let i = requires.findIndex(q => q.kind === kind && q.name === name); if (i < 0) { i = requires.length; requires.push({ kind, name, idea }); } return i; };
    const scored = invList.map(v => {
      const nameW = S.norm(v.name).split(' ').map(w => S.singular(w));
      const seedW = S.norm(BASES[v.base].name).split(' ').map(w => S.singular(w));
      const hit = nameW.filter(w => words.includes(w)).length * 2 + seedW.filter(w => words.includes(w)).length + (v.source === 'ai' ? 0.5 : 0);
      const at = Math.min(...[...nameW, ...seedW].map(w => words.indexOf(w)).filter(i => i >= 0), 99);
      return { v, hit, at, nameW };
    }).filter(x => x.hit >= 1).sort((a, b) => b.hit - a.hit || a.at - b.at);
    const pickedIds = [];
    for (const x of scored) { if (pickedIds.length >= 2) break; if (!pickedIds.some(id2 => inventions[id2].base === x.v.base)) pickedIds.push(x.v.id); }
    for (const vid of pickedIds) {
      const v = inventions[vid], x = scored.find(q => q.v.id === vid);
      // "cactus jam tarts": jam is an INGREDIENT only when another dish word follows it; "plum pie": pie is the dish itself
      const dishW = Object.values(RECIPE_FORM_WORDS).flat().concat(Object.values(RECIPE_STEP_WORDS).flatMap(t => t[1]));
      const ai2 = words.slice(x.at, x.at + 4).findIndex(w => prodWord[w] && RECIPES[prodWord[w]]);
      const after = ai2 >= 0 && dishW.includes(words[x.at + ai2 + 1]) ? words[x.at + ai2] : null;
      if (after) { used.add(after); ings.push({ key: `p|${vid}|${prodWord[after]}|${v.source}`, qty: 0 }); }
      else ings.push({ key: 'c|' + vid, qty: 0 });
      x.nameW.forEach(w => used.add(w));
    }
    // 1b) produce the dish names that this location doesn't grow yet -> a requirement to CREATE (never auto-added)
    const prodKeys = Object.keys(REQ_PRODUCE), seenProd = new Set();
    p.words.forEach(w0 => { const w = S.singular(w0);
      const k = REQ_PRODUCE[w] ? w : prodKeys.filter(x => x.length >= 4 && w.startsWith(x) && w !== x).sort((a, b) => b.length - a.length)[0];
      if (!k || seenProd.has(k) || PANTRY_STAPLES.includes(w)) return; seenProd.add(k);
      const name = REQ_PRODUCE[k], have = findCropFor(name);
      if (have && inventions[have]) { if (!ings.some(g => g.key === 'c|' + have)) ings.push({ key: 'c|' + have, qty: 0 }); return; }
      if (ings.length + 1 > RECIPE_CAPS.maxIngredients) return;
      const i = needIdx('crop', name, `plump ${name.toLowerCase()}`); ings.push({ need: i, qty: 0 });
    });
    if (!ings.length) { const basics = invList.filter(v => v.source === 'basic'); const v = basics[p.h % basics.length] || invList[0]; if (v) ings.push({ key: 'c|' + v.id, qty: 0 }); }
    if (!ings.length) { const i = needIdx('crop', 'Berry', 'plump berries'); ings.push({ need: i, qty: 0 }); }
    // 2) steps: tools in the order their keywords appear (+ AI tools whose name is mentioned)
    const steps = [];
    words.forEach(w => {
      if (used.has(w)) return;
      for (const t in RECIPE_STEP_WORDS) if (TOOLS[t] && RECIPE_STEP_WORDS[t][1].includes(w) && !steps.some(s => s.tool === t)) steps.push({ tool: t, action: RECIPE_STEP_WORDS[t][0] });
      for (const nm in REQ_TOOLS) if (REQ_TOOLS[nm][1].includes(w)) { // a technique no basic tool can do -> the dish needs a NEW tool
        const have = findToolFor(nm) || (nm === 'Juice Press' ? Object.keys(tools).find(k => (tools[k].recipes || []).some(r => DRINK_RECIPES.includes(r))) : null); // any invented drinks tool will do
        if (have) { if (!steps.some(s => s.tool === have)) steps.push({ tool: have, action: REQ_TOOLS[nm][0] }); }
        else { const i = needIdx('tool', nm, REQ_TOOLS[nm][2]); if (!steps.some(s => s.need === i)) steps.push({ need: i, action: REQ_TOOLS[nm][0] }); }
      }
      for (const k in tools) if (tools[k].source === 'ai' && S.norm(tools[k].name).split(' ').map(S.singular).includes(w) && !steps.some(s => s.tool === k)) steps.push({ tool: k, action: 'Use' });
    });
    if (!steps.length) steps.push({ tool: 'cookpot', action: 'Simmer' });
    steps.splice(RECIPE_CAPS.maxSteps);
    // 3) complexity -> stars
    const score = content.length + 2 * steps.length + 2 * ings.length + (/\b(with|and|topped|filled|plus)\b/.test(p.n) ? 1 : 0);
    const stars = Math.max(1, Math.min(RECIPE_CAPS.maxStars, Math.round(score / 4)));
    if (stars >= 3 && ings.length < 2) { // complex ideas need a second, basic ingredient (garnish/base)
      const basics = invList.filter(v => v.source === 'basic' && !pickedIds.includes(v.id));
      if (basics.length) ings.push({ key: 'c|' + basics[(p.h >>> 4) % basics.length].id, qty: 0 });
    }
    ings.splice(RECIPE_CAPS.maxIngredients);
    ings.forEach((g, i) => { g.qty = g.key && g.key.startsWith('p|') ? (stars >= 4 ? 3 : 2) : Math.min(4, 1 + Math.floor(stars / 2) + (i === 0 ? 1 : 0)); });
    // 4) stats (server-clamped)
    const valOf = k => { if (!k) return AI_CROP_MIN_VALUE; const [kind, vid, r] = k.split('|'), v = inventions[vid]; return kind === 'c' ? v.baseValue : Math.round(v.baseValue * RECIPES[r].mult); };
    const inputValue = ings.reduce((a, g) => a + valOf(g.key) * g.qty, 0);
    const out = 2;
    const value = Math.min(RECIPE_CAPS.maxValue, Math.round(inputValue * (1.1 + 0.15 * stars) / out * 1.6));
    const aiN = new Set(ings.map(g => g.key ? g.key.split('|')[1] : 'need' + g.need).filter(id => id.startsWith('need') || (inventions[id] && inventions[id].source === 'ai'))).size;
    const demand = Math.min(RECIPE_CAPS.maxDemand, demandStack({ ai: aiN, extras: ings.length - 1, stars }).demand); // stacked + capped
    const craftTime = 6 + 4 * stars + 2 * steps.length;
    const main = ings[0].key ? inventions[ings[0].key.split('|')[1]] : null;
    const form = S.match(RECIPE_FORM_WORDS, p.words) || 'jam';
    const head = p.n.split(/\b(?:with|topped|filled)\b/)[0].split(' ').filter(w => w && !K.stop.includes(w)).slice(-5);
    const name = (head.length ? head : content.slice(0, 4)).map(S.title).join(' ');
    const extra = p.n.includes(' with ') ? ' Finished ' + p.n.slice(p.n.indexOf(' with ') + 1) + '.' : '';
    return { id, type: 'recipe', source: 'ai', name, prompt: text, steps, ingredients: ings, requires, stars, craftTime, out, value, demand, form, mainId: main ? main.id : null,
      desc: `Your own recipe: ${steps.map(s => s.action.toLowerCase()).join(', then ')}.${extra}` };
  },
};

/* ===== AI IMAGE SERVICE (stub) =====
   Real build: the server's interpreter returns item data + an imagePrompt; after the SAME moderation pass the
   server generates the image, stores it, and returns a URL. The client downloads + caches it locally so the
   game stays playable offline. Image generation is included in the 1-credit cost.
   Crops: the AI only paints the FRUIT (growth stages come from the fixed preset library). Tools: full image.
   Prototype (offline): the internal image library (seeded with pre-generated art) is checked first; anything else gets a
   procedural composite "preview" (no real image is generated offline, so nothing new is added to the library). */
/* Offline demo only: the internal image library lives in this browser (the real one is server-side, shared by all players).
   Same rules as the server (ImageLibraryCore + IMAGE_LIBRARY_RULES.matchMin); never shown to the player. */
const ImageLibrary = {
  LS: 'mp_image_library',
  db() { try { const x = JSON.parse(localStorage.getItem(this.LS)); if (x && x.v === 2 && x.items) return x; } catch (e) { /* fresh */ }
    try { localStorage.removeItem('mp_directory'); } catch (e) { /* old player-facing Directory copy */ }
    const db = ImageLibraryCore.newDB(); this.save(db); return db; },
  save(db) { try { localStorage.setItem(this.LS, JSON.stringify(db)); } catch (e) { /* full */ } },
  lastLog: null, // dev handle: MP / devtools only
  lookup(kind, texts) {
    const db = this.db(), m = ImageLibraryCore.match(db, kind, texts), st = ImageLibraryCore.record(db, !!m, m && m.entry); this.save(db);
    this.lastLog = { kind, texts, hit: !!m, score: m ? m.score : (ImageLibraryCore.best(db, kind, texts) || {}).score || 0, entry: m ? m.entry.id : null, stats: { ...st } };
    console.debug('[image library]', m ? 'HIT' : 'miss', kind, m ? `${m.entry.name} (${m.score})` : '', `hits ${st.hits} / misses ${st.misses}, saved ~$${st.savedUsd.toFixed(2)}`);
    return m ? m.entry : null;
  },
};
const AIImageService = {
  fakeLatencyMs: [1200, 1800],
  imagePrompt(type, prompt, name) {
    if (type === 'recipe') return `Cozy cartoon mobile-game icon of a finished homemade dish: ${prompt}. Name: "${name}". Chunky dark-brown outlines, warm pastel palette, soft shading, served on a small plate or jar, centered, plain light background, no text.`;
    return type === 'tool'
      ? `Cozy cartoon mobile-game icon of a magical kitchen machine: ${prompt}. Name: "${name}". Chunky dark-brown outlines, warm pastel palette, soft shading, single object centered, plain light background, no text.`
      : `Cozy cartoon mobile-game icon of a single harvested fruit/produce (no plant, no soil): ${prompt}. Name: "${name}". Chunky dark-brown outlines, warm pastel palette, soft shading, centered, plain light background, no text.`;
  },
  async generate({ type, prompt, name }) {
    const [a, b] = this.fakeLatencyMs, h = PromptStub.hash(PromptStub.norm(prompt));
    await new Promise(r => setTimeout(r, a + (h % (b - a))));
    const imagePrompt = this.imagePrompt(type, prompt, name);
    const hit = ImageLibrary.lookup(type, [prompt, name]); // similar enough to an image already made? reuse it, no image call
    if (hit) return { imageUrl: hit.imageUrl, imagePrompt, imagePreview: false };
    return { imageUrl: null, imagePrompt, imagePreview: true, accessories: accessoriesFor(prompt) };
  },
};
