/* Four in a Row: drop discs into a 7×6 frame; the computer searches ahead with alpha-beta pruning */
(function () {
'use strict';
const MG = window.MG;
const C = 7, R = 6;
MG.style(`
.fr { position: absolute; inset: 0; border-radius: 16px; background: var(--c-duels-deep); padding: 1.6%; display: grid; grid-template-columns: repeat(${C}, 1fr); cursor: pointer; }
.fr .col { position: relative; display: grid; grid-template-rows: repeat(${R}, 1fr); border-radius: 12px; }
.fr .col:hover { background: rgba(255,255,255,.12); }
.fr .hole { position: relative; margin: 9%; border-radius: 50%; background: var(--paper); box-shadow: inset 0 3px 6px rgba(0,0,0,.25); overflow: visible; }
.fr .disc { position: absolute; inset: 0; border-radius: 50%; animation: drop var(--t, .3s) cubic-bezier(.5, 0, .75, 0) both, land .18s var(--t, .3s) ease-out; box-shadow: inset 0 -4px 0 rgba(0,0,0,.15); }
.fr .p1 { background: var(--c-sudoku); } .fr .p2 { background: var(--red); }
.fr .disc.win { box-shadow: inset 0 -4px 0 rgba(0,0,0,.15), 0 0 0 4px var(--sheet), 0 0 18px 4px var(--sheet); }
@keyframes drop { from { transform: translateY(calc(var(--fall) * -118%)); } to { transform: none; } }
@keyframes land { 50% { transform: translateY(-6%); } }
`);
const RULES = `<p>Take turns dropping discs into the frame. You are <b>yellow</b>; the computer is <b>red</b>.</p><ul>
<li>A disc falls to the lowest empty spot in its column.</li><li>Line up four of your discs in a row, column or diagonal to win.</li><li>If the frame fills up first, it's a draw.</li></ul>
<p>Tap a column, or press <kbd>1</kbd> to <kbd>7</kbd>.</p><p class="tip">Columns in the middle take part in more lines. Hard looks seven moves ahead.</p>`;
const LV = MG.duelLevels('Looks one move ahead, sometimes.', 'Looks four moves ahead.', 'Looks seven moves ahead.');
const DEPTH = { easy: 1, medium: 4, hard: 7 };
let S = null, cols = [];
const api = MG.duelShell({ id: 'four-in-a-row', title: 'Four in a Row', levels: LV, rules: RULES, onNew: newGame, size: { ar: C / R, chrome: 220, maxW: 620 } });
const at = (c, r) => c * R + r;
function lineAt(b, c, r, p) {
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const cells = [[c, r]];
    for (const s of [1, -1]) { let x = c + dc * s, y = r + dr * s; while (x >= 0 && x < C && y >= 0 && y < R && b[at(x, y)] === p) { cells.push([x, y]); x += dc * s; y += dr * s; } }
    if (cells.length >= 4) return cells;
  }
  return null;
}
function evaluate(b, p) {
  let s = 0; const q = 3 - p;
  for (let r = 0; r < R; r++) if (b[at(3, r)] === p) s += 4; else if (b[at(3, r)] === q) s -= 4;
  const win = (cs) => { let a = 0, o = 0; for (const [x, y] of cs) { const v = b[at(x, y)]; if (v === p) a++; else if (v === q) o++; } if (a && o) return 0; if (a === 3) return 6; if (a === 2) return 2; if (o === 3) return -7; if (o === 2) return -2; return 0; };
  for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const ec = c + 3 * dc, er = r + 3 * dr; if (ec >= C || er < 0 || er >= R) continue;
    s += win([0, 1, 2, 3].map(k => [c + k * dc, r + k * dr]));
  }
  return s;
}
const ORDER = [3, 2, 4, 1, 5, 0, 6];
function negamax(b, h, depth, alpha, beta, p) {
  let moved = false;
  for (const c of ORDER) {
    if (h[c] >= R) continue; moved = true;
    const r = h[c]; b[at(c, r)] = p; h[c]++;
    let v;
    if (lineAt(b, c, r, p)) v = 100000 + depth;
    else v = depth <= 1 ? evaluate(b, p) : -negamax(b, h, depth - 1, -beta, -alpha, 3 - p);
    h[c]--; b[at(c, r)] = 0;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return moved ? alpha : 0;
}
function cpuMove() {
  const b = S.b.slice(), h = S.h.slice(), depth = DEPTH[api.level];
  const legal = ORDER.filter(c => h[c] < R);
  if (api.level === 'easy' && Math.random() < .35) return MG.pick(legal);
  let best = -Infinity, picks = [];
  for (const c of legal) {
    const r = h[c]; b[at(c, r)] = 2; h[c]++;
    const v = lineAt(b, c, r, 2) ? 1e6 : depth <= 1 ? evaluate(b, 2) : -negamax(b, h, depth - 1, -Infinity, Infinity, 1);
    h[c]--; b[at(c, r)] = 0;
    if (v > best) { best = v; picks = [c]; } else if (v === best) picks.push(c);
  }
  return picks[0];
}
function newGame() {
  S = { b: new Array(C * R).fill(0), h: new Array(C).fill(0), turn: api.nextFirst() === 'you' ? 1 : 2, over: false };
  build(); api.begin(); render();
  if (S.turn === 2) api.think(() => drop(cpuMove()), 500);
}
function build() {
  const box = MG.h('div', { class: 'fr', role: 'grid', 'aria-label': 'Seven columns' });
  cols = MG.range(C).map(c => {
    const col = MG.h('div', { class: 'col', 'data-c': c, role: 'button', 'aria-label': `Column ${c + 1}` });
    for (let r = R - 1; r >= 0; r--) col.appendChild(MG.h('div', { class: 'hole', 'data-r': r }));
    box.appendChild(col); return col;
  });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const c = e.target.closest('.col'); if (c && S.turn === 1 && !S.over && api.canPlay()) drop(+c.dataset.c); });
}
function drop(c) {
  if (S.over || S.h[c] >= R) { MG.replay(cols[c], 'nudge', 260); return; }
  const r = S.h[c], p = S.turn;
  S.b[at(c, r)] = p; S.h[c]++; api.dirty = true;
  const hole = MG.qs(`[data-r="${r}"]`, cols[c]), fall = R - r;
  const d = MG.h('div', { class: 'disc p' + p }); d.style.setProperty('--fall', fall); d.style.setProperty('--t', (.12 + fall * .05) + 's');
  hole.appendChild(d);
  api.later(() => MG.sfx.blip(p === 1 ? 520 : 390, .08), (120 + fall * 50));
  const line = lineAt(S.b, c, r, p);
  if (line) { S.over = true; api.later(() => line.forEach(([x, y]) => { const el = MG.qs(`[data-r="${y}"] .disc`, cols[x]); if (el) el.classList.add('win'); }), 350); finish(p); return; }
  if (S.h.every(v => v >= R)) { S.over = true; finish(0); return; }
  S.turn = 3 - S.turn; render();
  if (S.turn === 2) api.think(() => drop(cpuMove()), 550);
}
function finish(p) {
  render();
  if (p === 1) api.win({ title: 'Four in a row!', sub: 'You lined up four yellow discs.' });
  else if (p === 2) api.lose({ title: 'The computer wins', sub: 'Red lined up four.' });
  else api.draw({ title: 'Draw', sub: 'The frame is full and nobody made four.' });
}
function render() { const st = api.stats.get(api.level); api.score(st.won, st.lost); if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? 'You are yellow. Tap a column.' : ''); }
MG.onKey(e => { if (/^[1-7]$/.test(e.key) && S && S.turn === 1 && !S.over && api.canPlay()) drop(+e.key - 1); });
newGame();
})();
