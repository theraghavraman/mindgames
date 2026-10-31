/* Nim: take any number of stones from one row. Hard plays the perfect nim-sum strategy. */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.nm2 { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 4%; padding: 6%; border-radius: 18px; background: var(--sheet); border: 1px solid var(--rule); }
.nm2 .heap { display: flex; align-items: center; gap: 3%; min-height: 0; flex: 1; max-height: 64px; }
.nm2 .heap b { width: 1.6em; font-size: 14px; color: var(--pencil); text-align: right; flex: none; }
.nm2 .st { flex: 0 1 11%; aspect-ratio: 1; max-height: 100%; border: 0; border-radius: 50%; background: var(--c-duels-deep); box-shadow: inset 0 -4px 0 rgba(0,0,0,.2), inset 0 3px 0 rgba(255,255,255,.25); cursor: pointer; transition: transform .15s, opacity .25s, background-color .15s; }
.nm2 .st.pick { background: var(--red); transform: translateY(-12%); }
.nm2 .st.gone { opacity: 0; transform: scale(.3); }
.nm2 .st:disabled { cursor: default; }
`);
const RULES = `<p>Players take turns removing stones.</p><ul>
<li>On your turn, take as many stones as you like, at least one, but all from the <b>same row</b>.</li>
<li>Whoever takes the <b>last stone wins</b>. Switch on “Last stone loses” in Settings to play the misère version instead.</li></ul>
<p>Tap a stone to select it and every stone to its right, then press <b>Take</b> (or tap the stone again).</p>
<p class="tip">The secret: write each row's size in binary and XOR them together. Leave your opponent a total of zero and you can't lose.</p>`;
const LV = MG.duelLevels('Moves almost at random.', 'Plays the perfect move about half the time.', 'Plays the perfect strategy. Win only if it can’t.');
let S = null, rowsEl = null;
const api = MG.duelShell({ id: 'nim', title: 'Nim', levels: LV, rules: RULES, onNew: newGame, size: { ar: 1.25, chrome: 260, maxW: 600 },
  settings: [{ key: 'misere', label: 'Last stone loses', desc: 'Misère rules: whoever takes the final stone loses.', def: false }], onSetting: () => newGame() });
const bar = MG.h('div', { class: 'bar' });
bar.innerHTML = `<button type="button" class="btn btn-primary" data-take disabled>Take</button>`;
api.controls.appendChild(bar);
const takeBtn = MG.qs('[data-take]', bar);
takeBtn.addEventListener('click', () => take());
function newGame() {
  let heaps;
  do { const k = 3 + MG.rand(2); heaps = MG.range(k).map(() => 1 + MG.rand(7)); } while (heaps.reduce((a, b) => a + b, 0) < 8);
  S = { heaps, start: heaps.slice(), turn: api.nextFirst() === 'you' ? 1 : 2, pick: null, over: false, mis: !!api.pref('misere') };
  rowsEl = MG.h('div', { class: 'nm2', role: 'group', 'aria-label': 'Rows of stones' });
  api.board.innerHTML = ''; api.board.appendChild(rowsEl);
  rowsEl.addEventListener('click', e => { const b = e.target.closest('.st'); if (!b || b.disabled) return; const h = +b.dataset.h, k = +b.dataset.k;
    if (S.pick && S.pick.h === h && S.pick.k === k) take(); else { S.pick = { h, k }; MG.sfx.tap(); render(); } });
  api.begin(); render();
  if (S.turn === 2) api.think(cpu, 700);
}
function best(heaps) {
  const x = heaps.reduce((a, b) => a ^ b, 0), big = heaps.filter(v => v > 1).length;
  if (S.mis && big <= 1) {
    if (big === 1) { const h = heaps.findIndex(v => v > 1), ones = heaps.filter((v, i) => i !== h && v === 1).length; return [h, heaps[h] - (ones % 2 ? 0 : 1)]; }
    const h = heaps.findIndex(v => v > 0); return [h, 1];
  }
  if (!x) return null;
  const h = heaps.findIndex(v => (v ^ x) < v); return [h, heaps[h] - (heaps[h] ^ x)];
}
function cpu() {
  const lvl = api.level, live = S.heaps.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  let mv = (lvl === 'hard' || (lvl === 'medium' && Math.random() < .5) || (lvl === 'easy' && Math.random() < .15)) ? best(S.heaps) : null;
  if (!mv) { const h = MG.pick(live); mv = [h, 1 + MG.rand(Math.min(S.heaps[h], lvl === 'easy' ? 3 : S.heaps[h]))]; }
  S.pick = { h: mv[0], k: S.heaps[mv[0]] - mv[1] }; render();
  setTimeout(() => take(true), 650);
}
function take(fromCpu) {
  if (!S.pick || S.over || (!fromCpu && (S.turn !== 1 || !api.canPlay()))) return;
  const { h, k } = S.pick, n = S.heaps[h] - k;
  MG.qsa(`.st[data-h="${h}"]`, rowsEl).forEach(b => { if (+b.dataset.k >= k) b.classList.add('gone'); });
  S.heaps[h] = k; S.pick = null; api.dirty = true;
  fromCpu ? MG.sfx.move() : MG.sfx.place();
  api.coach(fromCpu ? 'cpu' : 'turn', fromCpu ? `The computer took ${MG.plural(n, 'stone')}` : `You took ${MG.plural(n, 'stone')}`, `From row ${h + 1}.`, 2200);
  setTimeout(() => {
    if (S.heaps.every(v => !v)) {
      S.over = true; render();
      const lastWasYou = !fromCpu, youWin = S.mis ? !lastWasYou : lastWasYou;
      const why = S.mis ? (youWin ? 'The computer had to take the last stone.' : 'You had to take the last stone.') : (youWin ? 'You took the last stone.' : 'The computer took the last stone.');
      return youWin ? api.win({ title: 'You win', sub: why }) : api.lose({ title: 'The computer wins', sub: why });
    }
    S.turn = 3 - S.turn; render();
    if (S.turn === 2) api.think(cpu, 650);
  }, 300);
}
function render() {
  rowsEl.innerHTML = S.heaps.map((v, h) => `<div class="heap"><b>${v}</b>${MG.range(S.start[h]).map(k => k < v ? `<button type="button" class="st${S.pick && S.pick.h === h && k >= S.pick.k ? ' pick' : ''}" data-h="${h}" data-k="${k}" aria-label="Row ${h + 1}, stone ${k + 1}"${S.turn !== 1 || S.over ? ' disabled' : ''}></button>` : '').join('')}</div>`).join('');
  const n = S.pick ? S.heaps[S.pick.h] - S.pick.k : 0;
  takeBtn.disabled = !S.pick || S.turn !== 1 || S.over;
  takeBtn.textContent = n ? `Take ${MG.plural(n, 'stone')}` : 'Take';
  const st = api.stats.get(api.level); api.score(st.won, st.lost);
  if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? (S.mis ? 'Avoid taking the last stone.' : 'Take the last stone to win.') : '');
}
newGame();
})();
