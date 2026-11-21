// Solaris Bay — on-foot player: movement, third-person camera, enter/exit,
// weapon switching, shooting input. Works with pointer lock or drag-to-look.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createPlayer(G) {
    var CFG = SB.CONFIG;
    var group = new THREE.Group();
    var shirtMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.8 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.4), shirtMat);
    body.position.y = 1.05; body.castShadow = true; group.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), skinMat);
    head.position.y = 1.78; head.castShadow = true; group.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0xd21f3c, roughness: 0.8 }));
    cap.position.y = 1.98; group.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), pantsMat);
    legL.position.set(-0.18, 0.4, 0); group.add(legL);
    var legR = legL.clone(); legR.position.x = 0.18; group.add(legR);
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.6, metalness: 0.5 }));
    gun.position.set(0.42, 1.15, 0.3); group.add(gun);
    group.position.set(CFG.PLAYER_START.x, 0, CFG.PLAYER_START.z);
    G.scene.add(group);

    var P = {
      mesh: group, gun: gun,
      pos: group.position,
      yaw: CFG.PLAYER_START.yaw, pitch: 0.05,
      hp: CFG.PLAYER.hp, armor: 0,
      onFoot: true, car: null,
      weapon: 'pistol',
      weapons: { fists: { owned: true, mag: 0, reserve: -1 }, pistol: { owned: true, mag: 12, reserve: -1 } },
      magAmmo: 12, reloading: 0,
      lastShot: -9, dead: false,
      moveBob: 0,
    };

    function switchWeapon(name) {
      var w = SB.CONFIG.WEAPONS[name];
      if (!w || !P.weapons[name] || !P.weapons[name].owned) return;
      P.weapon = name;
      P.magAmmo = P.weapons[name].mag;
      P.reloading = 0;
      if (G.sound) G.sound.uiClick();
    }

    function enterCar(car) {
      if (!car || car.wrecked) return false;
      if (car.driver === 'traffic') {
        // hijack: the driver flees on foot
        if (G.traffic) G.traffic.ejectDriver(car);
      }
      car.driver = 'player';
      P.car = car; P.onFoot = false;
      G.scene.remove(group);
      if (G.sound) G.sound.engineStart();
      return true;
    }

    function exitCar() {
      if (!P.car) return;
      var car = P.car;
      car.driver = 'none';
      P.car = null; P.onFoot = true;
      var sx = Math.cos(car.heading), sz = -Math.sin(car.heading);
      P.pos.set(car.mesh.position.x + sx * 2.4, 0, car.mesh.position.z + sz * 2.4);
      var res = SB.collideCircle(G, P.pos.x, P.pos.z, 0.7, 0, 0);
      P.pos.x = res.x; P.pos.z = res.z;
      G.scene.add(group);
    }

    function nearestCar(maxD) {
      var best = null, bd = maxD;
      G.cars.forEach(function (c) {
        if (c.wrecked) return;
        var d = SB.dist2D(P.pos.x, P.pos.z, c.mesh.position.x, c.mesh.position.z);
        if (d < bd) { bd = d; best = c; }
      });
      return best;
    }

    function update(dt) {
      if (P.dead || !G.started || G.paused) return;
      var keys = G.keys;
      if (P.onFoot) {
        var sp = (keys['ShiftLeft'] || keys['ShiftRight']) ? CFG.PLAYER.sprintSpeed : CFG.PLAYER.walkSpeed;
        var fx = 0, fz = 0;
        var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
        if (keys['KeyW']) { fx -= sy; fz -= cy; }
        if (keys['KeyS']) { fx += sy; fz += cy; }
        if (keys['KeyA']) { fx -= cy; fz += sy; }
        if (keys['KeyD']) { fx += cy; fz -= sy; }
        var len = Math.hypot(fx, fz);
        if (len > 0) {
          fx /= len; fz /= len;
          var nx = P.pos.x + fx * sp * dt, nz = P.pos.z + fz * sp * dt;
          var res = SB.collideCircle(G, nx, nz, CFG.PLAYER.radius, fx * sp, fz * sp);
          P.pos.x = res.x; P.pos.z = res.z;
          P.moveBob += dt * sp * 1.6;
          group.position.y = Math.abs(Math.sin(P.moveBob)) * 0.06;
          group.rotation.y = Math.atan2(fx, fz);
        }
        // weapon keys: 1 fists, 2 pistol, 3 SMG, 4 shotgun
        if (keys['Digit1']) switchWeapon('fists');
        if (keys['Digit2']) switchWeapon('pistol');
        if (keys['Digit3']) switchWeapon('smg');
        if (keys['Digit4']) switchWeapon('shotgun');
        if (keys['KeyR']) SB.combat.reload(G);
        if (G.mouseDown) SB.combat.playerShoot(G);
      } else if (P.car) {
        var input = {
          throttle: (keys['KeyW'] ? 1 : 0) + (keys['KeyS'] ? -1 : 0),
          steer: (keys['KeyA'] ? -1 : 0) + (keys['KeyD'] ? 1 : 0),
          handbrake: !!(keys['Space']),
        };
        SB.stepCar(G, P.car, input, dt);
        P.yaw = P.car.heading;
        P.pos.set(P.car.mesh.position.x, 0, P.car.mesh.position.z);
        if (G.sound) G.sound.engineUpdate(SB.clamp(P.car.speed / P.car.def.top, 0, 1), input.handbrake && P.car.speed > 8);
      }
      updateCamera(dt);
    }

    var camPos = new THREE.Vector3();
    var camTarget = new THREE.Vector3();
    function updateCamera(dt) {
      var dist = P.onFoot ? 7.5 : 11;
      var height = P.onFoot ? 3.2 : 4.4;
      var tx, tz, ty;
      if (P.onFoot) {
        tx = P.pos.x + Math.sin(P.yaw) * dist;
        tz = P.pos.z + Math.cos(P.yaw) * dist;
        ty = P.pos.y + height;
      } else {
        var h = P.car.heading;
        tx = P.car.mesh.position.x - Math.sin(h) * dist;
        tz = P.car.mesh.position.z - Math.cos(h) * dist;
        ty = height;
        P.yaw = h;
      }
      var k = Math.min(1, 7 * dt);
      camPos.lerp(new THREE.Vector3(tx, ty, tz), k);
      // keep camera out of buildings: clamp above ground, simple raycast-free push
      if (camPos.y < 1.2) camPos.y = 1.2;
      G.camera.position.copy(camPos);
      // on foot the camera aims at a point ahead of the player (so the
      // crosshair ray stays level enough to hit targets at 10-40m);
      // in a car it tracks the vehicle.
      if (P.onFoot) {
        var fwdX = -Math.sin(P.yaw), fwdZ = -Math.cos(P.yaw);
        var aimDist = 12;
        camTarget.set(
          P.pos.x + fwdX * aimDist,
          P.pos.y + 1.5 + Math.tan(P.pitch) * aimDist,
          P.pos.z + fwdZ * aimDist
        );
      } else {
        camTarget.set(P.pos.x, P.pos.y + 1.6, P.pos.z);
      }
      G.camera.lookAt(camTarget);
    }

    function resetToStart() {
      P.hp = CFG.PLAYER.hp; P.armor = 0; P.dead = false;
      if (P.car) { P.car.driver = 'none'; P.car = null; }
      P.onFoot = true;
      P.pos.set(CFG.PLAYER_START.x, 0, CFG.PLAYER_START.z);
      P.yaw = CFG.PLAYER_START.yaw;
      if (!group.parent) G.scene.add(group);
    }

    return {
      P: P, update: update, enterCar: enterCar, exitCar: exitCar,
      nearestCar: nearestCar, switchWeapon: switchWeapon, resetToStart: resetToStart,
    };
  }

  SB.createPlayer = createPlayer;
})();
