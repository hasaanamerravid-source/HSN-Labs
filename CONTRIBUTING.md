# Contributing

Issues and pull requests are welcome.

## How to run

From the repository root:

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080 — do not open index.html as a file.

## House rules

* Keep labs classroom-scale. Visible coupling beats SI-exact constants, but do not ship missions the model cannot complete.
* Label teaching units (MW*, keV*, cm*) when the number is not SI-true.
* New instruments export `mount(root, ctx)` and return `{ unmount, pause, resume }`.
* Use `js/worldline.js` if a lab needs time scrubbing.
* Use `js/multiphysics.js` if a lab needs shared EM / thermal / cage kernels.
* Do not commit `node_modules`, editor junk, or local telemetry dumps.

## License

By contributing you agree the work is released under the MIT License in `LICENSE`.
