/* Star Battle: one star in every row, column and region, and stars never touch */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.sbt { position: absolute; inset: 0; display: grid; border: 3px solid var(--frame); border-radius: 10px; overflow: hidden; container-type: inline-size; --cw: calc(100cqi / var(--n)); }
.sbt button { position: relative; display: grid; place-items: center; min-width: 0; border: 0; padding: 0; cursor: pointer; background: var(--bg); }
.sbt button:hover { filter: brightness(.97); }
.sbt svg { width: 64%; height: 64%; }
.sbt .star svg { animation: pop .3s cubic-bezier(.2, .8, .2, 1.4); }
.sbt .star path { fill: var(--graphite); }
.sbt .star.bad path { fill: var(--red); }
.sbt .dot::after { content: ""; width: 16%; height: 16%; border-radius: 50%; background: var(--graphite-2); opacity: .55; }
.sbt.won .star path { fill: var(--c-sudoku-deep); }
`);
const LEVELS = {
  easy: { name: '6×6', rank: 1, n: 6, desc: 'Six rows, six columns, six regions.' },
  medium: { name: '8×8', rank: 2, n: 8, desc: 'The classic size for one star per region.' },
  hard: { name: '10×10', rank: 3, n: 10, desc: 'Ten regions with long, winding borders.' },
};
const RULES = `<p>Place stars on the grid.</p><ul>
<li>Every <b>row</b>, every <b>column</b> and every outlined <b>region</b> holds exactly one star.</li>
<li>Stars never touch each other, not even at a corner.</li></ul>
<p>Tap a cell to cycle it through star, dot and empty. Dots are notes for cells you know stay empty.</p>
<p class="tip">Every puzzle has exactly one solution. Stars that break a rule turn red.</p>`;
const PAL = ['#FFE7A3', '#FFD0E6', '#FFDCC0', '#DDF4C4', '#CBEBFF', '#E2D8FF', '#C9F1E4', '#F6D9F7', '#FBE3D1', '#DCE3EE'];
function placeStars(n) {
  const p = [], used = new Uint8Array(n);
  const bt = r => { if (r === n) return true; for (const c of MG.shuffle(MG.range(n))) { if (used[c] || (r && Math.abs(c - p[r - 1]) < 2)) continue; used[c] = 1; p[r] = c; if (bt(r + 1)) return true; used[c] = 0; } return false; };
  return bt(0) ? p : null;
}
function growRegions(n, p) {
  const reg = new Int8Array(n * n).fill(-1);
  p.forEach((c, r) => { reg[r * n + c] = r; });
  let left = n * n - n;
  const nb = i => { const r = (i / n) | 0, c = i % n, o = []; if (r) o.push(i - n); if (r < n - 1) o.push(i + n); if (c) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
  while (left) {
    const k = MG.rand(n), fr = [];
    for (let i = 0; i < n * n; i++) if (reg[i] === k) for (const j of nb(i)) if (reg[j] < 0) fr.push(j);
    if (!fr.length) continue;
    reg[MG.pick(fr)] = k; left--;
  }
  return reg;
}
function solutions(n, reg, limit) {
  const out = [], usedC = new Uint8Array(n), usedR = new Uint8Array(n), p = [];
  const bt = r => { if (out.length >= limit) return; if (r === n) { out.push(p.slice()); return; }
    for (let c = 0; c < n; c++) { const g = reg[r * n + c]; if (usedC[c] || usedR[g] || (r && Math.abs(c - p[r - 1]) < 2)) continue; usedC[c] = usedR[g] = 1; p[r] = c; bt(r + 1); usedC[c] = usedR[g] = 0; } };
  bt(0); return out;
}
const count = (n, reg, limit) => solutions(n, reg, limit).length;
function regionConnected(n, reg, id) {
  let start = -1, total = 0;
  for (let i = 0; i < n * n; i++) if (reg[i] === id) { total++; if (start < 0) start = i; }
  if (start < 0) return false;
  const seen = new Uint8Array(n * n), st = [start]; seen[start] = 1; let k = 0;
  while (st.length) { const i = st.pop(); k++; const r = (i / n) | 0, c = i % n;
    for (const j of [r ? i - n : -1, r < n - 1 ? i + n : -1, c ? i - 1 : -1, c < n - 1 ? i + 1 : -1]) if (j >= 0 && !seen[j] && reg[j] === id) { seen[j] = 1; st.push(j); } }
  return k === total;
}
/* Repair: while a second solution q exists, hand one of q's star cells to a neighbouring region.
   That region then holds two of q's stars, so q dies, while the intended solution p is untouched. */
async function make(n) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const p = placeStars(n), reg = growRegions(n, p);
    for (let it = 0; it < 120; it++) {
      const sols = solutions(n, reg, 2);
      if (sols.length === 1) return { n, reg: Array.from(reg), sol: p };
      const q = sols.find(s => s.some((c, r) => c !== p[r]));
      let moved = false;
      for (const r of MG.shuffle(MG.range(n).filter(r => q[r] !== p[r]))) {
        const x = r * n + q[r], A = reg[x], c = x % n;
        const nbs = [r ? x - n : -1, r < n - 1 ? x + n : -1, c ? x - 1 : -1, c < n - 1 ? x + 1 : -1].filter(j => j >= 0 && reg[j] !== A).map(j => reg[j]);
        for (const B of MG.shuffle([...new Set(nbs)])) { reg[x] = B; if (regionConnected(n, reg, A)) { moved = true; break; } reg[x] = A; }
        if (moved) break;
      }
      if (!moved) break;
    }
    if (attempt % 4 === 3) await MG.sleep(0);
  }
  return null;
}
let S = null, els = [], box = null;
const KEY = 'starbattle:save';
const api = MG.shell({ id: 'star-battle', title: 'Star Battle', chapter: 'logic', levels: LEVELS, metric: 'time', rules: RULES,
  newText: 'Pick a size. Each layout is checked to have exactly one solution.', onNew: newGame, onRestart: restart, onHide: () => save(), size: { ar: 1, chrome: 250 } });
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}<span class="count" data-hc>3</span></span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else hint(); });
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
async function newGame(level) {
  api.busy(true, 'Drawing regions with exactly one solution.'); await MG.sleep(40);
  const L = LEVELS[level];
  let p = await make(L.n);
  if (!p) p = await make(L.n);
  S = { v: 1, level, n: L.n, reg: p.reg, sol: p.sol, cells: new Array(L.n * L.n).fill(0), hist: [], hints: 3 };
  build(); api.begin(); render(); save();
}
function restart() { S.cells.fill(0); S.hist = []; S.hints = 3; build(); api.begin(); render(); save(); }
function save() { if (S && api.status === 'playing') MG.store.set(KEY, Object.assign({}, S, { elapsed: api.timer.elapsed })); else MG.store.del(KEY); }
function build() {
  const n = S.n;
  box = MG.h('div', { class: 'sbt', role: 'grid', 'aria-label': 'Star Battle board' });
  box.style.setProperty('--n', n);
  box.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
  const dark = MG.isDark();
  els = MG.range(n * n).map(i => {
    const r = (i / n) | 0, c = i % n, g = S.reg[i];
    const rt = c < n - 1 && S.reg[i + 1] !== g, bt = r < n - 1 && S.reg[i + n] !== g;
    const b = MG.h('button', { type: 'button', 'data-i': i });
    b.style.setProperty('--bg', dark ? `color-mix(in srgb, ${PAL[g % PAL.length]} 22%, var(--sheet))` : PAL[g % PAL.length]);
    b.style.boxShadow = `inset -${rt ? 3 : 1}px 0 0 ${rt ? 'var(--frame)' : 'rgba(35,38,46,.16)'}, inset 0 -${bt ? 3 : 1}px 0 ${bt ? 'var(--frame)' : 'rgba(35,38,46,.16)'}`;
    box.appendChild(b); return b;
  });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) tap(+b.dataset.i); });
  box.addEventListener('contextmenu', e => { e.preventDefault(); const b = e.target.closest('button'); if (b) tap(+b.dataset.i, true); });
}
document.addEventListener('mg:theme', () => { if (S) { build(); render(); } });
function tap(i, back) {
  if (!api.canPlay()) return;
  const order = [0, 2, 1], k = order.indexOf(S.cells[i]);
  S.hist.push([i, S.cells[i]]); S.cells[i] = order[(k + (back ? 2 : 1)) % 3]; api.dirty = true;
  S.cells[i] === 2 ? MG.sfx.place() : MG.sfx.tap();
  render(); save(); check();
}
function bad() {
  const n = S.n, out = new Set(), st = MG.range(n * n).filter(i => S.cells[i] === 2);
  for (const a of st) for (const b of st) if (a < b) {
    const ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n;
    if ((Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) || ra === rb || ca === cb || S.reg[a] === S.reg[b]) { out.add(a); out.add(b); }
  }
  return out;
}
function render() {
  const b = bad(), n = S.n;
  els.forEach((el, i) => {
    const v = S.cells[i];
    el.className = v === 2 ? 'star' + (b.has(i) ? ' bad' : '') : v === 1 ? 'dot' : '';
    el.innerHTML = v === 2 ? STAR : '';
    el.setAttribute('aria-label', `Row ${((i / n) | 0) + 1}, column ${i % n + 1}: ${v === 2 ? 'star' : v === 1 ? 'dot' : 'empty'}`);
  });
  MG.qs('[data-hc]', tools).textContent = S.hints;
  const stars = S.cells.filter(v => v === 2).length;
  if (api.status === 'playing') api.progress(`${MG.plural(stars, 'star')} of ${n} placed`, b.size ? 'Red stars share a line or region, or touch.' : 'One star per row, column and region; stars never touch.', Math.min(1, stars / n), n);
}
function check() {
  const n = S.n;
  if (S.cells.filter(v => v === 2).length !== n || bad().size) return;
  box.classList.add('won');
  const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ sub: `${LEVELS[S.level].name} Star Battle`, facts: [[`${3 - S.hints} of 3`, 'Hints used'], [S.hist.length, 'Moves'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  MG.store.del(KEY);
}
function undo() { if (!api.canPlay()) return; const h = S.hist.pop(); if (!h) return; S.cells[h[0]] = h[1]; MG.sfx.note(); render(); save(); }
function hint() {
  if (!api.canPlay()) return;
  if (S.hints <= 0) { api.coach('info', 'No hints left', 'All three hints are used for this puzzle.', 3500); return; }
  const n = S.n, wrong = MG.range(n * n).filter(i => S.cells[i] === 2 && S.sol[(i / n) | 0] !== i % n);
  const i = wrong.length ? wrong[0] : MG.pick(MG.range(n).map(r => r * n + S.sol[r]).filter(k => S.cells[k] !== 2));
  if (i == null) return;
  S.hints--; S.hist.push([i, S.cells[i]]);
  S.cells[i] = wrong.length ? 1 : 2;
  api.coach('hint', wrong.length ? 'That star was misplaced' : 'A star belongs here', wrong.length ? 'It is now a dot.' : `Row ${((i / n) | 0) + 1}, column ${i % n + 1}.`, 4500);
  MG.sfx.hint(); MG.replay(els[i], 'flash', 600); render(); save(); check();
}
function load() {
  const g = MG.store.get(KEY);
  if (!g || g.v !== 1 || !LEVELS[g.level]) return false;
  S = g; api.setLevel(g.level); build(); api.begin({ resumed: true, elapsed: g.elapsed || 0 }); render(); return true;
}
MG.debug = { get S() { return S; }, count, make };
if (!load()) newGame(api.level);
})();
