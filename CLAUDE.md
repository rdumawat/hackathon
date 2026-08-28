# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

There is no build step, package manifest, or test runner — the app is static files served as-is.

```powershell
# Run the app with full PWA behavior (service worker needs http, not file://)
cd C:\dev\hackathon\pre-hackathon
powershell -ExecutionPolicy Bypass -File .\serve.ps1     # then open http://localhost:8000/index.html
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080   # if 8000 is taken
```

For a quick look without offline/install behavior, open `pre-hackathon\index.html` directly.

## Architecture

`pre-hackathon/` holds **Count & Play**, a zero-dependency installable PWA (plain HTML/CSS/JS) —
an arithmetic game for a four-year-old. One round is ten spoken questions mixing addition and
subtraction, scored on how fast each is answered. See `pre-hackathon/README.md` for the product
spec.

| File | Role |
|------|------|
| `index.html` | App shell; loads `audio.js` then `app.js` |
| `app.js` | Question generation (Add, Take Away), the ten-question round, timing/scoring, screens |
| `audio.js` | `window.SFX` (Web Audio effects) and `window.speak` (Web Speech) |
| `styles.css` | Layout; `--tap: 96px` is the minimum touch-target size |
| `sw.js` | Offline cache, network-first with a 3s timeout; bump `CACHE` when shell files change |
| `manifest.webmanifest`, `icon.svg` | Installability |
| `serve.ps1` | Local static server for testing |

**Constraints that must hold when editing `app.js`** — these are product requirements:

- Whole non-negative numbers only. **The answer is never negative, at either level.**
- **Level one** (`MAX` = 10) draws both sides as countable groups of objects. Addition keeps
  `a + b <= MAX` so the total stays countable on screen, and both addends are at least 1 so the
  child always sees two real groups to join. Subtraction draws the amount removed as `1..n`.
- **Level two** (`BIG_MAX` = 99) is a two-digit number against a one-digit one, written as
  **numerals on both sides** — nobody can count eighty-seven of anything, so this is where
  numbers stop being piles to count and become symbols to read. Addition keeps the sum inside
  two digits (`a` is drawn from `10..BIG_MAX - b`); subtraction cannot go negative for free,
  because a two-digit number always exceeds a one-digit one. The two-digit side is always first.
- Scoring **40 or more** in a round (`PROMOTE`) moves the child to level two **permanently** —
  it is stored under `countplay.level` and survives a reload, because clearing level one is an
  achievement and a child should not have to earn it again because the tablet went to sleep.
  There is no way back down. The level is the **only** thing persisted; the star badge is
  deliberately per-round (see below), and the obsolete `countplay.stars` key from older builds
  is cleared on load.
- Nothing requires reading: every prompt is spoken, and round position is drawn as pips rather
  than "3 of 10". Answer buttons show the numeral only — they used to carry a row of dots too,
  but that let a child count the objects on screen and match the button with the same number of
  dots without doing the arithmetic. Do not put them back.
- A round is `ROUND` (10) questions. Stars come from **how many tries a question took**, via
  `STARS_BY_ATTEMPT`: right first time → 5, right on the second try → 3, anything later → 0.
  A round is therefore worth up to 50. The child always keeps trying until it is right — wrong
  answers must never end a question or block progress — but each wrong choice is disabled as it
  is tapped, so a double tap cannot burn a second attempt.
- **Scoring is not timed, and must not become timed again.** It used to score on how fast the
  answer came. Timing a round at a child's pace showed why that fails: counting ten objects takes
  about seven seconds, so every question landed in the same band and the score could not respond
  to playing better. Timing also punishes the careful counting the game exists to teach.
- `speak()` still takes an `onDone` callback (it fires once even when speech is unavailable, and
  polls `speechSynthesis.speaking` rather than trusting its word-count estimate). Nothing uses it
  now that scoring is untimed; it is kept because it is the only reliable "speech has finished"
  signal, which pacing work would need.
- **Nothing on a question screen animates away.** Take Away used to dim the departing objects.
  That acted the subtraction out, but it also left exactly `answer` objects still solid on
  screen — the child could count those instead of subtracting, exactly like the dots under the
  answer buttons. Both groups are now drawn identically and stay put; the ➖ carries the meaning.
- Object groups use a fixed `--cols` grid, never free wrapping: up to four in a row, larger
  groups split into two balanced rows. Free wrapping made "8 + 2" render as 6, 2 and 2, with the
  operator beside the wrong cluster. `--obj` sizes art by the **widest row**, not the total, and
  `.groups` is `nowrap` so the two groups can never stack.
- **Both question types render the same shape**: group, operator badge, group. Take Away shows
  everything you start with on the left and how many go on the right, so subtraction is stated as
  `n ➖ m` rather than silently deleting from one pile. The `.op` badge exists because the
  heavy-minus glyph is a thin bar beside a bold cross for plus, and that symbol is the only cue
  telling a non-reading child which kind of question this is.
- Timers belong to the screen that started them: `later()` registers them and every render calls
  `clearTimers()`. Bare `setTimeout` here will fire over whatever screen comes next.
- The **star badge is the current round's score**, not a running total: it starts at zero every
  round, including the first level-two one, so it reads as progress towards `PROMOTE`. A round
  that falls short starts over from zero. It is never persisted.
- No network calls, no accounts, no ads, no personal data. The only thing in `localStorage` is
  `countplay.level` — a single digit, nothing about the child.

## Environment

- **Platform:** Windows 11, PowerShell is the primary shell. A Git Bash / POSIX shell is also
  available; the two take different syntax, so pick one per command rather than mixing them.
- **Git:** 2.55.0.windows.5, installed per-user at `C:\Users\rdumawat\AppData\Local\Programs\Git`
  (note: **not** the usual `C:\Program Files\Git`). On PATH in PowerShell as
  `...\Programs\Git\cmd\git.exe`.
- **GitHub CLI (`gh`) is not installed.** Do not reach for `gh` commands — use the GitHub web UI
  or plain `git` instead.
- **Credentials:** Git Credential Manager is the system credential helper and already holds
  working credentials for this repo, so fetch/push do not prompt.

## Repository

- Remote `origin` is `https://github.com/rdumawat/hackathon.git`. It is **public**, so that
  GitHub Pages is free — treat everything committed here as published.
- Published at `https://rdumawat.github.io/hackathon/` (Pages: branch `main`, folder `/ (root)`).
  The app itself lives at `/pre-hackathon/`; the repo-root `index.html` redirects there so the
  URL stays short enough to type on a tablet.
- Default branch is `main`, tracking `origin/main`. Plain `git push`.
- Commit identity is set **repo-locally**, not globally. There is no global `.gitconfig` on this
  machine — a newly cloned repo elsewhere will have no identity and will refuse to commit until
  one is set.

## Gotchas

- **Repo location is `C:\dev\hackathon`** — keep it on a local, non-synced path. Cloud-sync folders
  can lock `.git` internals mid-operation and leave conflict-copy duplicates.
- **No Node, npm, Python, or PHP on this machine.** `python` resolves to the Windows Store stub,
  which only prints an install message — it is not an interpreter. Do not reach for `npx serve` or
  `python -m http.server`; use `serve.ps1`. This is also why the app has zero dependencies.
- **The service worker will not register over `file://`.** Opening `index.html` by double-click
  works for gameplay but silently skips offline/install behavior — serve over http to test that.
- **`sw.js` is network-first, and must stay that way.** It was cache-first, which froze every
  installed device on whatever it downloaded first: a pushed fix could not reach the child's iPad
  without clearing website data by hand, and the app kept happily serving a stale build even while
  GitHub Pages was unpublished. Network-first with a 3s timeout and a cache fallback keeps it
  current and still fully offline. A device that installed a **cache-first** build (`v4` or older)
  is stuck until its site data is cleared once — the fix cannot reach it, by definition.
- **Audio needs a user gesture first.** Browsers block speech and Web Audio until a tap, which is
  what the opening ▶️ button is for. Do not remove it.
- **Icons are generated from `icon.svg`.** `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
  (full-bleed, art inside the centre safe zone) and `apple-touch-icon.png` (180px, square, opaque —
  iOS ignores transparency and applies its own rounding) are committed alongside it. There is no
  ImageMagick, Node, or Python here to regenerate them: rasterize through a browser canvas instead.
  Any new icon must be added to both `manifest.webmanifest` and the `ASSETS` list in `sw.js`.
- **Chrome profile paths must be short when testing the service worker.** A `--user-data-dir` deep
  under `AppData\Local\Temp` pushes Chrome's `CacheStorage` subdirectories past the Windows 260-char
  limit, and the Cache API then fails every `put` with `InvalidAccessError: Entry already exists` —
  which looks exactly like an app bug. Use something like `C:\swprof`.
- **`--dump-dom` and `--screenshot` no longer work in Chrome 151 headless** (they moved to
  `chrome-headless-shell`, which is not installed). To inspect a headless page, launch with
  `--remote-debugging-port` and drive `Runtime.evaluate` over the DevTools WebSocket.
