/* Maze: from the top-left corner to the flag. Every maze is generated fresh and has exactly one route. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.mz { position: absolute; inset: 0; border-radius: 12px; background: var(--sheet); border: 1px solid var(--rule); touch-action: none; }
.mz svg { width: 100%; height: 100%; display: block; }
.mz .walls { stroke: var(--graphite); stroke-linecap: square; fill: none; }
.mz .trail { stroke: var(--ch); stroke-linecap: round; stroke-linejoin: round; fill: none; opacity: .9; }
.mz .me { fill: var(--pen); transition: cx .09s linear, cy .09s linear; }
.mz .goal { fill: var(--red); }
.dpad { display: grid; grid-template: repeat(2, 48px) / repeat(3, 1fr); gap: 6px; }
.dpad button { border: 1px solid var(--rule); border-radius: 12px; background: var(--sheet); font-size: 20px; color: var(--graphite); cursor: pointer; }
`);
const LEVELS = {
  easy: { name: '10×10', rank: 1, n: 10, desc: 'A quick maze.' },
  medium: { name: '16×16', rank: 2, n: 16, desc: 'A proper maze.' },
  hard: { name: '24×24', rank: 3, n: 24, desc: 'A sprawling maze.' },
};
const RULES = `<p>Walk from the blue dot in the top-left corner to the red flag in the bottom-right.</p><ul>
<li>Move with the arrow keys or WASD, the buttons below the maze, or drag the dot along the corridors.</li>
<li>A swipe runs along a corridor until the next junction.</li><li>Your route is traced with a highlighter; stepping back erases it.</li></ul>
<p class="tip">There is exactly one route without backtracking. Keeping a hand on one wall always gets you out eventually.</p>`;
const D = { up: [0, -1, 1], right: [1, 0, 2], down: [0, 1, 4], left: [-1, 0, 8] }, OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
let S = null, svg = null;
const api = MG.shell({ id: 'maze', title: 'Maze', chapter: 'moves', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: restart, size: { ar: 1, chrome: 290, maxW: 640 } });
api.mid.innerHTML = '<span class="pill">Steps <b data-s>0</b></span>';
const pad = MG.h('div', { class: 'dpad' });
pad.innerHTML = '<span></span><button type="button" data-d="up" aria-label="Up">↑</button><span></span><button type="button" data-d="left" aria-label="Left">←</button><button type="button" data-d="down" aria-label="Down">↓</button><button type="button" data-d="right" aria-label="Right">→</button>';
api.controls.appendChild(pad);
pad.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) step(b.dataset.d); });
function newGame(level) {
  const n = LEVELS[level].n, open = new Uint8Array(n * n), seen = new Uint8Array(n * n), st = [0]; seen[0] = 1;
  while (st.length) {
    const i = st[st.length - 1], x = i % n, y = (i / n) | 0;
    const opts = Object.values(D).filter(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < n && Y < n && !seen[Y * n + X]; });
    if (!opts.length) { st.pop(); continue; }
    const [dx, dy, b] = MG.pick(opts), j = (y + dy) * n + x + dx;
    open[i] |= b; open[j] |= OPP[b]; seen[j] = 1; st.push(j);
  }
  S = { n, open, at: 0, path: [0], steps: 0 };
  build(); api.begin(); render();
}
function restart() { S.at = 0; S.path = [0]; S.steps = 0; api.begin(); render(); }
function build() {
  const n = S.n, box = MG.h('div', { class: 'mz', role: 'application', 'aria-label': 'Maze' });
  let d = `M0 0H${n}V${n - 1}M${n} ${n}H0V0`;
  for (let i = 0; i < n * n; i++) { const x = i % n, y = (i / n) | 0; if (x < n - 1 && !(S.open[i] & 2)) d += `M${x + 1} ${y}V${y + 1}`; if (y < n - 1 && !(S.open[i] & 4)) d += `M${x} ${y + 1}H${x + 1}`; }
  box.innerHTML = `<svg viewBox="-.2 -.2 ${n + .4} ${n + .4}"><polyline class="trail" stroke-width=".42" points=""/><path class="walls" stroke-width="${n > 16 ? .13 : .1}" d="${d}"/><path class="goal" d="M${n - .7} ${n - .82}v.68M${n - .7} ${n - .82}l.4.14-.4.14z" stroke="var(--red)" stroke-width=".07"/><circle class="me" r=".3"/></svg>`;
  svg = MG.qs('svg', box);
  api.board.innerHTML = ''; api.board.appendChild(box);
  MG.swipe(box, dir => run(dir));
  let drag = false;
  box.addEventListener('pointerdown', e => { const c = cellAt(e); if (c === S.at) { drag = true; box.setPointerCapture(e.pointerId); } });
  box.addEventListener('pointermove', e => { if (!drag) return; const c = cellAt(e); if (c < 0 || c === S.at) return; const dir = Object.keys(D).find(k => { const [dx, dy] = D[k]; return (S.at % S.n) + dx === c % S.n && ((S.at / S.n) | 0) + dy === ((c / S.n) | 0); }); if (dir) step(dir); });
  box.addEventListener('pointerup', () => { drag = false; });
}
function cellAt(e) { const r = svg.getBoundingClientRect(), n = S.n, s = r.width / (n + .4); const x = Math.floor((e.clientX - r.left) / s - .2), y = Math.floor((e.clientY - r.top) / s - .2); return x >= 0 && y >= 0 && x < n && y < n ? y * n + x : -1; }
function step(dir, quiet) {
  if (!api.canPlay()) return false;
  const [dx, dy, b] = D[dir], n = S.n;
  if (!(S.open[S.at] & b)) { if (!quiet) MG.replay(MG.qs('.me', svg), 'nudge', 200); return false; }
  const j = S.at + dy * n + dx;
  if (S.path.length > 1 && S.path[S.path.length - 2] === j) S.path.pop(); else S.path.push(j);
  S.at = j; S.steps++; api.dirty = true;
  if (!quiet) MG.sfx.tone(520 + (S.path.length % 12) * 20, .04, 'sine', .025);
  render();
  if (S.at === n * n - 1) {
    const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
    api.win({ title: 'Out of the maze', sub: `${MG.plural(S.steps, 'step')}; the direct route is ${S.path.length - 1}.`, facts: [[S.steps, 'Steps'], [S.path.length - 1, 'Direct route'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  }
  return true;
}
function run(dir) {
  if (!step(dir)) return;
  const n = S.n, dirs = Object.keys(D);
  for (let k = 0; k < n * 2 && api.status === 'playing'; k++) {
    const exits = dirs.filter(d => S.open[S.at] & D[d][2]).length;
    if (exits !== 2) break;
    const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[dir];
    const next = dirs.find(d => d !== back && (S.open[S.at] & D[d][2]));
    if (!next || !step(next, true)) break;
    dir = next;
  }
  MG.sfx.slide();
}
function render() {
  const n = S.n, x = S.at % n + .5, y = ((S.at / n) | 0) + .5;
  const me = MG.qs('.me', svg); me.setAttribute('cx', x); me.setAttribute('cy', y);
  MG.qs('.trail', svg).setAttribute('points', S.path.map(i => `${i % n + .5},${((i / n) | 0) + .5}`).join(' '));
  MG.qs('[data-s]', api.mid).textContent = S.steps;
  const dist = Math.abs(n - 1 - S.at % n) + Math.abs(n - 1 - ((S.at / n) | 0));
  if (api.status === 'playing') api.progress(`${S.steps ? MG.plural(S.steps, 'step') + ' taken' : 'Find the way out'}`, 'Arrow keys, swipes or drag the dot. A swipe runs to the next junction.', 1 - dist / (2 * (n - 1)), 0);
}
MG.onKey(e => { const d = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }[e.key]; if (d && S) { e.preventDefault(); e.shiftKey ? run(d) : step(d); } });
newGame(api.level);
})();
