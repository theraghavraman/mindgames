/* Hitori: shade cells so no number repeats in a row or column, shaded cells never touch, and the rest stay connected */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.ht { position: absolute; inset: 0; display: grid; gap: 3px; padding: 3px; border-radius: 12px; background: var(--rule); container-type: inline-size; --cw: calc(100cqi / var(--n)); }
.ht button { position: relative; display: grid; place-items: center; min-width: 0; border: 0; border-radius: 7px; background: var(--sheet); font-size: calc(var(--cw) * .48); font-weight: 650; color: var(--graphite); cursor: pointer; transition: background-color .15s, color .15s; }
.ht .sh { background: var(--graphite); color: var(--graphite-2); }
.ht .sh.bad { background: var(--red); color: var(--red-soft); }
.ht .ok::after { content: ""; position: absolute; inset: 14%; border: 2.5px solid var(--ch-deep); border-radius: 50%; }
.ht .dup { color: var(--red); }
.ht.won button:not(.sh) { animation: pop .4s var(--d, 0ms) both; background: var(--ch-soft); }
`);
const LEVELS = {
  easy: { name: '5×5', rank: 1, n: 5, desc: 'A quick five by five.' },
  medium: { name: '6×6', rank: 2, n: 6, desc: 'Six by six.' },
  hard: { name: '8×8', rank: 3, n: 8, desc: 'Eight by eight, with long chains of logic.' },
};
const RULES = `<p>Shade cells until these three rules hold:</p><ul>
<li>No number appears more than once in any row or column among the <b>unshaded</b> cells.</li>
<li>Shaded cells never touch each other side by side (corners are fine).</li>
<li>All unshaded cells stay connected in one piece, side by side.</li></ul>
<p>Tap a cell to shade it, tap again to circle it as definitely unshaded, and once more to clear it.</p>
<p class="tip">Every puzzle has one solution. A number that appears only once in both its row and column never needs shading.</p>`;
const nb = (i, n) => { const r = (i / n) | 0, c = i % n, o = []; if (r) o.push(i - n); if (r < n - 1) o.push(i + n); if (c) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
const connected = (sh, n) => {
  const start = sh.findIndex(v => !v); if (start < 0) return false;
  const seen = new Uint8Array(n * n), st = [start]; seen[start] = 1; let k = 0;
  while (st.length) { const i = st.pop(); k++; for (const j of nb(i, n)) if (!seen[j] && !sh[j]) { seen[j] = 1; st.push(j); } }
  return k === sh.filter(v => !v).length;
};
function latin(n) {
  const rows = MG.shuffle(MG.range(n)), cols = MG.shuffle(MG.range(n)), sym = MG.shuffle(MG.range(n).map(x => x + 1));
  return MG.range(n * n).map(i => sym[(rows[(i / n) | 0] + cols[i % n]) % n]);
}
function solve(n, num, limit) {
  const dup = i => { const r = (i / n) | 0, c = i % n; for (let k = 0; k < n; k++) { if (k !== c && num[r * n + k] === num[i]) return true; if (k !== r && num[k * n + c] === num[i]) return true; } return false; };
  const cand = MG.range(n * n).filter(dup), st = new Int8Array(n * n).fill(2);
  cand.forEach(i => { st[i] = 0; });
  const rowHas = MG.range(n).map(() => new Uint8Array(n + 1)), colHas = MG.range(n).map(() => new Uint8Array(n + 1));
  for (let i = 0; i < n * n; i++) if (st[i] === 2) { rowHas[(i / n) | 0][num[i]]++; colHas[i % n][num[i]]++; }
  let count = 0, first = null;
  const bt = k => {
    if (count >= limit) return;
    if (k === cand.length) { const sh = Array.from(st, v => (v === 1 ? 1 : 0)); if (connected(sh, n)) { count++; if (!first) first = sh; } return; }
    const i = cand[k], r = (i / n) | 0, c = i % n, v = num[i];
    if (!nb(i, n).some(j => st[j] === 1)) { st[i] = 1; bt(k + 1); st[i] = 0; }
    if (!rowHas[r][v] && !colHas[c][v]) { st[i] = 2; rowHas[r][v]++; colHas[c][v]++; bt(k + 1); rowHas[r][v]--; colHas[c][v]--; st[i] = 0; }
  };
  bt(0);
  return { count, first };
}
async function make(n) {
  for (let t = 0; t < 4000; t++) {
    const num = latin(n), sh = new Array(n * n).fill(0);
    let k = 0;
    for (const i of MG.shuffle(MG.range(n * n))) {
      if (k >= Math.round(n * n * .3)) break;
      if (nb(i, n).some(j => sh[j])) continue;
      sh[i] = 1; if (!connected(sh, n)) { sh[i] = 0; continue; } k++;
    }
    for (let i = 0; i < n * n; i++) if (sh[i]) {
      const r = (i / n) | 0, c = i % n, opts = [];
      for (let x = 0; x < n; x++) { if (!sh[r * n + x]) opts.push(num[r * n + x]); if (!sh[x * n + c]) opts.push(num[x * n + c]); }
      num[i] = MG.pick(opts);
    }
    const res = solve(n, num, 2);
    if (res.count === 1) return { n, num, sol: res.first };
    if (t % 25 === 24) await MG.sleep(0);
  }
  return null;
}
let S = null, els = [], box = null;
const KEY = 'hitori:save';
const api = MG.shell({ id: 'hitori', title: 'Hitori', chapter: 'logic', levels: LEVELS, metric: 'time', rules: RULES,
  newText: 'Pick a size. Each puzzle is checked to have exactly one solution.', onNew: newGame, onRestart: restart, onHide: () => save(), size: { ar: 1, chrome: 250 } });
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}<span class="count" data-hc>3</span></span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else hint(); });
async function newGame(level) {
  api.busy(true, 'Building a grid with exactly one solution.'); await MG.sleep(40);
  const L = LEVELS[level]; let p = null;
  while (!p) p = await make(L.n);
  S = { v: 1, level, n: L.n, num: p.num, sol: p.sol, cells: new Array(L.n * L.n).fill(0), hist: [], hints: 3 };
  build(); api.begin(); render(); save();
}
function restart() { S.cells.fill(0); S.hist = []; S.hints = 3; build(); api.begin(); render(); save(); }
function save() { if (S && api.status === 'playing') MG.store.set(KEY, Object.assign({}, S, { elapsed: api.timer.elapsed })); else MG.store.del(KEY); }
function build() {
  box = MG.h('div', { class: 'ht', role: 'grid', 'aria-label': 'Hitori board' });
  box.style.setProperty('--n', S.n); box.style.gridTemplateColumns = `repeat(${S.n}, minmax(0, 1fr))`;
  els = MG.range(S.n * S.n).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i, text: String(S.num[i]) }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) tap(+b.dataset.i); });
  box.addEventListener('contextmenu', e => { e.preventDefault(); const b = e.target.closest('button'); if (b) tap(+b.dataset.i, true); });
}
function tap(i, back) {
  if (!api.canPlay()) return;
  S.hist.push([i, S.cells[i]]); S.cells[i] = (S.cells[i] + (back ? 2 : 1)) % 3; api.dirty = true;
  S.cells[i] === 1 ? MG.sfx.place() : MG.sfx.tap();
  render(); save(); check();
}
function analyse() {
  const n = S.n, sh = S.cells.map(v => (v === 1 ? 1 : 0)), adj = new Set(), dup = new Set();
  for (let i = 0; i < n * n; i++) if (sh[i]) for (const j of nb(i, n)) if (sh[j]) { adj.add(i); adj.add(j); }
  for (let t = 0; t < 2 * n; t++) {
    const L = t < n ? MG.range(n).map(c => t * n + c) : MG.range(n).map(r => r * n + t - n), seen = {};
    for (const i of L) if (!sh[i]) (seen[S.num[i]] = seen[S.num[i]] || []).push(i);
    for (const k in seen) if (seen[k].length > 1) seen[k].forEach(i => dup.add(i));
  }
  return { sh, adj, dup, conn: connected(sh, n) };
}
function render() {
  const a = analyse(), n = S.n;
  els.forEach((b, i) => {
    const v = S.cells[i];
    b.className = v === 1 ? 'sh' + (a.adj.has(i) ? ' bad' : '') : v === 2 ? 'ok' + (a.dup.has(i) ? ' dup' : '') : '';
    b.setAttribute('aria-label', `${S.num[i]}, ${v === 1 ? 'shaded' : v === 2 ? 'circled' : 'open'}`);
  });
  MG.qs('[data-hc]', tools).textContent = S.hints;
  if (api.status === 'playing') api.progress(`${a.dup.size ? MG.plural(a.dup.size, 'cell') + ' still repeat' : 'No repeats left'}`, a.adj.size ? 'Red cells are shaded side by side.' : !a.conn ? 'The unshaded cells are split into separate pieces.' : 'Shade repeats, keep shaded cells apart and the rest connected.');
}
function check() {
  const a = analyse();
  if (a.adj.size || a.dup.size || !a.conn) return;
  box.classList.add('won'); els.forEach((b, i) => b.style.setProperty('--d', ((i % S.n) + ((i / S.n) | 0)) * 30 + 'ms'));
  const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ sub: `${LEVELS[S.level].name} Hitori`, facts: [[`${3 - S.hints} of 3`, 'Hints used'], [S.hist.length, 'Moves'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  MG.store.del(KEY);
}
function undo() { if (!api.canPlay()) return; const h = S.hist.pop(); if (!h) return; S.cells[h[0]] = h[1]; MG.sfx.note(); render(); save(); }
function hint() {
  if (!api.canPlay()) return;
  if (S.hints <= 0) { api.coach('info', 'No hints left', 'All three hints are used for this puzzle.', 3500); return; }
  const n = S.n, wrong = MG.range(n * n).filter(i => (S.cells[i] === 1) !== (S.sol[i] === 1) && (S.cells[i] !== 0 || S.sol[i] === 1));
  const i = wrong.length ? MG.pick(wrong) : MG.pick(MG.range(n * n).filter(k => S.cells[k] === 0));
  if (i == null) return;
  S.hints--; S.hist.push([i, S.cells[i]]); S.cells[i] = S.sol[i] ? 1 : 2;
  api.coach('hint', S.sol[i] ? 'Shade this cell' : 'This cell stays open', 'It has been set for you.', 4000);
  MG.sfx.hint(); MG.replay(els[i], 'flash', 600); render(); save(); check();
}
function load() {
  const g = MG.store.get(KEY);
  if (!g || g.v !== 1 || !LEVELS[g.level]) return false;
  S = g; api.setLevel(g.level); build(); api.begin({ resumed: true, elapsed: g.elapsed || 0 }); render(); return true;
}
MG.debug = { get S() { return S; }, solve, analyse, make };
if (!load()) newGame(api.level);
})();
