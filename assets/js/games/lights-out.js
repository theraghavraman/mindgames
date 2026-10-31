/* Lights Out: pressing a light flips it and its four neighbours. Turn every light off. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.lo { position: absolute; inset: 0; display: grid; gap: 8px; padding: 10px; border-radius: 18px; background: var(--frame); }
.lo button { border: 0; border-radius: 22%; background: color-mix(in srgb, var(--sheet) 12%, var(--frame)); cursor: pointer; transition: background-color .22s, box-shadow .22s, transform .12s; }
.lo button:active { transform: scale(.93); }
.lo button.on { background: var(--c-sudoku); box-shadow: 0 0 18px 2px color-mix(in srgb, var(--c-sudoku) 70%, transparent), inset 0 -4px 0 rgba(0,0,0,.12); }
:root[data-theme="dark"] .lo button.on, .dark-on .lo button.on { background: var(--c-sudoku-deep); }
.lo button.tip { box-shadow: inset 0 0 0 4px var(--green); }
.lo.won button { background: var(--c-moves-deep); transition-delay: var(--d, 0ms); }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, n: 5, k: 6, desc: '5×5, solvable in about six presses.' },
  medium: { name: 'Medium', rank: 2, n: 5, k: 12, desc: '5×5, about twelve presses.' },
  hard: { name: 'Hard', rank: 3, n: 7, k: 22, desc: '7×7, about twenty presses.' },
};
const RULES = `<p>Switch every light off.</p><ul><li>Pressing a light flips it and its four neighbours above, below, left and right: on becomes off and off becomes on.</li>
<li>Pressing the same light twice undoes it, so order never matters.</li></ul><p class="tip">Every board is made by pressing lights on a dark board, so it can always be solved. Hints come from an exact solver.</p>`;
let S = null, els = [], box = null;
const api = MG.shell({ id: 'lights-out', title: 'Lights Out', chapter: 'logic', levels: LEVELS, metric: 'moves', rules: RULES, onNew: newGame, onRestart: restart, size: { ar: 1, chrome: 250, maxW: 520 } });
api.mid.innerHTML = '<span class="pill">Moves <b data-moves>0</b></span>';
const movesEl = MG.qs('[data-moves]', api.mid);
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}</span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else hint(); });
const flip = (g, n, i) => { const r = (i / n) | 0, c = i % n; g[i] ^= 1; if (r) g[i - n] ^= 1; if (r < n - 1) g[i + n] ^= 1; if (c) g[i - 1] ^= 1; if (c < n - 1) g[i + 1] ^= 1; };
/* Exact solver over GF(2); among all solutions returns one with the fewest presses */
function solveLights(g, n) {
  const N = n * n, rows = [];
  for (let i = 0; i < N; i++) { const row = new Uint8Array(N + 1); const t = new Uint8Array(N); flip(t, n, i); for (let j = 0; j < N; j++) row[j] = t[j]; rows.push(row); }
  const A = MG.range(N).map(j => { const row = new Uint8Array(N + 1); for (let i = 0; i < N; i++) row[i] = rows[i][j]; row[N] = g[j]; return row; });
  const where = new Int32Array(N).fill(-1); let r = 0;
  for (let c = 0; c < N && r < N; c++) {
    let p = -1; for (let k = r; k < N; k++) if (A[k][c]) { p = k; break; }
    if (p < 0) continue;
    [A[p], A[r]] = [A[r], A[p]]; where[c] = r;
    for (let k = 0; k < N; k++) if (k !== r && A[k][c]) for (let j = c; j <= N; j++) A[k][j] ^= A[r][j];
    r++;
  }
  for (let k = r; k < N; k++) if (A[k][N]) return null;
  const free = MG.range(N).filter(c => where[c] < 0);
  let best = null;
  for (let mask = 0; mask < (1 << free.length); mask++) {
    const x = new Uint8Array(N);
    free.forEach((c, b) => { x[c] = (mask >> b) & 1; });
    for (let c = 0; c < N; c++) if (where[c] >= 0) { let v = A[where[c]][N]; for (const f of free) if (A[where[c]][f]) v ^= x[f]; x[c] = v; }
    const cnt = x.reduce((s, v) => s + v, 0);
    if (!best || cnt < best.cnt) best = { x, cnt };
  }
  return best;
}
function newGame(level) {
  const L = LEVELS[level], n = L.n, g = new Uint8Array(n * n);
  let sol;
  do { g.fill(0); for (const i of MG.shuffle(MG.range(n * n)).slice(0, L.k)) flip(g, n, i); sol = solveLights(g, n); } while (!g.some(v => v) || !sol || sol.cnt < Math.min(L.k, 4));
  S = { level, n, start: Uint8Array.from(g), g, moves: 0, hist: [], par: sol.cnt, hintsUsed: 0 };
  build(); api.begin(); render();
}
function restart() { S.g = Uint8Array.from(S.start); S.moves = 0; S.hist = []; S.hintsUsed = 0; build(); api.begin(); render(); }
function build() {
  box = MG.h('div', { class: 'lo', role: 'grid', 'aria-label': 'Lights' });
  box.style.gridTemplateColumns = `repeat(${S.n}, minmax(0, 1fr))`;
  els = MG.range(S.n * S.n).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) press(+b.dataset.i); });
}
function press(i, silent) {
  if (!api.canPlay()) return;
  flip(S.g, S.n, i); S.moves++; S.hist.push(i); api.dirty = true;
  if (!silent) MG.sfx.blip(S.g[i] ? 740 : 440, .09);
  els.forEach(b => b.classList.remove('tip'));
  render(); check();
}
function render() {
  els.forEach((b, i) => { b.classList.toggle('on', !!S.g[i]); b.setAttribute('aria-label', `Light ${i + 1}: ${S.g[i] ? 'on' : 'off'}`); });
  movesEl.textContent = S.moves;
  const on = S.g.reduce((s, v) => s + v, 0);
  if (api.status === 'playing') api.progress(`${MG.plural(on, 'light')} still on`, `The fewest presses that solve this board: ${S.par}.`);
}
function check() {
  if (S.g.some(v => v)) return;
  box.classList.add('won'); els.forEach((b, i) => b.style.setProperty('--d', ((i % S.n) + ((i / S.n) | 0)) * 40 + 'ms'));
  const prev = api.stats.get(api.level).best, best = !prev || S.moves < prev ? S.moves : prev;
  api.win({ title: 'Lights out', value: S.moves, big: String(S.moves), sub: `Solved in ${MG.plural(S.moves, 'move')}; the fewest possible was ${S.par}.`, facts: [[S.par, 'Fewest possible'], [S.hintsUsed, 'Hints used'], [best, 'Your best']] });
}
function undo() { if (!api.canPlay() || !S.hist.length) return; const i = S.hist.pop(); flip(S.g, S.n, i); S.moves++; MG.sfx.note(); render(); }
function hint() {
  if (!api.canPlay()) return;
  const sol = solveLights(S.g, S.n); if (!sol) return;
  const i = sol.x.findIndex(v => v);
  if (i < 0) return;
  S.hintsUsed++;
  els.forEach(b => b.classList.remove('tip')); els[i].classList.add('tip');
  api.coach('hint', 'Press the outlined light', `From here, the board can be cleared in ${MG.plural(sol.cnt, 'press', 'presses')}.`, 4500);
  MG.sfx.hint();
}
newGame(api.level);
})();
