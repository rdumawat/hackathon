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

  // Speed bands. Seven seconds is roughly how long it takes a four-year-old to count
  // ten objects, so the top band is reachable by counting rather than only by guessing.
  // A correct answer is always worth at least one star; zero is reserved for a question
  // the child first answered wrongly.
  var BANDS = [
    { under: 7000,  stars: 5 },
    { under: 10000, stars: 3 }
  ];
  var SLOW_STARS = 1;

  function starsFor(ms) {
    for (var i = 0; i < BANDS.length; i++) { if (ms < BANDS[i].under) return BANDS[i].stars; }
    return SLOW_STARS;
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

  // ---- progress (local only, no personal data) ----------------------------
  var STARS_KEY = 'countplay.stars';
  function loadStars() { try { return parseInt(localStorage.getItem(STARS_KEY), 10) || 0; } catch (e) { return 0; } }
  function saveStars(n) { try { localStorage.setItem(STARS_KEY, String(n)); } catch (e) {} }
  var stars = loadStars();

  function awardStars(n) {
    if (n <= 0) return;
    stars += n; saveStars(stars); SFX.star();
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

  // Never take away more than there are, so the answer is never negative.
  function makeTakeAway() {
    var n = randInt(1, MAX);
    var m = randInt(0, n);
    return { type: 'take', theme: pick(THEMES), n: n, m: m, answer: n - m };
  }

  function addBody(q) {
    return '<div class="groups" style="--obj:' + objectSize(cols(q.a) + cols(q.b)) + '">' +
      '<div class="group">' + objectsHTML(q.a, q.theme.emoji) + '</div>' +
      '<div class="op">➕</div>' +
      '<div class="group">' + objectsHTML(q.b, q.theme.emoji) + '</div>' +
    '</div>';
  }

  function takeBody(q) {
    var s = '<div class="objects" style="--cols:' + cols(q.n) + '">';
    for (var i = 0; i < q.n; i++) s += '<span class="obj' + (i >= q.n - q.m ? ' leaving' : '') + '">' + q.theme.emoji + '</span>';
    s += '</div>';
    return '<div class="groups single" style="--obj:' + objectSize(cols(q.n)) + '">' +
      '<div class="group">' + s + '</div></div>';
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
    var clockAt = null;   // starts when the spoken question finishes
    var missed = false;   // a wrong tap zeroes this question

    root.innerHTML =
      topbar(roundIndex) +
      '<div class="screen play problem">' +
        (q.type === 'add' ? addBody(q) : takeBody(q)) +
        choicesHTML(q.answer) +
      '</div>';

    // The clock starts once the question has been read out, so listening to it never
    // costs the child stars. audio.js calls back even when speech is unavailable.
    speak(promptFor(q), null, function () {
      if (me !== gen) return;
      if (clockAt === null) clockAt = Date.now();

      // Take the objects away only once the child has heard what is being taken.
      // Fading them while the sentence is still playing acts out the answer before
      // the question has finished being asked.
      if (q.type === 'take') {
        later(function () {
          Array.prototype.forEach.call(root.querySelectorAll('.obj.leaving'), function (o) { o.classList.add('gone'); });
        }, 350);
      }
    });

    var buttons = root.querySelectorAll('.choice');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('done')) return;
        // Answering before the question finished is its own kind of fast.
        if (clockAt === null) clockAt = Date.now();

        if (parseInt(btn.getAttribute('data-val'), 10) !== q.answer) {
          missed = true;
          btn.classList.remove('wrong'); void btn.offsetWidth; btn.classList.add('wrong');
          SFX.tryAgain(); speak(pick(RETRY));
          return;
        }

        var earned = missed ? 0 : starsFor(Date.now() - clockAt);
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
    var best = ROUND * BANDS[0].stars;   // the most a perfect round can be worth
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
