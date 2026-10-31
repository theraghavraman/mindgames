/* Number Memory: remember a number shown for a moment, then type it back. One digit longer each round. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.nm { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 18px; background: var(--sheet); border: 1px solid var(--rule); container-type: inline-size; text-align: center; padding: 6%; }
.nm .num { font-size: clamp(20px, calc(70cqi / var(--len)), 15cqi); font-weight: 860; letter-spacing: .04em; font-variant-numeric: tabular-nums; font-variation-settings: 'CASL' 1; word-break: break-all; }
.nm .lbl { font-size: 4cqi; color: var(--graphite-2); font-weight: 650; margin-bottom: 3cqi; }
.nm .bar { position: absolute; left: 10%; right: 10%; bottom: 10%; height: 6px; border-radius: 3px; background: var(--rule); overflow: hidden; }
.nm .bar i { display: block; height: 100%; background: var(--ch-deep); transform-origin: left; }
.nm input { width: 100%; max-width: 90%; font: inherit; font-size: 8cqi; font-weight: 760; text-align: center; letter-spacing: .06em; padding: 10px; border: 2px solid var(--rule); border-radius: 12px; background: var(--sheet-2); color: var(--pen); }
.nm input:focus { outline: none; border-color: var(--ch-deep); }
.nm .cmp { font-size: 6cqi; font-weight: 760; font-variant-numeric: tabular-nums; letter-spacing: .05em; }
.nm .cmp .x { color: var(--red); text-decoration: line-through; }
`);
const LEVELS = {
  easy: { name: 'Relaxed', rank: 1, per: 1100, desc: 'About a second per digit.' },
  medium: { name: 'Standard', rank: 2, per: 750, desc: 'Three quarters of a second per digit.' },
  hard: { name: 'Flash', rank: 3, per: 450, desc: 'Under half a second per digit.' },
};
const RULES = `<p>A number appears for a moment. When it disappears, type it back.</p><ul><li>Get it right and the next number is one digit longer.</li><li>One mistake ends the game. Your score is the longest number you remembered.</li></ul><p class="tip">Group digits into chunks of two or three, like a phone number.</p>`;
let S = null, card = null;
const api = MG.shell({ id: 'number-memory', title: 'Number Memory', chapter: 'brain', levels: LEVELS, metric: 'score', timer: false, rules: RULES, onNew: newGame, size: { ar: 1.5, chrome: 230, maxW: 620 } });
api.mid.innerHTML = '<span class="pill">Digits <b data-d>3</b></span>';
function newGame() { S = { len: 3, best: 0 }; card = MG.h('div', { class: 'nm' }); api.board.innerHTML = ''; api.board.appendChild(card); api.begin(); round(); }
async function round() {
  const digits = [String(1 + MG.rand(9))]; for (let k = 1; k < S.len; k++) digits.push(String(MG.rand(10)));
  S.num = digits.join('');
  MG.qs('[data-d]', api.mid).textContent = S.len;
  card.style.setProperty('--len', S.len);
  card.innerHTML = `<div><p class="lbl">Remember this number</p><p class="num">${S.num}</p></div><div class="bar"><i></i></div>`;
  api.progress('Memorise', `${S.len} digits.`, null, 0, 'info');
  const ms = 900 + S.len * LEVELS[api.level].per, bar = MG.qs('.bar i', card), t0 = performance.now();
  while (performance.now() - t0 < ms) { if (api.status !== 'playing') return; if (!api.paused && !MG.anyDialogOpen()) bar.style.transform = `scaleX(${1 - (performance.now() - t0) / ms})`; await MG.sleep(50); }
  card.innerHTML = '<div style="width:100%"><p class="lbl">What was the number?</p><input inputmode="numeric" autocomplete="off" aria-label="The number"><p class="lbl" style="margin-top:3cqi">Press Enter to check</p></div>';
  const inp = MG.qs('input', card); inp.focus();
  api.progress('Type it back', 'Press Enter when you are done.', null, 0, 'turn');
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(inp.value.replace(/\D/g, '')); });
}
function check(v) {
  api.dirty = true;
  if (v === S.num) { MG.sfx.unit(); S.best = S.len; S.len++; api.coach('good', 'Correct', `Next: ${S.len} digits.`, 1500); setTimeout(round, 600); return; }
  MG.sfx.wrong();
  const cmp = [...S.num].map((d, i) => (v[i] === d ? d : `<span class="x">${v[i] || '·'}</span>`)).join('');
  card.innerHTML = `<div><p class="lbl">The number was</p><p class="cmp">${S.num}</p><p class="lbl" style="margin-top:3cqi">You typed</p><p class="cmp">${cmp}</p></div>`;
  api.over({ value: S.best, title: 'Memory full', big: String(S.best), sub: S.best ? `You remembered ${S.best} digits.` : 'Not this time. Try chunking the digits.', facts: [[S.best, 'Digits remembered'], [Math.max(S.best, api.stats.get(api.level).best || 0), 'Best'], [LEVELS[api.level].name, 'Speed']] });
}
newGame();
})();
