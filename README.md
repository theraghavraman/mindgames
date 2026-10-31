# Mind Games

A browser workbook of 54 mind games: sixteen Sudoku variants, number puzzles, logic grids, moving-piece puzzles,
duels against the computer, brain training and word games. Everything is static HTML, CSS and JavaScript,
so it runs on GitHub Pages (or any static host) with no build step for the site itself.

## One interface for every game

Open `index.html`. On a computer, every game is listed in the sidebar; on a phone, tap a card on the library page.
A game opens right there, with no page change. Its back arrow returns you to the library, and the browser's back
button works too. The games you opened most recently stay loaded and paused, so switching between them is instant.
Links like `https://<your-name>.github.io/<repository>/#/killer-sudoku` open a game directly.

**`mind-games.html` is the whole collection in one file.** Double-click it to play offline: no server, no internet.

## Put it on GitHub Pages

1. Create a repository and upload the **contents** of this folder to its root (so `index.html` sits at the top).
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick your main branch and the `/ (root)` folder, then **Save**.
4. After a minute the site is live at `https://<your-name>.github.io/<repository>/`.

The empty `.nojekyll` file tells GitHub Pages to serve the files exactly as they are.

## Try it on your computer

Every page works when opened straight from disk. For the closest match to GitHub Pages, serve the folder:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>.

## Changing the games

`mind-games.html` holds a copy of every shared style and script, so refresh it after changing any of them:

```
node tools/build-offline.mjs
```

Anything a game does after a delay goes through `api.later` or `api.wait` rather than a bare timer. A new round cancels
them, and they only count time the player could be watching, so a pause, a hidden game or an open dialog holds them.

The browser regression tests need Chrome and `playwright-core`:

```
npm i --no-save playwright-core
node tests/regression.mjs
```

## What's inside

```
index.html               the one-page launcher: library, sidebar, games open in place
mind-games.html          everything in a single file, for offline play
404.html                 friendly not-found page
games/<game>/index.html  one page per game
assets/css/mg.css        shared design system: graph paper, highlighter colours per chapter
assets/css/hub.css       hub styles
assets/css/latin.css     board styles for the Sudoku family
assets/js/mg.js          shared shell: levels, timer, pause, rules, settings, statistics, sounds, confetti
assets/js/latin-core.js  constraint solver and puzzle generators for the Sudoku family, Futoshiki,
                         Calcudoku, Skyscrapers and Kakuro
assets/js/latin.js       board and play for the Sudoku family
assets/js/games/*.js     every other game, one file each
assets/js/catalog.js     the list of games shown on the hub
assets/js/thumbs.js      the small drawings on the hub cards
assets/js/data/words5.js five-letter words for Word Guess
assets/fonts/            Recursive, self-hosted
tools/build-offline.mjs  refreshes mind-games.html from the sources
tests/regression.mjs     browser tests for rounds, pause, keyboard play and packaging
```

Progress, settings and statistics are kept in the browser's local storage on each device. Nothing is sent anywhere.

## How puzzles are made

Puzzles are generated in the browser every time you start a game. Puzzles with a single answer are checked by a solver
before you see them:

- **Sudoku family, Futoshiki, Calcudoku, Skyscrapers**: one constraint solver propagates every rule and counts
  solutions. Most levels are also checked to be solvable by deduction alone, without guessing; the hard levels of
  Killer, Greater-Than, Kropki, Futoshiki, Calcudoku and Skyscrapers are only guaranteed a single solution.
- **Kakuro**: the same solver confirms exactly one solution at every size.
- **Nonogram**: a line solver must finish the picture row by row.
- **Binairo**: a rule-based solver must finish the grid.
- **Star Battle, Hitori, Sumplete**: exhaustive search confirms exactly one solution.
- **Make 24**: an exact-fraction solver confirms every deal can reach 24.
- **Traffic Jam**: a breadth-first search over every reachable position finds the fewest moves.
- **Lights Out**: solved exactly over GF(2), which also powers hints.

## Credits

- Typeface: [Recursive](https://github.com/arrowtype/recursive), SIL Open Font License (`assets/fonts/OFL-LICENSE.txt`).
- Word list: [an-array-of-english-words](https://www.npmjs.com/package/an-array-of-english-words), MIT License
  (`assets/js/data/WORDS-LICENSE.txt`).
