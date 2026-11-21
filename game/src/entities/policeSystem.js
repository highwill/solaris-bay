// Solaris Bay — wanted level: police cruisers that chase and ram, officers
// who engage on foot, heat decay, sirens and flashing lightbars.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createPolice(G) {
    var cruisers = [];
    var officers = [];
    var rng = SB.mulberry32(99);
    var lastCrimeAt = -100;
    var decayT = 0;
    var flashT = 0;

    function setWanted(n, crime) {
      var before = G.wanted;
      G.wanted = SB.clamp(n, 0, 5);
      if (crime) lastCrimeAt = G.time;
      if (G.wanted > before && G.hud) G.hud.toast('WANTED LEVEL ' + G.wanted + ' — Paloma PD responding');
    }
    function addHeat(n) { setWanted(G.wanted + n, true); }

    function spawnCruiser() {
      var px = G.player.P.pos.x, pz = G.player.P.pos.z;
      var node = null;
      for (var t = 0; t < 40; t++) {
        var n = G.city.roadGraph.nodes[Math.floor(rng() * G.city.roadGraph.nodes.length)];
        var d = SB.dist2D(px, pz, n.x, n.z);
        if (d > 130 && d < 240) { node = n; break; }
      }
      if (!node) node = { x: px + 150, z: pz };
      var car = SB.createCar(G, 'cruiser', node.x, node.z, 0, 0xf2f2f2);
      car.driver = 'police';
      G.cars.push(car);
      var c = { car: car, stuckT: 0, lastX: node.x, lastZ: node.z, ramCd: 0 };
      cruisers.push(c);
      return c;
    }

    function spawnOfficer() {
      var px = G.player.P.pos.x, pz = G.player.P.pos.z;
      var a = rng() * Math.PI * 2;
      var x = SB.clamp(px + Math.cos(a) * 40, -560, 560);
      var z = SB.clamp(pz + Math.sin(a) * 40, -560, 560);
      var e = SB.combat.createEnemy(G, x, z, 'officer');
      officers.push(e);
      return e;
    }

    function update(dt) {
      flashT += dt;
      var wantCruisers = G.wanted === 0 ? 0 : Math.min(G.wanted, SB.CONFIG.POLICE_MAX);
      while (cruisers.length < wantCruisers) spawnCruiser();
      while (cruisers.length > wantCruisers) {
        var rm = cruisers.pop();
        G.scene.remove(rm.car.mesh);
        var gi = G.cars.indexOf(rm.car); if (gi >= 0) G.cars.splice(gi, 1);
      }
      var wantOfficers = (G.wanted >= 2 && G.player.P.onFoot) ? Math.min(G.wanted - 1, 3) : 0;
      var aliveOff = officers.filter(function (o) { return o.alive; }).length;
      while (aliveOff < wantOfficers) { spawnOfficer(); aliveOff++; }

      var px = G.player.P.pos.x, pz = G.player.P.pos.z;
      // cruiser AI
      for (var i = cruisers.length - 1; i >= 0; i--) {
        var c = cruisers[i], car = c.car;
        if (car.wrecked) continue;
        var dx = px - car.mesh.position.x, dz = pz - car.mesh.position.z;
        var dist = Math.hypot(dx, dz);
        var desired = Math.atan2(dx, dz);
        var diff = desired - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        var input = {
          throttle: dist > 6 ? 1 : 0.4,
          steer: SB.clamp(diff * 1.6, -1, 1),
          handbrake: false,
        };
        SB.stepCar(G, car, input, dt);
        // ram
        c.ramCd -= dt;
        if (dist < 4.2 && c.ramCd <= 0) {
          c.ramCd = 1.2;
          var pl = G.player.P;
          if (pl.onFoot) {
            SB.combat.damagePlayer(G, 12);
          } else if (pl.car) {
            pl.car.hp -= 6;
            pl.car.vel.x += dx / (dist || 1) * 6; pl.car.vel.z += dz / (dist || 1) * 6;
            if (G.sound) G.sound.enemyShot();
            if (pl.car.hp <= 0) { pl.car.wrecked = true; }
          }
        }
        // stuck detection
        if (car.speed < 1.5) {
          c.stuckT += dt;
          if (c.stuckT > 4) {
            var n2 = G.city.roadGraph.nodes[Math.floor(rng() * G.city.roadGraph.nodes.length)];
            car.mesh.position.set(n2.x, 0, n2.z);
            car.vel.set(0, 0, 0);
            c.stuckT = 0;
          }
        } else c.stuckT = 0;
        // lightbar flash
        if (car.barRed && car.barBlue) {
          var phase = Math.floor(flashT * 6) % 2 === 0;
          car.barRed.material.emissiveIntensity = phase ? 3 : 0.2;
          car.barBlue.material.emissiveIntensity = phase ? 0.2 : 3;
        }
      }
      // officers are updated by combat (they are enemies); prune dead ones
      for (var j = officers.length - 1; j >= 0; j--) {
        if (!officers[j].alive && G.time - officers[j].diedAt > 12) {
          G.scene.remove(officers[j].mesh);
          officers.splice(j, 1);
        }
      }
      // siren while any cruiser is close
      var near = cruisers.some(function (c) {
        return SB.dist2D(px, pz, c.car.mesh.position.x, c.car.mesh.position.z) < 160;
      });
      if (G.sound) G.sound.siren(G.wanted > 0 && near && G.started && !G.paused);
      // heat decay: only when no police can see the player
      var seen = cruisers.some(function (c) {
        return SB.dist2D(px, pz, c.car.mesh.position.x, c.car.mesh.position.z) < 70;
      }) || officers.some(function (o) { return o.alive; });
      if (G.wanted > 0 && !seen && G.time - lastCrimeAt > 12) {
        decayT += dt;
        if (decayT >= SB.CONFIG.WANTED_DECAY_SEC) {
          decayT = 0;
          setWanted(G.wanted - 1, false);
        }
      } else decayT = 0;
    }

    return {
      cruisers: cruisers, officers: officers,
      update: update, setWanted: setWanted, addHeat: addHeat,
    };
  }

  SB.createPolice = createPolice;
})();
