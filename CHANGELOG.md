# Changelog

## 2.7.0

Removed fake modules and unphysical couplings.

* Deleted States of Matter (BEC / spin liquid / superfluid cartoons).
* Deleted the fusion-vessel room. The reactor is now a fission point-kinetics core (six-factor k, one delayed group, temperature feedback).
* Deleted the 4D-cage term that pretended to scale laboratory B. Geometry stays in its own instrument.
* Combustion uses tabulated air–fuel adiabatic flame temperatures (CH4 2226 K, H2 2382 K, …) scaled by φ.
* Mission board no longer requires a spinning tesseract or a condensate button.


## 2.6.1

Fixes for packaging, broken missions, and classroom-model honesty.

* README / package.json names and run path match the HSN-Labs repo root.
* Fission six-factor k-eff no longer includes a stray 0.22 scale, so criticality is reachable.
* Acid–base solver handles water near equivalence, diprotic sulfuric (first proton strong), and weak-base analytes.
* States of matter can follow T and density for classical phases; overlay already called the view schematic.
* Combustion uses per-fuel flammability windows and clearer product strings.
* MagDomain pause/resume talks to the iframe instead of only hiding it.
* Iron scraps on the workbench recycle after a cap. Worldline Live reapplies the end frame.
* Control-room nav no longer highlights while a lab is open. Mission reset lives in Preferences.
* Multibody lab respects graphics quality. EM copy no longer says “temporary lab.”
* Accelerator energy/radius stay marked as classroom units (`keV*`, `cm*`).

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
