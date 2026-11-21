// Solaris Bay — ambient traffic: cars that follow the road graph, stop for
// obstacles, despawn far away and respawn near the player.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createTraffic(G, count) {
    var graph = G.city.roadGraph;
    var cars = [];
    var colors = [0x3a6ea5, 0xc9a227, 0x5a5a5e, 0x7a3a5c, 0x2e7d5b, 0xb0b0b0, 0xd21f3c];
    var rng = SB.mulberry32(4242);

    function randomEdgeNear(x, z, maxD) {
      for (var tries = 0; tries < 30; tries++) {
        var e = graph.edges[Math.floor(rng() * graph.edges.length)];
        var mx = (e.ax + e.bx) / 2, mz = (e.az + e.bz) / 2;
        if (SB.dist2D(x, z, mx, mz) < maxD) return e;
      }
      return graph.edges[Math.floor(rng() * graph.edges.length)];
    }

    function spawnCar(x, z) {
      var e = randomEdgeNear(x, z, 320);
      var type = rng() < 0.7 ? 'sedan' : 'veloce';
      var car = SB.createCar(G, type, e.ax, e.az, 0, colors[Math.floor(rng() * colors.length)]);
      car.driver = 'traffic';
      var t = {
        car: car,
        edge: e,
        prog: 0,
        speed: 9 + rng() * 5,
        cruise: 10 + rng() * 4,
        waitAt: 0,
      };
      var dx = e.bx - e.ax, dz = e.bz - e.az;
      car.heading = Math.atan2(dx, dz);
      car.mesh.position.set(e.ax, 0, e.az);
      G.cars.push(car);
      cars.push(t);
      return t;
    }

    function nextEdge(t, node) {
      var outs = graph.edges.filter(function (e) {
        return (e.ax === node.x && e.az === node.z);
      });
      if (!outs.length) return null;
      // avoid immediate U-turn unless no choice
      var choices = outs.filter(function (e) { return !(e.bx === t.edge.ax && e.bz === t.edge.az); });
      var pick = (choices.length ? choices : outs)[Math.floor(rng() * (choices.length ? choices.length : outs.length))];
      return pick;
    }

    function obstacleAhead(t, dist) {
      var car = t.car;
      var fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      var px = car.mesh.position.x, pz = car.mesh.position.z;
      var all = G.cars;
      for (var i = 0; i < all.length; i++) {
        var o = all[i];
        if (o === car || o.wrecked) continue;
        var dx = o.mesh.position.x - px, dz = o.mesh.position.z - pz;
        var along = dx * fx + dz * fz;
        var side = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < dist && side < 3.2) return true;
      }
      var pl = G.player.P;
      if (pl.onFoot) {
        var pdx = pl.pos.x - px, pdz = pl.pos.z - pz;
        var pa = pdx * fx + pdz * fz, ps = Math.abs(pdx * fz - pdz * fx);
        if (pa > 0 && pa < dist && ps < 3) return true;
      }
      return false;
    }

    for (var i = 0; i < count; i++) spawnCar(G.player.P.pos.x, G.player.P.pos.z);

    function ejectDriver(car) {
      // a hijacked traffic car loses its driver: remove from traffic list
      for (var i = 0; i < cars.length; i++) {
        if (cars[i].car === car) {
          cars.splice(i, 1);
          spawnCar(G.player.P.pos.x, G.player.P.pos.z);
          return;
        }
      }
    }

    function update(dt) {
      var px = G.player.P.pos.x, pz = G.player.P.pos.z;
      for (var i = cars.length - 1; i >= 0; i--) {
        var t = cars[i];
        var car = t.car;
        if (car.wrecked) {
          // respawn elsewhere after a while
          if (Math.random() < dt * 0.05) {
            G.scene.remove(car.mesh);
            var gi = G.cars.indexOf(car); if (gi >= 0) G.cars.splice(gi, 1);
            cars.splice(i, 1);
            spawnCar(px, pz);
          }
          continue;
        }
        var edgeLen = Math.hypot(t.edge.bx - t.edge.ax, t.edge.bz - t.edge.az);
        var want = obstacleAhead(t, 16) ? 0 : t.cruise;
        t.speed += SB.clamp(want - t.speed, -14 * dt, 8 * dt);
        var step = t.speed * dt;
        t.prog += step;
        if (t.prog >= edgeLen) {
          var node = { x: t.edge.bx, z: t.edge.bz };
          var ne = nextEdge(t, node);
          if (!ne) { t.prog = edgeLen; continue; }
          t.edge = ne; t.prog = 0;
          var dx = ne.bx - ne.ax, dz = ne.bz - ne.az;
          car.heading = Math.atan2(dx, dz);
        }
        var tt = t.prog / edgeLen;
        car.mesh.position.x = t.edge.ax + (t.edge.bx - t.edge.ax) * tt;
        car.mesh.position.z = t.edge.az + (t.edge.bz - t.edge.az) * tt;
        car.mesh.rotation.y = car.heading;
        car.speed = t.speed;
        // recycle far-away cars near the player
        if (SB.dist2D(px, pz, car.mesh.position.x, car.mesh.position.z) > 520) {
          G.scene.remove(car.mesh);
          var gi2 = G.cars.indexOf(car); if (gi2 >= 0) G.cars.splice(gi2, 1);
          cars.splice(i, 1);
          spawnCar(px, pz);
        }
      }
    }

    return { cars: cars, update: update, ejectDriver: ejectDriver, spawnCar: spawnCar };
  }

  SB.createTraffic = createTraffic;
})();
