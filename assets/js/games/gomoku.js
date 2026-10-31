/* Gomoku: five in a row on a 15×15 board, against a computer that weighs attack and defence */
(function () {
'use strict';
const MG = window.MG;
const N = 15;
MG.style(`
.gm { position: absolute; inset: 0; border-radius: 12px; background: color-mix(in srgb, var(--c-numbers) 50%, var(--sheet)); display: grid; grid-template: repeat(${N}, 1fr) / repeat(${N}, 1fr); padding: 2%; }
.gm button { position: relative; border: 0; padding: 0; background: transparent; cursor: pointer; }
.gm button::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: color-mix(in srgb, var(--graphite) 45%, transparent); }
.gm button::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: color-mix(in srgb, var(--graphite) 45%, transparent); }
.gm button.l::before { left: 50%; } .gm button.r::before { right: 50%; } .gm button.t::after { top: 50%; } .gm button.b::after { bottom: 50%; }
.gm .s { position: absolute; inset: 7%; border-radius: 50%; z-index: 1; animation: pop .2s ease-out; }
.gm .s.p1 { background: var(--graphite); box-shadow: inset 0 -2px 0 rgba(0,0,0,.4); } .gm .s.p2 { background: #fff; box-shadow: inset 0 -2px 0 rgba(0,0,0,.15), 0 0 0 1px rgba(0,0,0,.25); }
.gm .s.last::after { content: ""; position: absolute; inset: 36%; border-radius: 50%; background: var(--red); }
.gm .s.win { box-shadow: 0 0 0 3px var(--c-sudoku-deep), 0 0 12px 3px var(--c-sudoku-deep); }
.gm button:hover:not(:disabled)::marker { color: red; }
`);
const RULES = `<p>Take turns placing stones on the intersections. You play <b>black</b>, the computer plays white.</p><ul>
<li>The first to get <b>five or more</b> stones in an unbroken line, across, down or diagonally, wins.</li><li>You take turns starting.</li></ul>
<p class="tip">An open four (four in a row with both ends free) can't be stopped. Block your opponent's open threes early.</p>`;
const LV = MG.duelLevels('Spots the obvious, misses a lot.', 'Attacks well, defends most threats.', 'Weighs every threat on the board.');
let S = null, els = [];
const api = MG.duelShell({ id: 'gomoku', title: 'Gomoku', levels: LV, rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 640 } });
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
function lineAt(b, i, p) {
  const r = (i / N) | 0, c = i % N;
  for (const [dr, dc] of DIRS) {
    const cells = [i];
    for (const s of [1, -1]) { let y = r + dr * s, x = c + dc * s; while (y >= 0 && x >= 0 && y < N && x < N && b[y * N + x] === p) { cells.push(y * N + x); y += dr * s; x += dc * s; } }
    if (cells.length >= 5) return cells;
  }
  return null;
}
function value(b, i, p) {
  const r = (i / N) | 0, c = i % N; let total = 0;
  for (const [dr, dc] of DIRS) {
    let count = 1, open = 0;
    for (const s of [1, -1]) { let y = r + dr * s, x = c + dc * s; while (y >= 0 && x >= 0 && y < N && x < N && b[y * N + x] === p) { count++; y += dr * s; x += dc * s; } if (y >= 0 && x >= 0 && y < N && x < N && !b[y * N + x]) open++; }
    total += count >= 5 ? 1e6 : count === 4 ? (open === 2 ? 5e4 : open ? 4000 : 0) : count === 3 ? (open === 2 ? 3000 : open ? 300 : 0) : count === 2 ? (open === 2 ? 200 : open ? 30 : 0) : open === 2 ? 8 : 1;
  }
  return total;
}
function cpuMove() {
  const b = S.b, cand = [];
  for (let i = 0; i < N * N; i++) {
    if (b[i]) continue;
    const r = (i / N) | 0, c = i % N; let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) { const y = r + dr, x = c + dc; if (y >= 0 && x >= 0 && y < N && x < N && b[y * N + x]) { near = true; break; } }
    if (!near) continue;
    const atk = value(b, i, 2), def = value(b, i, 1);
    const w = api.level === 'hard' ? 1.05 : api.level === 'medium' ? .8 : .5;
    cand.push([atk + def * w + Math.random(), i]);
  }
  if (!cand.length) return ((N / 2) | 0) * N + ((N / 2) | 0);
  cand.sort((a, b2) => b2[0] - a[0]);
  const top = api.level === 'easy' ? Math.min(6, cand.length) : api.level === 'medium' ? Math.min(2, cand.length) : 1;
  return cand[MG.rand(top)][1];
}
function newGame() {
  S = { b: new Array(N * N).fill(0), turn: api.nextFirst() === 'you' ? 1 : 2, over: false, last: -1 };
  const box = MG.h('div', { class: 'gm', role: 'grid', 'aria-label': 'Gomoku board' });
  els = MG.range(N * N).map(i => { const r = (i / N) | 0, c = i % N; const b = MG.h('button', { type: 'button', 'data-i': i, class: (c === 0 ? 'l ' : '') + (c === N - 1 ? 'r ' : '') + (r === 0 ? 't ' : '') + (r === N - 1 ? 'b' : '') }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b && S.turn === 1 && !S.over && api.canPlay()) place(+b.dataset.i); });
  api.begin(); render();
  if (S.turn === 2) api.think(() => place(((N / 2) | 0) * N + ((N / 2) | 0)), 500);
}
function place(i) {
  if (S.b[i] || S.over) return;
  S.b[i] = S.turn; api.dirty = true;
  if (S.last >= 0) { const o = MG.qs('.s', els[S.last]); if (o) o.classList.remove('last'); }
  S.last = i; els[i].innerHTML = `<span class="s p${S.turn} last"></span>`;
  S.turn === 1 ? MG.sfx.place() : MG.sfx.move();
  const line = lineAt(S.b, i, S.turn);
  if (line) { S.over = true; line.forEach(k => MG.qs('.s', els[k]).classList.add('win')); render(); return S.turn === 1 ? api.win({ title: 'Five in a row', sub: 'Your black stones line up.' }) : api.lose({ title: 'The computer wins', sub: 'White got five in a row.' }); }
  if (S.b.every(Boolean)) { S.over = true; render(); return api.draw({ title: 'Draw', sub: 'The board is full.' }); }
  S.turn = 3 - S.turn; render();
  if (S.turn === 2) api.think(() => place(cpuMove()), 380);
}
function render() {
  els.forEach((b, i) => { b.disabled = !!S.b[i] || S.turn !== 1 || S.over; });
  const st = api.stats.get(api.level); api.score(st.won, st.lost);
  if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? 'You are black. Tap an intersection.' : '');
}
newGame();
})();
