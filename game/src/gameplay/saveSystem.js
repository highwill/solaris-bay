// Solaris Bay — save / load via localStorage.
window.SB = window.SB || {};

(function () {
  'use strict';

  var KEY = 'solaris-bay-save-v1';

  function save(G) {
    try {
      var P = G.player.P;
      var data = {
        cash: G.cash, rep: G.rep, missionIndex: G.missions.M.index,
        hour: G.hour,
        hp: P.hp, armor: P.armor,
        weapons: P.weapons,
        weapon: P.weapon,
        pos: { x: P.pos.x, z: P.pos.z },
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function has() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  function applySave(G, data) {
    if (!data) return false;
    G.cash = data.cash || 0;
    G.rep = data.rep || 0;
    if (typeof data.hour === 'number') { G.hour = data.hour; if (G.sky) G.sky.setHour(data.hour); }
    var P = G.player.P;
    P.hp = data.hp || 100;
    P.armor = data.armor || 0;
    if (data.weapons) {
      Object.keys(data.weapons).forEach(function (k) {
        if (SB.CONFIG.WEAPONS[k]) P.weapons[k] = data.weapons[k];
      });
    }
    if (data.weapon && P.weapons[data.weapon]) { P.weapon = data.weapon; P.magAmmo = SB.CONFIG.WEAPONS[data.weapon].mag; }
    if (data.pos) {
      P.pos.set(data.pos.x, 0, data.pos.z);
      P.mesh.position.set(data.pos.x, 0, data.pos.z);
    }
    if (typeof data.missionIndex === 'number') {
      G.missions.M.index = Math.min(data.missionIndex, SB.CONFIG.MISSIONS.length - 1);
    }
    return true;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  SB.save = { save: save, load: load, has: has, applySave: applySave, clear: clear };
})();
