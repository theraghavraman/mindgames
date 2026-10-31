/* Word Guess: find the hidden five-letter word from coloured feedback */
(function () {
'use strict';
const MG = window.MG, DICT = new Set(window.MG_WORDS5 || []), ANS = window.MG_ANSWERS5 || ['crane'];
ANS.forEach(w => DICT.add(w));
MG.style(`
.wg { position: absolute; inset: 0; display: grid; gap: 1.6%; padding: 0 8%; container-type: inline-size; align-content: center; }
.wg .row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.6%; }
.wg .row.shake { animation: shake .4s; }
.wg .t { aspect-ratio: 1; display: grid; place-items: center; border: 2px solid var(--rule); border-radius: 8px; background: var(--sheet); font-size: 9cqi; font-weight: 860; text-transform: uppercase; font-variation-settings: 'CASL' 1; color: var(--graphite); }
.wg .t.f { border-color: var(--graphite-2); animation: pop .12s ease-out; }
.wg .t.g, .wg .t.y, .wg .t.x { border-color: transparent; animation: flipt .5s ease-out var(--d, 0ms) backwards; }
.wg .t.g { background: var(--green); color: #fff; } .wg .t.y { background: var(--c-sudoku-deep); color: var(--graphite); } .wg .t.x { background: var(--pencil); color: #fff; }
.wg .row.win .t { animation: hop .5s var(--d, 0ms) ease-out; }
@keyframes flipt { 0% { transform: rotateX(0); } 50% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
@keyframes hop { 40% { transform: translateY(-18%); } }
.kb { display: grid; gap: 6px; }
.kb .kr { display: flex; gap: 5px; justify-content: center; }
.kb button { flex: 1 1 0; max-width: 44px; height: 52px; border: 0; border-radius: 8px; background: var(--sheet-2); box-shadow: inset 0 0 0 1px var(--rule); color: var(--graphite); font-weight: 760; font-size: 15px; text-transform: uppercase; cursor: pointer; padding: 0; }
.kb button.wide { max-width: 68px; flex-grow: 1.6; font-size: 12px; }
.kb button.g { background: var(--green); color: #fff; box-shadow: none; } .kb button.y { background: var(--c-sudoku-deep); color: var(--graphite); box-shadow: none; } .kb button.x { background: var(--pencil); color: #fff; opacity: .55; box-shadow: none; }
`);
const LEVELS = {
  easy: { name: 'Relaxed', rank: 1, rows: 8, strict: false, desc: 'Eight guesses.' },
  medium: { name: 'Classic', rank: 2, rows: 6, strict: false, desc: 'Six guesses.' },
  hard: { name: 'Strict', rank: 3, rows: 6, strict: true, desc: 'Six guesses, and every clue you find must be used.' },
};
const RULES = `<p>Guess the hidden five-letter word.</p><ul>
<li>Each guess must be a real English word. Type it and press <b>Enter</b>.</li>
<li><b style="color:var(--green)">Green</b>: the letter is in the word, in that spot.</li>
<li><b>Gold</b>: the letter is in the word, in a different spot.</li>
<li><b style="color:var(--pencil)">Grey</b>: the letter isn't in the word, or not as many times as you used it.</li></ul>
<p class="tip">On Strict, green letters must stay put and gold letters must appear in every later guess.</p>`;
let S = null, grid = null, kb = null;
const api = MG.shell({ id: 'word-guess', title: 'Word Guess', chapter: 'brain', levels: LEVELS, metric: 'moves', rules: RULES, onNew: newGame, size: { ar: .86, chrome: 270, maxW: 380, minW: 200 } });
kb = MG.h('div', { class: 'kb' });
kb.innerHTML = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'].map(r => `<div class="kr">${[...r].map(k => k === '+' ? '<button type="button" class="wide" data-k="Enter">Enter</button>' : k === '-' ? `<button type="button" class="wide" data-k="Backspace" aria-label="Delete">${MG.icon('back', 'sm')}</button>` : `<button type="button" data-k="${k}">${k}</button>`).join('')}</div>`).join('');
api.controls.appendChild(kb);
kb.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) key(b.dataset.k); });
function score(ans, g) {
  const res = new Array(5).fill('x'), left = {};
  for (let i = 0; i < 5; i++) { if (g[i] === ans[i]) res[i] = 'g'; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
  for (let i = 0; i < 5; i++) if (res[i] !== 'g' && left[g[i]]) { res[i] = 'y'; left[g[i]]--; }
  return res;
}
function newGame(level) {
  const L = LEVELS[level];
  S = { L, ans: MG.pick(ANS), rows: [], cur: '', keys: {} };
  grid = MG.h('div', { class: 'wg', role: 'grid', 'aria-label': 'Guesses' });
  grid.style.gridTemplateRows = `repeat(${L.rows}, auto)`;
  api.size({ ar: 5 / L.rows * 1.04, chrome: 270, chromeL: 150, maxW: 380, minW: 200 });
  api.board.innerHTML = ''; api.board.appendChild(grid);
  MG.qsa('button', kb).forEach(b => b.classList.remove('g', 'y', 'x'));
  api.begin(); render();
}
function key(k) {
  if (!api.canPlay() || !S) return;
  if (k === 'Enter') return submit();
  if (k === 'Backspace') { S.cur = S.cur.slice(0, -1); return render(); }
  if (/^[a-z]$/i.test(k) && S.cur.length < 5) { S.cur += k.toLowerCase(); MG.sfx.tap(); render(true); }
}
function reject(msg) { MG.toast(msg); MG.sfx.wrong(); const r = grid.children[S.rows.length]; if (r) MG.replay(r, 'shake', 450); }
function submit() {
  const g = S.cur;
  if (g.length < 5) return reject('Not enough letters');
  if (!DICT.has(g)) return reject(`“${g.toUpperCase()}” isn't in the word list`);
  if (S.L.strict) {
    for (const r of S.rows) for (let i = 0; i < 5; i++) {
      if (r.res[i] === 'g' && g[i] !== r.g[i]) return reject(`Letter ${i + 1} must be ${r.g[i].toUpperCase()}`);
      if (r.res[i] === 'y') { const need = r.g.split('').filter((c, j) => c === r.g[i] && r.res[j] !== 'x').length; if (g.split('').filter(c => c === r.g[i]).length < need) return reject(`The guess must contain ${r.g[i].toUpperCase()}`); }
    }
  }
  const res = score(S.ans, g);
  S.rows.push({ g, res }); S.cur = ''; api.dirty = true;
  const rank = { x: 1, y: 2, g: 3 };
  g.split('').forEach((c, i) => { if (!S.keys[c] || rank[res[i]] > rank[S.keys[c]]) S.keys[c] = res[i]; });
  render(); MG.sfx.flip();
  const n = S.rows.length;
  if (g === S.ans) {
    api.later(() => { const r = grid.children[n - 1]; if (r) r.classList.add('win'); }, 600);
    const prev = api.stats.get(api.level).best, best = !prev || n < prev ? n : prev;
    api.win({ title: ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew', 'Close one', 'Made it'][n - 1] || 'Solved', value: n, big: S.ans.toUpperCase(), sub: `Found in ${MG.plural(n, 'guess', 'guesses')}.`, facts: [[n, 'Guesses'], [MG.fmtTime(api.timer.elapsed), 'Time'], [best, 'Fewest guesses']], delay: 1500 });
  } else if (n >= S.L.rows) api.lose({ title: 'Out of guesses', big: S.ans.toUpperCase(), sub: 'That was the word.', delay: 1200 });
}
function render(typed) {
  const L = S.L;
  let h = '';
  for (let r = 0; r < L.rows; r++) {
    const row = S.rows[r], word = row ? row.g : r === S.rows.length ? S.cur : '';
    h += `<div class="row" role="row">${MG.range(5).map(i => { const c = word[i] || '', st = row ? row.res[i] : c ? 'f' : ''; return `<div class="t ${st}" style="--d:${i * 120}ms" role="gridcell">${c}</div>`; }).join('')}</div>`;
  }
  grid.innerHTML = h;
  if (!typed) MG.qsa('[data-k]', kb).forEach(b => { const s = S.keys[b.dataset.k]; b.classList.remove('g', 'y', 'x'); if (s) b.classList.add(s); });
  if (api.status === 'playing') api.progress(`Guess ${S.rows.length + 1} of ${L.rows}`, 'Green: right spot. Gold: wrong spot. Grey: not in the word.', S.rows.length / L.rows, L.rows);
}
MG.onKey(e => { if (e.ctrlKey || e.metaKey || e.altKey) return; if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-z]$/i.test(e.key)) { e.preventDefault(); key(e.key); } });
MG.debug = { score, get S() { return S; } };
newGame(api.level);
})();
