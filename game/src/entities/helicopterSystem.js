// Solaris Bay — police helicopter (3+ stars) with a searchlight cone, and
// roadblocks (4+ stars): cruisers parked across the road ahead of the player.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createHelicopter(G) {
    var heli = null;        // { group, rotor, light, cone, ... }
    var roadblocks = [];    // { car, name }
    var rotorT = 0;

    function buildHeli() {
      var g = new THREE.Group();
      var bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5c, roughness: 0.5, metalness: 0.4 });
      var glassMat = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.15, metalness: 0.7 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 5.2), bodyMat);
      body.position.y = 0; body.castShadow = true; g.add(body);
      var nose = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.6), glassMat);
      nose.position.set(0, -0.1, 3); g.add(nose);
      var tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5.5), bodyMat);
      tail.position.set(0, 0.2, -5); g.add(tail);
      var fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 1.2), bodyMat);
      fin.position.set(0, 1, -7.4); g.add(fin);
      var rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.5, metalness: 0.6 }));
      rotor.position.y = 1.1; g.add(rotor);
      var rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; g.add(rotor2);
      var skidL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.4), new THREE.MeshStandardMaterial({ color: 0x222226 }));
      skidL.position.set(-1.3, -1.1, 0); g.add(skidL);
      var skidR = skidL.clone(); skidR.position.x = 1.3; g.add(skidR);
      // searchlight: spotlight + visible cone down to the player
      var light = new THREE.SpotLight(0xfff2c8, 2.4, 220, 0.32, 0.45, 1.0);
      light.position.set(0, -0.8, 1.5);
      var lightTarget = new THREE.Object3D();
      g.add(lightTarget); light.target = lightTarget; g.add(light);
      var coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
      var cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 16, 1, true), coneMat);
      cone.rotation.x = Math.PI; // apex up
      g.add(cone);
      G.scene.add(g);
      return { group: g, rotor: rotor, rotor2: rotor2, light: light, lightTarget: lightTarget, cone: cone };
    }

    function spawnRoadblocks() {
      var P = G.player.P;
      // place across the road the player is heading down, ~90m ahead
      var fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      var tx = P.pos.x + fx * 90, tz = P.pos.z + fz * 90;
      var nearestX = SB.CONFIG.ROAD_COORDS[0], nearestZ = SB.CONFIG.ROAD_COORDS[0];
      SB.CONFIG.ROAD_COORDS.forEach(function (c) {
        if (Math.abs(c - tx) < Math.abs(nearestX - tx)) nearestX = c;
        if (Math.abs(c - tz) < Math.abs(nearestZ - tz)) nearestZ = c;
      });
      var vertical = Math.abs(nearestX - tx) < Math.abs(nearestZ - tz);
      var bx = vertical ? nearestX : tx, bz = vertical ? tz : nearestZ;
      bx = SB.clamp(bx, -560, 560); bz = SB.clamp(bz, -560, 560);
      for (var i = 0; i < 2; i++) {
        var ox = vertical ? (i === 0 ? -4.5 : 4.5) : 0;
        var oz = vertical ? 0 : (i === 0 ? -4.5 : 4.5);
        var car = SB.createCar(G, 'cruiser', bx + ox, bz + oz, vertical ? Math.PI / 2 : 0, 0xf2f2f2);
        car.driver = 'police';
        car.roadblock = true;
        G.cars.push(car);
        roadblocks.push({ car: car, name: 'RB-' + (i + 1) });
      }
      if (G.hud) G.hud.toast('ROADBLOCK AHEAD — Paloma PD sealing the streets');
    }

    function clearRoadblocks() {
      roadblocks.forEach(function (rb) {
        G.scene.remove(rb.car.mesh);
        var gi = G.cars.indexOf(rb.car); if (gi >= 0) G.cars.splice(gi, 1);
      });
      roadblocks = [];
    }

    function update(dt) {
      rotorT += dt;
      var P = G.player.P;
      // helicopter: live at 3+ stars, gone below
      if (G.wanted >= 3 && G.started && !G.paused) {
        // hover station: ahead of the player in the travel direction,
        // low enough to be seen from the chase camera
        var fx, fz;
        if (P.car) { fx = Math.sin(P.car.heading); fz = Math.cos(P.car.heading); }
        else { fx = -Math.sin(P.yaw); fz = -Math.cos(P.yaw); }
        var hx = P.pos.x + fx * 80, hz = P.pos.z + fz * 80;
        var hy = 26;
        if (!heli) {
          heli = buildHeli();
          // spawn on station, not at the world origin — otherwise it
          // spends its first seconds flying in from (0,0,0)
          heli.group.position.set(hx, hy, hz);
          if (G.hud) G.hud.toast('AIR-1 overhead — Paloma PD helicopter tracking you');
        }
        // hover ahead of the player with a lag, searchlight locked on —
        // the follow rate must outrun a top-speed car or the heli trails
        // behind the player forever
        heli.group.position.x += (hx - heli.group.position.x) * Math.min(1, 2.6 * dt);
        heli.group.position.y += (hy - heli.group.position.y) * Math.min(1, 2.6 * dt);
        heli.group.position.z += (hz - heli.group.position.z) * Math.min(1, 2.6 * dt);
        heli.group.rotation.y = Math.atan2(P.pos.x - heli.group.position.x, P.pos.z - heli.group.position.z);
        heli.rotor.rotation.y += dt * 22;
        heli.rotor2.rotation.y += dt * 22;
        heli.lightTarget.position.set(P.pos.x - heli.group.position.x, -heli.group.position.y, P.pos.z - heli.group.position.z);
        // visible cone: apex at the heli, base on the player
        var dx = P.pos.x - heli.group.position.x, dz = P.pos.z - heli.group.position.z;
        var dist = Math.sqrt(dx * dx + dz * dz + heli.group.position.y * heli.group.position.y);
        heli.cone.scale.set(9, dist, 9);
        heli.cone.position.set(dx / 2, -heli.group.position.y / 2, dz / 2);
        var dir = new THREE.Vector3(dx, -heli.group.position.y, dz).normalize();
        heli.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
        if (G.sound) G.sound.siren(true);
      } else if (heli) {
        G.scene.remove(heli.group);
        heli = null;
      }
      // roadblocks: live at 4+ stars
      if (G.wanted >= 4 && G.started && !G.paused) {
        if (roadblocks.length === 0) spawnRoadblocks();
      } else if (roadblocks.length) {
        clearRoadblocks();
      }
    }

    // Units for the dispatch panel: heli + roadblocks (cruisers come from police).
    function getUnits() {
      var units = [];
      if (heli) {
        var d = SB.dist2D(G.player.P.pos.x, G.player.P.pos.z, heli.group.position.x, heli.group.position.z);
        units.push({ name: 'AIR-1', dist: Math.round(d), state: 'SPOTLIGHT' });
      }
      roadblocks.forEach(function (rb) {
        var d2 = SB.dist2D(G.player.P.pos.x, G.player.P.pos.z, rb.car.mesh.position.x, rb.car.mesh.position.z);
        units.push({ name: rb.name, dist: Math.round(d2), state: 'ROADBLOCK' });
      });
      return units;
    }

    return {
      update: update, getUnits: getUnits,
      get active() { return !!heli; },
      get roadblocks() { return roadblocks; },
    };
  }

  SB.createHelicopter = createHelicopter;
})();
