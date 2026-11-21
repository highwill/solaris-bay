// Solaris Bay — HUD: bars, cash, stars, speed, objective, district banner,
// dialogue subtitles, toasts, overlays (start / pause / map / shop / end).
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
    };

    var sayQueue = [], sayT = 0, toastT = 0, lastDistrict = '', fpsAcc = 0;

    function show(id, on) { if (els[id]) els[id].style.display = on ? 'flex' : 'none'; }

    function say(lines) {
      sayQueue = sayQueue.concat(lines);
    }

    function clearSay() {
      sayQueue = []; sayT = 0;
      els.subtitle.style.display = 'none';
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

    function update(dt) {
      var P = G.player.P;
      els.hpFill.style.width = Math.max(0, P.hp) + '%';
      els.armorFill.style.width = Math.max(0, P.armor) + '%';
      els.cash.textContent = '$' + G.cash.toLocaleString();
      els.stars.innerHTML = starsHtml(G.wanted);
      var w = SB.CONFIG.WEAPONS[P.weapon];
      els.weapon.textContent = w.label;
      var st = P.weapons[P.weapon];
      els.ammo.textContent = P.reloading > 0 ? 'RELOADING…' : (P.magAmmo + ' / ' + (st.reserve < 0 ? '∞' : st.reserve));
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
      // dialogue
      if (sayQueue.length && sayT <= 0) { sayT = 4; }
      if (sayT > 0) {
        sayT -= dt;
        els.subtitle.textContent = sayQueue[0] || '';
        els.subtitle.style.display = sayQueue.length ? 'block' : 'none';
        if (sayT <= 0) { sayQueue.shift(); sayT = sayQueue.length ? 4 : 0; }
      } else {
        els.subtitle.style.display = 'none';
      }
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) els.toast.style.opacity = '0';
      }
      // fps counter (dev aid, hidden in normal play)
      fpsAcc += dt;
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
