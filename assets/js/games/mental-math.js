/* Mental Maths: answer as many sums as you can in 60 seconds */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.mm { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 18px; background: var(--sheet); border: 1px solid var(--rule); container-type: inline-size; text-align: center; }
.mm .q { font-size: 14cqi; font-weight: 860; font-variation-settings: 'CASL' 1; letter-spacing: -.02em; }
.mm .a { min-height: 1.2em; margin-top: 2cqi; font-size: 11cqi; font-weight: 700; color: var(--pen); font-variation-settings: 'CASL' 1; border-bottom: 3px solid var(--rule); min-width: 30cqi; display: inline-block; }
.mm.good { box-shadow: 0 0 0 4px var(--green); } .mm.bad { box-shadow: 0 0 0 4px var(--red); }
.mm .bar { position: absolute; left: 6%; right: 6%; bottom: 7%; height: 8px; border-radius: 4px; background: var(--rule); overflow: hidden; }
.mm .bar i { display: block; height: 100%; background: var(--ch-deep); transform-origin: left; }
.kp { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.kp button { height: 50px; border: 1px solid var(--rule); border-radius: 10px; background: var(--sheet); color: var(--pen); font-size: 22px; font-weight: 700; font-variation-settings: 'CASL' 1; cursor: pointer; }
.kp button.go { background: var(--graphite); color: var(--sheet); font-size: 15px; }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, desc: 'Adding and subtracting up to 20.' },
  medium: { name: 'Medium', rank: 2, desc: 'Adding, subtracting and times tables to 12.' },
  hard: { name: 'Hard', rank: 3, desc: 'All four operations with bigger numbers.' },
};
const RULES = `<p>Solve as many problems as you can in 60 seconds.</p><ul><li>Type the answer with the keypad or your keyboard, then press <b>OK</b> or Enter.</li><li>A right answer scores a point. A wrong one shows the correct answer and moves on.</li></ul><p class="tip">Division problems always come out to a whole number.</p>`;
let S = null, card = null, tick = 0;
const api = MG.shell({ id: 'mental-math', title: 'Mental Maths', chapter: 'brain', levels: LEVELS, metric: 'score', timer: false, rules: RULES, onNew: newGame, size: { ar: 1.5, chrome: 330, maxW: 620 } });
api.mid.innerHTML = '<span class="pill">Score <b data-s>0</b></span><span class="pill">Time <b data-t>60</b></span>';
const kp = MG.h('div', { class: 'kp' });
kp.innerHTML = ['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', '0'].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('') + '<button type="button" class="go" data-k="ok" style="grid-column: span 4">OK</button>';
api.controls.appendChild(kp);
kp.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); key(b.dataset.k); } });
const R = (a, b) => a + MG.rand(b - a + 1);
function make() {
  const lv = api.level;
  const ops = lv === 'easy' ? ['+', '−'] : lv === 'medium' ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
  const op = MG.pick(ops);
  let a, b, ans;
  if (op === '+') { a = lv === 'hard' ? R(12, 99) : R(1, lv === 'easy' ? 10 : 50); b = lv === 'hard' ? R(12, 99) : R(1, lv === 'easy' ? 10 : 50); ans = a + b; }
  else if (op === '−') { a = lv === 'hard' ? R(20, 150) : R(2, lv === 'easy' ? 20 : 60); b = R(1, a - (lv === 'hard' ? 0 : 1)); ans = a - b; }
  else if (op === '×') { a = R(2, lv === 'hard' ? 19 : 12); b = R(2, 12); ans = a * b; }
  else { b = R(2, 12); ans = R(2, 15); a = b * ans; }
  return { text: `${a} ${op} ${b}`, ans };
}
function newGame() {
  clearInterval(tick);
  S = { score: 0, right: 0, wrong: 0, left: 60000, q: make(), typed: '' };
  card = MG.h('div', { class: 'mm', html: '<div><p class="q"></p><p class="a"></p></div><div class="bar"><i></i></div>' });
  api.board.innerHTML = ''; api.board.appendChild(card);
  api.begin(); show();
  let last = performance.now();
  tick = setInterval(() => {
    const now = performance.now(), dt = now - last; last = now;
    if (!api.canPlay() || document.hidden || MG.anyDialogOpen()) return;
    S.left -= dt;
    MG.qs('.bar i', card).style.transform = `scaleX(${Math.max(0, S.left / 60000)})`;
    MG.qs('[data-t]', api.mid).textContent = Math.max(0, Math.ceil(S.left / 1000));
    if (S.left <= 0) end();
  }, 100);
}
function show() { MG.qs('.q', card).textContent = S.q.text + ' ='; MG.qs('.a', card).textContent = S.typed; api.progress(`Score ${S.score}`, `${S.right} right, ${S.wrong} wrong so far.`, null, 0, 'info'); }
function key(k) {
  if (!S || !api.canPlay() || S.left <= 0) return;
  if (k === '⌫' || k === 'Backspace') S.typed = S.typed.slice(0, -1);
  else if (k === '−' || k === '-') S.typed = S.typed.startsWith('-') ? S.typed.slice(1) : '-' + S.typed;
  else if (k === 'ok' || k === 'Enter') { if (S.typed && S.typed !== '-') submit(); return; }
  else if (/^\d$/.test(k) && S.typed.length < 6) S.typed += k;
  MG.sfx.tap(); show();
}
function submit() {
  api.dirty = true;
  if (+S.typed === S.q.ans) { S.score++; S.right++; MG.sfx.blip(760, .07); MG.replay(card, 'good', 250); }
  else { S.wrong++; MG.sfx.wrong(); MG.replay(card, 'bad', 300); api.coach('mistake', `${S.q.text} = ${S.q.ans}`, `You answered ${S.typed}.`, 2200); }
  MG.qs('[data-s]', api.mid).textContent = S.score;
  S.q = make(); S.typed = ''; show();
}
function end() {
  clearInterval(tick);
  api.over({ value: S.score, title: "Time's up", sub: `${S.right} right and ${S.wrong} wrong in a minute.`, facts: [[S.right, 'Right'], [S.wrong, 'Wrong'], [S.right ? (60 / S.right).toFixed(1) + 's' : '–', 'Per answer']] });
}
MG.onKey(e => { if (/^\d$/.test(e.key) || ['Backspace', 'Enter', '-'].includes(e.key)) { e.preventDefault(); key(e.key); } });
newGame();
})();
