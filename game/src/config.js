// Solaris Bay — shared configuration and helpers (all original).
// Every system reads from SB.CONFIG so tuning lives in one place.
window.SB = window.SB || {};

(function () {
  'use strict';

  // Seeded RNG (mulberry32) so the city layout and screenshots are stable.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var CONFIG = {
    WORLD_HALF: 600,
    ROAD_COORDS: [-540, -420, -300, -180, -60, 60, 180, 300, 420, 540],
    ROAD_WIDTH: 14,
    DAY_LENGTH_SEC: 600,          // one full day/night cycle, real seconds
    START_HOUR: 17.4,             // golden hour
    PLAYER_START: { x: 0, z: 20, yaw: Math.PI },
    PLAYER: { hp: 100, armorMax: 100, walkSpeed: 6, sprintSpeed: 10, radius: 0.7 },
    CASH_START: 500,

    DISTRICTS: [
      { id: 'miramar',  name: 'Miramar Strip',     minX: -600, maxX: -300, minZ: -600, maxZ: 600 },
      { id: 'downtown', name: 'Solstice Downtown', minX: -180, maxX: 180,  minZ: -180, maxZ: 180 },
      { id: 'docks',    name: 'Bayside Docks',     minX: 300,  maxX: 600,  minZ: 60,   maxZ: 600 },
      { id: 'heights',  name: 'Palma Heights',     minX: -300, maxX: 600,  minZ: -600, maxZ: -300 },
      { id: 'midtown',  name: 'Paloma Midtown',    minX: -300, maxX: 300,  minZ: -300, maxZ: 600 },
    ],

    VEHICLES: {
      veloce:  { label: 'Veloce GT',       color: 0xd21f3c, accel: 30, top: 58, reverse: 16, grip: 3.4, len: 4.6, wid: 2.0, hp: 100 },
      sedan:   { label: 'Solano Sedan',    color: 0x3a6ea5, accel: 20, top: 42, reverse: 12, grip: 3.0, len: 4.4, wid: 1.9, hp: 100 },
      cruiser: { label: 'Paloma PD Cruiser', color: 0xe8e8e8, accel: 25, top: 52, reverse: 14, grip: 3.2, len: 4.6, wid: 2.0, hp: 140 },
      van:     { label: 'Armored Van',     color: 0x8a8f98, accel: 14, top: 34, reverse: 10, grip: 2.6, len: 5.6, wid: 2.3, hp: 300 },
    },

    WEAPONS: {
      pistol:  { label: 'Pistol',  dmg: 34, rate: 0.30, mag: 12,  reload: 1.1, spread: 0.012, auto: false, price: 0,    ammoPrice: 0,   range: 110 },
      smg:     { label: 'SMG',     dmg: 17, rate: 0.105, mag: 30, reload: 1.4, spread: 0.035, auto: true,  price: 1200, ammoPrice: 150, range: 90 },
      shotgun: { label: 'Shotgun', dmg: 9,  rate: 0.90, mag: 6,   reload: 2.0, spread: 0.075, auto: false, price: 1800, ammoPrice: 120, range: 55, pellets: 6 },
    },
    AMMO_BOX: { smg: 120, shotgun: 24 },

    PRICES: { spray: 200, armor: 300, health: 150 },
    WANTED_DECAY_SEC: 9,
    POLICE_MAX: 5,

    MARKERS: {
      armory:    { x: -180, z: 180, label: 'ARMORY' },
      spray:     { x: 180,  z: 300, label: 'SPRAY & RESPRAY' },
      safehouse: { x: -420, z: -420, label: 'SAFE HOUSE' },
      garage:    { x: -480, z: 300, label: "ELENA'S GARAGE" },
      vault:     { x: 60,   z: -60, label: 'PALOMA VAULT' },
      docksCargo:{ x: 480,  z: 420, label: 'CARGO' },
    },

    MISSIONS: [
      { id: 'm1', name: 'Hotwire Delivery', giver: 'Elena Vance', reward: 2500,
        brief: ['Elena: "Mateo, a Veloce GT is parked at the Downtown plaza. Take it. No keys, no problem."', 'Elena: "Bring it to my garage on the Strip before the clock runs out. Fast and clean."'] },
      { id: 'm2', name: 'Dockside Shakedown', giver: 'Victor Calder', reward: 4000,
        brief: ['Victor: "Syndicate guards are sitting on my cargo at the Docks. Remove them."', 'Victor: "Secure the container and the cargo is ours."'] },
      { id: 'm3', name: 'Heat on the Strip', giver: 'Elena Vance', reward: 3500,
        brief: ['Elena: "The Strip is crawling with patrols. Draw them off — get two stars and lead them east."', 'Elena: "Then lose them. When the heat is gone, the job is done."'] },
      { id: 'm4', name: 'Armored Intercept', giver: 'Victor Calder', reward: 6000,
        brief: ['Victor: "An armored van is running the boulevard with our cash inside. Stop it."', 'Victor: "Shoot it or ram it till it stalls, then grab the case."'] },
      { id: 'm5', name: 'Final Score: Paloma Vault', giver: 'Elena Vance', reward: 15000,
        brief: ['Elena: "This is it, Mateo. The Paloma Vault. In, out, rich."', 'Elena: "Expect guards inside — and every cop in the city on the way out."'] },
    ],

    PALETTE: {
      skyDay: 0x87b5d6, skyGold: 0xf2a65e, skyNight: 0x0d1526,
      sunDay: 0xfff2d8, sunGold: 0xffb36b, sunNight: 0x8fa8ff,
      ocean: 0x1d6f8e, sand: 0xdcc08a,
      asphalt: 0x2e2e33, sidewalk: 0x9a9a94,
    },
  };

  function districtAt(x, z) {
    for (var i = 0; i < CONFIG.DISTRICTS.length; i++) {
      var d = CONFIG.DISTRICTS[i];
      if (d.id === 'midtown') continue;
      if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) return d;
    }
    return CONFIG.DISTRICTS[4];
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2D(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function angleLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  SB.CONFIG = CONFIG;
  SB.mulberry32 = mulberry32;
  SB.districtAt = districtAt;
  SB.clamp = clamp;
  SB.lerp = lerp;
  SB.dist2D = dist2D;
  SB.angleLerp = angleLerp;
})();
