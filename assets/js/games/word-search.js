/* Word Search: find the hidden words; they can run in any straight line */
(function () {
'use strict';
const MG = window.MG;
const THEMES = {
  Animals: 'TIGER ZEBRA GIRAFFE PANDA KOALA OTTER EAGLE DOLPHIN RABBIT MONKEY BADGER LIZARD CAMEL PARROT WALRUS',
  Fruit: 'APPLE BANANA CHERRY MANGO PEACH GRAPE LEMON MELON PAPAYA KIWI GUAVA PLUM APRICOT LIME ORANGE',
  Space: 'PLANET COMET ORBIT GALAXY NEBULA ROCKET METEOR SATURN JUPITER MARS VENUS STAR MOON ECLIPSE ASTEROID',
  Ocean: 'CORAL WHALE SHARK TIDE WAVE REEF SQUID CRAB KELP OYSTER LOBSTER CURRENT ANCHOR LAGOON HARBOUR',
  Music: 'PIANO GUITAR VIOLIN DRUMS CELLO FLUTE TEMPO CHORD MELODY RHYTHM OPERA BANJO HARP TRUMPET LYRIC',
  Kitchen: 'SPOON WHISK KETTLE LADLE OVEN TOASTER PLATE BOWL KNIFE FORK BLENDER SKILLET GRATER APRON TEAPOT',
  Weather: 'STORM THUNDER RAIN CLOUD SNOW SLEET BREEZE FROST HAIL FOG RAINBOW TORNADO DRIZZLE SUNNY MIST',
  Sports: 'TENNIS SOCCER RUGBY HOCKEY GOLF BOXING ROWING CRICKET SKIING SURFING KARATE CYCLING ARCHERY POLO JUDO',
};
const HL = ['var(--c-sudoku)', 'var(--c-logic)', 'var(--c-numbers)', 'var(--c-moves)', 'var(--c-duels)', 'var(--c-brain)'];
MG.style(`
.ws { position: absolute; inset: 0; border-radius: 14px; background: var(--sheet); border: 1px solid var(--rule); touch-action: none; container-type: inline-size; }
.ws .g { position: absolute; inset: 2%; display: grid; z-index: 2; }
.ws .g span { display: grid; place-items: center; font-size: calc(96cqi / var(--n) * .52); font-weight: 760; color: var(--graphite); user-select: none; -webkit-user-select: none; }
.ws svg { position: absolute; inset: 2%; width: 96%; height: 96%; z-index: 1; pointer-events: none; }
.ws svg line { stroke-linecap: round; opacity: .75; }
:root[data-theme="dark"] .ws svg line { opacity: .9; }
.ws svg line.cur { stroke: var(--pen); opacity: .25; visibility: hidden; }
.ws svg line.cur.on { visibility: visible; }
.wl { display: flex; flex-wrap: wrap; gap: 6px 8px; }
.wl span { padding: 3px 9px; border-radius: 99px; background: var(--sheet); border: 1px solid var(--rule); font-size: 13px; font-weight: 700; letter-spacing: .03em; }
.wl span.f { text-decoration: line-through; color: var(--pencil); background: var(--sheet-2); }
`);
const LEVELS = {
  easy: { name: 'Easy', rank: 1, n: 8, words: 6, dirs: [[0, 1], [1, 0]], desc: '8×8, words run right or down.' },
  medium: { name: 'Medium', rank: 2, n: 10, words: 8, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1]], desc: '10×10, diagonals too.' },
  hard: { name: 'Hard', rank: 3, n: 13, words: 12, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]], desc: '13×13, any direction, even backwards.' },
};
const RULES = `<p>Find every word from the list hidden in the grid.</p><ul><li>Words run in straight lines: across, down, or diagonally, depending on the level. On Hard they can also run backwards.</li>
<li>Drag from the first letter to the last to circle a word.</li></ul><p class="tip">Each puzzle uses a theme, shown above the word list.</p>`;
const FREQ = 'EEEEEEEEEEEETTTTTTTTTAAAAAAAAOOOOOOOIIIIIIINNNNNNNSSSSSSHHHHHHRRRRRRDDDDLLLLCCCUUUMMMWWFFGGYYPPBVKJXQZ';
let S = null, box = null, svg = null, list = null;
const api = MG.shell({ id: 'word-search', title: 'Word Search', chapter: 'brain', levels: LEVELS, metric: 'time', rules: RULES, onNew: newGame, size: { ar: 1, chrome: 300, maxW: 600 } });
list = MG.h('div', { class: 'wl', 'aria-label': 'Words to find' });
api.controls.appendChild(list);
function build(L) {
  for (let t = 0; t < 50; t++) {
    const theme = MG.pick(Object.keys(THEMES)), pool = MG.shuffle(THEMES[theme].split(' ').filter(w => w.length <= L.n));
    const g = new Array(L.n * L.n).fill(''), placed = [];
    for (const w of pool) {
      if (placed.length >= L.words) break;
      for (let k = 0; k < 120; k++) {
        const [dr, dc] = MG.pick(L.dirs), r = MG.rand(L.n), c = MG.rand(L.n), er = r + dr * (w.length - 1), ec = c + dc * (w.length - 1);
        if (er < 0 || ec < 0 || er >= L.n || ec >= L.n) continue;
        let ok = true; for (let i = 0; i < w.length; i++) { const ch = g[(r + dr * i) * L.n + c + dc * i]; if (ch && ch !== w[i]) { ok = false; break; } }
        if (!ok) continue;
        for (let i = 0; i < w.length; i++) g[(r + dr * i) * L.n + c + dc * i] = w[i];
        placed.push({ w, r, c, er, ec }); break;
      }
    }
    if (placed.length < L.words) continue;
    for (let i = 0; i < g.length; i++) if (!g[i]) g[i] = FREQ[MG.rand(FREQ.length)];
    return { theme, g, words: placed };
  }
}
function newGame(level) {
  const L = LEVELS[level], p = build(L);
  S = Object.assign(p, { n: L.n, found: [] });
  box = MG.h('div', { class: 'ws', role: 'application', 'aria-label': `Word search, theme ${p.theme}` });
  box.style.setProperty('--n', L.n);
  box.innerHTML = `<svg viewBox="0 0 ${L.n} ${L.n}" preserveAspectRatio="none"><g data-f></g><line class="cur" data-c x1="0" y1="0" x2="0" y2="0" stroke-width=".72"/></svg><div class="g" style="grid-template-columns:repeat(${L.n},1fr)">${p.g.map(ch => `<span>${ch}</span>`).join('')}</div>`;
  svg = MG.qs('svg', box);
  api.board.innerHTML = ''; api.board.appendChild(box);
  bind(); api.begin(); render();
}
function cellAt(e) { const r = MG.qs('.g', box).getBoundingClientRect(), n = S.n; const c = Math.floor((e.clientX - r.left) / r.width * n), y = Math.floor((e.clientY - r.top) / r.height * n); return [MG.clamp(y, 0, n - 1), MG.clamp(c, 0, n - 1)]; }
function snap(a, b) {
  let dr = b[0] - a[0], dc = b[1] - a[1];
  if (Math.abs(dr) > 2 * Math.abs(dc)) dc = 0; else if (Math.abs(dc) > 2 * Math.abs(dr)) dr = 0; else { const m = Math.max(Math.abs(dr), Math.abs(dc)); dr = Math.sign(dr) * m; dc = Math.sign(dc) * m; }
  const n = S.n; let r = a[0] + dr, c = a[1] + dc;
  while (r < 0 || c < 0 || r >= n || c >= n) { dr -= Math.sign(dr); dc -= Math.sign(dc); r = a[0] + dr; c = a[1] + dc; }
  return [r, c];
}
function bind() {
  let start = null, end = null;
  const line = MG.qs('[data-c]', svg), set = (a, b) => { line.setAttribute('x1', a[1] + .5); line.setAttribute('y1', a[0] + .5); line.setAttribute('x2', b[1] + .5); line.setAttribute('y2', b[0] + .5); };
  box.addEventListener('pointerdown', e => { if (!api.canPlay()) return; start = cellAt(e); end = start; set(start, end); line.classList.add('on'); box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', e => { if (!start) return; end = snap(start, cellAt(e)); set(start, end); });
  const up = () => {
    if (!start) return;
    const dr = Math.sign(end[0] - start[0]), dc = Math.sign(end[1] - start[1]), len = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1])) + 1;
    let word = ''; for (let i = 0; i < len; i++) word += S.g[(start[0] + dr * i) * S.n + start[1] + dc * i];
    const back = word.split('').reverse().join('');
    const hit = S.words.find(w => !S.found.includes(w.w) && (w.w === word || w.w === back));
    if (hit && len > 1) { S.found.push(hit.w); S.lines = S.lines || []; S.lines.push([start, end]); api.dirty = true; MG.sfx.unit(); render(); check(); }
    else if (len > 2) MG.sfx.wrong();
    start = null; line.classList.remove('on');
  };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
}
function render() {
  MG.qs('[data-f]', svg).innerHTML = (S.lines || []).map(([a, b], k) => `<line x1="${a[1] + .5}" y1="${a[0] + .5}" x2="${b[1] + .5}" y2="${b[0] + .5}" stroke="${HL[k % HL.length]}" stroke-width=".74"/>`).join('');
  list.innerHTML = S.words.map(w => `<span class="${S.found.includes(w.w) ? 'f' : ''}">${w.w}</span>`).join('');
  if (api.status === 'playing') api.progress(`${S.theme}: ${S.words.length - S.found.length} to find`, 'Drag across a word, from first letter to last.', S.found.length / S.words.length, S.words.length);
}
function check() {
  if (S.found.length < S.words.length) return;
  const prev = api.stats.get(api.level).best, t = api.timer.elapsed;
  api.win({ title: 'All words found', sub: `${S.theme}: ${S.words.length} words.`, facts: [[S.words.length, 'Words'], [MG.fmtTime(t), 'Time'], [MG.fmtTime(!prev || t < prev ? t : prev), 'Best time']] });
}
newGame(api.level);
})();
