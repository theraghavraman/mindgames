/* Minesweeper: first tap is always safe, long-press or right-click to flag, tap a number to chord */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.ms { position: absolute; inset: 0; display: grid; gap: 2px; padding: 3px; background: var(--frame); border-radius: 10px; --cw: calc(100cqi / var(--cols)); touch-action: manipulation; -webkit-touch-callout: none; }
.ms b { display: grid; place-items: center; min-width: 0; border-radius: 3px; background: var(--sheet-2); box-shadow: inset 0 -2px 0 rgba(20, 30, 50, .12), inset 0 1px 0 rgba(255, 255, 255, .5); font-size: calc(var(--cw) * .56); font-weight: 820; font-variation-settings: 'CASL' 1; cursor: pointer; transition: background-color .12s; }
@media (hover: hover) { .ms b:not(.o):hover { background: var(--ch-soft); } }
.ms b.o { background: var(--sheet); box-shadow: none; cursor: default; }
.ms b.f::after, .ms b.xf::after { content: ""; width: 58%; height: 58%; background: var(--red); clip-path: polygon(22% 6%, 92% 30%, 22% 54%, 22% 100%, 8% 100%, 8% 6%); }
.ms b.xf { background: var(--sheet); } .ms b.xf::after { background: var(--pencil); }
.ms b.m { background: var(--red-soft); } .ms b.m::after { content: ""; width: 46%; height: 46%; border-radius: 50%; background: var(--graphite); box-shadow: 0 0 0 calc(var(--cw) * .08) var(--red-soft), 0 0 0 calc(var(--cw) * .12) var(--graphite); }
.ms b.boom { background: var(--red); } .ms b.boom::after { box-shadow: none; }
.ms b.pop { animation: pop .25s ease-out; }
.ms .n1 { color: var(--pen); } .ms .n2 { color: var(--green); } .ms .n3 { color: var(--red); } .ms .n4 { color: var(--c-brain-deep); }
.ms .n5 { color: var(--c-numbers-deep); } .ms .n6 { color: var(--c-duels-deep); } .ms .n7 { color: var(--graphite); } .ms .n8 { color: var(--pencil); }
`);
const LEVELS = {
  easy: { name: 'Beginner', rank: 1, r: 9, c: 9, m: 10, desc: '9×9 board with 10 mines.' },
  medium: { name: 'Intermediate', rank: 2, r: 16, c: 16, m: 40, desc: '16×16 board with 40 mines.' },
  hard: { name: 'Expert', rank: 3, r: 16, c: 30, m: 99, desc: '30×16 board with 99 mines.' },
};
const RULES = `<p>Uncover every cell that doesn't hide a mine.</p><ul>
<li>Tap a cell to uncover it. A number tells you how many of its eight neighbours hide a mine.</li>
<li>Flag a cell you're sure is a mine: long-press it, right-click it, or switch on <b>Flag mode</b>.</li>
<li>Tap a number whose mines are all flagged to uncover all of its other neighbours at once.</li>
<li>Your first tap is always safe and opens up an area.</li></ul><p class="tip">The clock starts with your first tap.</p>`;
let G = null, flagMode = false, els = [];
const api = MG.shell({ id: 'minesweeper', title: 'Minesweeper', chapter: 'logic', levels: LEVELS, metric: 'time', rules: RULES,
  newText: 'Pick a board. Your first tap is always safe.', onNew: newGame, size: { ar: 1, chrome: 270, maxW: 620 } });
const tools = MG.h('div', { class: 'tools', style: { '--tools': 1 } });
tools.innerHTML = `<button type="button" class="tool" data-flag aria-pressed="false"><span class="ti">${MG.icon('flag')}</span><span>Flag mode</span></button>`;
api.controls.appendChild(tools);
const flagBtn = MG.qs('[data-flag]', tools);
flagBtn.addEventListener('click', () => { flagMode = !flagMode; flagBtn.setAttribute('aria-pressed', String(flagMode)); MG.sfx.tap(); });
api.mid.innerHTML = `<span class="pill" title="Mines left">${MG.icon('bomb', 'sm')}<b data-left>0</b></span>`;
const leftEl = MG.qs('[data-left]', api.mid);

const nb = i => { const r = (i / G.C) | 0, c = i % G.C, o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const r2 = r + dr, c2 = c + dc; if (r2 >= 0 && c2 >= 0 && r2 < G.R && c2 < G.C) o.push(r2 * G.C + c2); } return o; };
function newGame(level) {
  const L = LEVELS[level];
  let R = L.r, C = L.c;
  if (C > R && window.innerWidth < window.innerHeight) [R, C] = [C, R];
  G = { R, C, M: L.m, mine: new Uint8Array(R * C), open: new Uint8Array(R * C), flag: new Uint8Array(R * C), num: new Uint8Array(R * C), placed: false, opened: 0, flags: 0, over: false };
  api.size({ ar: C / R, chrome: 270, chromeL: 150, maxW: C > 16 ? 960 : 620, minW: C > R ? 300 : 232 });
  const box = MG.h('div', { class: 'ms', role: 'grid', 'aria-label': 'Minefield' });
  box.style.setProperty('--cols', C);
  box.style.gridTemplateColumns = `repeat(${C}, minmax(0, 1fr))`;
  box.style.gridTemplateRows = `repeat(${R}, minmax(0, 1fr))`;
  els = [];
  for (let i = 0; i < R * C; i++) { const b = MG.h('b', { 'data-i': i, role: 'gridcell', 'aria-label': 'Hidden' }); els.push(b); box.appendChild(b); }
  api.board.innerHTML = ''; api.board.appendChild(box);
  bind(box);
  api.begin(); api.timer.stop();
  api.progress('Tap any cell to start', 'Your first tap is always safe. Long-press or right-click to flag a mine.');
  render();
}
function place(safe) {
  const ban = new Set([safe, ...nb(safe)]);
  const pool = MG.shuffle(MG.range(G.R * G.C).filter(i => !ban.has(i)));
  for (let k = 0; k < G.M; k++) G.mine[pool[k]] = 1;
  for (let i = 0; i < G.R * G.C; i++) G.num[i] = nb(i).reduce((n, j) => n + G.mine[j], 0);
  G.placed = true; api.timer.start();
}
function reveal(i) {
  if (G.flag[i] || G.open[i]) return;
  if (!G.placed) place(i);
  if (G.mine[i]) { lose(i); return; }
  const st = [i];
  while (st.length) {
    const k = st.pop();
    if (G.open[k] || G.flag[k]) continue;
    G.open[k] = 1; G.opened++;
    if (!G.num[k]) for (const j of nb(k)) if (!G.open[j] && !G.mine[j]) st.push(j);
  }
  MG.sfx.place();
}
function chord(i) {
  const n = nb(i), f = n.filter(j => G.flag[j]).length;
  if (!G.num[i] || f !== G.num[i]) { MG.replay(els[i], 'nudge', 300); return; }
  for (const j of n) if (!G.open[j] && !G.flag[j]) { reveal(j); if (G.over) return; }
}
function toggleFlag(i) {
  if (G.open[i] || G.over) return;
  G.flag[i] ^= 1; G.flags += G.flag[i] ? 1 : -1;
  MG.sfx.flip(); MG.buzz(15); MG.replay(els[i], 'pop', 260);
}
function act(i, flag) {
  if (!api.canPlay() || G.over) return;
  if (flag) toggleFlag(i); else if (G.open[i]) chord(i); else reveal(i);
  api.dirty = true;
  if (!G.over && G.opened === G.R * G.C - G.M) win();
  render();
}
function win() {
  G.over = true;
  for (let i = 0; i < G.R * G.C; i++) if (G.mine[i] && !G.flag[i]) { G.flag[i] = 1; G.flags++; }
  const L = LEVELS[api.level], prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ title: 'Field cleared', sub: `${L.name}: ${G.C}×${G.R} with ${G.M} mines`, facts: [[`${G.C}×${G.R}`, 'Board'], [G.M, 'Mines'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
}
function lose(i) {
  G.over = true;
  for (let k = 0; k < G.R * G.C; k++) if (G.mine[k] && !G.flag[k]) G.open[k] = 2;
  els[i].classList.add('boom'); G.boom = i;
  MG.replay(api.board, 'shake', 450);
  api.lose({ title: 'Boom', sub: 'That cell hid a mine. Every mine is shown now, and wrong flags are greyed out.' });
}
function render() {
  for (let i = 0; i < G.R * G.C; i++) {
    const b = els[i];
    let cls = '', txt = '', label = 'Hidden';
    if (G.open[i] === 2 || (G.over && G.mine[i] && api.status === 'lost' && !G.flag[i])) { cls = 'o m' + (G.boom === i ? ' boom' : ''); label = 'Mine'; }
    else if (G.open[i]) { cls = 'o' + (G.num[i] ? ' n' + G.num[i] : ''); txt = G.num[i] || ''; label = G.num[i] ? `${G.num[i]} mines around` : 'Empty'; }
    else if (G.flag[i]) { cls = G.over && api.status === 'lost' && !G.mine[i] ? 'xf' : 'f'; label = 'Flagged'; }
    if (b.className !== cls) b.className = cls;
    if (b.textContent !== String(txt)) b.textContent = txt;
    b.setAttribute('aria-label', label);
  }
  leftEl.textContent = String(G.M - G.flags);
  if (G.placed && !G.over) api.progress(`${G.R * G.C - G.M - G.opened} safe cells left`, flagMode ? 'Flag mode is on: taps plant flags.' : 'Tap a number with all its mines flagged to open its other neighbours.', G.opened / (G.R * G.C - G.M), 40);
}
function bind(box) {
  let timer = 0, long = false, downAt = -1;
  box.addEventListener('contextmenu', e => e.preventDefault());
  box.addEventListener('pointerdown', e => {
    const b = e.target.closest('b'); if (!b) return;
    const i = +b.dataset.i; long = false; downAt = i;
    if (e.button === 2) { act(i, true); downAt = -1; return; }
    if (e.button === 1) { e.preventDefault(); if (G.open[i]) act(i, false); downAt = -1; return; }
    clearTimeout(timer);
    timer = setTimeout(() => { long = true; if (downAt >= 0 && !G.open[downAt]) act(downAt, true); }, 380);
  });
  box.addEventListener('pointerup', e => {
    clearTimeout(timer);
    const b = e.target.closest('b');
    if (!b || long || downAt < 0 || +b.dataset.i !== downAt) { downAt = -1; return; }
    act(downAt, flagMode && !G.open[downAt]); downAt = -1;
  });
  box.addEventListener('pointerleave', () => clearTimeout(timer));
  box.addEventListener('pointercancel', () => { clearTimeout(timer); downAt = -1; });
}
newGame(api.level);
})();
