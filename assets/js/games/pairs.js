/* Pairs: flip two cards at a time and find every matching pair */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.pr { position: absolute; inset: 0; display: grid; gap: 2.2%; perspective: 900px; }
.pr button { position: relative; border: 0; padding: 0; background: none; cursor: pointer; transform-style: preserve-3d; transition: transform .38s cubic-bezier(.3, .7, .3, 1); }
.pr button.up, .pr button.done { transform: rotateY(180deg); cursor: default; }
.pr .face { position: absolute; inset: 0; border-radius: 12px; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: grid; place-items: center; }
.pr .back { background: var(--c-brain-deep); background-image: radial-gradient(circle at 30% 30%, rgba(255,255,255,.25) 0 12%, transparent 13%), radial-gradient(circle at 70% 70%, rgba(255,255,255,.18) 0 10%, transparent 11%); box-shadow: inset 0 -4px 0 rgba(0,0,0,.15); }
.pr .front { background: var(--sheet); border: 1px solid var(--rule); transform: rotateY(180deg); }
.pr .front svg { width: 62%; height: 62%; }
.pr .done .front { background: var(--ch-soft); border-color: var(--ch-deep); animation: pop .35s; }
`);
const LEVELS = {
  easy: { name: '12 cards', rank: 1, cols: 4, rows: 3, desc: 'Six pairs.' },
  medium: { name: '16 cards', rank: 2, cols: 4, rows: 4, desc: 'Eight pairs.' },
  hard: { name: '30 cards', rank: 3, cols: 6, rows: 5, desc: 'Fifteen pairs.' },
};
const SHAPES = ['<circle cx="12" cy="12" r="8"/>', '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>', '<path d="M12 3.5L21 19.5H3z"/>', '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>',
  '<path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.8-8 11-8 11z"/>', '<path d="M12 2.5l9 9.5-9 9.5-9-9.5z"/>', '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/>', '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>', '<path d="M13 2 4 14h7l-1 8 10-12h-7z"/>', '<path d="M15 3a9 9 0 1 0 6 13A7 7 0 0 1 15 3z"/>'];
const COLS = ['var(--pen)', 'var(--red)', 'var(--c-moves-deep)', 'var(--c-numbers-deep)'];
const RULES = `<p>Find every matching pair.</p><ul><li>Tap two cards to turn them over.</li><li>If they match, they stay face up. If not, they turn back after a moment, so remember where they were.</li><li>Clear the table in as few turns and as little time as you can.</li></ul>`;
let S = null, els = [], lock = false;
const api = MG.shell({ id: 'pairs', title: 'Pairs', chapter: 'brain', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 560 } });
api.mid.innerHTML = '<span class="pill">Turns <b data-t>0</b></span><span class="pill">Pairs <b data-p>0</b></span>';
const glyph = k => `<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:${COLS[Math.floor(k / SHAPES.length)]}">${SHAPES[k % SHAPES.length]}</svg>`;
function newGame(level) {
  const L = LEVELS[level], n = L.cols * L.rows / 2;
  const kinds = MG.shuffle(MG.range(SHAPES.length * COLS.length)).slice(0, n);
  S = { L, cards: MG.shuffle([...kinds, ...kinds]), up: [], done: new Set(), turns: 0 };
  api.size({ ar: L.cols / L.rows * 1.0, chrome: 220, maxW: 600 });
  const box = MG.h('div', { class: 'pr', role: 'grid', 'aria-label': 'Cards' });
  box.style.gridTemplateColumns = `repeat(${L.cols}, 1fr)`; box.style.gridTemplateRows = `repeat(${L.rows}, 1fr)`;
  els = S.cards.map((k, i) => { const b = MG.h('button', { type: 'button', 'data-i': i, 'aria-label': 'Face-down card', html: `<span class="face back"></span><span class="face front">${glyph(k)}</span>` }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) flip(+b.dataset.i); });
  lock = false; api.begin(); render();
}
function flip(i) {
  if (lock || !api.canPlay() || S.done.has(i) || S.up.includes(i)) return;
  S.up.push(i); els[i].classList.add('up'); MG.sfx.flip(); api.dirty = true;
  if (S.up.length < 2) return render();
  S.turns++;
  const [a, b] = S.up;
  if (S.cards[a] === S.cards[b]) {
    S.done.add(a); S.done.add(b); S.up = [];
    api.later(() => { els[a].classList.add('done'); els[b].classList.add('done'); MG.sfx.unit(); }, 260);
    if (S.done.size === S.cards.length) api.later(() => {
      const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
      api.win({ title: 'All pairs found', sub: `${S.cards.length / 2} pairs in ${MG.plural(S.turns, 'turn')}.`, facts: [[S.turns, 'Turns'], [S.cards.length / 2, 'Pairs'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
    }, 500);
  } else {
    lock = true;
    api.later(() => { els[a].classList.remove('up'); els[b].classList.remove('up'); S.up = []; lock = false; render(); }, 850);
  }
  render();
}
function render() {
  MG.qs('[data-t]', api.mid).textContent = S.turns; MG.qs('[data-p]', api.mid).textContent = `${S.done.size / 2}/${S.cards.length / 2}`;
  if (api.status === 'playing') api.progress(`${S.cards.length / 2 - S.done.size / 2} pairs to find`, 'Turn two cards over. A perfect game needs one turn per pair, plus luck.', S.done.size / S.cards.length, S.cards.length / 2);
}
newGame(api.level);
})();
