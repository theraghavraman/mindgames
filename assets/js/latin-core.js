/* =============================================================================
   Latin-square engine: one constraint solver for the whole Sudoku family.
   A puzzle is a "spec": cells, all-different groups, pairwise relations,
   cages, arrows and skyscraper lines. The solver propagates every rule, picks
   the cell with the fewest candidates, and counts solutions so each generated
   puzzle can be proven to have exactly one.
   ============================================================================= */
(function (root) {
'use strict';
const MG = root.MG = root.MG || {};

/* ----------------------------------------------------------------- bits */
const popcount = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const lowBit = m => 31 - Math.clz32(m & -m);
const highBit = m => 31 - Math.clz32(m);
const bitsOf = m => { const a = []; while (m) { const b = m & -m; a.push(31 - Math.clz32(b)); m ^= b; } return a; };
const rangeMask = (lo, hi, N) => { lo = Math.max(1, lo); hi = Math.min(N, hi); return hi < lo ? 0 : ((1 << (hi + 1)) - 1) & ~((1 << lo) - 1); };
const range = n => Array.from({ length: n }, (_, i) => i);
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastYield = 0;
const breathe = async () => { if (now() - lastYield > 24) { await sleep(0); lastYield = now(); } };

/* ----------------------------------------------------------------- relations
   A relation [a, b, t] limits b once a is known (and the reverse for a). */
const NE = 0, NC = 1, LT = 2, GT = 3, W1 = 4, B2 = 5, NK = 6;
const REV = [NE, NC, GT, LT, W1, B2, NK];
function relMask(t, v, N) {
  const full = (1 << (N + 1)) - 2, b = x => (x >= 1 && x <= N ? 1 << x : 0);
  switch (t) {
    case NE: return full & ~b(v);
    case NC: return full & ~b(v - 1) & ~b(v + 1);
    case LT: return full & ~((1 << (v + 1)) - 1);
    case GT: return full & ((1 << v) - 2);
    case W1: return b(v - 1) | b(v + 1);
    case B2: return b(2 * v) | (v % 2 ? 0 : b(v / 2));
    case NK: return full & ~(b(v - 1) | b(v + 1) | b(2 * v) | (v % 2 ? 0 : b(v / 2)));
    default: return full;
  }
}

/* ----------------------------------------------------------------- spec */
function newSpec(R, C, N) {
  return { R, C, N, exist: new Uint8Array(R * C), region: new Int16Array(R * C).fill(-1), groups: [], kinds: [],
    rels: [], cages: [], arrows: [], thermos: [], sky: [], parity: new Uint8Array(R * C), init: null, diag: false, windows: null, dots: null, signs: null, cageStyle: null };
}
function addGroup(spec, cells, kind) {
  const key = cells.slice().sort((a, b) => a - b).join(',');
  spec._keys = spec._keys || new Set();
  if (spec._keys.has(key)) return;
  spec._keys.add(key); spec.groups.push(cells); spec.kinds.push(kind);
}
/* An N×N latin block at (oy, ox), optionally split into bh×bw boxes */
function addSquare(spec, oy, ox, N, bh, bw) {
  const C = spec.C, at = (r, c) => (oy + r) * C + ox + c;
  for (let r = 0; r < N; r++) addGroup(spec, range(N).map(c => at(r, c)), 'row');
  for (let c = 0; c < N; c++) addGroup(spec, range(N).map(r => at(r, c)), 'column');
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { spec.exist[at(r, c)] = 1; if (!bh) spec.region[at(r, c)] = 0; }
  if (bh) for (let br = 0; br < N / bh; br++) for (let bc = 0; bc < N / bw; bc++) {
    const cells = [];
    for (let r = 0; r < bh; r++) for (let c = 0; c < bw; c++) cells.push(at(br * bh + r, bc * bw + c));
    addGroup(spec, cells, 'box');
    const id = ((oy / bh) + br) * 100 + (ox / bw) + bc;
    for (const i of cells) spec.region[i] = id;
  }
}
const nbrs4 = (spec, i) => {
  const { R, C } = spec, r = (i / C) | 0, c = i % C, out = [];
  if (r > 0) out.push(i - C); if (r < R - 1) out.push(i + C); if (c > 0) out.push(i - 1); if (c < C - 1) out.push(i + 1);
  return out.filter(j => spec.exist[j]);
};
const cellsOf = spec => { const a = []; for (let i = 0; i < spec.R * spec.C; i++) if (spec.exist[i]) a.push(i); return a; };

/* Digits that can appear in some set of n different digits summing to t */
const comboCache = new Map();
function comboMask(n, t, N) {
  const key = n + ':' + t + ':' + N;
  if (comboCache.has(key)) return comboCache.get(key);
  let mask = 0;
  const go = (start, left, sum, used) => {
    if (left === 0) { if (sum === t) mask |= used; return; }
    for (let d = start; d <= N; d++) { if (sum + d > t) break; go(d + 1, left - 1, sum + d, used | (1 << d)); }
  };
  go(1, n, 0, 0);
  comboCache.set(key, mask);
  return mask;
}

/* =============================================================================
   Solver
   ============================================================================= */
function makeSolver(spec) {
  const { R, C, N } = spec, size = R * C, FULL = (1 << (N + 1)) - 2;
  const cells = cellsOf(spec);
  const peerSets = Array.from({ length: size }, () => new Set());
  const fullGroups = [], fullKinds = [];
  spec.groups.forEach((g, k) => {
    for (const a of g) for (const b of g) if (a !== b) peerSets[a].add(b);
    if (g.length === N) { fullGroups.push(Int32Array.from(g)); fullKinds.push(spec.kinds[k]); }
  });
  const peers = peerSets.map(s => Int32Array.from(s));
  const relL = Array.from({ length: size }, () => []);
  for (const [a, b, t] of spec.rels) { relL[a].push(b, t); relL[b].push(a, REV[t]); }
  const rels = relL.map(x => Int32Array.from(x));
  const REL = new Int32Array(7 * (N + 1));
  for (let t = 0; t < 7; t++) for (let v = 1; v <= N; v++) REL[t * (N + 1) + v] = relMask(t, v, N);
  const cagesOf = Array.from({ length: size }, () => []);
  spec.cages.forEach((cg, k) => cg.cells.forEach(i => cagesOf[i].push(k)));
  const arrowsOf = Array.from({ length: size }, () => []);
  spec.arrows.forEach((a, k) => { arrowsOf[a.circle].push(k); a.cells.forEach(i => arrowsOf[i].push(k)); });
  const sky = spec.sky.filter(s => s.clue);
  const skyOf = Array.from({ length: size }, () => []);
  sky.forEach((s, k) => s.cells.forEach(i => skyOf[i].push(k)));

  const EVEN = (() => { let m = 0; for (let d = 2; d <= N; d += 2) m |= 1 << d; return m; })();
  const base = new Int32Array(size);
  for (const i of cells) {
    let m = FULL;
    if (spec.parity[i] === 1) m &= ~EVEN; else if (spec.parity[i] === 2) m &= EVEN;
    if (spec.init && spec.init[i]) m &= spec.init[i];
    base[i] = m;
  }
  for (const cg of spec.cages) {
    const n = cg.cells.length, t = cg.target;
    let m = FULL;
    if (cg.op === '+') m = cg.distinct ? comboMask(n, t, N) : rangeMask(1, t - (n - 1), N);
    else if (cg.op === '*') { m = 0; for (let d = 1; d <= N; d++) if (t % d === 0) m |= 1 << d; }
    else if (cg.op === '-') { m = 0; for (let d = 1; d <= N; d++) if (d + t <= N || d - t >= 1) m |= 1 << d; }
    else if (cg.op === '/') { m = 0; for (let d = 1; d <= N; d++) if (d * t <= N || (d % t === 0)) m |= 1 << d; }
    else if (cg.op === '=') m = 1 << t;
    for (const i of cg.cells) base[i] &= m;
  }
  for (const s of sky) {                         // a tower d steps from a clue k is at most N - k + 1 + d
    s.cells.forEach((i, d) => { base[i] &= rangeMask(s.clue === 1 && d === 0 ? N : 1, N - s.clue + 1 + d, N); });
  }

  const setCand = (cand, i, m, stack) => {
    if (m === cand[i]) return true;
    if (!m) return false;
    cand[i] = m;
    if (!(m & (m - 1))) stack.push(i, lowBit(m));
    return true;
  };

  function cageOk(k, cand, val, stack) {
    const cg = spec.cages[k], cs = cg.cells, t = cg.target;
    if (cg.op === '+') {
      let s = 0; const U = [];
      for (const i of cs) { if (val[i]) s += val[i]; else U.push(i); }
      const rem = t - s;
      if (!U.length) return rem === 0;
      if (rem <= 0) return false;
      if (U.length === 1) return rem <= N && setCand(cand, U[0], cand[U[0]] & (1 << rem), stack);
      let mn = 0, mx = 0;
      if (cg.distinct) {
        let uni = 0;
        for (const u of U) uni |= cand[u];
        const bits = bitsOf(uni);
        if (bits.length < U.length) return false;
        for (let j = 0; j < U.length; j++) { mn += bits[j]; mx += bits[bits.length - 1 - j]; }
        if (rem < mn || rem > mx) return false;
      }
      let smin = 0, smax = 0;
      for (const u of U) { smin += lowBit(cand[u]); smax += highBit(cand[u]); }
      if (rem < smin || rem > smax) return false;
      for (const u of U) {
        const lo = rem - (smax - highBit(cand[u])), hi = rem - (smin - lowBit(cand[u]));
        if (!setCand(cand, u, cand[u] & rangeMask(lo, hi, N), stack)) return false;
      }
      return true;
    }
    if (cg.op === '*') {
      let p = 1; const U = [];
      for (const i of cs) { if (val[i]) p *= val[i]; else U.push(i); }
      if (t % p) return false;
      const rem = t / p;
      if (!U.length) return rem === 1;
      if (U.length === 1) return rem <= N && setCand(cand, U[0], cand[U[0]] & (1 << rem), stack);
      let dm = 0;
      for (let d = 1; d <= N; d++) if (rem % d === 0) dm |= 1 << d;
      let pmin = 1, pmax = 1;
      for (const u of U) {
        if (!setCand(cand, u, cand[u] & dm, stack)) return false;
        pmin *= lowBit(cand[u]); pmax *= highBit(cand[u]);
      }
      return pmin <= rem && rem <= pmax;
    }
    if (cg.op === '=') { const i = cs[0]; return !val[i] || val[i] === t; }
    const a = cs[0], b = cs[1];
    if (val[a] && val[b]) {
      const x = val[a], y = val[b];
      return cg.op === '-' ? Math.abs(x - y) === t : Math.max(x, y) === t * Math.min(x, y);
    }
    const known = val[a] ? a : val[b] ? b : -1;
    if (known < 0) return true;
    const other = known === a ? b : a, v = val[known];
    let m = 0;
    if (cg.op === '-') { if (v + t <= N) m |= 1 << (v + t); if (v - t >= 1) m |= 1 << (v - t); }
    else { if (v * t <= N) m |= 1 << (v * t); if (v % t === 0) m |= 1 << (v / t); }
    return setCand(cand, other, cand[other] & m, stack);
  }

  function arrowOk(k, cand, val, stack) {
    const a = spec.arrows[k];
    let s = 0, mn = 0, mx = 0; const U = [];
    for (const i of a.cells) { if (val[i]) s += val[i]; else { U.push(i); mn += lowBit(cand[i]); mx += highBit(cand[i]); } }
    const c = a.circle;
    if (val[c]) {
      const rem = val[c] - s;
      if (rem < mn || rem > mx) return false;
      for (const u of U) {
        const lo = rem - (mx - highBit(cand[u])), hi = rem - (mn - lowBit(cand[u]));
        if (!setCand(cand, u, cand[u] & rangeMask(lo, hi, N), stack)) return false;
      }
      return true;
    }
    return setCand(cand, c, cand[c] & rangeMask(s + mn, s + mx, N), stack);
  }

  function skyOk(k, val) {
    const s = sky[k], cs = s.cells, len = cs.length;
    let max = 0, vis = 0, j = 0;
    for (; j < len; j++) { const v = val[cs[j]]; if (!v) break; if (v > max) { max = v; vis++; } }
    if (j === len || max === N) return vis === s.clue;
    if (vis > s.clue) return false;
    return vis + Math.min(len - j, N - max) >= s.clue;
  }

  function assign(cand, val, i0, v0) {
    const stack = [i0, v0];
    while (stack.length) {
      const v = stack.pop(), i = stack.pop();
      if (val[i]) { if (val[i] !== v) return false; continue; }
      const bit = 1 << v;
      if (!(cand[i] & bit)) return false;
      val[i] = v; cand[i] = bit;
      const P = peers[i];
      for (let k = 0; k < P.length; k++) {
        const p = P[k];
        if (val[p]) { if (val[p] === v) return false; continue; }
        const c = cand[p];
        if (c & bit) { const m = c & ~bit; if (!m) return false; cand[p] = m; if (!(m & (m - 1))) stack.push(p, lowBit(m)); }
      }
      const RA = rels[i];
      for (let k = 0; k < RA.length; k += 2) {
        const o = RA[k], allow = REL[RA[k + 1] * (N + 1) + v];
        if (val[o]) { if (!(allow & (1 << val[o]))) return false; continue; }
        const c = cand[o], m = c & allow;
        if (m !== c) { if (!m) return false; cand[o] = m; if (!(m & (m - 1))) stack.push(o, lowBit(m)); }
      }
      const CG = cagesOf[i];
      for (let k = 0; k < CG.length; k++) if (!cageOk(CG[k], cand, val, stack)) return false;
      const AR = arrowsOf[i];
      for (let k = 0; k < AR.length; k++) if (!arrowOk(AR[k], cand, val, stack)) return false;
      const SK = skyOf[i];
      for (let k = 0; k < SK.length; k++) if (!skyOk(SK[k], val)) return false;
    }
    return true;
  }

  /* A digit with one spot left in a full group (hidden single), or -1 when a digit has none */
  function hidden(cand, val, withGroup) {
    for (let gi = 0; gi < fullGroups.length; gi++) {
      const g = fullGroups[gi];
      let once = 0, twice = 0, placed = 0;
      for (let k = 0; k < g.length; k++) {
        const i = g[k];
        if (val[i]) placed |= 1 << val[i]; else { const m = cand[i]; twice |= once & m; once |= m; }
      }
      if (((once | placed) & FULL) !== FULL) return -1;
      const single = once & ~twice & ~placed;
      if (single) {
        const v = lowBit(single);
        for (let k = 0; k < g.length; k++) { const i = g[k]; if (!val[i] && (cand[i] & (1 << v))) return withGroup ? { i, v, g: gi, kind: fullKinds[gi], cells: Array.from(g) } : { i, v }; }
      }
    }
    return 0;
  }

  function start(givens) {
    const cand = base.slice(), val = new Int8Array(size);
    for (const i of cells) if (!cand[i]) return null;
    if (givens) for (const i of cells) if (givens[i] && !assign(cand, val, i, givens[i])) return null;
    for (const i of cells) if (!val[i] && !(cand[i] & (cand[i] - 1)) && !assign(cand, val, i, lowBit(cand[i]))) return null;
    return { cand, val };
  }

  function search(cand, val, ctx) {
    if (++ctx.nodes > ctx.max) { ctx.aborted = true; return true; }
    let best = -1, bestN = 99;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k];
      if (val[i]) continue;
      const n = popcount(cand[i]);
      if (n < bestN) { bestN = n; best = i; if (n < 2) break; }
    }
    if (best < 0) {
      ctx.count++;
      if (!ctx.first) ctx.first = Int8Array.from(val); else if (!ctx.second) ctx.second = Int8Array.from(val);
      return ctx.count >= ctx.limit;
    }
    if (bestN === 0) return false;
    let order = null;
    if (bestN > 1 && fullGroups.length) {
      const h = hidden(cand, val, false);
      if (h === -1) return false;
      if (h) { best = h.i; order = [h.v]; }
    }
    if (!order) { order = bitsOf(cand[best]); if (ctx.random) shuffle(order); }
    for (const v of order) {
      const c2 = cand.slice(), v2 = val.slice();
      if (assign(c2, v2, best, v) && search(c2, v2, ctx)) return true;
    }
    return false;
  }

  /* Deduction only, no guessing: rule propagation plus naked and hidden singles */
  function logic(givens) {
    const st = start(givens);
    if (!st) return null;
    const { cand, val } = st;
    for (;;) {
      const h = hidden(cand, val, false);
      if (h === -1) return null;
      if (!h) break;
      if (!assign(cand, val, h.i, h.v)) return null;
    }
    let solved = true;
    for (const i of cells) if (!val[i]) { solved = false; break; }
    return { solved, cand, val };
  }

  return {
    spec, cells, peers, fullGroups, fullKinds, assign, hidden, start, logic, FULL,
    count(givens, limit = 2, max = 250000) {
      const ctx = { count: 0, limit, nodes: 0, max, aborted: false, random: false, first: null, second: null };
      const st = start(givens);
      if (st) search(st.cand, st.val, ctx);
      return ctx;
    },
    fill(max = 60000) {
      const ctx = { count: 0, limit: 1, nodes: 0, max, aborted: false, random: true, first: null, second: null };
      const st = start(null);
      if (st) search(st.cand, st.val, ctx);
      return ctx.aborted ? null : ctx.first;
    },
  };
}
const unique = r => r.count === 1 && !r.aborted;
/* A puzzle is fair when deduction alone finishes it (which also proves it unique) */
const fair = (solver, g) => { const r = solver.logic(g); return !!(r && r.solved); };
const settled = (solver, g, logicMode, max) => (logicMode ? fair(solver, g) : unique(solver.count(g, 2, max)));

/* =============================================================================
   Building blocks for generators
   ============================================================================= */
/* Pattern-based solution for plain boxed sudoku: instant for any size */
function patternSolution(spec, N, bh, bw) {
  const rows = [], cols = [];
  for (const band of shuffle(range(N / bh))) for (const r of shuffle(range(bh))) rows.push(band * bh + r);
  for (const stack of shuffle(range(N / bw))) for (const c of shuffle(range(bw))) cols.push(stack * bw + c);
  const digits = shuffle(range(N).map(d => d + 1));
  const transpose = bh === bw && Math.random() < 0.5;
  const sol = new Int8Array(spec.R * spec.C);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const rr = rows[r], cc = cols[c];
    const v = (bw * (rr % bh) + Math.floor(rr / bh) + cc) % N;
    sol[transpose ? c * spec.C + r : r * spec.C + c] = digits[v];
  }
  return sol;
}
function randomLatin(N) {
  const spec = newSpec(N, N, N);
  addSquare(spec, 0, 0, N);
  for (let t = 0; t < 30; t++) { const s = makeSolver(spec).fill(20000); if (s) return s; }
  return null;
}

/* Remove givens while the solution stays unique, in rotationally symmetric pairs */
async function dig(solver, sol, target, opts = {}) {
  const spec = solver.spec, size = spec.R * spec.C, g = Int8Array.from(sol);
  const max = opts.max || 60000;
  let count = solver.cells.length;
  const seen = new Set(), pairs = [];
  for (const i of shuffle(solver.cells.slice())) {
    if (seen.has(i)) continue;
    const j = size - 1 - i;
    const pair = opts.symmetric !== false && j !== i && spec.exist[j] ? [i, j] : [i];
    pair.forEach(k => seen.add(k));
    pairs.push(pair);
  }
  const tryRemove = async pair => {
    const keep = pair.map(k => g[k]);
    pair.forEach(k => { g[k] = 0; });
    if (settled(solver, g, opts.logic, max)) count -= pair.length;
    else pair.forEach((k, n) => { g[k] = keep[n]; });
    await breathe();
  };
  for (const p of pairs) { if (count <= target) break; await tryRemove(p); if (opts.deadline && now() > opts.deadline) break; }
  if (count > target && !(opts.deadline && now() > opts.deadline)) {
    for (const i of shuffle(solver.cells.slice())) { if (count <= target) break; if (g[i]) await tryRemove([i]); if (opts.deadline && now() > opts.deadline) break; }
  }
  return g;
}

/* Start from no givens and reveal cells where a second solution disagrees, until unique */
async function addUntilUnique(solver, sol, opts = {}) {
  const size = solver.spec.R * solver.spec.C, g = new Int8Array(size), max = opts.max || 60000;
  for (let guard = 0; guard < size; guard++) {
    let opts2;
    if (opts.logic) {
      const lr = solver.logic(g);
      if (lr && lr.solved) break;
      opts2 = solver.cells.filter(i => !g[i] && (!lr || !lr.val[i]));
    } else {
      const r = solver.count(g, 2, max);
      if (unique(r)) break;
      const alt = [r.first, r.second].find(s => s && s.some((v, i) => v !== sol[i]));
      opts2 = solver.cells.filter(i => !g[i] && (!alt || alt[i] !== sol[i]));
    }
    if (!opts2.length) opts2 = solver.cells.filter(i => !g[i]);
    const i = pick(opts2);
    g[i] = sol[i];
    await breathe();
  }
  // drop givens that turned out not to be needed
  for (const i of shuffle(solver.cells.filter(k => g[k]))) {
    const keep = g[i]; g[i] = 0;
    if (!settled(solver, g, opts.logic, max)) g[i] = keep;
    await breathe();
  }
  return g;
}
function addExtra(solver, sol, g, n) {
  const empty = shuffle(solver.cells.filter(i => !g[i]));
  for (let k = 0; k < n && k < empty.length; k++) g[empty[k]] = sol[empty[k]];
  return g;
}

/* Random partition into connected cages whose digits differ (killer) or not (calcudoku) */
function makeCages(spec, sol, sizes, distinct) {
  const owner = new Int16Array(spec.R * spec.C).fill(-1), cages = [];
  const linesOf = i => [(i / spec.C) | 0, spec.R + (i % spec.C)];
  for (const s of shuffle(cellsOf(spec))) {
    if (owner[s] >= 0) continue;
    const want = pick(sizes), cg = [s];
    owner[s] = cages.length;
    let used = 1 << sol[s];
    while (cg.length < want) {
      const fr = [];
      for (const i of cg) for (const j of nbrs4(spec, i)) {
        if (owner[j] >= 0 || fr.includes(j)) continue;
        if (distinct && (used & (1 << sol[j]))) continue;
        fr.push(j);
      }
      if (!fr.length) break;
      const j = pick(fr);
      cg.push(j); owner[j] = cages.length; used |= 1 << sol[j];
    }
    cages.push(cg);
  }
  // fold lonely single cells into a neighbouring cage where they fit
  for (let k = 0; k < cages.length; k++) {
    if (cages[k].length !== 1 || Math.random() < 0.15) continue;
    const i = cages[k][0];
    const opts = nbrs4(spec, i).map(j => owner[j]).filter(o => o !== k && cages[o].length < Math.max(...sizes) + 1 &&
      (!distinct || !cages[o].some(x => sol[x] === sol[i])));
    if (!opts.length) continue;
    const o = pick(opts);
    cages[o].push(i); owner[i] = o; cages[k] = [];
  }
  void linesOf;
  return cages.filter(c => c.length);
}

/* Jigsaw regions: start from boxes, then trade border cells while keeping regions connected */
function jigsawRegions(N, bh, bw, swaps) {
  const reg = new Int16Array(N * N);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) reg[r * N + c] = Math.floor(r / bh) * (N / bw) + Math.floor(c / bw);
  const nb = i => { const r = (i / N) | 0, c = i % N, o = []; if (r) o.push(i - N); if (r < N - 1) o.push(i + N); if (c) o.push(i - 1); if (c < N - 1) o.push(i + 1); return o; };
  const connected = id => {
    let startCell = -1, total = 0;
    for (let i = 0; i < N * N; i++) if (reg[i] === id) { total++; if (startCell < 0) startCell = i; }
    const seen = new Uint8Array(N * N), st = [startCell]; seen[startCell] = 1; let n = 0;
    while (st.length) { const i = st.pop(); n++; for (const j of nb(i)) if (!seen[j] && reg[j] === id) { seen[j] = 1; st.push(j); } }
    return n === total;
  };
  let done = 0;
  for (let it = 0; it < 20000 && done < swaps; it++) {
    const a = rand(N * N), ns = nb(a).filter(j => reg[j] !== reg[a]);
    if (!ns.length) continue;
    const b = pick(ns), ra = reg[a], rb = reg[b];
    const cs = [];
    for (let i = 0; i < N * N; i++) if (reg[i] === rb && i !== b && nb(i).some(j => reg[j] === ra && j !== a)) cs.push(i);
    if (!cs.length) continue;
    const c = pick(cs);
    reg[a] = rb; reg[c] = ra;
    if (connected(ra) && connected(rb)) done++; else { reg[a] = ra; reg[c] = rb; }
  }
  return reg;
}

/* =============================================================================
   Variants
   Each has levels, a builder that returns { spec, sol }, and a clue strategy.
   ============================================================================= */
const LV = (easy, medium, hard, extra) => Object.assign({
  easy: { name: 'Easy', rank: 1, target: easy, desc: '' },
  medium: { name: 'Medium', rank: 2, target: medium, desc: '' },
  hard: { name: 'Hard', rank: 3, target: hard, desc: '' },
}, extra || {});

function boxed(N, bh, bw) { const spec = newSpec(N, N, N); addSquare(spec, 0, 0, N, bh, bw); return spec; }
function fillOrNull(spec, max) { return makeSolver(spec).fill(max || 60000); }

const V = {};

V.mini = {
  levels: {
    tiny: { name: '4×4', rank: 1, N: 4, bh: 2, bw: 2, target: 0, desc: 'Digits 1 to 4 in 2×2 boxes. A two-minute warm-up.' },
    easy: { name: '6×6 easy', rank: 2, N: 6, bh: 2, bw: 3, target: 16, desc: 'Digits 1 to 6 in 2×3 boxes, with plenty of clues.' },
    hard: { name: '6×6 hard', rank: 3, N: 6, bh: 2, bw: 3, target: 0, desc: 'Digits 1 to 6, with as few clues as the puzzle allows.' },
  },
  build(L) { const spec = boxed(L.N, L.bh, L.bw); return { spec, sol: patternSolution(spec, L.N, L.bh, L.bw) }; },
};
V.giant = {
  levels: {
    easy: { name: 'Easy', rank: 1, target: 150, desc: 'About 150 clues on the 16×16 board.' },
    medium: { name: 'Medium', rank: 2, target: 130, desc: 'About 130 clues.' },
    hard: { name: 'Hard', rank: 3, target: 112, desc: 'About 112 clues. Bring patience.' },
  },
  maxNodes: 4000,
  build() { const spec = boxed(16, 4, 4); return { spec, sol: patternSolution(spec, 16, 4, 4) }; },
};
const nine = () => boxed(9, 3, 3);
const desc9 = { easy: 'About 36 clues. A gentle start.', medium: 'About 30 clues.', hard: 'As few clues as the rules allow.' };
const lv9 = (e = 36, m = 30) => { const l = LV(e, m, 0); for (const k in desc9) l[k].desc = desc9[k]; return l; };

V.x = { levels: lv9(), build() {
  const spec = nine(); spec.diag = true;
  addGroup(spec, range(9).map(k => k * 9 + k), 'diagonal');
  addGroup(spec, range(9).map(k => k * 9 + 8 - k), 'diagonal');
  return { spec, sol: fillOrNull(spec) };
} };
V.hyper = { levels: lv9(), build() {
  const spec = nine(); spec.windows = [];
  for (const [r0, c0] of [[1, 1], [1, 5], [5, 1], [5, 5]]) {
    const w = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) w.push((r0 + r) * 9 + c0 + c);
    addGroup(spec, w, 'window'); spec.windows.push(w);
  }
  return { spec, sol: fillOrNull(spec) };
} };
V.jigsaw = { levels: lv9(), build() {
  const spec = newSpec(9, 9, 9);
  addSquare(spec, 0, 0, 9);
  const reg = jigsawRegions(9, 3, 3, 90 + rand(60));
  for (let id = 0; id < 9; id++) { const cells = []; for (let i = 0; i < 81; i++) if (reg[i] === id) cells.push(i); addGroup(spec, cells, 'region'); }
  spec.region = Int16Array.from(reg);
  return { spec, sol: fillOrNull(spec, 30000) };
} };
const kingOffs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const knightOffs = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
function addMoveRels(spec, offs, t) {
  const { R, C } = spec;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of offs) {
    const r2 = r + dr, c2 = c + dc;
    if (r2 < 0 || c2 < 0 || r2 >= R || c2 >= C) continue;
    const a = r * C + c, b = r2 * C + c2;
    if (a < b) spec.rels.push([a, b, t]);
  }
}
V.antiknight = { levels: lv9(34, 28), build() { const spec = nine(); addMoveRels(spec, knightOffs, NE); return { spec, sol: fillOrNull(spec) }; } };
V.antiking = { levels: lv9(34, 28), build() { const spec = nine(); addMoveRels(spec, kingOffs.filter(([a, b]) => a && b), NE); return { spec, sol: fillOrNull(spec) }; } };
V.nonconsec = { levels: lv9(30, 22), build() { const spec = nine(); addMoveRels(spec, [[0, 1], [1, 0]], NC); return { spec, sol: fillOrNull(spec, 120000) }; } };
V.evenodd = { levels: lv9(34, 28), build() {
  const spec = nine(), sol = fillOrNull(spec);
  if (sol) for (const i of cellsOf(spec)) if (Math.random() < 0.5) spec.parity[i] = sol[i] % 2 ? 1 : 2;
  return { spec, sol };
} };
V.thermo = { levels: lv9(32, 26), build() {
  const spec = nine(), sol = fillOrNull(spec);
  if (!sol) return { spec, sol };
  const used = new Uint8Array(81);
  for (let t = 0; t < 600 && spec.thermos.length < 9; t++) {
    const s = rand(81);
    if (used[s] || sol[s] > 5) continue;
    const want = 3 + rand(4), path = [s];
    while (path.length < want) {
      const last = path[path.length - 1];
      const nx = nbrs4(spec, last).filter(j => !used[j] && !path.includes(j) && sol[j] > sol[last]);
      if (!nx.length) break;
      nx.sort((a, b) => sol[a] - sol[b]);
      path.push(Math.random() < 0.6 ? nx[0] : pick(nx));
    }
    if (path.length < 3) continue;
    path.forEach(i => { used[i] = 1; });
    spec.thermos.push(path);
    for (let k = 1; k < path.length; k++) spec.rels.push([path[k - 1], path[k], LT]);
  }
  return { spec, sol };
} };
V.arrow = { levels: lv9(32, 26), build() {
  const spec = nine(), sol = fillOrNull(spec);
  if (!sol) return { spec, sol };
  const used = new Uint8Array(81);
  for (let t = 0; t < 900 && spec.arrows.length < 8; t++) {
    const c = rand(81);
    if (used[c] || sol[c] < 3) continue;
    const path = [];
    let sum = 0, cur = c;
    for (let step = 0; step < 6 && sum < sol[c]; step++) {
      const nx = nbrs4(spec, cur).filter(j => !used[j] && j !== c && !path.includes(j) && sum + sol[j] <= sol[c]);
      if (!nx.length) break;
      cur = pick(nx); path.push(cur); sum += sol[cur];
    }
    if (sum !== sol[c] || path.length < 2) continue;
    used[c] = 1; path.forEach(i => { used[i] = 1; });
    spec.arrows.push({ circle: c, cells: path });
  }
  return { spec, sol };
} };
V.killer = {
  levels: {
    easy: { name: 'Easy', rank: 1, sizes: [2, 2, 3, 3], extra: 10, desc: 'Small cages and a few printed digits.' },
    medium: { name: 'Medium', rank: 2, sizes: [2, 3, 3, 4], extra: 3, desc: 'Mid-size cages, hardly any digits printed.' },
    hard: { name: 'Hard', rank: 3, sizes: [2, 3, 4, 5], extra: 0, logic: false, desc: 'Big cages and only the sums to go on.' },
  },
  strategy: 'add',
  build(L) {
    const spec = nine(), sol = patternSolution(spec, 9, 3, 3);
    spec.cageStyle = 'killer';
    for (const cg of makeCages(spec, sol, L.sizes, true)) {
      spec.cages.push({ cells: cg, target: cg.reduce((s, i) => s + sol[i], 0), op: '+', distinct: true });
      if (cg.length > 1) addGroup(spec, cg, 'cage');
    }
    return { spec, sol };
  },
};
V.greater = {
  levels: { easy: { name: 'Easy', rank: 1, extra: 12, desc: 'Signs everywhere, plus a dozen digits.' }, medium: { name: 'Medium', rank: 2, extra: 5, desc: 'Signs and a handful of digits.' }, hard: { name: 'Hard', rank: 3, extra: 0, logic: false, desc: 'Signs and only the digits that are strictly needed.' } },
  strategy: 'add',
  build() {
    const spec = nine(), sol = patternSolution(spec, 9, 3, 3);
    spec.signs = [];
    for (let i = 0; i < 81; i++) for (const j of [i + 1, i + 9]) {
      if (j >= 81 || (j === i + 1 && i % 9 === 8) || spec.region[i] !== spec.region[j]) continue;
      spec.rels.push([i, j, sol[i] < sol[j] ? LT : GT]);
      spec.signs.push([i, j]);
    }
    return { spec, sol };
  },
};
V.kropki = {
  levels: { easy: { name: 'Easy', rank: 1, extra: 10, desc: 'Every dot shown, plus ten digits.' }, medium: { name: 'Medium', rank: 2, extra: 4, desc: 'Every dot shown and a few digits.' }, hard: { name: 'Hard', rank: 3, extra: 0, logic: false, desc: 'Every dot shown and only the digits that are needed.' } },
  strategy: 'add',
  build() {
    const spec = nine(), sol = fillOrNull(spec);
    if (!sol) return { spec, sol };
    spec.dots = [];
    for (let i = 0; i < 81; i++) for (const j of [i + 1, i + 9]) {
      if (j >= 81 || (j === i + 1 && i % 9 === 8)) continue;
      const a = sol[i], b = sol[j], cons = Math.abs(a - b) === 1, dbl = a === 2 * b || b === 2 * a;
      if (cons && dbl) { const w = Math.random() < 0.5; spec.rels.push([i, j, w ? W1 : B2]); spec.dots.push([i, j, w ? 'w' : 'b']); }
      else if (cons) { spec.rels.push([i, j, W1]); spec.dots.push([i, j, 'w']); }
      else if (dbl) { spec.rels.push([i, j, B2]); spec.dots.push([i, j, 'b']); }
      else spec.rels.push([i, j, NK]);
    }
    return { spec, sol };
  },
};
V.samurai = {
  levels: {
    easy: { name: 'Easy', rank: 1, target: 200, desc: 'Five overlapping grids with generous clues.' },
    medium: { name: 'Medium', rank: 2, target: 170, desc: 'Fewer clues; the overlaps start to matter.' },
    hard: { name: 'Hard', rank: 3, target: 0, desc: 'As few clues as the five grids allow.' },
  },
  maxNodes: 6000,
  build() {
    const spec = newSpec(21, 21, 9);
    for (const [oy, ox] of [[0, 0], [0, 12], [6, 6], [12, 0], [12, 12]]) addSquare(spec, oy, ox, 9, 3, 3);
    return { spec, sol: fillOrNull(spec, 40000) };
  },
};
V.futoshiki = {
  levels: {
    easy: { name: '5×5', rank: 1, N: 5, p: 0.42, extra: 2, desc: 'Digits 1 to 5 with lots of signs.' },
    medium: { name: '6×6', rank: 2, N: 6, p: 0.36, extra: 1, desc: 'Digits 1 to 6.' },
    hard: { name: '7×7', rank: 3, N: 7, p: 0.32, extra: 0, logic: false, desc: 'Digits 1 to 7, minimal clues.' },
  },
  strategy: 'add',
  build(L) {
    const N = L.N, spec = newSpec(N, N, N);
    addSquare(spec, 0, 0, N);
    const sol = randomLatin(N);
    spec.signs = [];
    for (let i = 0; i < N * N; i++) for (const j of [i + 1, i + N]) {
      if (j >= N * N || (j === i + 1 && i % N === N - 1) || Math.random() > L.p) continue;
      spec.rels.push([i, j, sol[i] < sol[j] ? LT : GT]); spec.signs.push([i, j]);
    }
    return { spec, sol };
  },
};
V.calcudoku = {
  levels: {
    easy: { name: '4×4', rank: 1, N: 4, sizes: [1, 2, 2, 2, 3], desc: 'Digits 1 to 4 and small cages.' },
    medium: { name: '5×5', rank: 2, N: 5, sizes: [1, 2, 2, 3, 3], desc: 'Digits 1 to 5.' },
    hard: { name: '6×6', rank: 3, N: 6, sizes: [2, 2, 3, 3, 4], logic: false, desc: 'Digits 1 to 6 and bigger cages.' },
  },
  strategy: 'add',
  build(L) {
    const N = L.N, spec = newSpec(N, N, N);
    addSquare(spec, 0, 0, N);
    const sol = randomLatin(N);
    spec.cageStyle = 'calc';
    for (const cg of makeCages(spec, sol, L.sizes, false)) {
      const vals = cg.map(i => sol[i]);
      let op, target;
      if (cg.length === 1) { op = '='; target = vals[0]; }
      else if (cg.length === 2) {
        const hi = Math.max(...vals), lo = Math.min(...vals), r = Math.random();
        if (hi % lo === 0 && hi !== lo && r < 0.45) { op = '/'; target = hi / lo; }
        else if (r < 0.75) { op = '-'; target = hi - lo; }
        else if (r < 0.88) { op = '+'; target = hi + lo; }
        else { op = '*'; target = hi * lo; }
      } else {
        const prod = vals.reduce((p, v) => p * v, 1);
        if (Math.random() < 0.5 && prod <= 720) { op = '*'; target = prod; } else { op = '+'; target = vals.reduce((s, v) => s + v, 0); }
      }
      spec.cages.push({ cells: cg, target, op, distinct: false });
    }
    return { spec, sol };
  },
};
V.skyscrapers = {
  levels: {
    easy: { name: '4×4', rank: 1, N: 4, keep: 1, desc: 'Towers 1 to 4, every clue shown.' },
    medium: { name: '5×5', rank: 2, N: 5, keep: 0.6, desc: 'Towers 1 to 5, some clues removed.' },
    hard: { name: '6×6', rank: 3, N: 6, keep: 0, logic: false, desc: 'Towers 1 to 6, only the clues that are needed.' },
  },
  strategy: 'sky',
  build(L) {
    const N = L.N, W = N + 2, spec = newSpec(W, W, N);
    addSquare(spec, 1, 1, N);
    const inner = newSpec(N, N, N); void inner;
    const lat = randomLatin(N), sol = new Int8Array(W * W);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) sol[(r + 1) * W + c + 1] = lat[r * N + c];
    const at = (r, c) => r * W + c;
    const lines = [];
    for (let k = 1; k <= N; k++) {
      lines.push({ at: at(k, 0), cells: range(N).map(c => at(k, c + 1)) });
      lines.push({ at: at(k, W - 1), cells: range(N).map(c => at(k, N - c)) });
      lines.push({ at: at(0, k), cells: range(N).map(r => at(r + 1, k)) });
      lines.push({ at: at(W - 1, k), cells: range(N).map(r => at(N - r, k)) });
    }
    for (const l of lines) { let mx = 0, v = 0; for (const i of l.cells) if (sol[i] > mx) { mx = sol[i]; v++; } l.clue = v; }
    spec.sky = lines;
    return { spec, sol };
  },
};

/* =============================================================================
   Generate: build, then settle the clues according to the variant's strategy
   ============================================================================= */
async function generate(vid, levelKey, onStatus) {
  const def = V[vid], L = def.levels[levelKey];
  const t0 = now();
  for (let attempt = 0; attempt < 40; attempt++) {
    const { spec, sol } = def.build(L);
    if (!sol) { await breathe(); continue; }
    const solver = makeSolver(spec);
    const max = def.maxNodes || 60000;
    let givens;
    const logicMode = L.logic !== false;
    if (def.strategy === 'add') {
      if (!unique(solver.count(null, 2, max)) && vid === 'calcudoku' && attempt < 25) { await breathe(); continue; }
      givens = await addUntilUnique(solver, sol, { max, logic: logicMode });
      if (L.extra) addExtra(solver, sol, givens, L.extra);
    } else if (def.strategy === 'sky') {
      const full = spec.sky.map(s => s.clue);
      givens = new Int8Array(spec.R * spec.C);
      let s0 = makeSolver(spec);
      if (!settled(s0, givens, logicMode, max)) givens = await addUntilUnique(s0, sol, { max, logic: logicMode });
      const order = shuffle(range(spec.sky.length));
      const keepN = Math.round(spec.sky.length * L.keep);
      let shown = spec.sky.length;
      for (const k of order) {
        if (shown <= keepN) break;
        const c = spec.sky[k].clue;
        spec.sky[k].clue = 0;
        if (settled(makeSolver(spec), givens, logicMode, max)) shown--; else spec.sky[k].clue = c;
        await breathe();
      }
      void full;
    } else {
      const deadline = now() + (def.budget || 9000);
      givens = await dig(solver, sol, L.target || 0, { max, deadline, logic: logicMode });
    }
    if (onStatus) onStatus(now() - t0);
    const check = makeSolver(spec).count(givens, 2, 400000);
    if (!unique(check) || check.first.some((v, i) => v !== sol[i])) continue;   // never ship an ambiguous puzzle
    return { spec, sol: Array.from(sol), givens: Array.from(givens), clues: givens.reduce((n, v) => n + (v ? 1 : 0), 0), fair: fair(makeSolver(spec), givens) };
  }
  throw new Error('Could not build a puzzle');
}

/* Serialisation for saved games */
function pack(spec) {
  const o = Object.assign({}, spec);
  delete o._keys;
  for (const k of ['exist', 'region', 'parity']) o[k] = Array.from(spec[k]);
  o.init = spec.init ? Array.from(spec.init) : null;
  return o;
}
function unpack(o) {
  const s = Object.assign({}, o);
  s.exist = Uint8Array.from(o.exist); s.region = Int16Array.from(o.region); s.parity = Uint8Array.from(o.parity);
  s.init = o.init ? Int32Array.from(o.init) : null;
  return s;
}

MG.latinCore = { makeSolver, generate, V, pack, unpack, popcount, lowBit, bitsOf, unique, REL: { NE, NC, LT, GT, W1, B2, NK }, newSpec, addSquare };
})(typeof window !== 'undefined' ? window : globalThis);
