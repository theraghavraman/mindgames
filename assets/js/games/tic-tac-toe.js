/* Tic-Tac-Toe against the computer; Hard plays perfectly with minimax */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.tt { position: absolute; inset: 0; display: grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); gap: 0; }
.tt button { position: relative; border: 0; background: transparent; cursor: pointer; }
.tt button:hover:not(:disabled) { background: var(--tint); }
.tt button:disabled { cursor: default; }
.tt svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.tt .grid { stroke: var(--graphite); stroke-width: 2.4; stroke-linecap: round; fill: none; }
.tt .x { stroke: var(--pen); stroke-width: 9; stroke-linecap: round; fill: none; stroke-dasharray: 100; animation: draw .32s ease-out both; }
.tt .x2 { animation-delay: .16s; }
.tt .o { stroke: var(--red); stroke-width: 9; fill: none; stroke-dasharray: 260; animation: draw .4s ease-out both; }
.tt .win { stroke: var(--c-sudoku); stroke-width: 22; stroke-linecap: round; opacity: .8; stroke-dasharray: 600; animation: draw .5s .1s ease-out both; }
@keyframes draw { from { stroke-dashoffset: var(--len, 260); } to { stroke-dashoffset: 0; } }
`);
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const RULES = `<p>Take turns marking empty squares: you are <b>X</b>, the computer is <b>O</b>.</p><ul>
<li>Three of your marks in a row, column or diagonal wins.</li><li>If all nine squares fill up with no line, it's a draw.</li><li>You and the computer take turns going first.</li></ul>
<p class="tip">On Hard the computer never loses, so a draw is a fine result. Easy makes mistakes on purpose.</p>`;
const LV = MG.duelLevels('Makes plenty of mistakes.', 'Wins when it can and blocks when it must.', 'Plays perfectly. Can you hold a draw?');
let S = null, box = null, cells = [], art = null;
const api = MG.duelShell({ id: 'tic-tac-toe', title: 'Tic-Tac-Toe', levels: LV, rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 480 } });
const won = b => { for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { p: b[l[0]], line: l }; return b.every(Boolean) ? { p: 0 } : null; };
function minimax(b, turn, depth) {
  const w = won(b);
  if (w) return w.p === 2 ? 10 - depth : w.p === 1 ? depth - 10 : 0;
  let best = turn === 2 ? -99 : 99;
  for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; const v = minimax(b, 3 - turn, depth + 1); b[i] = 0; best = turn === 2 ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
function cpuMove() {
  const b = S.b, free = MG.range(9).filter(i => !b[i]), lvl = api.level;
  const finds = p => free.find(i => { b[i] = p; const w = won(b); b[i] = 0; return w && w.p === p; });
  if (lvl === 'easy' && Math.random() < .6) return MG.pick(free);
  if (lvl !== 'hard') { const w = finds(2); if (w != null) return w; const bl = finds(1); if (bl != null) return bl; if (!b[4] && Math.random() < .7) return 4; return MG.pick(free); }
  let best = -99, picks = [];
  for (const i of free) { b[i] = 2; const v = minimax(b, 1, 1); b[i] = 0; if (v > best) { best = v; picks = [i]; } else if (v === best) picks.push(i); }
  return MG.pick(picks);
}
function newGame(level) {
  S = { b: new Array(9).fill(0), turn: api.nextFirst() === 'you' ? 1 : 2, over: false };
  S.firstCpu = S.turn === 2;
  build(); api.begin(); render();
  if (S.turn === 2) api.think(() => play(cpuMove()), 500);
}
function build() {
  box = MG.h('div', { class: 'tt', role: 'grid', 'aria-label': 'Tic-tac-toe board' });
  cells = MG.range(9).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i, 'aria-label': `Square ${i + 1}, empty` }); box.appendChild(b); return b; });
  const ns = 'http://www.w3.org/2000/svg';
  art = document.createElementNS(ns, 'svg'); art.setAttribute('viewBox', '0 0 300 300');
  art.innerHTML = '<path class="grid" d="M100 12V288M200 12V288M12 100H288M12 200H288"/><g data-marks></g>';
  box.appendChild(art);
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b && S.turn === 1 && !S.over && api.canPlay()) play(+b.dataset.i); });
}
function play(i) {
  if (S.over || S.b[i]) return;
  S.b[i] = S.turn; api.dirty = true;
  const x = (i % 3) * 100 + 50, y = ((i / 3) | 0) * 100 + 50, g = MG.qs('[data-marks]', art);
  g.insertAdjacentHTML('beforeend', S.turn === 1
    ? `<path class="x" style="--len:100" d="M${x - 26} ${y - 26}L${x + 26} ${y + 26}"/><path class="x x2" style="--len:100" d="M${x + 26} ${y - 26}L${x - 26} ${y + 26}"/>`
    : `<circle class="o" style="--len:190" cx="${x}" cy="${y}" r="29" transform="rotate(-90 ${x} ${y})"/>`);
  cells[i].setAttribute('aria-label', `Square ${i + 1}, ${S.turn === 1 ? 'X' : 'O'}`);
  S.turn === 1 ? MG.sfx.place() : MG.sfx.move();
  const w = won(S.b);
  if (w) { finish(w); return; }
  S.turn = 3 - S.turn; render();
  if (S.turn === 2) api.think(() => play(cpuMove()));
}
function finish(w) {
  S.over = true; render();
  if (w.line) { const [a, , c] = w.line, p = k => [(k % 3) * 100 + 50, ((k / 3) | 0) * 100 + 50], [x1, y1] = p(a), [x2, y2] = p(c);
    MG.qs('[data-marks]', art).insertAdjacentHTML('afterbegin', `<path class="win" style="--len:600" d="M${x1} ${y1}L${x2} ${y2}"/>`); }
  const st = api.stats.get(api.level);
  if (w.p === 1) { api.score(st.won + 1, st.lost); api.win({ title: 'You win', sub: 'Three in a row.' }); }
  else if (w.p === 2) { api.score(st.won, st.lost + 1); api.lose({ title: 'The computer wins', sub: 'Three O’s in a row.' }); }
  else api.draw({ title: 'Draw', sub: api.level === 'hard' ? 'Against perfect play, a draw is the best result.' : 'Nine squares, no line.' });
}
function render() {
  cells.forEach((c, i) => { c.disabled = S.over || !!S.b[i] || S.turn !== 1; });
  const st = api.stats.get(api.level); api.score(st.won, st.lost);
  if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? 'You are X. Tap an empty square.' : '');
}
newGame(api.level);
})();
