/* Market Plot (Pages build) password gate. The game scripts are only loaded after the password is accepted.
   Stored: PBKDF2-SHA256(password, salt, iterations) — never the password itself. Success is remembered in localStorage.
   NOTE: this is a client-side "keep casual visitors out" gate on a static site, not real access control. */
(function () {
  var CFG = window.MP_GATE; var KEY = 'marketplot.gate.v1';
  var SCRIPTS = window.MP_SCRIPTS || [];
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function derive(pw) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(CFG.salt), iterations: CFG.iterations }, k, 256);
    }).then(hex);
  }
  function loadGame() {
    var gate = document.getElementById('mp-gate'); if (gate) gate.remove();
    var i = 0; (function next() { if (i >= SCRIPTS.length) return; var s = document.createElement('script'); s.src = SCRIPTS[i++]; s.onload = next; s.onerror = next; document.body.appendChild(s); })();
  }
  if (localStorage.getItem(KEY) === CFG.hash) return loadGame();
  var g = document.createElement('div'); g.id = 'mp-gate';
  g.innerHTML = '<form id="mp-gate-form" autocomplete="on"><div class="mpg-logo">🌱💡🧺</div><h1>Market Plot</h1><p class="mpg-tag">Think It, Sell It!</p>' +
    '<p class="mpg-sub">Private playtest build. Enter the password to play.</p>' +
    '<input id="mp-gate-pw" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password" required>' +
    '<button id="mp-gate-go" type="submit">Play</button><p id="mp-gate-err" class="mpg-err" role="alert"></p>' +
    '<p class="mpg-note">Early prototype · Demo AI mode (no real AI calls)</p></form>';
  var st = document.createElement('style');
  st.textContent = '#mp-gate{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:linear-gradient(#bfe6ff,#e9f7d8);font-family:Fredoka,system-ui,sans-serif;padding:24px}' +
    '#mp-gate form{background:#fffdf5;border-radius:22px;box-shadow:0 8px 30px rgba(60,90,40,.25);padding:28px 22px;width:100%;max-width:340px;text-align:center;color:#3d3a2e}' +
    '#mp-gate h1{margin:6px 0 0;font-family:"Lilita One",Fredoka,sans-serif;font-size:34px;color:#4f8a2b}.mpg-logo{font-size:34px}.mpg-tag{margin:2px 0 14px;font-weight:600;color:#e0882a}' +
    '.mpg-sub{font-size:15px;margin:0 0 14px}#mp-gate input{width:100%;box-sizing:border-box;font-size:17px;padding:12px 14px;border:2px solid #cfe3b8;border-radius:14px;outline:none}' +
    '#mp-gate input:focus{border-color:#7bbd4a}#mp-gate button{margin-top:12px;width:100%;font:600 18px Fredoka,system-ui,sans-serif;padding:12px;border:0;border-radius:14px;background:#6cb33f;color:#fff}' +
    '.mpg-err{min-height:1.2em;color:#c0392b;font-size:14px;margin:10px 0 0}.mpg-note{font-size:12px;color:#8a8570;margin:8px 0 0}';
  document.head.appendChild(st); document.body.appendChild(g);
  var f = document.getElementById('mp-gate-form'), pw = document.getElementById('mp-gate-pw'), err = document.getElementById('mp-gate-err');
  setTimeout(function () { pw.focus(); }, 50);
  f.addEventListener('submit', function (e) {
    e.preventDefault(); err.textContent = '';
    if (!window.crypto || !crypto.subtle) { err.textContent = 'This browser cannot check the password (needs HTTPS).'; return; }
    derive(pw.value).then(function (h) {
      if (h === CFG.hash) { localStorage.setItem(KEY, h); loadGame(); }
      else { err.textContent = 'Wrong password. Try again.'; pw.select(); }
    }).catch(function () { err.textContent = 'Could not check the password.'; });
  });
})();
