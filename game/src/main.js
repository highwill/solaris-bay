// Solaris Bay — boot, game loop, input, overlays, screenshot presets.
// Original 3D open-world crime game for the make.fun GTA 6 bounty (gta6-01).
window.SB = window.SB || {};

(function () {
  'use strict';

  window.__SB_ERRORS = [];
  window.addEventListener('error', function (e) {
    window.__SB_ERRORS.push(String(e.message || e.error));
    document.title = 'SB_ERROR: ' + String(e.message || e.error).slice(0, 120);
  });
  window.addEventListener('unhandledrejection', function (e) {
    window.__SB_ERRORS.push('rejection: ' + String(e.reason));
  });

  var params = new URLSearchParams(location.search);
  var shotMode = params.get('shot') || null;
  var seedParam = parseInt(params.get('seed') || '1337', 10) || 1337;

  // ---- renderer / scene ---------------------------------------------------
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  document.getElementById('game-container').appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2a65e);
  var camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 2600);

  // ---- shared game state ---------------------------------------------------
  var G = {
    scene: scene, camera: camera, renderer: renderer,
    keys: {}, mouseDown: false,
    time: 0, hour: SB.CONFIG.START_HOUR, timeFrozen: false,
    isNight: false, goldHour: 1,
    cash: SB.CONFIG.CASH_START, rep: 0,
    wanted: 0,
    started: false, paused: false, shopOpen: false, mapOpen: false,
    missionAggro: false,
    lastShotAt: -99, lastShotPos: null,
    cars: [], missionCar: null, missionVan: null,
    onPlayerDead: null, onAllMissionsDone: null,
    seed: seedParam,
  };
  window.SB_G = G;

  G.sky = SB.createSky(G);
  G.sky.setHour(G.hour);
  G.city = SB.createCity(G);
  G.sound = SB.createSound(G);
  SB.combat.init(G);
  G.player = SB.createPlayer(G);
  G.traffic = SB.createTraffic(G, 16);
  G.peds = SB.createPedestrians(G, 30);
  G.police = SB.createPolice(G);
  G.heli = SB.createHelicopter(G);
  G.missions = SB.createMissions(G);
  G.hud = SB.createHud(G);
  G.minimap = SB.createMinimap(G);
  G.save = SB.save;

  G.onPlayerDead = function () {
    G.hud.show('gameover', true);
    document.exitPointerLock && document.exitPointerLock();
  };
  G.onAllMissionsDone = function () {
    var v = document.getElementById('victory-stats');
    if (v) v.textContent = 'Cash $' + G.cash.toLocaleString() + '  •  Rep ' + G.rep + '  •  Time ' + Math.floor(G.time / 60) + 'm';
    G.hud.show('victory', true);
  };

  // ---- input ---------------------------------------------------------------
  var canvas = renderer.domElement;
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') e.preventDefault();
    G.keys[e.code] = true;
    if (!G.started) return;
    if (e.code === 'Escape') { togglePause(); }
    if (e.code === 'KeyM') { toggleMap(); }
    if (e.code === 'KeyE' || e.code === 'KeyF') {
      if (G.paused || G.shopOpen) return;
      var P = G.player.P;
      if (P.onFoot) {
        var near = G.player.nearestCar(4.5);
        if (near) G.player.enterCar(near);
        else G.missions.interact();
      } else {
        G.player.exitCar();
      }
    }
    if (e.code === 'KeyN') { var stn = G.sound.cycleStation(); G.hud.toast('RADIO: ' + stn); }
  });
  window.addEventListener('keyup', function (e) { G.keys[e.code] = false; });
  window.addEventListener('blur', function () { G.keys = {}; G.mouseDown = false; });

  var dragging = false, lastMX = 0, lastMY = 0;
  canvas.addEventListener('mousedown', function (e) {
    if (!G.started || G.paused || G.shopOpen || G.mapOpen) return;
    G.mouseDown = true;
    if (G.player.P.onFoot) {
      lockPointer();
    }
    dragging = true; lastMX = e.clientX; lastMY = e.clientY;
  });
  window.addEventListener('mouseup', function () { G.mouseDown = false; dragging = false; });
  window.addEventListener('mousemove', function (e) {
    var P = G.player.P;
    if (document.pointerLockElement === canvas) {
      P.yaw -= e.movementX * 0.0024;
      P.pitch = SB.clamp(P.pitch - e.movementY * 0.002, -0.4, 1.1);
    } else if (dragging && G.started && !G.paused) {
      P.yaw -= (e.clientX - lastMX) * 0.005;
      P.pitch = SB.clamp(P.pitch - (e.clientY - lastMY) * 0.003, -0.4, 1.1);
      lastMX = e.clientX; lastMY = e.clientY;
    }
  });
  document.addEventListener('pointerlockchange', function () {
    if (document.pointerLockElement !== canvas && G.started && !G.paused && !G.shopOpen && !G.mapOpen && !G.player.P.dead) {
      setPaused(true);
    }
  });

  // ---- overlays / buttons ----------------------------------------------------
  function bind(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', function () { if (G.sound) G.sound.uiClick(); fn(); });
  }
  function setPaused(on) {
    if (!G.started) return;
    G.paused = on;
    G.hud.show('pauseMenu', on);
    if (!on) { G.hud.closeShop(); G.hud.show('mapOverlay', false); G.mapOpen = false; }
  }
  function togglePause() {
    if (G.shopOpen) { G.hud.closeShop(); return; }
    if (G.mapOpen) { toggleMap(); return; }
    setPaused(!G.paused);
  }
  function toggleMap() {
    if (!G.started) return;
    G.mapOpen = !G.mapOpen;
    G.hud.show('mapOverlay', G.mapOpen);
    if (G.mapOpen) drawBigMap();
  }

  // ---- pointer-lock helper (a rejected promise must never leak to console)
  function lockPointer() {
    try {
      var p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(function () {});
    } catch (err) {}
  }

  function startGame(fromSave) {
    if (fromSave) {
      var data = SB.save.load();
      if (data) SB.save.applySave(G, data);
    }
    G.started = true; G.paused = false;
    G.hud.hideStart();
    if (G.sound) { G.sound.unlock(); G.sound.engineStart(); }
    if (!shotMode) G.missions.startMission(G.missions.M.index);
    lockPointer();
  }

  bind('btn-new', function () { SB.save.clear(); startGame(false); });
  bind('btn-continue', function () { startGame(true); });
  bind('btn-controls', function () { G.hud.show('controlsOverlay', true); });
  bind('btn-controls-close', function () { G.hud.show('controlsOverlay', false); });
  bind('btn-resume', function () { setPaused(false); });
  bind('btn-save', function () { SB.save.save(G); G.hud.toast('Progress saved'); });
  bind('btn-load', function () {
    var d = SB.save.load();
    if (d) { SB.save.applySave(G, d); G.hud.toast('Save loaded'); } else G.hud.toast('No save found');
  });
  bind('btn-restart', function () {
    G.player.resetToStart();
    G.missions.M.index = 0; G.missions.M.active = false; G.missions.M.done = false;
    G.cash = SB.CONFIG.CASH_START; G.rep = 0; G.wanted = 0;
    setPaused(false);
    G.missions.startMission(0);
  });
  bind('btn-quit', function () { location.reload(); });
  bind('btn-map-close', function () { toggleMap(); });
  bind('btn-retry', function () {
    G.hud.show('gameover', false);
    G.player.resetToStart();
    G.missions.startMission(G.missions.M.index);
  });
  bind('btn-victory-roam', function () { G.hud.show('victory', false); });
  bind('btn-victory-restart', function () { location.reload(); });
  bind('btn-music', function () { var stn = G.sound.cycleStation(); G.hud.toast('RADIO: ' + stn); });
  bind('btn-mute', function () {
    var m = G.sound.toggleMute();
    document.getElementById('btn-mute').textContent = m ? '🔇' : '🔊';
  });

  // ---- big map ---------------------------------------------------------------
  function drawBigMap() {
    var cv = document.getElementById('map-canvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var S = cv.width, HALF = SB.CONFIG.WORLD_HALF;
    function mp(x, z) { return [(x + HALF) / (HALF * 2) * S, (z + HALF) / (HALF * 2) * S]; }
    ctx.fillStyle = '#10151c'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#1d6f8e'; var oc = mp(-600, 0); ctx.fillRect(0, 0, oc[0], S);
    ctx.strokeStyle = '#5a5f66'; ctx.lineWidth = 5;
    SB.CONFIG.ROAD_COORDS.forEach(function (c) {
      var a = mp(c, -HALF), b = mp(c, HALF);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      var c2 = mp(-HALF, c), d2 = mp(HALF, c);
      ctx.beginPath(); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.stroke();
    });
    ctx.font = 'bold 15px Arial'; ctx.textAlign = 'left';
    SB.CONFIG.DISTRICTS.forEach(function (d) {
      if (d.id === 'midtown') return;
      var p = mp(d.minX + 12, d.minZ + 26);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(d.name.toUpperCase(), p[0], p[1]);
    });
    ctx.font = 'bold 13px Arial';
    Object.keys(SB.CONFIG.MARKERS).forEach(function (k) {
      var mk = SB.CONFIG.MARKERS[k];
      var p = mp(mk.x, mk.z);
      ctx.fillStyle = '#9dff8a';
      ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(mk.label, p[0] + 10, p[1] + 4);
    });
    var M = G.missions.M;
    if (M.target) {
      var tp = mp(M.target.x, M.target.z);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(tp[0], tp[1], 9, 0, Math.PI * 2); ctx.fill();
    }
    var P = G.player.P;
    var pp = mp(P.pos.x, P.pos.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pp[0], pp[1], 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pp[0], pp[1], 7, 0, Math.PI * 2); ctx.stroke();
  }

  // ---- screenshot presets (?shot=1..4) ---------------------------------------
  function applyShot(n) {
    G.timeFrozen = true;
    if (n === 4) return; // start screen
    startGame(false);
    G.hud.hideStart();
    G.hud.clearSay();
    G._shotT0 = G.time;
    if (n === 1) {
      // golden-hour police chase on Miramar Strip
      G.hour = 17.4; G.sky.setHour(17.4);
      var car = SB.createCar(G, 'veloce', -540, 40, Math.PI, 0xd21f3c);
      car.driver = 'player'; G.cars.push(car);
      G.player.enterCar(car);
      car.vel.set(0, 0, -30);
      G.police.setWanted(3, true);
      G._shotCruisers = [];
      for (var i = 0; i < 2; i++) {
        var pc = SB.createCar(G, 'cruiser', -540 + (i === 0 ? 6 : -6), -30 - i * 22, Math.PI, 0xf2f2f2);
        pc.driver = 'police'; G.cars.push(pc);
        var entry = { car: pc, stuckT: 0, lastX: pc.mesh.position.x, lastZ: pc.mesh.position.z, ramCd: 0 };
        G.police.cruisers.push(entry);
        G._shotCruisers.push(entry);
      }
      G.missions.M.objectiveOverride = 'Escape the Paloma PD — reach the Safe House';
      G.missions.M.target = { x: -420, z: -420 };
    } else if (n === 2) {
      // on-foot combat at the Docks, mission 2 live
      G.hour = 17.0; G.sky.setHour(17.0);
      G.player.P.pos.set(462, 0, 390);
      // face the syndicate guards + beacon at (480, 420)
      G.player.P.yaw = Math.atan2(-(480 - 462), -(420 - 390));
      G.missions.startMission(1);
    } else if (n === 3) {
      // bright daylight downtown drive
      G.hour = 12.0; G.sky.setHour(12.0);
      var sedan = SB.createCar(G, 'sedan', 60, 120, Math.PI, 0x3a6ea5);
      sedan.driver = 'player'; G.cars.push(sedan);
      G.player.enterCar(sedan);
      sedan.vel.set(0, 0, -16);
      // parked cars along the boulevard read as street life (no timing risk)
      [[66.5, -40, 'veloce', 0xc9a227], [53.5, -90, 'sedan', 0x5a5a5e], [66.5, -140, 'sedan', 0x2e7d5b]].forEach(function (sp) {
        var parked = SB.createCar(G, sp[2], sp[0], sp[1], Math.PI, sp[3]);
        parked.driver = 'none'; G.cars.push(parked);
      });
      // pedestrians on the sidewalks ahead of the car
      [[69.5, -20], [50.5, -60], [69.5, -100], [50.5, -140]].forEach(function (sp, idx) {
        var p = G.peds.peds[idx];
        if (!p) return;
        p.x = sp[0]; p.z = sp[1]; p.alongRoad = 'v'; p.road = 60;
        p.mesh.position.set(sp[0], 0, sp[1]);
      });
      G.missions.M.objectiveOverride = 'Free roam — explore Paloma Del Sol';
    }
  }

  // ---- main loop ---------------------------------------------------------------
  var clock = new THREE.Clock();
  var camOrbit = 0;
  var readyFlagged = false;

  function step(dt) {
    G.time += dt;
    G.sky.update(dt);
    G.city.update(dt);
    // Screenshot presets: shot 1 holds the throttle (full chase speed);
    // shot 3 gets a short burst then coasts so the frame stays downtown.
    if (shotMode === '1' && G.player.P.car) G.keys['KeyW'] = true;
    if (shotMode === '3' && G.player.P.car) G.keys['KeyW'] = (G.time - (G._shotT0 || 0) < 1.4);
    if (G.started && !G.paused) {
      G.player.update(dt);
      G.traffic.update(dt);
      G.peds.update(dt);
      G.police.update(dt);
      G.heli.update(dt);
      SB.updateSkids(G, dt);
      // Shot 1: keep the two chase cruisers framed ahead of the player car
      // (the police AI still flashes their lightbars; we only fix their frame).
      if (shotMode === '1' && G._shotCruisers && G.player.P.car) {
        var pc = G.player.P.car;
        var fx = Math.sin(pc.heading), fz = Math.cos(pc.heading);
        var rx = Math.cos(pc.heading), rz = -Math.sin(pc.heading);
        G._shotCruisers.forEach(function (c, i) {
          var side = i === 0 ? 9 : -9;
          c.car.mesh.position.set(pc.mesh.position.x + fx * 32 + rx * side, 0, pc.mesh.position.z + fz * 32 + rz * side);
          c.car.heading = pc.heading;
        });
      }
      G.missions.update(dt);
      SB.combat.updateEnemies(G, dt);
      G.hud.update(dt);
      G.minimap.draw();
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!G.started) {
      // cinematic flyover behind the start screen
      camOrbit += dt * 0.045;
      camera.position.set(Math.cos(camOrbit) * 520, 190 + Math.sin(camOrbit * 0.6) * 40, Math.sin(camOrbit) * 520);
      camera.lookAt(0, 20, 0);
      G.sky.update(dt);
      G.city.update(dt);
      G.traffic.update(dt);
      G.peds.update(dt);
    } else {
      step(dt);
    }
    renderer.render(scene, camera);
    if (selftest && !selftestDone) {
      selftestFrames++;
      if (selftestFrames >= 10) { selftestDone = true; runSelftest(); }
    }
    if (shotMode && !readyFlagged) {
      readyFlagged = true;
      window.__SB_READY = true;
      document.title = 'SB_READY';
    }
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- automated self-test (?selftest=1) -----------------------------------
  // Exercises mission 1 end-to-end, mission 2 combat, wanted spawning and
  // save/load headlessly; reports via document.title. Never runs in normal play.
  var selftest = new URLSearchParams(location.search).get('selftest') === '1';
  var selftestDone = false, selftestFrames = 0;
  function runSelftest() {
    console.log('[SELFTEST] start');
    var res = [];
    function check(name, ok) { res.push((ok ? 'PASS' : 'FAIL') + ':' + name); }
    try {
      startGame(false);
      check('m1-started', G.missions.M.active && G.missions.M.index === 0);
      check('m1-car-spawned', !!G.missionCar);
      G.player.enterCar(G.missionCar);
      for (var i = 0; i < 90; i++) step(1 / 60);
      check('m1-stage1-deliver', G.missions.M.stage === 1 && /Deliver/.test(G.missions.M.objective));
      // drive the GT to Elena's garage marker
      var car = G.player.P.car;
      car.mesh.position.set(-480, 0, 300);
      G.player.P.pos.set(-480, 0, 300);
      for (var j = 0; j < 30; j++) step(1 / 60);
      check('m1-complete', G.missions.M.index === 1 && G.cash === SB.CONFIG.CASH_START + SB.CONFIG.MISSIONS[0].reward);
      // mission 2: guards spawn, shooting works, kills advance the mission
      G.missions.startMission(1);
      check('m2-guards-4', G.missions.M.guards.length === 4);
      G.player.exitCar();
      var P = G.player.P;
      var ammo0 = P.magAmmo;
      SB.combat.playerShoot(G);
      check('shoot-decrements-ammo', P.magAmmo === ammo0 - 1);
      G.missions.M.guards.slice().forEach(function (e) { SB.combat.killEnemy(G, e); });
      for (var k = 0; k < 30; k++) step(1 / 60);
      check('m2-stage1-cargo', G.missions.M.stage === 1);
      P.pos.set(480, 0, 420);
      for (var m = 0; m < 30; m++) step(1 / 60);
      check('m2-complete', G.missions.M.index === 2);
      // wanted system spawns cruisers
      G.police.setWanted(2, true);
      for (var n = 0; n < 240; n++) step(1 / 60);
      check('wanted-2-cruisers', G.wanted === 2 && G.police.cruisers.length >= 1);
      // save / load round-trip
      G.cash = 12345;
      check('save-ok', G.save.save(G) === true);
      var loaded = G.save.load();
      check('load-cash', !!loaded && loaded.cash === 12345);
      loaded.cash = 777;
      G.save.applySave(G, loaded);
      check('apply-save', G.cash === 777);
      // mission 3: lure the patrols east, then lose the heat
      G.missions.startMission(2);
      check('m3-started', G.missions.M.active && G.missions.M.index === 2 && G.wanted === 2);
      P.pos.set(420, 0, -420);
      for (var a = 0; a < 30; a++) step(1 / 60);
      check('m3-stage1-lured', G.missions.M.stage === 1);
      G.police.setWanted(0, false);
      for (var b = 0; b < 30; b++) step(1 / 60);
      check('m3-complete', G.missions.M.index === 3);
      // mission 4: disable the armored van by shooting it, then grab the case
      G.missions.startMission(3);
      check('m4-van-spawned', !!G.missionVan && G.missionVan.hp === 300);
      var van = G.missionVan;
      // The van patrols the z=60 boulevard in a straight line: stand on that
      // road behind it and shoot down the line, so its speed cannot dodge
      // the aim (only a traffic car between us can absorb a shot, and it
      // wrecks after 3 hits, so the loop keeps going).
      P.pos.set(van.mesh.position.x - 25, 0, 60);
      P.yaw = -Math.PI / 2; // face east, down the boulevard
      step(0.5); // snap the camera behind the player (k=1 at big dt)
      var shots = 0;
      while (!G.missionVan.wrecked && !G.missions.M.vanDisabled && shots < 20) {
        // keep closing the distance: the van outruns the pistol's 110m
        // range in ~4s, so reposition to 25m behind it every shot
        P.pos.set(van.mesh.position.x - 25, 0, 60);
        var dirx = van.mesh.position.x - P.pos.x;
        P.yaw = dirx >= 0 ? -Math.PI / 2 : Math.PI / 2; // stay on the road line
        step(0.15); // camera snap to the new facing
        // the harness drives step() directly without rendering, so the
        // scene matrices are stale — refresh them or the raycast tests
        // the van at its spawn position instead of where it drove to
        G.scene.updateMatrixWorld(true);
        SB.combat.playerShoot(G);
        shots++;
        for (var d2 = 0; d2 < 20; d2++) step(1 / 60);
      }
      check('m4-van-disabled', G.missions.M.vanDisabled || G.missionVan.wrecked);
      check('m4-case-spawned', G.missions.M.caseSpawned === true);
      P.pos.set(van.mesh.position.x, 0, van.mesh.position.z);
      for (var e2 = 0; e2 < 30; e2++) step(1 / 60);
      check('m4-complete', G.missions.M.index === 4);
      // mission 5: vault infiltration, 8 guards, 4-star getaway
      G.missions.startMission(4);
      check('m5-started', G.missions.M.active && G.missions.M.index === 4);
      P.pos.set(60, 0, -60);
      for (var f = 0; f < 30; f++) step(1 / 60);
      check('m5-stage1-guards-8', G.missions.M.stage === 1 && G.missions.M.guards.length === 8);
      G.missions.M.guards.slice().forEach(function (en) { SB.combat.killEnemy(G, en); });
      for (var g2 = 0; g2 < 30; g2++) step(1 / 60);
      check('m5-stage2-getaway', G.missions.M.stage === 2 && G.wanted === 4);
      check('m5-heli-active', !!G.heli && G.heli.active);
      P.pos.set(-420, 0, -420);
      for (var h2 = 0; h2 < 30; h2++) step(1 / 60);
      check('m5-complete', G.missions.M.done === true && G.missions.M.index === 5);
      // armory: buy the SMG through the real shop DOM
      G.cash = 5000;
      G.hud.openShop();
      var buyBtn = document.querySelector('#shop-items button[data-buy="smg"]');
      check('armory-shop-open', !!buyBtn);
      if (buyBtn) buyBtn.click();
      check('armory-smg-bought', !!(P.weapons.smg && P.weapons.smg.owned) && G.cash === 5000 - 1200);
      G.hud.closeShop();
      // spray garage: respray clears heat for $200
      if (P.car) G.player.exitCar();
      G.police.setWanted(2, true);
      G.cash = 5000;
      P.pos.set(180, 0, 300);
      G.missions.interact();
      check('spray-clears-heat', G.wanted === 0 && G.cash === 5000 - 200);
      // safe house: saving on the spot writes a real save
      P.pos.set(-420, 0, -420);
      G.missions.interact();
      var sv = G.save.load();
      check('safehouse-saves', !!sv && sv.cash === G.cash);
    } catch (err) {
      res.push('FAIL:exception:' + (err && err.message ? err.message : err));
    }
    window.__SB_SELFTEST = res;
    document.title = 'SELFTEST ' + res.join(' | ');
    console.log('[SELFTEST] ' + res.join(' | '));
    var div = document.createElement('div');
    div.id = 'selftest-results';
    div.textContent = 'SELFTEST ' + res.join(' | ');
    document.body.appendChild(div);
  }

  // ---- boot --------------------------------------------------------------------
  G.hud.showStart(SB.save.has());
  if (shotMode) {
    var sn = parseInt(shotMode, 10) || 4;
    applyShot(sn);
    // settle the simulation with fixed steps so screenshots are stable
    for (var i = 0; i < 150; i++) step(1 / 60);
  }
  frame();
})();
