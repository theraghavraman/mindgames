/* Sliding puzzle: put the numbered tiles back in order. Tap any tile in line with the gap to slide a whole row. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.sp { position: absolute; inset: 0; padding: var(--gap); border-radius: 14px; background: var(--frame); container-type: inline-size; touch-action: none; --gap: 1.8cqi; }
.sp .tile { position: absolute; left: var(--gap); top: var(--gap); width: calc((100% - (var(--n) + 1) * var(--gap)) / var(--n)); aspect-ratio: 1; border: 0; border-radius: 10px; display: grid; place-items: center;
  transform: translate(calc(var(--c) * (100% + var(--gap))), calc(var(--r) * (100% + var(--gap)))); transition: transform .12s ease-out, background-color .3s; cursor: pointer;
  font-size: calc(100cqi / var(--n) * .4); font-weight: 860; font-variation-settings: 'CASL' 1; color: var(--graphite); background: var(--bg); box-shadow: inset 0 -4px 0 rgba(0,0,0,.1); }
.sp .tile.home { box-shadow: inset 0 -4px 0 rgba(0,0,0,.1), inset 0 0 0 3px color-mix(in srgb, var(--graphite) 35%, transparent); }
.sp.won .tile { animation: pop .4s var(--d, 0ms) both; }
`);
const LEVELS = {
  easy: { name: '3×3', rank: 1, n: 3, desc: 'The 8-puzzle.' },
  medium: { name: '4×4', rank: 2, n: 4, desc: 'The classic 15-puzzle.' },
  hard: { name: '5×5', rank: 3, n: 5, desc: 'Twenty-four tiles.' },
};
const ROWC = ['--c-sudoku', '--c-logic', '--c-numbers', '--c-moves', '--c-duels'];
const RULES = `<p>Put the tiles back in order, 1 in the top-left corner and the gap in the bottom-right.</p><ul>
<li>Tap a tile in the same row or column as the gap to slide it, along with every tile between it and the gap.</li>
<li>Arrow keys move a tile into the gap.</li><li>Each tile is coloured by the row it belongs in, and outlined once it's home.</li></ul>
<p class="tip">Every shuffle is made with legal moves, so it can always be solved. Solve the top row first, then the left column, and repeat on the smaller puzzle that remains.</p>`;
let S = null, box = null, els = [];
const api = MG.shell({ id: 'sliding-puzzle', title: 'Sliding Puzzle', chapter: 'moves', levels: LEVELS, metric: 'moves', rules: RULES, onNew: newGame, onRestart: restart, size: { ar: 1, chrome: 230, maxW: 560 } });
api.mid.innerHTML = '<span class="pill">Moves <b data-m>0</b></span>';
const movesEl = MG.qs('[data-m]', api.mid);
function newGame(level) {
  const n = LEVELS[level].n, t = MG.range(n * n).map(i => (i + 1) % (n * n));
  let blank = n * n - 1, prev = -1;
  for (let k = 0; k < n * n * 60; k++) {
    const r = (blank / n) | 0, c = blank % n, opts = [];
    if (r) opts.push(blank - n); if (r < n - 1) opts.push(blank + n); if (c) opts.push(blank - 1); if (c < n - 1) opts.push(blank + 1);
    const j = MG.pick(opts.filter(x => x !== prev));
    t[blank] = t[j]; t[j] = 0; prev = blank; blank = j;
  }
  if (t.every((v, i) => v === (i + 1) % (n * n))) return newGame(level);
  S = { level, n, start: t.slice(), t, moves: 0 };
  build(); api.begin(); render();
}
function restart() { S.t = S.start.slice(); S.moves = 0; build(); api.begin(); render(); }
function build() {
  box = MG.h('div', { class: 'sp', role: 'application', 'aria-label': 'Sliding puzzle' });
  box.style.setProperty('--n', S.n);
  els = [];
  for (let v = 1; v < S.n * S.n; v++) {
    const b = MG.h('button', { type: 'button', class: 'tile', text: String(v), 'data-v': v });
    b.style.setProperty('--bg', `var(${ROWC[Math.floor((v - 1) / S.n) % ROWC.length]})`);
    els[v] = b; box.appendChild(b);
  }
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('.tile'); if (b) tapTile(S.t.indexOf(+b.dataset.v)); });
}
function render() {
  const n = S.n;
  S.t.forEach((v, i) => { if (!v) return; const el = els[v]; el.style.setProperty('--r', (i / n) | 0); el.style.setProperty('--c', i % n); el.classList.toggle('home', v === i + 1); });
  movesEl.textContent = S.moves;
  const home = S.t.filter((v, i) => v && v === i + 1).length;
  if (api.status === 'playing') api.progress(`${home} of ${n * n - 1} tiles home`, 'Tap any tile in line with the gap.', home / (n * n - 1), n * n - 1);
}
function tapTile(i) {
  if (!api.canPlay() || i < 0) return;
  const n = S.n, b = S.t.indexOf(0), r = (i / n) | 0, c = i % n, br = (b / n) | 0, bc = b % n;
  if (r !== br && c !== bc) { MG.replay(els[S.t[i]], 'nudge', 260); return; }
  const step = r === br ? (c < bc ? -1 : 1) : (r < br ? -n : n);
  let g = b;
  while (g !== i) { S.t[g] = S.t[g + step]; S.t[g + step] = 0; g += step; S.moves++; }
  api.dirty = true; MG.sfx.slide(); render(); check();
}
function check() {
  const n = S.n;
  if (!S.t.every((v, i) => v === (i + 1) % (n * n))) return;
  box.classList.add('won'); els.forEach((el, v) => el && el.style.setProperty('--d', v * 30 + 'ms'));
  const prev = api.stats.get(api.level).best, best = !prev || S.moves < prev ? S.moves : prev;
  api.win({ title: 'In order', value: S.moves, big: String(S.moves), sub: `${MG.plural(S.moves, 'move')} in ${MG.fmtTime(api.timer.elapsed)}.`, facts: [[MG.fmtTime(api.timer.elapsed), 'Time'], [best, 'Fewest moves'], [LEVELS[S.level].name, 'Board']] });
}
MG.onKey(e => {
  if (!S) return;
  const n = S.n, b = S.t.indexOf(0), r = (b / n) | 0, c = b % n;
  const m = { ArrowUp: r < n - 1 ? b + n : -1, ArrowDown: r ? b - n : -1, ArrowLeft: c < n - 1 ? b + 1 : -1, ArrowRight: c ? b - 1 : -1 }[e.key];
  if (m !== undefined) { e.preventDefault(); if (m >= 0) tapTile(m); }
});
newGame(api.level);
})();
