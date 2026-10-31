/* N-Queens: place N queens so that no two attack each other */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.nq { position: absolute; inset: 0; display: grid; border: 3px solid var(--frame); border-radius: 10px; overflow: hidden; container-type: inline-size; }
.nq button { position: relative; border: 0; padding: 0; cursor: pointer; background: var(--sheet); }
.nq button.dk { background: color-mix(in srgb, var(--c-moves) 45%, var(--sheet)); }
.nq button.hit::after { content: ""; position: absolute; inset: 40%; border-radius: 50%; background: var(--graphite); opacity: .16; }
.nq button.tip { box-shadow: inset 0 0 0 3px var(--green); }
.nq svg { position: absolute; inset: 14%; width: 72%; height: 72%; }
.nq .q path { fill: var(--graphite); }
.nq .q.bad path { fill: var(--red); }
.nq .q svg { animation: pop .25s ease-out; }
.nq.won .q path { fill: var(--c-moves-deep); }
`);
const LEVELS = {
  easy: { name: '5×5', rank: 1, n: 5, desc: 'Five queens.' },
  medium: { name: '8×8', rank: 2, n: 8, desc: 'The classic eight queens.' },
  hard: { name: '10×10', rank: 3, n: 10, desc: 'Ten queens.' },
};
const RULES = `<p>Place one queen for every row of the board so that no two queens attack each other.</p><ul>
<li>A queen attacks along its row, its column and both diagonals, any distance.</li>
<li>Tap a square to place or remove a queen. Queens that attack each other turn red.</li>
<li>Small dots mark squares already under attack.</li></ul><p class="tip">The eight-queens puzzle has 92 solutions. Hints suggest a square that works with the queens you've already placed, if one exists.</p>`;
const QUEEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14l1.5-10-4.5 3.5L12 5l-4 7.5L3.5 9zM4.5 20.5h15V22h-15z"/></svg>';
let S = null, els = [], box = null;
const api = MG.shell({ id: 'n-queens', title: 'N-Queens', chapter: 'moves', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: () => newGame(api.level), size: { ar: 1, chrome: 230, maxW: 600 } });
api.mid.innerHTML = '<span class="pill">Queens <b data-q>0</b></span>';
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-c><span class="ti">${MG.icon('restart')}</span><span>Clear</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}</span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !api.canPlay()) return; if (b.hasAttribute('data-c')) { S.q.clear(); render(); } else hint(); });
function newGame(level) {
  const n = LEVELS[level].n;
  S = { n, q: new Set(), hints: 0 };
  box = MG.h('div', { class: 'nq', role: 'grid' }); box.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  els = MG.range(n * n).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i, class: ((i % n) + ((i / n) | 0)) % 2 ? 'dk' : '' }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) tap(+b.dataset.i); });
  api.begin(); render();
}
const hits = (a, b, n) => { const ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n; return ra === rb || ca === cb || Math.abs(ra - rb) === Math.abs(ca - cb); };
function tap(i) {
  if (!api.canPlay()) return;
  els.forEach(b => b.classList.remove('tip'));
  if (S.q.has(i)) { S.q.delete(i); MG.sfx.note(); } else { S.q.add(i); MG.sfx.place(); }
  api.dirty = true; render();
  const qs = [...S.q];
  if (qs.length === S.n && qs.every(a => qs.every(b => a === b || !hits(a, b, S.n)))) {
    box.classList.add('won');
    const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
    api.win({ title: 'Peace on the board', sub: `${S.n} queens, none attacking another.`, facts: [[S.hints, 'Hints used'], [MG.fmtTime(t), 'Time'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  }
}
function render() {
  const n = S.n, qs = [...S.q];
  els.forEach((b, i) => {
    const isQ = S.q.has(i), bad = isQ && qs.some(o => o !== i && hits(o, i, n));
    b.innerHTML = isQ ? QUEEN : '';
    b.classList.toggle('q', isQ); b.classList.toggle('bad', bad);
    b.classList.toggle('hit', !isQ && qs.some(o => hits(o, i, n)));
    b.setAttribute('aria-label', `${'ABCDEFGHIJ'[i % n]}${n - ((i / n) | 0)}${isQ ? ', queen' : ''}`);
  });
  MG.qs('[data-q]', api.mid).textContent = `${qs.length}/${n}`;
  if (api.status === 'playing') api.progress(`${MG.plural(n - qs.length, 'queen')} to place`, 'No two queens may share a row, column or diagonal.', qs.length / n, n);
}
function hint() {
  const n = S.n, qs = [...S.q];
  if (qs.some(a => qs.some(b => a !== b && hits(a, b, n)))) { api.coach('hint', 'Two queens attack each other', 'Remove one of the red queens first.', 4000); return; }
  const fixed = new Map(qs.map(i => [(i / n) | 0, i % n])), col = [];
  const bt = r => { if (r === n) return true; const cs = fixed.has(r) ? [fixed.get(r)] : MG.shuffle(MG.range(n)); for (const c of cs) { if (col.some((cc, rr) => cc === c || Math.abs(cc - c) === r - rr)) continue; col[r] = c; if (bt(r + 1)) return true; } col.length = r; return false; };
  S.hints++;
  if (!bt(0)) { api.coach('hint', 'No solution from here', 'These queens can’t all stay. Try moving one.', 4500); MG.sfx.wrong(); return; }
  const r = MG.range(n).find(rr => !fixed.has(rr)); if (r == null) return;
  els[r * n + col[r]].classList.add('tip');
  api.coach('hint', 'A queen fits on the outlined square', 'It works together with the queens you already have.', 4500); MG.sfx.hint();
}
newGame(api.level);
})();
