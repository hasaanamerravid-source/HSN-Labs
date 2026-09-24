/**
 * Classroom particle accelerator — stable cyclotron + linac (Boris pusher).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { bindViewport, disposeThree } from "../runtime.js";
import { Bus } from "../bus.js";
import { createWorldline, bindWorldlineControls } from "../worldline.js";

const SPECIES = {
  proton: { name: "Proton", q: 1, m: 1, color: 0x7af0c8 },
  electron: { name: "Electron (scaled)", q: -1, m: 0.12, color: 0x3ec7ff },
  alpha: { name: "Alpha (He²⁺)", q: 2, m: 4, color: 0xffb020 },
  ion: { name: "Light ion", q: 1, m: 12, color: 0xc4a0ff },
};

const TRAIL = 64;

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Mode</label><b id="mMode">Cyclotron</b></div>
      <div class="metric"><label>B field</label><b id="mB">0.80 T</b></div>
      <div class="metric"><label>RF</label><b id="mRf">1.00×</b></div>
      <div class="metric"><label>Energy</label><b id="mE">0 keV</b></div>
      <div class="metric"><label>Radius</label><b id="mR">—</b></div>
      <div class="metric"><label>Turns</label><b id="mN">0</b></div>
    </div>
    <div class="header-actions">
      <button id="btnInject" class="primary">Inject bunch</button>
      <button id="btnClear">Clear beam</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Machine</h2>
      <div class="seg" id="modeSeg">
        <button data-mode="cyclotron" class="active">Cyclotron</button>
        <button data-mode="linac">Linac</button>
      </div>
    </div>
    <div class="section">
      <h2>Species</h2>
      <select id="sPart">
        <option value="proton">Proton</option>
        <option value="electron">Electron (mass scaled)</option>
        <option value="alpha">Alpha particle</option>
        <option value="ion">Light ion</option>
      </select>
    </div>
    <div class="section">
      <h2>Fields</h2>
      <div class="row"><label>Magnet B</label><span class="val" id="vB">0.80 T</span></div>
      <input type="range" id="rB" min="0.15" max="2.2" step="0.01" value="0.80" />
      <div class="row"><label>RF voltage</label><span class="val" id="vKick">10</span></div>
      <input type="range" id="rKick" min="0" max="28" step="1" value="10" />
      <div class="row"><label>RF frequency</label><span class="val" id="vRf">1.00× cyclotron</span></div>
      <input type="range" id="rRf" min="0.7" max="1.3" step="0.01" value="1" />
      <div class="row"><label>Inject speed</label><span class="val" id="vV0">0.16</span></div>
      <input type="range" id="rV0" min="0.06" max="0.32" step="0.01" value="0.16" />
    </div>
    <div class="section">
      <h2>Classroom notes</h2>
      <p class="help accel-eq">
        Cyclotron frequency ω = |q|B / m<br/>
        Orbit radius r = m v / (|q| B)<br/>
        A kick is applied only in the Dee gap, in phase with RF.
      </p>
      <p class="help" style="margin-top:8px">
        Integration uses a Boris pusher with substeps so orbits stay circular.
        Electron mass is scaled up so the classroom orbit is visible — a real electron would hug the center.
      </p>
    </div>
    <div class="section">
      <h2>Worldline</h2>
      <p class="help" id="wlHelp">Recording live. Pause and scrub the bunch backward along its orbit.</p>
      <div class="row"><label>Scrub</label><span class="val" id="vScrub">live</span></div>
      <input type="range" id="rScrub" min="0" max="1000" step="1" value="1000" />
      <div class="row"><label>Replay rate</label><span class="val" id="vRate">1.00×</span></div>
      <input type="range" id="rRate" min="0.25" max="3" step="0.05" value="1" />
      <div class="seg" style="margin-top:8px">
        <button id="btnWlPause">Pause / scrub</button>
        <button id="btnWlReplay">Replay tape</button>
        <button id="btnWlLive">Live</button>
      </div>
    </div>
  </aside>
  <div id="viewport">
    <div class="overlay-hud">Drag to orbit · scroll zoom · inject a bunch to start</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Live particle</h2>
      <p class="help" id="pInfo">No beam yet.</p>
    </div>
    <div class="section">
      <h2>What you are seeing</h2>
      <p class="help">
        Cyclotron: two D-shaped electrodes sit in a vertical B field.
        Particles circle; each gap crossing adds energy if the RF is in phase.
      </p>
      <p class="help" style="margin-top:8px">
        Linac: drift tubes in a line. The field in each gap is timed so a particle speeds up as it passes.
      </p>
    </div>
  </div>
</div>
`;

function disposeObject3D(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => m.dispose && m.dispose());
    }
  });
}

function boris(p, Bx, By, Bz, Ex, Ey, Ez, dt) {
  const qmdt = (p.q / p.m) * dt;
  const qmh = qmdt * 0.5;
  let vx = p.vx + Ex * qmh;
  let vy = p.vy + Ey * qmh;
  let vz = p.vz + Ez * qmh;
  const tx = qmh * Bx, ty = qmh * By, tz = qmh * Bz;
  const t2 = tx * tx + ty * ty + tz * tz;
  const sx = (2 * tx) / (1 + t2);
  const sy = (2 * ty) / (1 + t2);
  const sz = (2 * tz) / (1 + t2);
  const vpx = vx + (vy * tz - vz * ty);
  const vpy = vy + (vz * tx - vx * tz);
  const vpz = vz + (vx * ty - vy * tx);
  vx = vx + (vpy * sz - vpz * sy);
  vy = vy + (vpz * sx - vpx * sz);
  vz = vz + (vpx * sy - vpy * sx);
  p.vx = vx + Ex * qmh;
  p.vy = vy + Ey * qmh;
  p.vz = vz + Ez * qmh;
}

export function mount(root, ctx) {
  const toast = (ctx && ctx.toast) || (() => {});
  const setStatus = (ctx && ctx.setStatus) || (() => {});
  const settings = (ctx && ctx.settings) || {};
  const maxP = Math.max(4, Math.min(64, settings.maxParticles || 24));
  const quality = settings.quality || "high";
  const aa = settings.antialias !== false && quality !== "low";
  const pr = quality === "high" ? Math.min(devicePixelRatio, 1.5) : quality === "medium" ? 1 : 0.85;

  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id);
  const ac = new AbortController();
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ac.signal });
  const ctl = { paused: false };

  const st = {
    mode: "cyclotron",
    species: "proton",
    B: 0.8,
    kick: 10,
    rfMul: 1,
    v0: 0.16,
    phase: 0,
    particles: [],
    energy: 0,
    radius: 0,
    turns: 0,
    uiAcc: 0,
  };
  const wl = createWorldline({ max: 320, hz: 28 });

  const viewport = $("viewport");
  const renderer = new THREE.WebGLRenderer({ antialias: aa, powerPreference: "high-performance" });
  renderer.setPixelRatio(pr);
  renderer.setSize(Math.max(4, viewport.clientWidth), Math.max(4, viewport.clientHeight), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40);
  camera.position.set(0, 2.4, 3.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.28, 0);
  if (settings.reducedMotion) controls.enableDamping = false;

  scene.add(new THREE.HemisphereLight(0xb7d4f0, 0x1a140c, 1.0));
  const key = new THREE.DirectionalLight(0xfff2dc, 0.75);
  key.position.set(2, 4, 2);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5.4, 48),
    new THREE.MeshLambertMaterial({ color: 0x101820 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.GridHelper(8, 16, 0x243044, 0x16202c));

  const machine = new THREE.Group();
  scene.add(machine);

  function rebuildMachine() {
    disposeObject3D(machine);
    while (machine.children.length) machine.remove(machine.children[0]);
    if (st.mode === "cyclotron") {
      const yoke = new THREE.Mesh(
        new THREE.TorusGeometry(1.18, 0.09, 10, 48),
        new THREE.MeshLambertMaterial({ color: 0x2a3544 })
      );
      yoke.rotation.x = Math.PI / 2;
      yoke.position.y = 0.22;
      machine.add(yoke);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(1.06, 1.06, 0.05, 48),
        new THREE.MeshLambertMaterial({ color: 0x3a4658 })
      );
      pole.position.y = 0.2;
      machine.add(pole);
      const deeMat = new THREE.MeshLambertMaterial({
        color: 0x8a4b1e, transparent: true, opacity: 0.42, emissive: 0xff6a2a, emissiveIntensity: 0.12,
        side: THREE.DoubleSide,
      });
      const deeGeo = new THREE.CylinderGeometry(0.98, 0.98, 0.14, 32, 1, false, 0.08, Math.PI - 0.16);
      const d1 = new THREE.Mesh(deeGeo, deeMat);
      d1.position.y = 0.32;
      const d2 = new THREE.Mesh(deeGeo, deeMat.clone());
      d2.rotation.y = Math.PI;
      d2.position.y = 0.32;
      machine.add(d1, d2);
      const gap = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.02, 1.9),
        new THREE.MeshBasicMaterial({ color: 0x3ec7ff, transparent: true, opacity: 0.18 })
      );
      gap.position.y = 0.32;
      machine.add(gap);
      machine.userData.dees = [d1, d2];
    } else {
      const tubes = [];
      for (let i = 0; i < 10; i++) {
        const tube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.34 + i * 0.05, 16),
          new THREE.MeshLambertMaterial({ color: 0x4a5a6c, emissive: 0x3ec7ff, emissiveIntensity: 0 })
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set(-2.05 + i * 0.48, 0.35, 0);
        machine.add(tube);
        tubes.push(tube);
      }
      machine.userData.dees = tubes;
    }
  }
  rebuildMachine();

  const beamGroup = new THREE.Group();
  scene.add(beamGroup);
  const sphereGeo = new THREE.SphereGeometry(0.028, 10, 8);

  function inject(n) {
    const spec = SPECIES[st.species];
    const room = Math.max(0, maxP - st.particles.filter((p) => p.alive).length);
    n = Math.min(n, room);
    if (!n) {
      toast("Beam full — clear or raise the particle cap in Settings");
      return;
    }
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: spec.color }));
      const trailGeo = new THREE.BufferGeometry();
      const buf = new Float32Array(TRAIL * 3);
      trailGeo.setAttribute("position", new THREE.BufferAttribute(buf, 3));
      const trail = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.4 })
      );
      beamGroup.add(mesh, trail);
      const jitter = (Math.random() - 0.5) * 0.02;
      const v0 = st.v0;
      const p = {
        mesh, trail, hist: new Float32Array(TRAIL * 3), histN: 0,
        x: st.mode === "linac" ? -2.42 : jitter,
        y: 0.32,
        z: st.mode === "linac" ? jitter : 0.015,
        vx: st.mode === "linac" ? v0 : 0,
        vy: 0,
        vz: st.mode === "linac" ? 0 : v0,
        q: spec.q, m: spec.m,
        energy: 0.5 * spec.m * v0 * v0,
        laps: 0, lastAng: Math.atan2(0.015, jitter || 0.0001),
        alive: true,
      };
      st.particles.push(p);
    }
    toast("Injected " + n + " " + spec.name.toLowerCase() + "(s)");
  }

  function clearBeam() {
    for (const p of st.particles) {
      beamGroup.remove(p.mesh, p.trail);
      p.trail.geometry.dispose();
      p.mesh.material.dispose();
    }
    st.particles.length = 0;
    st.turns = 0;
    st.energy = 0;
    st.radius = 0;
    wl.clear();
  }

  function snapshot() {
    return {
      phase: st.phase,
      particles: st.particles.map((p) => ({
        x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz,
        alive: p.alive, energy: p.energy, laps: p.laps, lastAng: p.lastAng,
      })),
    };
  }

  function applySnap(s) {
    if (!s) return;
    if (typeof s.phase === "number") st.phase = s.phase;
    const plist = s.particles || [];
    st.particles.forEach((p, i) => {
      const sp = plist[i];
      if (!sp) {
        p.alive = false;
        p.mesh.visible = false;
        return;
      }
      p.x = sp.x; p.y = sp.y; p.z = sp.z;
      p.vx = sp.vx; p.vy = sp.vy; p.vz = sp.vz;
      p.alive = sp.alive;
      if (typeof sp.energy === "number") p.energy = sp.energy;
      if (typeof sp.laps === "number") p.laps = sp.laps;
      if (typeof sp.lastAng === "number") p.lastAng = sp.lastAng;
      p.mesh.visible = p.alive;
      p.mesh.position.set(p.x, p.y, p.z);
    });
  }

  function cyclotronOmega() {
    const spec = SPECIES[st.species];
    return Math.abs(spec.q) * st.B / spec.m;
  }

  on($("modeSeg"), "click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    st.mode = b.dataset.mode;
    $("modeSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    clearBeam();
    rebuildMachine();
    camera.position.set(st.mode === "linac" ? 0.4 : 0, 2.4, st.mode === "linac" ? 3.8 : 3.4);
    controls.target.set(st.mode === "linac" ? 0.15 : 0, 0.28, 0);
  });
  on($("sPart"), "change", (e) => { st.species = e.target.value; });
  on($("rB"), "input", (e) => { st.B = parseFloat(e.target.value); $("vB").textContent = st.B.toFixed(2) + " T"; });
  on($("rKick"), "input", (e) => { st.kick = parseFloat(e.target.value); $("vKick").textContent = String(st.kick); });
  on($("rRf"), "input", (e) => { st.rfMul = parseFloat(e.target.value); $("vRf").textContent = st.rfMul.toFixed(2) + "× cyclotron"; });
  on($("rV0"), "input", (e) => { st.v0 = parseFloat(e.target.value); $("vV0").textContent = st.v0.toFixed(2); });
  on($("btnInject"), "click", () => inject(8));
  on($("btnClear"), "click", () => { clearBeam(); toast("Beam cleared"); });

  const unbindView = bindViewport(viewport, camera, renderer);
  const clock = new THREE.Clock();
  let raf = 0;
  const vmax = 2.4;

  function stepParticle(p, dt, rf) {
    if (!p.alive) return;
    let Ex = 0, Ey = 0, Ez = 0, Bx = 0, By = 0, Bz = 0;
    if (st.mode === "cyclotron") {
      By = st.B;
      if (Math.abs(p.x) < 0.07 && Math.abs(p.z) < 1.0) {
        Ex = st.kick * 0.035 * rf;
      }
    } else {
      const gapIndex = Math.round((p.x + 2.05) / 0.48);
      const gapX = -2.05 + gapIndex * 0.48 - 0.24;
      if (Math.abs(p.x - gapX) < 0.06) Ex = st.kick * 0.05 * Math.max(0, rf);
    }
    boris(p, Bx, By, Bz, Ex, Ey, Ez, dt);
    const spd = Math.hypot(p.vx, p.vy, p.vz);
    if (spd > vmax) {
      const s = vmax / spd;
      p.vx *= s; p.vy *= s; p.vz *= s;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.y = 0.32;
    p.vy = 0;
    p.energy = 0.5 * p.m * (p.vx * p.vx + p.vz * p.vz);

    if (st.mode === "cyclotron") {
      const r = Math.hypot(p.x, p.z);
      if (r > 1.12) { p.alive = false; p.mesh.visible = false; return; }
      const ang = Math.atan2(p.z, p.x);
      let d = ang - p.lastAng;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      p.laps += Math.abs(d) / (Math.PI * 2);
      p.lastAng = ang;
    } else if (p.x > 3.1 || p.x < -2.7) {
      p.alive = false;
      p.mesh.visible = false;
    }
    p.mesh.position.set(p.x, p.y, p.z);
    const hi = (p.histN % TRAIL) * 3;
    p.hist[hi] = p.x; p.hist[hi + 1] = p.y; p.hist[hi + 2] = p.z;
    p.histN++;
    const attr = p.trail.geometry.attributes.position;
    const n = Math.min(TRAIL, p.histN);
    for (let i = 0; i < TRAIL; i++) {
      const src = Math.max(0, p.histN - n + Math.min(i, n - 1));
      const k = (src % TRAIL) * 3;
      attr.setXYZ(i, p.hist[k], p.hist[k + 1], p.hist[k + 2]);
    }
    attr.needsUpdate = true;
  }

  function physics(dt) {
    const omega0 = cyclotronOmega();
    st.phase += omega0 * st.rfMul * dt;
    const rf = Math.sin(st.phase);
    if (machine.userData.dees) {
      machine.userData.dees.forEach((d, i) => {
        if (d.material && d.material.emissiveIntensity !== undefined) {
          const pulse = st.mode === "cyclotron" ? (i % 2 ? rf : -rf) : Math.max(0, rf);
          d.material.emissiveIntensity = 0.06 + Math.max(0, pulse) * 0.28;
        }
      });
    }
    const sub = st.mode === "cyclotron" ? 10 : 6;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (const p of st.particles) stepParticle(p, h, rf);
    }
    wl.record(dt, snapshot());
  }

  function hud() {
    let maxE = 0, maxR = 0, maxLaps = 0, live = 0;
    for (const p of st.particles) {
      if (!p.alive) continue;
      live++;
      maxE = Math.max(maxE, p.energy);
      maxR = Math.max(maxR, st.mode === "cyclotron" ? Math.hypot(p.x, p.z) : Math.abs(p.x));
      maxLaps = Math.max(maxLaps, p.laps);
    }
    st.energy = maxE;
    st.radius = maxR;
    st.turns = maxLaps;
    $("mMode").textContent = st.mode === "cyclotron" ? "Cyclotron" : "Linac";
    $("mB").textContent = st.B.toFixed(2) + " T";
    $("mRf").textContent = st.rfMul.toFixed(2) + "×";
    $("mE").textContent = (st.energy * 18).toFixed(1) + " keV*";
    $("mR").textContent = st.mode === "cyclotron" ? (st.radius * 100).toFixed(1) + " cm*" : "—";
    $("mN").textContent = st.turns.toFixed(1);
    const spec = SPECIES[st.species];
    $("pInfo").textContent = `${spec.name}  q=${spec.q} e   m=${spec.m.toPrecision(3)} mₚ   ω = |q|B/m`;
    setStatus(live ? live + " particles on orbit" : "Accelerator idle", live ? "ok" : "off");
    Bus.set("accel", {
      particles: live, turns: st.turns, energy: st.energy, mode: st.mode, B: st.B,
      scrubbed: wl.scrubbed,
    });
  }

  const paintWl = bindWorldlineControls(root, wl, applySnap, { on, toast });

  function frame() {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    if (ctl.paused) return;
    const dt = Math.min(0.022, clock.getDelta());
    if (wl.replaying) {
      wl.advanceReplay(dt, applySnap);
      paintWl();
    } else if (wl.liveMode) {
      physics(dt);
    }
    st.uiAcc += dt;
    if (st.uiAcc > 0.08) { st.uiAcc = 0; hud(); if (typeof paintWl === 'function') paintWl(); }
    controls.update();
    renderer.render(scene, camera);
  }
  inject(6);
  hud();
  frame();

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() { return { mode: st.mode, species: st.species, B: st.B, snap: snapshot(), tape: wl.toJSON() }; },
    setState(s) {
      if (!s) return;
      if (s.tape) wl.fromJSON(s.tape);
      if (s.snap) applySnap(s.snap);
    },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      unbindView();
      clearBeam();
      disposeThree(renderer, scene);
      root.innerHTML = "";
    },
  };
}
