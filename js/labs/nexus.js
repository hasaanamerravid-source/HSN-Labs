/**
 * HSN Nexus — coupled EM + beam + iron + thermal + 4D cage + worldline tape.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { bindViewport, disposeThree } from "../runtime.js";
import { Bus } from "../bus.js";
import { createWorldline, bindWorldlineControls } from "../worldline.js";
import {
  hypercube4, rotatePair, coupleStep, lawText, makeThermal,
} from "../multiphysics.js";

const TRAIL = 48;

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Engine</label><b id="mEng">Live</b></div>
      <div class="metric"><label>Particles</label><b id="mN">0</b></div>
      <div class="metric"><label>Iron</label><b id="mIron">0</b></div>
      <div class="metric"><label>B coupled</label><b id="mB">0.80 T</b></div>
      <div class="metric"><label>Coil T</label><b id="mT">24 °C</b></div>
      <div class="metric"><label>Tape</label><b id="mTape">0 s</b></div>
      <div class="metric"><label>Force law</label><b id="mLaw">q(E+v×B)</b></div>
    </div>
    <div class="header-actions">
      <button id="btnInject" class="primary">Inject beam</button>
      <button id="btnIron">Drop iron</button>
      <button id="btnRec">Pause / scrub</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Equation rack</h2>
      <p class="help" style="margin-bottom:8px">Every checked term is a live coupling. Uncheck to isolate a domain.</p>
      <label class="row"><span>q E &nbsp;(RF gap)</span><input type="checkbox" id="cE" checked /></label>
      <label class="row"><span>q v × B</span><input type="checkbox" id="cB" checked /></label>
      <label class="row"><span>Iron ∇(m·B)</span><input type="checkbox" id="cM" checked /></label>
      <label class="row"><span>Beam B → iron</span><input type="checkbox" id="cBeamB" checked /></label>
      <label class="row"><span>Joule heat detunes RF</span><input type="checkbox" id="cHeat" checked /></label>
      <label class="row"><span>4D cage modulates B</span><input type="checkbox" id="cCage" checked /></label>
    </div>
    <div class="section">
      <h2>Fields</h2>
      <div class="row"><label>Base B</label><span class="val" id="vB">0.80 T</span></div>
      <input type="range" id="rB" min="0.15" max="1.8" step="0.01" value="0.80" />
      <div class="row"><label>RF gap</label><span class="val" id="vE">8</span></div>
      <input type="range" id="rE" min="0" max="20" step="1" value="8" />
      <div class="row"><label>Cage spin</label><span class="val" id="vSpin">0.40</span></div>
      <input type="range" id="rSpin" min="0" max="1.2" step="0.02" value="0.40" />
    </div>
    <div class="section">
      <h2>Worldline</h2>
      <p class="help" id="wlHelp">Recording live. Pause to drag time backward and watch the same law rewind.</p>
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
    <div class="section">
      <h2>Why this exists</h2>
      <p class="help">
        Other labs isolate one idea. Nexus lets the beam, the magnetized scraps,
        coil heat, and a projected tesseract share one force law you can edit and rewind.
      </p>
    </div>
  </aside>
  <div id="viewport">
    <div class="overlay-hud" id="hud">Nexus · coupled multiphysics · worldline tape armed</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Live law</h2>
      <p class="help accel-eq" id="lawTxt">F = q(E + v × B)</p>
    </div>
    <div class="section">
      <h2>Coupling</h2>
      <p class="help" id="coupleTxt">Iron packing and cage W-scale both change B. Heat detunes the RF kick.</p>
    </div>
    <div class="section">
      <h2>Cage</h2>
      <p class="help" id="cageTxt">W-perspective scales B so a 4D rotation is something you can feel, not only see.</p>
    </div>
  </div>
</div>
`;

export function mount(root, ctx) {
  const toast = (ctx && ctx.toast) || (() => {});
  const setStatus = (ctx && ctx.setStatus) || (() => {});
  const settings = (ctx && ctx.settings) || {};
  const quality = settings.quality || "high";
  const aa = settings.antialias !== false && quality !== "low";
  const pr = quality === "high" ? Math.min(devicePixelRatio, 1.5) : 1;
  const maxP = Math.max(4, Math.min(64, settings.maxParticles || 24));

  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id);
  const ac = new AbortController();
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ac.signal });
  const ctl = { paused: false };

  const st = {
    useE: true, useB: true, useM: true, useCage: true, useBeamB: true, useHeat: true,
    B0: 0.8, kick: 8, spin: 0.4, phase: 0, cageA: 0.4,
    particles: [], irons: [],
    thermal: makeThermal(),
    lastBy: 0.8, lastMu: 1, lastDetune: 1, lastI: 0, lastT: 24,
    uiAcc: 0,
  };

  const wl = createWorldline({ max: 360, hz: 30 });

  const viewport = $("viewport");
  const renderer = new THREE.WebGLRenderer({ antialias: aa, powerPreference: "high-performance" });
  renderer.setPixelRatio(pr);
  renderer.setSize(Math.max(4, viewport.clientWidth), Math.max(4, viewport.clientHeight), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40);
  camera.position.set(2.2, 2.6, 3.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !settings.reducedMotion;
  controls.target.set(0, 0.3, 0);
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x1a140c, 1.05));
  const key = new THREE.DirectionalLight(0xfff2dc, 0.7);
  key.position.set(3, 5, 2);
  scene.add(key);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5.2, 48),
    new THREE.MeshLambertMaterial({ color: 0x101820 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.GridHelper(8, 16, 0x243044, 0x16202c));

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.05, 48),
    new THREE.MeshLambertMaterial({ color: 0x3a4658 })
  );
  pole.position.y = 0.18;
  scene.add(pole);
  const deeMat = new THREE.MeshLambertMaterial({
    color: 0x8a4b1e, transparent: true, opacity: 0.35, emissive: 0xff6a2a, emissiveIntensity: 0.1, side: THREE.DoubleSide,
  });
  const deeGeo = new THREE.CylinderGeometry(0.96, 0.96, 0.12, 28, 1, false, 0.1, Math.PI - 0.2);
  const d1 = new THREE.Mesh(deeGeo, deeMat);
  d1.position.y = 0.3;
  const d2 = new THREE.Mesh(deeGeo, deeMat.clone());
  d2.rotation.y = Math.PI;
  d2.position.y = 0.3;
  scene.add(d1, d2);

  const cage = hypercube4();
  const cageLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xc4a0ff, transparent: true, opacity: 0.7 })
  );
  cageLines.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cage.edges.length * 6), 3));
  scene.add(cageLines);

  const beam = new THREE.Group();
  scene.add(beam);
  const irons = new THREE.Group();
  scene.add(irons);
  const sphereGeo = new THREE.SphereGeometry(0.03, 10, 8);
  const ironGeo = new THREE.SphereGeometry(0.055, 12, 10);

  function projectCage() {
    const pts = cage.verts.map((src) => {
      const v = src.slice();
      rotatePair(v, 0, 3, st.cageA);
      rotatePair(v, 1, 3, st.cageA * 0.6);
      const w = v[3];
      const k = 1 / Math.max(0.2, 1 + w / 2.6);
      return [v[0] * k * 1.55, v[1] * k * 1.55 + 0.35, v[2] * k * 1.55];
    });
    const arr = cageLines.geometry.attributes.position.array;
    let o = 0;
    for (const [a, b] of cage.edges) {
      arr[o++] = pts[a][0]; arr[o++] = pts[a][1]; arr[o++] = pts[a][2];
      arr[o++] = pts[b][0]; arr[o++] = pts[b][1]; arr[o++] = pts[b][2];
    }
    cageLines.geometry.attributes.position.needsUpdate = true;
  }

  function inject(n = 7) {
    let made = 0;
    for (let i = 0; i < n; i++) {
      const dead = st.particles.find((p) => !p.alive);
      const slot = dead || (st.particles.length < maxP ? {} : null);
      if (!slot) break;
      if (!dead) {
        slot.mesh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x7af0c8 }));
        slot.trail = new THREE.Line(
          new THREE.BufferGeometry(),
          new THREE.LineBasicMaterial({ color: 0x7af0c8, transparent: true, opacity: 0.4 })
        );
        slot.trail.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
        beam.add(slot.mesh, slot.trail);
        st.particles.push(slot);
      }
      Object.assign(slot, {
        hist: new Float32Array(TRAIL * 3), histN: 0,
        x: (Math.random() - 0.5) * 0.04, y: 0.3, z: 0.02,
        vx: 0, vy: 0, vz: 0.16 + i * 0.004, q: 1, m: 1, alive: true,
      });
      slot.mesh.visible = true;
      made++;
    }
    toast(made ? "Beam injected into workbench" : "Particle cap reached — raise it in Preferences");
  }

  function dropIron(n = 5) {
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(ironGeo, new THREE.MeshPhongMaterial({ color: 0xb8c2cc, shininess: 50 }));
      irons.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      const r = 0.55 + Math.random() * 0.7;
      st.irons.push({
        mesh, x: Math.cos(ang) * r, y: 0.08 + Math.random() * 0.04, z: Math.sin(ang) * r,
        vx: 0, vz: 0, chi: 2.2,
      });
    }
    toast("Iron scraps on the pole face");
  }

  function snapshot() {
    return {
      cageA: st.cageA,
      phase: st.phase,
      T: st.thermal.T,
      lastBy: st.lastBy,
      particles: st.particles.map((p) => ({ x: p.x, y: p.y, z: p.z, vx: p.vx, vz: p.vz, alive: p.alive })),
      irons: st.irons.map((p) => ({ x: p.x, y: p.y, z: p.z, vx: p.vx, vz: p.vz })),
    };
  }

  function applySnap(s) {
    if (!s) return;
    st.cageA = s.cageA;
    if (typeof s.phase === "number") st.phase = s.phase;
    if (typeof s.T === "number") st.thermal.T = s.T;
    if (typeof s.lastBy === "number") st.lastBy = s.lastBy;
    const plist = s.particles || [];
    st.particles.forEach((p, i) => {
      const sp = plist[i];
      if (!sp) {
        p.alive = false;
        p.mesh.visible = false;
        return;
      }
      p.x = sp.x; p.y = sp.y; p.z = sp.z; p.vx = sp.vx; p.vz = sp.vz; p.alive = sp.alive;
      p.mesh.visible = p.alive;
      p.mesh.position.set(p.x, p.y, p.z);
    });
    if (s.irons) {
      s.irons.forEach((sp, i) => {
        const p = st.irons[i];
        if (!p) return;
        p.x = sp.x; p.y = sp.y; p.z = sp.z;
        if (typeof sp.vx === "number") p.vx = sp.vx;
        if (typeof sp.vz === "number") p.vz = sp.vz;
        p.mesh.position.set(p.x, p.y, p.z);
      });
    }
    projectCage();
    poseMeshes();
  }

  function poseMeshes() {
    for (const p of st.particles) p.mesh.position.set(p.x, p.y, p.z);
    for (const iron of st.irons) iron.mesh.position.set(iron.x, iron.y, iron.z);
  }

  function poseTrails() {
    for (const p of st.particles) {
      if (!p.alive) continue;
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
  }

  function stepLive(dt) {
    const { rf } = coupleStep(st, dt);
    d1.material.emissiveIntensity = 0.06 + Math.max(0, rf) * 0.25;
    d2.material.emissiveIntensity = 0.06 + Math.max(0, -rf) * 0.25;
    poseMeshes();
    poseTrails();
    projectCage();
    wl.record(dt, snapshot());
  }

  on($("cE"), "change", (e) => { st.useE = e.target.checked; });
  on($("cB"), "change", (e) => { st.useB = e.target.checked; });
  on($("cCage"), "change", (e) => { st.useCage = e.target.checked; });
  on($("cM"), "change", (e) => { st.useM = e.target.checked; });
  on($("cBeamB"), "change", (e) => { st.useBeamB = e.target.checked; });
  on($("cHeat"), "change", (e) => { st.useHeat = e.target.checked; });
  on($("rB"), "input", (e) => { st.B0 = parseFloat(e.target.value); $("vB").textContent = st.B0.toFixed(2) + " T"; });
  on($("rE"), "input", (e) => { st.kick = parseFloat(e.target.value); $("vE").textContent = String(st.kick); });
  on($("rSpin"), "input", (e) => { st.spin = parseFloat(e.target.value); $("vSpin").textContent = st.spin.toFixed(2); });
  on($("btnInject"), "click", () => inject(7));
  on($("btnIron"), "click", () => dropIron(5));
  on($("btnRec"), "click", () => {
    if (wl.liveMode) wl.pause();
    else wl.live();
    paintWl();
    toast(wl.liveMode ? "Back to live" : "Worldline paused");
  });

  const paintWl = bindWorldlineControls(root, wl, applySnap, { on, toast });

  const unbindView = bindViewport(viewport, camera, renderer);
  const clock = new THREE.Clock();
  let raf = 0;

  function hud() {
    const live = st.particles.filter((p) => p.alive).length;
    $("mN").textContent = String(live);
    $("mIron").textContent = String(st.irons.length);
    $("mB").textContent = st.lastBy.toFixed(2) + " T";
    $("mT").textContent = st.thermal.T.toFixed(0) + " °C";
    $("mTape").textContent = wl.duration().toFixed(1) + " s";
    $("mLaw").textContent = lawText(st).replace("F = ", "");
    $("mEng").textContent = wl.liveMode ? "Live" : (wl.replaying ? "Replay" : "Scrub");
    $("lawTxt").textContent = lawText(st);
    $("coupleTxt").textContent =
      "μ pack " + st.lastMu.toFixed(2) +
      " · RF detune " + st.lastDetune.toFixed(2) +
      " · I_eq " + st.lastI.toFixed(2);
    $("cageTxt").textContent = st.useCage
      ? "Tesseract W-projection is scaling B right now."
      : "Cage display only — B is the slider value times iron packing.";
    Bus.set("nexus", {
      particles: live,
      irons: st.irons.length,
      cageOn: st.useCage,
      B: st.lastBy,
      T: st.thermal.T,
      mu: st.lastMu,
      coupled: st.useM && st.useB && st.useBeamB && st.useHeat,
      scrubbed: wl.scrubbed,
      paused: wl.paused,
      law: lawText(st),
    });
    setStatus(
      wl.liveMode ? "Nexus live · " + live + " on orbit" : "Nexus worldline " + wl.label(),
      wl.liveMode ? "ok" : "warn"
    );
  }

  function frame() {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    if (ctl.paused) return;
    const dt = Math.min(0.022, clock.getDelta());
    if (wl.replaying) {
      wl.advanceReplay(dt, applySnap);
      paintWl();
    } else if (wl.liveMode) {
      stepLive(dt);
    }
    st.uiAcc += dt;
    if (st.uiAcc > 0.1) { st.uiAcc = 0; hud(); }
    controls.update();
    renderer.render(scene, camera);
  }

  inject(6);
  dropIron(4);
  hud();
  frame();
  toast("Workbench online — edit the force law, then rewind it");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() {
      return { flags: { ...st, particles: undefined, irons: undefined, thermal: st.thermal }, snap: snapshot(), tape: wl.toJSON() };
    },
    setState(s) {
      if (!s) return;
      if (s.tape) wl.fromJSON(s.tape);
      if (s.snap) applySnap(s.snap);
    },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      unbindView();
      disposeThree(renderer, scene);
      root.innerHTML = "";
    },
  };
}
