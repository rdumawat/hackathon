# Pre-Hackathon

Preparation work for the hackathon project.

## What we're building

A child-friendly addition and subtraction app for a four-year-old. Tapping ▶️ starts a round of
**ten questions**, each one either an **Add** or a **Take Away**, using colorful objects the child
can count and touch, with every question spoken aloud. Answering quickly earns more stars, so a
round has a score to beat next time.

## Problem

Early-math apps aimed at preschoolers usually assume a reader. They lean on written prompts, menus,
and number words, which a four-year-old cannot navigate alone. Most also require an account or a
network connection, interrupt play with advertisements, and collect data about the child. And many
allow subtraction problems that go negative — a concept a four-year-old has no way to make sense of.

## Approach

Every problem stays concrete: quantities are shown as objects the child counts, not as symbols to
decode.

- **One button to start.** No menus to choose between — ▶️ begins a round of ten questions, and
  the round ends on a score screen with ▶️ to play again.
- **Stars for speed.** A correct answer is worth 5 stars under five seconds, 3 stars under ten,
  and 1 star after that — so a round is worth up to 50. The clock only starts once the question
  has finished being read aloud, so listening never costs anything.
- **Whole, non-negative numbers only.** Numbers run 0 to 10 to start.
- **No negative results, ever.** Subtraction problems are generated so the answer is always zero or
  greater — the app never poses a question whose answer it cannot show as objects on the screen.
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
- **Local save.** Progress (a star count) is kept in `localStorage`. No accounts, no data leaves
  the device.
- **Touch-first.** Large tap targets, no gestures beyond a single tap, zoom disabled.

Files: `index.html`, `styles.css`, `app.js` (questions, round flow, scoring), `audio.js` (speech + effects),
`sw.js`, `manifest.webmanifest`, `icon.svg`. `serve.ps1` is a tiny local server for testing.

## Scope

**In scope**

- A ten-question round mixing Add and Take Away, scored on answer speed.
- Whole non-negative numbers, range 0–10.
- Subtraction limited to problems with a result of zero or greater.
- Spoken instructions, gentle sound effects, positive feedback.
- Large touch targets and countable, colorful on-screen objects.
- Progress saved locally on the device.

**Explicitly out of scope**

- Reading requirements of any kind.
- Accounts, sign-in, or user profiles.
- Internet access or any runtime network dependency.
- Advertisements.
- Collection of personal data.
- Multiplication, division, negative numbers, and numbers beyond 10.

## Getting started

The app is plain static files — no install or build.

**Quickest look (single player, no offline install):** double-click `index.html` to open it in a
browser. The full round, audio, and local save work this way. (The service worker that
enables offline install only activates when served over http, below.)

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

Part of [rdumawat/hackathon](https://github.com/rdumawat/hackathon) (private).
See [`../CLAUDE.md`](../CLAUDE.md) for environment and tooling notes.
