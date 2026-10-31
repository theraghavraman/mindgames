/* Nonogram: every puzzle is checked by a line solver, so it can be solved row by row without guessing */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.ng { position: absolute; inset: 0; display: grid; container-type: inline-size; --cw: calc(100cqi / var(--units)); touch-action: none; }
.ng .ck { display: flex; align-items: flex-end; justify-content: flex-end; gap: calc(var(--cw) * .22); padding: 0 calc(var(--cw) * .18) 0 0; font-size: calc(var(--cw) * .44); font-weight: 760; color: var(--graphite-2); font-variant-numeric: tabular-nums; }
.ng .ck.col { flex-direction: column; align-items: center; justify-content: flex-end; gap: 0; padding: 0 0 calc(var(--cw) * .14); line-height: 1.15; }
.ng .ck.row { align-items: center; }
.ng .ck.done { color: var(--pencil); opacity: .5; }
.ng .ck.on { color: var(--graphite); background: var(--hl-soft); border-radius: 6px; }
.ng .grid { grid-column: 2 / -1; grid-row: 2 / -1; display: grid; border: 3px solid var(--frame); border-radius: 8px; overflow: hidden; background: var(--sheet); }
.ng .gc { position: relative; background: var(--sheet); box-shadow: inset -1px -1px 0 var(--rule); cursor: pointer; }
.ng .gc.t5 { box-shadow: inset -2px 0 0 var(--frame), inset 0 -1px 0 var(--rule); } .ng .gc.b5 { box-shadow: inset -1px 0 0 var(--rule), inset 0 -2px 0 var(--frame); } .ng .gc.t5.b5 { box-shadow: inset -2px 0 0 var(--frame), inset 0 -2px 0 var(--frame); }
.ng .gc.f::before { content: ""; position: absolute; inset: 7%; border-radius: 3px; background: var(--graphite); }
.ng.won .gc.f::before { background: var(--ch-deep); transition: background .6s var(--d, 0ms); }
.ng .gc.x::before { content: ""; position: absolute; inset: 30%; background: linear-gradient(45deg, transparent 44%, var(--pencil) 44% 56%, transparent 56%), linear-gradient(-45deg, transparent 44%, var(--pencil) 44% 56%, transparent 56%); }
.ng .gc.hl { background: var(--peer); }
.ng .gc.hint::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 0 0 2px var(--green); }
`);
const LEVELS = {
  easy: { name: '5×5', rank: 1, n: 5, d: .6, desc: 'A small picture to learn the rules.' },
  medium: { name: '10×10', rank: 2, n: 10, d: .58, desc: 'The classic size.' },
  hard: { name: '15×15', rank: 3, n: 15, d: .57, desc: 'A big picture with long clue lists.' },
};
const RULES = `<p>Shade cells to reveal a hidden picture.</p><ul>
<li>The numbers beside each row and above each column list that line's runs of shaded cells, in order.</li>
<li><b>3 1</b> means a run of three shaded cells, at least one empty cell, then a single shaded cell.</li>
<li>Mark cells you know are empty with a cross. Crosses are only notes for you.</li></ul>
<p>Drag to shade or cross several cells in a line. Right-click or long-press to cross.</p><p class="tip">Every puzzle can be solved line by line without guessing.</p>`;

/* ---- line solver: which cells are forced in a line, given its clue and what is known */
function solveLine(line, clue) {
  const L = line.length, k = clue.length, memo = new Int8Array((L + 2) * (k + 1)).fill(-1);
  const fit = (i, j) => {
    const key = i * (k + 1) + j;
    if (memo[key] >= 0) return memo[key] === 1;
    let r = false;
    if (j === k) { r = true; for (let x = i; x < L; x++) if (line[x] === 1) { r = false; break; } }
    else if (i < L) {
      if (line[i] !== 1 && fit(i + 1, j)) r = true;
      if (!r) { const c = clue[j]; if (i + c <= L) { let ok = true; for (let x = i; x < i + c; x++) if (line[x] === 0) { ok = false; break; } if (ok && (i + c === L || line[i + c] !== 1)) r = fit(Math.min(L, i + c + 1), j + 1); } }
    }
    memo[key] = r ? 1 : 0; return r;
  };
  if (!fit(0, 0)) return null;
  const canF = new Uint8Array(L), canE = new Uint8Array(L), seen = new Uint8Array((L + 2) * (k + 1));
  const mark = (i, j) => {
    const key = i * (k + 1) + j; if (seen[key]) return; seen[key] = 1;
    if (j === k) { for (let x = i; x < L; x++) canE[x] = 1; return; }
    if (i >= L) return;
    if (line[i] !== 1 && fit(i + 1, j)) { canE[i] = 1; mark(i + 1, j); }
    const c = clue[j];
    if (i + c <= L) {
      let ok = true; for (let x = i; x < i + c; x++) if (line[x] === 0) { ok = false; break; }
      if (ok && (i + c === L || line[i + c] !== 1) && fit(Math.min(L, i + c + 1), j + 1)) { for (let x = i; x < i + c; x++) canF[x] = 1; if (i + c < L) canE[i + c] = 1; mark(Math.min(L, i + c + 1), j + 1); }
    }
  };
  mark(0, 0);
  const out = Int8Array.from(line);
  for (let x = 0; x < L; x++) { if (canF[x] && !canE[x]) out[x] = 1; else if (canE[x] && !canF[x]) out[x] = 0; else if (!canF[x] && !canE[x]) return null; }
  return out;
}
const runs = arr => { const o = []; let n = 0; for (const v of arr) { if (v === 1) n++; else if (n) { o.push(n); n = 0; } } if (n) o.push(n); return o; };
function logicSolve(n, rows, cols) {
  const g = new Int8Array(n * n).fill(-1);
  for (let changed = true; changed;) {
    changed = false;
    for (let t = 0; t < 2 * n; t++) {
      const idx = t < n ? MG.range(n).map(c => t * n + c) : MG.range(n).map(r => r * n + t - n);
      const res = solveLine(Int8Array.from(idx.map(i => g[i])), t < n ? rows[t] : cols[t - n]);
      if (!res) return false;
      idx.forEach((i, k) => { if (g[i] !== res[k]) { g[i] = res[k]; changed = true; } });
    }
  }
  return g.every(v => v !== -1);
}
function makePuzzle(n, d) {
  for (let t = 0; t < 3000; t++) {
    const sol = MG.range(n * n).map(() => (Math.random() < d ? 1 : 0));
    const rows = MG.range(n).map(r => runs(sol.slice(r * n, r * n + n)));
    const cols = MG.range(n).map(c => runs(MG.range(n).map(r => sol[r * n + c])));
    if (logicSolve(n, rows, cols)) return { n, sol, rows, cols };
  }
  return null;
}

let S = null, els = [], rowCk = [], colCk = [], mode = 1, box = null;
const KEY = 'nonogram:save';
const api = MG.shell({ id: 'nonogram', title: 'Nonogram', chapter: 'logic', levels: LEVELS, metric: 'time', rules: RULES,
  newText: 'Pick a size. Every picture is generated fresh and solvable without guessing.', onNew: newGame, onRestart: restart, onHide: () => save(), size: { ar: 1, chrome: 290 } });
const tools = MG.h('div', { class: 'tools' });
tools.innerHTML = `<button type="button" class="tool" data-m="1" aria-pressed="true"><span class="ti"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/></svg></span><span>Shade</span></button>
  <button type="button" class="tool" data-m="2" aria-pressed="false"><span class="ti">${MG.icon('x')}</span><span>Cross</span></button>
  <button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button>
  <button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}<span class="count" data-hc>3</span></span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.m) { mode = +b.dataset.m; MG.qsa('[data-m]', tools).forEach(x => x.setAttribute('aria-pressed', String(x === b))); MG.sfx.tap(); }
  else if (b.hasAttribute('data-u')) undo(); else if (b.hasAttribute('data-h')) hint();
});

async function newGame(level) {
  api.busy(true, 'Drawing a picture that logic alone can uncover.');
  await MG.sleep(40);
  const L = LEVELS[level];
  let p = null;
  while (!p) { p = makePuzzle(L.n, L.d); await MG.sleep(0); }
  S = Object.assign(p, { level, cells: new Array(L.n * L.n).fill(0), hintsLeft: 3, history: [], v: 1 });
  build(); api.begin(); render(); save();
}
function restart() { S.cells.fill(0); S.history = []; S.hintsLeft = 3; build(); api.begin(); render(); save(); }
function save() { if (S && api.status === 'playing') MG.store.set(KEY, Object.assign({}, S, { elapsed: api.timer.elapsed })); else MG.store.del(KEY); }
function build() {
  const n = S.n, cr = Math.max(1, ...S.cols.map(c => c.length)), rc = Math.max(1, ...S.rows.map(r => r.length));
  const cw = Math.max(1.4, rc * .62), ch = Math.max(1.3, cr * .55);
  api.size({ ar: (cw + n) / (ch + n), chrome: 290, chromeL: 150 });
  box = MG.h('div', { class: 'ng' });
  box.style.setProperty('--units', String(cw + n));
  box.style.gridTemplateColumns = `${cw}fr ${n}fr`; box.style.gridTemplateRows = `${ch}fr ${n}fr`;
  const corner = MG.h('div'), top = MG.h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridColumn: '2', gridRow: '1' } });
  const left = MG.h('div', { style: { display: 'grid', gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`, gridColumn: '1', gridRow: '2' } });
  colCk = S.cols.map(c => { const d = MG.h('div', { class: 'ck col', html: (c.length ? c : [0]).map(v => `<span>${v}</span>`).join('') }); top.appendChild(d); return d; });
  rowCk = S.rows.map(r => { const d = MG.h('div', { class: 'ck row', html: (r.length ? r : [0]).map(v => `<span>${v}</span>`).join('') }); left.appendChild(d); return d; });
  const grid = MG.h('div', { class: 'grid', role: 'grid', 'aria-label': `${n} by ${n} nonogram`, style: { gridColumn: '2', gridRow: '2', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` } });
  els = [];
  for (let i = 0; i < n * n; i++) {
    const r = (i / n) | 0, c = i % n;
    const el = MG.h('div', { class: 'gc', 'data-i': i }); el.dataset.base = 'gc' + (c % 5 === 4 && c < n - 1 ? ' t5' : '') + (r % 5 === 4 && r < n - 1 ? ' b5' : '');
    els.push(el); grid.appendChild(el);
  }
  box.append(corner, top, left, grid);
  api.board.innerHTML = ''; api.board.appendChild(box);
  bind(grid);
  MG.qs('[data-hc]', tools).textContent = S.hintsLeft;
}
const lineVals = (t) => (t < S.n ? MG.range(S.n).map(c => S.cells[t * S.n + c] === 1 ? 1 : 0) : MG.range(S.n).map(r => S.cells[r * S.n + t - S.n] === 1 ? 1 : 0));
const same = (a, b) => a.length === b.length && a.every((v, k) => v === b[k]);
function render(hover = -1) {
  const n = S.n, hr = hover >= 0 ? (hover / n) | 0 : -1, hc = hover >= 0 ? hover % n : -1;
  for (let i = 0; i < n * n; i++) {
    const v = S.cells[i], r = (i / n) | 0, c = i % n;
    els[i].className = els[i].dataset.base + (v === 1 ? ' f' : v === 2 ? ' x' : '') + ((r === hr || c === hc) && api.status === 'playing' ? ' hl' : '') + (S.hintAt === i ? ' hint' : '');
  }
  let done = 0;
  for (let t = 0; t < 2 * n; t++) {
    const ok = same(runs(lineVals(t)), t < n ? S.rows[t] : S.cols[t - n]);
    const el = t < n ? rowCk[t] : colCk[t - n];
    el.classList.toggle('done', ok); el.classList.toggle('on', (t < n ? t === hr : t - n === hc) && !ok);
    if (ok) done++;
  }
  MG.qs('[data-hc]', tools).textContent = S.hintsLeft;
  tools.querySelector('[data-h]').classList.toggle('spent', S.hintsLeft <= 0);
  if (api.status === 'playing') api.progress(`${2 * n - done} of ${2 * n} lines to go`, 'A line greys out when its runs match its clue.', done / (2 * n), 2 * n);
  return done === 2 * n;
}
function checkWin() {
  if (!render()) return;
  box.classList.add('won');
  els.forEach((el, i) => el.style.setProperty('--d', (((i / S.n) | 0) + (i % S.n)) * 30 + 'ms'));
  const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ title: 'Picture complete', sub: `${LEVELS[S.level].name} nonogram`, facts: [[`${3 - S.hintsLeft} of 3`, 'Hints used'], [S.history.length, 'Strokes'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  MG.store.del(KEY);
}
function bind(grid) {
  let stroke = null, lpTimer = 0;
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest && el.closest('.gc') && grid.contains(el) ? +el.closest('.gc').dataset.i : -1; };
  const paint = i => {
    if (i < 0 || stroke.done.has(i)) return;
    const r = (i / S.n) | 0, c = i % S.n;
    if (stroke.axis == null && i !== stroke.start) stroke.axis = r === stroke.r0 ? 'r' : c === stroke.c0 ? 'c' : null;
    if (stroke.axis === 'r' && r !== stroke.r0) return; if (stroke.axis === 'c' && c !== stroke.c0) return;
    if (i !== stroke.start && stroke.axis == null) return;
    const cur = S.cells[i];
    if (stroke.to === 0 ? cur !== stroke.from : cur !== 0) return;
    stroke.done.add(i); stroke.list.push([i, cur]); S.cells[i] = stroke.to;
    S.hintAt = -1;
    if (stroke.to) MG.sfx.tap();
  };
  grid.addEventListener('contextmenu', e => e.preventDefault());
  grid.addEventListener('pointerdown', e => {
    if (!api.canPlay()) return;
    const i = cellAt(e.clientX, e.clientY); if (i < 0) return;
    e.preventDefault();
    const tool = e.button === 2 ? 2 : mode, cur = S.cells[i];
    stroke = { start: i, r0: (i / S.n) | 0, c0: i % S.n, axis: null, to: cur === tool ? 0 : tool, from: cur, done: new Set(), list: [] };
    if (stroke.to && cur && cur !== tool) stroke.to = tool;
    if (cur && cur !== tool) { stroke.list.push([i, cur]); S.cells[i] = tool; stroke.done.add(i); } else paint(i);
    if (e.pointerType !== 'mouse') { clearTimeout(lpTimer); lpTimer = setTimeout(() => { if (stroke && stroke.list.length === 1 && mode === 1) { const [k, prev] = stroke.list[0]; S.cells[k] = prev === 2 ? 0 : 2; stroke.to = S.cells[k]; MG.buzz(15); render(k); } }, 420); }
    render(i);
  });
  grid.addEventListener('pointermove', e => { if (!stroke) { if (e.pointerType === 'mouse') render(cellAt(e.clientX, e.clientY)); return; } const i = cellAt(e.clientX, e.clientY); if (i >= 0 && i !== stroke.start) clearTimeout(lpTimer); paint(i); render(i); });
  const end = () => { clearTimeout(lpTimer); if (!stroke) return; if (stroke.list.length) { S.history.push(stroke.list); api.dirty = true; } stroke = null; save(); checkWin(); };
  window.addEventListener('pointerup', end); grid.addEventListener('pointercancel', end);
  grid.addEventListener('pointerleave', () => { if (!stroke) render(); });
}
function undo() {
  if (!api.canPlay()) return;
  const s = S.history.pop(); if (!s) return;
  for (let k = s.length - 1; k >= 0; k--) S.cells[s[k][0]] = s[k][1];
  MG.sfx.note(); render(); save();
}
function hint() {
  if (!api.canPlay()) return;
  if (S.hintsLeft <= 0) { api.coach('info', 'No hints left', 'All three hints are used for this picture.', 3500); return; }
  const wrong = MG.range(S.n * S.n).filter(i => (S.cells[i] === 1) !== (S.sol[i] === 1) || (S.sol[i] === 0 && S.cells[i] === 0));
  if (!wrong.length) return;
  const bad = wrong.filter(i => S.cells[i] === 1 && !S.sol[i]), i = bad.length ? bad[0] : MG.pick(wrong.filter(k => S.sol[k] === 1).concat(wrong).slice(0, 12));
  S.history.push([[i, S.cells[i]]]); S.cells[i] = S.sol[i] ? 1 : 2; S.hintsLeft--; S.hintAt = i;
  api.coach('hint', S.sol[i] ? 'This cell is shaded' : 'This cell stays empty', bad.length ? 'One of your shaded cells was wrong; it now carries a cross.' : 'Outlined in green on the board.', 5000);
  MG.sfx.hint(); save(); checkWin();
}
function load() {
  const g = MG.store.get(KEY);
  if (!g || g.v !== 1 || !LEVELS[g.level] || !Array.isArray(g.cells)) return false;
  S = g; api.setLevel(g.level); build(); api.begin({ resumed: true, elapsed: g.elapsed || 0 }); render();
  return true;
}
if (!load()) newGame(api.level);
})();
