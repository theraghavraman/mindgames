#!/usr/bin/env node
/* Refreshes mind-games.html, the single-file offline copy, from the sources in assets/ and games/.
   Run it after changing any shared style or script:  node tools/build-offline.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const OUT = 'mind-games.html';
const EMBED = 'window.MG_EMBED = ';

/* The offline copy carries the font inline, so the sources' font links come out */
const inlineCss = () => read('assets/css/mg.css').replace(/@font-face \{[\s\S]*?\n\}\n/, '');
const classic = () => read('games/sudoku/index.html')
  .replace(/<link rel="preload"[^\n]*\n/, '')
  .replace(/@font-face \{[^\n]*\n/, '');

const html = read(OUT);
const embedAt = html.indexOf('<script>' + EMBED) + '<script>'.length;
const embedEnd = html.indexOf('\n', embedAt);
const embed = JSON.parse(html.slice(embedAt + EMBED.length, embedEnd).replace(/;\s*$/, ''));
for (const key of Object.keys(embed.assets)) embed.assets[key] = key === 'css/mg.css' ? inlineCss() : read('assets/' + key);
embed.classic = classic();
const embedLine = EMBED + JSON.stringify(embed).replace(/<\//g, '<\\/') + ';';

/* Blocks in the order they sit in the page; the embed block keeps its font loader line */
const blocks = ['mg.js', null, 'catalog.js', 'thumbs.js', 'latin-core.js', 'hub.js'];
let n = 0;
let out = html.replace(/<script>([\s\S]*?)<\/script>/g, (whole, body) => {
  const file = blocks[n++];
  if (file === null) return `<script>${embedLine}${body.slice(body.indexOf('\n'))}</script>`;
  if (!file) throw new Error('Unexpected extra script block in ' + OUT);
  return `<script>\n${read('assets/js/' + file).trim()}\n</script>`;
});
if (n !== blocks.length) throw new Error(`Expected ${blocks.length} script blocks in ${OUT}, found ${n}`);
out = out.replace(/<style>[\s\S]*?<\/style>/, () => `<style>\n${inlineCss().trim()}\n</style>`);
fs.writeFileSync(path.join(root, OUT), out);
console.log(`${OUT}: ${(out.length / 1024).toFixed(0)} KB`);
