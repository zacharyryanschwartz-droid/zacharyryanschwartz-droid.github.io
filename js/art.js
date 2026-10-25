/* Procedural cartoon art (SVG strings). No external images. */
'use strict';
let _uid = 0;
function shade(hex, amt) { // amt -1..1
  let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function cropColor(inv) {
  const b = BASES[inv.base], t = TRAITS[inv.trait], base = inv.color || b.color; // AI crops may carry a color from the prompt
  return t.tint && !inv.color ? mix(base, t.tint, 0.55) : t.tint ? mix(base, t.tint, 0.25) : base;
}
function sparkles(n, color, seed) {
  let s = '', x = seed || 7;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280; const px = 8 + (x / 233280) * 84;
    x = (x * 9301 + 49297) % 233280; const py = 8 + (x / 233280) * 84;
    const r = 2 + (i % 3);
    s += `<path class="spk" style="animation-delay:${(i * 0.37) % 2}s" d="M${px} ${py - r * 1.8}L${px + r * .5} ${py - r * .5}L${px + r * 1.8} ${py}L${px + r * .5} ${py + r * .5}L${px} ${py + r * 1.8}L${px - r * .5} ${py + r * .5}L${px - r * 1.8} ${py}L${px - r * .5} ${py - r * .5}Z" fill="${color}"/>`;
  }
  return s;
}
function pattern(p, c) {
  const d = shade(c, -0.35), l = shade(c, 0.6);
  switch (p) {
    case 'dots': return `<circle cx="42" cy="50" r="2.5" fill="${l}"/><circle cx="56" cy="58" r="2" fill="${l}"/><circle cx="50" cy="44" r="1.8" fill="${l}"/>`;
    case 'spots': return `<circle cx="40" cy="52" r="3" fill="${d}"/><circle cx="56" cy="46" r="2.6" fill="${d}"/><circle cx="52" cy="62" r="2.4" fill="${d}"/><circle cx="62" cy="58" r="2" fill="${d}"/>`;
    case 'stars': return `<text x="50" y="60" font-size="16" text-anchor="middle" fill="${shade(c, .7)}" opacity=".85">★</text>`;
    case 'facets': return `<path d="M50 30L62 50L50 74L38 50Z" fill="${l}" opacity=".35"/><path d="M38 50L62 50" stroke="${l}" stroke-width="1.5" opacity=".6"/>`;
    case 'rays': return `<circle cx="50" cy="54" r="7" fill="${shade(c, .5)}" opacity=".8"/>`;
    case 'snow': return `<text x="50" y="60" font-size="14" text-anchor="middle" fill="#fff" opacity=".9">❄</text>`;
    case 'flame': return `<path d="M50 66c-6-4-6-10 0-18c1 5 6 6 4 12c-1 3-2 5-4 6z" fill="#ffd166" opacity=".9"/>`;
    default: return '';
  }
}
const OUT = '#5b3a1e';
function cropBody(base, c) {
  const d = shade(c, -0.3), hl = shade(c, 0.5);
  const leaf = `<path d="M50 26c6-10 18-10 22-6c-6 6-14 8-22 6z" fill="#6fbf4a" stroke="${OUT}" stroke-width="2.5"/><path d="M50 30v-8" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`;
  switch (base) {
    case 'plum': return `${leaf}<ellipse cx="50" cy="56" rx="26" ry="28" fill="${c}" stroke="${OUT}" stroke-width="3"/><path d="M50 30c-4 12-4 34 0 52" stroke="${d}" stroke-width="2.5" fill="none"/><ellipse cx="39" cy="45" rx="6" ry="9" fill="${hl}" opacity=".6"/>`;
    case 'berry': {
      const pts = [[38, 46], [62, 46], [50, 40], [42, 62], [58, 62], [50, 54], [50, 74]];
      return `<path d="M50 34v-10" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><path d="M50 26c-8-6-16-4-18 0c6 4 12 4 18 0z" fill="#6fbf4a" stroke="${OUT}" stroke-width="2.5"/>` + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="${c}" stroke="${OUT}" stroke-width="2.5"/><circle cx="${x - 3}" cy="${y - 4}" r="3" fill="${hl}" opacity=".7"/>`).join('');
    }
    case 'beet': return `<path d="M44 30c-8-14-2-20 2-20c2 6 2 14-2 20zM56 30c8-14 2-20-2-20c-2 6-2 14 2 20zM50 30c0-14 0-18 0-20" stroke="${OUT}" stroke-width="2.5" fill="#5fae45"/><path d="M50 30c18 0 26 14 22 28c-4 12-14 18-22 32c-8-14-18-20-22-32c-4-14 4-28 22-28z" fill="${c}" stroke="${OUT}" stroke-width="3"/><ellipse cx="40" cy="46" rx="5" ry="8" fill="${hl}" opacity=".55"/>`;
    case 'root': return `<path d="M42 24c-4-10 0-14 4-14c2 6 0 10-4 14zM58 24c4-10 0-14-4-14c-2 6 0 10 4 14z" fill="#5fae45" stroke="${OUT}" stroke-width="2.5"/><path d="M34 28h32c2 0 2 4 1 8L52 88c-1 3-3 3-4 0L33 36c-1-4-1-8 1-8z" fill="${c}" stroke="${OUT}" stroke-width="3"/><path d="M40 42h8M44 56h8M46 70h6" stroke="${d}" stroke-width="2.5" stroke-linecap="round"/>`;
    case 'wheat': return `<path d="M50 90V20" stroke="${OUT}" stroke-width="3"/>` + [24, 36, 48, 60].map(y => `<ellipse cx="42" cy="${y}" rx="7" ry="11" transform="rotate(-25 42 ${y})" fill="${c}" stroke="${OUT}" stroke-width="2.2"/><ellipse cx="58" cy="${y}" rx="7" ry="11" transform="rotate(25 58 ${y})" fill="${c}" stroke="${OUT}" stroke-width="2.2"/>`).join('');
    case 'petal': return `<path d="M50 78v14" stroke="${OUT}" stroke-width="3"/>` + [0, 72, 144, 216, 288].map(a => `<ellipse cx="50" cy="34" rx="11" ry="17" transform="rotate(${a} 50 54)" fill="${c}" stroke="${OUT}" stroke-width="2.5"/>`).join('') + `<circle cx="50" cy="54" r="10" fill="#ffd166" stroke="${OUT}" stroke-width="2.5"/>`;
    case 'corn': return `<path d="M50 90c-16-6-22-20-20-34c6 8 12 14 20 18z" fill="#6fbf4a" stroke="${OUT}" stroke-width="2.5"/><path d="M50 90c16-6 22-20 20-34c-6 8-12 14-20 18z" fill="#5fae45" stroke="${OUT}" stroke-width="2.5"/><ellipse cx="50" cy="48" rx="14" ry="32" fill="${c}" stroke="${OUT}" stroke-width="3"/>` + [28, 38, 48, 58, 68].map(y => `<path d="M38 ${y}h24" stroke="${d}" stroke-width="2" opacity=".7"/>`).join('') + `<path d="M44 20v54M56 20v54" stroke="${d}" stroke-width="2" opacity=".5"/><ellipse cx="45" cy="38" rx="3" ry="8" fill="${hl}" opacity=".6"/>`;
    case 'bean': return `<path d="M50 18v10" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><path d="M50 22c8-8 18-6 20-2c-6 4-14 4-20 2z" fill="#6fbf4a" stroke="${OUT}" stroke-width="2.2"/><path d="M42 28c-10 18-8 44 6 58c6 4 12 0 8-6c-10-14-10-32-2-48c2-6-8-10-12-4z" fill="${c}" stroke="${OUT}" stroke-width="3"/><path d="M58 30c12 16 12 40 0 54c-4 4-10 0-6-5c8-12 8-30 0-44c-2-5 2-8 6-5z" fill="${shade(c, -0.12)}" stroke="${OUT}" stroke-width="3"/><circle cx="48" cy="44" r="3.5" fill="${hl}" opacity=".7"/><circle cx="49" cy="58" r="3.5" fill="${hl}" opacity=".7"/><circle cx="52" cy="72" r="3" fill="${hl}" opacity=".7"/>`;
    case 'onion': return `<path d="M46 30c-2-10 0-18 4-20c4 2 6 10 4 20" fill="#6fbf4a" stroke="${OUT}" stroke-width="2.5"/><path d="M50 30c-20 4-30 18-28 34c2 16 14 24 28 24s26-8 28-24c2-16-8-30-28-34z" fill="${c}" stroke="${OUT}" stroke-width="3"/><path d="M50 32c-10 8-14 22-12 36M50 32c10 8 14 22 12 36M50 32v52" stroke="${d}" stroke-width="2" fill="none" opacity=".6"/><path d="M44 88h12M47 92h6" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/><ellipse cx="36" cy="56" rx="5" ry="9" fill="${hl}" opacity=".5"/>`;
    case 'tomato': return `<circle cx="50" cy="58" r="28" fill="${c}" stroke="${OUT}" stroke-width="3"/><path d="M50 34l5-8l3 9l9-2l-6 7l-11 2l-11-2l-6-7l9 2l3-9z" fill="#5fae45" stroke="${OUT}" stroke-width="2.2"/><ellipse cx="38" cy="50" rx="6" ry="8" fill="${hl}" opacity=".55"/>`;
    case 'pumpkin': return `<path d="M50 34c0-8 4-12 8-12" stroke="${OUT}" stroke-width="4" fill="none"/><ellipse cx="34" cy="60" rx="16" ry="24" fill="${d}" stroke="${OUT}" stroke-width="3"/><ellipse cx="66" cy="60" rx="16" ry="24" fill="${d}" stroke="${OUT}" stroke-width="3"/><ellipse cx="50" cy="60" rx="17" ry="26" fill="${c}" stroke="${OUT}" stroke-width="3"/><ellipse cx="45" cy="50" rx="4" ry="8" fill="${hl}" opacity=".5"/>`;
  }
}
/* Crop icon from an invention */
function cropIcon(inv, size = 56, proc = false) {
  if (!proc && inv.imageUrl) return aiImgTag(inv.imageUrl, size, 'glowy');
  if (!proc && inv.imagePreview) return previewComposite(cropIcon(inv, 100, true).replace(/^<svg[^>]*>|<\/svg>\s*$/g, ''), inv.accessories || [], size);
  const t = TRAITS[inv.trait], c = cropColor(inv), id = 'g' + (++_uid);
  const sc = t.scale || 1;
  const glow = t.glow || inv.source === 'ai';
  return `<svg class="ico ${glow ? 'glowy' : ''}" viewBox="0 0 100 100" width="${size}" height="${size}">
   <defs><radialGradient id="${id}"><stop offset="0" stop-color="${shade(c, .6)}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
   ${glow ? `<circle cx="50" cy="56" r="46" fill="url(#${id})" class="aura"/>` : ''}
   <g transform="translate(50 56) scale(${sc}) translate(-50 -56)">${cropBody(inv.base, c)}${pattern(t.pattern, c)}</g>
   ${glow ? sparkles(5, '#fff6c2', inv.base.length * 13 + inv.trait.length) : ''}
  </svg>`;
}
/* Product icon: gingham-lid jar / bottle / pie */
function productIcon(inv, recipe, size = 56, src = 'basic', blend = null) {
  const id = 'p' + (++_uid), r = RECIPES[recipe];
  // combined goods: a striped blend of every ingredient colour
  const bl = blend && blend.length > 1 ? `<linearGradient id="${id}b" x1="0" x2="1" y1="0" y2="1">${blend.map((col, i) => `<stop offset="${i / blend.length}" stop-color="${col}"/><stop offset="${(i + 1) / blend.length}" stop-color="${col}"/>`).join('')}</linearGradient>` : '';
  const c = bl ? `url(#${id}b)` : cropColor(inv);
  const lid = recipe === 'pickles' ? '#5aa9e6' : '#8e5bd1';
  const gingham = `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="8" fill="${lid}" opacity=".6"/><rect width="8" height="4" fill="${lid}" opacity=".6"/></pattern>`;
  let body;
  if (r.kind === 'jar') body = `<rect x="26" y="34" width="48" height="54" rx="12" fill="${recipe === 'pickles' && !bl ? mix(c, '#9ad0f5', .5) : c}" stroke="${OUT}" stroke-width="3"/>
    <rect x="30" y="38" width="10" height="40" rx="5" fill="#fff" opacity=".35"/>
    <rect x="34" y="56" width="32" height="18" rx="4" fill="#f3e2c0" stroke="${OUT}" stroke-width="2"/><text x="50" y="69" font-size="11" text-anchor="middle" fill="${OUT}">${TRAITS[inv.trait].sym}</text>
    <rect x="28" y="26" width="44" height="10" rx="3" fill="#c9a26b" stroke="${OUT}" stroke-width="2.5"/>
    <path d="M22 26c4-12 52-12 56 0c-2 6-8 4-10 8c-10-4-26-4-36 0c-2-4-8-2-10-8z" fill="url(#${id})" stroke="${OUT}" stroke-width="2.5"/>
    <path d="M30 30q20 6 40 0" stroke="#b08ad8" stroke-width="2" fill="none"/>`;
  else if (r.kind === 'bottle') body = `<path d="M42 14h16v16c10 6 14 12 14 22v30c0 6-4 8-10 8H38c-6 0-10-2-10-8V52c0-10 4-16 14-22z" fill="${c}" stroke="${OUT}" stroke-width="3"/>
    <rect x="40" y="8" width="20" height="10" rx="3" fill="url(#${id})" stroke="${OUT}" stroke-width="2.5"/>
    <rect x="34" y="40" width="7" height="34" rx="3.5" fill="#fff" opacity=".35"/><rect x="36" y="56" width="28" height="16" rx="4" fill="#f3e2c0" stroke="${OUT}" stroke-width="2"/><text x="50" y="68" font-size="10" text-anchor="middle" fill="${OUT}">${TRAITS[inv.trait].sym}</text>`;
  else if (r.kind === 'bowl') body = `<ellipse cx="50" cy="44" rx="38" ry="10" fill="${c}" stroke="${OUT}" stroke-width="3"/><path d="M12 44c0 26 18 40 38 40s38-14 38-40c-8 6-24 10-38 10s-30-4-38-10z" fill="#f3e2c0" stroke="${OUT}" stroke-width="3"/><path d="M20 58q30 12 60 0" stroke="${lid}" stroke-width="4" fill="none"/><path d="M36 86h28" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="42" r="3" fill="#fff" opacity=".5"/><circle cx="58" cy="44" r="2.5" fill="#fff" opacity=".5"/><path class="steam" d="M40 30c-4-6 4-8 0-14M58 30c-4-6 4-8 0-14" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  else body = `<ellipse cx="50" cy="70" rx="40" ry="14" fill="#d9a066" stroke="${OUT}" stroke-width="3"/><path d="M12 66c0-22 76-22 76 0c-10 6-66 6-76 0z" fill="#f2c27b" stroke="${OUT}" stroke-width="3"/>
    <path d="M26 58l12 6M46 54l8 8M64 56l10 6" stroke="${c}" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="56" r="6" fill="${c}" stroke="${OUT}" stroke-width="2"/>`;
  const glow = src === 'ai';
  return `<svg class="ico ${glow ? 'glowy' : ''}" viewBox="0 0 100 100" width="${size}" height="${size}"><defs>${gingham}${bl}</defs>${body}${bl ? `<g transform="translate(78 22)"><circle r="10" fill="#fff" stroke="${OUT}" stroke-width="2"/><text y="4.5" font-size="13" font-weight="700" text-anchor="middle" fill="${OUT}">${blend.length}</text></g>` : ''}${glow ? sparkles(5, '#fff6c2', 11) : ''}</svg>`;
}
/* Tool / machine icons */
function toolIcon(key, size = 64, proc = false) {
  const T0 = TOOLS[key];
  if (!proc && T0.imageUrl) return aiImgTag(T0.imageUrl, size, 'glowy');
  if (!proc && T0.imagePreview) return previewComposite(toolIcon(key, 100, true).replace(/^<svg[^>]*>|<\/svg>\s*$/g, ''), T0.accessories || [], size);
  const T = TOOLS[key], ai = T.source === 'ai', artKey = T.art || key;
  const art = {
    cookpot: `<ellipse cx="50" cy="84" rx="34" ry="6" fill="#00000022"/><path d="M18 44h64v22c0 14-12 20-32 20s-32-6-32-20z" fill="#8a8f98" stroke="${OUT}" stroke-width="3"/><rect x="14" y="38" width="72" height="10" rx="5" fill="#a7adb6" stroke="${OUT}" stroke-width="3"/><path d="M10 50h8M82 50h8" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/><path class="steam" d="M38 30c-4-6 4-8 0-14M52 30c-4-6 4-8 0-14M64 30c-4-6 4-8 0-14" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>`,
    crock: `<ellipse cx="50" cy="86" rx="28" ry="5" fill="#00000022"/><path d="M30 24h40l4 10c8 10 8 40 0 50H26c-8-10-8-40 0-50z" fill="#c98b5a" stroke="${OUT}" stroke-width="3"/><rect x="28" y="16" width="44" height="10" rx="4" fill="#a86a3e" stroke="${OUT}" stroke-width="3"/><path d="M26 50h48" stroke="#e8c39e" stroke-width="5"/>`,
    oven: `<ellipse cx="50" cy="88" rx="38" ry="5" fill="#00000022"/><path d="M12 86V50c0-24 18-36 38-36s38 12 38 36v36z" fill="#c8553d" stroke="${OUT}" stroke-width="3"/><path d="M12 60h76M12 74h76M30 50v10M50 60v14M70 50v10M40 74v12M62 74v12" stroke="#8f3524" stroke-width="2"/><path d="M34 86V62c0-10 32-10 32 0v24z" fill="#3b2418" stroke="${OUT}" stroke-width="3"/><path d="M42 84c2-10 8-6 8-14c4 6 8 6 8 14z" fill="#ffb347"/>`,
    still: `<ellipse cx="50" cy="88" rx="36" ry="5" fill="#00000022"/><circle cx="40" cy="58" r="26" fill="#e09a5b" stroke="${OUT}" stroke-width="3"/><circle cx="32" cy="50" r="7" fill="#fff" opacity=".45"/><path d="M40 32V18h20c10 0 16 6 16 16v30" stroke="${OUT}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M40 32V18h20c10 0 16 6 16 16v30" stroke="#f0b27a" stroke-width="3.5" fill="none" stroke-linecap="round"/><rect x="66" y="64" width="20" height="22" rx="5" fill="#b8a2f0" stroke="${OUT}" stroke-width="3"/><circle cx="40" cy="60" r="8" fill="#9b6cf0" stroke="${OUT}" stroke-width="2"/>`,
  }[artKey];
  return `<svg class="ico ${ai ? 'glowy' : ''}" viewBox="0 0 100 100" width="${size}" height="${size}">${ai ? `<circle cx="50" cy="55" r="46" fill="#c9a8ff" opacity=".35" class="aura"/>` : ''}<g style="${T.hue ? `filter:hue-rotate(${T.hue}deg) saturate(1.3)` : ''}">${art}</g>${ai ? sparkles(7, '#fff6a8', 3) : ''}</svg>`;
}
/* Wicker basket SVG (front lip) */
function basketFront() {
  return `<svg viewBox="0 0 120 50" preserveAspectRatio="none" class="basket-front"><defs><pattern id="wk" width="12" height="10" patternUnits="userSpaceOnUse"><rect width="12" height="10" fill="#c58b4c"/><path d="M0 5q3-5 6 0t6 0" stroke="#8a5a2b" stroke-width="2" fill="none"/><path d="M0 10q3-5 6 0t6 0" stroke="#e0aa6a" stroke-width="1.5" fill="none"/></pattern></defs>
    <path d="M4 6h112l-10 40H14z" fill="url(#wk)" stroke="${OUT}" stroke-width="3"/><rect x="0" y="0" width="120" height="10" rx="5" fill="#d9a05f" stroke="${OUT}" stroke-width="3"/></svg>`;
}
/* Chunky wooden MARKET PLOT logo sign */
function logoSVG(w = 150) {
  return `<svg viewBox="0 0 300 120" width="${w}" class="logo-svg">
   <defs><linearGradient id="wood" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e2b071"/><stop offset="1" stop-color="#b9793f"/></linearGradient></defs>
   <rect x="8" y="6" width="284" height="108" rx="18" fill="url(#wood)" stroke="#5b3a1e" stroke-width="5"/>
   <path d="M20 40h260M20 78h260" stroke="#a3683a" stroke-width="2" opacity=".6"/>
   <path d="M14 20c20-14 30 4 44-8M286 22c-16-14-28 6-42-8" stroke="#4f9a3a" stroke-width="5" fill="none" stroke-linecap="round"/>
   <circle cx="24" cy="22" r="6" fill="#6fbf4a" stroke="#2f5e22" stroke-width="2"/><circle cx="276" cy="24" r="6" fill="#6fbf4a" stroke="#2f5e22" stroke-width="2"/>
   <text x="150" y="58" text-anchor="middle" class="logo-t1">MARKET</text>
   <text x="150" y="104" text-anchor="middle" class="logo-t2">PLOT</text>
  </svg>`;
}
function coinSVG(s = 18) { return `<svg viewBox="0 0 20 20" width="${s}" height="${s}"><circle cx="10" cy="10" r="8.5" fill="#f6c443" stroke="#9a6a12" stroke-width="2"/><circle cx="10" cy="10" r="5" fill="none" stroke="#fff0b0" stroke-width="1.5"/></svg>`; }
function customerSVG(seed) {
  const skins = ['#f6d1b1', '#e0a982', '#b07a52', '#7a4e33', '#f2c7a0'];
  const shirts = ['#8e5bd1', '#5aa9e6', '#ef8b6b', '#6fbf4a', '#f2c94c', '#e86fa6'];
  const hats = ['none', 'straw', 'beanie', 'bow'];
  const sk = skins[seed % 5], sh = shirts[(seed >> 2) % 6], hat = hats[(seed >> 3) % 4];
  let h = '';
  if (hat === 'straw') h = `<ellipse cx="30" cy="16" rx="22" ry="5" fill="#f2d07a" stroke="${OUT}" stroke-width="2"/><path d="M18 16c0-12 24-12 24 0z" fill="#f2d07a" stroke="${OUT}" stroke-width="2"/><path d="M19 13h22" stroke="#8e5bd1" stroke-width="3"/>`;
  if (hat === 'beanie') h = `<path d="M15 20c0-16 30-16 30 0z" fill="${shirts[(seed + 3) % 6]}" stroke="${OUT}" stroke-width="2"/><circle cx="30" cy="5" r="4" fill="#fff" stroke="${OUT}" stroke-width="2"/>`;
  if (hat === 'bow') h = `<path d="M38 10l8-5v10zM38 10l-6-5v10z" fill="#e86fa6" stroke="${OUT}" stroke-width="2"/>`;
  return `<svg viewBox="0 0 60 90" width="44" height="66"><ellipse cx="30" cy="86" rx="16" ry="4" fill="#00000025"/>
   <path d="M12 86V58c0-12 36-12 36 0v28z" fill="${sh}" stroke="${OUT}" stroke-width="2.5"/>
   <circle cx="30" cy="28" r="16" fill="${sk}" stroke="${OUT}" stroke-width="2.5"/>
   <circle cx="24" cy="28" r="2.2" fill="${OUT}"/><circle cx="36" cy="28" r="2.2" fill="${OUT}"/>
   <path d="M25 35q5 4 10 0" stroke="${OUT}" stroke-width="2" fill="none" stroke-linecap="round"/>
   <circle cx="20" cy="33" r="3" fill="#ff9aa2" opacity=".6"/><circle cx="40" cy="33" r="3" fill="#ff9aa2" opacity=".6"/>${h}</svg>`;
}
