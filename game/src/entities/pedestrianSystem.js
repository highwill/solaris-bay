// Solaris Bay — pedestrians: walk the sidewalks, flee gunfire and traffic.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createPedestrians(G, count) {
    var peds = [];
    var rng = SB.mulberry32(777);
    var shirtCols = [0xe8e0d0, 0x7a9cc6, 0xc67a7a, 0x7ac67a, 0xd8b13a, 0x9a7ac6, 0x5a5a5e];
    var skinCols = [0xc98e6a, 0x8a5a3a, 0xe8b88a, 0x6a4530];

    function makePed() {
      var g = new THREE.Group();
      var shirt = new THREE.MeshStandardMaterial({ color: shirtCols[Math.floor(rng() * shirtCols.length)], roughness: 0.9 });
      var skin = new THREE.MeshStandardMaterial({ color: skinCols[Math.floor(rng() * skinCols.length)], roughness: 0.8 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.38), shirt);
      body.position.y = 1.0; body.castShadow = true; g.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), skin);
      head.position.y = 1.7; g.add(head);
      var legM = new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.9 });
      var legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.28), legM);
      legL.position.set(-0.16, 0.38, 0); g.add(legL);
      var legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
      return g;
    }

    function randomSidewalkPoint() {
      var c = SB.CONFIG.ROAD_COORDS[Math.floor(rng() * SB.CONFIG.ROAD_COORDS.length)];
      var along = -540 + rng() * 1080;
      var off = (rng() < 0.5 ? -1 : 1) * (7 + 2.5);
      if (rng() < 0.5) return { x: c + off, z: along, alongRoad: 'v', road: c };
      return { x: along, z: c + off, alongRoad: 'h', road: c };
    }

    function spawn() {
      var p = randomSidewalkPoint();
      var mesh = makePed();
      mesh.position.set(p.x, 0, p.z);
      G.scene.add(mesh);
      var ped = {
        mesh: mesh, x: p.x, z: p.z, road: p.road, alongRoad: p.alongRoad,
        dir: rng() < 0.5 ? 1 : -1, speed: 1.1 + rng() * 0.9,
        state: 'walk', fleeT: 0, fx: 0, fz: 0, bob: rng() * 6,
      };
      peds.push(ped);
      return ped;
    }

    for (var i = 0; i < count; i++) spawn();

    function update(dt) {
      var threat = G.lastShotAt && (G.time - G.lastShotAt < 0.4) ? G.lastShotPos : null;
      for (var i = 0; i < peds.length; i++) {
        var p = peds[i];
        if (p.state === 'flee') {
          p.fleeT -= dt;
          p.x += p.fx * 4.4 * dt; p.z += p.fz * 4.4 * dt;
          p.mesh.position.x = p.x; p.mesh.position.z = p.z;
          p.mesh.rotation.y = Math.atan2(p.fx, p.fz);
          if (p.fleeT <= 0) p.state = 'walk';
          continue;
        }
        // check threats
        var flee = false, fdx = 0, fdz = 0;
        if (threat && SB.dist2D(p.x, p.z, threat.x, threat.z) < 48) {
          flee = true; fdx = p.x - threat.x; fdz = p.z - threat.z;
        }
        if (!flee) {
          var pl = G.player.P;
          var pd = pl.onFoot ? SB.dist2D(p.x, p.z, pl.pos.x, pl.pos.z) : 99;
          if (pd < 2.2) { flee = true; fdx = p.x - pl.pos.x; fdz = p.z - pl.pos.z; }
          else {
            for (var c = 0; c < G.cars.length; c++) {
              var car = G.cars[c];
              if (car.speed > 6 && SB.dist2D(p.x, p.z, car.mesh.position.x, car.mesh.position.z) < 8) {
                flee = true; fdx = p.x - car.mesh.position.x; fdz = p.z - car.mesh.position.z;
                break;
              }
            }
          }
        }
        if (flee) {
          var fl = Math.hypot(fdx, fdz) || 1;
          p.fx = fdx / fl; p.fz = fdz / fl; p.fleeT = 2.5 + Math.random(); p.state = 'flee';
          continue;
        }
        // walk along sidewalk
        var step = p.speed * p.dir * dt;
        if (p.alongRoad === 'v') {
          p.z += step;
          if (p.z > 545 || p.z < -545) { p.dir *= -1; }
          if (Math.abs(p.z % 120) < 2 && Math.random() < dt * 0.2) {
            // occasionally turn onto a crossing road
            var nc = SB.CONFIG.ROAD_COORDS[Math.floor(rng() * SB.CONFIG.ROAD_COORDS.length)];
            p.alongRoad = 'h'; p.road = nc; p.z = nc + (rng() < 0.5 ? -9.5 : 9.5); p.x = SB.clamp(p.x, -545, 545);
          }
        } else {
          p.x += step;
          if (p.x > 545 || p.x < -545) { p.dir *= -1; }
          if (Math.abs(p.x % 120) < 2 && Math.random() < dt * 0.2) {
            var nc2 = SB.CONFIG.ROAD_COORDS[Math.floor(rng() * SB.CONFIG.ROAD_COORDS.length)];
            p.alongRoad = 'v'; p.road = nc2; p.x = nc2 + (rng() < 0.5 ? -9.5 : 9.5); p.z = SB.clamp(p.z, -545, 545);
          }
        }
        p.bob += dt * p.speed * 4;
        p.mesh.position.set(p.x, Math.abs(Math.sin(p.bob)) * 0.05, p.z);
        p.mesh.rotation.y = p.alongRoad === 'v' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }

    return { peds: peds, update: update, spawn: spawn };
  }

  SB.createPedestrians = createPedestrians;
})();
