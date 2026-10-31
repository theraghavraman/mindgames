/* Echo: watch the pads light up, then repeat the sequence. It grows by one each round. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.ec { position: absolute; inset: 4%; border-radius: 50%; background: var(--frame); display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 4%; padding: 5%; }
.ec button { border: 0; cursor: pointer; opacity: .58; transition: opacity .12s, transform .12s, box-shadow .12s; box-shadow: inset 0 -6px 0 rgba(0,0,0,.18); }
.ec button:nth-child(1) { border-radius: 100% 8% 8% 8%; background: var(--c-sudoku); } .ec button:nth-child(2) { border-radius: 8% 100% 8% 8%; background: var(--c-logic); }
.ec button:nth-child(3) { border-radius: 8% 8% 8% 100%; background: var(--c-duels); } .ec button:nth-child(4) { border-radius: 8% 8% 100% 8%; background: var(--c-moves); }
:root[data-theme="dark"] .ec button:nth-child(1) { background: var(--c-sudoku-deep); } :root[data-theme="dark"] .ec button:nth-child(2) { background: var(--c-logic-deep); }
:root[data-theme="dark"] .ec button:nth-child(3) { background: var(--c-duels-deep); } :root[data-theme="dark"] .ec button:nth-child(4) { background: var(--c-moves-deep); }
.ec button.lit { opacity: 1; transform: scale(1.03); box-shadow: 0 0 34px 6px rgba(255,255,255,.35), inset 0 -6px 0 rgba(0,0,0,.18); }
.ec .hub { position: absolute; left: 50%; top: 50%; width: 30%; height: 30%; transform: translate(-50%, -50%); border-radius: 50%; background: var(--sheet); display: grid; place-items: center; text-align: center; font-weight: 850; font-size: 7cqi; font-variation-settings: 'CASL' 1; box-shadow: 0 0 0 6px var(--frame); pointer-events: none; }
.ec-wrap { position: absolute; inset: 0; container-type: inline-size; }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, gap: 620, desc: 'An unhurried tempo.' },
  medium: { name: 'Medium', rank: 2, gap: 470, desc: 'The classic pace.' },
  hard: { name: 'Hard', rank: 3, gap: 330, desc: 'Quick, and it speeds up as the sequence grows.' },
};
const TONES = [329.63, 261.63, 220, 164.81];
const RULES = `<p>Watch the pads light up, then repeat the same sequence by tapping them.</p><ul><li>Each round adds one more step to the end of the sequence.</li><li>One wrong tap ends the game. Your score is the longest sequence you repeated.</li></ul><p>Keys <kbd>1</kbd> to <kbd>4</kbd> work too. Turn sound on: each pad has its own note.</p>`;
let S = null, pads = [], hub = null;
const api = MG.shell({ id: 'echo', title: 'Echo', chapter: 'brain', levels: LEVELS, metric: 'score', timer: false, rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 480 } });
api.mid.innerHTML = '<span class="pill">Length <b data-l>0</b></span>';
function newGame() {
  const wrap = MG.h('div', { class: 'ec-wrap' }), box = MG.h('div', { class: 'ec', role: 'group', 'aria-label': 'Four pads' });
  pads = MG.range(4).map(k => { const b = MG.h('button', { type: 'button', 'data-k': k, 'aria-label': ['Yellow', 'Pink', 'Blue', 'Green'][k] + ' pad' }); box.appendChild(b); return b; });
  hub = MG.h('div', { class: 'hub', text: 'Ready' }); box.appendChild(hub);
  wrap.appendChild(box); api.board.innerHTML = ''; api.board.appendChild(wrap);
  MG.press(box, 'button', b => press(+b.dataset.k));
  S = { seq: [], at: 0, listening: false, best: 0 };
  api.begin(); next();
}
const light = (k, ms) => { const pad = pads[k]; pad.classList.add('lit'); MG.sfx.tone(TONES[k], ms / 1000 + .05, 'triangle', .07); setTimeout(() => pad.classList.remove('lit'), ms); };
async function next() {
  S.seq.push(MG.rand(4)); S.at = 0; S.listening = false;
  const gap = Math.max(170, LEVELS[api.level].gap - (api.level === 'hard' ? S.seq.length * 9 : 0));
  hub.textContent = S.seq.length; MG.qs('[data-l]', api.mid).textContent = S.seq.length - 1;
  api.progress('Watch', `Sequence of ${S.seq.length}.`, null, 0, 'info');
  if (!await api.wait(700)) return;
  for (const k of S.seq) { light(k, gap * .7); if (!await api.wait(gap)) return; }
  S.listening = true; api.progress('Your turn', `Repeat all ${S.seq.length} steps.`, 0, S.seq.length, 'turn');
}
function press(k) {
  if (!S || !S.listening || !api.canPlay()) return;
  light(k, 220); api.dirty = true;
  if (k !== S.seq[S.at]) {
    S.listening = false; MG.sfx.wrong();
    const score = S.seq.length - 1;
    hub.textContent = '✕';
    api.over({ value: score, title: 'Sequence broken', big: String(score), sub: score ? `You repeated a sequence of ${score}.` : 'The first step was a different pad.', facts: [[score, 'Longest sequence'], [Math.max(score, api.stats.get(api.level).best || 0), 'Best'], [LEVELS[api.level].name, 'Tempo']] });
    return;
  }
  S.at++;
  api.progress('Your turn', `${S.at} of ${S.seq.length}.`, S.at / S.seq.length, S.seq.length, 'turn');
  if (S.at === S.seq.length) { S.listening = false; hub.textContent = '✓'; api.later(next, 450); }
}
MG.onKey(e => { if (/^[1-4]$/.test(e.key)) press(+e.key - 1); });
newGame();
})();
