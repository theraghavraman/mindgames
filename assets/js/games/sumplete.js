/* Sumplete: delete numbers so every row and column adds up to its target */
(function () {
'use strict';
const MG = window.MG;
MG.style(`
.sm { position: absolute; inset: 0; display: grid; gap: 4px; container-type: inline-size; }
.sm button { position: relative; border: 0; border-radius: 10px; background: var(--sheet); box-shadow: inset 0 0 0 1px var(--rule); font-size: calc(100cqi / var(--u) * .46); font-weight: 760; font-variation-settings: 'CASL' 1; color: var(--graphite); cursor: pointer; transition: background-color .15s, color .15s, opacity .15s; }
.sm button.del { color: var(--pencil); opacity: .42; text-decoration: line-through; text-decoration-thickness: 3px; }
.sm button.keep::after { content: ""; position: absolute; inset: 14%; border: 2.5px solid var(--ch-deep); border-radius: 50%; }
.sm .t { display: grid; place-items: center; border-radius: 10px; font-size: calc(100cqi / var(--u) * .4); font-weight: 820; color: var(--graphite-2); background: var(--sheet-2); font-variant-numeric: tabular-nums; }
.sm .t.ok { background: var(--green-soft); color: var(--green); }
.sm .t small { display: block; font-size: .55em; font-weight: 650; color: var(--pencil); }
.sm.won button:not(.del) { background: var(--ch-soft); animation: pop .4s var(--d, 0ms) both; }
`);
const LEVELS = {
  easy: { name: '4×4', rank: 1, n: 4, desc: 'Sixteen numbers.' },
  medium: { name: '5×5', rank: 2, n: 5, desc: 'Twenty-five numbers.' },
  hard: { name: '6×6', rank: 3, n: 6, desc: 'Thirty-six numbers.' },
};
const RULES = `<p>Delete numbers until every <b>row</b> adds up to the target on its right and every <b>column</b> adds up to the target below it.</p><ul>
<li>Tap a number once to delete it, again to circle it as one you are keeping, and again to reset it.</li>
<li>Each target shows the current total of the numbers still in its line, and turns green when they match.</li></ul><p class="tip">Every puzzle has exactly one solution.</p>`;
function solutions(n, g, rt, ct, limit) {
  const rs = new Int32Array(n), cs = new Int32Array(n), rrem = new Int32Array(n), crem = new Int32Array(n);
  for (let i = 0; i < n * n; i++) { rrem[(i / n) | 0] += g[i]; crem[i % n] += g[i]; }
  let count = 0;
  const bt = i => {
    if (count >= limit) return;
    if (i === n * n) { count++; return; }
    const r = (i / n) | 0, c = i % n, v = g[i];
    rrem[r] -= v; crem[c] -= v;
    if (rs[r] + v <= rt[r] && cs[c] + v <= ct[c] && (c < n - 1 || rs[r] + v === rt[r]) && (r < n - 1 || cs[c] + v === ct[c])) { rs[r] += v; cs[c] += v; bt(i + 1); rs[r] -= v; cs[c] -= v; }
    if (rs[r] + rrem[r] >= rt[r] && cs[c] + crem[c] >= ct[c] && (c < n - 1 || rs[r] === rt[r]) && (r < n - 1 || cs[c] === ct[c])) bt(i + 1);
    rrem[r] += v; crem[c] += v;
  };
  bt(0); return count;
}
function make(n) {
  for (let t = 0; t < 5000; t++) {
    const g = MG.range(n * n).map(() => 1 + MG.rand(9)), keep = g.map(() => Math.random() < .55);
    let fine = true;
    for (let k = 0; k < n && fine; k++) { const row = MG.range(n).map(c => keep[k * n + c]), col = MG.range(n).map(r => keep[r * n + k]); if (row.every(Boolean) || !row.some(Boolean) || col.every(Boolean) || !col.some(Boolean)) fine = false; }
    if (!fine) continue;
    const rt = MG.range(n).map(r => MG.range(n).reduce((s, c) => s + (keep[r * n + c] ? g[r * n + c] : 0), 0));
    const ct = MG.range(n).map(c => MG.range(n).reduce((s, r) => s + (keep[r * n + c] ? g[r * n + c] : 0), 0));
    if (solutions(n, g, rt, ct, 2) === 1) return { n, g, rt, ct, keep };
  }
  return null;
}
let S = null, els = [], rEls = [], cEls = [], box = null;
const api = MG.shell({ id: 'sumplete', title: 'Sumplete', chapter: 'numbers', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, onRestart: restart, size: { ar: 1, chrome: 250, maxW: 560 } });
const tools = MG.h('div', { class: 'tools', style: { '--tools': 2 } });
tools.innerHTML = `<button type="button" class="tool" data-u><span class="ti">${MG.icon('undo')}</span><span>Undo</span></button><button type="button" class="tool" data-h><span class="ti">${MG.icon('bulb')}<span class="count" data-hc>3</span></span><span>Hint</span></button>`;
api.controls.appendChild(tools);
tools.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-u')) undo(); else hint(); });
function newGame(level) {
  let p = null; while (!p) p = make(LEVELS[level].n);
  S = Object.assign(p, { st: new Array(p.n * p.n).fill(0), hist: [], hints: 3 });
  build(); api.begin(); render();
}
function restart() { S.st.fill(0); S.hist = []; S.hints = 3; build(); api.begin(); render(); }
function build() {
  const n = S.n;
  box = MG.h('div', { class: 'sm', role: 'grid' });
  box.style.setProperty('--u', n + 1); box.style.gridTemplateColumns = `repeat(${n + 1}, 1fr)`; box.style.gridTemplateRows = `repeat(${n + 1}, 1fr)`;
  els = []; rEls = []; cEls = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) {
    if (r < n && c < n) { const i = r * n + c, b = MG.h('button', { type: 'button', 'data-i': i, text: String(S.g[i]) }); els[i] = b; box.appendChild(b); }
    else if (r < n) { const t = MG.h('div', { class: 't' }); rEls[r] = t; box.appendChild(t); }
    else if (c < n) { const t = MG.h('div', { class: 't' }); cEls[c] = t; box.appendChild(t); }
    else box.appendChild(MG.h('div'));
  }
  api.board.innerHTML = ''; api.board.appendChild(box);
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (b) tap(+b.dataset.i); });
  box.addEventListener('contextmenu', e => { e.preventDefault(); const b = e.target.closest('button'); if (b) tap(+b.dataset.i, true); });
}
function tap(i, back) {
  if (!api.canPlay()) return;
  S.hist.push([i, S.st[i]]); S.st[i] = (S.st[i] + (back ? 2 : 1)) % 3; api.dirty = true;
  S.st[i] === 1 ? MG.sfx.flip() : MG.sfx.tap(); render(); check();
}
function sums() {
  const n = S.n, rs = new Array(n).fill(0), cs = new Array(n).fill(0);
  for (let i = 0; i < n * n; i++) if (S.st[i] !== 1) { rs[(i / n) | 0] += S.g[i]; cs[i % n] += S.g[i]; }
  return { rs, cs };
}
function render() {
  const { rs, cs } = sums(), n = S.n;
  els.forEach((b, i) => { b.className = S.st[i] === 1 ? 'del' : S.st[i] === 2 ? 'keep' : ''; b.setAttribute('aria-label', `${S.g[i]}, ${['in play', 'deleted', 'kept'][S.st[i]]}`); });
  let ok = 0;
  for (let k = 0; k < n; k++) {
    for (const [el, cur, tgt] of [[rEls[k], rs[k], S.rt[k]], [cEls[k], cs[k], S.ct[k]]]) {
      el.classList.toggle('ok', cur === tgt); if (cur === tgt) ok++;
      el.innerHTML = `<span>${tgt}<small>${cur === tgt ? '✓' : 'now ' + cur}</small></span>`;
    }
  }
  MG.qs('[data-hc]', tools).textContent = S.hints;
  if (api.status === 'playing') api.progress(`${ok} of ${2 * n} lines add up`, 'Delete numbers until every total matches its target.', ok / (2 * n), 2 * n);
  return ok === 2 * n;
}
function check() {
  if (!render()) return;
  box.classList.add('won'); els.forEach((b, i) => b.style.setProperty('--d', i * 18 + 'ms'));
  const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ title: 'All lines add up', sub: `${LEVELS[api.level].name} Sumplete`, facts: [[3 - S.hints, 'Hints used'], [S.hist.length, 'Moves'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
}
function undo() { if (!api.canPlay()) return; const h = S.hist.pop(); if (!h) return; S.st[h[0]] = h[1]; MG.sfx.note(); render(); }
function hint() {
  if (!api.canPlay()) return;
  if (S.hints <= 0) { api.coach('info', 'No hints left', 'All three hints are used for this puzzle.', 3500); return; }
  const wrong = MG.range(S.n * S.n).filter(i => (S.st[i] === 1) === S.keep[i] || (S.st[i] === 0));
  const bad = wrong.filter(i => S.st[i] !== 0), i = bad.length ? bad[0] : MG.pick(wrong);
  if (i == null) return;
  S.hints--; S.hist.push([i, S.st[i]]); S.st[i] = S.keep[i] ? 2 : 1;
  api.coach('hint', S.keep[i] ? `Keep the ${S.g[i]}` : `Delete the ${S.g[i]}`, bad.length ? 'It was marked the wrong way.' : 'It is now marked for you.', 4000);
  MG.sfx.hint(); MG.replay(els[i], 'flash', 600); check();
}
MG.debug = { solutions, make };
newGame(api.level);
})();
