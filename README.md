# HSN-Labs (HSN-Sim Laboratories)

Classroom science suite in the browser. Instruments that survive here have a real teaching model behind them (Boris pusher, six-factor + point kinetics, titration equilibria, cannon-es contacts, polytopes). Theatrical extras — BEC / spin-liquid cartoons, a fake fusion Q, a tesseract that “changes B” — were removed in 2.7.

[![License: MIT](https://img.shields.io/badge/License-MIT-3ec7ff.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.7.0-7af0c8.svg)](CHANGELOG.md)

**Author:** HasaanAmerRavid

## Instruments

- **Electromagnet Laboratory** — solenoid, core μr, saturation, magnetic vs non-magnetic parts (cannon-es)
- **Particle Accelerator** — cyclotron / linac, Boris integrator, recorded tape. Electron mass is scaled so the orbit is visible
- **Higher-Dimensional Geometry** — regular polytopes, extra-plane rotations, perspective projection
- **Multibody Dynamics** — box limbs, hinge constraints, contacts
- **Coupled Workbench** — Lorentz force, iron gradient force, beam Biot–Savart on scraps, Joule RF detune, tape rewind
- **Magnetic Domain Laboratory** — Weiss lattice, Barkhausen jumps, M–H loop, Curie point
- **Fission Reactor** — six-factor k-eff, one delayed-neutron group, temperature feedback, scram
- **Acid–Base Laboratory** — strong/weak/diprotic titration curve and indicators
- **Combustion Laboratory** — premixed flame with tabulated stoich Tad scaled by φ

## Run

From the repo root:

```bash
./start.sh
```

or `python3 -m http.server 8080`. Open http://127.0.0.1:8080 — not `file://`. Three.js and cannon-es load from jsDelivr.

The fission room is a teaching model. It is not a licensed core and it is not a weapons model.

## License

[MIT](LICENSE) © 2026 HasaanAmerRavid
