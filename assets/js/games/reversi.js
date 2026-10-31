/* Reversi: outflank discs to turn them your colour; the computer weighs corners, edges and mobility */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.rv { position: absolute; inset: 0; display: grid; grid-template: repeat(8, 1fr) / repeat(8, 1fr); border: 3px solid var(--frame); border-radius: 12px; overflow: hidden; background: color-mix(in srgb, var(--c-moves) 55%, var(--sheet)); }
.rv button { position: relative; border: 0; padding: 0; background: transparent; box-shadow: inset -1px -1px 0 color-mix(in srgb, var(--graphite) 22%, transparent); cursor: default; perspective: 300px; }
.rv button.ok { cursor: pointer; }
.rv button.ok::after { content: ""; position: absolute; inset: 38%; border-radius: 50%; background: var(--graphite); opacity: .22; }
.rv button.ok:hover::after { inset: 14%; opacity: .3; }
.rv .d { position: absolute; inset: 12%; border-radius: 50%; transition: transform .35s; transform-style: preserve-3d; }
.rv .d.b { background: var(--graphite); box-shadow: inset 0 -3px 0 rgba(0,0,0,.25); }
.rv .d.w { background: #fff; box-shadow: inset 0 -3px 0 rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.18); }
.rv .d.flip { animation: flipd .4s ease-out; }
@keyframes flipd { 0% { transform: rotateY(0); } 50% { transform: rotateY(90deg) scale(1.1); } 100% { transform: rotateY(0); } }
.rv .last::before { content: ""; position: absolute; left: 50%; top: 50%; width: 10%; height: 10%; margin: -5%; border-radius: 50%; background: var(--red); z-index: 2; }
`);
const RULES = `<p>You play <b>black</b> and move first; the computer plays white.</p><ul>
<li>Place a disc so that one or more straight lines of the computer's discs sit between it and another of your discs. Those discs flip to your colour.</li>
<li>Lines can run across, up and down, or diagonally, and one move can flip several lines.</li>
<li>If you can't flip anything, you must pass. The game ends when neither side can move.</li>
<li>Whoever has more discs at the end wins.</li></ul><p class="tip">Corners can never be flipped back. The squares next to an empty corner are risky.</p>`;
const LV = MG.duelLevels('Grabs as many discs as it can.', 'Plans two moves ahead.', 'Plans four moves ahead and values corners.');
const W8 = [120, -20, 20, 5, 5, 20, -20, 120, -20, -40, -5, -5, -5, -5, -40, -20, 20, -5, 15, 3, 3, 15, -5, 20, 5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5, 20, -5, 15, 3, 3, 15, -5, 20, -20, -40, -5, -5, -5, -5, -40, -20, 120, -20, 20, 5, 5, 20, -20, 120];
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
function flips(b, i, p) {
  if (b[i]) return [];
  const r = (i / 8) | 0, c = i % 8, out = [];
  for (const [dr, dc] of DIRS) {
    const line = []; let y = r + dr, x = c + dc;
    while (y >= 0 && y < 8 && x >= 0 && x < 8 && b[y * 8 + x] === 3 - p) { line.push(y * 8 + x); y += dr; x += dc; }
    if (line.length && y >= 0 && y < 8 && x >= 0 && x < 8 && b[y * 8 + x] === p) out.push(...line);
  }
  return out;
}
const movesFor = (b, p) => MG.range(64).filter(i => !b[i] && flips(b, i, p).length);
function evalB(b, p) { let s = 0; for (let i = 0; i < 64; i++) if (b[i] === p) s += W8[i]; else if (b[i]) s -= W8[i]; return s + 4 * (movesFor(b, p).length - movesFor(b, 3 - p).length); }
function search(b, depth, alpha, beta, p, passed) {
  const ms = movesFor(b, p);
  if (!ms.length) {
    if (passed || !movesFor(b, 3 - p).length) { let d = 0; for (const v of b) d += v === p ? 1 : v ? -1 : 0; return d * 1000; }
    return -search(b, depth, -beta, -alpha, 3 - p, true);
  }
  if (!depth) return evalB(b, p);
  ms.sort((a, z) => W8[z] - W8[a]);
  for (const m of ms) {
    const f = flips(b, m, p), nb = b.slice(); nb[m] = p; for (const k of f) nb[k] = p;
    const v = -search(nb, depth - 1, -beta, -alpha, 3 - p, false);
    if (v > alpha) alpha = v; if (alpha >= beta) break;
  }
  return alpha;
}
function cpuMove() {
  const ms = movesFor(S.b, 2);
  if (api.level === 'easy') { let best = -1, picks = []; for (const m of ms) { const n = flips(S.b, m, 2).length + (Math.random() < .3 ? MG.rand(3) : 0); if (n > best) { best = n; picks = [m]; } else if (n === best) picks.push(m); } return MG.pick(picks); }
  const depth = api.level === 'medium' ? 2 : 4;
  let best = -Infinity, pick = ms[0];
  for (const m of ms) { const f = flips(S.b, m, 2), nb = S.b.slice(); nb[m] = 2; for (const k of f) nb[k] = 2; const v = -search(nb, depth - 1, -Infinity, Infinity, 1, false); if (v > best) { best = v; pick = m; } }
  return pick;
}
let S = null, cells = [];
const api = MG.duelShell({ id: 'reversi', title: 'Reversi', levels: LV, rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 600 } });
api.mid.innerHTML = '<span class="pill">Black <b data-b>2</b></span><span class="pill">White <b data-w>2</b></span>';
function newGame() {
  const b = new Array(64).fill(0); b[27] = b[36] = 2; b[28] = b[35] = 1;
  S = { b, turn: 1, over: false, last: -1, flipped: [] };
  build(); api.begin(); render();
}
function build() {
  const box = MG.h('div', { class: 'rv', role: 'grid', 'aria-label': 'Reversi board' });
  cells = MG.range(64).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b && S.turn === 1 && !S.over && api.canPlay()) place(+b.dataset.i); });
}
function place(i) {
  const f = flips(S.b, i, S.turn);
  if (!f.length) { if (S.turn === 1) MG.replay(cells[i], 'nudge', 250); return; }
  S.b[i] = S.turn; for (const k of f) S.b[k] = S.turn;
  S.last = i; S.flipped = f; api.dirty = true;
  S.turn === 1 ? MG.sfx.place() : MG.sfx.move();
  advance();
}
function advance() {
  const next = 3 - S.turn;
  if (movesFor(S.b, next).length) S.turn = next;
  else if (!movesFor(S.b, S.turn).length) { S.over = true; render(); return finish(); }
  else api.coach('info', next === 1 ? 'You have to pass' : 'The computer passes', next === 1 ? 'No move of yours flips anything, so the computer goes again.' : 'It has no legal move. Your turn again.', 3200);
  render();
  if (S.turn === 2) api.think(() => place(cpuMove()), 600);
}
function finish() {
  const bl = S.b.filter(v => v === 1).length, wh = S.b.filter(v => v === 2).length;
  const facts = [[bl, 'Your discs'], [wh, 'Computer discs'], [64 - bl - wh, 'Empty']];
  if (bl > wh) api.win({ title: 'You win', sub: `${bl} to ${wh}.`, facts });
  else if (wh > bl) api.lose({ title: 'The computer wins', sub: `${wh} to ${bl}.`, facts });
  else api.draw({ title: 'Draw', sub: `${bl} discs each.`, facts });
}
function render() {
  const legal = S.turn === 1 && !S.over ? new Set(movesFor(S.b, 1)) : new Set();
  cells.forEach((c, i) => {
    const v = S.b[i];
    c.className = (legal.has(i) ? 'ok' : '') + (i === S.last ? ' last' : '');
    const want = v ? `<span class="d ${v === 1 ? 'b' : 'w'}${S.flipped.includes(i) ? ' flip' : ''}"></span>` : '';
    if (c.dataset.v !== String(v) || S.flipped.includes(i)) { c.innerHTML = want; c.dataset.v = String(v); }
    c.setAttribute('aria-label', `${'ABCDEFGH'[i % 8]}${((i / 8) | 0) + 1}: ${v === 1 ? 'black' : v === 2 ? 'white' : legal.has(i) ? 'empty, playable' : 'empty'}`);
  });
  S.flipped = [];
  MG.qs('[data-b]', api.mid).textContent = S.b.filter(v => v === 1).length;
  MG.qs('[data-w]', api.mid).textContent = S.b.filter(v => v === 2).length;
  if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? 'Dots show where you can play.' : '');
}
newGame();
})();
