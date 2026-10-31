/* Knight's Tour: visit every square exactly once with a chess knight */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.kt { position: absolute; inset: 0; display: grid; border: 3px solid var(--frame); border-radius: 10px; overflow: hidden; container-type: inline-size; }
.kt button { position: relative; border: 0; padding: 0; background: var(--sheet); font-size: calc(100cqi / var(--n) * .3); font-weight: 760; color: var(--graphite-2); cursor: default; font-variant-numeric: tabular-nums; }
.kt button.dk { background: color-mix(in srgb, var(--c-moves) 40%, var(--sheet)); }
.kt button.seen { background: var(--ch-soft); color: var(--graphite); }
.kt button.ok { cursor: pointer; } .kt button.ok::after { content: ""; position: absolute; inset: 36%; border-radius: 50%; background: var(--pen); opacity: .55; }
.kt button.ok:hover::after { inset: 26%; }
.kt button.tip::after { background: var(--green); opacity: 1; inset: 30%; }
.kt .path { position: absolute; inset: 0; pointer-events: none; }
.kt .path polyline { fill: none; stroke: var(--c-moves-deep); stroke-width: .06; stroke-linecap: round; stroke-linejoin: round; opacity: .55; }
.kt .kn { position: absolute; inset: 10%; }
.kt .kn path { fill: var(--graphite); }
`);
const LEVELS = {
  easy: { name: '5×5', rank: 1, n: 5, desc: '25 squares, starting in a corner.' },
  medium: { name: '6×6', rank: 2, n: 6, desc: '36 squares.' },
  hard: { name: '8×8', rank: 3, n: 8, desc: 'The full chessboard: 64 squares.' },
};
const RULES = `<p>Move the knight so that it lands on every square of the board exactly once.</p><ul>
<li>A knight moves in an L: two squares one way, then one square sideways.</li>
<li>Dots mark the squares you can jump to. Squares you've visited show the move number and can't be used again.</li>
<li>If the knight has nowhere left to go before the board is full, undo and try another route.</li></ul>
<p class="tip">Warnsdorff's rule: jump to the square with the fewest onward moves. The hint uses it.</p>`;
const KN = '<svg class="kn" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21h11v-2.5c0-3-1.4-5-1.4-8.3 0-3.5-2.6-6.2-6.6-6.7l-.8-1.5-1.6 2.6C5 6 4 8 4.4 10.6l3.4.4 1.8-1.6c.6 2.5-2.6 5.5-2.6 9.1z"/></svg>';
const JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
let S = null, els = [], box = null;
const api = MG.shell({ id: 'knights-tour', title: "Knight's Tour", chapter: 'moves', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: () => newGame(api.level), size: { ar: 1, chrome: 230, maxW: 600 } });
api.mid.innerHTML = '<span class="pill">Visited <b data-v>1</b></span>';
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}</span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else hint(); });
const moves = (i, seen) => { const n = S.n, r = (i / n) | 0, c = i % n; return JUMPS.map(([dr, dc]) => [r + dr, c + dc]).filter(([y, x]) => y >= 0 && x >= 0 && y < n && x < n && !seen.has(y * n + x)).map(([y, x]) => y * n + x); };
function newGame(level) {
  const n = LEVELS[level].n;
  S = { n, path: [0], hints: 0 };
  box = MG.h('div', { class: 'kt', role: 'grid' }); box.style.setProperty('--n', n); box.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  els = MG.range(n * n).map(i => { const b = MG.h('button', { type: 'button', 'data-i': i, class: ((i % n) + ((i / n) | 0)) % 2 ? 'dk' : '' }); box.appendChild(b); return b; });
  box.insertAdjacentHTML('beforeend', `<svg class="path" viewBox="0 0 ${n} ${n}" preserveAspectRatio="none"><polyline points=""/></svg>`);
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) jump(+b.dataset.i); });
  api.begin(); render();
}
function jump(i) {
  if (!api.canPlay()) return;
  const seen = new Set(S.path), cur = S.path[S.path.length - 1];
  if (!moves(cur, seen).includes(i)) { if (!seen.has(i)) MG.replay(els[i], 'nudge', 250); return; }
  S.path.push(i); api.dirty = true; MG.sfx.blip(380 + S.path.length * 8, .07); render();
  const n = S.n;
  if (S.path.length === n * n) {
    const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
    api.win({ title: 'Grand tour', sub: `All ${n * n} squares visited.`, facts: [[S.hints, 'Hints used'], [MG.fmtTime(t), 'Time'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
  } else if (!moves(i, new Set(S.path)).length) {
    api.coach('mistake', 'Dead end', `The knight is stuck after ${S.path.length} squares. Undo a few moves and try another way.`, 6000); MG.sfx.wrong();
  }
}
function undo() { if (!api.canPlay() || S.path.length < 2) return; S.path.pop(); MG.sfx.note(); render(); }
function hint() {
  if (!api.canPlay()) return;
  const seen = new Set(S.path), cur = S.path[S.path.length - 1], opts = moves(cur, seen);
  if (!opts.length) { api.coach('hint', 'Undo first', 'There is no move from here.', 3000); return; }
  const score = m => { const s2 = new Set(seen); s2.add(m); return moves(m, s2).length; };
  const best = opts.reduce((a, b) => (score(b) < score(a) ? b : a));
  S.hints++; render(); els[best].classList.add('tip');
  api.coach('hint', 'Try the green square', 'It has the fewest onward moves, so it is the hardest to come back to later.', 4500); MG.sfx.hint();
}
function render() {
  const n = S.n, seen = new Set(S.path), cur = S.path[S.path.length - 1], ok = new Set(moves(cur, seen)), idx = new Map(S.path.map((p, k) => [p, k + 1]));
  els.forEach((b, i) => {
    b.classList.toggle('seen', seen.has(i)); b.classList.toggle('ok', ok.has(i)); b.classList.remove('tip');
    b.innerHTML = i === cur ? KN : seen.has(i) ? String(idx.get(i)) : '';
    b.setAttribute('aria-label', `${'ABCDEFGH'[i % n]}${n - ((i / n) | 0)}${i === cur ? ', knight' : seen.has(i) ? ', visited ' + idx.get(i) : ok.has(i) ? ', reachable' : ''}`);
  });
  MG.qs('.path polyline', box).setAttribute('points', S.path.map(p => `${p % n + .5},${((p / n) | 0) + .5}`).join(' '));
  MG.qs('[data-v]', api.mid).textContent = `${S.path.length}/${n * n}`;
  if (api.status === 'playing') api.progress(`${n * n - S.path.length} squares to go`, 'Jump to a dotted square.', S.path.length / (n * n), Math.min(64, n * n));
}
newGame(api.level);
})();
