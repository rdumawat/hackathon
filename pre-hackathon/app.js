// app.js — Count & Play. One round is ten spoken questions, mixing Add and Take Away.
// No reading required: every question is spoken and the quantities are shown as objects
// to count. Numbers stay whole and 0..10, and subtraction never goes below zero.
// The faster a question is answered correctly, the more stars it earns.

(function () {
  'use strict';

  var MAX = 10;    // number range: 0..10
  var ROUND = 10;  // questions per round

  var root = document.getElementById('app');
  var confettiLayer = document.getElementById('confetti');

  var THEMES = [
    { name: 'apples',   emoji: '🍎' },
    { name: 'ducks',    emoji: '🐤' },
    { name: 'stars',    emoji: '⭐' },
    { name: 'balloons', emoji: '🎈' },
    { name: 'fish',     emoji: '🐠' },
    { name: 'flowers',  emoji: '🌼' },
    { name: 'frogs',    emoji: '🐸' },
    { name: 'cars',     emoji: '🚗' }
  ];
  var PRAISE = ['Yes!','Great job!','You did it!','Awesome!','Well done!','Hooray!','Perfect!'];
  var RETRY  = ['Try again!','Almost! Try again.','Give it another go!','So close! Try again.'];

  // Stars come from how many tries a question took, not from how fast it was answered.
  // Timing punished a child for counting carefully, which is the thing the game is for.
  // Index is the attempt number, so first try is 5, second is 3, and anything after is 0.
  var STARS_BY_ATTEMPT = [5, 3];
  var BEST_PER_QUESTION = STARS_BY_ATTEMPT[0];

  function starsForAttempt(attempt) {
    return attempt <= STARS_BY_ATTEMPT.length ? STARS_BY_ATTEMPT[attempt - 1] : 0;
  }

  // ---- small helpers ------------------------------------------------------
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = randInt(0, i); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  // Pending work belongs to the screen that started it, so every render cancels the
  // previous screen's timers. Without this they fire over whatever came next.
  var timers = [];
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---- progress (this visit only, nothing stored) -------------------------
  // The badge is a tally for the session, not a lifetime score: it starts at zero on
  // every load. A number that only ever climbs stops meaning anything to a child.
  var stars = 0;

  function awardStars(n) {
    if (n <= 0) return;
    stars += n; SFX.star();
    var badge = document.querySelector('.star-count');
    if (badge) { badge.textContent = stars; badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
  }

  // ---- shared UI pieces ---------------------------------------------------
  // Position in the round is shown as pips, not "3 of 10" — nothing here is read.
  function topbar(done) {
    var pips = '<div class="pips">';
    for (var i = 0; i < ROUND; i++) {
      pips += '<i class="pip' + (i < done ? ' filled' : (i === done ? ' now' : '')) + '"></i>';
    }
    pips += '</div>';
    return '<div class="topbar">' + pips +
      '<div class="stars"><span class="star-ico">⭐</span><span class="star-count">' + stars + '</span></div>' +
    '</div>';
  }

  // Up to four sit in one row; beyond that a group splits into two balanced rows
  // (7 becomes 4+3, 10 becomes 5+5). Fixing the column count is what stops a group
  // free-wrapping into something a child could read as two separate groups, and
  // balancing the rows keeps a single object from being orphaned under a long one.
  function cols(count) {
    count = Math.max(1, count);
    return count <= 4 ? count : Math.ceil(count / 2);
  }

  // Size by how many objects sit on the WIDEST ROW, not by the total: a take-away of
  // ten is only five across (two rows) and can be drawn large, while 5 + 5 really is
  // ten across and has to shrink or it overflows the card.
  function objectSize(widestRow) {
    if (widestRow <= 4) return 'min(15vw, 96px)';
    if (widestRow <= 6) return 'min(11vw, 76px)';
    if (widestRow <= 8) return 'min(8.5vw, 62px)';
    return 'min(6.5vw, 48px)';
  }

  function objectsHTML(count, emoji, extraClass) {
    var s = '<div class="objects ' + (extraClass || '') + '" style="--cols:' + cols(count) + '">';
    for (var i = 0; i < count; i++) s += '<span class="obj">' + emoji + '</span>';
    return s + '</div>';
  }

  // Two wrong answers near the correct one, all within 0..MAX.
  function distractors(correct, howMany) {
    var seen = {}; seen[correct] = true; var pool = [];
    for (var d = 1; d <= MAX && pool.length < howMany + 2; d++) {
      [correct - d, correct + d].forEach(function (x) {
        if (x >= 0 && x <= MAX && !seen[x]) { seen[x] = true; pool.push(x); }
      });
    }
    return shuffle(pool).slice(0, howMany);
  }

  function choicesHTML(correct) {
    var opts = shuffle([correct].concat(distractors(correct, 2)));
    var s = '<div class="choices">';
    opts.forEach(function (v) {
      s += '<button class="choice" data-val="' + v + '"><span class="numeral">' + v + '</span></button>';
    });
    return s + '</div>';
  }

  function nextButton() {
    return '<button class="next-btn" data-action="next" aria-label="Next">➡️</button>';
  }

  // What this question was worth, drawn as the stars themselves.
  function earnedHTML(n) {
    if (n <= 0) return '<div class="earned none"><span>🙂</span></div>';
    var s = '<div class="earned">';
    for (var i = 0; i < n; i++) s += '<span>⭐</span>';
    return s + '</div>';
  }

  // ---- celebration --------------------------------------------------------
  function confetti() {
    var pieces = ['⭐', '🎉', '✨', '🌈', '🎈'];
    for (var i = 0; i < 22; i++) {
      var span = document.createElement('span');
      span.className = 'confetti';
      span.textContent = pick(pieces);
      span.style.left = randInt(2, 96) + 'vw';
      span.style.animationDuration = (900 + randInt(0, 900)) + 'ms';
      span.style.animationDelay = randInt(0, 250) + 'ms';
      span.style.fontSize = randInt(20, 40) + 'px';
      confettiLayer.appendChild(span);
      (function (node) { later(function () { node.remove(); }, 2200); })(span);
    }
  }

  // ===========================================================================
  //  QUESTIONS
  // ===========================================================================

  // Both addends are at least one, so the child always has two real groups to join.
  function makeAdd() {
    var a = randInt(1, MAX - 1);
    var b = randInt(1, MAX - a);          // keep the total within 0..MAX
    return { type: 'add', theme: pick(THEMES), a: a, b: b, answer: a + b };
  }

  // Never take away more than there are, so the answer is never negative. At least one is
  // taken: "take away 0" is a non-question, and it would leave an empty group beside the
  // minus sign the way an addend of 0 would beside the plus.
  function makeTakeAway() {
    var n = randInt(1, MAX);
    var m = randInt(1, n);
    return { type: 'take', theme: pick(THEMES), n: n, m: m, answer: n - m };
  }

  function addBody(q) {
    return '<div class="groups" style="--obj:' + objectSize(cols(q.a) + cols(q.b)) + '">' +
      '<div class="group">' + objectsHTML(q.a, q.theme.emoji) + '</div>' +
      '<div class="op">➕</div>' +
      '<div class="group">' + objectsHTML(q.b, q.theme.emoji) + '</div>' +
    '</div>';
  }

  // Laid out like addition — two groups either side of the operator — so the two kinds of
  // question read the same way. Left is everything you start with, right is how many go.
  //
  // Nothing fades. The left group used to dim the departing objects, which acted the
  // subtraction out but also left exactly `answer` objects still solid on screen: the
  // child could count those instead of working it out, the same way the dots under the
  // answer buttons let them skip the arithmetic. Do not reintroduce it.
  function takeBody(q) {
    return '<div class="groups" style="--obj:' + objectSize(cols(q.n) + cols(q.m)) + '">' +
      '<div class="group">' + objectsHTML(q.n, q.theme.emoji) + '</div>' +
      '<div class="op">➖</div>' +
      '<div class="group">' + objectsHTML(q.m, q.theme.emoji) + '</div>' +
    '</div>';
  }

  function promptFor(q) {
    return q.type === 'add'
      ? q.a + ' and ' + q.b + ' more. How many all together?'
      : 'You have ' + q.n + '. Take away ' + q.m + '. How many are left?';
  }

  // ===========================================================================
  //  SCREENS
  // ===========================================================================
  var roundIndex = 0;   // questions finished so far this round
  var roundStars = 0;   // stars earned this round
  var gen = 0;          // guards callbacks belonging to a question we have left

  function renderStart() {
    clearTimers(); gen++;
    root.innerHTML =
      '<div class="screen start">' +
        '<div class="logo">🔢</div>' +
        '<button class="big-start" data-action="begin">▶️</button>' +
      '</div>';
    root.querySelector('.big-start').addEventListener('click', function () {
      SFX.unlock();
      startRound();
    });
  }

  function startRound() { roundIndex = 0; roundStars = 0; renderQuestion(); }

  function renderQuestion() {
    clearTimers();
    var me = ++gen;
    var q = randInt(0, 1) ? makeAdd() : makeTakeAway();
    var attempts = 0;     // taps so far; the first correct one is scored by this

    root.innerHTML =
      topbar(roundIndex) +
      '<div class="screen play problem">' +
        (q.type === 'add' ? addBody(q) : takeBody(q)) +
        choicesHTML(q.answer) +
      '</div>';

    speak(promptFor(q));

    var buttons = root.querySelectorAll('.choice');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('done') || btn.disabled) return;
        attempts += 1;

        if (parseInt(btn.getAttribute('data-val'), 10) !== q.answer) {
          // Retire the wrong choice so a double tap cannot burn a second attempt, and
          // so the remaining buttons are always ones worth trying.
          btn.classList.add('wrong'); btn.disabled = true;
          SFX.tryAgain(); speak(pick(RETRY));
          return;
        }

        var earned = starsForAttempt(attempts);
        roundStars += earned;
        Array.prototype.forEach.call(buttons, function (b) { b.classList.add('done'); b.disabled = true; });
        btn.classList.add('correct');
        SFX.success(); speak(pick(PRAISE)); confetti(); awardStars(earned);

        var scr = root.querySelector('.play');
        if (scr) { scr.appendChild(el(earnedHTML(earned))); scr.appendChild(el(nextButton())); }
        var nb = root.querySelector('.next-btn');
        if (nb) nb.addEventListener('click', function () {
          SFX.pop();
          roundIndex += 1;
          if (roundIndex >= ROUND) renderResults(); else renderQuestion();
        });
      });
    });
  }

  function renderResults() {
    clearTimers(); gen++;
    var best = ROUND * BEST_PER_QUESTION;   // the most a perfect round can be worth
    root.innerHTML =
      topbar(ROUND) +
      '<div class="screen results">' +
        '<div class="score"><span class="score-ico">⭐</span><span class="score-num">' + roundStars + '</span></div>' +
        '<div class="score-of">' +
          '<span class="of-num">' + roundStars + '</span>' +
          '<span class="of-sep">/</span>' +
          '<span class="of-max">' + best + '</span>' +
        '</div>' +
        '<button class="big-start" data-action="again">▶️</button>' +
      '</div>';
    confetti();
    speak('You got ' + roundStars + ' stars, out of ' + best + '!');
    root.querySelector('.big-start').addEventListener('click', function () { SFX.pop(); startRound(); });
  }

  // ---- boot + PWA registration -------------------------------------------
  renderStart();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* cache serves it offline next time */ });
    });
  }
})();
