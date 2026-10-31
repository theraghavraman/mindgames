/* Binairo (Takuzu): zeros and ones, no three in a row, balanced lines, no twin rows or columns */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.bn { position: absolute; inset: 0; display: grid; gap: 4px; padding: 4px; border-radius: 12px; background: var(--frame); container-type: inline-size; --cw: calc(100cqi / var(--n)); }
.bn button { position: relative; display: grid; place-items: center; min-width: 0; border: 0; border-radius: 7px; background: var(--sheet); cursor: pointer; font-size: calc(var(--cw) * .5); font-weight: 700; font-variation-settings: 'CASL' 1; color: var(--pen); transition: background-color .15s, color .15s, transform .1s; }
.bn button:active { transform: scale(.95); }
.bn .z { background: var(--ch-soft); }
.bn .o { background: var(--pen); color: var(--on-pen); }
.bn .given { font-weight: 850; font-variation-settings: 'CASL' 0; color: var(--graphite); cursor: default; }
.bn .o.given { background: var(--graphite); color: var(--sheet); }
.bn .sel { box-shadow: inset 0 0 0 3px var(--ch-deep); }
.bn .bad::after { content: ""; position: absolute; inset: 3px; border: 2.5px solid var(--red); border-radius: 6px; }
.bn.won button { animation: pop .4s var(--d, 0ms) both; }
`);
const LEVELS = {
  easy: { name: '6×6', rank: 1, n: 6, keep: .5, desc: 'Six by six, with plenty of digits printed.' },
  medium: { name: '8×8', rank: 2, n: 8, keep: .36, desc: 'Eight by eight.' },
  hard: { name: '10×10', rank: 3, n: 10, keep: 0, desc: 'Ten by ten, only the digits logic needs.' },
};
const RULES = `<p>Fill every cell with a <b>0</b> or a <b>1</b>.</p><ul>
<li>No more than two of the same digit sit next to each other in a row or column, so <b>0 0 0</b> is not allowed.</li>
<li>Every row and every column has as many 0s as 1s.</li>
<li>No two rows are the same, and no two columns are the same.</li></ul>
<p>Tap a cell to cycle it through 0, 1 and empty. With a keyboard, use the arrow keys, 0, 1 and Backspace.</p>
<p class="tip">Every puzzle can be solved by logic alone. Broken rules are circled in red as you go.</p>`;
const linesOf = n => { const rows = MG.range(n).map(r => MG.range(n).map(c => r * n + c)), cols = MG.range(n).map(c => MG.range(n).map(r => r * n + c)); return { rows, cols, all: rows.concat(cols) }; };
function fill(n) {
  const g = new Int8Array(n * n).fill(-1), half = n / 2;
  const ok = i => {
    const r = (i / n) | 0, c = i % n, v = g[i];
    for (let s = c - 2; s <= c; s++) if (s >= 0 && s + 2 < n && g[r * n + s] === v && g[r * n + s + 1] === v && g[r * n + s + 2] === v) return false;
    for (let s = r - 2; s <= r; s++) if (s >= 0 && s + 2 < n && g[s * n + c] === v && g[(s + 1) * n + c] === v && g[(s + 2) * n + c] === v) return false;
    let a = 0, b = 0; for (let k = 0; k < n; k++) { if (g[r * n + k] === v) a++; if (g[k * n + c] === v) b++; }
    if (a > half || b > half) return false;
    if (c === n - 1) for (let r2 = 0; r2 < r; r2++) { let same = true; for (let k = 0; k < n; k++) if (g[r2 * n + k] !== g[r * n + k]) { same = false; break; } if (same) return false; }
    if (r === n - 1) for (let c2 = 0; c2 < c; c2++) { let same = true; for (let k = 0; k < n; k++) if (g[k * n + c2] !== g[k * n + c]) { same = false; break; } if (same) return false; }
    return true;
  };
  const bt = i => { if (i === n * n) return true; for (const v of MG.shuffle([0, 1])) { g[i] = v; if (ok(i) && bt(i + 1)) return true; } g[i] = -1; return false; };
  bt(0); return Array.from(g);
}
/* Deduction only: pairs, sandwiches, balance and the no-twins rule */
function logic(start, n) {
  const g = start.slice(), half = n / 2, { rows, cols, all } = linesOf(n);
  for (let ch = true; ch;) {
    ch = false;
    for (const L of all) {
      for (let k = 0; k + 2 < n; k++) {
        const a = g[L[k]], b = g[L[k + 1]], c = g[L[k + 2]];
        if (a >= 0 && a === b && c < 0) { g[L[k + 2]] = 1 - a; ch = true; }
        else if (b >= 0 && b === c && a < 0) { g[L[k]] = 1 - b; ch = true; }
        else if (a >= 0 && a === c && b < 0) { g[L[k + 1]] = 1 - a; ch = true; }
      }
      let z = 0, o = 0, e = 0; for (const i of L) { if (g[i] === 0) z++; else if (g[i] === 1) o++; else e++; }
      if (z > half || o > half) return null;
      if (e && (z === half || o === half)) { const v = z === half ? 1 : 0; for (const i of L) if (g[i] < 0) g[i] = v; ch = true; }
    }
    for (const set of [rows, cols]) {
      const full = set.filter(L => L.every(i => g[i] >= 0));
      for (const L of set) {
        if (L.filter(i => g[i] < 0).length !== 2) continue;
        const twin = full.find(C => L.every((i, k) => g[i] < 0 || g[i] === g[C[k]]));
        if (twin) { L.forEach((i, k) => { if (g[i] < 0) g[i] = 1 - g[twin[k]]; }); ch = true; }
      }
    }
  }
  return g;
}
function make(n, keep) {
  const sol = fill(n), g = sol.slice();
  let count = n * n;
  for (const i of MG.shuffle(MG.range(n * n))) {
    if (count <= keep * n * n) break;
    const v = g[i]; g[i] = -1;
    const r = logic(g, n);
    if (r && r.every((x, k) => x === sol[k])) count--; else g[i] = v;
  }
  return { n, sol, given: g };
}
function errors(g, n) {
  const bad = new Set(), half = n / 2, { rows, cols, all } = linesOf(n);
  for (const L of all) {
    for (let k = 0; k + 2 < n; k++) { const a = g[L[k]]; if (a >= 0 && a === g[L[k + 1]] && a === g[L[k + 2]]) [L[k], L[k + 1], L[k + 2]].forEach(i => bad.add(i)); }
    for (const v of [0, 1]) if (L.filter(i => g[i] === v).length > half) L.forEach(i => { if (g[i] === v) bad.add(i); });
  }
  for (const set of [rows, cols]) for (let a = 0; a < set.length; a++) for (let b = a + 1; b < set.length; b++) {
    const A = set[a], B = set[b];
    if (A.every(i => g[i] >= 0) && A.every((i, k) => g[i] === g[B[k]])) { A.forEach(i => bad.add(i)); B.forEach(i => bad.add(i)); }
  }
  return bad;
}
let S = null, els = [], sel = -1, box = null;
const KEY = 'binairo:save';
const api = MG.shell({ id: 'binairo', title: 'Binairo', chapter: 'logic', levels: LEVELS, metric: 'time', rules: RULES,
  newText: 'Pick a size. Every puzzle can be solved without guessing.', onNew: newGame, onRestart: restart, onHide: () => save(), size: { ar: 1, chrome: 250 } });
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}<span class="count" data-hc>3</span></span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else hint(); });
async function newGame(level) {
  api.busy(true, 'Building a grid logic can finish.'); await MG.sleep(40);
  const L = LEVELS[level], p = make(L.n, L.keep);
  S = { v: 1, level, n: L.n, sol: p.sol, given: p.given, cells: p.given.slice(), hist: [], hints: 3 };
  build(); api.begin(); render(); save();
}
function restart() { S.cells = S.given.slice(); S.hist = []; S.hints = 3; build(); api.begin(); render(); save(); }
function save() { if (S && api.status === 'playing') MG.store.set(KEY, Object.assign({}, S, { elapsed: api.timer.elapsed })); else MG.store.del(KEY); }
function build() {
  box = MG.h('div', { class: 'bn', role: 'grid', 'aria-label': 'Binairo board' });
  box.style.setProperty('--n', S.n);
  box.style.gridTemplateColumns = `repeat(${S.n}, minmax(0, 1fr))`;
  els = MG.range(S.n * S.n).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) tap(+b.dataset.i); });
  box.addEventListener('contextmenu', e => { e.preventDefault(); const b = e.target.closest('button'); if (b) tap(+b.dataset.i, true); });
}
function set(i, v) {
  if (S.given[i] >= 0 || S.cells[i] === v) return;
  S.hist.push([i, S.cells[i]]); S.cells[i] = v; api.dirty = true;
  MG.sfx.tap(); MG.replay(els[i], 'pop', 300); render(); save(); check();
}
function tap(i, back) {
  if (!api.canPlay()) return;
  sel = i;
  if (S.given[i] >= 0) { MG.replay(els[i], 'nudge', 260); render(); return; }
  const order = [-1, 0, 1], k = order.indexOf(S.cells[i]);
  set(i, order[(k + (back ? 2 : 1)) % 3]);
}
function render() {
  const bad = errors(S.cells, S.n);
  let filled = 0;
  els.forEach((b, i) => {
    const v = S.cells[i];
    if (v >= 0) filled++;
    b.textContent = v < 0 ? '' : v;
    b.className = (v === 0 ? 'z' : v === 1 ? 'o' : '') + (S.given[i] >= 0 ? ' given' : '') + (bad.has(i) ? ' bad' : '') + (i === sel ? ' sel' : '');
    b.setAttribute('aria-label', `Row ${((i / S.n) | 0) + 1}, column ${i % S.n + 1}: ${v < 0 ? 'empty' : v}`);
  });
  MG.qs('[data-hc]', tools).textContent = S.hints;
  const open = S.given.filter(v => v < 0).length, done = filled - (S.n * S.n - open);
  if (api.status === 'playing') api.progress(`${open - done} cells to go`, bad.size ? 'A rule is broken where the red rings are.' : 'No triples, balanced lines, no twin rows or columns.', done / open, Math.min(open, 50));
}
function check() {
  if (S.cells.some(v => v < 0) || errors(S.cells, S.n).size) return;
  box.classList.add('won'); els.forEach((b, i) => b.style.setProperty('--d', ((i % S.n) + ((i / S.n) | 0)) * 25 + 'ms'));
  const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ sub: `${LEVELS[S.level].name} Binairo`, facts: [[`${3 - S.hints} of 3`, 'Hints used'], [S.hist.length, 'Moves'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  MG.store.del(KEY);
}
function undo() { if (!api.canPlay()) return; const h = S.hist.pop(); if (!h) return; S.cells[h[0]] = h[1]; MG.sfx.note(); render(); save(); }
function hint() {
  if (!api.canPlay()) return;
  if (S.hints <= 0) { api.coach('info', 'No hints left', 'All three hints are used for this puzzle.', 3500); return; }
  const wrong = MG.range(S.n * S.n).filter(i => S.cells[i] >= 0 && S.cells[i] !== S.sol[i]);
  let i;
  if (wrong.length) i = wrong[0];
  else {
    const known = S.cells.map((v, k) => (v >= 0 && v === S.sol[k] ? v : -1)), next = logic(known, S.n);
    const forced = next ? MG.range(S.n * S.n).filter(k => S.cells[k] < 0 && next[k] >= 0) : [];
    i = forced.length ? MG.pick(forced) : MG.pick(MG.range(S.n * S.n).filter(k => S.cells[k] < 0));
  }
  if (i == null) return;
  S.hints--; sel = i;
  api.coach('hint', `This cell is ${S.sol[i]}`, wrong.length ? 'It held the wrong digit.' : 'It follows from the rules and the digits already placed.', 4500);
  MG.sfx.hint();
  S.hist.push([i, S.cells[i]]); S.cells[i] = S.sol[i]; render(); save(); check();
}
MG.onKey(e => {
  if (!S || !api.canPlay()) return;
  const n = S.n, mv = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (mv) { e.preventDefault(); sel = sel < 0 ? 0 : (sel + mv + n * n) % (n * n); render(); els[sel].focus(); return; }
  if (sel < 0) return;
  if (e.key === '0' || e.key === '1') { e.preventDefault(); if (S.given[sel] < 0) set(sel, +e.key); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); if (S.given[sel] < 0) set(sel, -1); }
  else if (e.key === 'u' || e.key === 'U' || ((e.ctrlKey || e.metaKey) && e.key === 'z')) undo();
});
function load() {
  const g = MG.store.get(KEY);
  if (!g || g.v !== 1 || !LEVELS[g.level]) return false;
  S = g; api.setLevel(g.level); build(); api.begin({ resumed: true, elapsed: g.elapsed || 0 }); render(); return true;
}
MG.debug = { get S() { return S; }, logic, errors };
if (!load()) newGame(api.level);
})();
