/* =============================================================================
   Board and play for the Sudoku family (uses MG.latinCore and MG.shell)
   ============================================================================= */
(function () {
'use strict';
const MG = window.MG, core = MG.latinCore;
const { makeSolver, generate, V, pack, unpack, popcount } = core;
const HEX = '0123456789ABCDEF';
const MAX_LIVES = 3, MAX_HINTS = 3;

const STD = (d, box) => `<p>Fill every empty cell with a digit from ${d}.</p><ul><li>Each <b>row</b> contains every digit once.</li><li>Each <b>column</b> contains every digit once.</li><li>Each <b>${box}</b> contains every digit once.</li></ul>`;
const S9 = STD('1 to 9', '3×3 box');
const TAIL = `<p>Every puzzle is generated on the spot and proven to have exactly one solution.</p>
<p><b>Lifelines.</b> A wrong digit costs one of three hearts. Prefer to check at the end? Switch lifelines off in Settings.</p>
<p><b>Hints.</b> Three per puzzle. Each fills a cell and says why it holds that digit. Select a cell first to ask about it.</p>`;
const LAT = what => `<p>Fill the grid with ${what} from 1 to N, where N is the size of the grid.</p><ul><li>Each <b>row</b> and each <b>column</b> contains every ${what.replace(/s$/, '')} once.</li>`;
const META = {
  mini: { id: 'mini-sudoku', title: 'Mini Sudoku', chapter: 'sudoku', sum: 'Each row, column and box holds every digit once.', rules: STD('1 to 4 on the 4×4 board, or 1 to 6 on the 6×6 board', 'box') + TAIL },
  killer: { id: 'killer-sudoku', title: 'Killer Sudoku', chapter: 'sudoku', sum: 'Cage digits add up to the corner number and never repeat.', rules: S9 + '<p>Dashed <b>cages</b> add two rules:</p><ul><li>The digits in a cage add up to the small number in its corner.</li><li>A digit never repeats inside a cage.</li></ul><p class="tip">Handy facts: two cells summing to 3 are always 1 and 2, two cells summing to 17 are always 8 and 9, and every row, column and box adds up to 45.</p>' + TAIL },
  x: { id: 'sudoku-x', title: 'Sudoku X', chapter: 'sudoku', sum: 'Both long diagonals also hold 1 to 9 once.', rules: S9 + '<ul><li>Both long <b>diagonals</b> also contain 1 to 9 exactly once.</li></ul>' + TAIL },
  hyper: { id: 'hyper-sudoku', title: 'Hyper Sudoku', chapter: 'sudoku', sum: 'The four shaded windows also hold 1 to 9 once.', rules: S9 + '<ul><li>The four shaded <b>windows</b> also contain 1 to 9 exactly once.</li></ul>' + TAIL },
  jigsaw: { id: 'jigsaw-sudoku', title: 'Jigsaw Sudoku', chapter: 'sudoku', sum: 'Each outlined region holds 1 to 9 once.', rules: '<p>Fill every empty cell with a digit from 1 to 9.</p><ul><li>Each <b>row</b> contains 1 to 9 once.</li><li>Each <b>column</b> contains 1 to 9 once.</li><li>Each outlined <b>region</b> of nine cells contains 1 to 9 once. The regions are irregular shapes instead of boxes.</li></ul>' + TAIL },
  antiknight: { id: 'anti-knight-sudoku', title: 'Anti-Knight Sudoku', chapter: 'sudoku', sum: "Cells a knight's move apart never hold the same digit.", rules: S9 + "<ul><li>Two cells a chess <b>knight's move</b> apart (two steps one way, then one step sideways) can't hold the same digit.</li></ul>" + TAIL },
  antiking: { id: 'anti-king-sudoku', title: 'Anti-King Sudoku', chapter: 'sudoku', sum: 'Cells touching at a corner never hold the same digit.', rules: S9 + "<ul><li>Two cells that touch <b>diagonally</b>, one chess king's step apart, can't hold the same digit.</li></ul>" + TAIL },
  nonconsec: { id: 'non-consecutive-sudoku', title: 'Non-Consecutive Sudoku', chapter: 'sudoku', sum: 'Cells sharing an edge never hold consecutive digits.', rules: S9 + '<ul><li>Cells that share an edge can\'t hold <b>consecutive</b> digits: a 4 never sits next to a 3 or a 5.</li></ul>' + TAIL },
  evenodd: { id: 'even-odd-sudoku', title: 'Even-Odd Sudoku', chapter: 'sudoku', sum: 'Grey squares are even, grey circles are odd.', rules: S9 + '<ul><li>A grey <b>square</b> holds an even digit.</li><li>A grey <b>circle</b> holds an odd digit.</li></ul>' + TAIL },
  greater: { id: 'greater-than-sudoku', title: 'Greater-Than Sudoku', chapter: 'sudoku', sum: 'Each sign points to the smaller digit.', rules: S9 + '<ul><li>Inside each box, the sign between two neighbouring cells points to the <b>smaller</b> digit, just like &lt; and &gt;.</li></ul>' + TAIL },
  kropki: { id: 'kropki-sudoku', title: 'Kropki Sudoku', chapter: 'sudoku', sum: 'White dot: consecutive. Black dot: double. No dot: neither.', rules: S9 + '<ul><li>A <b>white dot</b> joins two consecutive digits, like 4 and 5.</li><li>A <b>black dot</b> joins two digits where one is double the other, like 3 and 6.</li><li><b>Every dot is shown</b>, so neighbours with no dot between them are neither consecutive nor double.</li><li>A 1 and a 2 can carry either dot.</li></ul>' + TAIL },
  thermo: { id: 'thermo-sudoku', title: 'Thermo Sudoku', chapter: 'sudoku', sum: 'Digits rise along each thermometer, bulb first.', rules: S9 + '<ul><li>Along each grey <b>thermometer</b>, digits strictly increase from the bulb to the far end.</li></ul>' + TAIL },
  arrow: { id: 'arrow-sudoku', title: 'Arrow Sudoku', chapter: 'sudoku', sum: 'Digits along an arrow add up to its circle.', rules: S9 + '<ul><li>The digits along an <b>arrow</b> add up to the digit in its circle.</li><li>Digits on one arrow may repeat, as long as rows, columns and boxes allow it.</li></ul>' + TAIL },
  samurai: { id: 'samurai-sudoku', title: 'Samurai Sudoku', chapter: 'sudoku', sum: 'Five overlapping sudokus share their corner boxes.', rules: '<p>Five 9×9 sudokus overlap: the middle grid shares a corner box with each of the four outer grids.</p><ul><li>In each of the five grids, every <b>row</b>, <b>column</b> and <b>3×3 box</b> contains 1 to 9 once.</li><li>A shared box belongs to two grids, so it has to work for both.</li></ul><p class="tip">On a phone, pinch to zoom. The overlaps are where logic flows from one grid into the next.</p>' + TAIL },
  giant: { id: 'hexadoku', title: 'Hexadoku', chapter: 'sudoku', sum: 'Each row, column and 4×4 box holds 0 to F once.', rules: '<p>Fill the 16×16 grid with the sixteen symbols <b>0 to 9 and A to F</b>.</p><ul><li>Each <b>row</b> contains every symbol once.</li><li>Each <b>column</b> contains every symbol once.</li><li>Each <b>4×4 box</b> contains every symbol once.</li></ul><p class="tip">On a keyboard, type 0–9 and A–F. Hold Shift to add a note.</p>' + TAIL },
  futoshiki: { id: 'futoshiki', title: 'Futoshiki', chapter: 'numbers', sum: 'Rows and columns hold every digit once. Signs point to the smaller digit.', rules: LAT('digits') + '<li>Every <b>sign</b> between two cells must hold: it points to the smaller digit.</li></ul>' + TAIL },
  calcudoku: { id: 'calcudoku', title: 'Calcudoku', chapter: 'numbers', sum: 'Each cage makes its target with its operation.', rules: LAT('digits') + '<li>Each bold <b>cage</b> shows a target and an operation: add (+), subtract (−), multiply (×) or divide (÷). Its digits must make the target with that operation.</li><li>For − and ÷, start from the larger digit: a two-cell cage marked 3− could hold 1 and 4.</li><li>A one-cell cage simply gives you its digit.</li><li>Digits may repeat inside a cage when they are not in the same row or column.</li></ul>' + TAIL },
  skyscrapers: { id: 'skyscrapers', title: 'Skyscrapers', chapter: 'numbers', sum: 'Clues count the towers you can see from that side.', rules: '<p>Every cell holds a skyscraper from 1 to N storeys, where N is the size of the grid.</p><ul><li>Each <b>row</b> and each <b>column</b> has one skyscraper of every height.</li><li>A number outside the grid says how many skyscrapers you can see from there, looking along that row or column. Taller buildings hide shorter ones behind them.</li></ul><p class="tip">A clue of 1 means the tallest tower is right next to it. Tap a clue to tick it off.</p>' + TAIL },
};
const KIND = { row: 'row', column: 'column', box: 'box', region: 'region', diagonal: 'diagonal', window: 'window', cage: 'cage' };
const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷', '=': '' };

function start(vid) {
  const def = V[vid], meta = META[vid];
  const levels = {};
  for (const k in def.levels) { const L = def.levels[k]; levels[k] = { name: L.name, rank: L.rank, desc: L.desc }; }
  const KEY = 'latin:' + vid;
  const hex = vid === 'giant';
  const sym = v => (hex ? HEX[v - 1] : String(v));
  let S = null, spec = null, solver = null, cells = [], N = 9, size = 81, total = [];
  let cellEls = [], keys = [], labelCells = new Set(), clueEls = new Map();
  const ui = { sel: -1, notes: false, focus: null, reveal: false, showErr: false };
  let focusTimer = 0;

  const api = MG.shell({
    id: meta.id, title: meta.title, chapter: meta.chapter, levels, metric: 'time', rules: meta.rules,
    newText: 'Pick a level. Each puzzle is generated on the spot and checked to have exactly one solution.',
    legend: `<dt>Arrow keys</dt><dd>Move around the board</dd><dt>${hex ? '<kbd>0</kbd> to <kbd>F</kbd>' : '<kbd>1</kbd> to <kbd>9</kbd>'}</dt><dd>Fill the selected cell</dd>
      <dt><kbd>Shift</kbd> + ${hex ? 'symbol' : 'digit'}</dt><dd>Add or remove a note</dd><dt><kbd>Backspace</kbd></dt><dd>Erase</dd>
      <dt><kbd>N</kbd> <kbd>H</kbd> <kbd>U</kbd> <kbd>P</kbd></dt><dd>Notes, hint, undo, pause</dd>`,
    settings: [
      { key: 'lifelines', label: 'Lifelines', desc: 'A wrong digit costs a heart. Off: nothing is checked until the grid is full.', def: true },
      { key: 'highlightPeers', label: 'Highlight related cells', desc: 'Shade cells that share a row, column or group with the selected cell.', def: true },
      { key: 'highlightSame', label: 'Highlight matching digits', desc: 'Mark every copy of the selected digit, notes included.', def: true },
      { key: 'autoNotes', label: 'Clear notes automatically', desc: 'Placing a digit removes it from notes in related cells.', def: true },
    ],
    onNew: lvl => newGame(lvl), onRestart: restart, onPause: () => render(), onHide: () => persist(),
    onSetting: k => { if (k === 'lifelines' && S && S.status === 'playing') { S.lifelines = api.pref('lifelines'); if (!S.lifelines) S.lives = MAX_LIVES; persist(); } render(); },
  });
  const pref = k => api.pref(k);

  /* ---------------- controls */
  const tools = MG.h('div', { class: 'tools' });
  tools.innerHTML = `<button type="button" class="tool" data-t="undo"><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button>
    <button type="button" class="tool" data-t="erase"><span class="ti">${MG.icon('erase')}</span><span>Erase</span></button>
    <button type="button" class="tool" data-t="notes" aria-pressed="false"><span class="ti">${MG.icon('pencil')}</span><span data-nl>Notes</span></button>
    <button type="button" class="tool" data-t="hint"><span class="ti">${MG.icon('bulb')}<span class="count" data-hc>3</span></span><span>Hint</span></button>`;
  const numpad = MG.h('div', { class: 'numpad' });
  const legend = MG.qs('.legend', api.controls);
  api.controls.insertBefore(tools, legend);
  api.controls.insertBefore(numpad, legend);
  const T = {}; MG.qsa('[data-t]', tools).forEach(b => { T[b.dataset.t] = b; });
  tools.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.disabled) return;
    ({ undo, erase, notes: toggleNotes, hint: useHint })[b.dataset.t]();
  });
  numpad.addEventListener('click', e => { const k = e.target.closest('.key'); if (k && !k.disabled) enterDigit(+k.dataset.d); });

  /* ---------------- board */
  function setSpec(sp) {
    spec = sp; solver = makeSolver(spec); cells = solver.cells; N = spec.N; size = spec.R * spec.C;
  }
  function buildBoard() {
    const { R, C } = spec;
    const rect = cells.length === size;
    api.size({ ar: C / R, chrome: N >= 16 ? 388 : 330, chromeL: 150, maxW: vid === 'samurai' ? 860 : hex ? 760 : 620 });
    api.board.innerHTML = '';
    const lb = MG.h('div', { class: 'lb' + (rect ? ' round' : '') });
    lb.style.setProperty('--cols', C);
    lb.style.setProperty('--nc', N <= 4 ? 2 : N <= 9 ? 3 : 4);
    lb.style.setProperty('--nf', N <= 4 ? .3 : N >= 16 ? .19 : .24);
    const grid = MG.h('div', { class: 'lb-grid', role: 'grid', 'aria-label': `${meta.title} board` });
    grid.style.gridTemplateColumns = `repeat(${C}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${R}, minmax(0, 1fr))`;
    const skyAt = new Map(spec.sky.filter(s => s.clue).map(s => [s.at, s]));
    const noteHTML = '<span class="notes">' + MG.range(N).map(k => `<i>${sym(k + 1)}</i>`).join('') + '</span>';
    cellEls = new Array(size); clueEls = new Map();
    for (let i = 0; i < size; i++) {
      if (spec.exist[i]) {
        const el = MG.h('button', { type: 'button', class: 'cell', tabindex: '-1', 'data-i': i, html: '<span class="fx"></span><span class="v"></span>' + noteHTML });
        cellEls[i] = { el, fx: el.children[0], v: el.children[1], notes: Array.from(el.children[2].children), last: {} };
        grid.appendChild(el);
      } else if (skyAt.has(i)) {
        const el = MG.h('div', { class: 'clue' + (S && S.ticks && S.ticks[i] ? ' done' : ''), 'data-c': i, title: 'Tap to tick off', text: String(skyAt.get(i).clue) });
        clueEls.set(i, el); grid.appendChild(el);
      } else grid.appendChild(MG.h('div', { class: 'void' }));
    }
    const ns = 'http://www.w3.org/2000/svg';
    const under = document.createElementNS(ns, 'svg'), over = document.createElementNS(ns, 'svg');
    for (const s of [under, over]) { s.setAttribute('viewBox', `0 0 ${C} ${R}`); s.setAttribute('preserveAspectRatio', 'none'); s.setAttribute('aria-hidden', 'true'); }
    under.setAttribute('class', 'lb-under'); over.setAttribute('class', 'lb-over');
    const art = drawRules(rect);
    under.innerHTML = art.under; over.innerHTML = art.over;
    lb.append(grid, under, over);
    api.board.appendChild(lb);
    buildNumpad();
  }
  const rc = i => [(i / spec.C) | 0, i % spec.C];
  const ctr = i => { const [r, c] = rc(i); return [c + 0.5, r + 0.5]; };
  const f = x => +x.toFixed(3);
  function drawRules(rect) {
    const { R, C } = spec, ex = i => i >= 0 && i < size && spec.exist[i], reg = spec.region;
    let under = '', over = '';
    if (spec.windows) for (const w of spec.windows) { const [r0, c0] = rc(Math.min(...w)); under += `<rect class="win" x="${c0}" y="${r0}" width="3" height="3"/>`; }
    if (spec.diag) under += `<line class="dg" x1="0" y1="0" x2="${C}" y2="${R}"/><line class="dg" x1="${C}" y1="0" x2="0" y2="${R}"/>`;
    for (const i of cells) if (spec.parity[i]) {
      const [x, y] = ctr(i);
      under += spec.parity[i] === 2 ? `<rect class="par" x="${f(x - .36)}" y="${f(y - .36)}" width=".72" height=".72" rx=".1"/>` : `<circle class="par" cx="${x}" cy="${y}" r=".38"/>`;
    }
    for (const p of spec.thermos) {
      const [bx, by] = ctr(p[0]);
      under += `<g class="thermo"><circle cx="${bx}" cy="${by}" r=".36"/><polyline points="${p.map(i => ctr(i).join(',')).join(' ')}"/></g>`;
    }
    for (const a of spec.arrows) {
      const [cx, cy] = ctr(a.circle), pts = a.cells.map(ctr);
      const [x1, y1] = pts[0], dx = x1 - cx, dy = y1 - cy, len = Math.hypot(dx, dy);
      const start = [cx + dx / len * .4, cy + dy / len * .4];
      const [ex1, ey1] = pts[pts.length - 1], [px, py] = pts.length > 1 ? pts[pts.length - 2] : [cx, cy];
      const ax = ex1 - px, ay = ey1 - py, al = Math.hypot(ax, ay), ux = ax / al, uy = ay / al;
      const tip = [ex1 + ux * .18, ey1 + uy * .18];
      const head = `M${f(tip[0] - ux * .22 - uy * .15)} ${f(tip[1] - uy * .22 + ux * .15)}L${f(tip[0])} ${f(tip[1])}L${f(tip[0] - ux * .22 + uy * .15)} ${f(tip[1] - uy * .22 - ux * .15)}`;
      under += `<circle class="ar" cx="${cx}" cy="${cy}" r=".4"/><polyline class="ar" points="${[start, ...pts, tip].map(p => p.map(f).join(',')).join(' ')}"/><path class="ar" d="${head}"/>`;
    }
    // region lines and outer frame
    let d = '';
    for (const i of cells) {
      const [r, c] = rc(i);
      const right = c + 1 < C ? i + 1 : -1, down = r + 1 < R ? i + C : -1;
      if (ex(right)) { if (reg[right] !== reg[i]) d += `M${c + 1} ${r}V${r + 1}`; } else if (!rect) d += `M${c + 1} ${r}V${r + 1}`;
      if (ex(down)) { if (reg[down] !== reg[i]) d += `M${c} ${r + 1}H${c + 1}`; } else if (!rect) d += `M${c} ${r + 1}H${c + 1}`;
      if (!rect && !(c > 0 && ex(i - 1))) d += `M${c} ${r}V${r + 1}`;
      if (!rect && !(r > 0 && ex(i - C))) d += `M${c} ${r}H${c + 1}`;
    }
    over += `<path class="rg" d="${d}"/>`;
    // cages
    labelCells = new Set();
    for (const cg of spec.cages) {
      const own = new Set(cg.cells), has = (r, c) => r >= 0 && c >= 0 && r < R && c < C && own.has(r * C + c);
      let p = '';
      if (spec.cageStyle === 'killer') {
        const k = .1;
        for (const i of cg.cells) {
          const [r, c] = rc(i);
          if (!has(r - 1, c)) p += `M${f(has(r, c - 1) ? (has(r - 1, c - 1) ? c - k : c) : c + k)} ${f(r + k)}H${f(has(r, c + 1) ? (has(r - 1, c + 1) ? c + 1 + k : c + 1) : c + 1 - k)}`;
          if (!has(r + 1, c)) p += `M${f(has(r, c - 1) ? (has(r + 1, c - 1) ? c - k : c) : c + k)} ${f(r + 1 - k)}H${f(has(r, c + 1) ? (has(r + 1, c + 1) ? c + 1 + k : c + 1) : c + 1 - k)}`;
          if (!has(r, c - 1)) p += `M${f(c + k)} ${f(has(r - 1, c) ? (has(r - 1, c - 1) ? r - k : r) : r + k)}V${f(has(r + 1, c) ? (has(r + 1, c - 1) ? r + 1 + k : r + 1) : r + 1 - k)}`;
          if (!has(r, c + 1)) p += `M${f(c + 1 - k)} ${f(has(r - 1, c) ? (has(r - 1, c + 1) ? r - k : r) : r + k)}V${f(has(r + 1, c) ? (has(r + 1, c + 1) ? r + 1 + k : r + 1) : r + 1 - k)}`;
        }
        over += `<path class="kc" d="${p}"/>`;
      } else {
        for (const i of cg.cells) {
          const [r, c] = rc(i);
          if (!has(r - 1, c)) p += `M${c} ${r}H${c + 1}`;
          if (!has(r + 1, c)) p += `M${c} ${r + 1}H${c + 1}`;
          if (!has(r, c - 1)) p += `M${c} ${r}V${r + 1}`;
          if (!has(r, c + 1)) p += `M${c + 1} ${r}V${r + 1}`;
        }
        over += `<path class="cc" d="${p}"/>`;
      }
      const first = Math.min(...cg.cells), [r0, c0] = rc(first);
      labelCells.add(first);
      const text = spec.cageStyle === 'killer' ? String(cg.target) : cg.target + OPS[cg.op];
      over += `<text class="lbl" x="${f(c0 + .08)}" y="${f(r0 + .3)}">${text}</text>`;
    }
    const edge = (a, b) => { const [r, c] = rc(a); return b === a + 1 ? [c + 1, r + .5, 'h'] : [c + .5, r + 1, 'v']; };
    if (spec.signs) for (const [a, b] of spec.signs) {
      const rel = spec.rels.find(x => x[0] === a && x[1] === b);
      if (!rel) continue;
      const smallerFirst = rel[2] === core.REL.LT;   // a < b: the tip points at a
      const [x, y, o] = edge(a, b), s = .12, t = .07;
      let pts;
      if (o === 'h') pts = smallerFirst ? [[x + t, y - s], [x - t, y], [x + t, y + s]] : [[x - t, y - s], [x + t, y], [x - t, y + s]];
      else pts = smallerFirst ? [[x - s, y + t], [x, y - t], [x + s, y + t]] : [[x - s, y - t], [x, y + t], [x + s, y - t]];
      const ps = pts.map(p => p.map(f).join(',')).join(' ');
      over += `<polyline class="sgh" points="${ps}"/><polyline class="sg" points="${ps}"/>`;
    }
    if (spec.dots) for (const [a, b, kind] of spec.dots) { const [x, y] = edge(a, b); over += `<circle class="dot ${kind}" cx="${f(x)}" cy="${f(y)}" r=".1"/>`; }
    return { under, over };
  }
  function buildNumpad() {
    numpad.innerHTML = '';
    keys = [];
    numpad.style.setProperty('--keys', N >= 16 ? 8 : N);
    numpad.style.setProperty('--keys-l', N >= 16 ? 4 : N === 4 ? 2 : N === 7 ? 4 : 3);
    numpad.classList.toggle('dense', N >= 16);
    for (let d = 1; d <= N; d++) {
      const el = MG.h('button', { type: 'button', class: 'key', 'data-d': d, html: `<span class="kd">${sym(d)}</span><span class="kc"></span>` });
      numpad.appendChild(el);
      keys[d] = { el, count: el.children[1] };
    }
  }

  /* ---------------- state helpers */
  const isLocked = i => !!S.givens[i] || !!S.hinted[i] || (S.lifelines && S.values[i] !== 0 && S.values[i] === S.sol[i]);
  const isSolved = () => cells.every(i => S.values[i] === S.sol[i]);
  const isFull = () => cells.every(i => S.values[i]);
  const toSolve = () => cells.reduce((n, i) => n + (S.givens[i] ? 0 : 1), 0);
  const solvedCount = () => cells.reduce((n, i) => n + (!S.givens[i] && S.values[i] === S.sol[i] ? 1 : 0), 0);
  const placedCount = d => cells.reduce((n, i) => n + (S.values[i] === d && S.sol[i] === d ? 1 : 0), 0);
  const clearFocus = () => { ui.focus = null; clearTimeout(focusTimer); };
  const cellName = i => { const [r, c] = rc(i); return `row ${r + 1 - (spec.sky.length ? 1 : 0)}, column ${c + 1 - (spec.sky.length ? 1 : 0)}`; };

  /* ---------------- render */
  function render() {
    if (!S || !cellEls.length) return;
    const sel = ui.sel, selV = sel >= 0 ? S.values[sel] : 0;
    const showSol = S.status === 'lost' && ui.reveal;
    const checking = S.lifelines || ui.showErr;
    const clash = new Uint8Array(size);
    if (!showSol && checking) for (const i of cells) {
      const v = S.values[i];
      if (!v || v === S.sol[i]) continue;
      for (const p of solver.peers[i]) if (S.values[p] === v) clash[p] = 1;
    }
    const peerSet = sel >= 0 && pref('highlightPeers') ? new Set(solver.peers[sel]) : null;
    const same = pref('highlightSame'), zone = ui.focus ? ui.focus.zone : null;
    for (const i of cells) {
      const c = cellEls[i], last = c.last;
      const given = !!S.givens[i], v = S.values[i], wrong = v !== 0 && v !== S.sol[i] && checking;
      let shown = v, revealed = false;
      if (showSol && v !== S.sol[i]) { shown = S.sol[i]; revealed = true; }
      const noteMask = shown ? 0 : S.notes[i];
      if (last.shown !== shown) { c.v.textContent = shown ? sym(shown) : ''; last.shown = shown; }
      if (last.notes !== noteMask || last.selV !== selV) {
        for (let d = 1; d <= N; d++) { const on = (noteMask >> d) & 1; c.notes[d - 1].className = on ? (same && selV === d ? 'on match' : 'on') : ''; }
        last.notes = noteMask; last.selV = selV;
      }
      let cls = 'cell' + (labelCells.has(i) ? ' lbl' : '');
      if (revealed) cls += ' revealed'; else if (given) cls += ' given'; else if (v) cls += S.hinted[i] ? ' hinted' : wrong ? ' wrong' : ' user';
      if (sel >= 0) {
        if (i === sel) cls += ' selected'; else if (peerSet && peerSet.has(i)) cls += ' peer';
        if (same && selV && i !== sel && shown === selV) cls += ' same';
      }
      if (clash[i]) cls += ' clash';
      if (zone && zone.has(i)) cls += ' zone';
      if (ui.focus && ui.focus.i === i) cls += ' target';
      if (last.cls !== cls) { c.el.className = cls; last.cls = cls; }
      const tab = i === (sel >= 0 ? sel : cells[0]) ? 0 : -1;
      if (last.tab !== tab) { c.el.tabIndex = tab; last.tab = tab; }
      const label = `${cellName(i)}: ${shown ? sym(shown) + (given ? ', given' : revealed ? ', from the solution' : wrong ? ', wrong' : '') : 'empty'}`;
      if (last.label !== label) { c.el.setAttribute('aria-label', label); last.label = label; }
    }
    renderChrome();
  }
  function renderChrome() {
    if (!S) return;
    api.hearts(S.lives, S.lifelines ? MAX_LIVES : 0);
    const playing = api.canPlay() && S.status === 'playing', sel = ui.sel;
    T.undo.disabled = !playing || !S.history.length;
    T.erase.disabled = !playing || sel < 0 || isLocked(sel) || (!S.values[sel] && !S.notes[sel]);
    T.notes.disabled = !playing;
    T.notes.setAttribute('aria-pressed', String(ui.notes));
    MG.qs('[data-nl]', tools).textContent = ui.notes ? 'Notes on' : 'Notes';
    T.hint.disabled = !playing;
    T.hint.classList.toggle('spent', S.hintsLeft <= 0);
    MG.qs('[data-hc]', tools).textContent = String(S.hintsLeft);
    const selV = sel >= 0 ? S.values[sel] : 0;
    for (let d = 1; d <= N; d++) {
      const k = keys[d], left = total[d] - placedCount(d);
      k.count.textContent = left > 0 ? String(left) : '';
      k.el.classList.toggle('active', !!selV && selV === d);
      k.el.disabled = !playing || (S.lifelines && left <= 0);
      k.el.setAttribute('aria-label', `${ui.notes ? 'Note' : 'Place'} ${sym(d)}`);
    }
    numpad.classList.toggle('pencil', ui.notes);
    const tot = toSolve(), solved = solvedCount();
    if (S.status === 'won') api.progress(`Solved in ${MG.fmtTime(api.timer.elapsed)}`, 'Start a new puzzle when you are ready.', null, 0, 'done');
    else if (S.status === 'lost') api.progress('Out of lifelines', ui.reveal ? 'The solution is filled in grey.' : 'Retry this puzzle or start a new one.', null, 0, 'lost');
    else api.progress(`${MG.plural(tot - (S.lifelines ? solved : cells.filter(i => !S.givens[i] && S.values[i]).length), 'cell')} to go`, meta.sum, S.lifelines ? (tot ? solved / tot : 0) : null, Math.min(tot, 60));
  }

  /* ---------------- effects */
  const sweep = (list, origin, step) => {
    if (MG.reduced()) return;
    const [r0, c0] = rc(origin);
    for (const i of list) { const [r, c] = rc(i); const d = (Math.abs(r - r0) + Math.abs(c - c0)) * step; cellEls[i].fx.style.setProperty('--d', d + 'ms'); MG.replay(cellEls[i].fx, 'sweep', 1000 + d); }
  };
  const winSweep = () => { if (MG.reduced()) return; for (const i of cells) { const [r, c] = rc(i); const d = r * (spec.R > 12 ? 30 : 80) + c * 22; cellEls[i].fx.style.setProperty('--d', d + 'ms'); MG.replay(cellEls[i].fx, 'sweep', 1000 + d); } };
  const intro = () => { if (MG.reduced()) return; for (const i of cells) { if (!S.values[i]) continue; const [r, c] = rc(i); const d = (r + c) * (spec.R > 12 ? 8 : 18); cellEls[i].v.style.setProperty('--d', d + 'ms'); MG.replay(cellEls[i].v, 'enter', 600 + d); } };
  const doneGroups = i => spec.groups.filter(g => g.length === N && g.includes(i) && g.every(k => S.values[k] === S.sol[k]));

  /* ---------------- game flow */
  const fresh = (level, r) => ({
    v: 1, level, sol: r.sol, givens: r.givens, values: r.givens.slice(), notes: new Array(size).fill(0), hinted: new Array(size).fill(0),
    lives: MAX_LIVES, hintsLeft: MAX_HINTS, mistakes: 0, hintsUsed: 0, status: 'playing', history: [], clues: r.clues, lifelines: !!pref('lifelines'), ticks: {},
  });
  function countTotals() { total = new Array(N + 1).fill(0); for (const i of cells) total[S.sol[i]]++; }
  async function newGame(level) {
    api.busy(true, `Building a ${levels[level].name.toLowerCase()} puzzle with exactly one solution.`);
    ui.sel = -1; ui.reveal = false; ui.notes = false; ui.showErr = false; clearFocus();
    await MG.sleep(40);
    const t0 = performance.now();
    let r;
    try { r = await generate(vid, level); } catch (e) { api.busy(false); MG.toast('That puzzle failed to build. Try again.'); return; }
    const wait = 420 - (performance.now() - t0);
    if (wait > 0) await MG.sleep(wait);
    setSpec(r.spec);
    S = fresh(level, r);
    countTotals();
    buildBoard();
    api.begin();
    persist(); render(); intro();
    MG.announce(`New ${levels[level].name} puzzle with ${S.clues} clues.`);
  }
  function restart() {
    if (!S) return;
    Object.assign(S, { values: S.givens.slice(), notes: new Array(size).fill(0), hinted: new Array(size).fill(0), lives: MAX_LIVES, hintsLeft: MAX_HINTS, mistakes: 0, hintsUsed: 0, status: 'playing', history: [], lifelines: !!pref('lifelines') });
    ui.sel = -1; ui.reveal = false; ui.showErr = false; clearFocus();
    clueEls.forEach(el => el.classList.remove('done'));
    api.begin(); persist(); render(); intro(); MG.toast('Puzzle restarted');
  }
  function persist() {
    if (!S || !spec) return;
    if (S.status !== 'playing') { MG.store.del(KEY); return; }
    MG.store.set(KEY, Object.assign({}, S, { spec: pack(spec), history: S.history.slice(-250), elapsed: api.timer.elapsed }));
  }
  function load() {
    const g = MG.store.get(KEY);
    if (!g || g.v !== 1 || !levels[g.level] || g.status !== 'playing' || !g.spec) return false;
    try {
      const sp = unpack(g.spec), n = sp.R * sp.C;
      if (!['sol', 'givens', 'values', 'notes', 'hinted'].every(k => Array.isArray(g[k]) && g[k].length === n)) return false;
      setSpec(sp);
      g.history = Array.isArray(g.history) ? g.history : [];
      S = g; delete S.spec;
      countTotals();
      api.setLevel(g.level);
      buildBoard();
      api.begin({ resumed: true, elapsed: +g.elapsed || 0 });
      api.dirty = S.history.length > 0;
      render();
      api.coach('info', 'Welcome back', 'Your puzzle was saved on this device, right down to the clock.', 4200);
      return true;
    } catch (e) { return false; }
  }

  function select(i, focus) {
    if (!S || api.isBusy || api.paused) return;
    if (S.status !== 'playing') i = -1;
    if (ui.focus && i !== ui.focus.i) clearFocus();
    ui.sel = i; render();
    if (focus && i >= 0) cellEls[i].el.focus({ preventScroll: true });
  }
  function move(dr, dc) {
    if (!api.canPlay()) return;
    if (ui.sel < 0) { select(cells[Math.floor(cells.length / 2)], true); return; }
    let [r, c] = rc(ui.sel);
    for (let k = 0; k < Math.max(spec.R, spec.C); k++) {
      r = (r + dr + spec.R) % spec.R; c = (c + dc + spec.C) % spec.C;
      const i = r * spec.C + c;
      if (spec.exist[i]) { select(i, true); return; }
    }
  }
  function mistakeReason(i, d) {
    for (let k = 0; k < spec.groups.length; k++) {
      const g = spec.groups[k];
      if (g.includes(i) && g.some(j => j !== i && S.values[j] === d)) { const w = KIND[spec.kinds[k]] || 'group'; return `This ${w} already has a ${sym(d)}.`; }
    }
    return `Nothing clashes yet, but with a ${sym(d)} here the puzzle has no solution.`;
  }
  function enterDigit(d, asNote) {
    if (!api.canPlay() || !S || S.status !== 'playing') return;
    if (asNote === undefined) asNote = ui.notes;
    const i = ui.sel;
    if (i < 0) { MG.toast('Select a cell first'); return; }
    if (isLocked(i)) { MG.replay(cellEls[i].v, 'nudge', 300); return; }
    if (asNote) { toggleNote(i, d); return; }
    if (S.values[i] === d) return;
    if (S.lifelines && placedCount(d) >= total[d]) { MG.toast(`Every ${sym(d)} is already placed`); return; }
    clearFocus();
    const entry = { i, v: S.values[i], n: S.notes[i], p: [] };
    S.values[i] = d; S.notes[i] = 0; S.history.push(entry); api.dirty = true; ui.showErr = false;
    const ok = d === S.sol[i];
    if (ok || !S.lifelines) {
      if (pref('autoNotes')) { const b = 1 << d; for (const p of solver.peers[i]) if (!S.values[p] && (S.notes[p] & b)) { entry.p.push([p, S.notes[p]]); S.notes[p] &= ~b; } }
      api.clearCoach();
      MG.replay(cellEls[i].v, 'ink', 300); MG.sfx.place();
      if (ok) { const done = doneGroups(i); if (done.length && S.lifelines) { done.forEach(g => sweep(g, i, 45)); MG.sfx.unit(); } }
      if (isSolved()) { finishWin(); return; }
      if (!S.lifelines && isFull()) {
        ui.showErr = true;
        const n = cells.filter(k => S.values[k] !== S.sol[k]).length;
        api.coach('mistake', 'Not quite', `The grid is full, but ${MG.plural(n, 'cell')} ${n === 1 ? 'is' : 'are'} wrong. They're marked in red.`, 7000);
        MG.sfx.wrong();
      }
    } else {
      S.mistakes++; S.lives = Math.max(0, S.lives - 1);
      MG.replay(cellEls[i].v, 'shake', 450); MG.sfx.wrong(); MG.buzz(70); api.breakHeart(S.lives);
      const why = mistakeReason(i, d), left = S.lives ? `${MG.plural(S.lives, 'lifeline')} left.` : 'No lifelines left.';
      api.coach('mistake', `That cell can't be ${sym(d)}`, `${why} ${left}`, 5200);
      MG.announce(`Wrong. ${why} ${left}`);
      if (!S.lives) { finishLoss(); return; }
    }
    persist(); render();
  }
  function toggleNote(i, d) {
    clearFocus();
    S.history.push({ i, v: S.values[i], n: S.notes[i], p: [] });
    if (S.values[i]) S.values[i] = 0;
    S.notes[i] ^= 1 << d; api.dirty = true;
    MG.sfx.note(); persist(); render();
  }
  function erase() {
    if (!api.canPlay() || S.status !== 'playing') return;
    const i = ui.sel;
    if (i < 0) { MG.toast('Select a cell first'); return; }
    if (isLocked(i)) { MG.replay(cellEls[i].v, 'nudge', 300); return; }
    if (!S.values[i] && !S.notes[i]) return;
    clearFocus();
    S.history.push({ i, v: S.values[i], n: S.notes[i], p: [] });
    S.values[i] = 0; S.notes[i] = 0; ui.showErr = false;
    MG.sfx.note(); persist(); render();
  }
  function undo() {
    if (!api.canPlay() || S.status !== 'playing') return;
    const e = S.history.pop();
    if (!e) return;
    S.values[e.i] = e.v; S.notes[e.i] = e.n;
    for (const [p, n] of e.p) S.notes[p] = n;
    clearFocus(); ui.sel = e.i; ui.showErr = false;
    MG.sfx.note(); persist(); render();
    cellEls[e.i].el.focus({ preventScroll: true });
  }
  function toggleNotes() {
    if (!S || api.isBusy || S.status !== 'playing') return;
    ui.notes = !ui.notes; renderChrome(); MG.announce(ui.notes ? 'Notes on' : 'Notes off');
  }
  function useHint() {
    if (!api.canPlay() || S.status !== 'playing') return;
    if (S.hintsLeft <= 0) { api.coach('info', 'No hints left', `All ${MAX_HINTS} hints are used for this puzzle. Notes can carry you the rest of the way.`, 4200); MG.replay(T.hint, 'shake-tool', 400); return; }
    const g = new Int8Array(size);
    for (const i of cells) if (S.values[i] && S.values[i] === S.sol[i]) g[i] = S.values[i];
    const st = solver.start(g), sel = ui.sel, target = sel >= 0 && !isLocked(sel) ? sel : -1;
    const dist = (a, b) => { const [r1, c1] = rc(a), [r2, c2] = rc(b); return Math.abs(r1 - r2) + Math.abs(c1 - c2); };
    const near = list => (sel < 0 ? MG.pick(list) : list.reduce((a, b) => (dist(b, sel) < dist(a, sel) ? b : a)));
    let at = -1, kind = 'reveal', zone = [];
    if (st) {
      const hs = solver.hidden(st.cand, st.val, true);
      const forced = cells.filter(i => !g[i] && st.val[i]);
      if (target >= 0) {
        at = target;
        kind = st.val[target] ? 'forced' : hs && hs !== -1 && hs.i === target ? 'hidden' : 'later';
        if (kind === 'hidden') zone = hs.cells;
      } else if (forced.length) { at = near(forced); kind = 'forced'; }
      else if (hs && hs !== -1) { at = hs.i; kind = 'hidden'; zone = hs.cells; }
      if (at < 0) { let bn = 99; for (const i of cells) if (!g[i]) { const n = popcount(st.cand[i]); if (n < bn) { bn = n; at = i; } } }
      if (kind === 'forced') zone = Array.from(solver.peers[at]);
      if (kind === 'hidden' && hs && hs.i === at) var unitWord = KIND[hs.kind] || 'group';
    }
    if (at < 0) at = target >= 0 ? target : cells.find(i => S.values[i] !== S.sol[i]);
    const prev = S.values[at], wasWrong = prev !== 0 && prev !== S.sol[at], d = S.sol[at];
    S.values[at] = d; S.notes[at] = 0; S.hinted[at] = 1; S.hintsLeft--; S.hintsUsed++; api.dirty = true;
    S.history = S.history.filter(e => e.i !== at);
    if (pref('autoNotes')) { const b = 1 << d; for (const p of solver.peers[at]) S.notes[p] &= ~b; }
    ui.sel = at; ui.focus = { i: at, zone: new Set(zone) };
    clearTimeout(focusTimer); focusTimer = setTimeout(() => { ui.focus = null; render(); }, 7000);
    let text;
    if (kind === 'forced') text = `Every other ${hex ? 'symbol' : 'digit'} is ruled out for this cell by what's already placed and the puzzle's rules, so it must be ${sym(d)}.`;
    else if (kind === 'hidden') text = `This ${unitWord} needs a ${sym(d)}, and this is the only cell that can take it.`;
    else if (kind === 'later') text = `This cell isn't forced yet. Fill in the cells that are, and it follows: ${sym(d)}.`;
    else text = `Logic needs a longer chain here, so here is the answer: ${sym(d)}.`;
    if (wasWrong) text = `The ${sym(prev)} here was wrong. ${text}`;
    api.coach('hint', `Hint: ${sym(d)}`, `${text} ${MG.plural(S.hintsLeft, 'hint')} left.`, 12000);
    MG.replay(cellEls[at].v, 'ink', 300); MG.sfx.hint();
    MG.announce(`Hint: ${cellName(at)} is ${sym(d)}. ${text}`);
    doneGroups(at).forEach(gp => sweep(gp, at, 45));
    if (isSolved()) { finishWin(); return; }
    persist(); render();
    cellEls[at].el.focus({ preventScroll: true });
  }
  function finishWin() {
    S.status = 'won'; ui.sel = -1; clearFocus();
    const prev = api.stats.get(api.level).best, el = api.timer.elapsed, best = !prev || el < prev ? el : prev;
    api.win({ sub: `${levels[S.level].name} puzzle, ${S.clues} clues`,
      facts: [[S.lifelines ? `${S.mistakes} of ${MAX_LIVES}` : 'Off', 'Lifelines used'], [`${S.hintsUsed} of ${MAX_HINTS}`, 'Hints used'], [MG.fmtTime(best), 'Best time']] });
    persist(); render(); winSweep();
  }
  function finishLoss() {
    S.status = 'lost'; ui.sel = -1; clearFocus();
    const left = toSolve() - solvedCount();
    api.lose({ title: 'Out of lifelines', sub: `${MAX_LIVES} wrong digits with ${MG.plural(left, 'cell')} still to fill. The same puzzle is ready for another try.`,
      actions: [{ label: 'Show solution', act: () => { ui.reveal = true; render(); } }] });
    persist(); render();
  }

  /* ---------------- input */
  api.board.addEventListener('pointerdown', e => {
    const el = e.target.closest('.cell');
    if (el) { if (e.pointerType === 'mouse' && e.button !== 0) return; select(+el.dataset.i, true); return; }
    const cl = e.target.closest('.clue');
    if (cl) { cl.classList.toggle('done'); MG.sfx.tap(); if (S) { S.ticks = S.ticks || {}; S.ticks[cl.dataset.c] = cl.classList.contains('done') ? 1 : 0; } }
  });
  api.board.addEventListener('focusin', e => { const el = e.target.closest('.cell'); if (el && api.canPlay() && +el.dataset.i !== ui.sel) select(+el.dataset.i, false); });
  MG.onKey(e => {
    if (!S) return;
    const k = e.key;
    if (e.ctrlKey || e.metaKey) { if (k === 'z' || k === 'Z') { e.preventDefault(); undo(); } return; }
    if (e.altKey) return;
    let d = 0;
    if (hex) { const u = k.length === 1 ? k.toUpperCase() : ''; const ix = u ? HEX.indexOf(u) : -1; if (ix >= 0) d = ix + 1; }
    else { const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || ''); const n = m ? +m[1] : /^[1-9]$/.test(k) ? +k : 0; if (n && n <= N) d = n; }
    if (d) { e.preventDefault(); enterDigit(d, e.shiftKey ? true : undefined); return; }
    switch (k) {
      case 'ArrowUp': e.preventDefault(); move(-1, 0); break;
      case 'ArrowDown': e.preventDefault(); move(1, 0); break;
      case 'ArrowLeft': e.preventDefault(); move(0, -1); break;
      case 'ArrowRight': e.preventDefault(); move(0, 1); break;
      case 'Backspace': case 'Delete': e.preventDefault(); erase(); break;
      case '0': if (!hex) { e.preventDefault(); erase(); } break;
      case 'n': case 'N': toggleNotes(); break;
      case 'h': case 'H': useHint(); break;
      case 'u': case 'U': undo(); break;
      case 'Escape': select(-1, false); break;
      default: break;
    }
  });

  MG.debug = { get S() { return S; }, get spec() { return spec; }, select, enterDigit, useHint };
  if (!load()) newGame(api.level);
}

MG.latin = { start, META };
})();
