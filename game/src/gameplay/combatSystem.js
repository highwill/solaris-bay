// Solaris Bay — combat: hitscan shooting, tracers, muzzle flash, particles,
// enemy AI (guards / officers), pickups and player damage.
window.SB = window.SB || {};

(function () {
  'use strict';

  var enemies = [];
  var pickups = [];
  var tracers = [];
  var particles = [];
  var raycaster = null;
  var muzzle = null;

  function init(G) {
    raycaster = new THREE.Raycaster();
    raycaster.far = 130;
    muzzle = new THREE.PointLight(0xffc861, 0, 18, 2);
    G.scene.add(muzzle);
  }

  function createEnemy(G, x, z, type) {
    var g = new THREE.Group();
    var coat = type === 'officer' ? 0x1e3a5c : 0x3a3a3a;
    var shirt = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.9 });
    var skin = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.8 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.4), shirt);
    body.position.y = 1.05; body.castShadow = true; g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), skin);
    head.position.y = 1.78; g.add(head);
    if (type === 'officer') {
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x10233a }));
      cap.position.y = 1.98; g.add(cap);
    } else {
      var band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: 0x8a1f1f }));
      band.position.y = 1.95; g.add(band);
    }
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.55), new THREE.MeshStandardMaterial({ color: 0x1a1a1c }));
    gun.position.set(0.42, 1.15, 0.3); g.add(gun);
    g.position.set(x, 0, z);
    G.scene.add(g);
    var e = {
      mesh: g, type: type, hp: type === 'officer' ? 80 : 100, maxHp: 100,
      alive: true, shootT: 1 + Math.random(), moveT: 0, diedAt: 0,
      x: x, z: z,
    };
    enemies.push(e);
    return e;
  }

  function spawnPickup(G, x, z, kind) {
    var color = kind === 'health' ? 0x2ecc71 : kind === 'armor' ? 0x3498db : kind === 'cash' ? 0xf1c40f : 0xe67e22;
    var m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    m.position.set(x, 0.9, z);
    G.scene.add(m);
    pickups.push({ mesh: m, kind: kind, x: x, z: z, t: 0 });
  }

  function burst(G, pos, color, n, speed) {
    for (var i = 0; i < n; i++) {
      var m = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.16),
        new THREE.MeshBasicMaterial({ color: color })
      );
      m.position.copy(pos);
      G.scene.add(m);
      particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * speed, vy: Math.random() * speed * 0.8 + 1, vz: (Math.random() - 0.5) * speed,
        life: 0.5 + Math.random() * 0.4,
      });
    }
  }

  function addTracer(G, from, to) {
    var geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }));
    G.scene.add(line);
    tracers.push({ line: line, life: 0.09 });
  }

  function damagePlayer(G, amount) {
    var P = G.player.P;
    if (P.dead || !G.started) return;
    var absorbed = Math.min(P.armor, amount * 0.6);
    P.armor -= absorbed;
    P.hp -= (amount - absorbed);
    if (G.hud) G.hud.flashDamage();
    if (P.hp <= 0) {
      P.hp = 0; P.dead = true;
      if (G.onPlayerDead) G.onPlayerDead();
    }
  }

  function reload(G) {
    var P = G.player.P;
    var w = SB.CONFIG.WEAPONS[P.weapon];
    var st = P.weapons[P.weapon];
    if (P.reloading > 0 || P.magAmmo >= w.mag) return;
    if (st.reserve === 0) { if (G.hud) G.hud.toast('No reserve ammo — visit the Armory'); return; }
    P.reloading = w.reload;
    if (G.sound) G.sound.uiClick();
  }

  function playerShoot(G) {
    var P = G.player.P;
    if (!P.onFoot || P.dead || !G.started || G.paused) return;
    var w = SB.CONFIG.WEAPONS[P.weapon];
    if (G.time - P.lastShot < w.rate) return;
    if (P.reloading > 0) return;
    if (P.magAmmo <= 0) { reload(G); return; }
    P.lastShot = G.time;
    P.magAmmo--;
    G.lastShotAt = G.time;
    G.lastShotPos = { x: P.pos.x, z: P.pos.z };
    if (G.sound) G.sound.gunshot();
    var pellets = w.pellets || 1;
    var cam = G.camera;
    var origin = cam.position.clone();
    for (var p = 0; p < pellets; p++) {
      var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread * 2;
      dir.z += (Math.random() - 0.5) * w.spread * 2;
      dir.normalize();
      raycaster.set(origin, dir);
      var targets = [];
      enemies.forEach(function (e) { if (e.alive) targets.push(e.mesh); });
      G.cars.forEach(function (c) { if (!c.wrecked) targets.push(c.mesh); });
      var hits = raycaster.intersectObjects(targets, true);
      var end = origin.clone().addScaledVector(dir, w.range);
      if (hits.length) {
        var h = hits[0];
        end = h.point.clone();
        var obj = h.object;
        while (obj.parent && !obj.userData.enemyRef && !obj.userData.carRef) obj = obj.parent;
        var enemyHit = null, carHit = null;
        enemies.forEach(function (e) { if (e.mesh === obj || (obj.parent && obj.parent === e.mesh)) enemyHit = e; });
        if (!enemyHit) {
          G.cars.forEach(function (c) { if (c.mesh === obj) carHit = c; });
        }
        if (enemyHit) {
          enemyHit.hp -= w.dmg;
          burst(G, h.point, 0xcc2222, 6, 4);
          if (G.sound) G.sound.hit();
          if (enemyHit.hp <= 0) killEnemy(G, enemyHit);
        } else if (carHit) {
          carHit.hp -= w.dmg;
          burst(G, h.point, 0xffaa33, 5, 4);
          if (G.sound) G.sound.hit();
          if (carHit.hp <= 0 && !carHit.wrecked) {
            carHit.wrecked = true; carHit.vel.multiplyScalar(0.2);
            burst(G, carHit.mesh.position.clone().setY(1.2), 0xff7722, 22, 9);
            if (G.sound) G.sound.explosion();
            if (carHit === G.missionVan) G.mission.vanDisabled = true;
          }
        }
      }
      addTracer(G, origin.clone().addScaledVector(dir, 1.2), end);
    }
    muzzle.position.copy(P.pos).setY(1.5);
    muzzle.intensity = 2.2;
    setTimeout(function () { muzzle.intensity = 0; }, 60);
    // firing is a crime if police are near
    if (G.wanted < 1 && G.police) G.police.addHeat(1);
  }

  function killEnemy(G, e) {
    e.alive = false; e.diedAt = G.time;
    e.mesh.rotation.x = -Math.PI / 2;
    e.mesh.position.y = 0.4;
    burst(G, e.mesh.position.clone().setY(1.2), 0xcc2222, 14, 6);
    if (Math.random() < 0.45) spawnPickup(G, e.x + (Math.random() - 0.5) * 2, e.z + (Math.random() - 0.5) * 2, Math.random() < 0.5 ? 'health' : 'armor');
    if (e.type === 'officer' || e.type === 'guard') G.police.addHeat(1);
  }

  function updateEnemies(G, dt) {
    var P = G.player.P;
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (!e.alive) continue;
      var dx = P.pos.x - e.x, dz = P.pos.z - e.z;
      var dist = Math.hypot(dx, dz);
      var aggro = dist < 55 && (G.missionAggro || G.wanted > 0 || (G.time - (G.lastShotAt || -99)) < 6);
      if (!aggro) { e.mesh.rotation.y += dt * 0.4; continue; }
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist > 26) {
        var sp = 3.4;
        var nx = e.x + dx / dist * sp * dt, nz = e.z + dz / dist * sp * dt;
        var res = SB.collideCircle(G, nx, nz, 0.7, 0, 0);
        e.x = res.x; e.z = res.z;
        e.mesh.position.x = e.x; e.mesh.position.z = e.z;
      }
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < 48 && P.onFoot && !P.dead) {
        e.shootT = 1.1 + Math.random() * 0.7;
        var hitCh = dist < 20 ? 0.34 : dist < 35 ? 0.2 : 0.1;
        if (G.sound) G.sound.enemyShot();
        var from = e.mesh.position.clone().setY(1.4);
        var to = P.pos.clone().setY(1.2);
        addTracer(G, from, to);
        if (Math.random() < hitCh) damagePlayer(G, e.type === 'officer' ? 9 : 8);
      }
    }
    // pickups
    for (var j = pickups.length - 1; j >= 0; j--) {
      var pk = pickups[j];
      pk.t += dt;
      pk.mesh.rotation.y += dt * 2;
      pk.mesh.position.y = 0.9 + Math.sin(pk.t * 3) * 0.15;
      if (SB.dist2D(P.pos.x, P.pos.z, pk.x, pk.z) < 1.6 && P.onFoot) {
        if (pk.kind === 'health') P.hp = Math.min(SB.CONFIG.PLAYER.hp, P.hp + 40);
        if (pk.kind === 'armor') P.armor = Math.min(SB.CONFIG.PLAYER.armorMax, P.armor + 50);
        if (pk.kind === 'cash') { G.cash += 150; if (G.sound) G.sound.cash(); }
        if (pk.kind === 'ammo') {
          var st = P.weapons[P.weapon];
          if (st.reserve >= 0) st.reserve += SB.CONFIG.AMMO_BOX[P.weapon] || 60;
        }
        if (G.sound) G.sound.pickup();
        G.scene.remove(pk.mesh);
        pickups.splice(j, 1);
      }
    }
    // tracers + particles
    for (var k = tracers.length - 1; k >= 0; k--) {
      tracers[k].life -= dt;
      tracers[k].line.material.opacity = Math.max(0, tracers[k].life / 0.09) * 0.95;
      if (tracers[k].life <= 0) { G.scene.remove(tracers[k].line); tracers.splice(k, 1); }
    }
    for (var m = particles.length - 1; m >= 0; m--) {
      var pt = particles[m];
      pt.life -= dt;
      pt.mesh.position.x += pt.vx * dt; pt.mesh.position.y += pt.vy * dt; pt.mesh.position.z += pt.vz * dt;
      pt.vy -= 9 * dt;
      if (pt.life <= 0 || pt.mesh.position.y < 0.05) { G.scene.remove(pt.mesh); particles.splice(m, 1); }
    }
    // reload timer
    var P2 = G.player.P;
    if (P2.reloading > 0) {
      P2.reloading -= dt;
      if (P2.reloading <= 0) {
        var w = SB.CONFIG.WEAPONS[P2.weapon];
        var st2 = P2.weapons[P2.weapon];
        var need = w.mag - P2.magAmmo;
        if (st2.reserve < 0) { P2.magAmmo = w.mag; }
        else {
          var take = Math.min(need, st2.reserve);
          P2.magAmmo += take; st2.reserve -= take;
        }
      }
    }
  }

  SB.combat = {
    init: init, createEnemy: createEnemy, spawnPickup: spawnPickup,
    playerShoot: playerShoot, reload: reload, damagePlayer: damagePlayer,
    updateEnemies: updateEnemies, burst: burst, killEnemy: killEnemy,
    get enemies() { return enemies; },
    get pickups() { return pickups; },
  };
})();
