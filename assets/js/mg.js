/* =============================================================================
   Mind Games core
   Shared helpers and the page shell every game is built on: top bar, levels,
   clock, pause, coach line, rules, settings, statistics and the end sheet.
   ============================================================================= */
(function () {
'use strict';
const MG = window.MG = window.MG || {};

/* ---------------------------------------------------------------- helpers */
MG.root = document.documentElement.getAttribute('data-root') || '';
MG.$ = id => document.getElementById(id);
MG.qs = (s, r = document) => r.querySelector(s);
MG.qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
MG.range = n => Array.from({ length: n }, (_, i) => i);
MG.rand = n => Math.floor(Math.random() * n);
MG.pick = a => a[Math.floor(Math.random() * a.length)];
MG.shuffle = (a, rnd = Math.random) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
};
MG.sleep = ms => new Promise(r => setTimeout(r, ms));
MG.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
MG.plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
MG.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
MG.rng = seed => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
MG.fmtTime = ms => {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
MG.spokenTime = ms => {
  const s = Math.round(ms / 1000), m = Math.floor(s / 60), sec = s % 60;
  return m ? `${m} minute${m === 1 ? '' : 's'} ${sec} second${sec === 1 ? '' : 's'}` : `${sec} seconds`;
};
/* Tiny element builder: MG.h('button', { class: 'x', onclick: fn }, 'text', child) */
MG.h = function (tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const mq = q => (window.matchMedia ? window.matchMedia(q) : null);
const mqDark = mq('(prefers-color-scheme: dark)');
const mqReduce = mq('(prefers-reduced-motion: reduce)');
const mqCoarse = mq('(pointer: coarse)');
MG.reduced = () => !!(mqReduce && mqReduce.matches);
MG.style = css => { const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el); return el; };
MG.touch = () => !!(mqCoarse && mqCoarse.matches);
MG.anyDialogOpen = () => !!document.querySelector('dialog[open]');
MG.typing = e => { const t = e.target; return !!(t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')); };

/* ---------------------------------------------------------------- storage */
MG.store = {
  get(k, def = null) { try { const s = localStorage.getItem('mg:' + k); return s ? JSON.parse(s) : def; } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('mg:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem('mg:' + k); } catch (e) { /* storage unavailable */ } },
};

/* ---------------------------------------------------------------- prefs + theme */
MG.prefs = Object.assign({ theme: 'auto', sound: true }, MG.store.get('prefs') || {});
MG.savePrefs = () => MG.store.set('prefs', MG.prefs);
MG.isDark = () => MG.prefs.theme === 'dark' || (MG.prefs.theme === 'auto' && !!mqDark && mqDark.matches);
MG.applyTheme = () => {
  const root = document.documentElement;
  if (MG.prefs.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', MG.prefs.theme);
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = MG.isDark() ? '#11151C' : '#EEF1F5';
  MG.qsa('[data-theme-opt]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.themeOpt === MG.prefs.theme)));
  document.dispatchEvent(new CustomEvent('mg:theme'));
};
MG.setTheme = t => { MG.prefs.theme = t; MG.savePrefs(); MG.applyTheme(); MG.toParent({ mg: 'theme', theme: t }); };
if (mqDark) { const f = () => MG.applyTheme(); if (mqDark.addEventListener) mqDark.addEventListener('change', f); else if (mqDark.addListener) mqDark.addListener(f); }
MG.applyTheme();
MG.cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------------------------------------------------------------- living inside the launcher
   When a game runs in the one-page launcher, its back button returns to the library,
   and theme changes and pauses travel between the two. */
MG.embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
MG.toParent = msg => { if (MG.embedded) { try { window.parent.postMessage(msg, '*'); } catch (e) { /* no parent */ } } };
window.addEventListener('message', e => {
  if (!MG.embedded || e.source !== window.parent || !e.data || typeof e.data !== 'object') return;
  const d = e.data;
  if (d.mg === 'theme' && d.theme && d.theme !== MG.prefs.theme) { MG.prefs.theme = d.theme; MG.savePrefs(); MG.applyTheme(); }
  else if (d.mg === 'pause' || d.mg === 'resume') document.dispatchEvent(new CustomEvent('mg:' + d.mg));
});

/* ---------------------------------------------------------------- sound: synthesized, nothing to host */
MG.sfx = (() => {
  let ctx = null, gestured = false;
  ['pointerdown', 'keydown'].forEach(t => window.addEventListener(t, () => { gestured = true; }, true));
  const tone = (f, dur = 0.1, type = 'sine', vol = 0.05, at = 0, to) => {
    if (!gestured) return;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) { /* audio unavailable */ }
  };
  const on = fn => (...a) => { if (MG.prefs.sound) fn(...a); };
  return {
    tone: on(tone),
    place: on(() => tone(660, 0.09, 'sine', 0.05)),
    note: on(() => tone(1320, 0.05, 'sine', 0.02)),
    tap: on(() => tone(880, 0.045, 'sine', 0.03)),
    move: on(() => tone(520, 0.07, 'triangle', 0.045)),
    slide: on(() => tone(340, 0.09, 'triangle', 0.04, 0, 420)),
    flip: on(() => tone(740, 0.06, 'square', 0.015)),
    wrong: on(() => { tone(196, 0.18, 'triangle', 0.07); tone(147, 0.24, 'triangle', 0.06, 0.07); }),
    unit: on(() => [523.3, 659.3, 784].forEach((f, k) => tone(f, 0.16, 'sine', 0.04, k * 0.06))),
    hint: on(() => [784, 1046.5].forEach((f, k) => tone(f, 0.14, 'sine', 0.04, k * 0.08))),
    win: on(() => [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, k) => tone(f, 0.34, 'sine', 0.045, k * 0.09))),
    lose: on(() => [392, 330, 262].forEach((f, k) => tone(f, 0.3, 'triangle', 0.05, k * 0.14))),
    draw: on(() => [523.3, 523.3].forEach((f, k) => tone(f, 0.2, 'sine', 0.04, k * 0.16))),
    blip: on((f = 600, d = 0.12) => tone(f, d, 'sine', 0.05)),
  };
})();

/* ---------------------------------------------------------------- feedback */
let toastTimer = 0;
MG.toast = msg => {
  let el = MG.$('mgToast');
  if (!el) { el = MG.h('div', { class: 'toast', id: 'mgToast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
};
MG.announce = msg => {
  let el = MG.$('mgSr');
  if (!el) { el = MG.h('div', { class: 'sr-only', id: 'mgSr', 'aria-live': 'assertive' }); document.body.appendChild(el); }
  el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 40);
};
MG.buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* no haptics */ } };
MG.replay = (node, cls, ms = 500) => {
  if (!node) return;
  node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls);
  const key = '_t_' + cls; clearTimeout(node[key]); node[key] = setTimeout(() => node.classList.remove(cls), ms);
};

/* Confetti in highlighter colours: rectangles and marker dashes */
MG.confetti = (opts = {}) => {
  if (MG.reduced()) return;
  const cv = MG.h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const dark = MG.isDark();
  const cols = ['sudoku', 'logic', 'numbers', 'moves', 'duels', 'brain'].map(c => MG.cssVar(`--c-${c}${dark ? '-deep' : ''}`) || '#FFE15A');
  if (!dark) cols.push(MG.cssVar('--pen') || '#2340B8');
  const N = opts.count || 150, parts = [];
  for (let k = 0; k < N; k++) {
    const side = k % 2 ? 1 : -1;
    const x = opts.x != null ? opts.x : W / 2 + side * W * 0.18, y = opts.y != null ? opts.y : H * 0.42;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5 - side * 0.25, sp = 7 + Math.random() * 9;
    parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 7, h: 3 + Math.random() * 4, c: cols[k % cols.length], dash: Math.random() < 0.35, life: 0 });
  }
  let frame = 0;
  const step = () => {
    frame++;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      p.vy += 0.24; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (p.y > H + 30) continue;
      alive++;
      const a = frame > 110 ? Math.max(0, 1 - (frame - 110) / 50) : 1;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.dash) { ctx.strokeStyle = p.c; ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-p.w, 0); ctx.quadraticCurveTo(0, -4, p.w, 0); ctx.stroke(); }
      else { ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      ctx.restore();
    }
    if (alive && frame < 170) requestAnimationFrame(step); else cv.remove();
  };
  requestAnimationFrame(step);
};

/* Swipe on an element: cb('up' | 'down' | 'left' | 'right') */
MG.swipe = (el, cb, min = 26) => {
  let sx = 0, sy = 0, id = null;
  el.addEventListener('pointerdown', e => { id = e.pointerId; sx = e.clientX; sy = e.clientY; });
  el.addEventListener('pointerup', e => {
    if (e.pointerId !== id) return;
    id = null;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
    cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  el.addEventListener('pointercancel', () => { id = null; });
};

/* Key handler that stays quiet while a dialog is open or a field has focus */
MG.onKey = fn => document.addEventListener('keydown', e => {
  if (MG.anyDialogOpen() || e.defaultPrevented || MG.typing(e)) return;
  fn(e);
});

/* Buttons that answer on touch-down, for speed, and still work from the keyboard */
MG.press = (box, sel, fn) => {
  box.addEventListener('pointerdown', e => { const b = e.target.closest(sel); if (b) fn(b, e); });
  box.addEventListener('click', e => { const b = e.target.closest(sel); if (b && e.detail === 0) fn(b, e); });
};
MG.activates = e => e.key === 'Enter' || e.key === ' ';
/* Keyboard play on a rectangular board: one cell sits in the tab order and the arrow keys move it.
   act(i, e) gets every other key and returns true if it used it; moved(i) follows the cursor. */
MG.gridKeys = (box, cells, cols, act, moved) => {
  let at = 0;
  const go = i => { cells[at].tabIndex = -1; at = i; cells[at].tabIndex = 0; };
  cells.forEach((c, i) => { c.tabIndex = i ? -1 : 0; });
  box.dataset.keys = '';
  box.addEventListener('focusin', e => { const i = cells.indexOf(e.target); if (i >= 0) go(i); });
  box.addEventListener('keydown', e => {
    const i = cells.indexOf(e.target); if (i < 0) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (step) {
      e.preventDefault();
      const j = i + step, row = k => Math.floor(k / cols);
      if (j < 0 || j >= cells.length || (Math.abs(step) === 1 && row(j) !== row(i))) return;
      go(j); cells[j].focus();
      if (moved) moved(j);
    } else if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && act(i, e)) e.preventDefault();
  });
};

/* ---------------------------------------------------------------- icons */
const ICONS = {
  undo: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></g>',
  redo: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></g>',
  erase: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></g>',
  pencil: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/></g>',
  bulb: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></g>',
  plus: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></g>',
  chart: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></g>',
  sliders: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/></g>',
  sun: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></g>',
  moon: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  pause: '<g fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></g>',
  play: '<path fill="currentColor" d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8Z"/>',
  x: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></g>',
  chev: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>',
  back: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6"/>',
  restart: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></g>',
  target: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v3.5"/><path d="M12 19v3.5"/><path d="M1.5 12H5"/><path d="M19 12h3.5"/></g>',
  info: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></g>',
  help: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></g>',
  check: '<path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5"/>',
  'heart-crack': '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="m12 13-1-1 2-2-3-3 2-2"/></g>',
  flag: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4"/><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1"/></g>',
  trophy: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></g>',
  shuffle: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></g>',
  eye: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></g>',
  search: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></g>',
  cpu: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></g>',
  user: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></g>',
  dice: '<g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/></g><g fill="currentColor"><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="8" cy="16" r="1.6"/><circle cx="16" cy="16" r="1.6"/></g>',
  zap: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  bomb: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="14" r="7"/><path d="m15.5 9.5 2-2"/><path d="M19 3.5v2M21.5 6h-2M20.3 4.7l-1 1"/></g>',
  grid: '<g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></g>',
};
MG.icon = (id, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
(function sprite() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = Object.keys(ICONS).map(k => `<symbol id="i-${k}" viewBox="0 0 24 24">${ICONS[k]}</symbol>`).join('');
  const put = () => document.body.prepend(svg);
  if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
})();

/* ---------------------------------------------------------------- dialogs */
MG.sheet = ({ id, title, html = '', cls = '', wide = false }) => {
  const d = MG.h('dialog', { id, class: wide ? 'wide' : '', 'aria-labelledby': id + 'T' });
  d.innerHTML = `<div class="sheet ${cls}"><div class="sheet-h"><h2 id="${id}T">${title}</h2>
    <button type="button" class="icon-btn" data-close aria-label="Close">${MG.icon('x')}</button></div><div class="sheet-b">${html}</div></div>`;
  document.body.appendChild(d);
  return d;
};
MG.open = d => { if (d.open) return; try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } };
document.addEventListener('click', e => {
  const d = e.target.closest && e.target.closest('dialog');
  if (!d) return;
  if (e.target === d || e.target.closest('[data-close]')) d.close();
});

/* ---------------------------------------------------------------- statistics
   metric: 'time' (lower is better), 'moves' (lower), 'score' (higher), 'duel' (win/loss/draw) */
MG.Stats = function (gameId, levels, metric) {
  const KEY = 'stats:' + gameId;
  const blank = () => ({ started: 0, won: 0, lost: 0, drawn: 0, best: 0, total: 0, streak: 0, bestStreak: 0, last: 0 });
  const raw = MG.store.get(KEY) || {};
  const data = {};
  for (const k of Object.keys(levels)) data[k] = Object.assign(blank(), raw[k] || {});
  const save = () => MG.store.set(KEY, data);
  const lower = metric === 'time' || metric === 'moves';
  return {
    metric, data,
    get: k => data[k],
    start(k) { data[k].started++; save(); MG.recent(gameId); },
    breakStreak(k) { data[k].streak = 0; save(); },
    win(k, value) {
      const s = data[k], first = s.won === 0;
      s.won++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
      let isBest = false;
      if (value != null && metric !== 'duel') {
        s.total += value; s.last = value;
        isBest = !s.best || (lower ? value < s.best : value > s.best);
        if (isBest) s.best = value;
      }
      save();
      return { isBest, first };
    },
    loss(k) { data[k].lost++; data[k].streak = 0; save(); },
    draw(k) { data[k].drawn++; save(); },
    reset() { for (const k in data) data[k] = blank(); save(); },
  };
};
MG.recent = id => {
  const list = (MG.store.get('recent') || []).filter(x => x !== id);
  list.unshift(id);
  MG.store.set('recent', list.slice(0, 8));
};
MG.fmtMetric = (metric, v) => !v ? '–' : metric === 'time' ? MG.fmtTime(v) : String(v);

/* =============================================================================
   Shell
   Delayed work goes through api.later and api.wait, never a bare timer: a new round cancels
   them, and they only count time the player could be watching.
   cfg: { id, title, chapter, levels, level, metric, timer, rules, legend,
          settings: [{ key, label, desc, def }], onNew(level), onRestart(),
          typing (letter keys belong to the game), onPause(paused), onSetting(key, value), size: { ar, chrome, chromeL, maxW, minW } }
   ============================================================================= */
MG.shell = function (cfg) {
  const levels = cfg.levels || { normal: { name: 'Normal', rank: 2, desc: '' } };
  const levelKeys = Object.keys(levels);
  const metric = cfg.metric || 'time';
  const timed = cfg.timer !== false;
  const PREFKEY = 'game:' + cfg.id + ':prefs';
  const gp = Object.assign({}, ...(cfg.settings || []).map(s => ({ [s.key]: s.def })), MG.store.get(PREFKEY) || {});
  if (!levels[gp.level]) gp.level = cfg.level && levels[cfg.level] ? cfg.level : levelKeys[Math.min(1, levelKeys.length - 1)];
  const savePrefs = () => MG.store.set(PREFKEY, gp);
  const stats = MG.Stats(cfg.id, levels, metric);

  const api = { cfg, levels, stats, status: 'idle', level: gp.level, paused: false, isBusy: false };
  const app = MG.h('div', { class: 'app', 'data-chapter': cfg.chapter || 'sudoku' });
  document.body.dataset.chapter = cfg.chapter || 'sudoku';
  app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <a class="icon-btn back" href="${MG.root}index.html" aria-label="All games" title="All games">${MG.icon('back')}</a>
      <h1 class="wordmark">${cfg.title}</h1>
    </div>
    <nav class="actions" aria-label="Game menu">
      <button type="button" class="btn-new" data-mg="new" aria-label="New game">${MG.icon('plus')}<span>New game</span></button>
      <button type="button" class="icon-btn" data-mg="rules" aria-label="How to play" title="How to play">${MG.icon('help')}</button>
      <button type="button" class="icon-btn" data-mg="stats" aria-label="Statistics" title="Statistics">${MG.icon('chart')}</button>
      <button type="button" class="icon-btn" data-mg="settings" aria-label="Settings" title="Settings">${MG.icon('sliders')}</button>
    </nav>
  </header>
  <main class="stage">
    <section class="board-frame" aria-label="${MG.esc(cfg.title)}">
      <div class="statusbar">
        <button type="button" class="level" data-mg="level" aria-haspopup="dialog" title="Change level">
          <span class="meter" data-rank="2" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span data-mg="levelName"></span>${MG.icon('chev')}
        </button>
        <div class="status-mid" data-mg="mid"></div>
        <div class="clock${timed ? '' : ' no-time'}" data-mg="clockWrap">
          <span id="clock" data-mg="clock" aria-label="Elapsed time">00:00</span>
          <button type="button" class="icon-btn" data-mg="pause" aria-label="Pause"${timed ? '' : ' hidden'}>${MG.icon('pause')}</button>
        </div>
      </div>
      <div class="board-wrap" data-mg="wrap">
        <div class="board-host" data-mg="board"></div>
        <div class="overlay ov-pause" data-mg="ovPause"><p class="ov-title">Paused</p><p class="ov-text">The clock stops while the board is hidden.</p>
          <button type="button" class="btn btn-primary" data-mg="resume">${MG.icon('play')}Resume</button></div>
        <div class="overlay ov-busy" aria-live="polite"><div class="loader" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <p class="ov-text" data-mg="busyText">Getting the board ready.</p></div>
      </div>
    </section>
    <section class="controls" data-mg="controls" aria-label="Controls">
      <div class="coach" data-mg="coach" data-kind="info">
        <svg class="i coach-i" aria-hidden="true"><use data-mg="coachIcon" href="#i-info"/></svg>
        <div class="coach-body"><p class="coach-title" data-mg="coachTitle"></p><p class="coach-text" data-mg="coachText"></p>
          <div class="ticks" data-mg="ticks" hidden aria-hidden="true"><div class="ticks-fill"></div></div></div>
      </div>
    </section>
  </main>`;
  document.body.prepend(app);
  const el = {};
  MG.qsa('[data-mg]', app).forEach(n => { el[n.dataset.mg] = n; });
  api.app = app; api.board = el.board; api.wrap = el.wrap; api.mid = el.mid; api.controls = el.controls;
  MG.qs('.back', app).addEventListener('click', e => { if (MG.embedded) { e.preventDefault(); MG.toParent({ mg: 'home' }); } });
  let away = false, awayPaused = false;
  const pauseAway = () => { if (api.status === 'playing' && !api.isBusy && !api.paused) { api.setPaused(true); awayPaused = true; } };
  document.addEventListener('mg:pause', () => { away = true; pauseAway(); });
  document.addEventListener('mg:resume', () => { away = false; if (awayPaused) { awayPaused = false; api.setPaused(false); } });
  if (cfg.legend) el.controls.appendChild(MG.h('dl', { class: 'legend', 'aria-label': 'Keyboard shortcuts', html: cfg.legend }));

  /* sizing */
  api.size = (s = {}) => {
    const st = document.documentElement.style;
    st.setProperty('--ar', String(s.ar || 1));
    if (s.chrome) st.setProperty('--chrome', s.chrome + 'px'); else st.removeProperty('--chrome');
    if (s.chromeL) st.setProperty('--chrome-l', s.chromeL + 'px'); else st.removeProperty('--chrome-l');
    st.setProperty('--max-bw', (s.maxW || 620) + 'px');
    st.setProperty('--min-bw', (s.minW || 232) + 'px');
  };
  api.size(cfg.size);

  /* level */
  const renderLevel = () => {
    const L = levels[api.level];
    el.levelName.textContent = L.name;
    MG.qs('.meter', el.level).dataset.rank = String(L.rank || 2);
    el.level.hidden = levelKeys.length < 2 && !L.name;
  };
  api.setLevel = k => { if (levels[k]) { api.level = k; gp.level = k; savePrefs(); renderLevel(); } };
  renderLevel();
  api.pref = k => gp[k];
  api.setPref = (k, v) => { gp[k] = v; savePrefs(); };

  /* rounds: everything delayed belongs to the round that started it */
  let round = 0;
  const held = () => api.paused || away || document.hidden || MG.anyDialogOpen();
  const countdown = (ms, done, dead) => {
    const r = round;
    let left = ms, last = performance.now();
    const step = () => {
      if (r !== round) { if (dead) dead(); return; }
      const now = performance.now();
      if (!held()) left -= now - last;
      last = now;
      if (left > 0 || held()) setTimeout(step, MG.clamp(left, 16, 50)); else done();
    };
    setTimeout(step, MG.clamp(ms, 0, 50));
  };
  api.later = (fn, ms = 0) => countdown(ms, fn);
  /* Resolves true when the time has passed, false if the round ended first */
  api.wait = ms => new Promise(go => countdown(ms, () => go(true), () => go(false)));

  /* busy + pause */
  api.busy = (on, text) => {
    api.isBusy = !!on;
    if (text) el.busyText.textContent = text;
    el.wrap.classList.toggle('is-busy', api.isBusy);
    syncPause();
  };
  const syncPause = () => {
    el.wrap.classList.toggle('is-paused', api.paused);
    el.pause.disabled = api.status !== 'playing' || api.isBusy;
    MG.qs('use', el.pause).setAttribute('href', api.paused ? '#i-play' : '#i-pause');
    el.pause.setAttribute('aria-label', api.paused ? 'Resume' : 'Pause');
  };
  api.setPaused = p => {
    if (api.status !== 'playing' || api.isBusy) p = false;
    if (api.paused === p) return;
    api.paused = p;
    syncPause();
    if (cfg.onPause) cfg.onPause(p);
  };
  api.canPlay = () => api.status === 'playing' && !api.paused && !api.isBusy;

  /* clock */
  let elapsed = 0, ticking = false, last = performance.now();
  const running = () => ticking && api.status === 'playing' && !api.paused && !api.isBusy && !document.hidden && !MG.anyDialogOpen();
  const renderClock = () => { const t = MG.fmtTime(elapsed); if (el.clock.textContent !== t) el.clock.textContent = t; };
  api.timer = {
    start() { ticking = true; last = performance.now(); },
    stop() { ticking = false; },
    reset(ms = 0) { elapsed = ms; renderClock(); },
    get elapsed() { return elapsed; },
    set elapsed(v) { elapsed = v; renderClock(); },
  };
  setInterval(() => {
    const now = performance.now(), dt = now - last;
    last = now;
    if (running()) { elapsed += Math.min(dt, 1000); if (cfg.onTick) cfg.onTick(elapsed); }
    renderClock();
  }, 250);
  api.showClock = on => el.clockWrap.classList.toggle('no-time', !on);

  /* coach line */
  const COACH = { info: 'info', progress: 'target', hint: 'bulb', mistake: 'heart-crack', lost: 'heart-crack', done: 'check', good: 'check', turn: 'user', cpu: 'cpu' };
  let base = { kind: 'info', title: '', text: '', frac: null, n: 0 }, temp = null, coachTimer = 0;
  const renderCoach = () => {
    const c = temp || base;
    el.coach.dataset.kind = c.kind;
    el.coachIcon.setAttribute('href', '#i-' + (COACH[c.kind] || 'info'));
    if (el.coachTitle.textContent !== c.title) el.coachTitle.textContent = c.title;
    if (el.coachText.textContent !== (c.text || '')) el.coachText.textContent = c.text || '';
    const showTicks = !temp && base.frac != null;
    el.ticks.hidden = !showTicks;
    if (showTicks) { el.ticks.style.setProperty('--n', String(base.n || 50)); el.ticks.style.setProperty('--p', (base.frac * 100) + '%'); }
  };
  api.coach = (kind, title, text, ms) => {
    temp = { kind, title, text }; clearTimeout(coachTimer);
    if (ms) coachTimer = setTimeout(() => { temp = null; renderCoach(); }, ms);
    renderCoach();
  };
  api.clearCoach = () => { temp = null; clearTimeout(coachTimer); renderCoach(); };
  api.progress = (title, text, frac = null, n = 0, kind = 'progress') => { base = { kind, title, text, frac, n }; renderCoach(); };

  /* hearts (lifelines) */
  const HEART = 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';
  api.hearts = (left, max) => {
    let h = MG.qs('.hearts', el.mid);
    if (!h) { h = MG.h('div', { class: 'hearts', role: 'img' }); el.mid.prepend(h); }
    if (h.children.length !== max) h.innerHTML = MG.range(max).map(() => `<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path class="h-fill" d="${HEART}"/><path class="h-strike" d="M3.5 20.5 20.5 3.5"/></svg>`).join('');
    Array.from(h.children).forEach((x, k) => x.classList.toggle('lost', k >= left));
    h.setAttribute('aria-label', `${left} of ${max} lifelines left`);
    h.classList.toggle('off', max === 0);
    return h;
  };
  api.breakHeart = k => { const h = MG.qs('.hearts', el.mid); if (h && h.children[k]) MG.replay(h.children[k], 'breaking', 600); };

  /* rules */
  const dRules = MG.sheet({ id: 'dlgRules', title: 'How to play', wide: true,
    html: `<div class="rules">${cfg.rules || ''}</div><div class="btn-row"><button type="button" class="btn btn-primary wide" data-close>Play</button></div>` });
  api.openRules = () => MG.open(dRules);

  /* levels / new game */
  const dNew = MG.sheet({ id: 'dlgNew', title: 'New game', html: `<p class="sheet-p">${cfg.newText || 'Pick a level.'}</p><div class="levels" data-levels></div>
    <div class="sheet-foot"${cfg.onRestart ? '' : ' hidden'}><button type="button" class="btn btn-quiet" data-restart>${MG.icon('restart')}Restart this game</button></div>` });
  const levelsBox = MG.qs('[data-levels]', dNew);
  api.openLevels = () => {
    levelsBox.innerHTML = levelKeys.map(k => {
      const L = levels[k], s = stats.get(k);
      const best = metric === 'duel' ? (s.won ? `${s.won} won` : '') : s.best ? 'Best ' + MG.fmtMetric(metric, s.best) : '';
      return `<button type="button" class="lvl" data-level="${k}"${k === api.level ? ' aria-current="true"' : ''}>
        <span class="meter" data-rank="${L.rank || 2}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span><span class="lvl-name">${L.name}</span><span class="lvl-desc">${L.desc || ''}</span></span>
        <span class="lvl-best">${best}</span></button>`;
    }).join('');
    MG.qs('[data-restart]', dNew).disabled = api.isBusy || api.status === 'idle';
    MG.open(dNew);
  };
  levelsBox.addEventListener('click', e => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    dNew.close();
    api.newGame(b.dataset.level);
  });
  MG.qs('[data-restart]', dNew).addEventListener('click', () => { dNew.close(); api.restart(); });
  api.newGame = k => {
    if (api.isBusy) return;
    if (api.status === 'playing' && api.dirty) stats.breakStreak(api.level);
    round++;
    api.setLevel(k || api.level);
    api.paused = false; syncPause(); api.clearCoach();
    if (cfg.onNew) cfg.onNew(api.level);
  };
  api.restart = () => {
    if (!cfg.onRestart || api.isBusy) return;
    if (api.status === 'playing' && api.dirty) stats.breakStreak(api.level);
    round++;
    api.paused = false; syncPause(); api.clearCoach();
    cfg.onRestart();
  };

  /* game lifecycle */
  api.dirty = false;
  api.begin = (opts = {}) => {
    round++;
    api.status = 'playing'; api.dirty = false; api.paused = false;
    if (!opts.resumed) stats.start(api.level); else MG.recent(cfg.id);
    api.timer.reset(opts.elapsed || 0);
    if (timed) api.timer.start();
    api.busy(false); syncPause();
    if (away) pauseAway();
  };
  const finish = () => { api.timer.stop(); api.paused = false; syncPause(); };
  api.win = (o = {}) => {
    if (api.status !== 'playing') return {};
    api.status = 'won'; finish();
    const value = o.value != null ? o.value : metric === 'time' ? elapsed : null;
    const r = stats.win(api.level, value);
    MG.sfx.win(); MG.buzz([30, 50, 30]);
    if (!o.quiet) MG.confetti();
    const L = levels[api.level], lvl = L.name.toLowerCase();
    const badge = o.badge !== undefined ? o.badge : r.isBest ? (r.first ? `Your first ${lvl} win` : metric === 'time' ? 'New best time' : metric === 'score' ? 'New best score' : 'New record') : r.first ? `Your first ${lvl} win` : '';
    api.later(() => api.end(Object.assign({ kind: 'won', title: 'Solved', big: value != null ? MG.fmtMetric(metric, value) : '', badge }, o)), o.delay != null ? o.delay : MG.reduced() ? 150 : 1200);
    return r;
  };
  api.lose = (o = {}) => {
    if (api.status !== 'playing') return;
    api.status = 'lost'; finish();
    stats.loss(api.level);
    MG.sfx.lose(); MG.buzz(80);
    api.later(() => api.end(Object.assign({ kind: 'lost', title: 'Game over' }, o)), o.delay != null ? o.delay : 900);
  };
  api.draw = (o = {}) => {
    if (api.status !== 'playing') return;
    api.status = 'draw'; finish();
    stats.draw(api.level);
    MG.sfx.draw();
    api.later(() => api.end(Object.assign({ kind: 'draw', title: 'Draw' }, o)), o.delay != null ? o.delay : 900);
  };
  /* Score games: record the score and show the sheet */
  api.over = (o = {}) => {
    if (api.status !== 'playing') return {};
    api.status = 'over'; finish();
    const r = stats.win(api.level, o.value || 0);
    const good = r.isBest && o.value > 0;
    if (good) { MG.sfx.win(); if (!o.quiet) MG.confetti(); } else MG.sfx.draw();
    api.later(() => api.end(Object.assign({ kind: good ? 'won' : 'draw', title: 'Game over', big: String(o.value || 0), badge: good ? 'New best score' : '' }, o)), o.delay != null ? o.delay : 700);
    return r;
  };

  /* end sheet */
  const dEnd = MG.h('dialog', { id: 'dlgEnd', 'aria-labelledby': 'endTitle' });
  dEnd.innerHTML = '<div class="sheet end" data-end></div>';
  document.body.appendChild(dEnd);
  const endSheet = MG.qs('[data-end]', dEnd);
  let endActs = {};
  api.end = (o) => {
    const L = levels[api.level], lvl = L.name.toLowerCase();
    const icons = { won: 'check', lost: 'heart-crack', draw: 'info', over: 'trophy' };
    const facts = o.facts || [];
    endActs = {
      again: () => api.newGame(api.level), levels: () => api.openLevels(), retry: () => api.restart(), close: () => {},
    };
    (o.actions || []).forEach((a, k) => { endActs['x' + k] = a.act; });
    const primary = o.primary || (o.kind === 'lost' && cfg.onRestart ? { label: 'Retry this game', act: 'retry' } : { label: levelKeys.length > 1 ? `New ${lvl} game` : 'Play again', act: 'again' });
    const extra = (o.actions || []).map((a, k) => `<button type="button" class="btn btn-quiet" data-act="x${k}">${a.label}</button>`).join('');
    endSheet.innerHTML = `<button type="button" class="icon-btn end-x" data-close aria-label="Close">${MG.icon('x')}</button>
      <div class="end-mark ${o.kind === 'won' ? '' : o.kind}">${MG.icon(o.icon || icons[o.kind] || 'check', 'lg')}</div>
      <h2 id="endTitle">${o.title}</h2>
      ${o.sub ? `<p class="end-sub">${o.sub}</p>` : ''}
      ${o.big ? `<p class="end-big">${o.big}</p>` : ''}
      ${o.badge ? `<p class="end-badge">${o.badge}</p>` : ''}
      ${facts.length ? `<div class="end-facts" style="--facts:${facts.length}">${facts.map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>` : ''}
      <div class="btn-row">
        ${levelKeys.length > 1 ? '<button type="button" class="btn btn-quiet" data-act="levels">Change level</button>' : ''}
        ${extra}
        <button type="button" class="btn btn-primary${o.kind === 'lost' ? ' wide' : ''}" data-act="${primary.act}" autofocus>${primary.act === 'retry' ? MG.icon('restart') : ''}${primary.label}</button>
      </div>`;
    if (o.kind === 'lost' && cfg.onRestart && primary.act === 'retry') {
      const row = MG.qs('.btn-row', endSheet);
      row.appendChild(MG.h('button', { type: 'button', class: 'btn btn-quiet', 'data-act': 'again', text: 'New game' }));
    }
    MG.open(dEnd);
  };
  dEnd.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const f = endActs[b.dataset.act];
    dEnd.close();
    if (f) f();
  });

  /* stats */
  const dStats = MG.sheet({ id: 'dlgStats', title: 'Statistics',
    html: `<div class="seg wide" role="group" aria-label="Level" data-seg${levelKeys.length < 2 ? ' hidden' : ''}>${levelKeys.map(k => `<button type="button" data-sl="${k}">${levels[k].short || levels[k].name}</button>`).join('')}</div>
      <div class="stats-grid" data-grid></div>
      <div class="sheet-foot"><button type="button" class="btn btn-quiet btn-danger" data-reset>Reset statistics</button></div>` });
  let statsLevel = api.level;
  const renderStats = () => {
    const s = stats.get(statsLevel);
    MG.qsa('[data-sl]', dStats).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sl === statsLevel)));
    let tiles;
    if (metric === 'duel') {
      const played = s.won + s.lost + s.drawn;
      tiles = [[played, 'Games played'], [s.won, 'Won'], [s.lost, 'Lost'], [s.drawn, 'Drawn'], [played ? Math.round(s.won / played * 100) + '%' : '–', 'Win rate'], [s.streak, `Win streak (best ${s.bestStreak})`]];
    } else if (metric === 'score') {
      tiles = [[s.won, 'Games played'], [s.best || '–', 'Best score'], [s.won ? Math.round(s.total / s.won) : '–', 'Average score'], [s.last || '–', 'Last score'], [s.total || 0, 'Total points'], [s.started, 'Games started']];
    } else {
      const f = v => MG.fmtMetric(metric, v);
      tiles = [[s.started, 'Games started'], [s.won, 'Games won'], [s.started ? Math.round((s.won / s.started) * 100) + '%' : '–', 'Win rate'],
        [f(s.best), metric === 'time' ? 'Best time' : 'Fewest moves'], [s.won ? f(Math.round(s.total / s.won)) : '–', metric === 'time' ? 'Average win' : 'Average moves'], [s.streak, `Win streak (best ${s.bestStreak})`]];
    }
    MG.qs('[data-grid]', dStats).innerHTML = tiles.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  };
  MG.qs('[data-seg]', dStats).addEventListener('click', e => { const b = e.target.closest('[data-sl]'); if (b) { statsLevel = b.dataset.sl; renderStats(); } });
  const resetBtn = MG.qs('[data-reset]', dStats);
  resetBtn.addEventListener('click', () => {
    if (resetBtn.dataset.armed !== '1') {
      resetBtn.dataset.armed = '1'; resetBtn.textContent = 'Tap again to erase all statistics';
      setTimeout(() => { resetBtn.dataset.armed = ''; resetBtn.textContent = 'Reset statistics'; }, 3500);
      return;
    }
    stats.reset(); resetBtn.dataset.armed = ''; resetBtn.textContent = 'Reset statistics'; renderStats(); MG.toast('Statistics erased');
  });
  api.openStats = () => { statsLevel = api.level; renderStats(); MG.open(dStats); };

  /* settings */
  const gameRows = (cfg.settings || []).map(s => `<label class="set-row"><span><b>${s.label}</b>${s.desc ? `<small>${s.desc}</small>` : ''}</span>
    <input type="checkbox" class="switch" role="switch" data-gs="${s.key}"></label>`).join('');
  const dSet = MG.sheet({ id: 'dlgSettings', title: 'Settings', html: `
    <div class="set-row"><span><b>Theme</b><small>Auto follows your device.</small></span>
      <div class="seg" role="group" aria-label="Theme"><button type="button" data-theme-opt="auto">Auto</button><button type="button" data-theme-opt="light">Light</button><button type="button" data-theme-opt="dark">Dark</button></div></div>
    <label class="set-row"><span><b>Sound effects</b></span><input type="checkbox" class="switch" role="switch" data-sound></label>
    ${gameRows}` });
  MG.qsa('[data-theme-opt]', dSet).forEach(b => b.addEventListener('click', () => MG.setTheme(b.dataset.themeOpt)));
  const snd = MG.qs('[data-sound]', dSet);
  snd.addEventListener('change', () => { MG.prefs.sound = snd.checked; MG.savePrefs(); });
  MG.qsa('[data-gs]', dSet).forEach(inp => inp.addEventListener('change', () => {
    gp[inp.dataset.gs] = inp.checked; savePrefs();
    if (cfg.onSetting) cfg.onSetting(inp.dataset.gs, inp.checked);
  }));
  api.openSettings = () => {
    snd.checked = !!MG.prefs.sound;
    MG.qsa('[data-gs]', dSet).forEach(inp => { inp.checked = !!gp[inp.dataset.gs]; });
    MG.applyTheme();
    MG.open(dSet);
  };

  /* wiring */
  el.new.addEventListener('click', () => (levelKeys.length > 1 || cfg.onRestart ? api.openLevels() : api.newGame()));
  el.level.addEventListener('click', api.openLevels);
  el.rules.addEventListener('click', api.openRules);
  el.stats.addEventListener('click', api.openStats);
  el.settings.addEventListener('click', api.openSettings);
  el.pause.addEventListener('click', () => api.setPaused(!api.paused));
  el.resume.addEventListener('click', e => { e.stopPropagation(); api.setPaused(false); });
  el.ovPause.addEventListener('click', () => api.setPaused(false));
  MG.onKey(e => {
    if ((e.key === 'p' || e.key === 'P') && timed && !cfg.typing && !e.ctrlKey && !e.metaKey && !e.altKey) { api.setPaused(!api.paused); e.preventDefault(); }
    else if (e.key === '?' ) { api.openRules(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (cfg.onHide) cfg.onHide(); if (timed && api.status === 'playing' && elapsed > 1500) api.setPaused(true); }
  });
  window.addEventListener('pagehide', () => { if (cfg.onHide) cfg.onHide(); });

  /* first visit: show the rules once */
  api.firstVisit = !MG.store.get('seen:' + cfg.id);
  if (api.firstVisit && cfg.rules) {
    MG.store.set('seen:' + cfg.id, 1);
    setTimeout(() => MG.open(dRules), 350);
  }
  syncPause();
  return api;
};
})();
