# Pre-Hackathon

Preparation work for the hackathon project.

## What we're building

A child-friendly addition and subtraction app for a four-year-old. Tapping ▶️ starts a round of
**ten questions**, each one either an **Add** or a **Take Away**, with every question spoken
aloud. Getting a question right first time earns the most stars, so a round has a score to beat
next time — and a good enough score opens up a harder level.

## Problem

Early-math apps aimed at preschoolers usually assume a reader. They lean on written prompts, menus,
and number words, which a four-year-old cannot navigate alone. Most also require an account or a
network connection, interrupt play with advertisements, and collect data about the child. And many
allow subtraction problems that go negative — a concept a four-year-old has no way to make sense of.

## Approach

Counting comes first. At level one every quantity is a group of objects on screen, not a symbol to
decode; numerals only take over at level two, once the child has earned their way there.

- **One button to start.** No menus to choose between — ▶️ begins a round of ten questions, and
  the round ends on a score screen with ▶️ to play again.
- **Stars for getting it right, not for being quick.** 5 stars answered right first time, 3 on
  the second try, 0 after that — so a round is worth up to 50. Nothing is timed: a clock would
  punish the careful counting the game is trying to teach.
- **Two levels.** Level one is 0–10 with everything drawn as objects to count. Scoring 40 or more
  in a round unlocks **level two**, where a two-digit number meets a one-digit one, written as
  numerals — the point at which numbers stop being piles to count and become symbols to read.
- **Quantities are grouped, never scattered.** Up to four objects sit in a row; larger groups
  split into two balanced rows, so each side of a sum reads as one block.
- **Whole, non-negative numbers only.** Level one runs 0 to 10; level two goes to 99. Neither can produce a negative answer.
- **No negative results, ever.** Subtraction problems are generated so the answer is always zero or
  greater. A four-year-old has no way to make sense of a negative result.
- **Nothing to read.** Instructions are spoken; the interface is pictures, objects, and numerals.
- **Built for small hands.** Large touch targets, forgiving hit areas, no gestures beyond a tap.
- **Encouraging, not punishing.** Gentle sound effects and positive feedback for every attempt; a
  wrong answer invites another try rather than marking a failure.

## Stack

A **zero-dependency installable PWA** — plain HTML, CSS, and JavaScript, no build step and no
`node_modules`. This keeps the whole thing offline by construction and trivial to run on any
tablet:

- **No external assets, no network calls.** Spoken instructions use the browser's Web Speech API
  and sound effects are synthesized with the Web Audio API, so there are no audio files to load.
  Countable objects are emoji. Nothing is fetched at runtime.
- **Offline install.** A service worker (`sw.js`) caches the app shell; a web manifest
  (`manifest.webmanifest`) makes it installable to a tablet home screen.
- **Nothing stored.** The star tally is for the current visit and resets on reload. No accounts,
  no storage, no data leaves the device.
- **Touch-first.** Large tap targets, no gestures beyond a single tap, zoom disabled.

Files: `index.html`, `styles.css`, `app.js` (questions, round flow, scoring), `audio.js` (speech + effects),
`sw.js`, `manifest.webmanifest`, `icon.svg`. `serve.ps1` is a tiny local server for testing.

## Scope

**In scope**

- A ten-question round mixing Add and Take Away, scored on how many tries each takes.
- Whole non-negative numbers: 0–10 at level one, up to 99 at level two.
- Subtraction limited to problems with a result of zero or greater.
- Spoken instructions, gentle sound effects, positive feedback.
- Large touch targets and countable, colorful on-screen objects.
- A star tally for the current visit, and a second level unlocked by scoring 40 or more.

**Explicitly out of scope**

- Any requirement to read words. Numerals are a different matter: level one shows them beside
  countable groups, and level two depends on recognising them — that is the skill it teaches.
- Accounts, sign-in, or user profiles.
- Internet access or any runtime network dependency.
- Advertisements.
- Collection of personal data.
- Multiplication, division, negative numbers, and numbers beyond 99.

## Getting started

The app is plain static files — no install or build.

**Quickest look (no offline install):** double-click `index.html` to open it in a browser. The
full round and the audio work this way. (The service worker that enables offline install only
activates when served over http, below.)

**Full PWA (offline + installable), no Node/Python required:**

```powershell
# from the pre-hackathon folder
powershell -ExecutionPolicy Bypass -File .\serve.ps1
# then open http://localhost:8000/index.html
```

On a tablet, browse to that URL over the same network (swap `localhost` for the machine's IP) and
use the browser's **Add to Home Screen** to install it. Once installed it runs fully offline.

**First tap:** the opening ▶️ button exists to unlock audio (mobile browsers require a tap before
they will play sound or speak). Everything after that is driven by spoken prompts and pictures.

## Repository

Part of [rdumawat/hackathon](https://github.com/rdumawat/hackathon), published at
[rdumawat.github.io/hackathon](https://rdumawat.github.io/hackathon/).
See [`../CLAUDE.md`](../CLAUDE.md) for environment and tooling notes.
