# Changelog

## 2.6.0

Session hold, four new teaching rooms, professional instrument names.

* Leaving Home / Laboratories / Control Room / Preferences pauses the live engine instead of destroying it.
* Launch queue so a second Open during load is not dropped.
* Worldline apply hides bodies that were not in the recorded frame; iron velocities are stored.
* Workbench respects the particle cap and recycles spent tracks.
* Electromagnet: settings quality, working shadows toggle, trail attach/remove, constraint-safe delete, chain–object collisions.
* Multibody stiffness applies to existing hinges. Telemetry published.
* New: Fission & Fusion Reactor, Acid–Base Laboratory, States of Matter, Combustion Laboratory.
* Catalog, navigation, and version strings aligned to 2.6.0.

## 2.5.0

App mark, favicons, and MagDomain lattice lab.

* Original HSN logo + favicon set (Modrinth-style app rail mark, not the Modrinth trademark).
* MagDomain: Weiss domains, wall motion, Barkhausen clicks, M-H loop, Curie point.
* Instrument rack now uses per-lab icons.

## 2.4.0

MIT license and GitHub packaging. Shared worldline tape. Coupled multiphysics kernels.

* Added `LICENSE` (MIT, HasaanAmerRavid).
* Added `js/worldline.js` — record, interpolate, scrub, replay, play rate.
* Added `js/multiphysics.js` — Boris pusher, iron back-reaction, beam-B on scraps, Joule detune, 4D cage scale.
* Nexus equation rack now includes beam-B and heat couplings. Coil temperature is on the toolbar.
* Accelerator mounts the same worldline controls.
* README, .gitignore, package.json, CONTRIBUTING for a clean GitHub upload.

## 2.3.0

Launcher rooms, Nexus hero, mission board, first worldline slider on Nexus.
