/* Dots and Boxes: draw lines; close a box to claim it and move again */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.db { position: absolute; inset: 0; }
.db svg { width: 100%; height: 100%; display: block; overflow: visible; touch-action: manipulation; }
.db .dot { fill: var(--graphite); }
.db svg, .db svg * { outline: none; }
.db .hit { stroke: transparent; stroke-width: .34; cursor: pointer; }
.db .hit:focus-visible { stroke: var(--pencil); stroke-opacity: .25; }
.db .hit:hover + .ln.free, .db .hit:focus-visible + .ln.free { stroke: var(--pencil); opacity: .5; }
.db .ln { stroke-width: .1; stroke-linecap: round; }
.db .ln.free { stroke: transparent; }
.db .ln.p1 { stroke: var(--pen); } .db .ln.p2 { stroke: var(--red); }
.db .ln.new { stroke-dasharray: 1.2; animation: dl .25s ease-out both; }
@keyframes dl { from { stroke-dashoffset: 1.2; } to { stroke-dashoffset: 0; } }
.db .bx { opacity: 0; transition: opacity .3s; } .db .bx.p1 { fill: var(--pen); opacity: .18; } .db .bx.p2 { fill: var(--red); opacity: .18; }
.db .bl { font: 700 .34px var(--font); text-anchor: middle; dominant-baseline: central; }
.db .bl.p1 { fill: var(--pen); } .db .bl.p2 { fill: var(--red); }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, n: 3, desc: '3×3 boxes. The computer plays loosely.' },
  medium: { name: 'Medium', rank: 2, n: 4, desc: '4×4 boxes. It avoids giving boxes away.' },
  hard: { name: 'Hard', rank: 3, n: 5, desc: '5×5 boxes. It counts chains in the endgame.' },
};
const RULES = `<p>Take turns drawing a line between two neighbouring dots.</p><ul>
<li>Draw the fourth side of a box to claim it. Claiming a box gives you another turn right away.</li>
<li>When every line is drawn, whoever owns more boxes wins.</li></ul>
<p class="tip">Avoid drawing the third side of a box: your opponent will close it. Late in the game, the boxes come in chains; give away the shortest one.</p>`;
let S = null, svg = null;
const api = MG.duelShell({ id: 'dots-and-boxes', title: 'Dots and Boxes', levels: LEVELS, rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 560 } });
function geom(n) {
  const H = (n + 1) * n, lines = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) lines.push([c, r, c + 1, r]);
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) lines.push([c, r, c, r + 1]);
  const boxes = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) boxes.push([r * n + c, (r + 1) * n + c, H + r * (n + 1) + c, H + r * (n + 1) + c + 1]);
  const boxesOf = lines.map(() => []); boxes.forEach((b, k) => b.forEach(l => boxesOf[l].push(k)));
  return { lines, boxes, boxesOf };
}
function newGame(level) {
  const n = LEVELS[level].n, g = geom(n);
  S = Object.assign({ n, drawn: new Array(g.lines.length).fill(0), owner: new Array(n * n).fill(0), turn: api.nextFirst() === 'you' ? 1 : 2, over: false, score: [0, 0, 0], last: -1 }, g);
  build(); api.begin(); render();
  if (S.turn === 2) api.think(cpu, 500);
}
const sides = (k, d = S.drawn) => S.boxes[k].reduce((s, l) => s + (d[l] ? 1 : 0), 0);
function build() {
  const n = S.n, box = MG.h('div', { class: 'db' });
  box.innerHTML = `<svg viewBox="-.4 -.4 ${n + .8} ${n + .8}" role="application" aria-label="Dots and boxes"><g data-bx></g><g data-ln></g><g data-dt></g></svg>`;
  svg = MG.qs('svg', box);
  MG.qs('[data-dt]', svg).innerHTML = MG.range((n + 1) * (n + 1)).map(k => `<circle class="dot" cx="${k % (n + 1)}" cy="${(k / (n + 1)) | 0}" r=".09"/>`).join('');
  MG.qs('[data-bx]', svg).innerHTML = S.boxes.map((_, k) => `<rect class="bx" data-b="${k}" x="${k % n + .06}" y="${((k / n) | 0) + .06}" width=".88" height=".88" rx=".08"/><text class="bl" data-t="${k}" x="${k % n + .5}" y="${((k / n) | 0) + .5}"></text>`).join('');
  MG.qs('[data-ln]', svg).innerHTML = S.lines.map(([x1, y1, x2, y2], l) => `<line class="hit" data-l="${l}" tabindex="0" role="button" aria-label="${y1 === y2 ? 'Across' : 'Down'} from row ${y1 + 1}, column ${x1 + 1}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="ln free" data-v="${l}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`).join('');
  api.board.innerHTML = ''; api.board.appendChild(box);
  svg.addEventListener('click', e => { const t = e.target.closest('[data-l]'); if (t && S.turn === 1 && !S.over && api.canPlay()) draw(+t.dataset.l); });
  svg.addEventListener('keydown', e => { const t = e.target.closest('[data-l]'); if (t && MG.activates(e)) { e.preventDefault(); if (S.turn === 1 && !S.over && api.canPlay()) draw(+t.dataset.l); } });
}
function draw(l) {
  if (S.drawn[l]) return;
  S.drawn[l] = S.turn; S.last = l; api.dirty = true;
  let closed = 0;
  for (const k of S.boxesOf[l]) if (sides(k) === 4) { S.owner[k] = S.turn; S.score[S.turn]++; closed++; }
  closed ? MG.sfx.unit() : S.turn === 1 ? MG.sfx.tap() : MG.sfx.move();
  if (S.drawn.every(Boolean)) { S.over = true; render(); return finish(); }
  if (!closed) S.turn = 3 - S.turn;
  render();
  if (S.turn === 2) api.think(cpu, closed ? 380 : 520);
}
/* boxes the opponent could take in a row after line l is drawn */
function giveaway(l) {
  const d = S.drawn.slice(); d[l] = 1;
  let taken = 0;
  for (let again = true; again;) { again = false; for (let k = 0; k < S.boxes.length; k++) if (sides(k, d) === 3) { S.boxes[k].forEach(x => { d[x] = 1; }); taken++; again = true; } }
  return taken;
}
function cpu() {
  const free = MG.range(S.lines.length).filter(l => !S.drawn[l]), lvl = api.level;
  const closing = free.filter(l => S.boxesOf[l].some(k => sides(k) === 3));
  if (closing.length && (lvl !== 'easy' || Math.random() < .8)) return draw(MG.pick(closing));
  const safe = free.filter(l => S.boxesOf[l].every(k => sides(k) < 2));
  if (safe.length && (lvl !== 'easy' || Math.random() < .6)) return draw(MG.pick(safe));
  if (lvl === 'easy') return draw(MG.pick(free));
  let best = Infinity, picks = [];
  for (const l of free) { const g = giveaway(l); if (g < best) { best = g; picks = [l]; } else if (g === best) picks.push(l); }
  draw(MG.pick(picks));
}
function finish() {
  const [, you, cpuS] = S.score, facts = [[you, 'Your boxes'], [cpuS, 'Computer boxes'], [S.n * S.n, 'Boxes']];
  if (you > cpuS) api.win({ title: 'You win', sub: `${you} boxes to ${cpuS}.`, facts });
  else if (cpuS > you) api.lose({ title: 'The computer wins', sub: `${cpuS} boxes to ${you}.`, facts });
  else api.draw({ title: 'Draw', sub: `${you} boxes each.`, facts });
}
function render() {
  S.drawn.forEach((p, l) => { const el = MG.qs(`[data-v="${l}"]`, svg); el.setAttribute('class', 'ln ' + (p ? 'p' + p : 'free') + (l === S.last ? ' new' : '')); });
  S.owner.forEach((p, k) => { MG.qs(`[data-b="${k}"]`, svg).setAttribute('class', 'bx' + (p ? ' p' + p : '')); const t = MG.qs(`[data-t="${k}"]`, svg); t.setAttribute('class', 'bl' + (p ? ' p' + p : '')); t.textContent = p === 1 ? 'You' : p === 2 ? 'CPU' : ''; });
  api.score(S.score[1], S.score[2]);
  if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? 'Tap between two dots to draw a line.' : '');
}
newGame(api.level);
})();
