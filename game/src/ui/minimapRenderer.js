// Solaris Bay — 2D radar minimap: roads, ocean, player arrow, mission
// marker, police blips, traffic dots, guard dots.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createMinimap(G) {
    var canvas = document.getElementById('minimap');
    var ctx = canvas.getContext('2d');
    var S = canvas.width; // square
    var HALF = SB.CONFIG.WORLD_HALF;
    function toMap(x, z) {
      return [(x + HALF) / (HALF * 2) * S, (z + HALF) / (HALF * 2) * S];
    }

    function draw() {
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = '#10151c';
      ctx.fillRect(0, 0, S, S);
      // ocean
      var oc = toMap(-600, 0);
      ctx.fillStyle = '#1d6f8e';
      ctx.fillRect(0, 0, oc[0], S);
      // beach
      ctx.fillStyle = '#dcc08a';
      ctx.fillRect(oc[0], 0, 4, S);
      // roads
      ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 2;
      SB.CONFIG.ROAD_COORDS.forEach(function (c) {
        var a = toMap(c, -HALF), b = toMap(c, HALF);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        var c2 = toMap(-HALF, c), d2 = toMap(HALF, c);
        ctx.beginPath(); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.stroke();
      });
      // district tint (downtown)
      ctx.fillStyle = 'rgba(122,156,196,0.18)';
      var d1 = toMap(-180, -180), d2 = toMap(180, 180);
      ctx.fillRect(d1[0], d1[1], d2[0] - d1[0], d2[1] - d1[1]);
      // markers (armory / spray / safehouse)
      ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
      Object.keys(SB.CONFIG.MARKERS).forEach(function (k) {
        var mk = SB.CONFIG.MARKERS[k];
        var p = toMap(mk.x, mk.z);
        ctx.fillStyle = '#9dff8a';
        ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, Math.PI * 2); ctx.fill();
      });
      // mission target
      var M = G.missions.M;
      if (M.target) {
        var pulse = 4 + Math.sin(G.time * 5) * 2;
        var mp = toMap(M.target.x, M.target.z);
        ctx.fillStyle = '#ffd76a';
        ctx.beginPath(); ctx.arc(mp[0], mp[1], pulse, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(mp[0], mp[1], pulse + 4, 0, Math.PI * 2); ctx.stroke();
      }
      // guards
      ctx.fillStyle = '#ff7a3c';
      SB.combat.enemies.forEach(function (e) {
        if (!e.alive) return;
        var gp = toMap(e.x, e.z);
        ctx.fillRect(gp[0] - 2, gp[1] - 2, 4, 4);
      });
      // traffic
      ctx.fillStyle = '#d8d8d8';
      G.cars.forEach(function (c) {
        if (c.driver !== 'traffic') return;
        var tp = toMap(c.mesh.position.x, c.mesh.position.z);
        ctx.fillRect(tp[0] - 1.5, tp[1] - 1.5, 3, 3);
      });
      // police blips (flashing)
      if (Math.floor(G.time * 3) % 2 === 0) {
        ctx.fillStyle = '#ff2d2d';
        G.police.cruisers.forEach(function (c) {
          var pp = toMap(c.car.mesh.position.x, c.car.mesh.position.z);
          ctx.beginPath(); ctx.arc(pp[0], pp[1], 3.5, 0, Math.PI * 2); ctx.fill();
        });
      }
      // player arrow
      var P = G.player.P;
      var pp = toMap(P.pos.x, P.pos.z);
      ctx.save();
      ctx.translate(pp[0], pp[1]);
      ctx.rotate(Math.atan2(Math.sin(P.yaw), -Math.cos(P.yaw)) + Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      // border
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, S - 2, S - 2);
    }

    return { draw: draw };
  }

  SB.createMinimap = createMinimap;
})();
