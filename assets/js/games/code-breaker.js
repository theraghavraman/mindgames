/* Code Breaker: crack the hidden colour code from black and white feedback pegs */
(function () {
'use strict';
const MG = window.MG;
const PALETTE = ['#E5243B', '#F59E0B', '#FACC15', '#22A55B', '#1D9BF0', '#7C3AED', '#EC4899', '#8B5E34'];
MG.style(`
.cb { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 14px; background: var(--sheet); border: 1px solid var(--rule); overflow: auto; container-type: inline-size; }
.cb .row { display: grid; grid-template-columns: 24px 1fr 46px; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 10px; }
.cb .row.cur { background: var(--ch-soft); }
.cb .n { font-size: 12px; font-weight: 700; color: var(--pencil); text-align: right; }
.cb .pegs { display: grid; grid-template-columns: repeat(var(--k), 1fr); gap: 6px; }
.cb .peg { aspect-ratio: 1; max-height: 34px; border-radius: 50%; border: 0; padding: 0; background: var(--sheet-2); box-shadow: inset 0 2px 4px rgba(0,0,0,.18); justify-self: center; width: 100%; max-width: 34px; }
.cb .peg.f { box-shadow: inset 0 -3px 0 rgba(0,0,0,.2); }
.cb .cur .peg { cursor: pointer; } .cb .cur .peg.at { outline: 3px solid var(--graphite); outline-offset: 2px; }
.cb .fb { display: grid; grid-template-columns: repeat(3, 10px); gap: 3px; justify-content: center; }
.cb .fb i { width: 10px; height: 10px; border-radius: 50%; background: var(--rule); }
.cb .fb i.b { background: var(--graphite); } .cb .fb i.w { background: var(--sheet); box-shadow: 0 0 0 1.5px var(--graphite); }
.cb .secret { margin-top: auto; background: var(--graphite); } .cb .secret .n { color: var(--paper); }
.pal { display: grid; grid-template-columns: repeat(var(--c), 1fr); gap: 8px; }
.pal button { aspect-ratio: 1; max-height: 48px; border-radius: 50%; border: 0; cursor: pointer; box-shadow: inset 0 -4px 0 rgba(0,0,0,.2); }
.pal button:active { transform: scale(.92); }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, k: 4, c: 6, rows: 10, dup: false, desc: 'Four pegs, six colours, no repeats.' },
  medium: { name: 'Medium', rank: 2, k: 4, c: 6, rows: 10, dup: true, desc: 'Four pegs, six colours, repeats allowed.' },
  hard: { name: 'Hard', rank: 3, k: 5, c: 8, rows: 12, dup: true, desc: 'Five pegs, eight colours, repeats allowed.' },
};
const RULES = `<p>The computer hides a code of coloured pegs. Crack it in as few guesses as you can.</p><ul>
<li>Fill a row with colours and press <b>Check</b>.</li>
<li>A <b>black</b> dot means one peg is the right colour in the right spot.</li>
<li>A <b>white</b> dot means one peg is a right colour in the wrong spot.</li>
<li>Dots don't say which peg they belong to. Each peg of the code is counted only once.</li></ul>
<p class="tip">With repeats allowed, a colour can appear more than once in the code.</p>`;
let S = null, box = null, pal = null;
const api = MG.shell({ id: 'code-breaker', title: 'Code Breaker', chapter: 'brain', levels: LEVELS, metric: 'moves', rules: RULES, onNew: newGame, size: { ar: .78, chrome: 300, maxW: 460 } });
pal = MG.h('div', { class: 'pal' });
const bar = MG.h('div', { class: 'bar' });
bar.innerHTML = `<button type="button" class="btn btn-quiet" data-x>${MG.icon('erase')}Clear</button><button type="button" class="btn btn-primary" data-ok>${MG.icon('check')}Check</button>`;
api.controls.append(pal, bar);
MG.qs('[data-x]', bar).addEventListener('click', () => { if (!api.canPlay()) return; S.cur.fill(-1); S.at = 0; render(); });
MG.qs('[data-ok]', bar).addEventListener('click', check);
pal.addEventListener('click', e => { const b = e.target.closest('button'); if (b) put(+b.dataset.c); });
function score(code, guess) {
  let black = 0; const a = {}, b = {};
  code.forEach((v, i) => { if (guess[i] === v) black++; else { a[v] = (a[v] || 0) + 1; b[guess[i]] = (b[guess[i]] || 0) + 1; } });
  let white = 0; for (const v in a) white += Math.min(a[v], b[v] || 0);
  return [black, white];
}
function newGame(level) {
  const L = LEVELS[level];
  const code = L.dup ? MG.range(L.k).map(() => MG.rand(L.c)) : MG.shuffle(MG.range(L.c)).slice(0, L.k);
  S = { L, code, rows: [], cur: new Array(L.k).fill(-1), at: 0 };
  pal.style.setProperty('--c', L.c);
  pal.innerHTML = MG.range(L.c).map(c => `<button type="button" data-c="${c}" style="background:${PALETTE[c]}" aria-label="Colour ${c + 1}"></button>`).join('');
  box = MG.h('div', { class: 'cb' }); box.style.setProperty('--k', L.k);
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const p = e.target.closest('.cur .peg'); if (p) { S.at = +p.dataset.j; if (S.cur[S.at] >= 0) { S.cur[S.at] = -1; } render(); } });
  api.begin(); render();
}
function put(c) {
  if (!api.canPlay()) return;
  if (!S.L.dup && S.cur.includes(c)) { MG.toast('No repeats on this level'); return; }
  S.cur[S.at] = c; MG.sfx.tap(); api.dirty = true;
  const nx = S.cur.findIndex(v => v < 0); S.at = nx < 0 ? S.at : nx;
  render();
}
function check() {
  if (!api.canPlay()) return;
  if (S.cur.some(v => v < 0)) { MG.toast('Fill every peg first'); return; }
  const fb = score(S.code, S.cur);
  S.rows.push({ g: S.cur.slice(), fb }); S.cur.fill(-1); S.at = 0;
  fb[0] === S.L.k ? MG.sfx.win() : MG.sfx.place();
  render();
  const n = S.rows.length;
  if (fb[0] === S.L.k) {
    const prev = api.stats.get(api.level).best, best = !prev || n < prev ? n : prev;
    api.win({ title: 'Code cracked', value: n, big: String(n), sub: `Cracked in ${MG.plural(n, 'guess', 'guesses')}.`, facts: [[n, 'Guesses'], [MG.fmtTime(api.timer.elapsed), 'Time'], [best, 'Fewest guesses']] });
  } else if (n >= S.L.rows) { render(true); api.lose({ title: 'Out of guesses', sub: 'The code is shown at the bottom of the board.' }); }
}
function render(reveal) {
  const L = S.L, peg = (c, j, cur) => `<button type="button" class="peg${c >= 0 ? ' f' : ''}${cur && j === S.at ? ' at' : ''}" data-j="${j}" style="${c >= 0 ? 'background:' + PALETTE[c] : ''}" aria-label="${c >= 0 ? 'Colour ' + (c + 1) : 'Empty'}"></button>`;
  let h = S.rows.map((r, k) => `<div class="row"><span class="n">${k + 1}</span><div class="pegs">${r.g.map((c, j) => peg(c, j)).join('')}</div><div class="fb" aria-label="${r.fb[0]} black, ${r.fb[1]} white">${MG.range(L.k).map(j => `<i class="${j < r.fb[0] ? 'b' : j < r.fb[0] + r.fb[1] ? 'w' : ''}"></i>`).join('')}</div></div>`).join('');
  if (api.status === 'playing' && S.rows.length < L.rows) h += `<div class="row cur"><span class="n">${S.rows.length + 1}</span><div class="pegs">${S.cur.map((c, j) => peg(c, j, true)).join('')}</div><div class="fb"></div></div>`;
  if (reveal || api.status === 'lost') h += `<div class="row secret"><span class="n">Code</span><div class="pegs">${S.code.map((c, j) => peg(c, j)).join('')}</div><div></div></div>`;
  box.innerHTML = h;
  box.scrollTop = box.scrollHeight;
  if (api.status === 'playing') api.progress(`Guess ${S.rows.length + 1} of ${L.rows}`, 'Black: right colour, right spot. White: right colour, wrong spot.', S.rows.length / L.rows, L.rows);
}
newGame(api.level);
})();
