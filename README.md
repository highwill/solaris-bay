# Solaris Bay

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/highwill/solaris-bay/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/highwill/solaris-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Solaris Bay** is an original 3D open-world crime game built for the
[make.fun GTA 6 bounty (gta6-01)](https://make.fun/bounty/gta6-01). 100% original
IP — no names, characters, maps, art, or sounds from Rockstar Games / GTA or any
other commercial game. Static files only, zero network requests at runtime,
Three.js vendored under `game/vendor/three.min.js`.

## The game

Paloma Del Sol is a sun-soaked coastal city with four connected districts:
**Miramar Strip** (oceanfront beach, boardwalk, palms, art-deco hotels),
**Solstice Downtown** (glass towers, wide boulevards, central plaza),
**Bayside Docks** (shipping containers, smuggling warehouses, pursuit lanes),
and **Palma Heights** (hillside villas, winding roads).

You are **Mateo Reyes**, a former street-racing mechanic rebuilding his name.
Elena Vance (Miramar broker) and Victor Calder (Bayside Docks boss) hand you
five sequential story missions — steal the Veloce GT, shake down the docks,
dodge a 2-star chase on the Strip, intercept an armored van, and finally crack
the Paloma Vault in a 4-star getaway. Between jobs, free-roam: buy and upgrade
weapons at the Armory, respray your car and clear your wanted level at the
Paint & Spray Garage, and save your progress at the Safe House.

The city lives: stealable cars (sports, sedan, police cruiser, armored van)
with arcade-drift physics, AI traffic that follows road lanes and stops for
obstacles, pedestrians who flee gunfights, a 1–5 star wanted system with
pursuing cruisers (flashing lightbars, sirens) and officers on foot, and
raycast combat with muzzle flash, hit particles, and health/armor pickups.
All textures are procedural Canvas textures and all audio is synthesized
Web Audio — engine, screech, sirens, gunshots, explosions, and a toggleable
coastal synthwave loop.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move on foot / drive (W accelerate, S brake/reverse, A/D steer) |
| Shift | Sprint on foot |
| Mouse | Look / aim (click the game to lock the pointer) |
| Left click | Shoot |
| 1 / 2 / 3 | Switch weapon (Pistol / SMG / Shotgun) |
| E / F | Enter or hijack nearby vehicle / exit vehicle |
| Space | Handbrake / drift while driving |
| M | Full city map |
| Esc | Pause, Save / Load |
| N | Toggle music |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are taken from the live game via `?shot=1..4` presets
(see `shots.json`). Build the submission bundle with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Structure

- `game/index.html` — entry point, HUD DOM, overlays
- `game/styles/hud.css` — all HUD / menu styling
- `game/vendor/three.min.js` — vendored Three.js r128 (only external library)
- `game/src/main.js` — boot, game loop, input, screenshot presets
- `game/src/config.js` — districts, vehicles, weapons, missions, palette
- `game/src/audio/soundEngine.js` — synthesized Web Audio engine
- `game/src/world/textureFactory.js` — procedural Canvas textures
- `game/src/world/skyLighting.js` — sun, sky, day/night cycle
- `game/src/world/cityGenerator.js` — city mesh, roads, road graph
- `game/src/entities/playerController.js` — on-foot movement, camera, hijack
- `game/src/entities/vehiclePhysics.js` — arcade-drift physics, car factory
- `game/src/entities/trafficSystem.js` — AI traffic on the road graph
- `game/src/entities/pedestrianSystem.js` — sidewalk pedestrians, flee AI
- `game/src/entities/policeSystem.js` — wanted levels, cruiser chase, officers
- `game/src/gameplay/combatSystem.js` — raycast shooting, enemy AI, pickups
- `game/src/gameplay/missionManager.js` — 5-mission state machine, beacons
- `game/src/gameplay/saveSystem.js` — localStorage save / load
- `game/src/ui/hudManager.js` — HUD, menus, dialogue, toasts
- `game/src/ui/minimapRenderer.js` — 2D radar minimap
