/* ===== GROWTH STAGES: a fixed, preset art library (NOT AI-generated) =====
   When inventing a crop (free or AI) the player picks one look per stage. Only the FRUIT
   (the produce itself) is custom: procedural seed+trait art for free crops, the AI image for AI crops.
   Unity: these become a sprite library; crop data stores the chosen ids. */
const STAGE_ORDER = ['seedling', 'youngling', 'mature', 'flower', 'harvest'];
const STAGE_LABEL = { seedling: 'Seedling', youngling: 'Youngling', mature: 'Mature plant', flower: 'Flower', harvest: 'Harvest-ready' };
const SOIL = `<ellipse cx="50" cy="90" rx="30" ry="7" fill="#8a5a3a" stroke="${OUT}" stroke-width="2.5"/><ellipse cx="44" cy="88" rx="8" ry="2" fill="#a8743f"/>`;
const L = (d, c) => `<path d="${d}" fill="${c}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>`;
const STEM = (d, c = '#5fa83c', w = 4) => `<path d="${d}" stroke="${OUT}" stroke-width="${w + 3}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const STAGE_LIB = {
  seedling: [
    { id: 'twin', name: 'Twin Leaf', svg: () => STEM('M50 88V70') + L('M50 72c-4-10-16-10-20-4c6 6 14 8 20 4z', '#7bd04f') + L('M50 72c4-10 16-10 20-4c-6 6-14 8-20 4z', '#7bd04f') },
    { id: 'curl', name: 'Curly Sprout', svg: () => STEM('M50 88V68c0-8 10-8 10-2s-6 6-6 2') + L('M50 76c-8-4-14 0-14 4c6 2 10 0 14-4z', '#9be05f') },
    { id: 'clover', name: 'Clover', svg: () => STEM('M50 88V72') + ['M50 72c-10-2-12-12-4-12c2 0 4 2 4 4c0-2 2-4 4-4c8 0 6 10-4 12z'].map(d => L(d, '#5cc46a')).join('') + L('M50 72c-12 4-16-4-10-8c4 0 8 4 10 8z', '#4fb35e') + L('M50 72c12 4 16-4 10-8c-4 0-8 4-10 8z', '#4fb35e') },
    { id: 'spike', name: 'Grass Spike', svg: () => L('M46 88c-4-12-2-22 2-28c0 10 2 20 2 28z', '#6cc24a') + L('M52 88c2-14 8-22 14-24c-6 8-8 16-10 24z', '#86d65a') + L('M48 88c-6-8-12-12-18-12c6 4 10 8 14 12z', '#5bb13d') },
    { id: 'bud', name: 'Pink Bud', svg: () => STEM('M50 88V64') + L('M50 76c-6-6-14-4-16 0c6 4 12 4 16 0z', '#7bd04f') + L('M50 76c6-6 14-4 16 0c-6 4-12 4-16 0z', '#7bd04f') + `<circle cx="50" cy="62" r="5" fill="#f59ac4" stroke="${OUT}" stroke-width="2.5"/>` },
  ],
  youngling: [
    { id: 'roundy', name: 'Round Leaves', svg: () => STEM('M50 88V50') + [[50, 74, -1], [50, 64, 1], [50, 54, -1]].map(([x, y, s]) => `<ellipse cx="${x + s * 10}" cy="${y}" rx="10" ry="6" fill="#6cc24a" stroke="${OUT}" stroke-width="2.5"/>`).join('') + `<ellipse cx="50" cy="48" rx="6" ry="8" fill="#86d65a" stroke="${OUT}" stroke-width="2.5"/>` },
    { id: 'pointy', name: 'Pointy Leaves', svg: () => STEM('M50 88V48') + L('M50 76l-20-6l20-2z', '#5bb13d') + L('M50 66l20-6l-20-2z', '#5bb13d') + L('M50 56l-16-8l16 0z', '#6cc24a') + L('M50 50l-4-10l4 2l4-2z', '#86d65a') },
    { id: 'fern', name: 'Fern Frond', svg: () => STEM('M50 88C50 70 56 58 62 48', '#4f9a35', 3) + [0, 1, 2, 3, 4].map(k => L(`M${51 + k * 2.4} ${82 - k * 8}c-10-2-14 2-14 4c6 2 10 0 14-4z`, '#5cbf55') + L(`M${51 + k * 2.4} ${82 - k * 8}c8-6 14-4 14-2c-4 4-10 4-14 2z`, '#6fd06a')).join('') },
    { id: 'heart', name: 'Heart Leaves', svg: () => STEM('M50 88V52', '#3fa28c') + [[38, 70], [62, 62], [44, 52]].map(([x, y]) => L(`M${x} ${y + 6}c-10-6-8-14-2-14c2 0 2 2 2 2c0 0 0-2 2-2c6 0 8 8-2 14z`, '#43c0a6')).join('') },
    { id: 'vine', name: 'Twisty Vine', svg: () => STEM('M50 88c-10-8 10-14 0-22s10-14 2-20', '#5fa83c', 3.5) + L('M46 74c-10 0-12 6-10 8c6 0 10-4 10-8z', '#7bd04f') + L('M54 58c10-2 12 4 10 6c-6 0-10-2-10-6z', '#7bd04f') + `<path d="M52 46c6-2 8 4 4 6" stroke="${OUT}" stroke-width="2" fill="none"/>` },
  ],
  mature: [
    { id: 'bush', name: 'Leafy Bush', svg: () => STEM('M50 88V66', '#7a5536', 6) + [[36, 58, 16], [64, 58, 16], [50, 44, 18], [50, 62, 14]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#5bb13d" stroke="${OUT}" stroke-width="2.5"/>`).join('') + `<path d="M40 50c4-4 10-4 12 0M56 56c4-3 8-3 10 0" stroke="#86d65a" stroke-width="3" fill="none" stroke-linecap="round"/>` },
    { id: 'stalk', name: 'Tall Stalk', svg: () => STEM('M50 88V24', '#5fa83c', 5) + [0, 1, 2, 3].map(k => L(k % 2 ? `M50 ${78 - k * 14}c14-10 24-6 26-2c-10 4-18 6-26 2z` : `M50 ${78 - k * 14}c-14-10-24-6-26-2c10 4 18 6 26 2z`, '#6cc24a')).join('') },
    { id: 'ferny', name: 'Fern Cluster', svg: () => [-26, -10, 8, 24].map((a, k) => `<g transform="rotate(${a} 50 88)">${STEM('M50 88V36', '#4f9a35', 3)}${[0, 1, 2, 3, 4].map(j => L(`M50 ${80 - j * 9}c-9-2-12 1-12 3c5 1 9 0 12-3zM50 ${80 - j * 9}c9-2 12 1 12 3c-5 1-9 0-12-3z`, k % 2 ? '#5cbf55' : '#6fd06a')).join('')}</g>`).join('') },
    { id: 'broad', name: 'Broad Leaves', svg: () => STEM('M50 88V40', '#5fa83c', 5) + L('M50 80c-30-4-34-24-26-30c10 4 22 16 26 30z', '#4fb35e') + L('M50 70c30-4 34-24 26-30c-10 4-22 16-26 30z', '#5cc46a') + L('M50 50c-14-8-16-22-8-26c6 6 8 16 8 26z', '#6cc24a') },
    { id: 'trellis', name: 'Trellis Vine', svg: () => `<path d="M34 88V24M66 88V24M34 40h32M34 60h32" stroke="#a86a3e" stroke-width="4" stroke-linecap="round"/>` + STEM('M50 88c-14-8 14-16 0-24s14-16 0-24s10-10 4-14', '#5fa83c', 3.5) + [[40, 70], [60, 56], [42, 42], [58, 30]].map(([x, y]) => L(`M${x} ${y}c-6-6 0-12 6-8c2 4 0 8-6 8z`, '#7bd04f')).join('') },
  ],
  flower: [
    { id: 'daisy', name: 'Daisy', fl: (x, y) => [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<ellipse cx="${x}" cy="${y - 7}" rx="3.5" ry="7" fill="#fff" stroke="${OUT}" stroke-width="1.5" transform="rotate(${a} ${x} ${y})"/>`).join('') + `<circle cx="${x}" cy="${y}" r="4.5" fill="#f6c443" stroke="${OUT}" stroke-width="1.5"/>` },
    { id: 'tulip', name: 'Tulip', fl: (x, y) => L(`M${x - 7} ${y - 6}l3 10h8l3-10l-4 4l-3-6l-3 6z`, '#f27fa8') },
    { id: 'star', name: 'Star Flower', fl: (x, y) => L(`M${x} ${y - 9}l2.6 5.6l6 .6l-4.6 4l1.4 6l-5.4-3.2l-5.4 3.2l1.4-6l-4.6-4l6-.6z`, '#b48cf2') + `<circle cx="${x}" cy="${y}" r="2" fill="#fff6a8"/>` },
    { id: 'bell', name: 'Bluebells', fl: (x, y) => L(`M${x - 6} ${y + 4}c0-10 12-10 12 0l-2-1l-2 2l-2-2l-2 2l-2-2z`, '#6fa8f2') },
    { id: 'sunny', name: 'Sunflower', fl: (x, y) => [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(a => `<ellipse cx="${x}" cy="${y - 7}" rx="2.6" ry="6" fill="#f9c72e" stroke="${OUT}" stroke-width="1.2" transform="rotate(${a} ${x} ${y})"/>`).join('') + `<circle cx="${x}" cy="${y}" r="5" fill="#8a5a3a" stroke="${OUT}" stroke-width="1.5"/>` },
  ],
  harvest: [
    { id: 'bounty', name: 'Bountiful', spots: [[32, 60, 30], [68, 60, 30], [50, 38, 32]] },
    { id: 'crown', name: 'Crown Fruit', spots: [[50, 40, 50]] },
    { id: 'hang', name: 'Hanging', spots: [[30, 60, 28], [52, 70, 28], [72, 52, 28]], hang: true },
    { id: 'cluster', name: 'Cluster', spots: [[36, 46, 26], [62, 44, 26], [42, 66, 26], [66, 66, 26]] },
    { id: 'duo', name: 'Sparkly Duo', spots: [[34, 52, 36], [66, 48, 36]], sparkle: true },
  ],
};
const FLOWER_SPOTS = [[36, 50], [64, 50], [50, 34], [42, 66]];
function defaultStages(seedStr) { // starters / old saves: a stable pseudo-random look per crop
  let h = 2166136261; for (const c of String(seedStr)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const o = {}; STAGE_ORDER.forEach((s, i) => { const m = Math.imul(h ^ Math.imul(i + 1, 0x9E3779B1), 0x85EBCA6B) >>> 0; o[s] = ((m ^ (m >>> 13)) >>> 0) % STAGE_LIB[s].length; }); return o; }
function stagesOf(inv) { return inv.stages || defaultStages(inv.id || inv.base + inv.trait); }
/* the fruit: AI image (custom) or procedural seed+trait art, placed inside an SVG */
function fruitSVG(inv, x, y, s) {
  if (!inv) return `<text x="${x}" y="${y + s * .35}" font-size="${s * .9}" text-anchor="middle">❓</text>`;
  if (inv.imageUrl) return `<image href="${inv.imageUrl}" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}"/>`;
  return cropIcon(inv, s).replace('<svg ', `<svg x="${x - s / 2}" y="${y - s / 2}" `);
}
/* one stage of the plant. inv may be null (unknown AI fruit -> ❓) */
function stageSVG(stages, stage, inv, size = 64) {
  const st = stages || defaultStages('x');
  const mature = STAGE_LIB.mature[st.mature].svg();
  let body;
  if (stage === 'seedling' || stage === 'youngling') body = STAGE_LIB[stage][st[stage]].svg();
  else if (stage === 'mature') body = mature;
  else if (stage === 'flower') { const f = STAGE_LIB.flower[st.flower]; body = mature + FLOWER_SPOTS.map(([x, y]) => f.fl(x, y)).join(''); }
  else { const hv = STAGE_LIB.harvest[st.harvest];
    body = mature + hv.spots.map(([x, y, s]) => (hv.hang ? `<path d="M${x} ${y - s / 2 - 8}v8" stroke="${OUT}" stroke-width="2"/>` : '') + fruitSVG(inv, x, y, s)).join('') + (hv.sparkle ? sparkles(6, '#fff6a8', 7) : ''); }
  return `<svg class="stage-ico" viewBox="0 0 100 100" width="${size}" height="${size}">${SOIL}${body}</svg>`;
}
function stageForProgress(pr) { return pr >= 1 ? 'harvest' : STAGE_ORDER[Math.min(3, Math.floor(pr * 4))]; }

/* ===== AI IMAGE display helpers =====
   AI items carry imageUrl (+ imagePrompt). If the image service only produced a stand-in, imagePreview:true
   and we draw a procedural composite (base shape + keyword accessories) labelled "preview". */
const ACCESSORY = {
  umbrella: `<path d="M-10 0a10 9 0 0 1 20 0z" fill="#f27fa8" stroke="${OUT}" stroke-width="1.8"/><path d="M0 0v9" stroke="${OUT}" stroke-width="1.8"/>`,
  cloud: `<path d="M-10 4a5 5 0 0 1 2-9a7 7 0 0 1 13-1a5 5 0 0 1 5 10z" fill="#fff" stroke="${OUT}" stroke-width="1.8"/>`,
  flame: `<path d="M0 8c-8 0-9-8-4-13c0 4 2 5 3 5c-1-5 2-9 5-10c-1 5 4 7 4 12c0 4-3 6-8 6z" fill="#ff8a3d" stroke="${OUT}" stroke-width="1.8"/>`,
  star: `<path d="M0-9l2.6 5.6l6 .6l-4.6 4l1.4 6l-5.4-3.2l-5.4 3.2l1.4-6l-4.6-4l6-.6z" fill="#f9d64a" stroke="${OUT}" stroke-width="1.6"/>`,
  snow: `<path d="M0-8v16M-7-4l14 8M-7 4l14-8" stroke="#7cc8f2" stroke-width="2.6" stroke-linecap="round"/>`,
  heart: `<path d="M0 7c-12-7-9-15-4-15c2 0 4 2 4 3c0-1 2-3 4-3c5 0 8 8-4 15z" fill="#f2668b" stroke="${OUT}" stroke-width="1.6"/>`,
  note: `<path d="M-2 6V-7l8-2v11" stroke="${OUT}" stroke-width="2" fill="none"/><circle cx="-4" cy="6" r="3" fill="#9b6cf0" stroke="${OUT}" stroke-width="1.5"/><circle cx="4" cy="3" r="3" fill="#9b6cf0" stroke="${OUT}" stroke-width="1.5"/>`,
  moon: `<path d="M3-8a8 8 0 1 0 5 13a7 7 0 0 1-5-13z" fill="#f6e27a" stroke="${OUT}" stroke-width="1.6"/>`,
  crown: `<path d="M-9 5v-10l5 5l4-7l4 7l5-5v10z" fill="#f2c14e" stroke="${OUT}" stroke-width="1.6"/>`,
  bolt: `<path d="M2-10l-8 11h6l-3 9l9-12h-6z" fill="#f9d64a" stroke="${OUT}" stroke-width="1.6"/>`,
  gem: `<path d="M-8-2l4-5h8l4 5l-8 10z" fill="#c06cf0" stroke="${OUT}" stroke-width="1.6"/>`,
  candy: `<circle r="5" fill="#f59ac4" stroke="${OUT}" stroke-width="1.6"/><path d="M-5 0l-5-4v8zM5 0l5-4v8z" fill="#f59ac4" stroke="${OUT}" stroke-width="1.4"/>`,
};
const ACCESSORY_WORDS = {
  umbrella: ['umbrella', 'parasol'], cloud: ['cloud', 'rain', 'fluffy', 'sky'], flame: ['fire', 'flame', 'dragon', 'lava', 'hot', 'spicy', 'volcano'],
  star: ['star', 'magic', 'sparkle', 'galaxy', 'space', 'wish', 'fairy', 'cosmic'], snow: ['snow', 'ice', 'frost', 'winter', 'frozen', 'cold'],
  heart: ['love', 'heart', 'cute', 'kiss'], note: ['sing', 'song', 'music', 'dance', 'sings'], moon: ['moon', 'night', 'midnight', 'dream', 'sleep'],
  crown: ['king', 'queen', 'royal', 'crown'], bolt: ['robot', 'electric', 'lightning', 'turbo', 'laser'], gem: ['crystal', 'gem', 'diamond', 'jewel', 'glass'],
  candy: ['candy', 'sugar', 'cake', 'chocolate', 'cotton', 'lollipop'],
};
function accessoriesFor(prompt) {
  const w = PromptStub.norm(prompt).split(' ').flatMap(x => [x, PromptStub.singular(x)]);
  return Object.keys(ACCESSORY_WORDS).filter(k => ACCESSORY_WORDS[k].some(kw => w.includes(kw))).slice(0, 3);
}
function previewComposite(innerSVG, accessories, size, cls = '') {
  const spots = [[22, 24, 1.3], [80, 26, 1.2], [80, 74, 1.1]];
  const acc = (accessories.length ? accessories : ['star']).map((a, i) => `<g transform="translate(${spots[i][0]} ${spots[i][1]}) scale(${spots[i][2]})">${ACCESSORY[a]}</g>`).join('');
  return `<svg class="ico glowy ${cls}" viewBox="0 0 100 100" width="${size}" height="${size}"><circle cx="50" cy="52" r="44" fill="#efe4ff" stroke="#b8a2f0" stroke-width="2" stroke-dasharray="4 3"/>
    <g transform="translate(14 12) scale(.72)">${innerSVG}</g>${acc}
    <g transform="translate(50 92)"><rect x="-19" y="-7" width="38" height="12" rx="6" fill="#8e5bd1"/><text y="2.5" font-size="8" font-weight="700" fill="#fff" text-anchor="middle" font-family="Fredoka,sans-serif">preview</text></g></svg>`;
}
function aiImgTag(url, size, cls = '') { return `<img class="ico ai-img ${cls}" src="${url}" width="${size}" height="${size}" alt="" draggable="false">`; }
/* AI recipe product icon: AI image, preview composite, or procedural jar/pie/bottle of the main crop */
function recipeIcon(R, size = 56) {
  if (R.imageUrl) return aiImgTag(R.imageUrl, size, 'glowy');
  const inv = state.inventions[R.mainId] || Object.values(state.inventions)[0];
  if (R.imagePreview) return previewComposite(productIcon(inv, R.form, 100, 'ai').replace(/^<svg[^>]*>|<\/svg>\s*$/g, ''), R.accessories || [], size);
  return productIcon(inv, R.form, size, 'ai');
}
function starsHTML(n, max = 5) { return `<span class="stars" title="difficulty ${n}/${max}">${'★'.repeat(n)}<i>${'★'.repeat(max - n)}</i></span>`; }
