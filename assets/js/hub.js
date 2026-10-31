/* Mind Games launcher: one page for every game. Pick a game and it opens right here. */
(function () {
'use strict';
const MG = window.MG, CAT = window.MG_CATALOG || [], CH = window.MG_CHAPTERS || [], TH = window.MG_THUMBS || {}, EMBED = window.MG_EMBED || null;
const $ = MG.$, byId = Object.fromEntries(CAT.map(g => [g.id, g])), TITLE = document.title;
let filter = 'all', query = '', current = null, cameFromLib = false;

/* --------------------------------------------------------------- progress lines */
function summary(g) {
  const st = MG.store.get('stats:' + g.id), none = { text: 'Not played yet', short: '', has: false };
  if (!st) return none;
  const lv = Object.values(st), sum = k => lv.reduce((n, s) => n + (s[k] || 0), 0);
  const won = sum('won'), lost = sum('lost'), drawn = sum('drawn'), metric = g.metric || 'time';
  if (metric === 'duel') { const p = won + lost + drawn; return p ? { text: `Won ${won} of ${p}`, short: `${won}–${lost}`, has: true } : none; }
  if (metric === 'score') { const best = Math.max(0, ...lv.map(s => s.best || 0)); return best ? { text: `Best score ${best}`, short: String(best), has: true } : none; }
  if (!won) return sum('started') ? { text: 'Started, not solved yet', short: '', has: false } : none;
  const best = Math.min(...lv.map(s => s.best).filter(Boolean));
  return metric === 'time' ? { text: `${won} solved, best ${MG.fmtTime(best)}`, short: MG.fmtTime(best), has: true }
    : { text: `${won} solved, best ${best} moves`, short: `${best} mv`, has: true };
}

/* --------------------------------------------------------------- library and sidebar */
const matches = g => {
  if (!query) return true;
  const hay = (g.name + ' ' + g.blurb + ' ' + (g.tags || '') + ' ' + (CH.find(c => c.id === g.chapter) || {}).name).toLowerCase();
  return query.split(/\s+/).every(w => hay.includes(w));
};
function tile(g) {
  const p = summary(g), art = (TH[g.id] || TH._fallback)(g);
  return `<a class="tile" href="${g.path}" data-open="${g.id}" data-chapter="${g.chapter}"><div class="thumb">${art}</div>
    <div class="tile-b"><span class="tile-n">${MG.esc(g.name)}</span><span class="tile-d">${MG.esc(g.blurb)}</span>
    <span class="tile-s${p.has ? ' has' : ''}">${p.text}</span></div></a>`;
}
function renderLibrary() {
  let html = '', shown = 0;
  for (const c of CH) {
    if (filter !== 'all' && filter !== c.id) continue;
    const games = CAT.filter(g => g.chapter === c.id && matches(g));
    if (!games.length) continue;
    shown += games.length;
    html += `<section class="chapter" id="ch-${c.id}" data-chapter="${c.id}"><div class="chapter-h"><h2>${c.name}</h2><p>${c.blurb}</p></div>
      <div class="tiles">${games.map(tile).join('')}</div></section>`;
  }
  $('library').innerHTML = shown ? html : `<p class="empty">No game matches “${MG.esc(query)}”. Try a rule or a shape, like “cage”, “dots” or “16x16”.</p>`;
}
function renderChips() {
  const counts = Object.fromEntries(CH.map(c => [c.id, CAT.filter(g => g.chapter === c.id).length]));
  $('chips').innerHTML = `<button type="button" class="chip" data-c="all" aria-pressed="${filter === 'all'}">All games <small>${CAT.length}</small></button>` +
    CH.filter(c => counts[c.id]).map(c => `<button type="button" class="chip" data-c="${c.id}" data-chapter="${c.id}" aria-pressed="${filter === c.id}">${c.name} <small>${counts[c.id]}</small></button>`).join('');
}
function renderSide() {
  let h = '';
  for (const c of CH) {
    const games = CAT.filter(g => g.chapter === c.id && matches(g));
    if (!games.length) continue;
    h += `<p class="side-h" data-chapter="${c.id}">${c.name}<small>${games.length}</small></p>` + games.map(g => {
      const s = summary(g);
      return `<a class="side-g" href="${g.path}" data-open="${g.id}" data-chapter="${g.chapter}"${g.id === current ? ' aria-current="page"' : ''}><span>${MG.esc(g.name)}</span>${s.short ? `<small>${s.short}</small>` : ''}</a>`;
    }).join('');
  }
  $('sideList').innerHTML = h || '<p class="side-empty">No game matches. Try another word.</p>';
}
function markSide() { MG.qsa('.side-g').forEach(a => { if (a.dataset.open === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
function renderRecent() {
  const list = (MG.store.get('recent') || []).filter(id => byId[id]).slice(0, 5), box = $('recent');
  box.hidden = !list.length;
  if (list.length) box.innerHTML = '<b>Jump back in</b>' + list.map(id => `<a href="${byId[id].path}" data-open="${id}" data-chapter="${byId[id].chapter}">${MG.esc(byId[id].name)}</a>`).join('');
  const cont = $('btnContinue');
  if (list.length) { cont.hidden = false; cont.href = byId[list[0]].path; cont.dataset.open = list[0]; cont.querySelector('span').textContent = 'Continue ' + byId[list[0]].name; }
}

/* --------------------------------------------------------------- games open in place
   Each game runs in its own frame, so games never interfere with each other. The last few
   stay loaded (paused) for instant switching. */
const pool = [], MAX_LIVE = 4;
const post = (f, msg) => { try { f.frame.contentWindow.postMessage(msg, '*'); } catch (e) { /* frame gone */ } };
function pageHTML(id) {
  const E = EMBED, p = E.pages[id], esc = s => s.replace(/<\/script/gi, '<\\/script');
  if (!p) return E.classic.replace('<style>', '<style>\n' + E.fontFace + '\n');
  return '<!doctype html><html lang="en" data-root=""><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>' + p.title + '</title>' +
    '<style>' + E.fontFace + '</style>' + p.css.map(k => '<style>' + E.assets[k] + '</style>').join('') + '</head><body>' +
    p.js.map(k => '<script>' + esc(E.assets[k]) + '<\/script>').join('') + (p.boot ? '<script>' + p.boot + '<\/script>' : '') + '</body></html>';
}
function show(id) {
  const g = byId[id];
  if (!g) return showLibrary();
  document.body.classList.add('in-game');
  $('stage').hidden = false;
  let f = pool.find(p => p.id === id), fresh = false;
  if (!f) {
    if (pool.length >= MAX_LIVE) { const old = pool.filter(p => p.id !== current).sort((a, b) => a.last - b.last)[0]; if (old) { old.frame.remove(); pool.splice(pool.indexOf(old), 1); } }
    f = { id, frame: MG.h('iframe', { title: g.name }), last: 0 };
    $('frames').appendChild(f.frame); pool.push(f); fresh = true;
  }
  f.last = performance.now();
  pool.forEach(p => { if (p !== f && !p.frame.hidden) post(p, { mg: 'pause' }); p.frame.hidden = p !== f; });
  current = id;
  document.title = `${g.name} | Mind Games`;
  markSide();
  const busy = $('frameBusy');
  if (fresh) {
    busy.hidden = false;
    f.frame.addEventListener('load', () => { busy.hidden = true; post(f, { mg: 'theme', theme: MG.prefs.theme }); if (current === id) focusFrame(f); }, { once: true });
    if (EMBED) f.frame.srcdoc = pageHTML(id); else f.frame.src = g.path;
  } else { busy.hidden = true; post(f, { mg: 'resume' }); focusFrame(f); }
  MG.recent(id);
}
function focusFrame(f) { try { f.frame.contentWindow.focus(); } catch (e) { f.frame.focus(); } }
function showLibrary() {
  pool.forEach(p => { if (!p.frame.hidden) post(p, { mg: 'pause' }); p.frame.hidden = true; });
  current = null;
  $('stage').hidden = true; $('frameBusy').hidden = true;
  document.body.classList.remove('in-game');
  document.title = TITLE;
  renderLibrary(); renderSide(); renderRecent();
}
const idFromHash = () => { const m = /^#\/([\w-]+)/.exec(location.hash); return m && byId[m[1]] ? m[1] : null; };
function go(id) {
  if (!byId[id]) return;
  if (current) history.replaceState({ g: id }, '', '#/' + id);
  else { history.pushState({ g: id }, '', '#/' + id); cameFromLib = true; }
  show(id);
}
function home() {
  if (!current) return;
  if (cameFromLib) { cameFromLib = false; history.back(); }
  else { history.replaceState(null, '', location.pathname + location.search); showLibrary(); }
}
function route() { const id = idFromHash(); if (id) { if (id !== current) show(id); } else if (current) showLibrary(); }
window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);
window.addEventListener('message', e => {
  const f = pool.find(p => p.frame.contentWindow === e.source);
  if (!f || !e.data || typeof e.data !== 'object') return;
  if (e.data.mg === 'home') home();
  else if (e.data.mg === 'theme' && e.data.theme && e.data.theme !== MG.prefs.theme) { MG.prefs.theme = e.data.theme; MG.savePrefs(); MG.applyTheme(); }
});

/* --------------------------------------------------------------- hero: a 6×6 sudoku solving itself */
function demo() {
  const board = $('demoBoard'), cells = [];
  for (let i = 0; i < 36; i++) {
    const r = (i / 6) | 0, c = i % 6;
    const el = MG.h('div', { class: 'cell' + (c === 2 ? ' br' : '') + (r === 1 || r === 3 ? ' bb' : ''), html: '<span class="fx"></span><span class="v"></span>' });
    board.appendChild(el); cells.push({ el, fx: el.children[0], v: el.children[1] });
  }
  const core = MG.latinCore;
  const P = MG.range(36).map(i => { const r = (i / 6) | 0, c = i % 6, b = ((r / 2) | 0) * 2 + ((c / 3) | 0), out = []; for (let j = 0; j < 36; j++) { const r2 = (j / 6) | 0, c2 = j % 6; if (j !== i && (r2 === r || c2 === c || ((r2 / 2) | 0) * 2 + ((c2 / 3) | 0) === b)) out.push(j); } return out; });
  const units = [...MG.range(6).map(r => MG.range(6).map(c => r * 6 + c)), ...MG.range(6).map(c => MG.range(6).map(r => r * 6 + c)),
    ...MG.range(6).map(b => MG.range(6).map(k => (((b / 2) | 0) * 2 + ((k / 3) | 0)) * 6 + (b % 2) * 3 + (k % 3)))];
  const showGrid = (g, given) => cells.forEach((c, i) => { c.v.textContent = g[i] || ''; c.el.className = c.el.className.replace(/ (given|user|now)/g, '') + (g[i] ? (given[i] ? ' given' : ' user') : ''); });
  const idle = async () => { while (document.body.classList.contains('in-game') || document.hidden) await MG.sleep(500); };
  async function run() {
    let r;
    try { r = await core.generate('mini', 'easy'); } catch (e) { return; }
    const sol = r.sol, g = r.givens.slice(), given = r.givens.map(v => !!v);
    board.classList.remove('fade');
    showGrid(g, given);
    if (MG.reduced()) { showGrid(sol, given); return; }
    await MG.sleep(900);
    while (g.some(v => !v)) {
      await idle();
      let best = -1, bn = 9;
      for (let i = 0; i < 36; i++) if (!g[i]) { const used = new Set(P[i].map(j => g[j]).filter(Boolean)); const n = 6 - used.size; if (n < bn) { bn = n; best = i; } }
      g[best] = sol[best];
      const c = cells[best];
      c.el.classList.add('now'); await MG.sleep(260);
      c.v.textContent = g[best]; c.el.classList.remove('now'); c.el.classList.add('user'); MG.replay(c.v, 'ink', 300);
      for (const u of units) if (u.includes(best) && u.every(k => g[k])) u.forEach((k, n) => { cells[k].fx.style.setProperty('--d', n * 40 + 'ms'); MG.replay(cells[k].fx, 'sweep', 1100 + n * 40); });
      await MG.sleep(380);
    }
    await MG.sleep(2600); board.classList.add('fade'); await MG.sleep(600);
    run();
  }
  run();
}

/* --------------------------------------------------------------- wiring */
function init() {
  const nGames = CAT.length, nSudoku = CAT.filter(g => g.chapter === 'sudoku').length;
  $('heroSub').textContent = `${nGames} mind games in one place: Sudoku in ${nSudoku} variants, number and logic puzzles, duels against the computer, brain drills and word games. Pick one and it opens right here. Puzzles are generated in your browser, and those with a single answer are checked to have exactly one.`;
  renderChips(); renderLibrary(); renderSide(); renderRecent();
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-open]');
    if (a) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go(a.dataset.open); return; }
    if (e.target.closest('[data-home]')) { e.preventDefault(); if (current) home(); else window.scrollTo({ top: 0, behavior: MG.reduced() ? 'auto' : 'smooth' }); return; }
    if (e.target.closest('[data-random]')) { const pool2 = CAT.filter(g => g.id !== current); go(MG.pick(pool2).id); return; }
    if (e.target.closest('[data-theme-toggle]')) { MG.setTheme(MG.isDark() ? 'light' : 'dark'); }
  });
  $('chips').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    filter = b.dataset.c; renderChips(); renderLibrary();
    const top = $('chips').getBoundingClientRect().top + window.scrollY - 4;
    if (window.scrollY > top) window.scrollTo({ top, behavior: MG.reduced() ? 'auto' : 'smooth' });
  });
  const inputs = MG.qsa('[data-q]');
  inputs.forEach(q => q.addEventListener('input', () => {
    query = q.value.trim().toLowerCase();
    inputs.forEach(o => { if (o !== q) o.value = q.value; });
    renderLibrary(); renderSide();
  }));
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !MG.typing(e)) { e.preventDefault(); const vis = inputs.find(q => q.offsetParent); if (vis) vis.focus(); }
    else if (e.key === 'Escape' && MG.typing(e) && e.target.matches('[data-q]')) { inputs.forEach(q => { q.value = ''; }); query = ''; renderLibrary(); renderSide(); e.target.blur(); }
  });
  const syncTheme = () => {
    MG.qsa('[data-theme-icon]').forEach(u => u.setAttribute('href', MG.isDark() ? '#i-sun' : '#i-moon'));
    MG.qsa('[data-theme-toggle]').forEach(b => b.setAttribute('aria-label', MG.isDark() ? 'Switch to light theme' : 'Switch to dark theme'));
    pool.forEach(p => post(p, { mg: 'theme', theme: MG.prefs.theme }));
  };
  document.addEventListener('mg:theme', syncTheme); syncTheme();
  window.addEventListener('pageshow', () => { if (!current) { renderLibrary(); renderSide(); renderRecent(); } });
  const first = idFromHash();
  if (first) show(first);
  demo();
}
MG.launcher = { go, home, get current() { return current; }, pool };
init();
})();
