// Solaris Bay — sun, sky and fog. Golden-hour start, slow day/night cycle.
window.SB = window.SB || {};

(function () {
  'use strict';

  function createSky(G) {
    var scene = G.scene;
    var sun = new THREE.DirectionalLight(0xffb36b, 1.15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 1200;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(sun.target);

    var hemi = new THREE.HemisphereLight(0xbfd8ff, 0x54432e, 0.75);
    scene.add(hemi);

    var amb = new THREE.AmbientLight(0xffffff, 0.12);
    scene.add(amb);

    scene.fog = new THREE.Fog(0xe8a56b, 320, 1150);

    function setHour(h) {
      // h in [0,24). Sun elevation peaks at noon, sets ~18:00, night 19:00-05:00.
      var elev = Math.sin((h - 6) / 12 * Math.PI); // 1 noon, 0 at 06:00/18:00, <0 night
      var dayT = SB.clamp(elev, 0, 1);
      var gold = Math.max(0, 1 - Math.abs(h - 17.6) / 2.2);     // golden-hour weight
      var night = SB.clamp(1 - (elev + 0.25) / 0.45, 0, 1);    // 0 in daylight, 1 deep night
      var ang = (h - 6) / 12 * Math.PI; // sunrise east -> sunset west
      var r = 700;
      sun.position.set(Math.cos(ang) * r, Math.max(40, Math.sin(ang) * r * 0.9 + 60), 260);
      sun.target.position.set(0, 0, 0);
      var sunCol = new THREE.Color(0xfff2d8).lerp(new THREE.Color(0xff9a4d), gold);
      sunCol.lerp(new THREE.Color(0x8fa8ff), night * 0.8);
      sun.color.copy(sunCol);
      sun.intensity = 0.55 + dayT * 0.75 + gold * 0.3;
      hemi.intensity = 0.45 + dayT * 0.45;
      amb.intensity = 0.14 + dayT * 0.08;
      var sky = new THREE.Color(0x87b5d6).lerp(new THREE.Color(0xf2a65e), gold);
      sky.lerp(new THREE.Color(0x0d1526), night * 0.9);
      scene.background = sky;
      scene.fog.color.copy(sky);
      G.isNight = night > 0.55;
      G.goldHour = gold;
    }

    return {
      sun: sun, hemi: hemi, setHour: setHour,
      update: function (dt) {
        if (G.timeFrozen) return;
        G.hour += dt / SB.CONFIG.DAY_LENGTH_SEC * 24;
        if (G.hour >= 24) G.hour -= 24;
        setHour(G.hour);
      },
    };
  }

  SB.createSky = createSky;
})();
