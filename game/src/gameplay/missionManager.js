// Solaris Bay — 5-mission story, beacons, dialogue, free-roam Armory /
// Spray Garage / Safe House interactions, rewards and mission failure.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createMissions(G) {
    var M = {
      index: 0, stage: 0, active: false, done: false,
      timer: 0, objective: '', target: null,
      killsNeeded: 0, killsDone: 0, guards: [],
      vanDisabled: false, caseSpawned: false,
    };
    G.mission = M;

    // beacon: glowing column + floating marker at the current target
    var beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    var beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 42, 12, 1, true), beaconMat);
    beacon.visible = false;
    G.scene.add(beacon);
    var bob = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffd76a })
    );
    bob.visible = false;
    G.scene.add(bob);

    function setTarget(x, z, text) {
      M.target = { x: x, z: z };
      M.objective = text;
      beacon.visible = true; bob.visible = true;
      beacon.position.set(x, 21, z);
      bob.position.set(x, 9, z);
    }
    function clearTarget() {
      M.target = null; beacon.visible = false; bob.visible = false;
    }

    function say(lines) {
      if (G.hud) G.hud.say(lines);
    }

    function completeMission() {
      var def = SB.CONFIG.MISSIONS[M.index];
      G.cash += def.reward;
      G.rep += 100;
      if (G.sound) { G.sound.missionOk(); G.sound.cash(); }
      if (G.hud) G.hud.toast('MISSION COMPLETE: ' + def.name + '  +$' + def.reward.toLocaleString());
      clearTarget();
      M.index++;
      M.stage = 0; M.active = false;
      M.guards = [];
      if (M.index >= SB.CONFIG.MISSIONS.length) {
        M.done = true;
        if (G.onAllMissionsDone) G.onAllMissionsDone();
      } else {
        setTimeout(function () { startMission(M.index); }, 2500);
      }
    }

    function failMission(reason) {
      if (G.hud) G.hud.toast('MISSION FAILED: ' + reason + ' — retrying');
      if (G.sound) G.sound.enemyShot();
      clearTarget();
      M.stage = 0;
      // clean up spawned mission actors
      M.guards.forEach(function (e) { if (e.alive) { e.alive = false; G.scene.remove(e.mesh); } });
      M.guards = [];
      if (G.missionVan) { G.scene.remove(G.missionVan.mesh); var gi = G.cars.indexOf(G.missionVan); if (gi >= 0) G.cars.splice(gi, 1); G.missionVan = null; }
      if (G.missionCar) { G.scene.remove(G.missionCar.mesh); var gi2 = G.cars.indexOf(G.missionCar); if (gi2 >= 0) G.cars.splice(gi2, 1); G.missionCar = null; }
      setTimeout(function () { startMission(M.index); }, 2000);
    }

    function spawnGuards(list) {
      M.guards = list.map(function (p) { return SB.combat.createEnemy(G, p[0], p[1], 'guard'); });
      M.killsNeeded = M.guards.length; M.killsDone = 0;
      G.missionAggro = true;
    }

    function startMission(i) {
      var def = SB.CONFIG.MISSIONS[i];
      if (!def || M.done) return;
      M.index = i; M.stage = 0; M.active = true;
      M.objectiveOverride = null;
      say(def.brief);
      if (i === 0) {
        var car = SB.createCar(G, 'veloce', 30, 30, Math.PI * 0.75, 0xd21f3c);
        car.driver = 'none';
        G.cars.push(car);
        G.missionCar = car;
        setTarget(30, 30, 'Steal the Veloce GT at Downtown Plaza');
      } else if (i === 1) {
        spawnGuards([[462, 402], [498, 402], [462, 438], [498, 438]]);
        setTarget(480, 420, 'Eliminate the syndicate guards (0/4)');
      } else if (i === 2) {
        G.police.setWanted(2, true);
        setTarget(420, -420, 'Lure the patrols east — reach the marker');
      } else if (i === 3) {
        var van = SB.createCar(G, 'van', -540, 60, Math.PI / 2, 0x8a8f98);
        van.driver = 'mission';
        van.hp = 300; van.maxHp = 300;
        G.cars.push(van);
        G.missionVan = van;
        M.vanDisabled = false; M.caseSpawned = false;
        setTarget(-540, 60, 'Chase down the armored van on the boulevard');
      } else if (i === 4) {
        setTarget(60, -60, 'Infiltrate the Paloma Vault');
      }
      if (G.hud) G.hud.toast('NEW MISSION: ' + def.name + ' — ' + def.giver);
    }

    function nearMarker(key, dist) {
      var mk = SB.CONFIG.MARKERS[key];
      var P = G.player.P;
      return SB.dist2D(P.pos.x, P.pos.z, mk.x, mk.z) < (dist || 9);
    }

    function interact() {
      var P = G.player.P;
      if (!P.onFoot) return;
      if (nearMarker('armory')) { if (G.hud) G.hud.openShop(); return; }
      if (nearMarker('spray')) {
        if (G.cash >= SB.CONFIG.PRICES.spray) {
          G.cash -= SB.CONFIG.PRICES.spray;
          G.police.setWanted(0, false);
          if (P.car) P.car.mesh.children[0].material.color.setHex(Math.floor(Math.random() * 0xffffff));
          if (G.hud) G.hud.toast('Respray done — heat cleared (-$200)');
          if (G.sound) G.sound.cash();
        } else if (G.hud) G.hud.toast('Need $200 for a respray');
        return;
      }
      if (nearMarker('safehouse')) {
        SB.save.save(G);
        if (G.hud) G.hud.toast('Progress saved at the Safe House');
        if (G.sound) G.sound.pickup();
        return;
      }
    }

    function update(dt) {
      if (!M.active || M.done || !G.started || G.paused) return;
      var P = G.player.P;
      // beacon bob
      if (bob.visible) { bob.position.y = 9 + Math.sin(G.time * 2.4) * 0.7; bob.rotation.y += dt * 1.5; }
      // dynamic beacon follows the van / mission car
      if (M.index === 0 && M.stage === 0 && G.missionCar && !P.car) {
        beacon.position.set(G.missionCar.mesh.position.x, 21, G.missionCar.mesh.position.z);
        bob.position.set(G.missionCar.mesh.position.x, 9, G.missionCar.mesh.position.z);
      }
      if (M.index === 3 && M.stage === 0 && G.missionVan) {
        beacon.position.set(G.missionVan.mesh.position.x, 21, G.missionVan.mesh.position.z);
        bob.position.set(G.missionVan.mesh.position.x, 9, G.missionVan.mesh.position.z);
      }
      if (M.index === 0) {
        if (M.stage === 0) {
          if (P.car === G.missionCar) {
            M.stage = 1; M.timer = 150;
            setTarget(-480, 300, "Deliver the Veloce GT to Elena's Garage — 150s");
            say(['Elena: "That\'s my car. Now drive — the garage is on the Strip. Don\'t scratch it."']);
          }
        } else if (M.stage === 1) {
          M.timer -= dt;
          M.objective = "Deliver the Veloce GT to Elena's Garage — " + Math.max(0, Math.ceil(M.timer)) + 's';
          if (P.car === G.missionCar && SB.dist2D(P.pos.x, P.pos.z, -480, 300) < 11) { completeMission(); return; }
          if (M.timer <= 0) { failMission('Out of time'); return; }
          if (!P.car || P.car !== G.missionCar) { failMission('Lost the Veloce GT'); return; }
        }
      } else if (M.index === 1) {
        if (M.stage === 0) {
          M.killsDone = M.guards.filter(function (e) { return !e.alive; }).length;
          M.objective = 'Eliminate the syndicate guards (' + M.killsDone + '/' + M.killsNeeded + ')';
          if (M.killsDone >= M.killsNeeded) {
            M.stage = 1;
            setTarget(480, 420, 'Secure the cargo container');
            say(['Victor: "Guards are down. Get to the container and secure it."']);
          }
        } else if (M.stage === 1) {
          if (SB.dist2D(P.pos.x, P.pos.z, 480, 420) < 8) { completeMission(); return; }
        }
      } else if (M.index === 2) {
        if (M.stage === 0) {
          if (SB.dist2D(P.pos.x, P.pos.z, 420, -420) < 11) {
            M.stage = 1;
            setTarget(420, -420, 'Lose the heat — stay out of sight');
            say(['Elena: "Good, they followed you. Now vanish. No cops on your tail."']);
          }
        } else if (M.stage === 1) {
          if (G.wanted === 0) { completeMission(); return; }
        }
      } else if (M.index === 3) {
        if (M.stage === 0) {
          var van = G.missionVan;
          if (!van) return;
          // van patrols the boulevard (z=60) back and forth
          var targetX = van._loopDir === -1 ? -540 : 540;
          var desired = Math.atan2(targetX - van.mesh.position.x, 60 - van.mesh.position.z);
          var diff = desired - van.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          var input = { throttle: 0.75, steer: SB.clamp(diff * 1.6, -1, 1), handbrake: false };
          SB.stepCar(G, van, input, dt);
          if (Math.abs(van.mesh.position.x - targetX) < 14) van._loopDir = (van._loopDir || 1) * -1;
          M.objective = 'Disable the armored van — HP ' + Math.max(0, Math.round(van.hp));
          if (van.wrecked || M.vanDisabled) {
            M.stage = 1;
            M.vanDisabled = true;
            if (!M.caseSpawned) {
              SB.combat.spawnPickup(G, van.mesh.position.x + 3, van.mesh.position.z + 3, 'cash');
              M.caseSpawned = true;
            }
            setTarget(van.mesh.position.x, van.mesh.position.z, 'Grab the cash case');
            say(['Victor: "It\'s stopped! Grab the case before the cops roll in."']);
          }
        } else if (M.stage === 1) {
          var van2 = G.missionVan;
          if (van2 && SB.dist2D(P.pos.x, P.pos.z, van2.mesh.position.x, van2.mesh.position.z) < 5) {
            G.cash += 500;
            completeMission(); return;
          }
        }
      } else if (M.index === 4) {
        if (M.stage === 0) {
          if (SB.dist2D(P.pos.x, P.pos.z, 60, -60) < 9) {
            M.stage = 1;
            spawnGuards([[40, -80], [80, -80], [40, -40], [80, -40], [60, -100], [30, -60], [90, -60], [60, -20]]);
            setTarget(60, -60, 'Clear the vault guards (0/8)');
            say(['Elena: "Inside. Eight guards between you and the vault. Make it loud."']);
          }
        } else if (M.stage === 1) {
          M.killsDone = M.guards.filter(function (e) { return !e.alive; }).length;
          M.objective = 'Clear the vault guards (' + M.killsDone + '/' + M.killsNeeded + ')';
          if (M.killsDone >= M.killsNeeded) {
            M.stage = 2;
            G.police.setWanted(4, true);
            setTarget(-420, -420, 'Getaway — reach the Safe House with 4 stars');
            say(['Elena: "Vault\'s open! Four stars and counting — get to the Safe House, Mateo!"']);
          }
        } else if (M.stage === 2) {
          if (SB.dist2D(P.pos.x, P.pos.z, -420, -420) < 10) { completeMission(); return; }
        }
      }
    }

    return {
      M: M, update: update, startMission: startMission,
      interact: interact, nearMarker: nearMarker, completeMission: completeMission,
    };
  }

  SB.createMissions = createMissions;
})();
