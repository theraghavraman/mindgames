/* 2048: slide tiles, equal tiles merge, reach the target tile */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.t48 { position: absolute; inset: 0; padding: var(--gap); border-radius: 14px; background: var(--frame); container-type: inline-size; touch-action: none; --gap: 2.4cqi; }
.t48 .slot, .t48 .tile { position: absolute; left: var(--gap); top: var(--gap); width: calc((100% - (var(--n) + 1) * var(--gap)) / var(--n)); aspect-ratio: 1; border-radius: 9px;
  transform: translate(calc(var(--c) * (100% + var(--gap) * var(--n) / var(--n))), calc(var(--r) * (100% + var(--gap)))); }
.t48 .slot { background: color-mix(in srgb, var(--sheet) 13%, var(--frame)); }
.t48 .tile { display: grid; place-items: center; font-weight: 860; font-variation-settings: 'CASL' 1; transition: transform .11s ease-out; z-index: 2; letter-spacing: -.02em; }
.t48 .tile.dead { z-index: 1; }
.t48 .tile span { display: block; font-size: calc(100cqi / var(--n) * var(--fs, .42)); line-height: 1; }
.t48 .tile.new span, .t48 .tile.new { animation: pop .18s .06s ease-out both; }
.t48 .tile.merged span { animation: bump .2s ease-out; }
@keyframes bump { 50% { transform: scale(1.22); } }
.t48 .v2 { background: var(--sheet); color: var(--graphite); }
.t48 .v4 { background: var(--c-sudoku-soft); color: var(--graphite); }
.t48 .v8 { background: var(--c-numbers); color: var(--graphite); }
.t48 .v16 { background: var(--c-logic); color: var(--graphite); }
.t48 .v32 { background: var(--c-brain); color: var(--graphite); }
.t48 .v64 { background: var(--c-duels); color: var(--graphite); }
.t48 .v128 { background: var(--c-moves); color: var(--graphite); }
.t48 .v256 { background: var(--c-sudoku); color: var(--graphite); box-shadow: 0 0 14px color-mix(in srgb, var(--c-sudoku) 60%, transparent); }
.t48 .v512 { background: var(--c-numbers-deep); color: #fff; }
.t48 .v1024 { background: var(--c-logic-deep); color: #fff; box-shadow: 0 0 18px color-mix(in srgb, var(--c-logic-deep) 50%, transparent); }
.t48 .v2048 { background: var(--pen); color: var(--on-pen); box-shadow: 0 0 24px color-mix(in srgb, var(--pen) 60%, transparent); }
.t48 .vbig { background: var(--graphite); color: var(--sheet); }
`);
const LEVELS = {
  easy: { name: 'Roomy 5×5', short: '5×5', rank: 1, n: 5, goal: 2048, desc: 'More space to manoeuvre. Goal: 2048.' },
  medium: { name: 'Classic 4×4', short: '4×4', rank: 2, n: 4, goal: 2048, desc: 'The original. Goal: 2048.' },
  hard: { name: 'Tight 3×3', short: '3×3', rank: 3, n: 3, goal: 256, desc: 'Nine cells only. Goal: 256.' },
};
const RULES = `<p>Slide all tiles up, down, left or right with the arrow keys or a swipe.</p><ul>
<li>Two tiles with the same number merge into one when they slide into each other: 8 and 8 make 16.</li>
<li>A tile made by a merge can't merge again in the same slide.</li>
<li>After every slide, a new 2 (or sometimes a 4) appears in an empty cell.</li>
<li>Reach the goal tile to win, then keep going for a higher score. The game ends when no slide can change the board.</li></ul>
<p class="tip">Your score grows by the value of every merged tile.</p>`;
let S = null, box = null, els = new Map(), pending = null, nextId = 1;
const KEY = '2048:save';
const api = MG.shell({ id: '2048', title: '2048', chapter: 'moves', levels: LEVELS, metric: 'score', timer: false, rules: RULES, onNew: newGame, onHide: () => save(), size: { ar: 1, chrome: 230, maxW: 540 } });
api.mid.innerHTML = '<span class="pill">Score <b data-score>0</b></span><span class="pill">Best <b data-best>0</b></span>';
const scoreEl = MG.qs('[data-score]', api.mid), bestEl = MG.qs('[data-best]', api.mid);
function newGame(level) {
  pending = null;
  const n = LEVELS[level].n;
  S = { v: 1, level, n, grid: new Array(n * n).fill(null), score: 0, reached: false };
  build(); api.begin(); spawn(); spawn(); render(); save();
}
function build() {
  box = MG.h('div', { class: 't48', role: 'application', 'aria-label': '2048 board. Use the arrow keys or swipe.' });
  box.style.setProperty('--n', S.n);
  for (let i = 0; i < S.n * S.n; i++) { const s = MG.h('div', { class: 'slot' }); s.style.setProperty('--r', (i / S.n) | 0); s.style.setProperty('--c', i % S.n); box.appendChild(s); }
  els = new Map();
  api.board.innerHTML = ''; api.board.appendChild(box);
  MG.swipe(box, d => move({ up: 0, right: 1, down: 2, left: 3 }[d]));
}
function spawn() {
  const empty = S.grid.map((t, i) => (t ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return;
  const i = MG.pick(empty);
  S.grid[i] = { id: nextId++, v: Math.random() < .9 ? 2 : 4, isNew: true };
}
function tileEl(t) {
  let el = els.get(t.id);
  if (!el) { el = MG.h('div', { class: 'tile', html: '<span></span>' }); els.set(t.id, el); box.appendChild(el); }
  return el;
}
function paint(t, r, c) {
  const el = tileEl(t);
  el.style.setProperty('--r', r); el.style.setProperty('--c', c);
  const d = String(t.v).length;
  el.style.setProperty('--fs', d <= 2 ? .44 : d === 3 ? .36 : d === 4 ? .28 : .22);
  el.className = 'tile ' + (t.v <= 2048 ? 'v' + t.v : 'vbig') + (t.isNew ? ' new' : '') + (t.merged ? ' merged' : '') + (t.dead ? ' dead' : '');
  el.firstChild.textContent = t.v;
}
function render() {
  S.grid.forEach((t, i) => { if (t) paint(t, (i / S.n) | 0, i % S.n); });
  scoreEl.textContent = S.score;
  bestEl.textContent = Math.max(S.score, api.stats.get(api.level).best || 0);
  const top = Math.max(...S.grid.map(t => (t ? t.v : 0)));
  if (api.status === 'playing') api.progress(`Highest tile ${top}`, S.reached ? 'Goal reached. Keep going for a bigger score.' : `Goal: ${LEVELS[S.level].goal}. Swipe or use the arrow keys.`, Math.min(1, Math.log2(top) / Math.log2(LEVELS[S.level].goal)), 0);
}
function settle() {
  if (!pending) return;
  for (const t of pending.dead) { const el = els.get(t.id); if (el) el.remove(); els.delete(t.id); }
  S.grid.forEach(t => { if (t) { t.isNew = false; } });
  spawn();
  render();
  S.grid.forEach(t => { if (t) t.merged = false; });
  pending = null;
  const goal = LEVELS[S.level].goal;
  if (!S.reached && S.grid.some(t => t && t.v >= goal)) {
    S.reached = true; MG.sfx.win(); MG.confetti();
    api.coach('good', `You made ${goal}!`, 'That is the goal. Keep sliding for a bigger score.', 6000);
  }
  if (!canMove()) {
    const top = Math.max(...S.grid.map(t => (t ? t.v : 0)));
    MG.store.del(KEY);
    api.over({ value: S.score, title: S.reached ? 'Board full, goal reached' : 'No moves left', sub: `Highest tile ${top} on the ${LEVELS[S.level].short} board.`, facts: [[top, 'Highest tile'], [S.score, 'Score'], [Math.max(S.score, api.stats.get(api.level).best || 0), 'Best score']] });
  } else save();
}
function canMove() {
  const n = S.n, g = S.grid;
  for (let i = 0; i < n * n; i++) {
    if (!g[i]) return true;
    const r = (i / n) | 0, c = i % n;
    if (c < n - 1 && g[i + 1] && g[i + 1].v === g[i].v) return true;
    if (r < n - 1 && g[i + n] && g[i + n].v === g[i].v) return true;
  }
  return false;
}
function move(dir) {
  if (!api.canPlay()) return;
  settle();
  const n = S.n, [dr, dc] = [[-1, 0], [0, 1], [1, 0], [0, -1]][dir];
  const rows = MG.range(n), cols = MG.range(n);
  if (dr === 1) rows.reverse(); if (dc === 1) cols.reverse();
  const g = S.grid, merged = new Set(), dead = [];
  let moved = false, gained = 0;
  for (const r of rows) for (const c of cols) {
    const t = g[r * n + c]; if (!t) continue;
    let nr = r, nc = c, into = null;
    for (;;) {
      const tr = nr + dr, tc = nc + dc;
      if (tr < 0 || tc < 0 || tr >= n || tc >= n) break;
      const o = g[tr * n + tc];
      if (!o) { nr = tr; nc = tc; continue; }
      if (o.v === t.v && !merged.has(o.id)) into = { o, tr, tc };
      break;
    }
    if (into) {
      g[r * n + c] = null; t.dead = true; dead.push(t); paint(t, into.tr, into.tc);
      into.o.v *= 2; into.o.merged = true; merged.add(into.o.id); gained += into.o.v; moved = true;
    } else if (nr !== r || nc !== c) { g[r * n + c] = null; g[nr * n + nc] = t; moved = true; }
  }
  if (!moved) { MG.replay(box, 'nudge', 260); return; }
  S.score += gained; api.dirty = true;
  gained ? MG.sfx.blip(300 + Math.min(900, Math.log2(gained) * 60), .1) : MG.sfx.slide();
  S.grid.forEach((t, i) => { if (t) { const el = tileEl(t); el.style.setProperty('--r', (i / n) | 0); el.style.setProperty('--c', i % n); el.classList.remove('new', 'merged'); } });
  const p = pending = { dead };
  api.later(() => { if (pending === p) settle(); }, 120);
}
function save() { if (S && api.status === 'playing') MG.store.set(KEY, { v: 1, level: S.level, n: S.n, vals: S.grid.map(t => (t ? t.v : 0)), score: S.score, reached: S.reached }); }
MG.onKey(e => {
  const d = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 }[e.key];
  if (d != null) { e.preventDefault(); move(d); }
});
function load() {
  const g = MG.store.get(KEY);
  if (!g || g.v !== 1 || !LEVELS[g.level] || !Array.isArray(g.vals)) return false;
  api.setLevel(g.level);
  S = { v: 1, level: g.level, n: g.n, grid: g.vals.map(v => (v ? { id: nextId++, v } : null)), score: g.score || 0, reached: !!g.reached };
  build(); api.begin({ resumed: true }); render(); return true;
}
if (!load()) newGame(api.level);
})();
