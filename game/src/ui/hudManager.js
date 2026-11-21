// Solaris Bay — HUD: bars, cash, stars, speed, objective, district banner,
// mission panel, police dispatch panel, weapon slots, dialogue with portrait,
// respect rank bar, vehicle panel, radio line, clock, overlays.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createHud(G) {
    function el(id) { return document.getElementById(id); }
    var els = {
      hud: el('hud'), hpFill: el('hp-fill'), armorFill: el('armor-fill'),
      cash: el('cash'), stars: el('stars'), speed: el('speed'),
      weapon: el('weapon'), ammo: el('ammo'), objective: el('objective'),
      district: el('district'), subtitle: el('subtitle'),
      prompt: el('prompt'), toast: el('toast'),
      startScreen: el('start-screen'), pauseMenu: el('pause-menu'),
      mapOverlay: el('map-overlay'), controlsOverlay: el('controls-overlay'),
      shopOverlay: el('shop-overlay'), gameover: el('gameover'),
      victory: el('victory'), damageFlash: el('damage-flash'),
      continueBtn: el('btn-continue'),
      missionPanel: el('mission-panel'), missionTitle: el('mission-title'),
      missionStages: el('mission-stages'), missionTimer: el('mission-timer'),
      missionNext: el('mission-next'),
      dispatchPanel: el('dispatch-panel'), dispatchRows: el('dispatch-rows'),
      weaponSlots: el('weapon-slots'),
      dialogue: el('dialogue'), portrait: el('portrait'),
      dialogueName: el('dialogue-name'), dialogueText: el('dialogue-text'),
      rankName: el('rank-name'), rankFill: el('rank-fill'), rankRp: el('rank-rp'),
      vehiclePanel: el('vehicle-panel'), vehicleName: el('vehicle-name'),
      vehicleCond: el('vehicle-cond'), vehicleCondText: el('vehicle-cond-text'), vehicleGear: el('vehicle-gear'),
      radioLine: el('radio-line'), clock: el('clock'),
    };

    var sayQueue = [], sayT = 0, toastT = 0, lastDistrict = '', panelT = 0;
    var lastSpeaker = '';

    function show(id, on) { if (els[id]) els[id].style.display = on ? 'flex' : 'none'; }

    function say(lines) {
      sayQueue = sayQueue.concat(lines);
    }

    function clearSay() {
      sayQueue = []; sayT = 0;
      if (els.dialogue) els.dialogue.style.display = 'none';
      if (els.subtitle) els.subtitle.style.display = 'none';
    }

    function toast(msg) {
      els.toast.textContent = msg;
      els.toast.style.opacity = '1';
      toastT = 3.2;
    }

    function flashDamage() {
      els.damageFlash.style.opacity = '0.45';
      setTimeout(function () { els.damageFlash.style.opacity = '0'; }, 120);
    }

    function starsHtml(n) {
      var s = '';
      for (var i = 0; i < 5; i++) s += '<span class="star' + (i < n ? ' on' : '') + '">★</span>';
      return s;
    }

    function districtName() {
      var P = G.player.P;
      return SB.districtAt(P.pos.x, P.pos.z).name;
    }

    function rankOf(rep) {
      var ranks = SB.CONFIG.RANKS, cur = ranks[0], next = ranks[1] || null;
      for (var i = 0; i < ranks.length; i++) {
        if (rep >= ranks[i].min) { cur = ranks[i]; next = ranks[i + 1] || null; }
      }
      return { cur: cur, next: next };
    }

    // ---- dialogue portrait: crude 64px canvas face per speaker --------------
    function drawPortrait(speaker) {
      if (!els.portrait || speaker === lastSpeaker) return;
      lastSpeaker = speaker;
      var cv = els.portrait, ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 64, 64);
      var skin = '#c98e6a', hair = '#2c2c30', shirt = '#3a3a3a';
      if (speaker === 'ELENA') { hair = '#1a1a22'; shirt = '#b8860b'; skin = '#e8b88a'; }
      else if (speaker === 'VICTOR') { hair = '#888888'; shirt = '#2c3e50'; skin = '#d9a06a'; }
      else if (speaker === 'MATEO') { hair = '#1a1a1a'; shirt = '#d21f3c'; skin = '#c98e6a'; }
      // backdrop
      ctx.fillStyle = '#20242c'; ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = 'rgba(255,215,106,0.25)';
      ctx.beginPath(); ctx.arc(32, 30, 26, 0, Math.PI * 2); ctx.fill();
      // shoulders
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.moveTo(8, 64); ctx.quadraticCurveTo(32, 42, 56, 64); ctx.closePath(); ctx.fill();
      // face
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(32, 30, 15, 0, Math.PI * 2); ctx.fill();
      // hair / cap
      if (speaker === 'MATEO') {
        ctx.fillStyle = '#d21f3c';
        ctx.beginPath(); ctx.arc(32, 24, 15, Math.PI, 0); ctx.fill();
        ctx.fillRect(14, 22, 36, 4);
      } else if (speaker === 'VICTOR') {
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.arc(32, 26, 14, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(26, 40, 12, 5); // grey beard
      } else {
        ctx.fillStyle = hair;
        ctx.beginPath(); ctx.arc(32, 26, 15, Math.PI, 0); ctx.fill();
        ctx.fillRect(17, 26, 6, 14); ctx.fillRect(41, 26, 6, 14); // bob sides
      }
      // eyes
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(24, 28, 3, 3); ctx.fillRect(37, 28, 3, 3);
      // mouth
      ctx.fillStyle = '#7a3a3a';
      ctx.fillRect(28, 39, 8, 2);
    }

    function parseSpeaker(line) {
      var m = /^([A-Za-z]+):/.exec(line || '');
      if (!m) return { speaker: 'MATEO', text: line };
      var name = m[1].toUpperCase();
      if (name !== 'ELENA' && name !== 'VICTOR' && name !== 'MATEO') return { speaker: 'MATEO', text: line };
      return { speaker: name, text: line.slice(m[0].length).replace(/^["\s]+|["\s]+$/g, '') };
    }

    // ---- slow panels (4 Hz refresh) ------------------------------------------
    function updatePanels() {
      var M = G.missions.M;
      // mission panel
      if (M.active && !M.done) {
        var def = SB.CONFIG.MISSIONS[M.index];
        els.missionPanel.style.display = 'block';
        els.missionTitle.textContent = 'JOB: ' + def.name + ' — ' + def.giver;
        var total = SB.CONFIG.MISSION_STAGES[M.index] || 1;
        var segs = '';
        for (var s = 0; s < total; s++) segs += '<span class="seg' + (s < M.stage ? ' done' : (s === M.stage ? ' cur' : '')) + '"></span>';
        els.missionStages.innerHTML = segs + '<span class="stage-label">STAGE ' + (M.stage + 1) + '/' + total + '</span>';
        els.missionTimer.textContent = M.timer > 0 ? '⏱ ' + Math.max(0, Math.ceil(M.timer)) + 's' : '';
        els.missionNext.textContent = 'NEXT: ' + (M.objectiveOverride || M.objective);
      } else {
        els.missionPanel.style.display = 'none';
      }
      // dispatch panel: cruisers + heli + roadblocks
      var rows = [];
      G.police.cruisers.forEach(function (c, i) {
        var d = SB.dist2D(G.player.P.pos.x, G.player.P.pos.z, c.car.mesh.position.x, c.car.mesh.position.z);
        rows.push({ name: 'UNIT-' + (12 + i * 7), dist: Math.round(d), state: d < 6 ? 'RAMMING' : 'PURSUIT' });
      });
      if (G.heli) rows = rows.concat(G.heli.getUnits());
      if (rows.length) {
        els.dispatchPanel.style.display = 'block';
        els.dispatchRows.innerHTML = rows.slice(0, 5).map(function (r) {
          return '<div class="dispatch-row"><span class="du-name">' + r.name + '</span><span class="du-state ' + r.state.toLowerCase() + '">' + r.state + '</span><span class="du-dist">' + r.dist + 'm</span></div>';
        }).join('');
      } else {
        els.dispatchPanel.style.display = 'none';
      }
      // weapon slots
      var P = G.player.P;
      var order = ['fists', 'pistol', 'smg', 'shotgun'];
      els.weaponSlots.innerHTML = order.map(function (k, i) {
        var w = SB.CONFIG.WEAPONS[k];
        var owned = P.weapons[k] && P.weapons[k].owned;
        var ammo = !owned ? 'LOCKED' : (w.mag === 0 ? 'MELEE' : P.weapons[k].mag + ' / ' + (P.weapons[k].reserve < 0 ? '∞' : P.weapons[k].reserve));
        if (owned && k === P.weapon && w.mag > 0) ammo = P.magAmmo + ' / ' + (P.weapons[k].reserve < 0 ? '∞' : P.weapons[k].reserve);
        return '<div class="wslot' + (k === P.weapon ? ' active' : '') + (!owned ? ' locked' : '') + '"><span class="wkey">' + (i + 1) + '</span><span class="wname">' + w.label.toUpperCase() + '</span><span class="wammo">' + ammo + '</span></div>';
      }).join('');
      // respect rank bar
      var rk = rankOf(G.rep);
      els.rankName.textContent = 'RANK: ' + rk.cur.name;
      els.rankRp.textContent = G.rep + ' RP' + (rk.next ? ' → ' + rk.next.name + ' ' + rk.next.min : ' — MAX');
      var pct = rk.next ? Math.min(100, (G.rep - rk.cur.min) / (rk.next.min - rk.cur.min) * 100) : 100;
      els.rankFill.style.width = pct + '%';
      // vehicle panel
      if (P.car) {
        els.vehiclePanel.style.display = 'block';
        els.vehicleName.textContent = P.car.def.label;
        var cond = Math.max(0, Math.round(P.car.hp / P.car.maxHp * 100));
        els.vehicleCondText.textContent = 'CONDITION ' + cond + '%';
        els.vehicleCond.style.width = cond + '%';
        var frac = SB.clamp(P.car.speed / P.car.def.top, 0, 1);
        els.vehicleGear.textContent = P.car.speed < 1 ? 'GEAR N' : 'GEAR ' + Math.min(5, 1 + Math.floor(frac * 5));
      } else {
        els.vehiclePanel.style.display = 'none';
      }
      // radio line
      if (G.sound) {
        var st = G.sound.stationName();
        els.radioLine.textContent = '♪ ' + st + (G.sound.songTitle() ? ' — "' + G.sound.songTitle() + '"' : ' (press N)');
      }
      // clock
      var hh = Math.floor(G.hour), mm = Math.floor((G.hour - hh) * 60);
      els.clock.textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm + (G.isNight ? ' ☾' : ' ☀');
    }

    function update(dt) {
      var P = G.player.P;
      els.hpFill.style.width = Math.max(0, P.hp) + '%';
      els.armorFill.style.width = Math.max(0, P.armor) + '%';
      els.cash.textContent = '$' + G.cash.toLocaleString();
      els.stars.innerHTML = starsHtml(G.wanted);
      var w = SB.CONFIG.WEAPONS[P.weapon];
      els.weapon.textContent = w.label;
      var st = P.weapons[P.weapon];
      els.ammo.textContent = P.reloading > 0 ? 'RELOADING…' : (w.mag === 0 ? 'MELEE' : (P.magAmmo + ' / ' + (st.reserve < 0 ? '∞' : st.reserve)));
      els.speed.textContent = P.car ? Math.round(P.car.speed * 3.6) + ' km/h' : Math.round(0) + ' km/h';
      var obj = G.missions.M.objectiveOverride || (G.missions.M.active ? G.missions.M.objective : (G.missions.M.done ? 'Legend of Paloma — free roam' : 'Talk to Elena — mission ' + (G.missions.M.index + 1)));
      els.objective.textContent = obj;
      var d = districtName();
      if (d !== lastDistrict) {
        lastDistrict = d;
        els.district.textContent = d;
        els.district.style.opacity = '1';
        setTimeout(function () { els.district.style.opacity = '0'; }, 2600);
      }
      // interaction prompt
      var prompt = '';
      if (P.onFoot) {
        var near = G.player.nearestCar(4.5);
        if (near) prompt = '[E] Hijack ' + near.def.label;
        else if (G.missions.nearMarker('armory')) prompt = '[E] Armory — buy weapons & ammo';
        else if (G.missions.nearMarker('spray')) prompt = '[E] Spray — respray $200, clear heat';
        else if (G.missions.nearMarker('safehouse')) prompt = '[E] Safe House — save game';
      } else {
        prompt = '[E] Exit vehicle';
      }
      els.prompt.textContent = prompt;
      els.prompt.style.display = prompt ? 'block' : 'none';
      // dialogue with portrait
      if (sayQueue.length && sayT <= 0) { sayT = 4; }
      if (sayT > 0) {
        sayT -= dt;
        var parsed = parseSpeaker(sayQueue[0] || '');
        drawPortrait(parsed.speaker);
        els.dialogueName.textContent = parsed.speaker === 'MATEO' ? 'MATEO REYES' : (parsed.speaker === 'ELENA' ? 'ELENA VANCE' : 'VICTOR CALDER');
        els.dialogueText.textContent = parsed.text;
        els.dialogue.style.display = 'flex';
        if (sayT <= 0) { sayQueue.shift(); sayT = sayQueue.length ? 4 : 0; }
      } else {
        els.dialogue.style.display = 'none';
      }
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) els.toast.style.opacity = '0';
      }
      // slow panels at 4 Hz
      panelT += dt;
      if (panelT >= 0.25) { panelT = 0; updatePanels(); }
    }

    function showStart(canContinue) {
      show('startScreen', true);
      show('hud', false);
      if (els.continueBtn) els.continueBtn.style.display = canContinue ? 'inline-block' : 'none';
    }
    function hideStart() { show('startScreen', false); show('hud', true); }

    function openShop() {
      G.shopOpen = true;
      var body = el('shop-items');
      var html = '';
      Object.keys(SB.CONFIG.WEAPONS).forEach(function (k) {
        if (k === 'fists') return; // fists are never sold
        var w = SB.CONFIG.WEAPONS[k];
        var owned = G.player.P.weapons[k] && G.player.P.weapons[k].owned;
        html += '<div class="shop-row"><span>' + w.label + ' — $' + w.dmg + ' dmg</span>' +
          (owned
            ? '<button data-ammo="' + k + '">Ammo $' + w.ammoPrice + '</button>'
            : '<button data-buy="' + k + '">Buy $' + w.price + '</button>') + '</div>';
      });
      html += '<div class="shop-row"><span>Body Armor (+50)</span><button data-armor="1">Buy $' + SB.CONFIG.PRICES.armor + '</button></div>';
      html += '<div class="shop-row"><span>Cash: $' + G.cash.toLocaleString() + '</span><button data-close="1">Close [Esc]</button></div>';
      body.innerHTML = html;
      body.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () { shopAction(b); });
      });
      show('shopOverlay', true);
    }
    function closeShop() { G.shopOpen = false; show('shopOverlay', false); }
    function shopAction(b) {
      var P = G.player.P;
      if (b.dataset.close) { closeShop(); return; }
      if (b.dataset.buy) {
        var w = SB.CONFIG.WEAPONS[b.dataset.buy];
        if (G.cash >= w.price) {
          G.cash -= w.price;
          P.weapons[b.dataset.buy] = { owned: true, mag: w.mag, reserve: SB.CONFIG.AMMO_BOX[b.dataset.buy] || 60 };
          toast(w.label + ' purchased'); if (G.sound) G.sound.cash();
        } else toast('Not enough cash');
      } else if (b.dataset.ammo) {
        var w2 = SB.CONFIG.WEAPONS[b.dataset.ammo];
        if (w2.ammoPrice > 0 && G.cash >= w2.ammoPrice) {
          G.cash -= w2.ammoPrice;
          P.weapons[b.dataset.ammo].reserve += SB.CONFIG.AMMO_BOX[b.dataset.ammo];
          toast('Ammo purchased'); if (G.sound) G.sound.cash();
        } else toast('Not enough cash');
      } else if (b.dataset.armor) {
        if (G.cash >= SB.CONFIG.PRICES.armor) {
          G.cash -= SB.CONFIG.PRICES.armor;
          P.armor = Math.min(SB.CONFIG.PLAYER.armorMax, P.armor + 50);
          toast('Armor +50'); if (G.sound) G.sound.cash();
        } else toast('Not enough cash');
      }
      openShop();
    }

    return {
      update: update, say: say, clearSay: clearSay, toast: toast, flashDamage: flashDamage,
      showStart: showStart, hideStart: hideStart,
      openShop: openShop, closeShop: closeShop,
      show: show, els: els,
    };
  }

  SB.createHud = createHud;
})();
