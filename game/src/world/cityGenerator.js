// Solaris Bay — builds the whole city: roads, districts, buildings, beach,
// ocean, palms, containers, props, colliders and the traffic road graph.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createCity(G) {
    var scene = G.scene;
    var CFG = SB.CONFIG;
    var rng = SB.mulberry32(1337);
    var colliders = [];
    var streetlights = [];
    var group = new THREE.Group();
    scene.add(group);

    function box(w, h, d, mat, x, y, z, ry) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (ry) m.rotation.y = ry;
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      return m;
    }
    function addCollider(x, z, hw, hd) {
      colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
    }

    // ---- ground, ocean, beach -------------------------------------------
    var groundMat = new THREE.MeshStandardMaterial({ color: 0x8f8f88, roughness: 1 });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(1240, 1240), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
    ground.receiveShadow = true; group.add(ground);

    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 1440),
      new THREE.MeshStandardMaterial({ map: SB.textures.water(), roughness: 0.35, metalness: 0.1 })
    );
    water.rotation.x = -Math.PI / 2; water.position.set(-950, -0.6, 0);
    group.add(water);

    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 1240),
      new THREE.MeshStandardMaterial({ map: SB.textures.sand(), roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2; sand.position.set(-578, 0.0, 0);
    sand.receiveShadow = true; group.add(sand);

    // ---- roads ------------------------------------------------------------
    // One texture per orientation so the grain runs along the road, not across it.
    var asphaltV = new THREE.MeshStandardMaterial({ map: SB.textures.asphalt(), roughness: 0.95 });
    asphaltV.map.repeat.set(1, 80);
    var asphaltH = new THREE.MeshStandardMaterial({ map: SB.textures.asphalt(), roughness: 0.95 });
    asphaltH.map.repeat.set(80, 1);
    var roadGeoV = new THREE.PlaneGeometry(CFG.ROAD_WIDTH, 1200);
    var roadGeoH = new THREE.PlaneGeometry(1200, CFG.ROAD_WIDTH);
    CFG.ROAD_COORDS.forEach(function (c) {
      var v = new THREE.Mesh(roadGeoV, asphaltV);
      v.rotation.x = -Math.PI / 2; v.position.set(c, 0.02, 0); v.receiveShadow = true; group.add(v);
      var h = new THREE.Mesh(roadGeoH, asphaltH);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.02, c); h.receiveShadow = true; group.add(h);
    });

    // centre dashes (yellow) along every road
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xd8b13a });
    var dashGeo = new THREE.PlaneGeometry(0.5, 6);
    CFG.ROAD_COORDS.forEach(function (c) {
      for (var p = -570; p <= 570; p += 30) {
        var d1 = new THREE.Mesh(dashGeo, dashMat);
        d1.rotation.x = -Math.PI / 2; d1.position.set(c, 0.04, p); group.add(d1);
        var d2 = new THREE.Mesh(dashGeo, dashMat);
        d2.rotation.x = -Math.PI / 2; d2.rotation.z = Math.PI / 2; d2.position.set(p, 0.04, c); group.add(d2);
      }
    });

    // crosswalks at every intersection
    var crossTex = SB.textures.crosswalk();
    var crossMat = new THREE.MeshBasicMaterial({ map: crossTex, transparent: true, opacity: 0.85 });
    var crossGeo = new THREE.PlaneGeometry(13, 5);
    CFG.ROAD_COORDS.forEach(function (x) {
      CFG.ROAD_COORDS.forEach(function (z) {
        [[0, -9.5, 0], [0, 9.5, 0], [-9.5, 0, Math.PI / 2], [9.5, 0, Math.PI / 2]].forEach(function (o) {
          var cw = new THREE.Mesh(crossGeo, crossMat);
          cw.rotation.x = -Math.PI / 2; cw.rotation.z = o[2];
          cw.position.set(x + o[0], 0.05, z + o[1]);
          group.add(cw);
        });
      });
    });

    // ---- block bases (sidewalk slabs) -------------------------------------
    var walkMat = new THREE.MeshStandardMaterial({ map: SB.textures.sidewalk(), roughness: 1 });
    var coords = CFG.ROAD_COORDS;
    var blocks = [];
    for (var bi = 0; bi < coords.length - 1; bi++) {
      for (var bj = 0; bj < coords.length - 1; bj++) {
        var x0 = coords[bi] + 7, x1 = coords[bi + 1] - 7;
        var z0 = coords[bj] + 7, z1 = coords[bj + 1] - 7;
        var slab = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), walkMat);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
        slab.receiveShadow = true; group.add(slab);
        blocks.push({ x0: x0, x1: x1, z0: z0, z1: z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
      }
    }

    // ---- building materials ------------------------------------------------
    function facadeMat(base, style, lit) {
      return new THREE.MeshStandardMaterial({
        map: SB.textures.facade(base, style, lit),
        roughness: 0.85, metalness: 0.05,
        emissive: 0xffca7a, emissiveMap: SB.textures.facade(base, style, lit),
        emissiveIntensity: 0.22,
      });
    }
    var mats = {
      glass: facadeMat('#4a6b84', 'glass', 0.45),
      glass2: facadeMat('#5d7f9c', 'glass', 0.3),
      pastelPink: facadeMat('#e8a0a8', 'pastel', 0.5),
      pastelMint: facadeMat('#9fd4c0', 'pastel', 0.5),
      pastelCream: facadeMat('#f2ddb0', 'pastel', 0.45),
      pastelCoral: facadeMat('#e88a6d', 'pastel', 0.5),
      pastelLav: facadeMat('#b9a7e0', 'pastel', 0.5),
      pastelTeal: facadeMat('#7fc4c9', 'pastel', 0.5),
      warehouse: facadeMat('#7a6a58', 'warehouse', 0.25),
      villa: facadeMat('#e8dcc0', 'villa', 0.4),
      mid: facadeMat('#8a7f72', 'villa', 0.35),
      mid2: facadeMat('#6e7d8c', 'glass', 0.35),
    };
    var roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 1 });
    var neonTexts = [['PALOMA', '#ff5ce1'], ['HOTEL SOL', '#ffd21f'], ['CASINO', '#37f2c8'], ['SOLARIS', '#ff8a3c'], ['NEON BAY', '#7ad9ff'], ['EL MAR', '#ff5c7a']];
    var neonIdx = 0;

    function building(b, w, h, d, mat) {
      var m = box(w, h, d, mat, b.cx, h / 2, b.cz, 0);
      box(w + 1, 1.2, d + 1, roofMat, b.cx, h + 0.6, b.cz, 0);
      // rooftop clutter: AC units, water tower, antenna
      if (rng() < 0.55) box(3, 1.6, 3, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.9 }), b.cx - w / 4, h + 2, b.cz + d / 4, 0);
      if (rng() < 0.3) {
        var tw = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 }));
        tw.position.set(b.cx + w / 4, h + 3.4, b.cz - d / 4); tw.castShadow = true; group.add(tw);
        var tc = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 8), new THREE.MeshStandardMaterial({ color: 0x6e5238, roughness: 1 }));
        tc.position.set(b.cx + w / 4, h + 6, b.cz - d / 4); group.add(tc);
      }
      addCollider(b.cx, b.cz, w / 2 + 0.5, d / 2 + 0.5);
      return m;
    }

    function neonSign(x, y, z, ry) {
      var nt = neonTexts[neonIdx % neonTexts.length]; neonIdx++;
      var p = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 6.5),
        new THREE.MeshBasicMaterial({ map: SB.textures.neon(nt[0], nt[1]), transparent: true, side: THREE.DoubleSide })
      );
      p.position.set(x, y, z);
      p.rotation.y = ry;
      group.add(p);
      return p;
    }

    function awning(x, y, z, w, color) {
      var a = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 3),
        new THREE.MeshStandardMaterial({ map: SB.textures.awning(color, '#f5f0e0'), roughness: 0.9, side: THREE.DoubleSide })
      );
      a.position.set(x, y, z);
      a.rotation.x = -0.5;
      group.add(a);
      return a;
    }

    // ---- districts ----------------------------------------------------------
    var plazaBlock = null;
    blocks.forEach(function (b) {
      var d = SB.districtAt(b.cx, b.cz);
      if (d.id === 'downtown' && Math.abs(b.cx) < 70 && Math.abs(b.cz) < 70) { plazaBlock = b; return; } // plaza
      var roll = rng();
      if (d.id === 'downtown') {
        var h = 60 + rng() * 85;
        building(b, 34 + rng() * 14, h, 34 + rng() * 14, roll < 0.5 ? mats.glass : mats.glass2);
        if (rng() < 0.4) building({ cx: b.cx + 28, cz: b.cz - 28 }, 16, 24 + rng() * 20, 16, mats.mid2);
        // neon crown on tall towers + rooftop antenna
        if (h > 95 && rng() < 0.75) neonSign(b.cx, h - 6, b.cz + 18, 0);
        if (h > 110) {
          var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 16, 6), new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.6 }));
          ant.position.set(b.cx, h + 9, b.cz); group.add(ant);
          var tip = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 }));
          tip.position.set(b.cx, h + 17.5, b.cz); group.add(tip);
        }
      } else if (d.id === 'miramar') {
        var mat = [mats.pastelPink, mats.pastelMint, mats.pastelCream, mats.pastelCoral, mats.pastelLav, mats.pastelTeal][Math.floor(rng() * 6)];
        var bh = 18 + rng() * 26;
        building(b, 26 + rng() * 10, bh, 20 + rng() * 8, mat);
        // striped shop awning on the street side + a neon box
        awning(b.cx, 4.6, b.cz + 11, 16, ['#ff5c7a', '#37f2c8', '#ffd21f'][Math.floor(rng() * 3)]);
        if (rng() < 0.5) box(8, 3, 8, new THREE.MeshStandardMaterial({ color: 0xff7ad9, emissive: 0xff4fd8, emissiveIntensity: 0.9 }), b.cx, 20 + rng() * 20, b.cz, 0);
      } else if (d.id === 'docks') {
        if (rng() < 0.55) {
          building(b, 58 + rng() * 10, 12 + rng() * 6, 30 + rng() * 10, mats.warehouse);
        } else {
          // container yard
          for (var ci = 0; ci < 5; ci++) {
            var cx = b.x0 + 12 + (ci % 3) * 26, cz = b.z0 + 14 + Math.floor(ci / 3) * 22;
            var cols = ['#b03a2e', '#2e6db0', '#3a8a4d', '#c9a227'];
            var cont = box(20, 2.6, 6, new THREE.MeshStandardMaterial({ map: SB.textures.container(cols[ci % 4]), roughness: 0.8 }), cx, 1.3, cz, rng() < 0.5 ? 0 : Math.PI / 2);
            if (rng() < 0.5) box(20, 2.6, 6, new THREE.MeshStandardMaterial({ map: SB.textures.container(cols[(ci + 1) % 4]), roughness: 0.8 }), cx, 3.9, cz, cont.rotation.y);
            addCollider(cx, cz, 10.5, 3.5);
          }
        }
      } else if (d.id === 'heights') {
        building(b, 18 + rng() * 8, 8 + rng() * 6, 16 + rng() * 8, mats.villa);
        box(10, 1, 10, new THREE.MeshStandardMaterial({ color: 0x4d7a3a, roughness: 1 }), b.cx + 24, 0.5, b.cz + 20, 0);
      } else {
        building(b, 24 + rng() * 12, 14 + rng() * 20, 24 + rng() * 10, rng() < 0.5 ? mats.mid : mats.mid2);
      }
    });

    // ---- central plaza: fountain + palms ------------------------------------
    if (plazaBlock) {
      var pb = plazaBlock;
      var fBase = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.2, 20), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.9 }));
      fBase.position.set(pb.cx, 0.6, pb.cz); fBase.castShadow = true; fBase.receiveShadow = true; group.add(fBase);
      var fWater = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x3fa7c7, roughness: 0.2, metalness: 0.3 }));
      fWater.position.set(pb.cx, 1.2, pb.cz); group.add(fWater);
      addCollider(pb.cx, pb.cz, 10, 10);
    }

    // ---- palm trees ----------------------------------------------------------
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 });
    var frondMat = new THREE.MeshStandardMaterial({ color: 0x3f8a4d, roughness: 1 });
    function palm(x, z, s) {
      var t = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 7 * s, 6), trunkMat);
      t.position.set(x, 3.5 * s, z); t.castShadow = true; group.add(t);
      for (var i = 0; i < 6; i++) {
        var f = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 4.4 * s, 4), frondMat);
        var a = i / 6 * Math.PI * 2;
        f.position.set(x + Math.cos(a) * 1.6 * s, 7 * s, z + Math.sin(a) * 1.6 * s);
        f.rotation.z = Math.cos(a) * 1.1; f.rotation.x = -Math.sin(a) * 1.1;
        f.castShadow = true; group.add(f);
      }
    }
    for (var px = -570; px <= 570; px += 42) { palm(-548, px, 1); palm(548, px, 0.9); }
    for (var pz = -570; pz <= 570; pz += 60) { if (Math.abs(pz) < 90) continue; palm(-548, pz, 0.9); }
    for (var pi = 0; pi < 14; pi++) palm(-420 + rng() * 700, -560 + rng() * 220, 0.8 + rng() * 0.5);
    if (plazaBlock) { palm(plazaBlock.cx - 30, plazaBlock.cz - 30, 1); palm(plazaBlock.cx + 30, plazaBlock.cz + 30, 1); palm(plazaBlock.cx + 30, plazaBlock.cz - 30, 1); palm(plazaBlock.cx - 30, plazaBlock.cz + 30, 1); }

    // ---- beach props: umbrellas + towels along the sand ----------------------
    var umbCols = [0xff5c7a, 0xffd21f, 0x37f2c8, 0x7ad9ff, 0xff8a3c];
    for (var ui = 0; ui < 12; ui++) {
      var uz = -560 + ui * 100 + rng() * 30;
      var ux = -590 + rng() * 18;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.8, metalness: 0.3 }));
      pole.position.set(ux, 1.6, uz); group.add(pole);
      var umb = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.4, 8), new THREE.MeshStandardMaterial({ color: umbCols[ui % umbCols.length], roughness: 0.9, side: THREE.DoubleSide }));
      umb.position.set(ux, 3.4, uz); umb.castShadow = true; group.add(umb);
      var towel = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), new THREE.MeshStandardMaterial({ color: umbCols[(ui + 2) % umbCols.length], roughness: 1 }));
      towel.rotation.x = -Math.PI / 2; towel.rotation.z = rng() * 0.8;
      towel.position.set(ux + 4 + rng() * 3, 0.06, uz + 3); group.add(towel);
    }

    // ---- streetlights ---------------------------------------------------------
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.7, metalness: 0.5 });
    var lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffdf8a, emissiveIntensity: 1.4 });
    CFG.ROAD_COORDS.forEach(function (x) {
      CFG.ROAD_COORDS.forEach(function (z) {
        if ((x + z) % 240 !== 0) return;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 8, 6), poleMat);
        pole.position.set(x + 8.5, 4, z + 8.5); group.add(pole);
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), lampMat);
        lamp.position.set(x + 8.5, 8.2, z + 8.5); group.add(lamp);
        streetlights.push(lamp);
      });
    });

    // ---- district signs + marker props ----------------------------------------
    function signAt(x, z, text, sub, bg, fg) {
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 5.5),
        new THREE.MeshBasicMaterial({ map: SB.textures.sign(text, bg, fg, sub), transparent: true })
      );
      m.position.set(x, 9, z);
      m.rotation.y = 0;
      group.add(m);
      return m;
    }
    var signs = [];
    signs.push(signAt(-480, 296, "ELENA'S GARAGE", 'CHOP SHOP', '#20242c', '#ffd76a'));
    signs.push(signAt(-180, 176, 'ARMORY', 'GUNS • AMMO', '#20242c', '#ff9a5c'));
    signs.push(signAt(180, 296, 'SPRAY', 'NEW PAINT • NO HEAT', '#20242c', '#7ad9ff'));
    signs.push(signAt(-420, -416, 'SAFE HOUSE', 'SAVE GAME', '#20242c', '#9dff8a'));
    signs.push(signAt(60, -56, 'PALOMA VAULT', 'PRIVATE BANK', '#20242c', '#ffd76a'));
    signs.push(signAt(480, 416, 'BAYSIDE CARGO', 'DOCKS 7', '#20242c', '#ff8a7a'));
    // garage / shop shacks under the signs
    box(24, 7, 14, mats.warehouse, -480, 3.5, 282, 0); addCollider(-480, 282, 12.5, 7.5);
    box(20, 6, 12, mats.mid, -180, 3, 164, 0); addCollider(-180, 164, 10.5, 6.5);
    box(22, 6, 12, mats.mid2, 180, 3, 284, 0); addCollider(180, 284, 11.5, 6.5);
    box(18, 6, 14, mats.villa, -420, 3, -404, 0); addCollider(-420, -404, 9.5, 7.5);
    box(26, 10, 18, mats.glass2, 60, 5, -44, 0); addCollider(60, -44, 13.5, 9.5);

    // ---- road graph for traffic ------------------------------------------------
    var nodes = [];
    CFG.ROAD_COORDS.forEach(function (x) {
      CFG.ROAD_COORDS.forEach(function (z) { nodes.push({ x: x, z: z }); });
    });
    function nodeAt(x, z) { return nodes.find(function (n) { return n.x === x && n.z === z; }); }
    var edges = [];
    CFG.ROAD_COORDS.forEach(function (c) {
      for (var i = 0; i < CFG.ROAD_COORDS.length - 1; i++) {
        var a = CFG.ROAD_COORDS[i], b = CFG.ROAD_COORDS[i + 1];
        edges.push({ ax: c, az: a, bx: c, bz: b });
        edges.push({ ax: c, az: b, bx: c, bz: a });
        edges.push({ ax: a, az: c, bx: b, bz: c });
        edges.push({ ax: b, az: c, bx: a, bz: c });
      }
    });

    // clouds: a few flat drifting puffs, high up so they read as sky
    var cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 });
    var clouds = [];
    for (var ci2 = 0; ci2 < 10; ci2++) {
      var cl = new THREE.Mesh(new THREE.BoxGeometry(40 + rng() * 50, 3, 22 + rng() * 20), cloudMat);
      cl.position.set(-500 + rng() * 1000, 340 + rng() * 60, -500 + rng() * 1000);
      group.add(cl); clouds.push(cl);
    }

    return {
      colliders: colliders,
      streetlights: streetlights,
      clouds: clouds,
      roadGraph: { nodes: nodes, edges: edges, nodeAt: nodeAt },
      plaza: plazaBlock,
      signs: signs,
      update: function (dt) {
        clouds.forEach(function (cl) {
          cl.position.x += dt * 1.5;
          if (cl.position.x > 620) cl.position.x = -620;
        });
      },
    };
  }

  SB.createCity = createCity;
})();
