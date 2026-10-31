/* Traffic Jam: slide the cars and lorries so the red car can drive out. Every board's shortest solution is known. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.tj { position: absolute; inset: 0; border-radius: 14px; background: var(--frame); padding: 2.2%; touch-action: none; }
.tj .lot { position: relative; width: 100%; height: 100%; border-radius: 8px; background: color-mix(in srgb, var(--sheet) 14%, var(--frame)); background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: calc(100% / 6) calc(100% / 6); }
.tj .exit { position: absolute; right: -2.6%; top: calc(100% / 6 * 2 + 2%); height: calc(100% / 6 - 4%); width: 3%; background: var(--c-moves-deep); border-radius: 0 4px 4px 0; }
.tj .car { position: absolute; border-radius: 10px; box-shadow: inset 0 -4px 0 rgba(0,0,0,.18); cursor: grab; transition: left .14s ease-out, top .14s ease-out; display: grid; place-items: center; }
.tj .car.drag { transition: none; cursor: grabbing; box-shadow: inset 0 -4px 0 rgba(0,0,0,.18), 0 8px 22px -6px rgba(0,0,0,.5); z-index: 2; }
.tj .car::after { content: ""; position: absolute; inset: 22%; border-radius: 6px; background: rgba(255,255,255,.22); }
.tj .car.red { background: var(--red); }
.tj .car.out { transition: left .5s ease-in; }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, band: [4, 8], desc: 'Solvable in 4 to 8 moves.' },
  medium: { name: 'Medium', rank: 2, band: [9, 15], desc: 'Solvable in 9 to 15 moves.' },
  hard: { name: 'Hard', rank: 3, band: [16, 99], desc: 'The hardest position in its family, 16 moves or more when possible.' },
};
const COLS = ['var(--c-sudoku)', 'var(--c-duels)', 'var(--c-moves)', 'var(--c-brain)', 'var(--c-numbers)', 'var(--c-logic)'];
const RULES = `<p>Get the red car out through the gap on the right side of the lot.</p><ul>
<li>Drag a vehicle along its length: cars and lorries only move forwards or backwards, never sideways.</li>
<li>Vehicles can't pass through each other.</li><li>Sliding one vehicle any distance counts as one move.</li></ul>
<p class="tip">Each board is solved in advance by a computer, so you know the fewest moves possible before you start.</p>`;
const N = 6;
/* vehicles: [horizontal, length, fixed row or column]; a state lists each vehicle's position along its track */
function cellsOf(v, p) { const [h, len, line] = v, out = []; for (let k = 0; k < len; k++) out.push(h ? line * N + p + k : (p + k) * N + line); return out; }
function nexts(V, st) {
  const occ = new Int8Array(N * N).fill(-1);
  V.forEach((v, k) => cellsOf(v, st[k]).forEach(i => { occ[i] = k; }));
  const out = [];
  V.forEach((v, k) => {
    const [h, len, line] = v, at = p => (h ? line * N + p : p * N + line);
    for (let p = st[k] - 1; p >= 0 && occ[at(p)] < 0; p--) { const s = st.slice(); s[k] = p; out.push(s); }
    for (let p = st[k] + 1; p + len - 1 < N && occ[at(p + len - 1)] < 0; p++) { const s = st.slice(); s[k] = p; out.push(s); }
  });
  return out;
}
function randomLot() {
  const occ = new Uint8Array(N * N), V = [[1, 2, 2]], st = [MG.rand(3)];
  cellsOf(V[0], st[0]).forEach(i => { occ[i] = 1; });
  const want = 9 + MG.rand(5);
  for (let t = 0; t < 300 && V.length < want; t++) {
    const h = Math.random() < .5 ? 1 : 0, len = Math.random() < .28 ? 3 : 2, line = MG.rand(N), p = MG.rand(N - len + 1);
    if (h && line === 2) continue;
    const v = [h, len, line], cs = cellsOf(v, p);
    if (cs.some(i => occ[i])) continue;
    cs.forEach(i => { occ[i] = 1; }); V.push(v); st.push(p);
  }
  return { V, st };
}
async function generate(band) {
  let best = null; const t0 = performance.now();
  for (let tries = 0; tries < 400; tries++) {
    const { V, st } = randomLot();
    const key = s => s.join(','), seen = new Map([[key(st), st]]), q = [st];
    for (let h = 0; h < q.length && seen.size < 30000; h++) for (const s of nexts(V, q[h])) { const k = key(s); if (!seen.has(k)) { seen.set(k, s); q.push(s); } }
    const solvedStates = [...seen.values()].filter(s => s[0] === N - 2);
    if (!solvedStates.length) continue;
    const dist = new Map(solvedStates.map(s => [key(s), 0])), q2 = solvedStates.slice();
    for (let h = 0; h < q2.length; h++) { const d = dist.get(key(q2[h])); for (const s of nexts(V, q2[h])) { const k = key(s); if (!dist.has(k) && seen.has(k)) { dist.set(k, d + 1); q2.push(s); } } }
    let pickS = null, pickD = -1;
    const pool = [...dist.entries()].filter(([, d]) => d >= band[0] && d <= band[1]);
    if (pool.length) { const [k, d] = band[1] >= 99 ? pool.reduce((a, b) => (b[1] > a[1] ? b : a)) : MG.pick(pool); pickS = seen.get(k); pickD = d; }
    else { for (const [k, d] of dist) if (d > pickD) { pickD = d; pickS = seen.get(k); } }
    if (pickS && (!best || Math.abs(pickD - band[0]) < Math.abs(best.d - band[0]) || (pickD >= band[0] && pickD <= band[1]))) best = { V, st: pickS, d: pickD };
    if (best && best.d >= band[0] && best.d <= band[1]) break;
    if (tries % 6 === 5) await MG.sleep(0);
    if (performance.now() - t0 > 6000) break;
  }
  return best;
}
let S = null, lot = null, els = [];
const api = MG.shell({ id: 'traffic-jam', title: 'Traffic Jam', chapter: 'moves', levels: LEVELS, metric: 'moves', rules: RULES, onNew: newGame, onRestart: restart, size: { ar: 1, chrome: 230, maxW: 560 } });
api.mid.innerHTML = '<span class="pill">Moves <b data-m>0</b></span><span class="pill">Fewest <b data-p>0</b></span>';
async function newGame(level) {
  api.busy(true, 'Parking cars and solving the lot.'); await MG.sleep(40);
  const g = await generate(LEVELS[level].band);
  S = { V: g.V, start: g.st.slice(), st: g.st.slice(), par: g.d, moves: 0 };
  build(); api.begin(); render();
}
function restart() { S.st = S.start.slice(); S.moves = 0; build(); api.begin(); render(); }
function build() {
  const box = MG.h('div', { class: 'tj', role: 'application', 'aria-label': 'Parking lot' });
  lot = MG.h('div', { class: 'lot' }); lot.appendChild(MG.h('div', { class: 'exit' }));
  els = S.V.map((v, k) => { const el = MG.h('div', { class: 'car' + (k === 0 ? ' red' : ''), 'data-k': k }); if (k) el.style.background = COLS[k % COLS.length]; lot.appendChild(el); return el; });
  box.appendChild(lot); api.board.innerHTML = ''; api.board.appendChild(box);
  let drag = null;
  lot.addEventListener('pointerdown', e => {
    const el = e.target.closest('.car'); if (!el || !api.canPlay()) return;
    const k = +el.dataset.k, [h] = S.V[k], range = freeRange(k);
    drag = { k, h, x0: e.clientX, y0: e.clientY, p0: S.st[k], range, cell: lot.clientWidth / N, el };
    el.classList.add('drag'); el.setPointerCapture(e.pointerId);
  });
  lot.addEventListener('pointermove', e => {
    if (!drag) return;
    const d = (drag.h ? e.clientX - drag.x0 : e.clientY - drag.y0) / drag.cell, p = MG.clamp(drag.p0 + d, drag.range[0], drag.range[1]);
    drag.el.style[drag.h ? 'left' : 'top'] = (p / N * 100) + '%';
  });
  const end = e => {
    if (!drag) return;
    const d = (drag.h ? e.clientX - drag.x0 : e.clientY - drag.y0) / drag.cell, p = Math.round(MG.clamp(drag.p0 + d, drag.range[0], drag.range[1]));
    drag.el.classList.remove('drag');
    if (p !== drag.p0) { S.st[drag.k] = p; S.moves++; api.dirty = true; MG.sfx.slide(); }
    drag = null; render(); check();
  };
  lot.addEventListener('pointerup', end); lot.addEventListener('pointercancel', end);
}
function freeRange(k) {
  const occ = new Int8Array(N * N).fill(-1);
  S.V.forEach((v, j) => { if (j !== k) cellsOf(v, S.st[j]).forEach(i => { occ[i] = j; }); });
  const [h, len, line] = S.V[k], at = p => (h ? line * N + p : p * N + line);
  let lo = S.st[k], hi = S.st[k];
  while (lo - 1 >= 0 && occ[at(lo - 1)] < 0) lo--;
  while (hi + len < N && occ[at(hi + len)] < 0) hi++;
  return [lo, hi];
}
function render() {
  S.V.forEach(([h, len, line], k) => {
    const el = els[k], p = S.st[k];
    Object.assign(el.style, { left: ((h ? p : line) / N * 100 + 1) + '%', top: ((h ? line : p) / N * 100 + 1) + '%', width: ((h ? len : 1) / N * 100 - 2) + '%', height: ((h ? 1 : len) / N * 100 - 2) + '%' });
  });
  MG.qs('[data-m]', api.mid).textContent = S.moves; MG.qs('[data-p]', api.mid).textContent = S.par;
  if (api.status === 'playing') api.progress('Free the red car', `The fewest moves for this lot: ${S.par}. Drag vehicles along their length.`, null, 0);
}
function check() {
  if (S.st[0] !== N - 2) return;
  const el = els[0]; el.classList.add('out'); setTimeout(() => { el.style.left = '110%'; }, 30);
  const prev = api.stats.get(api.level).best, best = !prev || S.moves < prev ? S.moves : prev;
  api.win({ title: S.moves === S.par ? 'Perfect exit' : 'Out of the jam', value: S.moves, big: String(S.moves), badge: S.moves === S.par ? 'The fewest moves possible' : undefined,
    sub: S.moves === S.par ? 'You matched the computer’s best solution.' : `The fewest possible was ${S.par}.`, facts: [[S.par, 'Fewest possible'], [MG.fmtTime(api.timer.elapsed), 'Time'], [best, 'Your best']] });
}
MG.debug = { generate, nexts, get S() { return S; } };
newGame(api.level);
})();
