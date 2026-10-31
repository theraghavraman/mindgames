/* Pipes: rotate tiles until every pipe connects back to the power source with no loose ends */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.pp { position: absolute; inset: 0; display: grid; gap: 2px; padding: 2px; border-radius: 12px; background: var(--frame); }
.pp button { position: relative; border: 0; padding: 0; border-radius: 6px; background: var(--sheet); cursor: pointer; overflow: hidden; }
.pp svg { position: absolute; inset: 0; width: 100%; height: 100%; transition: transform .16s ease-out; }
.pp .pipe { stroke: var(--pencil); stroke-width: 22; stroke-linecap: round; fill: none; transition: stroke .2s; }
.pp .on .pipe { stroke: var(--c-moves-deep); filter: drop-shadow(0 0 5px color-mix(in srgb, var(--c-moves-deep) 60%, transparent)); }
.pp .end { fill: var(--sheet); stroke: var(--pencil); stroke-width: 9; transition: fill .2s, stroke .2s; }
.pp .on .end { fill: var(--c-sudoku); stroke: var(--c-moves-deep); }
.pp .src { fill: var(--c-moves-deep); }
.pp.won button { animation: pop .4s var(--d, 0ms) both; }
`);
const LEVELS = {
  easy: { name: '5×5', rank: 1, n: 5, desc: 'Twenty-five tiles.' },
  medium: { name: '7×7', rank: 2, n: 7, desc: 'Forty-nine tiles.' },
  hard: { name: '9×9', rank: 3, n: 9, desc: 'Eighty-one tiles.' },
};
const RULES = `<p>Connect every tile to the power source in the middle.</p><ul>
<li>Tap a tile to turn it a quarter turn clockwise. Right-click or long-press turns it back.</li>
<li>Connected pipes light up. Every lamp at a dead end must light, and no pipe may point at nothing.</li></ul>
<p>On a keyboard, move with the arrow keys and press <kbd>Enter</kbd> or <kbd>Space</kbd> to turn a tile. Hold <kbd>Shift</kbd> to turn it back.</p>
<p class="tip">The network is a tree: there's never a loop. Start from the edges: a pipe on the border can't point outwards.</p>`;
const DIRS = [[-1, 0, 1], [0, 1, 2], [1, 0, 4], [0, -1, 8]];
const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
const rot = (m, k) => { for (let t = 0; t < (k & 3); t++) m = ((m << 1) | (m >> 3)) & 15; return m; };
function tree(n) {
  for (;;) {
    const conn = new Array(n * n).fill(0), inT = new Uint8Array(n * n), deg = new Uint8Array(n * n), src = ((n / 2) | 0) * n + ((n / 2) | 0);
    inT[src] = 1; const front = [];
    const push = i => { const r = (i / n) | 0, c = i % n; for (const [dr, dc, b] of DIRS) { const r2 = r + dr, c2 = c + dc; if (r2 >= 0 && c2 >= 0 && r2 < n && c2 < n) front.push([i, r2 * n + c2, b]); } };
    push(src);
    while (front.length) {
      const k = MG.rand(front.length), [a, b, bit] = front[k]; front.splice(k, 1);
      if (inT[b] || deg[a] >= 3) continue;
      inT[b] = 1; conn[a] |= bit; conn[b] |= OPP[bit]; deg[a]++; deg[b]++; push(b);
    }
    if (inT.every(Boolean)) return { conn, src };
  }
}
let S = null, els = [], box = null;
const api = MG.shell({ id: 'pipes', title: 'Pipes', chapter: 'moves', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: restart, size: { ar: 1, chrome: 220, maxW: 600 } });
api.mid.innerHTML = '<span class="pill">Turns <b data-t>0</b></span>';
function newGame(level) {
  const n = LEVELS[level].n, { conn, src } = tree(n);
  const turns = conn.map(() => MG.rand(4));
  S = { n, conn, src, start: turns.slice(), turns, moves: 0 };
  if (solved()) return newGame(level);
  build(); api.begin(); render();
}
function restart() { S.turns = S.start.slice(); S.moves = 0; build(); api.begin(); render(); }
const shape = i => rot(S.conn[i], S.turns[i]);
function tileSVG(i) {
  const m = S.conn[i], deg = [1, 2, 4, 8].filter(b => m & b).length;
  let p = '';
  if (m & 1) p += 'M50 50V-5'; if (m & 2) p += 'M50 50H105'; if (m & 4) p += 'M50 50V105'; if (m & 8) p += 'M50 50H-5';
  const mid = i === S.src ? '<circle class="src" cx="50" cy="50" r="24"/><path d="M53 34l-10 18h9l-4 14 12-19h-9z" fill="var(--sheet)"/>' : deg === 1 ? '<rect class="end" x="30" y="30" width="40" height="40" rx="8"/>' : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="pipe" d="${p}"/>${mid}</svg>`;
}
function build() {
  box = MG.h('div', { class: 'pp', role: 'grid', 'aria-label': 'Pipe tiles' });
  box.style.gridTemplateColumns = `repeat(${S.n}, 1fr)`;
  els = S.conn.map((_, i) => { const b = MG.h('button', { type: 'button', 'data-i': i, html: tileSVG(i) }); box.appendChild(b); return b; });
  api.board.innerHTML = ''; api.board.appendChild(box);
  MG.gridKeys(box, els, S.n, (i, e) => { if (!MG.activates(e)) return false; turn(i, e.shiftKey ? 3 : 1); return true; });
  let lp = 0, longed = false;
  box.addEventListener('contextmenu', e => { e.preventDefault(); const b = e.target.closest('button'); if (b) turn(+b.dataset.i, 3); });
  box.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (!b || e.button === 2) return; longed = false; clearTimeout(lp); lp = setTimeout(() => { longed = true; turn(+b.dataset.i, 3); }, 420); });
  box.addEventListener('pointerup', e => { clearTimeout(lp); const b = e.target.closest('button'); if (b && !longed && e.button === 0) turn(+b.dataset.i, 1); });
  box.addEventListener('pointerleave', () => clearTimeout(lp));
}
function lit() {
  const n = S.n, on = new Uint8Array(n * n), st = [S.src]; on[S.src] = 1;
  while (st.length) {
    const a = st.pop(), r = (a / n) | 0, c = a % n, m = shape(a);
    for (const [dr, dc, b] of DIRS) { if (!(m & b)) continue; const r2 = r + dr, c2 = c + dc; if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n) continue; const j = r2 * n + c2; if (!on[j] && (shape(j) & OPP[b])) { on[j] = 1; st.push(j); } }
  }
  return on;
}
function solved() {
  const n = S.n;
  for (let i = 0; i < n * n; i++) { const r = (i / n) | 0, c = i % n, m = shape(i); for (const [dr, dc, b] of DIRS) { if (!(m & b)) continue; const r2 = r + dr, c2 = c + dc; if (r2 < 0 || c2 < 0 || r2 >= n || c2 >= n || !(shape(r2 * n + c2) & OPP[b])) return false; } }
  return lit().every(Boolean);
}
function turn(i, k) {
  if (!api.canPlay()) return;
  S.turns[i] += k; S.moves++; api.dirty = true;
  MG.sfx.tap(); render();
  if (solved()) {
    box.classList.add('won'); els.forEach((el, j) => el.style.setProperty('--d', (Math.abs(((j / S.n) | 0) - ((S.src / S.n) | 0)) + Math.abs(j % S.n - S.src % S.n)) * 45 + 'ms'));
    const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
    api.win({ title: 'Power everywhere', sub: `Every tile connected in ${MG.plural(S.moves, 'turn')}.`, facts: [[S.moves, 'Turns'], [MG.fmtTime(t), 'Time'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  }
}
function render() {
  const on = lit();
  els.forEach((el, i) => { el.classList.toggle('on', !!on[i]); MG.qs('svg', el).style.transform = `rotate(${S.turns[i] * 90}deg)`; el.setAttribute('aria-label', `Row ${((i / S.n) | 0) + 1}, column ${i % S.n + 1}: ${on[i] ? 'powered' : 'not powered'}`); });
  MG.qs('[data-t]', api.mid).textContent = S.moves;
  const k = on.reduce((s, v) => s + v, 0);
  if (api.status === 'playing') api.progress(`${k} of ${S.n * S.n} tiles powered`, 'Tap to turn a tile. Every pipe end must meet another pipe.', k / (S.n * S.n), Math.min(60, S.n * S.n));
}
newGame(api.level);
})();
