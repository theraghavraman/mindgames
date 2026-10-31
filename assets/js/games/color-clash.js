/* Colour Clash: a Stroop test. Answer the ink colour, not the word, for as many cards as you can in time. */
(function () {
'use strict';
const MG = window.MG;
const COLORS = [['Red', '#E5243B'], ['Blue', '#1D6FF0'], ['Green', '#1E9E57'], ['Yellow', '#E8B500'], ['Purple', '#7C3AED'], ['Orange', '#F2700F']];
MG.style(`
.cc { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 18px; background: var(--sheet); border: 1px solid var(--rule); container-type: inline-size; text-align: center; }
.cc .ask { font-size: 4.2cqi; font-weight: 700; color: var(--graphite-2); }
.cc .word { font-size: 17cqi; font-weight: 900; letter-spacing: -.02em; font-variation-settings: 'CASL' 1; line-height: 1; }
.cc .word.in { animation: pop .22s ease-out; }
.cc .bar { position: absolute; left: 6%; right: 6%; bottom: 7%; height: 8px; border-radius: 4px; background: var(--rule); overflow: hidden; }
.cc .bar i { display: block; height: 100%; background: var(--ch-deep); transform-origin: left; }
.ans { display: grid; grid-template-columns: repeat(var(--k), 1fr); gap: 8px; }
.ans button { height: 54px; border: 0; border-radius: 12px; color: #fff; font-weight: 800; font-size: 14px; cursor: pointer; box-shadow: inset 0 -4px 0 rgba(0,0,0,.2); }
.ans button:active { transform: translateY(2px); }
.cc.good { box-shadow: 0 0 0 4px var(--green); } .cc.bad { box-shadow: 0 0 0 4px var(--red); }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, k: 4, secs: 60, swap: false, desc: 'Four colours, always name the ink.' },
  medium: { name: 'Medium', rank: 2, k: 6, secs: 60, swap: false, desc: 'Six colours, always name the ink.' },
  hard: { name: 'Hard', rank: 3, k: 6, secs: 60, swap: true, desc: 'Six colours, and sometimes you name the word instead.' },
};
const RULES = `<p>A colour word appears, printed in a colour that may not match it, like <b style="color:#1D6FF0">Red</b>.</p><ul>
<li>Tap the button for the <b>ink colour</b> of the word, not what the word says.</li>
<li>On Hard, watch the question: sometimes it asks for the <b>word</b> instead.</li>
<li>You have 60 seconds. Right answers score a point; wrong ones lose a point.</li></ul><p class="tip">This is the Stroop effect: reading is so automatic that naming the ink takes effort.</p>`;
let S = null, card = null, ans = null, tick = 0;
const api = MG.shell({ id: 'color-clash', title: 'Colour Clash', chapter: 'brain', levels: LEVELS, metric: 'score', timer: false, rules: RULES, onNew: newGame, size: { ar: 1.4, chrome: 270, maxW: 620 } });
api.mid.innerHTML = '<span class="pill">Score <b data-s>0</b></span><span class="pill">Time <b data-t>60</b></span>';
ans = MG.h('div', { class: 'ans' });
api.controls.appendChild(ans);
MG.press(ans, 'button', b => answer(+b.dataset.k));
function newGame(level) {
  clearInterval(tick);
  const L = LEVELS[level];
  S = { L, score: 0, right: 0, wrong: 0, left: L.secs * 1000, q: null };
  ans.style.setProperty('--k', L.k > 4 ? 3 : 2);
  ans.innerHTML = COLORS.slice(0, L.k).map(([n, c], k) => `<button type="button" data-k="${k}" style="background:${c}">${n}</button>`).join('');
  card = MG.h('div', { class: 'cc', html: '<div><p class="ask"></p><p class="word"></p></div><div class="bar"><i></i></div>' });
  api.board.innerHTML = ''; api.board.appendChild(card);
  api.begin(); ask();
  let last = performance.now();
  tick = setInterval(() => {
    const now = performance.now(), dt = now - last; last = now;
    if (!api.canPlay() || document.hidden || MG.anyDialogOpen()) return;
    S.left -= dt;
    MG.qs('.bar i', card).style.transform = `scaleX(${Math.max(0, S.left / (S.L.secs * 1000))})`;
    MG.qs('[data-t]', api.mid).textContent = Math.max(0, Math.ceil(S.left / 1000));
    if (S.left <= 0) end();
  }, 100);
}
function ask() {
  const k = S.L.k, word = MG.rand(k);
  let ink = MG.rand(k); if (Math.random() < .75) while (ink === word) ink = MG.rand(k);
  const mode = S.L.swap && Math.random() < .35 ? 'word' : 'ink';
  S.q = { word, ink, mode };
  MG.qs('.ask', card).textContent = mode === 'ink' ? 'What colour is the ink?' : 'What does the word say?';
  const w = MG.qs('.word', card);
  w.textContent = COLORS[word][0]; w.style.color = COLORS[ink][1];
  MG.replay(w, 'in', 250);
  api.progress(`Score ${S.score}`, mode === 'ink' ? 'Name the ink colour.' : 'Read the word this time.', null, 0, 'info');
}
function answer(k) {
  if (!S || !api.canPlay() || S.left <= 0) return;
  const want = S.q.mode === 'ink' ? S.q.ink : S.q.word;
  api.dirty = true;
  if (k === want) { S.score++; S.right++; MG.sfx.blip(700, .07); MG.replay(card, 'good', 250); }
  else { S.score = Math.max(0, S.score - 1); S.wrong++; MG.sfx.wrong(); MG.replay(card, 'bad', 300); }
  MG.qs('[data-s]', api.mid).textContent = S.score;
  ask();
}
function end() {
  clearInterval(tick);
  const acc = S.right + S.wrong ? Math.round(S.right / (S.right + S.wrong) * 100) : 0;
  api.over({ value: S.score, title: "Time's up", sub: `${S.right} right, ${S.wrong} wrong.`, facts: [[S.right, 'Right'], [S.wrong, 'Wrong'], [acc + '%', 'Accuracy']] });
}
MG.onKey(e => { if (/^[1-6]$/.test(e.key) && S && +e.key <= S.L.k) answer(+e.key - 1); });
newGame(api.level);
})();
