// audio.js — spoken instructions (Web Speech) and gentle sound effects (Web Audio).
// Everything is synthesized in the browser: no audio files, no network, works offline.

// ---- Sound effects -------------------------------------------------------
window.SFX = (function () {
  var ac = null;

  function ctx() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ac && ac.state === 'suspended') { ac.resume(); }
    return ac;
  }

  // A single soft tone with a quick fade-in/out so nothing sounds harsh.
  function tone(freq, start, dur, type, peak) {
    var c = ctx(); if (!c) return;
    var t0 = c.currentTime + (start || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak || 0.14, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  return {
    unlock: function () { ctx(); },
    pop: function () { tone(520, 0, 0.10, 'triangle', 0.12); },
    // Counting tick that rises in pitch as the number grows.
    count: function (n) {
      var k = Math.max(1, Math.min(n, 10));
      tone(440 * Math.pow(2, (k - 1) / 12), 0, 0.13, 'sine', 0.14);
    },
    // Happy little arpeggio for a correct answer.
    success: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone(f, i * 0.12, 0.22, 'sine', 0.16);
      });
    },
    // Soft, non-negative two-note nudge for "try again" — never a buzzer.
    tryAgain: function () {
      tone(392, 0, 0.16, 'sine', 0.12);
      tone(330, 0.14, 0.22, 'sine', 0.12);
    },
    star: function () {
      tone(880, 0, 0.14, 'triangle', 0.14);
      tone(1174, 0.10, 0.18, 'triangle', 0.12);
    }
  };
})();

// ---- Spoken instructions -------------------------------------------------
window.speak = (function () {
  var voices = [];
  function load() {
    voices = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
  }
  if ('speechSynthesis' in window) {
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }
  // Whatever voice the device is set to use wins. That is the whole point: install a
  // better voice in system settings — on iOS, Settings > Accessibility > Spoken Content
  // > Voices, where the Enhanced and Premium downloads sound far more human — and the
  // app picks it up with no code change. The name list below is only a fallback for
  // when nothing is flagged as the default.
  //
  // Network-backed voices are skipped whenever a local one exists. Chrome's "Google"
  // voices report localService false and need the internet to speak, which would break
  // the offline promise the rest of the app is built around.
  function pick() {
    if (!voices.length) load();

    var pool = voices.filter(function (x) { return x.lang && /^en[-_]/i.test(x.lang); });
    if (!pool.length) pool = voices;
    var local = pool.filter(function (x) { return x.localService !== false; });
    if (local.length) pool = local;
    if (!pool.length) return null;

    var chosen = pool.filter(function (x) { return x.default; })[0];
    if (chosen) return chosen;

    var prefs = ['samantha', 'ava', 'allison', 'susan', 'karen', 'moira', 'zira', 'aria', 'female'];
    for (var i = 0; i < prefs.length; i++) {
      var v = pool.filter(function (x) {
        return x.name && x.name.toLowerCase().indexOf(prefs[i]) !== -1;
      })[0];
      if (v) return v;
    }
    return pool[0];
  }
  // onDone fires when the sentence has been read out — or, if speech is missing,
  // muted, or the browser simply never reports the end, after a length-based
  // estimate. Callers time the child from it, so it must always fire exactly once.
  return function (text, opts, onDone) {
    opts = opts || {};
    var called = false;
    function finish() { if (!called) { called = true; if (onDone) onDone(); } }

    // The estimate is only a floor: real speech at rate 0.92 runs slower than any
    // word count predicts, so once it expires we wait for the engine to actually stop
    // talking. If speech never started (unavailable, muted, no voices) it is not
    // speaking, and the estimate stands. The cap keeps a wedged engine from hanging.
    var words = String(text).split(/\s+/).length;
    var estimate = Math.min(6000, Math.max(900, words * 380));
    var waited = 0;
    var fallback = setTimeout(function poll() {
      var talking = ('speechSynthesis' in window) && window.speechSynthesis.speaking;
      if (talking && waited < 15000) {
        waited += 150;
        fallback = setTimeout(poll, 150);
        return;
      }
      finish();
    }, estimate);

    if (!('speechSynthesis' in window)) return;   // the fallback still calls back
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate != null ? opts.rate : 0.92;   // a touch slow, easy to follow
      u.pitch = opts.pitch != null ? opts.pitch : 1.2; // friendly, bright
      u.volume = 1;
      var v = pick();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
      u.onend = function () { clearTimeout(fallback); finish(); };
      u.onerror = function () { clearTimeout(fallback); finish(); };
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is a nice-to-have; never let it break the game */ }
  };
})();
