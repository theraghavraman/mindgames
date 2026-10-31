/* Kakuro: cross sums. Built on the same constraint solver as the Sudoku family, so every puzzle has exactly one solution. */
(function () {
'use strict';
const MG = window.MG, core = MG.latinCore;
MG.style(`
.kk { position: absolute; inset: 0; display: grid; border: 3px solid var(--frame); border-radius: 10px; overflow: hidden; background: var(--frame); gap: 1px; container-type: inline-size; --cw: calc(100cqi / var(--cols)); }
.kk .blk { position: relative; background: color-mix(in srgb, var(--graphite) 88%, var(--sheet)); }
.kk .blk svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.kk .blk line { stroke: rgba(255,255,255,.28); stroke-width: 1px; vector-effect: non-scaling-stroke; }
.kk .blk text { fill: #fff; font: 700 30px var(--font); }
.kk .blk.done text { fill: rgba(255,255,255,.45); }
.kk .cell { box-shadow: none; }
.kk .cell .v { font-size: calc(var(--cw) * .55); z-index: 2; }
.kk .notes { position: absolute; inset: 6%; display: grid; grid-template: repeat(3, 1fr) / repeat(3, 1fr); pointer-events: none; }
.kk .notes i { display: grid; place-items: center; font-style: normal; font-size: calc(var(--cw) * .22); font-weight: 600; color: var(--pencil); visibility: hidden; }
.kk .notes i.on { visibility: visible; }
.kk .cell.run { background: var(--peer); }
.kk .cell.selected { background: var(--hl); }
.kk .cell.bad .v { color: var(--red); }
.kk.won .cell { background: var(--ch-soft); }
.combos { font-size: 13px; color: var(--graphite-2); line-height: 1.5; min-height: 40px; }
.combos b { color: var(--graphite); }
.combos span { display: inline-block; margin: 0 6px 2px 0; padding: 0 6px; border-radius: 6px; background: var(--sheet-2); font-variant-numeric: tabular-nums; }
`);
const LEVELS = {
  easy: { name: '6×6', rank: 1, R: 6, C: 6, dens: .2, max: 4, desc: 'A small board with short runs.' },
  medium: { name: '8×8', rank: 2, R: 8, C: 8, dens: .24, max: 5, desc: 'Medium board, runs up to five cells.' },
  hard: { name: '10×10', rank: 3, R: 10, C: 10, dens: .24, max: 6, desc: 'Large board with runs up to six cells.' },
};
const RULES = `<p>Fill every white cell with a digit from 1 to 9.</p><ul>
<li>A clue in a dark cell gives the total of the run of white cells to its <b>right</b> (top-right number) or <b>below</b> it (bottom-left number).</li>
<li>Digits in one run never repeat.</li></ul>
<p>The helper under the board lists every combination of digits that fits the selected cell's runs.</p><p class="tip">Every puzzle has exactly one solution. Two cells summing to 3 must be 1 and 2; three cells summing to 24 must be 7, 8 and 9.</p>`;

function layout(L) {
  const { R, C } = L;
  for (let t = 0; t < 400; t++) {
    const blk = new Uint8Array(R * C), at = (r, c) => r * C + c, mir = i => { const r = (i / C) | 0, c = i % C; return at(R - r, C - c); };
    for (let k = 0; k < R; k++) blk[at(k, 0)] = 1; for (let k = 0; k < C; k++) blk[at(0, k)] = 1;
    const setB = i => { blk[i] = 1; const m = mir(i); if (m >= 0 && m < R * C && ((m / C) | 0) >= 1 && m % C >= 1) blk[m] = 1; };
    for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) if (Math.random() < L.dens) setB(at(r, c));
    for (let it = 0; it < 60; it++) {
      let changed = false;
      for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) {
        const i = at(r, c); if (blk[i]) continue;
        let h = 1; for (let x = c - 1; x >= 1 && !blk[at(r, x)]; x--) h++; for (let x = c + 1; x < C && !blk[at(r, x)]; x++) h++;
        let v = 1; for (let y = r - 1; y >= 1 && !blk[at(y, c)]; y--) v++; for (let y = r + 1; y < R && !blk[at(y, c)]; y++) v++;
        if (h === 1 || v === 1) { setB(i); changed = true; }
        else if (h > L.max || v > L.max) { if (Math.random() < .5) { setB(i); changed = true; } }
      }
      if (!changed) break;
    }
    const white = MG.range(R * C).filter(i => !blk[i]);
    if (white.length < (R - 1) * (C - 1) * .55) continue;
    const seen = new Set([white[0]]), st = [white[0]];
    while (st.length) { const i = st.pop(), r = (i / C) | 0, c = i % C; for (const j of [i - 1, i + 1, i - C, i + C]) { if (j < 0 || j >= R * C || blk[j] || seen.has(j)) continue; const r2 = (j / C) | 0; if (Math.abs(r2 - r) + Math.abs(j % C - c) !== 1) continue; seen.add(j); st.push(j); } }
    if (seen.size !== white.length) continue;
    let bad = false;
    for (const i of white) { const r = (i / C) | 0, c = i % C; const hl = !blk[i - 1] || (c + 1 < C && !blk[i + 1]), vl = !blk[i - C] || (r + 1 < R && !blk[i + C]); if (!hl || !vl) bad = true; }
    if (!bad) return blk;
  }
  return null;
}
function runsOf(blk, R, C) {
  const runs = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const i = r * C + c; if (!blk[i]) continue;
    if (c + 1 < C && !blk[i + 1]) { const cells = []; for (let x = c + 1; x < C && !blk[r * C + x]; x++) cells.push(r * C + x); runs.push({ clue: i, dir: 'a', cells }); }
    if (r + 1 < R && !blk[i + C]) { const cells = []; for (let y = r + 1; y < R && !blk[y * C + c]; y++) cells.push(y * C + c); runs.push({ clue: i, dir: 'd', cells }); }
  }
  return runs;
}
function specFor(blk, R, C, runs, sums) {
  const sp = core.newSpec(R, C, 9);
  for (let i = 0; i < R * C; i++) if (!blk[i]) { sp.exist[i] = 1; sp.region[i] = 0; }
  runs.forEach((run, k) => { sp.groups.push(run.cells); sp.kinds.push('run'); if (sums) sp.cages.push({ cells: run.cells, target: sums[k], op: '+', distinct: true }); });
  return sp;
}
/* Fill the runs, then repair: while a second solution exists, change one digit where the two
   solutions disagree and recompute the clues. Repeat until the solution is unique. */
async function generate(L) {
  for (let t = 0; t < 60; t++) {
    const blk = layout(L); if (!blk) continue;
    const runs = runsOf(blk, L.R, L.C), white = MG.range(L.R * L.C).filter(i => !blk[i]);
    const runsOfCell = new Map(white.map(i => [i, runs.filter(r => r.cells.includes(i))]));
    const sol = core.makeSolver(specFor(blk, L.R, L.C, runs)).fill(20000);
    if (!sol) continue;
    for (let step = 0; step < 500; step++) {
      const sums = runs.map(r => r.cells.reduce((a, i) => a + sol[i], 0));
      const c = core.makeSolver(specFor(blk, L.R, L.C, runs, sums)).count(null, 2, 60000);
      if (core.unique(c)) return { R: L.R, C: L.C, blk: Array.from(blk), runs, sums, sol: Array.from(sol) };
      const alt = [c.first, c.second].find(x => x && x.some((v, i) => v !== sol[i]));
      const pool = alt ? white.filter(i => alt[i] !== sol[i]) : white;
      const x = MG.pick(pool), used = new Set();
      for (const r of runsOfCell.get(x)) for (const j of r.cells) if (j !== x) used.add(sol[j]);
      const opts = MG.range(9).map(d => d + 1).filter(d => d !== sol[x] && !used.has(d));
      if (opts.length) sol[x] = MG.pick(opts);
      if (step % 8 === 7) await MG.sleep(0);
    }
  }
  return null;
}
const combos = (len, sum, must, banned) => {
  const out = [];
  const go = (start, left, acc, s) => { if (!left) { if (s === sum && must.every(d => acc.includes(d))) out.push(acc.slice()); return; } for (let d = start; d <= 9; d++) { if (s + d > sum) break; if (banned.includes(d)) continue; acc.push(d); go(d + 1, left - 1, acc, s + d); acc.pop(); } };
  go(1, len, [], 0); return out;
};

let S = null, els = [], clueEls = new Map(), box = null, notesMode = false, sel = -1;
const KEY = 'kakuro:save';
const api = MG.shell({ id: 'kakuro', title: 'Kakuro', chapter: 'numbers', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: restart, onHide: () => save(),
  newText: 'Pick a size. Every puzzle is checked to have exactly one solution.', size: { ar: 1, chrome: 390, maxW: 600 } });
const helper = MG.h('div', { class: 'combos', 'aria-live': 'polite' });
const tools = MG.h('div', { class: 'tools' });
tools.innerHTML = `<button type="button" class="tool" data-t="undo"><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-t="erase"><span class="ti">${MG.icon('erase')}</span><span>Erase</span></button>
  <button type="button" class="tool" data-t="notes" aria-pressed="false"><span class="ti">${MG.icon('pencil')}</span><span>Notes</span></button><button type="button" class="tool" data-t="hint"><span class="ti">${MG.icon('bulb')}<span class="count" data-hc>3</span></span><span>Hint</span></button>`;
const pad = MG.h('div', { class: 'numpad', style: { '--keys': 9, '--keys-l': 3 } });
pad.innerHTML = MG.range(9).map(d => `<button type="button" class="key" data-d="${d + 1}"><span class="kd">${d + 1}</span></button>`).join('');
api.controls.append(helper, tools, pad);
tools.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; ({ undo, erase: () => put(0), notes: () => { notesMode = !notesMode; b.setAttribute('aria-pressed', String(notesMode)); pad.classList.toggle('pencil', notesMode); }, hint })[b.dataset.t](); });
pad.addEventListener('click', e => { const k = e.target.closest('.key'); if (k) put(+k.dataset.d, notesMode); });
async function newGame(level) {
  api.busy(true, 'Building a cross-sum with exactly one solution.'); await MG.sleep(40);
  let p = null; while (!p) p = await generate(LEVELS[level]);
  S = Object.assign(p, { v: 1, level, vals: new Array(p.R * p.C).fill(0), notes: new Array(p.R * p.C).fill(0), hist: [], hints: 3 });
  sel = -1; build(); api.begin(); render(); save();
}
function restart() { S.vals.fill(0); S.notes.fill(0); S.hist = []; S.hints = 3; sel = -1; build(); api.begin(); render(); save(); }
function save() { if (S && api.status === 'playing') MG.store.set(KEY, Object.assign({}, S, { elapsed: api.timer.elapsed })); else MG.store.del(KEY); }
function build() {
  const { R, C } = S;
  box = MG.h('div', { class: 'kk', role: 'grid', 'aria-label': 'Kakuro board' });
  box.style.setProperty('--cols', C); box.style.gridTemplateColumns = `repeat(${C}, minmax(0, 1fr))`; box.style.gridTemplateRows = `repeat(${R}, minmax(0, 1fr))`;
  els = []; clueEls = new Map();
  const across = {}, down = {};
  S.runs.forEach((r, k) => { (r.dir === 'a' ? across : down)[r.clue] = S.sums[k]; });
  for (let i = 0; i < R * C; i++) {
    if (S.blk[i]) {
      const a = across[i], d = down[i], hasClue = a || d;
      const el = MG.h('div', { class: 'blk', html: hasClue ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="100" y2="100"/>${a ? `<text x="92" y="40" text-anchor="end">${a}</text>` : ''}${d ? `<text x="8" y="90">${d}</text>` : ''}</svg>` : '' });
      if (hasClue) el.setAttribute('aria-label', `${a ? 'across ' + a : ''} ${d ? 'down ' + d : ''}`.trim());
      clueEls.set(i, el); box.appendChild(el);
    } else {
      const el = MG.h('button', { type: 'button', class: 'cell', 'data-i': i, html: '<span class="v"></span><span class="notes">' + MG.range(9).map(k => `<i>${k + 1}</i>`).join('') + '</span>' });
      els[i] = el; box.appendChild(el);
    }
  }
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('pointerdown', e => { const b = e.target.closest('.cell'); if (b) { sel = +b.dataset.i; render(); } });
  MG.qs('[data-hc]', tools).textContent = S.hints;
}
const runsAt = i => S.runs.map((r, k) => Object.assign({ k, sum: S.sums[k] }, r)).filter(r => r.cells.includes(i));
function put(d, asNote) {
  if (!api.canPlay() || sel < 0) { if (sel < 0) MG.toast('Select a white cell first'); return; }
  if (asNote && d) { S.hist.push([sel, S.vals[sel], S.notes[sel]]); S.vals[sel] = 0; S.notes[sel] ^= 1 << d; MG.sfx.note(); render(); save(); return; }
  if (S.vals[sel] === d) return;
  S.hist.push([sel, S.vals[sel], S.notes[sel]]); S.vals[sel] = d; S.notes[sel] = 0; api.dirty = true;
  if (d) { MG.sfx.place(); MG.replay(MG.qs('.v', els[sel]), 'ink', 300); } else MG.sfx.note();
  render(); save(); check();
}
function bad() {
  const out = new Set();
  S.runs.forEach((r, k) => {
    const vs = r.cells.map(i => S.vals[i]), seen = {};
    r.cells.forEach(i => { const v = S.vals[i]; if (!v) return; if (seen[v] != null) { out.add(i); out.add(seen[v]); } else seen[v] = i; });
    const s = vs.reduce((a, b) => a + b, 0);
    if (s > S.sums[k] || (vs.every(Boolean) && s !== S.sums[k])) r.cells.forEach(i => out.add(i));
  });
  return out;
}
function render() {
  const b = bad(), runCells = new Set(sel >= 0 ? runsAt(sel).flatMap(r => r.cells) : []);
  els.forEach((el, i) => {
    if (!el) return;
    const v = S.vals[i];
    el.className = 'cell' + (v ? ' user' : '') + (i === sel ? ' selected' : runCells.has(i) ? ' run' : '') + (b.has(i) ? ' bad' : '');
    MG.qs('.v', el).textContent = v || '';
    MG.qsa('.notes i', el).forEach((n, k) => n.classList.toggle('on', !v && !!(S.notes[i] & (1 << (k + 1)))));
  });
  S.runs.forEach((r, k) => { const done = r.cells.every(i => S.vals[i]) && r.cells.reduce((s, i) => s + S.vals[i], 0) === S.sums[k]; const el = clueEls.get(r.clue); if (el) el.classList.toggle('done', done && S.runs.filter(q => q.clue === r.clue).every(q => q.cells.every(i => S.vals[i]))); });
  if (sel >= 0) {
    helper.innerHTML = runsAt(sel).map(r => {
      const placed = r.cells.filter(i => i !== sel && S.vals[i]).map(i => S.vals[i]);
      const list = combos(r.cells.length, r.sum, placed, []).slice(0, 8);
      return `<div><b>${r.dir === 'a' ? 'Across' : 'Down'} ${r.sum} in ${r.cells.length}:</b> ${list.length ? list.map(c => `<span>${c.join('+')}</span>`).join('') : '<span>no combination fits</span>'}</div>`;
    }).join('');
  } else helper.innerHTML = '<div>Select a white cell to see which digit combinations fit its runs.</div>';
  MG.qs('[data-hc]', tools).textContent = S.hints;
  const open = els.filter(Boolean).length, filled = els.filter((e, i) => e && S.vals[i]).length;
  if (api.status === 'playing') api.progress(`${open - filled} cells to go`, b.size ? 'Red digits repeat in a run or break its total.' : 'Each run adds up to its clue, with no repeats.', filled / open, Math.min(open, 60));
}
function check() {
  if (!S.vals.every((v, i) => S.blk[i] || v) || bad().size) return;
  box.classList.add('won'); sel = -1; render();
  const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ title: 'Every sum checks out', sub: `${LEVELS[S.level].name} Kakuro`, facts: [[3 - S.hints, 'Hints used'], [S.runs.length, 'Runs'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  MG.store.del(KEY);
}
function undo() { if (!api.canPlay()) return; const h = S.hist.pop(); if (!h) return; [sel, S.vals[h[0]], S.notes[h[0]]] = [h[0], h[1], h[2]]; MG.sfx.note(); render(); save(); }
function hint() {
  if (!api.canPlay()) return;
  if (S.hints <= 0) { api.coach('info', 'No hints left', 'All three hints are used for this puzzle.', 3500); return; }
  const cand = MG.range(S.R * S.C).filter(i => !S.blk[i] && S.vals[i] !== S.sol[i]);
  const i = sel >= 0 && cand.includes(sel) ? sel : cand.find(k => S.vals[k]) ?? MG.pick(cand);
  if (i == null) return;
  S.hints--; S.hist.push([i, S.vals[i], S.notes[i]]); S.vals[i] = S.sol[i]; S.notes[i] = 0; sel = i;
  api.coach('hint', `This cell is ${S.sol[i]}`, 'Filled in for you.', 3500); MG.sfx.hint(); render(); save(); check();
}
MG.onKey(e => {
  if (!S) return;
  if (/^[1-9]$/.test(e.key)) { e.preventDefault(); put(+e.key, e.shiftKey || notesMode); }
  else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); put(0); }
  else if (e.key.startsWith('Arrow') && sel >= 0) {
    e.preventDefault();
    const d = { ArrowUp: -S.C, ArrowDown: S.C, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    let j = sel; do { j += d; } while (j >= 0 && j < S.R * S.C && S.blk[j] && Math.abs((j % S.C) - (sel % S.C)) < S.C);
    if (j >= 0 && j < S.R * S.C && !S.blk[j]) { sel = j; render(); }
  } else if (e.key === 'n' || e.key === 'N') MG.qs('[data-t="notes"]', tools).click();
  else if (e.key === 'u' || e.key === 'U') undo();
});
function load() {
  const g = MG.store.get(KEY);
  if (!g || g.v !== 1 || !LEVELS[g.level]) return false;
  S = g; api.setLevel(g.level); build(); api.begin({ resumed: true, elapsed: g.elapsed || 0 }); render(); return true;
}
MG.debug = { generate, LEVELS, core, specFor };
if (!load()) newGame(api.level);
})();
