/* Checkers (English draughts): diagonal moves, forced captures, multi-jumps and kings */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.ck2 { position: absolute; inset: 0; display: grid; grid-template: repeat(8, 1fr) / repeat(8, 1fr); border: 3px solid var(--frame); border-radius: 10px; overflow: hidden; container-type: inline-size; }
.ck2 button { position: relative; border: 0; padding: 0; background: var(--sheet); cursor: default; }
.ck2 button.dk { background: color-mix(in srgb, var(--c-duels-deep) 45%, var(--frame)); }
.ck2 button.can { cursor: pointer; }
.ck2 button.sel { box-shadow: inset 0 0 0 3px var(--c-sudoku); }
.ck2 button.to::after { content: ""; position: absolute; inset: 36%; border-radius: 50%; background: var(--c-sudoku); opacity: .9; }
.ck2 button.to { cursor: pointer; }
.ck2 button.from { box-shadow: inset 0 0 0 3px rgba(255,255,255,.35); }
.ck2 .pc { position: absolute; inset: 12%; border-radius: 50%; display: grid; place-items: center; transition: transform .2s; }
.ck2 .pc.p1 { background: var(--red); box-shadow: inset 0 -4px 0 rgba(0,0,0,.25), inset 0 0 0 5px rgba(255,255,255,.18); }
.ck2 .pc.p2 { background: #f4f1e8; box-shadow: inset 0 -4px 0 rgba(0,0,0,.18), inset 0 0 0 5px rgba(0,0,0,.06); }
.ck2 .pc.k::after { content: "♛"; font-size: 5cqi; line-height: 1; color: rgba(0,0,0,.45); }
.ck2 .pc.p1.k::after { color: rgba(255,255,255,.85); }
`);
const RULES = `<p>Capture every one of the computer's pieces, or leave it without a legal move. You play <b>red</b>, moving up the board.</p><ul>
<li>Pieces move one square diagonally forward onto an empty dark square.</li>
<li>Capture by jumping diagonally over an opponent's piece onto the empty square behind it. <b>Captures are compulsory</b>: if you can jump, you must.</li>
<li>After a jump, keep jumping with the same piece while you can. The whole chain is one move.</li>
<li>A piece reaching the far row becomes a <b>king</b> (marked with a crown) and may move and jump backwards too. Being crowned ends the move.</li>
<li>If 40 moves pass on each side with no capture and no plain piece moving, the game is a draw.</li></ul>`;
const LV = MG.duelLevels('Looks two moves ahead.', 'Looks four moves ahead.', 'Looks six moves ahead.');
const DEPTH = { easy: 2, medium: 4, hard: 6 };
let S = null, els = [];
const api = MG.duelShell({ id: 'checkers', title: 'Checkers', youLabel: 'Taken', cpuLabel: 'Lost', levels: LV, rules: RULES, onNew: newGame, size: { ar: 1, chrome: 220, maxW: 620 } });
/* pieces: 1 red man, 2 red king (you, moving up), -1 / -2 white (computer, moving down) */
const side = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
function movesFor(b, who) {
  const caps = [], steps = [];
  for (let i = 0; i < 64; i++) {
    if (side(b[i]) !== who) continue;
    const king = Math.abs(b[i]) === 2, dirs = king ? [-1, 1] : [who === 1 ? -1 : 1];
    const r = (i / 8) | 0, c = i % 8;
    for (const dr of dirs) for (const dc of [-1, 1]) { const y = r + dr, x = c + dc; if (y >= 0 && y < 8 && x >= 0 && x < 8 && !b[y * 8 + x]) steps.push({ path: [i, y * 8 + x], cap: [] }); }
    const jump = (bd, at, path, cap) => {
      const ry = (at / 8) | 0, rx = at % 8; let more = false;
      for (const dr of dirs) for (const dc of [-1, 1]) {
        const my = ry + dr, mx = rx + dc, ly = ry + 2 * dr, lx = rx + 2 * dc;
        if (ly < 0 || ly > 7 || lx < 0 || lx > 7) continue;
        const mid = my * 8 + mx, land = ly * 8 + lx;
        if (side(bd[mid]) !== -who || bd[land]) continue;
        more = true;
        const nb = bd.slice(); nb[land] = nb[at]; nb[at] = 0; nb[mid] = 0;
        const crowned = !king && (ly === (who === 1 ? 0 : 7));
        if (crowned) caps.push({ path: [...path, land], cap: [...cap, mid] });
        else jump(nb, land, [...path, land], [...cap, mid]);
      }
      if (!more && cap.length) caps.push({ path, cap });
    };
    jump(b, i, [i], []);
  }
  return caps.length ? caps : steps;
}
function apply(b, m) {
  const nb = b.slice(), from = m.path[0], to = m.path[m.path.length - 1];
  nb[to] = nb[from]; if (to !== from) nb[from] = 0;
  for (const k of m.cap) nb[k] = 0;
  const row = (to / 8) | 0;
  if (nb[to] === 1 && row === 0) nb[to] = 2; else if (nb[to] === -1 && row === 7) nb[to] = -2;
  return nb;
}
function evalB(b) {
  let s = 0;
  for (let i = 0; i < 64; i++) { const v = b[i]; if (!v) continue; const r = (i / 8) | 0, c = i % 8, centre = (c >= 2 && c <= 5 && r >= 2 && r <= 5) ? 4 : 0;
    if (v === -1) s += 100 + r * 5 + centre; else if (v === -2) s += 175 + centre; else if (v === 1) s -= 100 + (7 - r) * 5 + centre; else s -= 175 + centre; }
  return s;
}
function search(b, depth, alpha, beta, who) {
  const ms = movesFor(b, who);
  if (!ms.length) return who === -1 ? -1e5 - depth : 1e5 + depth;
  if (!depth) return evalB(b);
  if (who === -1) { let v = -Infinity; for (const m of ms) { v = Math.max(v, search(apply(b, m), depth - 1, alpha, beta, 1)); alpha = Math.max(alpha, v); if (alpha >= beta) break; } return v; }
  let v = Infinity; for (const m of ms) { v = Math.min(v, search(apply(b, m), depth - 1, alpha, beta, -1)); beta = Math.min(beta, v); if (alpha >= beta) break; } return v;
}
function cpuMove() {
  const ms = movesFor(S.b, -1);
  if (api.level === 'easy' && Math.random() < .25) return MG.pick(ms);
  let best = -Infinity, picks = [];
  for (const m of ms) { const v = search(apply(S.b, m), DEPTH[api.level] - 1, -Infinity, Infinity, 1); if (v > best) { best = v; picks = [m]; } else if (v === best) picks.push(m); }
  return MG.pick(picks);
}
function newGame() {
  const b = new Array(64).fill(0);
  for (let i = 0; i < 64; i++) { const r = (i / 8) | 0, c = i % 8; if ((r + c) % 2) { if (r < 3) b[i] = -1; else if (r > 4) b[i] = 1; } }
  S = { b, turn: api.nextFirst() === 'you' ? 1 : -1, sel: -1, prefix: [], quiet: 0, over: false, last: [] };
  const box = MG.h('div', { class: 'ck2', role: 'grid', 'aria-label': 'Checkers board' });
  els = MG.range(64).map(i => { const bt = MG.h('button', { type: 'button', 'data-i': i, class: (((i / 8) | 0) + (i % 8)) % 2 ? 'dk' : '' }); box.appendChild(bt); return bt; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const t = e.target.closest('button'); if (t && S.turn === 1 && !S.over && api.canPlay()) tap(+t.dataset.i); });
  api.begin(); render();
  if (S.turn === -1) api.think(() => commit(cpuMove()), 600);
}
function tap(i) {
  const ms = movesFor(S.b, 1);
  const fromHere = S.sel >= 0 ? ms.filter(m => m.path[0] === S.sel && S.prefix.every((p, k) => m.path[k + 1] === p)) : [];
  const nextSteps = fromHere.filter(m => m.path[S.prefix.length + 1] === i);
  if (nextSteps.length) {
    S.prefix.push(i);
    const done = nextSteps.filter(m => m.path.length === S.prefix.length + 1);
    if (done.length && nextSteps.length === done.length) { commit(done[0]); return; }
    MG.sfx.tap(); render(); return;
  }
  if (S.prefix.length) { MG.replay(els[i], 'nudge', 250); return; }
  if (ms.some(m => m.path[0] === i)) { S.sel = i; S.prefix = []; MG.sfx.tap(); render(); return; }
  if (side(S.b[i]) === 1 && ms.length && ms[0].cap.length) api.coach('info', 'A capture is compulsory', 'One of your pieces can jump, so you have to take it.', 3500);
  S.sel = -1; S.prefix = []; render();
}
function commit(m) {
  const man = Math.abs(S.b[m.path[0]]) === 1;
  S.b = apply(S.b, m); S.sel = -1; S.prefix = []; S.last = m.path; api.dirty = true;
  S.quiet = m.cap.length || man ? 0 : S.quiet + 1;
  m.cap.length ? MG.sfx.unit() : S.turn === 1 ? MG.sfx.place() : MG.sfx.move();
  S.turn = -S.turn; render();
  const ms = movesFor(S.b, S.turn), you = S.b.filter(v => v > 0).length, cpu = S.b.filter(v => v < 0).length, facts = [[you, 'Your pieces'], [cpu, 'Computer pieces'], [S.b.filter(v => Math.abs(v) === 2).length, 'Kings']];
  if (!ms.length) { S.over = true; render(); return S.turn === -1 ? api.win({ title: 'You win', sub: cpu ? 'The computer has no legal move.' : 'Every white piece is captured.', facts }) : api.lose({ title: 'The computer wins', sub: you ? 'You have no legal move.' : 'All your pieces are captured.', facts }); }
  if (S.quiet >= 80) { S.over = true; render(); return api.draw({ title: 'Draw', sub: '40 moves each without a capture or a plain piece moving.', facts }); }
  if (S.turn === -1) api.think(() => commit(cpuMove()), 450);
}
function render() {
  const ms = S.turn === 1 && !S.over ? movesFor(S.b, 1) : [];
  const from = new Set(ms.map(m => m.path[0])), to = new Set(S.sel >= 0 ? ms.filter(m => m.path[0] === S.sel && S.prefix.every((p, k) => m.path[k + 1] === p)).map(m => m.path[S.prefix.length + 1]) : []);
  els.forEach((bt, i) => {
    const v = S.b[i];
    bt.innerHTML = v ? `<span class="pc ${v > 0 ? 'p1' : 'p2'}${Math.abs(v) === 2 ? ' k' : ''}"></span>` : '';
    bt.classList.toggle('can', from.has(i)); bt.classList.toggle('sel', i === S.sel || S.prefix.includes(i)); bt.classList.toggle('to', to.has(i));
    bt.classList.toggle('from', S.last.includes(i) && !v);
  });
  api.score(12 - S.b.filter(v => v < 0).length, 12 - S.b.filter(v => v > 0).length);
  if (!S.over) api.turn(S.turn === 1, S.turn === 1 ? (ms.length && ms[0].cap.length ? 'You must capture.' : 'Tap a red piece, then where it goes.') : '');
}
newGame();
})();
