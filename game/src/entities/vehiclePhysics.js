// Solaris Bay — arcade vehicle physics: drift, collisions, headlights.
window.SB = window.SB || {};

(function () {
  'use strict';

  // Resolve a circle (x,z,r) against building AABBs + world bounds.
  // Returns {x, z, hit, impact} — impact is the speed component killed.
  function collideCircle(G, x, z, r, vx, vz) {
    var hit = false, impact = 0;
    var nx = SB.clamp(x, -596, 596), nz = SB.clamp(z, -596, 596);
    if (nx !== x || nz !== z) { hit = true; impact = Math.abs(vx) + Math.abs(vz); x = nx; z = nz; }
    var cols = G.city.colliders;
    for (var i = 0; i < cols.length; i++) {
      var c = cols[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        var dxl = x + r - c.minX, dxr = c.maxX - (x - r);
        var dzl = z + r - c.minZ, dzr = c.maxZ - (z - r);
        var m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) { x = c.minX - r; impact = Math.abs(vx); }
        else if (m === dxr) { x = c.maxX + r; impact = Math.abs(vx); }
        else if (m === dzl) { z = c.minZ - r; impact = Math.abs(vz); }
        else { z = c.maxZ + r; impact = Math.abs(vz); }
        hit = true;
      }
    }
    return { x: x, z: z, hit: hit, impact: impact };
  }

  function createCar(G, type, x, z, heading, colorOverride) {
    var def = SB.CONFIG.VEHICLES[type];
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: colorOverride || def.color, roughness: 0.35, metalness: 0.55 });
    var glassMat = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.15, metalness: 0.7 });
    var trimMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 });
    var L = def.len, W = def.wid;

    var body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.62, L), bodyMat);
    body.position.y = 0.55; body.castShadow = true; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.55, L * 0.48), glassMat);
    cabin.position.set(0, 1.1, -L * 0.05); cabin.castShadow = true; g.add(cabin);
    var nose = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.34, 0.5), bodyMat);
    nose.position.set(0, 0.5, L / 2 - 0.1); g.add(nose);
    // wheels
    var wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
    var wheels = [];
    [[-W / 2, L / 2 - 0.8], [W / 2, L / 2 - 0.8], [-W / 2, -L / 2 + 0.8], [W / 2, -L / 2 + 0.8]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, trimMat);
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.36, p[1]);
      w.castShadow = true; g.add(w); wheels.push(w);
    });
    // headlights + taillights
    var headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 0.9 });
    var tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xcc0000, emissiveIntensity: 0.9 });
    [-W / 2 + 0.3, W / 2 - 0.3].forEach(function (hx) {
      var hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
      hl.position.set(hx, 0.62, L / 2 + 0.02); g.add(hl);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
      tl.position.set(hx, 0.62, -L / 2 - 0.02); g.add(tl);
    });
    var lightbar = null, barRed = null, barBlue = null;
    if (type === 'cruiser') {
      lightbar = new THREE.Group();
      barRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 2 }));
      barRed.position.x = -0.4;
      barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x0000cc, emissive: 0x2222ff, emissiveIntensity: 2 }));
      barBlue.position.x = 0.4;
      lightbar.add(barRed); lightbar.add(barBlue);
      lightbar.position.set(0, 1.45, -0.1);
      g.add(lightbar);
    }
    var spot = new THREE.SpotLight(0xfff2c8, 0, 90, 0.5, 0.5, 1.2);
    spot.position.set(0, 1, L / 2);
    var spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, L / 2 + 30);
    g.add(spotTarget); spot.target = spotTarget; g.add(spot);

    g.position.set(x, 0, z);
    g.rotation.y = heading;
    G.scene.add(g);

    return {
      mesh: g, type: type, def: def, heading: heading,
      vel: new THREE.Vector3(0, 0, 0),
      steer: 0, speed: 0, hp: def.hp, maxHp: def.hp,
      driver: 'none', wrecked: false, wheels: wheels,
      lightbar: lightbar, barRed: barRed, barBlue: barBlue, spot: spot,
      lastHitAt: -10, stuckAt: 0,
    };
  }

  // input: {throttle (-1..1), steer (-1..1), handbrake (bool)}
  function stepCar(G, car, input, dt) {
    if (car.wrecked) { car.vel.multiplyScalar(Math.max(0, 1 - 3 * dt)); car.mesh.position.addScaledVector(car.vel, dt); return; }
    var def = car.def;
    var fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
    var fSpeed = car.vel.x * fwdX + car.vel.z * fwdZ; // forward speed
    // throttle
    if (input.throttle > 0) car.vel.x += fwdX * def.accel * input.throttle * dt, car.vel.z += fwdZ * def.accel * input.throttle * dt;
    else if (input.throttle < 0) {
      if (fSpeed > 0.5) { car.vel.x += fwdX * def.accel * 1.4 * input.throttle * dt; car.vel.z += fwdZ * def.accel * 1.4 * input.throttle * dt; }
      else car.vel.x += fwdX * def.accel * 0.55 * input.throttle * dt, car.vel.z += fwdZ * def.accel * 0.55 * input.throttle * dt;
    }
    // steering (stronger with speed, none at standstill)
    var spd = Math.abs(fSpeed);
    var steerTarget = SB.clamp(input.steer, -1, 1);
    car.steer += (steerTarget - car.steer) * Math.min(1, 10 * dt);
    var yawRate = car.steer * SB.clamp(spd / 12, 0, 1) * (input.handbrake ? 3.1 : 2.1) * (fSpeed < 0 ? -1 : 1);
    car.heading += yawRate * dt;
    // grip: pull velocity toward forward direction; handbrake loosens it (drift)
    var nfx = Math.sin(car.heading), nfz = Math.cos(car.heading);
    var nfSpeed = car.vel.x * nfx + car.vel.z * nfz;
    var latX = car.vel.x - nfx * nfSpeed, latZ = car.vel.z - nfz * nfSpeed;
    var grip = input.handbrake ? 1.1 : def.grip * 2.2;
    var k = Math.max(0, 1 - grip * dt);
    car.vel.x = nfx * nfSpeed + latX * k;
    car.vel.z = nfz * nfSpeed + latZ * k;
    // drag + top speed
    var drag = input.throttle === 0 ? 0.9 : 0.25;
    car.vel.multiplyScalar(Math.max(0, 1 - drag * dt));
    var fs2 = car.vel.x * nfx + car.vel.z * nfz;
    if (fs2 > def.top) { car.vel.x *= def.top / fs2; car.vel.z *= def.top / fs2; }
    if (fs2 < -def.reverse) { car.vel.x *= -def.reverse / fs2; car.vel.z *= -def.reverse / fs2; }
    // integrate + collide
    var nx = car.mesh.position.x + car.vel.x * dt;
    var nz = car.mesh.position.z + car.vel.z * dt;
    var res = collideCircle(G, nx, nz, 1.7, car.vel.x, car.vel.z);
    if (res.hit) {
      var impact = Math.abs(car.vel.x) + Math.abs(car.vel.z);
      if (impact > 9 && G.time - car.lastHitAt > 0.4) {
        car.hp -= (impact - 9) * 1.6;
        car.lastHitAt = G.time;
        if (G.sound && car.driver === 'player') G.sound.enemyShot();
        if (car.hp <= 0) { car.wrecked = true; car.vel.multiplyScalar(0.2); }
      }
      // kill velocity into the wall
      var dot = car.vel.x * (res.x - nx) + car.vel.z * (res.z - nz);
      if (dot < 0) { car.vel.x *= 0.4; car.vel.z *= 0.4; }
    }
    car.mesh.position.x = res.x; car.mesh.position.z = res.z;
    car.mesh.rotation.y = car.heading;
    car.speed = Math.sqrt(car.vel.x * car.vel.x + car.vel.z * car.vel.z);
    // wheel spin + front steer visual
    var spin = car.speed * dt * 2.2;
    car.wheels.forEach(function (w, i) { w.rotation.x += spin; if (i < 2) w.rotation.y = car.steer * 0.42; });
    // headlights at night
    car.spot.intensity = (G.isNight || G.goldHour > 0.4) ? 1.6 : 0;
  }

  SB.collideCircle = collideCircle;
  SB.createCar = createCar;
  SB.stepCar = stepCar;
})();
