/* Mancala (Kalah rules): sow seeds counter-clockwise, land in your store for another turn, capture from empty pits */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.mc { position: absolute; inset: 0; border-radius: 26px; background: color-mix(in srgb, var(--c-numbers-deep) 55%, var(--frame)); padding: 3%; display: grid; grid-template-columns: 1fr 6fr 1fr; gap: 2%; container-type: inline-size; }
.mc .row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4%; }
.mc .mid { display: grid; grid-template-rows: 1fr 1fr; gap: 8%; }
.mc .pit, .mc .store { position: relative; border: 0; border-radius: 999px; background: rgba(0,0,0,.28); box-shadow: inset 0 4px 10px rgba(0,0,0,.35); display: grid; place-items: center; color: #fff; font-weight: 820; font-size: 3.4cqi; padding: 0; }
.mc .pit { aspect-ratio: 1; align-self: center; cursor: default; }
.mc .pit.ok { cursor: pointer; box-shadow: inset 0 4px 10px rgba(0,0,0,.35), 0 0 0 3px var(--c-sudoku); }
.mc .pit.ok:hover { background: rgba(0,0,0,.18); }
.mc .pit.hot, .mc .store.hot { background: rgba(255,255,255,.22); }
.mc .seeds { position: absolute; inset: 18%; pointer-events: none; }
.mc .seeds i { position: absolute; width: 22%; height: 22%; border-radius: 50%; box-shadow: inset 0 -2px 0 rgba(0,0,0,.25); }
.mc .n { position: absolute; bottom: -2px; right: 6%; font-size: 2.6cqi; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.mc .store .n { position: static; font-size: 4.4cqi; }
`);
const RULES = `<p>Collect more seeds in your store than the computer does. Your pits are the bottom row, your store is on the right.</p><ul>
<li>Pick one of your pits. Its seeds are sown one by one, counter-clockwise, into the following pits and your own store, skipping the computer's store.</li>
<li>If your last seed lands in your <b>store</b>, you take another turn.</li>
<li>If your last seed lands in an <b>empty pit on your side</b> and the pit opposite has seeds, you capture both into your store.</li>
<li>When one side has no seeds left, the other player banks every seed still on their side and the game ends.</li></ul>`;
const LV = MG.duelLevels('Looks one move ahead.', 'Looks four moves ahead.', 'Looks eight moves ahead.');
const DEPTH = { easy: 1, medium: 4, hard: 8 };
const SEED = ['#FFE15A', '#FF8CC8', '#8FD3FF', '#B4E66A', '#FFB25C', '#CDBDFF'];
let S = null, els = [], busy = false;
const api = MG.duelShell({ id: 'mancala', title: 'Mancala', youLabel: 'Your store', cpuLabel: 'Computer', levels: LV, rules: RULES, onNew: newGame, size: { ar: 2.2, chrome: 230, maxW: 820 } });
const own = (p, i) => (p === 1 ? i >= 0 && i <= 5 : i >= 7 && i <= 12);
const store = p => (p === 1 ? 6 : 13);
function sow(b, pit, p) {
  let s = b[pit], i = pit; b[pit] = 0; const path = [];
  while (s) { i = (i + 1) % 14; if (i === store(3 - p)) continue; b[i]++; s--; path.push(i); }
  let again = i === store(p), capture = null;
  if (own(p, i) && b[i] === 1 && b[12 - i] > 0) { capture = [i, 12 - i]; b[store(p)] += b[i] + b[12 - i]; b[i] = 0; b[12 - i] = 0; }
  let over = false;
  const a = [0, 1, 2, 3, 4, 5].reduce((t, k) => t + b[k], 0), c = [7, 8, 9, 10, 11, 12].reduce((t, k) => t + b[k], 0);
  if (!a || !c) { for (let k = 0; k < 6; k++) { b[6] += b[k]; b[k] = 0; b[13] += b[k + 7]; b[k + 7] = 0; } over = true; again = false; }
  return { path, again, capture, over };
}
function search(b, p, depth, alpha, beta) {
  const moves = (p === 2 ? [7, 8, 9, 10, 11, 12] : [0, 1, 2, 3, 4, 5]).filter(i => b[i]);
  if (!depth || !moves.length) return b[13] - b[6];
  if (p === 2) { let v = -Infinity; for (const m of moves) { const nb = b.slice(), r = sow(nb, m, 2); v = Math.max(v, r.over ? (nb[13] - nb[6]) * 10 : search(nb, r.again ? 2 : 1, depth - 1, alpha, beta)); alpha = Math.max(alpha, v); if (alpha >= beta) break; } return v; }
  let v = Infinity; for (const m of moves) { const nb = b.slice(), r = sow(nb, m, 1); v = Math.min(v, r.over ? (nb[13] - nb[6]) * 10 : search(nb, r.again ? 1 : 2, depth - 1, alpha, beta)); beta = Math.min(beta, v); if (alpha >= beta) break; } return v;
}
function cpuPick() {
  const moves = [7, 8, 9, 10, 11, 12].filter(i => S.b[i]);
  if (api.level === 'easy' && Math.random() < .4) return MG.pick(moves);
  let best = -Infinity, pick = moves[0];
  for (const m of moves) { const nb = S.b.slice(), r = sow(nb, m, 2); const v = r.over ? (nb[13] - nb[6]) * 10 : search(nb, r.again ? 2 : 1, DEPTH[api.level] - 1, -Infinity, Infinity); if (v > best) { best = v; pick = m; } }
  return pick;
}
function newGame() {
  S = { b: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], turn: api.nextFirst() === 'you' ? 1 : 2, over: false };
  const box = MG.h('div', { class: 'mc', role: 'application', 'aria-label': 'Mancala board' });
  const st2 = MG.h('div', { class: 'store', 'data-i': 13 }), st1 = MG.h('div', { class: 'store', 'data-i': 6 });
  const mid = MG.h('div', { class: 'mid' }), top = MG.h('div', { class: 'row' }), bot = MG.h('div', { class: 'row' });
  els = [];
  for (let i = 12; i >= 7; i--) { const b = MG.h('button', { type: 'button', class: 'pit', 'data-i': i }); top.appendChild(b); els[i] = b; }
  for (let i = 0; i <= 5; i++) { const b = MG.h('button', { type: 'button', class: 'pit', 'data-i': i }); bot.appendChild(b); els[i] = b; }
  els[6] = st1; els[13] = st2;
  mid.append(top, bot); box.append(st2, mid, st1);
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('.pit'); if (b && S.turn === 1 && !busy && !S.over && api.canPlay()) play(+b.dataset.i); });
  busy = false; api.begin(); render();
  if (S.turn === 2) api.think(() => play(cpuPick()), 700);
}
async function play(pit) {
  if (!own(S.turn, pit) || !S.b[pit]) return;
  busy = true; api.dirty = true;
  const before = S.b.slice(), r = sow(S.b, pit, S.turn), shown = before.slice();
  shown[pit] = 0; draw(shown);
  for (const i of r.path) { shown[i]++; draw(shown, i); MG.sfx.tone(300 + i * 25, .05, 'sine', .03); await MG.sleep(MG.reduced() ? 0 : 140); }
  if (r.capture) { MG.sfx.unit(); api.coach(S.turn === 1 ? 'good' : 'cpu', S.turn === 1 ? 'Capture!' : 'The computer captures', 'The last seed landed in an empty pit, taking the pit opposite too.', 2600); }
  else if (r.again) api.coach(S.turn === 1 ? 'good' : 'cpu', S.turn === 1 ? 'Another turn' : 'The computer goes again', 'The last seed landed in the store.', 2200);
  busy = false;
  if (r.over) { S.over = true; render(); return finish(); }
  if (!r.again) S.turn = 3 - S.turn;
  render();
  if (S.turn === 2) api.think(() => play(cpuPick()), 650);
}
function finish() {
  const you = S.b[6], cpu = S.b[13], facts = [[you, 'Your seeds'], [cpu, 'Computer seeds'], [48, 'Seeds in play']];
  if (you > cpu) api.win({ title: 'You win', sub: `${you} seeds to ${cpu}.`, facts });
  else if (cpu > you) api.lose({ title: 'The computer wins', sub: `${cpu} seeds to ${you}.`, facts });
  else api.draw({ title: 'Draw', sub: '24 seeds each.', facts });
}
function draw(b, hot = -1) {
  els.forEach((el, i) => {
    const n = b[i], dots = Math.min(n, 12);
    el.innerHTML = (i === 6 || i === 13 ? '' : `<span class="seeds">${MG.range(dots).map(k => { const a = k * 2.399, r = 32 * Math.sqrt(k / 12); return `<i style="left:${39 + r * Math.cos(a)}%;top:${39 + r * Math.sin(a)}%;background:${SEED[(i + k) % SEED.length]}"></i>`; }).join('')}</span>`) + `<span class="n">${n}</span>`;
    el.classList.toggle('hot', i === hot);
    el.setAttribute('aria-label', `${i === 6 ? 'Your store' : i === 13 ? 'Computer store' : own(1, i) ? 'Your pit' : 'Computer pit'}: ${n} seeds`);
  });
}
function render() {
  draw(S.b);
  for (let i = 0; i <= 5; i++) els[i].classList.toggle('ok', S.turn === 1 && !S.over && S.b[i] > 0);
  api.score(S.b[6], S.b[13]);
  if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? 'Pick one of your pits on the bottom row.' : '');
}
newGame();
})();
