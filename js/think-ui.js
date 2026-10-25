/* Think It, Sell It! — the UI that puts creation at the centre.
   Loads after ui.js and before boot(): the Invention Workshop (home), named customers with reactions & haggling,
   the Town Board (weekly trend + contest), the Bazaar (publish / vote / buy / remix), surprise hits & flops with the
   Discovery Journal, and the 2-minute first-run tour. Every loop ends with a nudge back to the Workshop. */
let thinkType = 'crop', thinkDraft = '', thinkBusy = false;
const bz = { tab: 'top', loading: false, err: null, t: 0, pubRef: null, pubPrice: 20, pubPitch: '', pubErr: null, busy: false, flash: null };
const STAR_TXT = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const pctTxt = b => (b > 0 ? '+' : b < 0 ? '−' : '±') + Math.abs(Math.round(b * 1000) / 10) + '%';

/* ---------------- named customer portraits ---------------- */
function personaSVG(pid, size = 44, mood = 'neutral') {
  const P = CUSTOMERS[pid] || CUSTOMERS.pam, L = P.look, O = OUT;
  const skin = mood === 'gag' ? mix(L.skin, '#9ccc65', 0.45) : L.skin;
  let hair = `<path d="M14 27c0-15 32-15 32 0c-5-6-10-8-16-8s-11 2-16 8z" fill="${L.hair}" stroke="${O}" stroke-width="2"/>`;
  if (pid === 'tia') hair += `<path d="M15 26c-2 12 0 20 2 26M45 26c2 12 0 20-2 26" stroke="${L.hair}" stroke-width="6" stroke-linecap="round" fill="none"/>`;
  let hat = '';
  if (L.hat === 'bun') hat = `<circle cx="30" cy="10" r="6.5" fill="${L.hair}" stroke="${O}" stroke-width="2"/>`;
  if (L.hat === 'cap') hat = `<path d="M14 21c0-13 32-13 32 0z" fill="#6f8f4a" stroke="${O}" stroke-width="2"/><path d="M42 20h11" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
  if (L.hat === 'propeller') hat = `<path d="M15 21c0-15 30-15 30 0z" fill="#f2c94c" stroke="${O}" stroke-width="2"/><path d="M30 8V3" stroke="${O}" stroke-width="2"/><ellipse cx="24" cy="3" rx="6" ry="2" fill="#e86f5a" stroke="${O}" stroke-width="1.5"/><ellipse cx="36" cy="3" rx="6" ry="2" fill="#5aa9e6" stroke="${O}" stroke-width="1.5"/>`;
  if (L.hat === 'chef') hat = `<path d="M19 20c-7-2-7-13 2-13c2-7 16-7 18 0c9 0 9 11 2 13v3H19z" fill="#fff" stroke="${O}" stroke-width="2"/>`;
  let acc = '';
  if (L.acc === 'glasses') acc = `<circle cx="24" cy="28" r="5" fill="none" stroke="${O}" stroke-width="1.8"/><circle cx="36" cy="28" r="5" fill="none" stroke="${O}" stroke-width="1.8"/><path d="M29 28h2" stroke="${O}" stroke-width="1.8"/>`;
  if (L.acc === 'shades') acc = `<rect x="18" y="24" width="11" height="7" rx="3" fill="#2b2b2b"/><rect x="31" y="24" width="11" height="7" rx="3" fill="#2b2b2b"/><path d="M29 27h2" stroke="#2b2b2b" stroke-width="2"/>`;
  if (L.acc === 'mustache') acc = `<path d="M23 34c3-3 5-2 7 0c2-2 4-3 7 0c-3 3-5 2-7 1c-2 1-4 2-7-1z" fill="#e9e9e9" stroke="${O}" stroke-width="1.2"/>`;
  if (L.acc === 'bowtie') acc = `<path d="M30 49l-7-4v8zM30 49l7-4v8z" fill="#e86f5a" stroke="${O}" stroke-width="1.5"/>`;
  const eyes = L.acc === 'shades' ? '' : mood === 'gag' || mood === 'disgust' ? `<path d="M21 26l5 3l-5 2M39 26l-5 3l5 2" stroke="${O}" stroke-width="2" fill="none"/>` : `<circle cx="24" cy="28" r="2.2" fill="${O}"/><circle cx="36" cy="28" r="2.2" fill="${O}"/>`;
  const mouth = { delight: `<path d="M23 35q7 7 14 0z" fill="#8a3b2b" stroke="${O}" stroke-width="2"/>`, curious: `<circle cx="30" cy="37" r="2.6" fill="#8a3b2b" stroke="${O}" stroke-width="1.5"/>`,
    confused: `<path d="M25 37q3-2 5 0t5 0" stroke="${O}" stroke-width="2" fill="none"/>`, meh: `<path d="M25 37h10" stroke="${O}" stroke-width="2"/>`,
    disgust: `<path d="M24 39q6-6 12 0" stroke="${O}" stroke-width="2" fill="none"/>`, gag: `<path d="M23 37q2-3 4 0t4 0t4 0t3 0" stroke="${O}" stroke-width="2" fill="none"/><path d="M33 38q2 6 0 7" stroke="#6fbf4a" stroke-width="3" fill="none"/>` }[mood]
    || `<path d="M25 35q5 4 10 0" stroke="${O}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  return `<svg class="persona" viewBox="0 0 60 90" width="${size}" height="${size * 1.5}"><ellipse cx="30" cy="86" rx="16" ry="4" fill="#00000025"/>
   <path d="M12 86V58c0-12 36-12 36 0v28z" fill="${L.shirt}" stroke="${O}" stroke-width="2.5"/>${pid === 'rosa' ? `<path d="M22 52v30M38 52v30" stroke="#ddd" stroke-width="2"/>` : ''}
   <circle cx="30" cy="28" r="16" fill="${skin}" stroke="${O}" stroke-width="2.5"/>${hair}${eyes}${mouth}
   <circle cx="20" cy="33" r="3" fill="#ff9aa2" opacity=".6"/><circle cx="40" cy="33" r="3" fill="#ff9aa2" opacity=".6"/>${acc}${hat}</svg>`;
}
function faceSVG(pid, size = 34, mood) { return `<span class="face" style="width:${size}px;height:${size}px">${personaSVG(pid, size, mood)}</span>`; }

/* ---------------- WORKSHOP (home) ---------------- */
function xpBar() {
  const L = Think.level(), lo = 20 * (L - 1) * (L - 1), hi = 20 * L * L, p = Math.max(0, Math.min(1, (state.xp - lo) / (hi - lo)));
  return `<div class="xp" data-hook="xp"><b>Inventor Lv ${L}</b><span class="xpbar"><i style="width:${Math.round(p * 100)}%"></i></span><small>${state.xp}/${hi} XP</small></div>`;
}
function itemBadges(info, small) {
  const b = [];
  if (info.discovery && info.discovery.outcome === 'hit') b.push('<span class="tb hit">✨ Cult Classic</span>');
  if (info.discovery && info.discovery.outcome === 'flop') b.push('<span class="tb flop">😬 Flop</span>');
  if (info.trending) b.push('<span class="tb trend">🔥 Trending</span>');
  if (info.buzz && info.buzz.n) b.push(`<span class="tb buzz">★${info.buzz.avg.toFixed(1)}${small ? '' : ` <i>(${info.buzz.n})</i>`}</span>`);
  if (info.rank && info.rank.bonus) b.push(`<span class="tb bzr ${info.rank.bonus < 0 ? 'neg' : ''}">🎪 #${info.rank.rank} ${pctTxt(info.rank.bonus)}</span>`);
  return b.join('');
}
function spokes() {
  const tr = Think.trend(), ripe = state.plots.filter(p => p.inv && Game.plotProgress(p) >= 1).length, f = state.feed[0];
  const top = (Bazaar.items || []).find(x => !x.mine), mine = (Bazaar.items || []).filter(x => x.mine);
  const tiles = [
    ['farm', '🌱', 'Farm', ripe ? `${ripe} plot${ripe > 1 ? 's' : ''} ready to pick` : 'Grow what you invent'],
    ['kitchen', '🍯', 'Kitchen', state.hints[0] ? state.hints[0].text : 'Combine ingredients: hit or flop?'],
    ['market', '🧺', 'Market', f ? `${CUSTOMERS[f.pid].name}: ${STAR_TXT(f.stars).slice(0, 5)} ${esc(shortName(f.name))}` : 'Customers rate your ideas'],
    ['bazaar', '🎪', 'Bazaar', mine.length ? `Your ${mine.length} idea${mine.length > 1 ? 's' : ''} · best #${Math.min(...mine.map(x => x.rank))}` : top ? `Top: ${esc(top.name)}` : 'Publish, vote, remix'],
    ['town', '📋', 'Town Board', `${tr.emoji} ${tr.name}${state.week.entry ? ' · entered ✓' : ' · contest open'}`],
  ];
  return `<div class="spokes">${tiles.map(([t, i, n, s]) => `<button class="spoke card" data-act="th-goto" data-tab="${t}"><i>${i}</i><b>${n}</b><small>${s}</small></button>`).join('')}</div>`;
}
function coachInline(where) {
  const o = state.onb; if (o === 'done' || !state.seenTitle) return '';
  const skip = '<button class="link" data-act="tour-skip">skip tour</button>';
  if (where === 'workshop' && o === 1) return `<div class="coach-in" data-hook="coach-1"><b>👋 Welcome, inventor!</b> Type <u>any</u> idea in the box — your first one is <b>free</b> 🎁 — then sell it to a real customer. ${skip}</div>`;
  if (where === 'workshop' && o === 2 && state.onbKey && itemInfo(state.onbKey)) return `<div class="coach-in" data-hook="coach-2"><b>🎉 ${esc(itemInfo(state.onbKey).name)} is ready!</b> <button class="btn sm" data-act="sell-new" data-key="${state.onbKey}">🧺 Sell it now</button> ${skip}</div>`;
  if (where === 'sheet' && o === 2) return `<div class="coach-in sheet-coach" data-hook="coach-2">👉 <b>Step 2:</b> put it on your stall and meet your first customer!</div>`;
  return '';
}
function workshopHTML() {
  const ent = Entitlements, insp = Think.inspirations(), shelf = Think.shelf(), tr = Think.trend();
  const ph = { crop: 'e.g. a pumpkin that whispers ghost stories', tool: 'e.g. a kettle that bakes muffins while it whistles', recipe: 'e.g. glow-in-the-dark plum jam' }[thinkType];
  return `<div class="workshop" data-hook="workshop-home">
   <div class="ws-head"><h2>💡 Invention Workshop</h2>${xpBar()}</div>
   ${coachInline('workshop')}
   <div class="think-box card ${state.onb === 1 ? 'glow-on' : ''}" data-hook="think-box">
     <div class="tb-top"><span class="tb-title">Think It!</span><span class="tb-sub">…then sell it.</span>${aiModeBadge()}</div>
     <div class="tb-types">${[['crop', '🌱 Crop'], ['tool', '🔧 Tool'], ['recipe', '🍲 Recipe']].map(([k, l]) => `<button class="tchip ${thinkType === k ? 'sel' : ''}" data-act="think-type" data-k="${k}">${l}</button>`).join('')}</div>
     <div class="ws-slots" data-hook="ws-slots"><span class="pill ${Slots.full(thinkType) ? 'miss' : ''}">${Slots.text(thinkType)}</span>${Slots.full(thinkType) ? `<button class="link" data-act="slots-full" data-type="${thinkType}">full · manage</button>` : ''}</div>
     <textarea class="think-ta" id="think-ta" maxlength="140" rows="2" placeholder="${ph}">${esc(thinkDraft)}</textarea>
     <div class="tb-row"><button class="btn ai big-ish ${thinkBusy ? 'disabled' : ''} ${ent.canUseAI() ? '' : 'locked'}" data-act="think-go">${thinkBusy ? '✨ Thinking…' : '✨ Think It!'} <small>(1 credit)</small></button>
       <span class="tb-cred">${ent.aiCredits} credit${ent.aiCredits === 1 ? '' : 's'}${state.ent.starterGrantGiven && ent.aiCredits > 0 && !ent.subscribed ? '<br><b>🎁 1st idea free</b>' : ''}${ent.aiCredits === 0 ? `<br><button class="link" data-act="ooc" data-hook="get-credit">Get 1 for ${Store.products.ai_credits_1.price}</button>` : ''}</span></div>
     ${aiErr && aiErr.type === thinkType ? `<p class="ai-err">⚠️ ${esc(aiErr.msg)}</p>` : ''}
   </div>
   <h3 class="sub">✨ Inspiration <small class="muted">tap to fill the box</small></h3>
   <div class="insp" data-hook="inspiration">${insp.slice(0, 7).map(x => `<button class="insp-chip ${x.kind}" data-act="think-fill" data-prompt="${esc(x.prompt)}" data-type="${x.kind === 'remix' ? (Bazaar.items.find(b => b.id === x.bz) || {}).kind || 'crop' : 'crop'}" ${x.kitchen && !x.prompt ? 'data-goto="kitchen"' : ''}><i>${x.icon}</i><span><small>${esc(x.who)}</small>${esc(x.text)}</span></button>`).join('')}</div>
   ${bestTeaser()}
   <h3 class="sub">🗄️ Your inventions <small class="muted">${shelf.length} · tap for reviews</small> <button class="link" data-act="jr-open">📔 Journal</button></h3>
   <div class="shelf" data-hook="shelf">${shelf.length ? shelf.slice(0, 12).map(i => `<button class="sh-item ${i.discovery ? i.discovery.outcome : ''}" data-act="stats" data-key="${i.key}">${i.icon(48)}<b>${esc(i.name)}</b><span class="sh-b">${itemBadges(i, 1)}</span></button>`).join('')
      : '<p class="muted small">Nothing yet. Your first invention will sit right here.</p>'}</div>
   <h3 class="sub">🧭 Where your ideas go</h3>${spokes()}
   <div class="ws-classic">`;
}
const renderLabClassic = renderLab;
renderLab = function () {
  renderLabClassic();
  const el = $('#screen-lab');
  el.innerHTML = workshopHTML() + el.innerHTML.replace('⚗️ Invention Lab', '🧪 Free Mix Lab').replace('<span class="badge free">Free inventor</span>', '<span class="badge free">No credits</span>') + '</div></div>';
  sigs.ws = workshopSig();
};
function workshopSig() { return [Entitlements.aiCredits, state.xp, state.wishes.map(w => w.text).join(), state.hints.length, state.order.length, Object.keys(state.aiRecipes).length,
  Object.keys(state.discoveries).length, Slots.text(thinkType), Object.keys(state.tools).length, state.stats.sold, state.week.n, state.week.entry && state.week.entry.key, state.onb, (state.bzCache || []).length, state.feed[0] && state.feed[0].t, Object.keys(state.buzz).length, thinkBusy].join('|'); }
async function thinkGo(btn, o = {}) {
  const ta = $('#think-ta'), text = (ta ? ta.value : thinkDraft).trim();
  if (text.length < 3) { toast('Type an idea first ✏️'); ta && ta.focus(); return; }
  thinkDraft = text;
  if (Slots.full(thinkType)) { openSheet(slotsFullSheet(thinkType)); return; } // full: nothing spent, delete one first
  if (!Entitlements.canUseAI()) { openSheet(outOfCreditsSheet(() => thinkGo(null, { fresh: true }), text)); return; } thinkBusy = true; renderLab();
  Promise.resolve(runAI(thinkType, text, null)).then(res => { thinkBusy = false; if (res && res.ok) thinkDraft = ''; if (activeTab === 'lab') renderLab(); });
}
function onInvented(type, res) {
  if (!res || !res.ok) return;
  if (state.onb === 1 && type === 'crop') { state.onb = 2; state.onbKey = 'c|' + res.inv.id; save(); }
  if (type === 'crop' && $('.sheet .sell-now')) $('.sheet .sell-now').insertAdjacentHTML('beforebegin', coachInline('sheet'));
}
/* "Sell it now": stockroom -> a stall basket -> the Market, with a hand-picked first customer */
function sellNow(key) {
  const info = itemInfo(key); if (!info) return;
  for (const l of ['basket', 'pantry', 'ready']) moveItem(key, l, 'stock');
  if (!qtyAt('stock', key) && !state.stall.some(s => s && s.key === key)) { toast('Nothing to sell yet'); return; }
  let slot = state.stall.findIndex(s => s && s.key === key);
  if (slot < 0) { slot = state.stall.findIndex(s => !s); if (slot < 0) slot = state.stall.reduce((b, s, i) => s.qty < state.stall[b].qty ? i : b, 0);
    Game.stock(slot, key, qtyAt('stock', key), Math.max(2, Math.round(info.value * 1.15))); }
  closeSheet(); setTab('market');
  const tour = state.onb === 2;
  if (tour) { state.onb = 3; save(); }
  const pid = Think.bestPersona(key);
  setTimeout(() => animateCustomer({ slot, seed: Math.floor(Math.random() * 1000), roll: tour ? 0 : Math.random() * 0.4, persona: pid, force: tour, tour }), 700);
  toast(`🧺 ${info.name} is on the stall!`);
}

/* ---------------- MARKET: named customers, reactions, haggling ---------------- */
const basketHTMLClassic = basketHTML;
basketHTML = function (i) {
  const h = basketHTMLClassic(i), s = state.stall[i]; if (!s) return h;
  const info = itemInfo(s.key), bad = [];
  if (info.trending) bad.push('<i class="bb trend" title="Trending this week">🔥</i>');
  if (info.discovery) bad.push(info.discovery.outcome === 'hit' ? '<i class="bb hit" title="Cult Classic">✨</i>' : '<i class="bb flop" title="Flop">😬</i>');
  if (info.buzz && info.buzz.n >= 2) bad.push(`<i class="bb buzz" title="Buzz">★${info.buzz.avg.toFixed(1)}</i>`);
  if (info.rank && info.rank.bonus) bad.push(`<i class="bb bzr" title="Bazaar rank">🎪${pctTxt(info.rank.bonus)}</i>`);
  return bad.length ? h.replace(/<\/button>\s*$/, `<span class="bk-badges">${bad.join('')}</span></button>`) : h;
};
const renderMarketClassic = renderMarket;
renderMarket = function () {
  renderMarketClassic();
  const tr = Think.trend(), sign = $('#mkt-scene .hang-sign');
  if (sign && sign.dataset.w !== String(state.week.n)) { sign.innerHTML = `<small>TRENDING</small><br>${tr.emoji} ${tr.name}`; sign.dataset.act = 'th-goto'; sign.dataset.tab = 'town'; sign.dataset.w = state.week.n; sign.classList.add('trend-sign'); sign.setAttribute('data-hook', 'trend-sign'); }
  if (!$('#stall-awards')) $('#mkt-scene').insertAdjacentHTML('beforeend', '<div id="stall-awards" class="stall-awards" data-hook="stall-awards"></div><div id="haggle" class="haggle" data-hook="haggle"></div><div id="coach" class="coach"></div>');
  const aw = state.trophies.slice(0, 4).map(t => `<span class="award" title="${esc(t.label)} · week ${t.week}">${t.award}</span>`).join('');
  if ($('#stall-awards').innerHTML !== aw) $('#stall-awards').innerHTML = aw;
  if (!$('#mkt-feed')) $('.mkt-panel').insertAdjacentHTML('afterbegin', '<div id="mkt-feed" class="mkt-feed" data-hook="reactions-feed"></div>');
  renderFeed();
};
function renderFeed() {
  const el = $('#mkt-feed'); if (!el) return;
  const sig = state.feed.length + ':' + (state.feed[0] ? state.feed[0].t : 0) + ':' + state.wishes.length; if (el.dataset.sig === sig) return; el.dataset.sig = sig;
  const f = state.feed.slice(0, 3), wish = state.wishes[0];
  el.innerHTML = `<div class="feed-h"><b>💬 What customers say</b><small class="muted">ratings → Buzz → demand</small></div>
    ${f.length ? f.map(e => `<div class="feed-row ${e.bought ? 'sold' : ''}">${faceSVG(e.pid, 30, e.mood)}<div><b>${CUSTOMERS[e.pid].name}</b> <span class="st">${STAR_TXT(e.stars)}</span> <small class="muted">${esc(shortName(e.name))}${e.bought ? ` · bought ${e.price}¢` : ''}</small><br><q>${esc(e.line)}</q></div></div>`).join('')
      : '<p class="muted small">No one has visited yet. Customers rate every idea from ★ to ★★★★★.</p>'}
    ${wish ? `<div class="wish-row">💭 <b>${CUSTOMERS[wish.who] ? CUSTOMERS[wish.who].name : 'A customer'}</b> wishes someone made <b>${esc(wish.text)}</b> <button class="btn sm ai" data-act="think-fill" data-prompt="${esc(wish.text)}" data-type="crop">💡 Invent it</button></div>` : ''}`;
}
function sayAt(el, x, html, cls) {
  const bub = el.querySelector('.bubble'), sr = $('#mkt-scene').getBoundingClientRect(), W = Math.min(196, sr.width - 12);
  bub.className = 'bubble say ' + (cls || ''); bub.style.width = W + 'px';
  bub.style.left = Math.max(6 - x, Math.min(22 - W / 2, sr.width - 6 - W - x)) + 'px';
  bub.innerHTML = html; requestAnimationFrame(() => bub.classList.add('show'));
}
function animateCustomer(c) {
  const lane = $('#lane'), scene = $('#mkt-scene'), b = document.querySelector(`[data-slot="${c.slot}"]`);
  c.persona = c.persona || Think.persona(c.seed);
  if (!lane || !b || activeTab !== 'market' || (liveCustomers >= 4 && !c.tour)) { Market.resolve(c); return; }
  liveCustomers++;
  const sr = scene.getBoundingClientRect(), br = b.getBoundingClientRect(), pid = c.persona, P = CUSTOMERS[pid];
  const x = Math.max(0, Math.min(sr.width - 44, br.left - sr.left + br.width / 2 - 22)), fromLeft = Math.random() < 0.5;
  const el = document.createElement('div'); el.className = 'cust persona-' + pid; el.dataset.pid = pid;
  el.innerHTML = `<div class="cust-body">${personaSVG(pid, 44)}</div><div class="cust-name">${P.name}</div><div class="bubble"></div>`;
  el.style.left = (fromLeft ? -50 : sr.width + 10) + 'px'; lane.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.left = x + 'px'; }));
  const leave = (after = 2600) => { setTimeout(() => { el.style.left = (fromLeft ? sr.width + 10 : -60) + 'px'; el.classList.add('leaving'); const bb = el.querySelector('.bubble'); if (bb) bb.classList.remove('show'); }, after); setTimeout(() => { el.remove(); liveCustomers--; }, after + 1800); };
  setTimeout(() => {
    const r = Market.resolve({ ...c, interactive: activeTab === 'market' && state.onb === 'done' && !c.tour });
    if (!r.react) { sayAt(el, x, r.bought ? 'Sold!' : 'Hmm, maybe later', r.bought ? 'yes' : 'no'); if (r.bought) { coinPop(x + 22, r.price); renderMarket(); updateCoins(); } leave(1200); return; }
    const rr = r.react; el.querySelector('.cust-body').innerHTML = personaSVG(pid, 44, rr.mood);
    el.classList.add('mood-' + rr.mood);
    const head = `<b>${P.name}</b> <span class="st s${rr.stars}">${STAR_TXT(rr.stars)}</span>`;
    if (r.haggle) { sayAt(el, x, `${head}<br>“${esc(rr.line)}”`, 'ask'); showHaggle(el, x, rr, leave); renderFeed(); return; }
    sayAt(el, x, `${head}<br>“${esc(rr.line)}”${r.bought ? `<em class="paid">+${r.price}¢</em>` : ''}`, r.bought ? 'yes' : 'no');
    if (r.bought) { coinPop(x + 22, r.price); renderMarket(); updateCoins(); }
    renderFeed();
    if (r.wish) setTimeout(() => { if (el.isConnected) sayAt(el, x, `💭 “I wish someone made <b>${esc(r.wish)}</b>…”`, 'wish'); }, 2300);
    if (c.tour) { state.onb = 4; state.onbStars = rr.stars; state.onbPid = pid; state.onbPrice = r.price; if (state.onbT0) state.onbMs = now() - state.onbT0; save(); renderCoach(); }
    leave(r.wish ? 4400 : 2900);
  }, 1700);
}
/* haggle card: Accept / Counter / Decline, up to 2 rounds, auto-declines after 12s */
let hgTimer = null, hgCtx = null;
function showHaggle(el, x, rr, leave) {
  hgCtx = { el, x, rr, leave }; drawHaggle();
  clearTimeout(hgTimer); hgTimer = setTimeout(() => { if (Think.haggle) haggleDo('decline', true); }, 12000);
}
function drawHaggle(msg) {
  const h = Think.haggle, box = $('#haggle'); if (!box) return;
  if (!h) { box.classList.remove('show'); return; }
  const P = CUSTOMERS[h.pid], info = itemInfo(h.key), mid = Math.round((h.offer + h.ask) / 2);
  box.innerHTML = `<div class="hg-card card" data-hook="haggle-card">${faceSVG(h.pid, 40, 'curious')}<div class="hg-body">
     <div class="hg-h"><b>${P.name}</b> wants to haggle <small>round ${h.round}/2</small></div>
     <div class="hg-say">${msg || `“${esc(shortName(info.name))} for <b>${h.offer}¢</b>? You're asking ${h.ask}¢.”`}</div>
     <div class="hg-btns"><button class="btn sm" data-act="hg-accept">✅ ${h.offer}¢</button><button class="btn sm ghost" data-act="hg-counter">🤝 Counter ${mid}¢</button><button class="btn sm danger" data-act="hg-decline">✕</button></div>
     <span class="hg-timer"><i></i></span></div></div>`;
  box.classList.add('show');
}
function haggleDo(kind, timeout) {
  const h = Think.haggle, ctx = hgCtx; if (!h || !ctx) return;
  const say = (html, cls) => { if (ctx.el.isConnected) sayAt(ctx.el, ctx.x, html, cls); };
  let r;
  if (kind === 'accept') { r = Think.haggleAccept(h.offer); if (r.ok) { say(`🤝 Deal! <em class="paid">+${r.price}¢</em>`, 'yes'); coinPop(ctx.x + 22, r.price); } else say('Oh, sold out!', 'no'); }
  else if (kind === 'counter') {
    r = Think.haggleCounter();
    if (r.outcome === 'accepted') { say(`😄 ${r.price}¢? You drive a hard bargain. Deal! <em class="paid">+${r.price}¢</em>`, 'yes'); coinPop(ctx.x + 22, r.price); }
    else if (r.outcome === 'recounter') { drawHaggle(`“Hmm… meet me at <b>${r.offer}¢</b>?”`); say(`How about ${r.offer}¢?`, 'ask'); clearTimeout(hgTimer); hgTimer = setTimeout(() => { if (Think.haggle) haggleDo('decline', true); }, 12000); return; }
    else say('Too rich for me! Bye!', 'no');
  } else { Think.haggleDecline(); say(timeout ? 'Never mind, then!' : 'Fair enough! Maybe next time.', 'no'); }
  clearTimeout(hgTimer); hgCtx = null; drawHaggle(); renderMarket(); updateCoins(); ctx.leave(1500);
}
/* the first-run tour, step 3-4 overlay (pointer-events only on its buttons, so it never blocks the game) */
function renderCoach() {
  const el = $('#coach'); if (!el) return;
  const o = state.onb, show = activeTab === 'market' && (o === 3 || o === 4);
  if (!show) { el.classList.remove('show'); return; }
  const k = state.onbKey && itemInfo(state.onbKey), name = k ? esc(k.name) : 'your idea';
  const html = o === 3 ? `<b>👀 Here comes your first customer!</b><br>Everyone has opinions. Watch them react to ${name}.`
    : `<b>⭐ ${CUSTOMERS[state.onbPid] ? CUSTOMERS[state.onbPid].name : 'They'} gave it ${state.onbStars}★ and paid ${state.onbPrice || 0}¢!</b><br>Ratings build <b>Buzz</b> → more buyers. Wishes turn into new ideas.<div class="coach-btns"><button class="btn sm ai" data-act="tour-done">💡 Invent the next one</button></div>`;
  if (el.dataset.k !== o + html.length) { el.innerHTML = `<div class="coach-card" data-hook="coach-${o}">${html}<button class="link" data-act="tour-skip">${o === 4 ? 'close' : 'skip'}</button></div>`; el.dataset.k = o + html.length; }
  el.classList.add('show');
}

/* ---------------- TOWN BOARD: weekly trend + contest ---------------- */
function timeLeft() { const ms = Math.max(0, TREND_RULES.weekMs - (now() - state.week.t0)), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); return d ? `${d}d ${h}h` : `${h}h ${m}m`; }
function contestCandidates() {
  const keys = new Set(Think.shelf().map(i => i.key));
  Object.keys(state.itemStats).filter(k => state.itemStats[k].sold > 0).forEach(k => keys.add(k));
  state.stall.forEach(s => s && keys.add(s.key));
  return [...keys].map(k => itemInfo(k)).filter(Boolean).map(i => ({ info: i, sc: Think.contestScore(i.key) })).sort((a, b) => b.sc.total - a.sc.total);
}
function scoreBars(sc) {
  const W = CONTEST.weights, lab = { buzz: '⭐ Buzz', ratings: '🗳️ Ratings', sales: '🛒 Sales', trend: '🔥 Trend', cult: '✨ Cult' };
  return `<div class="sbars">${Object.keys(sc.parts).map(k => `<div class="sbar"><span>${lab[k]}</span><i><b style="width:${Math.round(100 * sc.parts[k] / (W[k] || 5))}%"></b></i><em>${sc.parts[k]}/${W[k] || 5}</em></div>`).join('')}</div>`;
}
function standings(me) {
  const rows = [...Think.rivals().map(r => ({ ...r, total: r.score })), ...(me ? [{ who: 'You', entry: me.name, total: me.total, you: true }] : [])].sort((a, b) => b.total - a.total);
  return `<ol class="standings">${rows.map((r, i) => `<li class="${r.you ? 'you' : ''}"><span class="pl">${['🥇', '🥈', '🥉'][i] || i + 1 + '.'}</span><span class="who ${r.sample ? 'sample' : ''}">${esc(r.who)}</span><span class="en">${esc(r.entry)}</span><b>${r.total}</b></li>`).join('')}</ol>`;
}
function renderTown() {
  const el = $('#screen-town'), w = state.week, tr = Think.trend(), nx = Think.nextTrend();
  const mine = contestCandidates().filter(x => x.info.trending).slice(0, 4);
  const e = w.entry && itemInfo(w.entry.key), sc = e && Think.contestScore(w.entry.key);
  el.innerHTML = `<div class="panel-title"><h2>📋 Town Board</h2><span class="badge week">Week ${w.n}</span></div>
   <div class="board" data-hook="town-board">
    <div class="note trend-note pin-r"><div class="tn-h">📌 This week's trend</div>
      <div class="tn-big">${tr.emoji} ${tr.name}</div><p>${tr.blurb}</p>
      <div class="tn-bonus">🔥 Matching items get <b>+${Math.round((TREND_RULES.demandBonus - 1) * 100)}% demand</b> and a <span class="tb trend">🔥 Trending</span> badge</div>
      <div class="tn-mine">${mine.length ? 'Yours: ' + mine.map(x => `<span class="chip">${x.info.icon(20)}${esc(x.info.name)}</span>`).join('') : '<span class="muted small">None of your items match yet.</span>'}</div>
      <div class="tn-prompts">${tr.prompts.map(p => `<button class="insp-chip trend sm" data-act="think-fill" data-prompt="${esc(p)}" data-type="crop"><i>💡</i><span>${esc(p)}</span></button>`).join('')}</div>
      <div class="tn-time">⏳ ends in ${timeLeft()}</div></div>
    <div class="note contest-note pin-l" data-hook="contest"><div class="tn-h">🏆 Weekly Invention Contest</div>
      ${e ? `<div class="entry-row">${e.icon(46)}<div><b>${esc(e.name)}</b><br><small class="muted">your entry · live score</small></div><div class="big-score">${sc.total}<small>/100</small></div></div>${scoreBars(sc)}${standings({ name: e.name, total: sc.total })}
            <button class="btn sm ghost" data-act="town-enter">Change entry</button>`
        : `<p>Enter <b>one</b> invention. Judged on <b>buzz</b> (${CONTEST.weights.buzz}), <b>ratings</b> (${CONTEST.weights.ratings}), <b>sales</b> (${CONTEST.weights.sales}) and <b>trend match</b> (${CONTEST.weights.trend}).</p>
           ${standings(null)}<button class="btn wide" data-act="town-enter" data-hook="contest-enter">🏆 Enter an invention</button>`}
      <div class="prizes">${CONTEST.prizes.map(p => `<span>${p.award} ${p.place < 99 ? '#' + p.place : 'others'} · ${p.coins}¢</span>`).join('')}</div>
      <p class="muted small">Prizes are coins + cosmetic ribbons/trophies shown at your stall. Nothing with real-money value.</p></div>
    <div class="note trophy-note"><div class="tn-h">🎀 Trophy case</div>${state.trophies.length ? `<div class="trophies">${state.trophies.slice(0, 8).map(t => `<span class="tro" title="${esc(t.item)}">${t.award}<small>W${t.week}</small></span>`).join('')}</div><small class="muted">Shown on your market stall.</small>` : '<span class="muted small">Win a ribbon and it hangs on your stall.</span>'}</div>
    <div class="note next-note"><div class="tn-h">🔮 Next week</div><b>${nx.emoji} ${nx.name}</b> — get a head start: <button class="insp-chip trend sm" data-act="think-fill" data-prompt="${esc(nx.prompts[0])}" data-type="crop"><i>💡</i><span>${esc(nx.prompts[0])}</span></button></div>
    ${w.history.length ? `<div class="note hist-note"><div class="tn-h">📜 Past weeks</div>${w.history.slice(0, 4).map(h => `<div class="hist">W${h.week} ${h.trend.emoji} ${h.trend.name}: ${h.skipped ? '<span class="muted">no entry</span>' : `${h.prize.award} #${h.place} with ${esc(h.me.entry)} (${h.me.total})`} ${h.skipped ? '' : `<button class="link" data-act="town-results" data-w="${h.week}">results</button>`}</div>`).join('')}</div>` : ''}
    <button class="btn sm ghost dev" data-act="town-advance" data-hook="dev-advance-week">⏩ Advance week <small>(dev)</small></button>
   </div>`;
  sigs.town = townSig();
}
function townSig() { const e = state.week.entry; return [state.week.n, e && e.key, e && Think.contestScore(e.key).total, timeLeft(), state.trophies.length, Object.keys(state.buzz).length].join('|'); }
function enterSheet() {
  return () => { const c = contestCandidates();
    return `<div class="sheet-h"><h3>🏆 Pick your entry</h3><button class="x" data-act="close">✕</button></div>
      <p class="muted small">Live score now · keeps rising as customers rate and buy it this week.</p>
      <div class="list">${c.length ? c.map(x => `<button class="row" data-act="town-submit" data-key="${x.info.key}">${x.info.icon(40)}<div><b>${esc(x.info.name)}</b> ${itemBadges(x.info, 1)}<br><small>score ${x.sc.total}/100 · ${Object.entries(x.sc.parts).map(([k, v]) => k + ' ' + v).join(' · ')}</small></div></button>`).join('')
        : '<p class="muted">Invent and sell something first.</p><button class="btn wide ai" data-act="th-goto" data-tab="lab">💡 To the Workshop</button>'}</div>`; };
}
function resultsSheet(r) {
  const fn = () => {
    if (r.skipped) return `<div class="sheet-h"><h3>📋 Week ${r.week} is over</h3><button class="x" data-act="close">✕</button></div><p>${r.trend.emoji} ${r.trend.name} has ended. You didn't enter the contest this time.</p>${nextNudge()}`;
    return `<div class="sheet-h"><h3>🏆 Week ${r.week} results</h3><button class="x" data-act="close">✕</button></div>
     <div class="res" data-hook="contest-results"><div class="res-trend">${r.trend.emoji} ${r.trend.name}</div>
      <div class="podium">${r.board.slice(0, 3).map((x, i) => `<div class="pod p${i + 1} ${x.you ? 'you' : ''}"><span class="medal">${['🥇', '🥈', '🥉'][i]}</span><b class="${x.sample ? 'sample' : ''}">${esc(x.who)}</b><small>${esc(x.entry)}</small><em>${x.total}</em></div>`).join('')}</div>
      ${standingsFrom(r.board)}
      <div class="res-prize card"><span class="big-award">${r.prize.award}</span><div><b>You placed #${r.place}!</b><br>+${r.prize.coins}¢ · ${r.prize.label} <small>(hangs on your stall)</small></div></div>
      <h4>Your score: ${r.me.total}/100</h4>${scoreBars(r.me)}
      ${nextNudge()}</div>`;
  };
  return fn;
}
function standingsFrom(board) { return `<ol class="standings">${board.map((x, i) => `<li class="${x.you ? 'you' : ''}"><span class="pl">${i + 1}.</span><span class="who ${x.sample ? 'sample' : ''}">${esc(x.who)}</span><span class="en">${esc(x.entry)}</span><b>${x.total}</b></li>`).join('')}</ol>`; }
function nextNudge() { const t = Think.trend(); return `<div class="nudge card"><b>Now trending: ${t.emoji} ${t.name}</b><br><small>Invent something for it. Trending items sell ${Math.round((TREND_RULES.demandBonus - 1) * 100)}% better.</small><button class="btn wide ai" data-act="think-fill" data-prompt="${esc(t.prompts[0])}" data-type="crop">💡 Invent for this week's trend</button></div>`; }

/* ---------------- BAZAAR: publish, vote, buy seeds, remix ---------------- */
function bzIcon(it, size = 52) {
  const p = it.payload || {};
  if (p.imageUrl) return aiImgTag(p.imageUrl, size, '');
  if (it.kind === 'crop' && BASES[p.base] && TRAITS[p.trait]) return cropIcon({ base: p.base, trait: p.trait, source: 'basic', color: p.color, id: 'bzv' }, size);
  if (it.kind === 'recipe' && RECIPES[p.form]) { const inv = Object.values(state.inventions)[0]; return productIcon(inv, p.form, size, 'ai'); }
  return `<span class="bz-tool" style="width:${size}px;height:${size}px;filter:hue-rotate(${p.hue || 0}deg)">🔧</span>`;
}
function bzLoad(force) {
  if (bz.loading || (!force && now() - bz.t < 15000)) return;
  bz.loading = true; bz.t = now();
  Bazaar.list().then(r => { bz.loading = false; bz.err = r && r.error ? r.error : null; if (activeTab === 'bazaar') renderBazaar(); });
}
function bzEffect(it) {
  if (it.kind !== 'crop') return `<span class="eff none">Rank sets the price band (no demand effect for ${it.kind}s)</span>`;
  if (it.voters < BAZAAR_RULES.minVotesForBonus) return `<span class="eff none">Needs ${BAZAAR_RULES.minVotesForBonus} voters to move demand (has ${it.voters})</span>`;
  if (!it.bonus) return '<span class="eff none">±0% demand</span>';
  return `<span class="eff ${it.bonus > 0 ? 'up' : 'down'}">${it.bonus > 0 ? '📈' : '📉'} ${pctTxt(it.bonus)} demand for ${esc(it.name)} · market-wide</span>`;
}
function bzCard(it) {
  const lv = Think.level(), canVote = lv >= BAZAAR_RULES.voteMinLevel && !it.mine;
  return `<div class="bz-card card ${it.mine ? 'mine' : ''} ${bz.flash === it.id ? 'flash' : ''}" data-id="${it.id}" data-hook="bazaar-item">
    <div class="bz-vote ${canVote ? '' : 'locked'}"><button class="vb up ${it.myVote > 0 ? 'on' : ''}" data-act="bz-vote" data-id="${it.id}" data-v="1" aria-label="Upvote">▲</button>
      <b class="sc">${it.score >= 0 ? '' : '−'}${Math.abs(it.score).toFixed(1)}</b><button class="vb down ${it.myVote < 0 ? 'on' : ''}" data-act="bz-vote" data-id="${it.id}" data-v="-1" aria-label="Downvote">▼</button><small>${it.voters} vote${it.voters === 1 ? '' : 's'}</small></div>
    <div class="bz-ico">${bzIcon(it, 52)}<span class="rank">#${it.rank}</span></div>
    <div class="bz-main"><b class="nm">${esc(it.name)}</b> <span class="kind ${it.kind}">${{ crop: '🌱 seeds', tool: '🔧 tool plan', recipe: '🍲 recipe card' }[it.kind]}</span>
      <div class="by ${it.sample ? 'sample' : ''}">by ${esc(it.creator)}${it.mine ? ' <b>(you)</b>' : ''}</div>
      ${it.pitch ? `<q class="pitch">${esc(it.pitch)}</q>` : ''}
      <div class="bz-eff">${bzEffect(it)}</div>
      <div class="bz-meta"><span>${coinSVG(12)} <b>${it.price}¢</b> <small>${it.band.tier} band ${it.band.min}–${it.band.max}¢</small></span><span>📦 ${it.stockLeft}/${BAZAAR_RULES.stockPerItemPerWeek} this week</span><span>🛒 ${it.buys}</span>${it.copies ? `<span>🔁 ${it.copies}</span>` : ''}</div>
      ${it.mine ? `<div class="bz-acts"><span class="muted small">Royalties waiting: <b>${it.royaltyPending || 0}¢</b></span></div>`
        : `<div class="bz-acts"><button class="btn sm ${state.coins < it.price || !it.stockLeft ? 'disabled' : ''}" data-act="bz-buy" data-id="${it.id}">Buy ${it.kind === 'crop' ? 'seeds' : ''} ${it.price}¢</button><button class="btn sm ai ghost" data-act="bz-remix" data-id="${it.id}">🔁 Remix</button><button class="link rep" data-act="bz-report" data-id="${it.id}" title="Report">⚑</button></div>`}
    </div></div>`;
}
function renderBazaar() {
  const el = $('#screen-bazaar'), R = BAZAAR_RULES, lv = Think.level(), P = Bazaar.player();
  if (!Bazaar.items.length && !bz.loading) bzLoad(true);
  let items = Bazaar.items.slice();
  if (bz.tab === 'new') items.sort((a, b) => b.createdAt - a.createdAt);
  if (bz.tab === 'crops') items = items.filter(x => x.kind === 'crop');
  if (bz.tab === 'mine') items = items.filter(x => x.mine);
  const pend = Bazaar.items.filter(x => x.mine).reduce((a, x) => a + (x.royaltyPending || 0), 0), day = Math.floor(Date.now() / 864e5), buys = state.bzBuys && state.bzBuys.day === day ? state.bzBuys.n : 0;
  el.innerHTML = `<div class="panel-title"><h2>🎪 Invention Bazaar</h2><span class="ai-mode ${Bazaar.server ? 'live' : 'offline'}">${Bazaar.server ? '🌐 shared server' : '📱 this device only'}</span></div>
   <div class="bz-you card" data-hook="bazaar-you"><div><b>${esc(P.name)}</b> · Inventor Lv ${lv}<br><small>${lv >= R.voteMinLevel ? '🗳️ You can vote (1 vote per idea)' : `🔒 Voting unlocks at Lv ${R.voteMinLevel} · ${Think.xpToNext()} XP to go`} · 🛒 ${buys}/${R.buysPerPlayerPerDay} buys today</small></div>
     <button class="btn sm ai" data-act="bz-pub-open" data-hook="bazaar-publish">＋ Publish</button></div>
   ${bz.err ? `<p class="ai-err">⚠️ ${esc(bz.err)}</p>` : ''}
   <div class="bz-tabs">${[['top', '🏅 Top'], ['new', '🆕 New'], ['crops', '🌱 Seeds'], ['mine', '⭐ Mine']].map(([k, l]) => `<button class="tchip ${bz.tab === k ? 'sel' : ''}" data-act="bz-tab" data-k="${k}">${l}</button>`).join('')}</div>
   ${bz.tab === 'mine' ? `<div class="bz-roy card"><span>💰 Royalties waiting: <b>${pend}¢</b> <small class="muted">(${Math.round(R.royaltyRate * 100)}% of each sale, max ${R.royaltyCapPerDay}¢/day)</small></span><button class="btn sm ${pend ? '' : 'disabled'}" data-act="bz-claim">Claim</button></div>` : ''}
   <div class="bz-list">${items.length ? items.map(bzCard).join('') : bz.loading ? '<p class="muted">Loading the Bazaar…</p>' : bz.tab === 'mine' ? '<p class="muted">You haven\'t published anything yet. Tap ＋ Publish.</p>' : '<p class="muted">Nothing here yet.</p>'}</div>
   <div class="bz-rules card" data-hook="bazaar-rules"><b>⚖️ Fair-play limits</b>
     <ul><li>Votes: 1 per player per idea · Lv ${R.voteMinLevel}+ · no self-votes · each vote fades by half every ${R.voteHalfLifeDays} days</li>
     <li>Rank → demand (seeds only): log curve, needs ${R.minVotesForBonus}+ voters, max +${Math.round(R.rankBonusMax * 100)}% / −${Math.round(R.rankPenaltyMax * 100)}%, same for everyone who grows it</li>
     <li>Seed prices stay in the rank band: ${R.seedPriceBands.map(b => `${b.tier} ${b.min}–${b.max}¢`).join(' · ')}</li>
     <li>${R.buysPerPlayerPerDay} buys per player per day · ${R.stockPerItemPerWeek} packets per idea per week · creator royalties ${Math.round(R.royaltyRate * 100)}%, max ${R.royaltyCapPerDay}¢/day</li>
     <li>Bought seeds grow as basic crops: the creator's AI-quality bonus doesn't transfer</li></ul>
     <small class="muted">Prototype: entries marked “sample:” are seeded demo players; your id is a local guest id (production needs real accounts + moderation).</small></div>`;
  sigs.bz = bzSig();
}
function bzSig() { return [Bazaar.t, bz.tab, state.coins >= 0 ? Math.min(state.coins, 999) : 0, Think.level()].join('|'); }
function pubCandidates() {
  const out = [];
  state.order.forEach(id => { const v = state.inventions[id]; if (!v || v.bazaar || isBasicCrop(id)) return; out.push({ ref: 'c|' + id, info: itemInfo('c|' + id), kind: 'crop' }); });
  Object.keys(state.aiRecipes).forEach(id => { if (!state.aiRecipes[id].bazaar) out.push({ ref: 'r|' + id, info: itemInfo('r|' + id), kind: 'recipe' }); });
  Object.keys(TOOLS).filter(k => TOOLS[k].source === 'ai' && !TOOLS[k].bazaar).forEach(k => out.push({ ref: 't:' + k, tool: k, kind: 'tool' }));
  return out.filter(x => x.tool || x.info);
}
function publishSheet() {
  const fn = () => {
    const c = pubCandidates(), band = BAZAAR_RULES.seedPriceBands[BAZAAR_RULES.seedPriceBands.length - 1];
    if (!bz.pubRef && c.length) bz.pubRef = c[0].ref;
    const pubd = name => Bazaar.items.some(x => x.mine && x.name.toLowerCase() === String(name).toLowerCase());
    return `<div class="sheet-h"><h3>🎪 Publish to the Bazaar</h3><button class="x" data-act="close">✕</button></div>
     <p class="muted small">Other players can vote it up, buy it (you earn ${Math.round(BAZAAR_RULES.royaltyRate * 100)}% royalties in coins) or remix it. Checked by the same moderation as inventing.</p>
     <div class="list pub-list">${c.length ? c.map(x => { const nm = x.tool ? TOOLS[x.tool].name : x.info.name;
        return `<button class="row ${bz.pubRef === x.ref ? 'sel' : ''}" data-act="bz-pub-pick" data-ref="${x.ref}">${x.tool ? toolIcon(x.tool, 36) : x.info.icon(36)}<div><b>${esc(nm)}</b> <span class="kind ${x.kind}">${x.kind}</span>${pubd(nm) ? ' <small>✓ published</small>' : ''}</div></button>`; }).join('')
        : '<p class="muted">Invent something first. Starter crops can\'t be published.</p>'}</div>
     ${c.length ? `<label class="fld">Price <b id="pub-price-v">${bz.pubPrice}¢</b> <small class="muted">new ideas start in the ${band.tier} band (${band.min}–${band.max}¢); the price follows your rank band</small>
        <input type="range" min="${band.min}" max="${band.max}" value="${Math.max(band.min, Math.min(band.max, bz.pubPrice))}" data-act="bz-price" id="pub-price"></label>
       <label class="fld">Pitch <small class="muted">(${BAZAAR_RULES.pitchMax} chars)</small><input class="txt" id="pub-pitch" maxlength="${BAZAAR_RULES.pitchMax}" value="${esc(bz.pubPitch)}" placeholder="Why should other farmers grow this?"></label>
       ${bz.pubErr ? `<p class="ai-err">⚠️ ${esc(bz.pubErr)}</p>` : ''}
       <button class="btn wide ai ${bz.busy ? 'disabled' : ''}" data-act="bz-publish" data-hook="bazaar-publish-go">${bz.busy ? 'Publishing…' : '🎪 Publish'}</button>` : ''}`;
  };
  fn.isPub = true; return fn;
}
async function bzAct(a, t) {
  const id = t.dataset.id;
  if (a === 'bz-vote') {
    const it = Bazaar.items.find(x => x.id === id);
    if (it && it.mine) { toast("You can't vote on your own idea"); return; }
    if (Think.level() < BAZAAR_RULES.voteMinLevel) { toast(`🔒 Voting unlocks at Inventor Lv ${BAZAAR_RULES.voteMinLevel}`); return; }
    const before = it ? it.bonus : 0, r = await Bazaar.vote(id, +t.dataset.v);
    if (r.error) toast('⚠️ ' + r.error);
    else { await Bazaar.list(); const now2 = Bazaar.items.find(x => x.id === id); bz.flash = id;
      toast(r.myVote ? `${r.myVote > 0 ? '▲ Upvoted' : '▼ Downvoted'} · now #${now2 ? now2.rank : '?'}${now2 && now2.kind === 'crop' && now2.bonus !== before ? ` · demand ${pctTxt(now2.bonus)}` : ''}` : 'Vote removed'); }
  }
  if (a === 'bz-buy') {
    const r = await Bazaar.buy(id);
    if (r.error) toast('⚠️ ' + r.error);
    else { const day = Math.floor(Date.now() / 864e5); state.bzBuys = state.bzBuys && state.bzBuys.day === day ? { day, n: state.bzBuys.n + 1 } : { day, n: 1 };
      toast(`🎪 Got ${r.got.name}${r.got.kind === 'crop' ? ' (2 seeds → Farm Basket)' : ''} · ${r.item.creator} earned ${r.royalty}¢`); save(); updateCoins(); Bazaar.list(); }
  }
  if (a === 'bz-remix') {
    const it = Bazaar.items.find(x => x.id === id); if (!it) return;
    Bazaar.call('copy', { id }); thinkType = it.kind; thinkDraft = `my twist on ${it.name.toLowerCase()}: `; setTab('lab');
    setTimeout(() => { const ta = $('#think-ta'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 50); toast('🔁 Remix it: add your twist and Think It!'); return;
  }
  if (a === 'bz-report') { if (!confirm('Report this listing as inappropriate? It will be hidden.')) return; const r = await Bazaar.call('report', { id }); toast(r.error ? '⚠️ ' + r.error : '⚑ Reported. Thanks!'); await Bazaar.list(); }
  if (a === 'bz-claim') { const r = await Bazaar.call('claim'); if (r.ok) { state.coins += r.coins; save(); updateCoins(); toast(`💰 +${r.coins}¢ royalties`); } else toast('⚠️ ' + r.error); }
  if (a === 'bz-publish') {
    if (bz.busy) return; bz.busy = true; bz.pubErr = null; refreshSheet();
    const pi = $('#pub-pitch'); if (pi) bz.pubPitch = pi.value;
    const r = await Bazaar.publish(bz.pubRef, bz.pubPrice, bz.pubPitch); bz.busy = false;
    if (r.error) { bz.pubErr = r.error; refreshSheet(); return; }
    bz.pubPitch = ''; bz.pubRef = null; bz.tab = 'mine'; closeSheet(); await Bazaar.list(); bz.flash = r.id; toast('🎪 Published! Players can now vote, buy and remix it.');
  }
  if (activeTab === 'bazaar') renderBazaar(); else if (activeTab === 'lab') renderLab();
}

/* ---------------- KITCHEN: surprise hits & flops, Discovery Journal ---------------- */
const renderKitchenClassic = renderKitchen;
renderKitchen = function () {
  renderKitchenClassic();
  const el = $('#screen-kitchen'), n = Object.values(state.discoveries).filter(d => d.outcome !== 'normal').length;
  el.insertAdjacentHTML('afterbegin', `<div class="k-think" data-hook="kitchen-think"><button class="btn sm ghost" data-act="jr-open">📔 Discovery Journal${n ? ` (${n})` : ''}</button>
    <span class="k-hints">${state.hints.slice(0, 2).map(h => `<span class="hint ${h.good ? 'good' : 'bad'}">${esc(h.text)}</span>`).join('') || '<span class="muted small">🧪 Combine 2–3 ingredients: some combos become Cult Classics, some… flop.</span>'}</span></div>`);
};
const cookSheetClassic = cookSheet;
cookSheet = function (k) {
  const f = cookSheetClassic(k);
  const g = () => { let h = f(); if (!cookSel.id || !(cookSel.extras || []).length || !state.inventions[cookSel.id]) return h;
    const job = { id: cookSel.id, recipe: cookSel.recipe, combo: comboEnc(cookSel.extras) }, c = Think.chem(job);
    const known = Object.values(state.discoveries).find(d => d.recipe === cookSel.recipe && d.ingredients.join() === c.names.join());
    const hintHit = state.hints.find(x => (c.best && x.pair === c.best.k) || (c.worst && x.pair === c.worst.k));
    const vibe = known ? (known.outcome === 'hit' ? '✨ Known Cult Classic!' : known.outcome === 'flop' ? '😬 You already know how this ends…' : 'Cooked before: a solid combo') :
      c.chem >= 1.5 ? '✨ Professor Fig is excited about this one' : c.chem > 0 ? '🙂 Smells promising…' : c.chem <= -1 ? '😬 Professor Fig is looking worried' : '🤷 Anyone\'s guess';
    return h.replace(/(<button class="btn wide[^"]*" data-act="cook")/, `<div class="chem card" data-hook="chemistry">🧪 <b>New combo?</b> ${vibe}${hintHit ? `<br><small>Your note: ${esc(hintHit.text)}</small>` : ''}<br><small class="muted">First cook decides: Cult Classic (×${CHEM_RULES.hitDemand} demand) · normal · Flop (×${CHEM_RULES.flopDemand}, +${CHEM_RULES.flopCoins}¢ & XP)</small></div>$1`); };
  Object.assign(g, f); return g;
};
function discoverySheet(d) {
  const fn = () => { const info = itemInfo(d.key), hit = d.outcome === 'hit', hint = state.hints.find(h => h.t >= d.t - 5);
    const nudge = hint && hint.good ? `a ${hint.pair.split('+').map(t => TAG_WORD[t] || t).join(' ')} treat` : Think.trend().prompts[1];
    return `<div class="sheet-h"><h3>${hit ? '✨ Surprise discovery!' : '😬 Uh-oh…'}</h3><button class="x" data-act="close">✕</button></div>
     <div class="disc ${d.outcome}" data-hook="discovery-${d.outcome}">
       <div class="disc-ribbon">${hit ? '✨ CULT CLASSIC! ✨' : '💥 FLOP! 💥'}</div>
       <div class="disc-art">${hit ? '<span class="spk s1">✦</span><span class="spk s2">✧</span><span class="spk s3">✦</span><span class="spk s4">✧</span><span class="spk s5">✦</span>' : '<span class="stink k1">〰</span><span class="stink k2">〰</span><span class="stink k3">〰</span>'}${info ? info.icon(112) : ''}</div>
       <h3 class="disc-name">${esc(d.name)}${d.ai ? ' <span class="badge ai sm">✨AI name</span>' : ''}</h3>
       <div class="disc-ing">${d.ingredients.map(esc).join(' + ')} → ${RECIPES[d.recipe].name}</div>
       <p>${esc(d.desc)}</p>
       ${hit ? `<div class="disc-stats"><span>📈 demand ×${CHEM_RULES.hitDemand}</span><span>⭐ starts at 5★ buzz</span><span>+${CHEM_RULES.hitXP} XP</span></div>`
         : `<div class="gag-row">${faceSVG('fig', 38, 'gag')}<q>${esc(d.gag)}</q></div><div class="disc-stats"><span>🪙 +${CHEM_RULES.flopCoins}¢ consolation</span><span>+${CHEM_RULES.flopXP} XP</span><span>📔 Flop Journal entry</span></div>`}
       ${hint ? `<div class="hint ${hint.good ? 'good' : 'bad'}">🔓 Hint unlocked: ${esc(hint.text)}</div>` : ''}
       <div class="disc-btns"><button class="btn ghost" data-act="jr-open">📔 Journal</button><button class="btn ai" data-act="think-fill" data-prompt="${esc(nudge)}" data-type="crop">💡 Invent the next thing</button></div>
     </div>`; };
  fn.isDisc = d.key; return fn;
}
function onDiscoveryUpdated(d) { if (sheetRender && (sheetRender.isDisc === d.key || sheetRender.isJournal)) refreshSheet(); }
function journalSheet() {
  const fn = () => {
    const all = Object.values(state.discoveries).sort((a, b) => b.t - a.t), hits = all.filter(d => d.outcome === 'hit'), flops = all.filter(d => d.outcome === 'flop'), plain = all.length - hits.length - flops.length;
    const card = d => { const info = itemInfo(d.key); return `<div class="jr-card ${d.outcome}">${info ? info.icon(54) : ''}<div><b>${esc(d.name)}</b><br><small>${d.ingredients.map(esc).join(' + ')} · ${RECIPES[d.recipe].name}</small>
      ${d.outcome === 'flop' ? `<q>${esc(d.gag)}</q>` : `<p>${esc(d.desc)}</p>`}<button class="btn sm ghost" data-act="jr-share" data-key="${esc(d.key)}">📤 Share card</button></div></div>`; };
    return `<div class="sheet-h"><h3>📔 Discovery Journal</h3><button class="x" data-act="close">✕</button></div>
     <div class="journal" data-hook="discovery-journal">
      <div class="jr-sum"><span>✨ ${hits.length} Cult Classic${hits.length === 1 ? '' : 's'}</span><span>😬 ${flops.length} Flop${flops.length === 1 ? '' : 's'}</span><span>🍳 ${plain} other combos</span></div>
      <div id="share-out"></div>
      <h4>✨ Cult Classics</h4>${hits.map(card).join('') || '<p class="muted small">None yet. Try bold combos in the Kitchen!</p>'}
      <h4>😬 Flop Journal</h4>${flops.map(card).join('') || '<p class="muted small">No flops yet. (They pay a little consolation!)</p>'}
      <h4>🧪 Chemistry notes</h4>${state.hints.map(h => `<div class="hint ${h.good ? 'good' : 'bad'}">${esc(h.text)}</div>`).join('') || '<p class="muted small">Hits and flops unlock notes about which flavours clash.</p>'}
      <button class="btn wide ai" data-act="th-goto" data-tab="lab">💡 Back to the Workshop</button></div>`;
  };
  fn.isJournal = true; return fn;
}
/* canvas -> PNG share card */
function svgToImg(html) {
  return new Promise(res => {
    const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null);
    const m = html.match(/<img[^>]+src="([^"]+)"/); if (m) { img.src = m[1]; return; }
    const svg = html.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function wrapText(ctx, text, x, y, maxW, lh) { const words = String(text).split(' '); let line = '', yy = y; for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; } if (line) ctx.fillText(line, x, yy); return yy; }
async function shareCard(key) {
  const d = state.discoveries[key], info = itemInfo(key); if (!d) return;
  const W = 600, H = 760, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'), hit = d.outcome === 'hit';
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hit ? '#fff3c4' : '#e9f5d8'); g.addColorStop(1, hit ? '#f7c6ff' : '#cfe8b0'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 10; ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.fillStyle = '#5b3a1e'; ctx.textAlign = 'center'; ctx.font = '600 26px Fredoka, sans-serif'; ctx.fillText('MARKET PLOT · DISCOVERY JOURNAL', W / 2, 66);
  ctx.fillStyle = hit ? '#8e5bd1' : '#e86f5a'; ctx.beginPath(); ctx.roundRect(110, 90, W - 220, 64, 32); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 36px "Lilita One", Fredoka, sans-serif'; ctx.fillText(hit ? '✨ CULT CLASSIC! ✨' : '💥 FLOP! 💥', W / 2, 136);
  const img = info ? await svgToImg(info.icon(240)) : null; if (img) ctx.drawImage(img, W / 2 - 130, 170, 260, 260);
  ctx.fillStyle = '#5b3a1e'; ctx.font = '700 38px Fredoka, sans-serif'; let y = wrapText(ctx, d.name, W / 2, 476, W - 80, 44);
  ctx.font = '500 24px Fredoka, sans-serif'; ctx.fillStyle = '#7a5536'; y = wrapText(ctx, d.ingredients.join(' + ') + ' → ' + RECIPES[d.recipe].name, W / 2, y + 42, W - 80, 30);
  ctx.font = 'italic 500 24px Fredoka, sans-serif'; y = wrapText(ctx, '“' + (hit ? d.desc : d.gag) + '”', W / 2, y + 44, W - 100, 30);
  ctx.font = '700 28px "Lilita One", Fredoka, sans-serif'; ctx.fillStyle = '#5b3a1e'; ctx.fillText('Think It, Sell It!', W / 2, H - 46);
  const url = cv.toDataURL('image/png'); state.lastShare = url.length;
  const out = $('#share-out'), file = (d.name.replace(/[^\w]+/g, '-').toLowerCase() || 'discovery') + '.png';
  if (out) out.innerHTML = `<div class="share card" data-hook="share-card"><img src="${url}" alt="share card" class="share-img"><div class="share-btns"><a class="btn sm" href="${url}" download="${file}">⬇️ Save PNG</a>${navigator.share ? '<button class="btn sm ai" data-act="jr-native-share">📤 Share…</button>' : ''}</div></div>`;
  shareCard.last = { url, file };
}

/* stats sheet: what customers say + Bazaar / contest actions */
const statsSheetClassic = statsSheet;
statsSheet = function (key) {
  const f = statsSheetClassic(key);
  const g = () => { const h = f(), info = itemInfo(key); if (!info) return h;
    const fb = state.feed.filter(e => e.key === key).slice(0, 3), b = info.buzz || { n: 0 };
    const canPub = (info.kind === 'crop' && !info.inv.bazaar && info.src === 'ai') || (info.kind === 'craft' && !info.recipe.bazaar);
    const extra = `<div class="stats-think card" data-hook="stats-reviews"><h4>💬 Reviews ${b.n ? `<span class="st">${STAR_TXT(Math.round(b.avg))}</span> <small>${b.avg.toFixed(1)} from ${b.n}</small>` : ''}</h4>
      ${fb.length ? fb.map(e => `<div class="feed-row">${faceSVG(e.pid, 26, e.mood)}<div><b>${CUSTOMERS[e.pid].name}</b> <span class="st">${STAR_TXT(e.stars)}</span><br><q>${esc(e.line)}</q></div></div>`).join('') : '<p class="muted small">No reviews yet. Put it on the stall!</p>'}
      <div class="stats-btns">${itemBadges(info)}</div>
      <div class="stats-btns"><button class="btn sm" data-act="sell-new" data-key="${key}">🧺 Sell it</button>${canPub ? `<button class="btn sm ai ghost" data-act="bz-pub-open" data-ref="${key}">🎪 Publish</button>` : ''}<button class="btn sm ghost" data-act="town-submit" data-key="${key}">🏆 Enter contest</button></div></div>`;
    return h.replace(/<\/div>\s*$/, extra + '</div>'); };
  Object.assign(g, f); return g;
};

/* ---------------- render / actions / loop ---------------- */
function render() {
  updateCoins();
  ({ farm: renderFarm, lab: renderLab, kitchen: renderKitchen, market: renderMarket, bazaar: renderBazaar, town: renderTown })[activeTab]();
  renderCoach();
}
function thinkAct(a, t) {
  if (slotsAct(a, t)) return true;
  switch (a) {
    case 'start': state.seenTitle = true; if (state.onb === 0) { state.onb = 1; state.onbT0 = now(); } setTab('lab'); return false; // the title button: let ui.js finish it
    case 'think-type': thinkType = t.dataset.k; { const ta = $('#think-ta'); if (ta) thinkDraft = ta.value; } renderLab(); return true;
    case 'ooc': openSheet(outOfCreditsSheet(thinkDraft.trim().length >= 3 ? () => thinkGo() : null, thinkDraft.trim())); return true;
    case 'think-go': thinkGo(t); return true;
    case 'think-fill': {
      if (t.dataset.goto) { setTab(t.dataset.goto); closeSheet(); return true; }
      thinkType = t.dataset.type || 'crop'; thinkDraft = t.dataset.prompt || ''; closeSheet(); setTab('lab');
      const ws = $('#screen-lab'); if (ws) ws.scrollTop = 0;
      setTimeout(() => { const ta = $('#think-ta'); if (ta) { ta.focus({ preventScroll: true }); ta.classList.add('filled'); setTimeout(() => ta.classList.remove('filled'), 900); } }, 30);
      return true; }
    case 'th-goto': closeSheet(); setTab(t.dataset.tab); return true;
    case 'sell-new': sellNow(t.dataset.key); return true;
    case 'tour-skip': state.onb = 'done'; save(); render(); return true;
    case 'tour-done': state.onb = 'done'; save(); setTab('lab'); toast('💡 Customers left wishes. Tap one to invent it!'); return true;
    case 'hg-accept': haggleDo('accept'); return true;
    case 'hg-counter': haggleDo('counter'); return true;
    case 'hg-decline': haggleDo('decline'); return true;
    case 'town-enter': openSheet(enterSheet()); return true;
    case 'town-submit': { const r = Think.submitEntry(t.dataset.key); closeSheet(); toast(r.ok ? `🏆 Entered: ${itemInfo(t.dataset.key).name}` : r.msg); if (activeTab !== 'town') setTab('town'); else renderTown(); return true; }
    case 'town-advance': { const r = Think.advanceWeek(); updateCoins(); render(); openSheet(resultsSheet(r)); return true; }
    case 'town-results': { const h = state.week.history.find(x => x.week === +t.dataset.w); if (h) openSheet(resultsSheet(h)); return true; }
    case 'bz-tab': bz.tab = t.dataset.k; renderBazaar(); return true;
    case 'bz-pub-open': if (t.dataset.ref) bz.pubRef = t.dataset.ref; bz.pubErr = null; openSheet(publishSheet()); return true;
    case 'bz-pub-pick': bz.pubRef = t.dataset.ref; { const pi = $('#pub-pitch'); if (pi) bz.pubPitch = pi.value; } refreshSheet(); return true;
    case 'bz-vote': case 'bz-buy': case 'bz-remix': case 'bz-report': case 'bz-claim': case 'bz-publish': bzAct(a, t); return true;
    case 'jr-open': openSheet(journalSheet()); return true;
    case 'jr-share': shareCard(t.dataset.key); return true;
    case 'jr-native-share': { const s = shareCard.last; if (s && navigator.share) fetch(s.url).then(r => r.blob()).then(b => navigator.share({ files: [new File([b], s.file, { type: 'image/png' })], title: 'My Market Plot discovery' })).catch(() => {}); return true; }
    case 'cook': { // classic cook + the discovery reveal
      const r = Game.cook(t.dataset.k, cookSel.recipe, cookSel.id, cookSel.extras || []);
      if (!r.ok) { toast(r.msg); return true; }
      renderKitchen();
      if (r.discovery && r.discovery.outcome !== 'normal') openSheet(discoverySheet(r.discovery)); else { closeSheet(); toast(r.discovery ? '🍳 New combo: a solid, normal success' : 'Cooking…'); }
      return true; }
  }
  return false;
}
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'think-ta') thinkDraft = t.value;
  if (t.id === 'pub-pitch') { bz.pubPitch = t.value; if (bz.pubErr) { bz.pubErr = ''; const er = $('.sheet .ai-err'); if (er) er.remove(); } }
  if (t.id === 'pub-price') { bz.pubPrice = +t.value; const v = $('#pub-price-v'); if (v) v.textContent = t.value + '¢'; }
});
document.addEventListener('keydown', e => { if (e.target.id === 'think-ta' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); thinkGo(); } });
function thinkTick() {
  if (!state) return;
  const w = Think.checkWeek(); if (w) { toast(`📋 New week! Trend: ${Think.trend().emoji} ${Think.trend().name}`); render(); if (!w.skipped) openSheet(resultsSheet(w)); }
  const focused = document.activeElement && ['think-ta', 'pub-pitch'].includes(document.activeElement.id);
  if (activeTab === 'lab' && !focused && !book.open && workshopSig() !== sigs.ws) renderLab();
  if (activeTab === 'town' && townSig() !== sigs.town) renderTown();
  if (activeTab === 'bazaar') { bzLoad(false); if (bzSig() !== sigs.bz) renderBazaar(); }
  if (activeTab === 'market') renderFeed();
  renderCoach();
}
setInterval(thinkTick, 700);
// boot() is called by simple.js (loads last)
