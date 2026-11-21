// Solaris Bay — synthesized Web Audio: engines, sirens, gunfire, music.
// No audio files: every sound is built from oscillators and filtered noise.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createSound(G) {
    var ctx = null, master = null, musicGain = null, engineNodes = null;
    var muted = false, musicOn = false, musicTimer = null, sirenNodes = null;
    var step = 0;

    function ensure() {
      // In screenshot mode (?shot=) there is no user gesture: stay silent.
      if (new URLSearchParams(location.search).get('shot')) return false;
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
        musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      } catch (e) { ctx = null; return false; }
      return true;
    }

    function noiseBuffer(dur) {
      var buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    function blip(freq, dur, type, vol, slideTo) {
      if (!ensure() || muted) return;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    }

    function noiseHit(dur, filterFreq, vol, type) {
      if (!ensure() || muted) return;
      var src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
      var f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(); src.stop(ctx.currentTime + dur);
    }

    function engineStart() {
      if (!ensure() || engineNodes) return;
      var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      var g = ctx.createGain(), f = ctx.createBiquadFilter();
      o1.type = 'sawtooth'; o2.type = 'square';
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
      g.gain.value = 0.0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(master);
      o1.start(); o2.start();
      engineNodes = { o1: o1, o2: o2, g: g, f: f };
    }

    function engineUpdate(rpm01, drifting) {
      if (!engineNodes || muted) { if (engineNodes) engineNodes.g.gain.value = 0; return; }
      var t = ctx.currentTime;
      var base = 55 + rpm01 * 165;
      engineNodes.o1.frequency.setTargetAtTime(base, t, 0.05);
      engineNodes.o2.frequency.setTargetAtTime(base * 1.5 + 3, t, 0.05);
      engineNodes.f.frequency.setTargetAtTime(500 + rpm01 * 2200, t, 0.08);
      engineNodes.g.gain.setTargetAtTime(0.05 + rpm01 * 0.09 + (drifting ? 0.03 : 0), t, 0.08);
      if (drifting) noiseHit(0.18, 2600, 0.05, 'bandpass');
    }

    function siren(on) {
      if (on && !sirenNodes && ensure() && !muted) {
        var o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = 750;
        lfo.type = 'square'; lfo.frequency.value = 0.55; lg.gain.value = 280;
        lfo.connect(lg); lg.connect(o.frequency);
        g.gain.value = 0.045;
        o.connect(g); g.connect(master);
        o.start(); lfo.start();
        sirenNodes = { o: o, lfo: lfo, g: g };
      } else if (!on && sirenNodes) {
        try { sirenNodes.o.stop(); sirenNodes.lfo.stop(); } catch (e) {}
        sirenNodes = null;
      }
    }

    // Simple synthwave loop: Am – F – C – G bass + pad stab.
    var CHORDS = [[110, 130.8, 164.8], [87.3, 110, 130.8], [130.8, 164.8, 196], [98, 123.5, 146.8]];
    function musicTick() {
      if (!ctx || !musicOn || muted) return;
      var chord = CHORDS[Math.floor(step / 8) % 4];
      var beat = step % 8;
      if (beat === 0 || beat === 4) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = chord[0] / 2;
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
        o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + 0.95);
      }
      if (beat % 2 === 0) {
        for (var i = 0; i < 3; i++) {
          var p = ctx.createOscillator(), pg = ctx.createGain();
          p.type = 'triangle'; p.frequency.value = chord[i];
          pg.gain.setValueAtTime(0.12, ctx.currentTime);
          pg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          p.connect(pg); pg.connect(musicGain); p.start(); p.stop(ctx.currentTime + 0.55);
        }
      }
      if (beat === 2 || beat === 6) blip(1900, 0.05, 'sine', 0.12);
      step++;
    }

    function setMusic(on) {
      musicOn = on;
      if (on && ensure()) {
        if (!musicTimer) musicTimer = setInterval(musicTick, 250);
      } else if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    }

    return {
      unlock: ensure,
      engineStart: engineStart,
      engineUpdate: engineUpdate,
      siren: siren,
      gunshot: function () { noiseHit(0.16, 1800, 0.5); blip(180, 0.1, 'square', 0.25, 60); },
      enemyShot: function () { noiseHit(0.12, 1400, 0.16); },
      explosion: function () { noiseHit(0.8, 300, 0.7); blip(70, 0.6, 'sine', 0.4, 30); },
      hit: function () { blip(320, 0.07, 'square', 0.15, 180); },
      pickup: function () { blip(660, 0.09, 'sine', 0.2, 990); },
      cash: function () { blip(880, 0.08, 'sine', 0.2); setTimeout(function () { blip(1318, 0.12, 'sine', 0.2); }, 90); },
      uiClick: function () { blip(740, 0.06, 'sine', 0.15); },
      missionOk: function () { [523, 659, 784].forEach(function (f, i) { setTimeout(function () { blip(f, 0.16, 'sine', 0.22); }, i * 110); }); },
      setMusic: setMusic,
      toggleMute: function () { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
      isMuted: function () { return muted; },
    };
  }

  SB.createSound = createSound;
})();
