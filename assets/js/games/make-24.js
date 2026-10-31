/* Make 24: combine four numbers with + − × ÷ to make exactly 24. Every deal is checked to be solvable. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.m24 { position: absolute; inset: 0; display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 4%; padding: 2%; container-type: inline-size; }
.m24 button { position: relative; border: 0; border-radius: 18px; background: var(--sheet); box-shadow: inset 0 0 0 1.5px var(--rule), 0 10px 26px -18px rgba(20,30,50,.55); cursor: pointer;
  font-size: 15cqi; font-weight: 870; font-variation-settings: 'CASL' 1; color: var(--graphite); transition: transform .15s, background-color .15s, box-shadow .15s; }
.m24 button .fr { font-size: 9cqi; }
.m24 button:hover { transform: translateY(-2px); }
.m24 button.sel { background: var(--ch); box-shadow: inset 0 0 0 3px var(--ch-deep); }
.m24 button.made { color: var(--pen); }
.m24 button.gone { visibility: hidden; }
.m24 button.win { background: var(--c-moves); animation: pop .4s; }
.ops { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.ops button { height: 58px; border: 1px solid var(--rule); border-radius: 12px; background: var(--sheet); font-size: 28px; font-weight: 700; color: var(--pen); cursor: pointer; }
.ops button[aria-pressed="true"] { background: var(--pen); color: var(--on-pen); border-color: var(--pen); }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, max: 9, band: [16, 1e9], desc: 'Numbers 1 to 9, many ways to win.' },
  medium: { name: 'Medium', rank: 2, max: 9, band: [4, 15], desc: 'Numbers 1 to 9, a few ways to win.' },
  hard: { name: 'Hard', rank: 3, max: 13, band: [1, 3], desc: 'Numbers 1 to 13, only one or two ways.' },
};
const RULES = `<p>Use all four numbers once each, with <b>+ − × ÷</b>, to make exactly <b>24</b>.</p><ul>
<li>Tap a number, tap an operation, then tap another number. The two cards combine into one.</li>
<li>Keep combining until one card is left. If it shows 24, you win.</li>
<li>Results can be fractions along the way, like 8 ÷ 3; they count exactly.</li></ul>
<p>Undo steps back one combination. Every deal has at least one solution.</p><p class="tip">Example: 8, 3, 8, 3 → 8 ÷ 3 = 8/3, then 3 − 8/3 = 1/3, then 8 ÷ 1/3 = 24.</p>`;
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const F = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
const OPS = { '+': (a, b) => F(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), '−': (a, b) => F(a[0] * b[1] - b[0] * a[1], a[1] * b[1]), '×': (a, b) => F(a[0] * b[0], a[1] * b[1]), '÷': (a, b) => (b[0] ? F(a[0] * b[1], a[1] * b[0]) : null) };
const show = v => (v[1] === 1 ? String(v[0]) : `${v[0]}/${v[1]}`);
/* All ways to reach 24; each solution is a list of steps [a, op, b, result] */
function solve(cards, limit = 1e9) {
  const out = [];
  const go = (cs, steps) => {
    if (out.length >= limit) return;
    if (cs.length === 1) { if (cs[0][0] === 24 && cs[0][1] === 1) out.push(steps); return; }
    for (let i = 0; i < cs.length; i++) for (let j = 0; j < cs.length; j++) {
      if (i === j) continue;
      const rest = cs.filter((_, k) => k !== i && k !== j);
      for (const op of ['+', '−', '×', '÷']) {
        if ((op === '+' || op === '×') && j < i) continue;
        const r = OPS[op](cs[i], cs[j]); if (!r) continue;
        go([...rest, r], [...steps, [cs[i], op, cs[j], r]]);
      }
    }
  };
  go(cards, []);
  return out;
}
let S = null, els = [], op = null, box = null;
const api = MG.shell({ id: 'make-24', title: 'Make 24', chapter: 'numbers', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: reset, size: { ar: 1, chrome: 310, maxW: 520 } });
const ops = MG.h('div', { class: 'ops' });
ops.innerHTML = ['+', '−', '×', '÷'].map(o => `<button type="button" data-o="${o}" aria-pressed="false" aria-label="${{ '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' }[o]}">${o}</button>`).join('');
const tools = MG.h('div', { class: 'tools', style: { '--tools': 3 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-r><span class="ti">${MG.icon('restart')}</span><span>Start over</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}</span><span>Hint</span></button>`;
api.controls.append(ops, tools);
ops.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (!b || !api.canPlay()) return; op = op === b.dataset.o ? null : b.dataset.o; MG.sfx.tap(); render(); });
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else if (b.hasAttribute('data-r')) reset(); else hint(); });
function deal(L) {
  for (let t = 0; t < 4000; t++) {
    const nums = MG.range(4).map(() => 1 + MG.rand(L.max)), n = solve(nums.map(v => [v, 1])).length;
    if (n >= L.band[0] && n <= L.band[1]) return nums;
  }
  return [8, 3, 8, 3];
}
function newGame(level) {
  const nums = deal(LEVELS[level]);
  S = { start: nums, cards: nums.map(v => ({ v: [v, 1], made: false })), sel: -1, hist: [], hints: 0 };
  box = MG.h('div', { class: 'm24', role: 'group', 'aria-label': 'Number cards' });
  els = MG.range(4).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) tap(+b.dataset.i); });
  op = null; api.begin(); render();
}
function reset() {
  if (!S || api.isBusy) return;
  if (api.status !== 'playing') { S.hints = 0; api.begin(); }
  S.cards = S.start.map(v => ({ v: [v, 1], made: false })); S.sel = -1; S.hist = []; op = null; render();
}
const alive = () => S.cards.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
function tap(i) {
  if (!api.canPlay() || !S.cards[i]) return;
  if (S.sel < 0 || !op || S.sel === i) { S.sel = S.sel === i ? -1 : i; MG.sfx.tap(); render(); return; }
  const a = S.cards[S.sel].v, b = S.cards[i].v, r = OPS[op](a, b);
  if (!r) { MG.sfx.wrong(); api.coach('mistake', "Can't divide by zero", 'Pick a different card or operation.', 3000); return; }
  S.hist.push(S.cards.map(c => c && { v: c.v.slice(), made: c.made }));
  S.cards[i] = { v: r, made: true }; S.cards[S.sel] = null; S.sel = i; op = null; api.dirty = true;
  MG.sfx.place(); MG.replay(els[i], 'pop', 300);
  render(); check();
}
function check() {
  const left = alive();
  if (left.length !== 1) return;
  const v = S.cards[left[0]].v;
  if (v[0] === 24 && v[1] === 1) {
    els[left[0]].classList.add('win');
    const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
    api.win({ title: 'Twenty-four', sub: `From ${S.start.join(', ')}.`, facts: [[S.hints, 'Hints used'], [MG.fmtTime(t), 'Time'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  } else { MG.sfx.wrong(); api.coach('mistake', `That makes ${show(v)}, not 24`, 'Undo a step or start over.', 4500); }
}
function undo() { if (!api.canPlay() || !S.hist.length) return; S.cards = S.hist.pop(); S.sel = -1; op = null; MG.sfx.note(); render(); }
function hint() {
  if (!api.canPlay()) return;
  let sol = solve(alive().map(i => S.cards[i].v), 1)[0], from = 'from here';
  if (!sol) { sol = solve(S.start.map(v => [v, 1]), 1)[0]; from = 'from the start'; }
  const [a, o, b, r] = sol[0];
  S.hints++; MG.sfx.hint();
  api.coach('hint', `Try ${show(a)} ${o} ${show(b)} = ${show(r)}`, from === 'from here' ? 'That is the first step of a solution from these cards.' : "These cards can't reach 24; start over and begin with that step.", 7000);
}
function render() {
  S.cards.forEach((c, i) => {
    const el = els[i];
    el.className = !c ? 'gone' : (i === S.sel ? 'sel' : '') + (c.made ? ' made' : '');
    if (c) { const t = show(c.v); el.innerHTML = c.v[1] === 1 ? t : `<span class="fr">${t}</span>`; el.setAttribute('aria-label', 'Card ' + t); }
  });
  MG.qsa('[data-o]', ops).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.o === op)));
  if (api.status === 'playing') api.progress(`${MG.plural(alive().length, 'card')} left`, S.sel < 0 ? 'Tap a number to start.' : !op ? 'Now pick + − × or ÷.' : 'Now tap the second number.', null, 0);
}
MG.onKey(e => { const o = { '+': '+', '-': '−', '*': '×', 'x': '×', '/': '÷' }[e.key]; if (o) { if (api.canPlay()) { op = o; render(); } } else if (/^[1-4]$/.test(e.key)) tap(+e.key - 1); });
MG.debug = { solve, deal, LEVELS };
newGame(api.level);
})();
