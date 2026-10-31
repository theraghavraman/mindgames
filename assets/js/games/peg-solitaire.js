/* Peg Solitaire: jump pegs over neighbours into empty holes until one peg is left */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.ps .cursor { fill: none; stroke: var(--pen); stroke-width: .07; pointer-events: none; }
.ps { position: absolute; inset: 0; border-radius: 50%; }
.ps svg { width: 100%; height: 100%; display: block; overflow: visible; }
.ps .hole { fill: var(--graphite); opacity: .16; }
.ps .peg { cursor: pointer; transition: transform .18s; }
.ps .peg circle.b { fill: var(--c-moves-deep); }
.ps .peg circle.s { fill: #fff; opacity: .55; }
.ps .peg.sel circle.b { fill: var(--pen); }
.ps .peg.gone { opacity: 0; transform: scale(.2); transition: opacity .25s, transform .25s; }
.ps .dest { fill: none; stroke: var(--pen); stroke-width: .06; stroke-dasharray: .12 .08; cursor: pointer; animation: spin 4s linear infinite; transform-box: fill-box; transform-origin: center; }
@keyframes spin { to { transform: rotate(360deg); } }
.ps .tray { fill: var(--sheet); stroke: var(--rule); stroke-width: .04; }
`);
const english = () => { const h = []; for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if ((r >= 2 && r <= 4) || (c >= 2 && c <= 4)) h.push([r, c]); return h; };
const triangle = () => { const h = []; for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) h.push([r, c]); return h; };
const LEVELS = {
  easy: { name: 'Triangle', rank: 1, board: 'tri', desc: '15 holes. Start with the top hole empty.' },
  medium: { name: 'English', rank: 2, board: 'eng', desc: '33 holes in a cross. Finish with one peg.' },
  hard: { name: 'English, centre finish', short: 'Centre', rank: 3, board: 'eng', centre: true, desc: 'The same cross, but the last peg must end in the middle.' },
};
const RULES = `<p>Remove pegs by jumping until only one is left.</p><ul>
<li>A peg jumps over a neighbouring peg, in a straight line, into the empty hole right behind it.</li>
<li>The peg it jumped over is removed.</li>
<li>On the cross boards, jumps go up, down, left and right. On the triangle they also go along the two diagonals of the triangle.</li></ul>
<p>Tap a peg to pick it up, then tap one of the circled holes. The game ends when no jump is possible.</p>
<p>On a keyboard, move with the arrow keys and press <kbd>Enter</kbd> or <kbd>Space</kbd> to pick up a peg or land in a hole.</p>
<p class="tip">The centre-finish level is the classic challenge: one peg, in the very middle.</p>`;
let S = null, svgEl = null;
const api = MG.shell({ id: 'peg-solitaire', title: 'Peg Solitaire', chapter: 'moves', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: () => newGame(api.level), size: { ar: 1, chrome: 240, maxW: 560 } });
api.mid.innerHTML = '<span class="pill">Pegs <b data-p>0</b></span>';
const tools = MG.h('div', { class: 'tools', style: { '--tools': 1 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', undo);
function newGame(level) {
  const L = LEVELS[level], tri = L.board === 'tri', holes = tri ? triangle() : english();
  const key = (r, c) => r * 10 + c, idx = new Map(holes.map(([r, c], i) => [key(r, c), i]));
  const dirs = tri ? [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]] : [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const jumps = holes.map(([r, c]) => dirs.map(([dr, dc]) => [idx.get(key(r + dr, c + dc)), idx.get(key(r + 2 * dr, c + 2 * dc))]).filter(([o, t]) => o != null && t != null));
  const empty = tri ? 0 : idx.get(key(3, 3));
  S = { level, tri, holes, jumps, centre: tri ? -1 : idx.get(key(3, 3)), peg: holes.map((_, i) => (i === empty ? 0 : 1)), sel: -1, hist: [], cur: tri ? 0 : 1, kbd: false };
  build(); api.begin(); render();
}
const pos = i => { const [r, c] = S.holes[i]; return S.tri ? [2.5 + (c - r / 2), .9 + r * .9] : [c + .5, r + .5]; };
function build() {
  const box = MG.h('div', { class: 'ps', role: 'application', tabindex: 0, 'aria-label': 'Peg board. Arrow keys move, Enter picks up a peg or lands in a hole.' });
  const vb = S.tri ? '-.2 -.2 5.4 5.4' : '-.2 -.2 7.4 7.4';
  box.innerHTML = `<svg viewBox="${vb}"><g data-g></g></svg>`;
  svgEl = MG.qs('[data-g]', box);
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const t = e.target.closest('[data-i]'); if (t) tap(+t.dataset.i); });
  box.addEventListener('focus', () => { if (box.matches(':focus-visible')) { S.kbd = true; render(); } });
  box.addEventListener('blur', () => { S.kbd = false; render(); });
  box.addEventListener('keydown', e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) { e.preventDefault(); walk(d); }
    else if (MG.activates(e)) { e.preventDefault(); S.kbd = true; tap(S.cur); }
  });
}
/* Holes don't sit on a full grid, so an arrow goes to the nearest hole in that direction */
function walk([dx, dy]) {
  const [x0, y0] = pos(S.cur);
  let best = -1, bd = Infinity;
  S.holes.forEach((_, i) => {
    const [x, y] = pos(i), along = (x - x0) * dx + (y - y0) * dy, across = Math.abs((x - x0) * dy) + Math.abs((y - y0) * dx);
    if (along < .3 || across > along * 1.1) return;
    const d = along + across * 2;
    if (d < bd) { bd = d; best = i; }
  });
  S.kbd = true;
  if (best >= 0) { S.cur = best; MG.announce(`${S.peg[best] ? 'Peg' : 'Empty hole'}, row ${S.holes[best][0] + 1}, column ${S.holes[best][1] + 1}`); }
  render();
}
const moves = () => { const out = []; S.peg.forEach((p, i) => { if (p) for (const [o, t] of S.jumps[i]) if (S.peg[o] && !S.peg[t]) out.push([i, o, t]); }); return out; };
function render() {
  const legal = S.sel >= 0 ? S.jumps[S.sel].filter(([o, t]) => S.peg[o] && !S.peg[t]).map(([, t]) => t) : [];
  let h = S.tri ? '<path class="tray" d="M2.5 -.15 L5.25 4.95 L-.25 4.95 Z" stroke-linejoin="round"/>' : '<path class="tray" d="M2 0H5V2H7V5H5V7H2V5H0V2H2Z"/>';
  S.holes.forEach((_, i) => { const [x, y] = pos(i); h += `<circle class="hole" cx="${x}" cy="${y}" r=".2" data-i="${i}"/>`; });
  S.peg.forEach((p, i) => { if (!p) return; const [x, y] = pos(i); h += `<g class="peg${S.sel === i ? ' sel' : ''}" data-i="${i}" role="button" aria-label="Peg"><circle class="b" cx="${x}" cy="${y}" r=".34"/><circle class="s" cx="${x - .1}" cy="${y - .11}" r=".09"/></g>`; });
  legal.forEach(t => { const [x, y] = pos(t); h += `<circle class="dest" cx="${x}" cy="${y}" r=".33" data-i="${t}"/>`; });
  if (S.kbd) { const [x, y] = pos(S.cur); h += `<circle class="cursor" cx="${x}" cy="${y}" r=".44"/>`; }
  svgEl.innerHTML = h;
  const left = S.peg.reduce((s, v) => s + v, 0);
  MG.qs('[data-p]', api.mid).textContent = left;
  if (api.status === 'playing') api.progress(`${MG.plural(left, 'peg')} left`, S.sel >= 0 ? 'Tap a circled hole to jump there.' : 'Tap a peg that can jump over a neighbour.', 1 - (left - 1) / (S.peg.length - 2), 0);
}
function tap(i) {
  if (!api.canPlay()) return;
  if (S.peg[i]) { S.sel = S.sel === i ? -1 : i; MG.sfx.tap(); render(); return; }
  if (S.sel < 0) return;
  const j = S.jumps[S.sel].find(([o, t]) => t === i && S.peg[o]);
  if (!j) { S.sel = -1; render(); return; }
  const from = S.sel, [over] = j;
  S.peg[from] = 0; S.peg[over] = 0; S.peg[i] = 1; S.hist.push([from, over, i]); S.sel = -1; api.dirty = true;
  MG.sfx.place(); render(); end();
}
function end() {
  if (moves().length) return;
  const left = S.peg.reduce((s, v) => s + v, 0), L = LEVELS[S.level];
  const won = left === 1 && (!L.centre || S.peg[S.centre]);
  if (won) api.win({ title: L.centre ? 'Dead centre' : 'One peg left', sub: `${L.name} board solved.`, facts: [[S.hist.length, 'Jumps'], [MG.fmtTime(api.timer.elapsed), 'Time'], [L.name, 'Board']] });
  else api.lose({ title: 'No jumps left', sub: left === 1 ? 'One peg left, but not in the centre. So close.' : `${MG.plural(left, 'peg')} left with nowhere to jump. Undo a few moves or try again.`, primary: { label: 'Try again', act: 'again' }, actions: [{ label: 'Undo last jump', act: () => { api.status = 'playing'; api.timer.start(); undo(); } }] });
}
function undo() { const h = S.hist.pop(); if (!h) return; const [a, o, t] = h; S.peg[a] = 1; S.peg[o] = 1; S.peg[t] = 0; S.sel = -1; MG.sfx.note(); render(); }
newGame(api.level);
})();
