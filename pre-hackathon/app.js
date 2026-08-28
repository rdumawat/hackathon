// app.js — Count & Play. One round is ten spoken questions, mixing Add and Take Away.
// Level one shows quantities as objects to count (0..10); scoring 40 in a round opens
// level two, a two-digit number against a one-digit one, written as numerals. Neither
// level can produce a negative answer. A question is worth 5 stars answered right first
// time, 3 on the second try, 0 after that. Nothing is timed and nothing is stored.

(function () {
  'use strict';

  var MAX = 10;             // level one: everything is countable, so 0..10
  var BIG_MAX = 99;         // level two: two digits against one
  var HUNDREDS_MIN = 101;   // level three: over a hundred, under two hundred
  var HUNDREDS_MAX = 199;
  var ROUND = 10;           // questions per round
  var PROMOTE = 40;         // round score that moves the child up a level

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

  // ---- progress -----------------------------------------------------------
  // The badge shows the round in progress and starts at zero every round — including
  // the first level-two round. So it reads as "how close am I to the 40 that opens the
  // next level", rather than a number that only ever climbs and stops meaning anything.
  // Fall short of PROMOTE and the next attempt starts from zero again.
  var roundStars = 0;

  // The level is the one thing worth remembering. Clearing level one is an achievement
  // and should survive a reload — a child who earned it should not have to earn it again
  // because the tablet went to sleep. It is a single number and nothing about the child.
  var LEVEL_KEY = 'countplay.level';
  function loadLevel() {
    try {
      var n = parseInt(localStorage.getItem(LEVEL_KEY), 10);
      if (!(n >= 1)) return 1;              // missing or unreadable
      // A number above the ladder means the child cleared a level that has since been
      // withdrawn. Play the top of the current ladder rather than sending them back to
      // the start — but deliberately do NOT write the smaller number back: if that level
      // returns, they should have it again without re-earning something they already did.
      return Math.min(n, TOP_LEVEL);
    } catch (e) { return 1; }
  }
  function saveLevel(n) { try { localStorage.setItem(LEVEL_KEY, String(n)); } catch (e) {} }
  // Older builds kept a lifetime star total. Nothing reads it now, so clear it rather
  // than leave a dead key sitting on every device that ever ran one of those builds.
  try { localStorage.removeItem('countplay.stars'); } catch (e) {}

  function awardStars(n) {
    if (n <= 0) return;
    roundStars += n; SFX.star();
    var badge = document.querySelector('.star-count');
    if (badge) { badge.textContent = roundStars; badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
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
      '<div class="level-badge" aria-label="Level ' + level + '">' + level + '</div>' +
      '<div class="stars"><span class="star-ico">⭐</span><span class="star-count">' + roundStars + '</span></div>' +
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

  // Two wrong answers near the correct one, all within 0..ceiling.
  function distractors(correct, howMany, ceiling) {
    var seen = {}; seen[correct] = true; var pool = [];
    for (var d = 1; d <= ceiling && pool.length < howMany + 2; d++) {
      [correct - d, correct + d].forEach(function (x) {
        if (x >= 0 && x <= ceiling && !seen[x]) { seen[x] = true; pool.push(x); }
      });
    }
    return shuffle(pool).slice(0, howMany);
  }

  function choicesHTML(correct, ceiling) {
    var opts = shuffle([correct].concat(distractors(correct, 2, ceiling)));
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

  // ---- level two: a two-digit number against a one-digit number -----------
  // Both sides are written as numerals. Nobody can count eighty-seven of anything, so
  // level two is where numbers stop being piles to count and become symbols to read —
  // the skill level one's countable groups were building towards. The shape stays the
  // same as level one: value, operator, value. Answers stay inside two digits, and
  // subtraction cannot go negative because a two-digit number always exceeds a
  // one-digit one.
  function makeAddBig() {
    var b = randInt(1, 9);
    var a = randInt(10, BIG_MAX - b);        // keep the total inside two digits
    return { type: 'add', theme: pick(THEMES), a: a, b: b, answer: a + b };
  }

  function makeTakeAwayBig() {
    var n = randInt(10, BIG_MAX);
    var m = randInt(1, 9);
    return { type: 'take', theme: pick(THEMES), n: n, m: m, answer: n - m };
  }

  // ---- level three: over a hundred, against a single digit ----------------
  // Answers stay two or three digits and under two hundred. Addition has to be capped
  // to hold that; subtraction gets it for free, since a number past a hundred minus a
  // single digit cannot fall below 92.
  function makeAddHundreds() {
    var b = randInt(1, 9);
    var a = randInt(HUNDREDS_MIN, HUNDREDS_MAX - b);   // keep the total under two hundred
    return { type: 'add', theme: pick(THEMES), a: a, b: b, answer: a + b };
  }

  function makeTakeAwayHundreds() {
    var n = randInt(HUNDREDS_MIN, HUNDREDS_MAX);
    var m = randInt(1, 9);
    return { type: 'take', theme: pick(THEMES), n: n, m: m, answer: n - m };
  }

  // Written as numerals, both sides. Shared by every level past the first.
  function bigBody(q) {
    var lead  = q.type === 'add' ? q.a : q.n;
    var small = q.type === 'add' ? q.b : q.m;
    return '<div class="groups">' +
      '<div class="group big-num">' + lead + '</div>' +
      '<div class="op">' + (q.type === 'add' ? '➕' : '➖') + '</div>' +
      '<div class="group big-num">' + small + '</div>' +
    '</div>';
  }

  // The ladder. `ceiling` bounds the wrong answers as well as the right one, and
  // `numerals` says whether quantities are drawn as countable objects or written out.
  // Adding a level four means adding a row here and nothing else.
  var LEVELS = [
    null,                                                                        // no level zero
    { ceiling: MAX,          add: makeAdd,          take: makeTakeAway,          numerals: false },
    { ceiling: BIG_MAX,      add: makeAddBig,       take: makeTakeAwayBig,       numerals: true  },
    { ceiling: HUNDREDS_MAX, add: makeAddHundreds,  take: makeTakeAwayHundreds,  numerals: true  }
  ];
  var TOP_LEVEL = LEVELS.length - 1;

  function promptFor(q) {
    return q.type === 'add'
      ? q.a + ' and ' + q.b + ' more. How many all together?'
      : 'You have ' + q.n + '. Take away ' + q.m + '. How many are left?';
  }

  // ===========================================================================
  //  SCREENS
  // ===========================================================================
  var roundIndex = 0;   // questions finished so far this round
  var gen = 0;          // guards callbacks belonging to a question we have left
  var level = loadLevel();   // 2 once a round has scored PROMOTE, and it stays there

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
    var cfg = LEVELS[level];
    var q = randInt(0, 1) ? cfg.add() : cfg.take();
    var attempts = 0;     // taps so far; the first correct one is scored by this

    root.innerHTML =
      topbar(roundIndex) +
      '<div class="screen play problem">' +
        (cfg.numerals ? bigBody(q) : (q.type === 'add' ? addBody(q) : takeBody(q))) +
        choicesHTML(q.answer, cfg.ceiling) +
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
    // Scoring PROMOTE moves the child up a rung, and they stay there — across reloads
    // too. At the top of the ladder there is nowhere further to go, so the same score
    // earns the trophy instead: they have done the whole game.
    var promoted = (level < TOP_LEVEL && roundStars >= PROMOTE);
    if (promoted) { level += 1; saveLevel(level); }
    var mastered = (!promoted && level === TOP_LEVEL && roundStars >= PROMOTE);

    root.innerHTML =
      topbar(ROUND) +
      '<div class="screen results">' +
        '<div class="score"><span class="score-ico">⭐</span><span class="score-num">' + roundStars + '</span></div>' +
        '<div class="score-of">' +
          '<span class="of-num">' + roundStars + '</span>' +
          '<span class="of-sep">/</span>' +
          '<span class="of-max">' + best + '</span>' +
        '</div>' +
        // A four-year-old cannot read "You did it all", so the screen says it with a
        // trophy and the voice says it out loud.
        (promoted  ? '<div class="promoted"><span class="promo-ico">🎉</span><span class="promo-num">' + level + '</span></div>' :
         mastered  ? '<div class="mastered"><span class="promo-ico">🏆</span></div>' : '') +
        '<button class="big-start" data-action="again">▶️</button>' +
      '</div>';
    confetti();
    speak(promoted ? 'You got ' + roundStars + ' stars! You unlocked level ' + level + '. Bigger numbers!'
        : mastered ? 'You got ' + roundStars + ' stars! You did it all!'
                   : 'You got ' + roundStars + ' stars, out of ' + best + '!');
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
