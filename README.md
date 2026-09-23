# HSN-Sim Laboratories

Classroom science suite in the browser. Coupled multiphysics, worldline scrubbing, chemistry benches, and a teaching reactor.

[![License: MIT](https://img.shields.io/badge/License-MIT-3ec7ff.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.6.0-7af0c8.svg)](CHANGELOG.md)

**Author:** HasaanAmerRavid  
Also ships [HSN-Shaders](https://modrinth.com/user/HasaanAmerRavid) on Modrinth and [HSN-Optimizations](https://www.curseforge.com/minecraft/mc-mods/hsn-optimizations) on CurseForge.

## What you get

| Room | What it is |
| --- | --- |
| **Home** | Workbench highlight and mission board |
| **Laboratories** | Instrument rack with topic filters |
| **Control Room** | Telemetry from held sessions |
| **Preferences** | Graphics and application options |

### Instruments

- **Coupled Multiphysics Workbench** — editable force law, iron back-reaction, beam field on scraps, Joule detune, 4D cage scaling B
- **Electromagnet Laboratory** — coil, heating, field lines, magnetic materials
- **Magnetic Domain Laboratory** — Weiss domains, Barkhausen jumps, hysteresis, Curie point
- **Particle Accelerator** — cyclotron / linac with a Boris pusher and worldline tape
- **Higher-Dimensional Geometry** — regular polytopes rotated in extra planes
- **Multibody Dynamics** — hinges, contacts, throw impulses
- **Fission & Fusion Reactor** — classroom chain reaction and D–T confinement (teaching model only)
- **Acid–Base Laboratory** — strong/weak reagents, indicators, titration curve
- **States of Matter** — solid, liquid, gas, plasma, supercritical fluid, BEC, quantum spin liquid, superfluid
- **Combustion Laboratory** — premixed flame, equivalence ratio, completeness of burn

## Coupled multiphysics

The workbench does not run isolated toys. Checked terms on the equation rack are live couplings:

- Lorentz force on the bunch (Boris pusher)
- magnetic-gradient force on iron scraps
- bunch current adds a toy Biot–Savart field the iron can feel
- iron packing raises the effective permeability, so the beam feels a stronger B
- Joule heat on the RF gap detunes the kick
- tesseract W-projection scales lab B so a 4D rotation is felt, not only drawn

Turn a checkbox off to isolate a domain. That is the classroom point.

## Worldline time scrubbing

`js/worldline.js` records configuration snapshots at a capped rate, then:

- **Pause / scrub** — drag the slider; frames are interpolated
- **Replay tape** — play the recorded path at 0.25x–3x
- **Live** — jump back to the end and keep recording

The workbench and the accelerator both mount the same tape.

## Sessions

Leaving Home, Laboratories, Control Room, or Preferences **pauses** the active engine instead of destroying it. Close a tab to tear it down. Resume remounts from a held snapshot when the engine must be swapped.

## Run

No build step. Static ES modules + import maps.

```bash
cd HSN-Sim
python3 -m http.server 8080
```

Or:

```bash
./start.sh
```

Open http://127.0.0.1:8080

A file:// open will fail on module imports. Serve it.

The fission/fusion room is a classroom model. It is not a licensed core and it is not a weapons model.

## Repo layout

```
HSN-Sim/
  index.html
  css/style.css
  js/app.js              launcher shell
  js/bus.js              telemetry + missions
  js/runtime.js          WebGL mount / teardown
  js/worldline.js        time tape
  js/multiphysics.js     coupled kernels
  js/labs/               instruments
  labs/magdomain.html    standalone domain lattice
  assets/logo.svg        app mark + favicon
  scenes/                demo bench JSON
  LICENSE
```

## License

[MIT](LICENSE) © 2026 HasaanAmerRavid

Three.js and cannon-es are loaded from jsDelivr at runtime and keep their own licenses.

## Credits

- HasaanAmerRavid — HSN-Sim, [HSN-Shaders](https://github.com/hasaanamerravid-source/HSN-Shaders), [HSN-Optimizations](https://github.com/hasaanamerravid-source/HSN-Optimizations)
- [three.js](https://threejs.org/) — WebGL renderer
- [cannon-es](https://github.com/pmndrs/cannon-es) — rigid-body contacts in the electromagnet and multibody rooms
