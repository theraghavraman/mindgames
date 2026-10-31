/* Schulte Table: find the numbers in order as fast as you can, using your peripheral vision */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.sc { position: absolute; inset: 0; display: grid; gap: 4px; padding: 4px; border-radius: 14px; background: var(--rule); container-type: inline-size; }
.sc button { border: 0; border-radius: 9px; background: var(--sheet); font-size: calc(100cqi / var(--n) * .36); font-weight: 760; font-variation-settings: 'CASL' 1; color: var(--graphite); cursor: pointer; transition: background-color .2s, color .2s; }
.sc button.ok { background: var(--ch-soft); color: var(--pencil); }
.sc button.no { background: var(--red-soft); }
`);
const LEVELS = {
  easy: { name: '4×4', rank: 1, n: 4, desc: 'Numbers 1 to 16.' },
  medium: { name: '5×5', rank: 2, n: 5, desc: 'Numbers 1 to 25, the classic table.' },
  hard: { name: '6×6', rank: 3, n: 6, desc: 'Numbers 1 to 36.' },
};
const RULES = `<p>Tap the numbers in order, from 1 up, as fast as you can.</p><ul><li>Try to keep your eyes on the centre of the table and spot the numbers with your peripheral vision.</li><li>A wrong tap flashes red and adds a second to your time.</li></ul><p class="tip">Schulte tables are a classic drill for visual search and attention.</p>`;
let S = null, els = [];
const api = MG.shell({ id: 'schulte-table', title: 'Schulte Table', chapter: 'brain', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 520 } });
api.mid.innerHTML = '<span class="pill">Find <b data-f>1</b></span><span class="pill">Misses <b data-m>0</b></span>';
function newGame(level) {
  const n = LEVELS[level].n, nums = MG.shuffle(MG.range(n * n).map(i => i + 1));
  S = { n, next: 1, miss: 0 };
  const box = MG.h('div', { class: 'sc', role: 'grid' }); box.style.setProperty('--n', n); box.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  els = nums.map(v => { const b = MG.h('button', { type: 'button', text: String(v), 'data-v': v }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  MG.press(box, 'button', tap);
  api.begin(); render();
}
function tap(b) {
  if (!api.canPlay()) return;
  const v = +b.dataset.v;
  if (v < S.next) return;
  if (v !== S.next) { S.miss++; api.timer.elapsed = api.timer.elapsed + 1000; MG.sfx.wrong(); MG.replay(b, 'no', 300); MG.replay(b, 'shake', 400); render(); return; }
  b.classList.add('ok'); MG.sfx.blip(400 + v * 12, .06); S.next++; api.dirty = true; render();
  if (S.next > S.n * S.n) {
    const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
    api.win({ title: 'Table cleared', sub: `${S.n * S.n} numbers with ${MG.plural(S.miss, 'miss', 'misses')}.`, facts: [[S.miss, 'Misses'], [(t / 1000 / (S.n * S.n)).toFixed(2) + 's', 'Per number'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  }
}
function render() {
  MG.qs('[data-f]', api.mid).textContent = Math.min(S.next, S.n * S.n); MG.qs('[data-m]', api.mid).textContent = S.miss;
  if (api.status === 'playing') api.progress(`Find ${S.next}`, 'Keep your eyes near the centre.', (S.next - 1) / (S.n * S.n), 0);
}
newGame(api.level);
})();
