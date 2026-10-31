#!/usr/bin/env node
/* Browser regression tests for round lifecycle, pause, keyboard play and packaging.
   Needs Chrome and playwright-core:  npm i --no-save playwright-core && node tests/regression.mjs
   Optional: pass another checkout's folder to test that instead; `--only=word` filters by name. */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(process.cwd() + '/')('playwright-core');
const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7);
const root = path.resolve(args.find(a => !a.startsWith('--')) || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(root, p.endsWith('/') ? p + 'index.html' : p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const equal = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
const ok = (v, what) => { if (!v) throw new Error(what); };

/* A page with the first-visit rules sheet already seen and any stored state preset */
async function open(url, store = {}, seen = true) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 820 } });
  const id = /games\/([\w-]+)/.exec(url);
  const init = Object.assign(seen && id ? { ['mg:seen:' + id[1]]: 1 } : {}, store);
  await context.addInitScript(s => { for (const k in s) localStorage.setItem(k, JSON.stringify(s[k])); }, init);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(base + '/' + url);
  return page;
}
const game = (id, store, seen) => open(`games/${id}/index.html`, store, seen);
const prefs = (id, level) => ({ [`mg:game:${id}:prefs`]: { level } });
/* Start a new round at the current level without leaving the event turn */
const again = page => page.evaluate(() => {
  document.querySelector('[data-mg="new"]').click();
  const b = document.querySelector('#dlgNew [data-level][aria-current]');
  if (b) b.click();
});
const endOpen = page => page.evaluate(() => !!document.querySelector('#dlgEnd[open]'));
/* `first:` holds who started last and the turn alternates, so the computer opens on load */
const cpuOpens = id => ({ ['mg:first:' + id]: 'you' });

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* -------------------------------------------------------------- every page */
test('all 54 games load without errors', async () => {
  const dirs = fs.readdirSync(path.join(root, 'games')).filter(d => fs.existsSync(path.join(root, 'games', d, 'index.html')));
  equal(dirs.length, 54, 'game pages');
  for (const id of dirs) {
    const page = await game(id);
    await page.waitForFunction(() => !document.querySelector('.is-busy'), null, { timeout: 30000 });
    await sleep(120);
    equal(page.errors, [], id);
    await page.context().close();
  }
});

/* -------------------------------------------------------------- P0 */
for (const [id, count] of [
  ['tic-tac-toe', () => document.querySelectorAll('[data-marks] > *').length - document.querySelectorAll('[data-marks] .x2').length],
  ['four-in-a-row', () => document.querySelectorAll('.disc').length],
  ['gomoku', () => document.querySelectorAll('.s').length],
]) test(`${id}: a stale computer move never lands on a new board`, async () => {
  /* load: computer starts; new: you start; new: computer starts */
  const page = await game(id, cpuOpens(id));
  await sleep(100);
  await again(page);
  await again(page);
  await sleep(1800);
  equal(await page.evaluate(count), 1, 'pieces after the computer opens');
});
test('nim: a stale computer take never plays your selection', async () => {
  const page = await game('nim', cpuOpens('nim'));
  await sleep(760);
  await again(page);
  await page.evaluate(() => document.querySelector('.st').click());
  const stones = () => page.evaluate(() => document.querySelectorAll('.st:not(.gone)').length);
  const before = await stones();
  await sleep(900);
  equal(await stones(), before, 'stones while it is your turn');
});
test('tic-tac-toe: a whole game still runs to its end sheet', async () => {
  const page = await game('tic-tac-toe', prefs('tic-tac-toe', 'easy'));
  for (let k = 0; k < 12 && !(await endOpen(page)); k++) {
    await page.evaluate(() => { const b = [...document.querySelectorAll('.tt button')].find(c => !c.disabled); if (b) b.click(); });
    await sleep(800);
  }
  await sleep(1300);
  equal(await endOpen(page), true, 'end sheet open');
});
test('mancala: the computer finishes its turn and hands back', async () => {
  const page = await game('mancala', cpuOpens('mancala'));
  await page.waitForFunction(() => document.querySelector('.pit.ok'), null, { timeout: 15000 });
  await page.waitForFunction(() => /Your turn/.test(document.querySelector('[data-mg="coachTitle"]').textContent), null, { timeout: 15000 });
  await page.evaluate(() => document.querySelector('.pit.ok').click());
  await sleep(900);
  await page.waitForFunction(() => document.querySelector('.pit.ok'), null, { timeout: 15000 });
  equal(page.errors, [], 'errors');
});
test('mancala: a stale sowing never touches a new board', async () => {
  const page = await game('mancala', cpuOpens('mancala'));
  await sleep(850);
  await again(page);
  await sleep(1500);
  equal(await page.evaluate(() => [...document.querySelectorAll('.pit .n')].map(n => +n.textContent)), new Array(12).fill(4), 'pits');
});
test('pairs: every kind on a hard deal has its own picture', async () => {
  const page = await game('pairs', prefs('pairs', 'hard'));
  const bad = await page.evaluate(() => {
    const deal = () => {
      document.querySelector('[data-mg="new"]').click();
      document.querySelector('#dlgNew [data-level][aria-current]').click();
      const faces = {};
      document.querySelectorAll('.pr .front').forEach(f => { faces[f.innerHTML] = (faces[f.innerHTML] || 0) + 1; });
      return Object.values(faces);
    };
    let wrong = 0;
    for (let k = 0; k < 1000; k++) { const v = deal(); if (v.length !== 15 || v.some(n => n !== 2)) wrong++; }
    return wrong;
  });
  equal(bad, 0, 'deals with a repeated picture');
});
const solveQueens = page => page.evaluate(() => [0, 2, 4, 1, 3].forEach((c, r) => document.querySelector(`.nq [data-i="${r * 5 + c}"]`).click()));
test('n-queens: the old win sheet does not open over a new board', async () => {
  const page = await game('n-queens', prefs('n-queens', 'easy'));
  await solveQueens(page);
  await again(page);
  await sleep(1700);
  equal(await endOpen(page), false, 'end sheet open');
});
test('n-queens: the win sheet still opens when nothing interrupts it', async () => {
  const page = await game('n-queens', prefs('n-queens', 'easy'));
  await solveQueens(page);
  await sleep(1700);
  equal(await endOpen(page), true, 'end sheet open');
});

test('sudoku: the old end sheet does not open over a new puzzle', async () => {
  const page = await game('sudoku');
  await page.waitForFunction(() => !document.querySelector('.is-busy') && document.querySelector('#board [data-i]'));
  await sleep(900);
  const wrong = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#board [data-i]')].sort((a, b) => a.dataset.i - b.dataset.i), v = i => cells[i].querySelector('.v').textContent.trim();
    const out = [];
    for (let i = 0; i < 81 && out.length < 3; i++) {
      if (v(i)) continue;
      const row = Math.floor(i / 9), d = [...Array(9).keys()].map(c => v(row * 9 + c)).find(Boolean);
      if (d) out.push([i, d]);
    }
    return out;
  });
  equal(wrong.length, 3, 'wrong entries');
  for (const [i, d] of wrong) { await page.click(`#board [data-i="${i}"]`); await page.keyboard.press(d); }
  await page.evaluate(() => { document.querySelector('#btnNew').click(); document.querySelector('#levels button').click(); });
  await sleep(1300);
  equal(await page.evaluate(() => document.querySelector('#hearts').getAttribute('aria-label')), '3 of 3 lifelines left', 'new puzzle');
  equal(await endOpen(page), false, 'end sheet open');
});

/* -------------------------------------------------------------- P1 */
const solve24 = page => page.evaluate(() => {
  const cards = () => [...document.querySelectorAll('.m24 button')];
  const steps = MG.debug.solve(cards().map(b => [+b.textContent, 1]), 1)[0];
  const text = v => (v[1] === 1 ? String(v[0]) : `${v[0]}/${v[1]}`);
  const find = (v, not) => cards().findIndex((b, i) => i !== not && !b.classList.contains('gone') && b.textContent === text(v));
  for (const [a, op, b] of steps) {
    const i = find(a), j = find(b, i);
    if (cards()[i].classList.contains('sel') === false) cards()[i].click();
    document.querySelector(`[data-o="${op}"]`).click();
    cards()[j].click();
    cards().forEach((c, k) => { if (c.classList.contains('sel')) c.click(); });
  }
});
test('make-24: Start over works after a win and cancels its sheet', async () => {
  const page = await game('make-24');
  await solve24(page);
  await page.evaluate(() => document.querySelector('[data-r]').click());
  await sleep(1600);
  equal(await endOpen(page), false, 'end sheet open');
  equal(await page.evaluate(() => { const b = document.querySelector('.m24 button'); b.click(); return b.classList.contains('sel'); }), true, 'card selectable');
  equal(await page.evaluate(() => document.querySelectorAll('.m24 button:not(.gone)').length), 4, 'cards');
});
const nextNumber = async page => { await page.waitForSelector('.nm .num'); const n = await page.textContent('.nm .num'); await page.waitForSelector('.nm input', { timeout: 15000 }); return n; };
test('number-memory: two Enters on a right answer advance one round', async () => {
  const page = await game('number-memory', prefs('number-memory', 'hard'));
  const n = await nextNumber(page);
  await page.fill('.nm input', n);
  await page.evaluate(() => { const i = document.querySelector('.nm input'), e = () => i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); e(); e(); });
  await sleep(900);
  equal(await page.textContent('[data-d]'), '4', 'digits');
});
test('2048: a late settle does not add a tile to a new board', async () => {
  const page = await game('2048');
  for (let k = 0; k < 40; k++) {
    await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'][Math.floor(Math.random() * 4)], bubbles: true })); document.querySelector('[data-mg="new"]').click(); document.querySelector('#dlgNew [data-level][aria-current]').click(); });
    await sleep(170);
    equal(await page.evaluate(() => document.querySelectorAll('.t48 .tile').length), 2, 'tiles');
  }
});
test('2048: moves still spawn exactly one tile', async () => {
  const page = await game('2048');
  const tiles = () => page.evaluate(() => [...document.querySelectorAll('.t48 .tile:not(.dead)')].length);
  await page.keyboard.press('ArrowLeft'); await sleep(200);
  await page.keyboard.press('ArrowUp'); await sleep(200);
  await page.keyboard.press('ArrowRight'); await sleep(200);
  ok((await tiles()) >= 3, 'tiles grow');
});
const mismatch = page => page.evaluate(() => {
  const faces = [...document.querySelectorAll('.pr .front')].map(f => f.innerHTML);
  const j = faces.findIndex((f, i) => i && f !== faces[0]);
  const b = document.querySelectorAll('.pr button');
  b[0].click(); b[j].click();
});
test('pairs: an old mismatch timer leaves the new game alone', async () => {
  const page = await game('pairs');
  await mismatch(page);
  await again(page);
  await page.evaluate(() => document.querySelector('.pr button').click());
  await sleep(1100);
  equal(await page.evaluate(() => document.querySelector('.pr button').classList.contains('up')), true, 'selection kept');
});
const countLit = page => page.evaluate(() => {
  window.lit = 0;
  new MutationObserver(ms => ms.forEach(m => { if (m.attributeName === 'class' && m.target.classList.contains('lit') && !(m.oldValue || '').includes('lit')) window.lit++; }))
    .observe(document.querySelector('[data-mg="board"]'), { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
});
test('echo: restarting during playback plays one sequence', async () => {
  const page = await game('echo', prefs('echo', 'easy'));
  await sleep(100);
  await page.evaluate(() => { window.tones = 0; const t = MG.sfx.tone; MG.sfx.tone = (...a) => { window.tones++; t(...a); }; });
  await again(page); await sleep(100);
  await again(page); await sleep(100);
  await again(page);
  await sleep(1800);
  equal(await page.evaluate(() => window.tones), 1, 'tones');
});
test('echo: a whole round still plays and advances', async () => {
  const page = await game('echo', prefs('echo', 'hard'));
  await page.evaluate(() => {
    window.seen = [];
    new MutationObserver(ms => ms.forEach(m => { if (m.target.classList.contains('lit') && !(m.oldValue || '').includes('lit')) window.seen.push(+m.target.dataset.k); }))
      .observe(document.querySelector('[data-mg="board"]'), { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
  });
  await page.waitForFunction(() => window.seen.length === 1);
  await sleep(600);
  const first = await page.evaluate(() => window.seen[0]);
  await page.keyboard.press(String(first + 1));
  await page.waitForFunction(() => document.querySelector('[data-l]').textContent === '1', null, { timeout: 4000 });
});

/* -------------------------------------------------------------- P2: pause */
const inHub = async (id, store = {}) => {
  const page = await open(`index.html#/${id}`, Object.assign({ ['mg:seen:' + id]: 1 }, store));
  await page.waitForFunction(i => MG.launcher.pool.some(p => p.id === i && p.frame.contentWindow.MG && p.frame.contentWindow.document.querySelector('.app')), id);
  const frame = page.frames().find(f => f.url().includes('/games/' + id + '/'));
  return { page, frame };
};
const leave = page => page.evaluate(() => MG.launcher.go('tower-of-hanoi'));
const back = (page, id) => page.evaluate(i => MG.launcher.go(i), id);
test('echo: nothing plays while the game is hidden in the launcher', async () => {
  const { page, frame } = await inHub('echo', prefs('echo', 'easy'));
  await countLit(frame);
  await leave(page);
  await sleep(1600);
  equal(await frame.evaluate(() => window.lit), 0, 'pads lit while hidden');
  await back(page, 'echo');
  await sleep(1400);
  equal(await frame.evaluate(() => window.lit), 1, 'pads lit after return');
});
test('number-memory: the reveal waits while hidden in the launcher', async () => {
  const { page, frame } = await inHub('number-memory', prefs('number-memory', 'hard'));
  await leave(page);
  await sleep(3000);
  ok(await frame.evaluate(() => !!document.querySelector('.nm .num')), 'digits still waiting');
  await back(page, 'number-memory');
  await frame.waitForSelector('.nm input', { timeout: 4000 });
});
test('colour-clash: the countdown stops while hidden in the launcher', async () => {
  const { page, frame } = await inHub('color-clash');
  await sleep(300);
  await leave(page);
  const t0 = await frame.textContent('[data-t]');
  await sleep(2300);
  equal(await frame.textContent('[data-t]'), t0, 'seconds left');
  await back(page, 'color-clash');
  await frame.waitForFunction(t => document.querySelector('[data-t]').textContent !== t, t0, { timeout: 2500 });
});
test('tic-tac-toe: the computer waits while hidden in the launcher', async () => {
  const { page, frame } = await inHub('tic-tac-toe', { 'mg:first:tic-tac-toe': 'you' });
  await leave(page);
  await sleep(900);
  equal(await frame.evaluate(() => document.querySelectorAll('[data-marks] .o').length), 0, 'moves while hidden');
  await back(page, 'tic-tac-toe');
  await frame.waitForSelector('[data-marks] .o', { timeout: 2000 });
});
test('a game paused by hand stays paused after a launcher round trip', async () => {
  const { page, frame } = await inHub('schulte-table');
  await frame.evaluate(() => document.querySelector('[data-mg="pause"]').click());
  await leave(page);
  await sleep(100);
  await back(page, 'schulte-table');
  await sleep(100);
  equal(await frame.evaluate(() => document.querySelector('[data-mg="wrap"]').classList.contains('is-paused')), true, 'paused');
});
test('number-memory: the reveal waits behind a dialog', async () => {
  const page = await game('number-memory', prefs('number-memory', 'hard'));
  await page.evaluate(() => document.querySelector('[data-mg="rules"]').click());
  await sleep(3000);
  ok(await page.evaluate(() => !!document.querySelector('.nm .num')), 'digits still waiting');
  await page.evaluate(() => document.querySelector('#dlgRules').close());
  await page.waitForSelector('.nm input', { timeout: 4000 });
});

/* -------------------------------------------------------------- P2: keyboard */
test('minesweeper: playable from the keyboard', async () => {
  const page = await game('minesweeper', prefs('minesweeper', 'easy'));
  await page.focus('.ms [data-i="0"]');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  equal(await page.evaluate(() => document.activeElement.dataset.i), String(await page.evaluate(() => getComputedStyle(document.querySelector('.ms')).gridTemplateColumns.split(' ').length + 1)), 'cursor');
  await page.keyboard.press('Enter');
  equal(await page.evaluate(() => document.activeElement.classList.contains('o')), true, 'cell opened');
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.ms b')].find(b => !b.className).dataset.i);
  await page.focus(`.ms [data-i="${hidden}"]`);
  await page.keyboard.press('f');
  equal(await page.evaluate(() => document.activeElement.classList.contains('f')), true, 'flagged');
});
test('pipes: tiles turn from the keyboard, both ways', async () => {
  const page = await game('pipes');
  await page.focus('.pp button');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Shift+Enter');
  equal(await page.textContent('[data-t]'), '3', 'turns');
  equal(await page.evaluate(() => document.activeElement.dataset.i), '1', 'cursor');
});
test('word-search: a word can be circled from the keyboard', async () => {
  const page = await game('word-search', prefs('word-search', 'easy'));
  const route = await page.evaluate(() => {
    const n = 8, g = [...document.querySelectorAll('.ws .g span')].map(s => s.textContent);
    const word = document.querySelector('.wl span').textContent;
    for (let i = 0; i < n * n; i++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const r = (i / n) | 0, c = i % n;
      if (r + dr * (word.length - 1) < n && c + dc * (word.length - 1) < n && [...word].every((ch, k) => g[(r + dr * k) * n + c + dc * k] === ch)) return { r, c, dr, len: word.length, word };
    }
  });
  await page.focus('.ws .g span');
  for (let k = 0; k < route.r; k++) await page.keyboard.press('ArrowDown');
  for (let k = 0; k < route.c; k++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  for (let k = 1; k < route.len; k++) await page.keyboard.press(route.dr ? 'ArrowDown' : 'ArrowRight');
  await page.keyboard.press('Enter');
  equal(await page.evaluate(() => document.querySelectorAll('.wl .f').length), 1, 'words found');
});
test('traffic-jam: vehicles slide from the keyboard, a slide being one move', async () => {
  const page = await game('traffic-jam', prefs('traffic-jam', 'easy'));
  await page.waitForSelector('.car');
  const state = await page.evaluate(() => {
    const { S } = MG.debug, N = 6, occ = new Set();
    S.V.forEach(([h, len, line], k) => { for (let d = 0; d < len; d++) occ.add(h ? line * N + S.st[k] + d : (S.st[k] + d) * N + line); });
    for (let k = 0; k < S.V.length; k++) {
      const [h, len, line] = S.V[k], at = p => (h ? line * N + p : p * N + line), p = S.st[k];
      if (p + len < N - 1 && !occ.has(at(p + len)) && !occ.has(at(p + len + 1))) return { k, key: h ? 'ArrowRight' : 'ArrowDown', p };
      if (p + len < N && !occ.has(at(p + len)) && k) return { k, key: h ? 'ArrowRight' : 'ArrowDown', p, one: true };
    }
  });
  await page.focus(`.car[data-k="${state.k}"]`);
  await page.keyboard.press(state.key);
  if (!state.one) await page.keyboard.press(state.key);
  equal(await page.evaluate(k => MG.debug.S.st[k], state.k), state.p + (state.one ? 1 : 2), 'position');
  equal(await page.textContent('[data-m]'), '1', 'moves');
});
test('peg-solitaire: a jump can be made from the keyboard', async () => {
  const page = await game('peg-solitaire', prefs('peg-solitaire', 'medium'));
  await page.focus('.ps');
  /* cursor starts top of the cross at (0,3); walk to (1,3), the peg two above the centre hole */
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  equal(await page.textContent('[data-p]'), '31', 'pegs left');
});
test('nonogram: cells mark and cross from the keyboard', async () => {
  const page = await game('nonogram');
  await page.waitForSelector('.gc');
  await page.focus('.gc');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('x');
  equal(await page.evaluate(() => [...document.querySelectorAll('.gc')].filter(c => /\b(f|x)\b/.test(c.className)).length), 2, 'marked');
  equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label').endsWith('crossed')), true, 'label');
});
test('dots-and-boxes: lines draw from the keyboard', async () => {
  const page = await game('dots-and-boxes', { 'mg:first:dots-and-boxes': 'cpu' });
  await page.focus('[data-l="0"]');
  await page.keyboard.press('Enter');
  equal(await page.evaluate(() => document.querySelectorAll('.ln:not(.free)').length), 1, 'lines drawn');
});
test('word-guess: P is a letter, not the pause key', async () => {
  const page = await game('word-guess');
  await page.keyboard.type('apple');
  equal(await page.evaluate(() => MG.debug.S.cur), 'apple', 'typed');
  equal(await page.evaluate(() => document.querySelector('[data-mg="wrap"]').classList.contains('is-paused')), false, 'paused');
});
test('colour-clash and mental-maths: on-screen buttons work from the keyboard', async () => {
  const cc = await game('color-clash');
  await cc.focus('.ans button');
  const ask = () => cc.evaluate(() => { const w = document.querySelector('.word'); w.textContent = 'asked'; });
  await ask();
  await cc.keyboard.press('Enter');
  ok(await cc.textContent('.word') !== 'asked', 'answer taken');
  const mm = await game('mental-math');
  await mm.focus('.kp [data-k="7"]');
  await mm.keyboard.press('Enter');
  equal(await mm.textContent('.mm .a'), '7', 'typed digit');
  await mm.focus('.kp [data-k="ok"]');
  await mm.keyboard.press('Enter');
  equal(await mm.textContent('.mm .a'), '', 'submitted');
});

/* -------------------------------------------------------------- P2: delivery */
test('404 page carries its own styles', async () => {
  const page = await open('404.html');
  equal(await page.evaluate(() => document.querySelectorAll('link[rel="stylesheet"]').length), 0, 'stylesheet links');
  ok(await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'styled');
});
test('offline copy matches the sources and opens games', async () => {
  const page = await open('mind-games.html');
  const embed = await page.evaluate(() => window.MG_EMBED);
  for (const k of Object.keys(embed.assets)) if (k !== 'css/mg.css') equal(embed.assets[k] === fs.readFileSync(path.join(root, 'assets', k), 'utf8'), true, k);
  equal(embed.classic.includes('let endTimer'), true, 'classic Sudoku');
  await page.evaluate(() => MG.launcher.go('echo'));
  await sleep(400);
  await page.evaluate(() => MG.launcher.go('sudoku'));
  await sleep(400);
  equal(page.errors, [], 'errors');
  const f = page.frames().filter(x => x !== page.mainFrame());
  equal(f.length, 2, 'frames');
  equal(await f[0].evaluate(() => typeof MG.press), 'function', 'current mg.js in frame');
});

/* -------------------------------------------------------------- run */
let failed = 0;
for (const t of tests) {
  if (only && !t.name.includes(only)) continue;
  const t0 = Date.now();
  try { await t.fn(); console.log(`ok    ${t.name} (${Date.now() - t0}ms)`); }
  catch (e) { failed++; console.log(`FAIL  ${t.name}\n      ${String(e.message).split('\n')[0]}`); }
  for (const c of browser.contexts()) await c.close();
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
