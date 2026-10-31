/* Tower of Hanoi: move the whole tower to the right peg, one disk at a time, never a bigger disk on a smaller one */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.th { position: absolute; inset: 0; border-radius: 14px; background: var(--sheet); border: 1px solid var(--rule); overflow: hidden; cursor: pointer; touch-action: manipulation; }
.th .col { position: absolute; top: 0; bottom: 0; width: 33.33%; }
.th .col:hover { background: var(--tint); }
.th .col.pick { background: color-mix(in srgb, var(--ch) 35%, transparent); }
.th .peg { position: absolute; bottom: 10%; width: 2.2%; height: 72%; border-radius: 6px 6px 0 0; background: var(--graphite-2); transform: translateX(-50%); }
.th .base { position: absolute; left: 3%; right: 3%; bottom: 6%; height: 4%; border-radius: 6px; background: var(--graphite); }
.th .disk { position: absolute; left: 0; bottom: 0; height: var(--dh); border-radius: 999px; background: var(--bg); box-shadow: inset 0 -3px 0 rgba(0,0,0,.14);
  transition: transform .22s cubic-bezier(.3, .7, .2, 1); display: grid; place-items: center; font-weight: 800; font-size: 12px; color: var(--graphite); pointer-events: none; }
.th .disk.up { box-shadow: inset 0 -3px 0 rgba(0,0,0,.14), 0 10px 24px -8px rgba(20, 30, 50, .5); }
.th .col.tip { box-shadow: inset 0 0 0 3px var(--green); }
`);
const LEVELS = {
  easy: { name: '4 disks', rank: 1, n: 4, desc: 'At least 15 moves.' },
  medium: { name: '6 disks', rank: 2, n: 6, desc: 'At least 63 moves.' },
  hard: { name: '8 disks', rank: 3, n: 8, desc: 'At least 255 moves.' },
};
const COLS = ['--c-logic', '--c-numbers', '--c-sudoku', '--c-moves', '--c-duels', '--c-brain', '--c-logic-deep', '--c-numbers-deep'];
const RULES = `<p>Move the whole tower from the left peg to the right peg.</p><ul>
<li>Move one disk at a time: the top disk of any peg.</li><li>Never put a bigger disk on top of a smaller one.</li></ul>
<p>Tap a peg to lift its top disk, then tap the peg to drop it on. Keys <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> work too.</p>
<p class="tip">The fewest moves possible is 2ⁿ − 1 for n disks: 15 for four, 63 for six, 255 for eight.</p>`;
let S = null, box = null, disks = [], cols = [];
const api = MG.shell({ id: 'tower-of-hanoi', title: 'Tower of Hanoi', chapter: 'moves', levels: LEVELS, metric: 'moves', rules: RULES, onNew: newGame, onRestart: () => newGame(api.level), size: { ar: 1.6, chrome: 240, maxW: 760 } });
api.mid.innerHTML = '<span class="pill">Moves <b data-m>0</b></span><span class="pill">Fewest <b data-p>0</b></span>';
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}</span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else hint(); });
function newGame(level) {
  const n = LEVELS[level].n;
  S = { level, n, pegs: [MG.range(n).map(k => n - k), [], []], held: -1, moves: 0, hist: [], hints: 0 };
  build(); api.begin(); render();
}
function build() {
  box = MG.h('div', { class: 'th', role: 'application', 'aria-label': 'Three pegs' });
  cols = [0, 1, 2].map(p => { const c = MG.h('div', { class: 'col', style: { left: p * 33.33 + '%' }, 'data-p': p }); box.appendChild(c); return c; });
  [0, 1, 2].forEach(p => box.appendChild(MG.h('div', { class: 'peg', style: { left: (16.67 + p * 33.33) + '%' } })));
  box.appendChild(MG.h('div', { class: 'base' }));
  const dh = Math.min(9, 60 / S.n);
  box.style.setProperty('--dh', dh + '%');
  disks = [];
  for (let d = 1; d <= S.n; d++) {
    const w = 9 + (d - 1) * (21 / Math.max(1, S.n - 1));
    const el = MG.h('div', { class: 'disk', style: { width: w + '%' } });
    el.style.setProperty('--bg', `var(${COLS[(d - 1) % COLS.length]})`);
    disks[d] = { el, w }; box.appendChild(el);
  }
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const c = e.target.closest('.col'); if (c) tap(+c.dataset.p); });
  MG.qs('[data-p]', api.mid).textContent = 2 ** S.n - 1;
}
function render() {
  const H = box.clientHeight || 300, W = box.clientWidth || 480, dh = Math.min(.09, .6 / S.n) * H;
  S.pegs.forEach((stack, p) => stack.forEach((d, k) => {
    const lifted = S.held === p && k === stack.length - 1;
    const x = (16.67 + p * 33.33 - disks[d].w / 2) / 100 * W, y = -(0.1 * H + k * dh) - (lifted ? 0.86 * H - k * dh - 0.1 * H - dh : 0);
    disks[d].el.style.transform = `translate(${x}px, ${y}px)`;
    disks[d].el.classList.toggle('up', lifted);
  }));
  cols.forEach((c, p) => c.classList.toggle('pick', S.held === p));
  MG.qs('[data-m]', api.mid).textContent = S.moves;
  if (api.status === 'playing') api.progress(`${S.pegs[2].length} of ${S.n} disks on the right peg`, S.held >= 0 ? 'Now tap the peg to drop the disk on.' : 'Tap a peg to lift its top disk.', S.pegs[2].length / S.n, S.n);
}
window.addEventListener('resize', () => S && render());
function tap(p) {
  if (!api.canPlay()) return;
  cols.forEach(c => c.classList.remove('tip'));
  if (S.held < 0) {
    if (!S.pegs[p].length) { MG.replay(cols[p], 'nudge', 260); return; }
    S.held = p; MG.sfx.tap(); render(); return;
  }
  const from = S.held; S.held = -1;
  if (from === p) { render(); return; }
  const d = S.pegs[from][S.pegs[from].length - 1], top = S.pegs[p][S.pegs[p].length - 1];
  if (top && top < d) {
    MG.sfx.wrong(); MG.replay(disks[d].el, 'shake', 400);
    api.coach('mistake', "That disk is too big", 'A disk can only go on an empty peg or on a bigger disk.', 3500);
    render(); return;
  }
  S.pegs[from].pop(); S.pegs[p].push(d); S.moves++; S.hist.push([from, p]); api.dirty = true;
  MG.sfx.blip(260 + d * 40, .1); render();
  if (S.pegs[2].length === S.n) {
    const par = 2 ** S.n - 1, prev = api.stats.get(api.level).best, best = !prev || S.moves < prev ? S.moves : prev;
    api.win({ title: S.moves === par ? 'Perfect tower' : 'Tower moved', value: S.moves, big: String(S.moves), badge: S.moves === par ? 'The fewest moves possible' : undefined,
      sub: S.moves === par ? `${S.moves} moves: you can't do better.` : `${S.moves} moves; the fewest possible is ${par}.`, facts: [[par, 'Fewest possible'], [S.hints, 'Hints used'], [best, 'Your best']] });
  }
}
function undo() { if (!api.canPlay() || !S.hist.length) return; const [a, b] = S.hist.pop(); S.pegs[a].push(S.pegs[b].pop()); S.moves++; S.held = -1; MG.sfx.note(); render(); }
/* Optimal next move from any position: the first move that brings disks 1..k onto the target */
function firstMove(pos, k, target) {
  for (let d = k; d >= 1; d--) { if (pos[d] === target) continue; const other = 3 - pos[d] - target; return firstMove(pos, d - 1, other) || [pos[d], target]; }
  return null;
}
function hint() {
  if (!api.canPlay()) return;
  const pos = []; S.pegs.forEach((s, p) => s.forEach(d => { pos[d] = p; }));
  const m = firstMove(pos, S.n, 2); if (!m) return;
  S.held = -1; S.hints++; render();
  cols[m[0]].classList.add('tip');
  api.coach('hint', `Move peg ${m[0] + 1} to peg ${m[1] + 1}`, 'That is the first step of the shortest route from here.', 4000);
  MG.sfx.hint();
}
MG.onKey(e => { if (/^[123]$/.test(e.key)) tap(+e.key - 1); else if (e.key === 'u' || e.key === 'U') undo(); });
newGame(api.level);
})();
