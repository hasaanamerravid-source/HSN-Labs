/**
 * 4D / 5D regular polytopes projected into 3-space.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { bindViewport, disposeThree } from "../runtime.js";
import { Bus } from "../bus.js";

const SHAPES = {
  tesseract: { name: "Tesseract (8-cell)", dim: 4, blurb: "Regular 4-cube. 16 vertices, 32 edges, 8 cubic cells." },
  pentachoron: { name: "5-cell (4-simplex)", dim: 4, blurb: "Regular 4-simplex. 5 vertices, 10 edges, 5 tetrahedral cells." },
  hexadecachoron: { name: "16-cell", dim: 4, blurb: "Regular 4-orthoplex. 8 vertices, 24 edges. Dual of the tesseract." },
  icositetrachoron: { name: "24-cell", dim: 4, blurb: "Self-dual regular 4-polytope. 24 vertices, 96 edges, octahedral cells." },
  penteract: { name: "Penteract (5-cube)", dim: 5, blurb: "Regular 5-cube. 32 vertices, 80 edges, 10 tesseract facets." },
  pentasimplex: { name: "5-simplex", dim: 5, blurb: "Regular 5-simplex. 6 vertices, 15 edges." },
  pentacross: { name: "5-orthoplex", dim: 5, blurb: "5-dimensional cross polytope. 10 vertices, 40 edges." },
};

function hypercube(dim) {
  const verts = [];
  const n = 1 << dim;
  for (let i = 0; i < n; i++) {
    const v = [];
    for (let d = 0; d < dim; d++) v.push(i & (1 << d) ? 1 : -1);
    verts.push(v);
  }
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let d = 0;
      for (let k = 0; k < dim; k++) if (verts[i][k] !== verts[j][k]) d++;
      if (d === 1) edges.push([i, j]);
    }
  }
  return { verts, edges };
}

function regularSimplex(dim) {
  const n = dim + 1;
  const raw = [];
  for (let i = 0; i < n; i++) {
    const v = new Array(n).fill(0);
    v[i] = 1;
    raw.push(v);
  }
  const centered = raw.map((v) => {
    const s = v.reduce((a, b) => a + b, 0) / n;
    return v.map((x) => x - s);
  });
  const axes = [];
  for (let a = 0; a < n && axes.length < dim; a++) {
    let vec = new Array(n).fill(0);
    vec[a] = 1;
    const mean = 1 / n;
    vec = vec.map((x) => x - mean);
    for (const ax of axes) {
      const dot = vec.reduce((s, x, i) => s + x * ax[i], 0);
      vec = vec.map((x, i) => x - dot * ax[i]);
    }
    const norm = Math.hypot(...vec);
    if (norm < 1e-9) continue;
    axes.push(vec.map((x) => x / norm));
  }
  const verts = centered.map((v) => {
    const out = axes.map((ax) => v.reduce((s, x, i) => s + x * ax[i], 0));
    return out;
  });
  let max = 0;
  for (const v of verts) max = Math.max(max, Math.hypot(...v));
  for (const v of verts) for (let k = 0; k < dim; k++) v[k] = (v[k] / max) * 1.35;
  const edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push([i, j]);
  return { verts, edges };
}

function orthoplex(dim) {
  const verts = [];
  for (let i = 0; i < dim; i++) {
    const a = new Array(dim).fill(0); a[i] = 1; verts.push(a);
    const b = new Array(dim).fill(0); b[i] = -1; verts.push(b);
  }
  const edges = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      let dot = 0;
      for (let k = 0; k < dim; k++) dot += verts[i][k] * verts[j][k];
      if (dot === 0) edges.push([i, j]);
    }
  }
  return { verts, edges };
}

function cell24() {
  const verts = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      for (const si of [1, -1]) {
        for (const sj of [1, -1]) {
          const v = [0, 0, 0, 0];
          v[i] = si; v[j] = sj;
          verts.push(v);
        }
      }
    }
  }
  const edges = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      let d2 = 0;
      for (let k = 0; k < 4; k++) {
        const d = verts[i][k] - verts[j][k];
        d2 += d * d;
      }
      if (Math.abs(d2 - 2) < 1e-6) edges.push([i, j]);
    }
  }
  return { verts, edges };
}

function buildShape(id) {
  if (id === "tesseract") return hypercube(4);
  if (id === "penteract") return hypercube(5);
  if (id === "pentachoron") return regularSimplex(4);
  if (id === "pentasimplex") return regularSimplex(5);
  if (id === "hexadecachoron") return orthoplex(4);
  if (id === "pentacross") return orthoplex(5);
  if (id === "icositetrachoron") return cell24();
  return hypercube(4);
}

const PLANES = [
  ["XY", 0, 1], ["XZ", 0, 2], ["YZ", 1, 2],
  ["XW", 0, 3], ["YW", 1, 3], ["ZW", 2, 3],
  ["XV", 0, 4], ["YV", 1, 4], ["ZV", 2, 4], ["WV", 3, 4],
];

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Shape</label><b id="mShape">Tesseract</b></div>
      <div class="metric"><label>Dim</label><b id="mDim">4</b></div>
      <div class="metric"><label>Vertices</label><b id="mV">16</b></div>
      <div class="metric"><label>Edges</label><b id="mE">32</b></div>
      <div class="metric"><label>Auto-spin</label><b id="mSpin">on</b></div>
    </div>
    <div class="header-actions">
      <button id="btnSpin" class="primary">Toggle spin</button>
      <button id="btnReset">Zero angles</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Polytope</h2>
      <div class="seg" id="shapeSeg">
        <button data-shape="tesseract" class="active">Tesseract</button>
        <button data-shape="pentachoron">5-cell</button>
        <button data-shape="hexadecachoron">16-cell</button>
        <button data-shape="icositetrachoron">24-cell</button>
        <button data-shape="penteract">5-cube</button>
        <button data-shape="pentasimplex">5-simplex</button>
        <button data-shape="pentacross">5-orthoplex</button>
      </div>
    </div>
    <div class="section">
      <h2>Projection</h2>
      <div class="row"><label>W perspective</label><span class="val" id="vW">2.6</span></div>
      <input type="range" id="rW" min="1.6" max="7" step="0.05" value="2.6" />
      <div class="row"><label>V perspective</label><span class="val" id="vV">3.1</span></div>
      <input type="range" id="rV" min="1.6" max="7" step="0.05" value="3.1" />
      <div class="row"><label>Scale</label><span class="val" id="vS">1.00</span></div>
      <input type="range" id="rS" min="0.4" max="2.2" step="0.02" value="1" />
      <div class="row"><label><input type="checkbox" id="cFaces" checked /> Cell faces</label></div>
    </div>
    <div class="section" id="planeSliders"></div>
    <div class="section">
      <h2>How this works</h2>
      <p class="help">
        Vertices live in 4- or 5-space. We rotate in a coordinate plane, then
        project extra axes with a perspective divide x′ = x / (1 + w / d).
        Color encodes the hidden W (and V) coordinate.
      </p>
    </div>
  </aside>
  <div id="viewport">
    <div class="overlay-hud">Orbit the 3D projection · extra dimensions are the sliders</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>About this shape</h2>
      <p class="help" id="shapeBlurb"></p>
    </div>
    <div class="section">
      <h2>Rotation planes</h2>
      <p class="help ndim-legend">
        XY, XZ, YZ live in ordinary space.<br/>
        XW, YW, ZW mix the 4th axis W.<br/>
        XV…WV appear on 5D shapes only.
      </p>
    </div>
  </div>
</div>
`;

function rotatePair(v, i, j, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const vi = v[i] || 0, vj = v[j] || 0;
  v[i] = vi * c - vj * s;
  v[j] = vi * s + vj * c;
}

function tesseractSquares(verts) {
  const squares = [];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      for (const sa of [-1, 1]) {
        for (const sb of [-1, 1]) {
          const idx = [];
          verts.forEach((v, i) => { if (v[a] === sa && v[b] === sb) idx.push(i); });
          if (idx.length === 4) squares.push(idx);
        }
      }
    }
  }
  return squares;
}

export function mount(root, ctx) {
  const toast = (ctx && ctx.toast) || (() => {});
  const setStatus = (ctx && ctx.setStatus) || (() => {});
  const settings = (ctx && ctx.settings) || {};
  const quality = settings.quality || "high";
  const aa = settings.antialias !== false && quality !== "low";
  const pr = quality === "high" ? Math.min(devicePixelRatio, 1.6) : quality === "medium" ? 1.1 : 0.9;

  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id);
  const ac = new AbortController();
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ac.signal });

  const st = {
    id: "tesseract",
    angles: Object.fromEntries(PLANES.map((p) => [p[0], 0])),
    auto: { XW: 0.32, YW: 0.18, ZV: 0.14, WV: 0.1 },
    spinning: !settings.reducedMotion,
    dW: 2.6,
    dV: 3.1,
    scale: 1,
    faces: true,
  };

  const planeBox = $("planeSliders");
  planeBox.innerHTML = `<h2>Rotation planes</h2>` + PLANES.map(([name]) => `
    <div class="row plane-row" data-plane="${name}"><label>${name}</label><span class="val" id="v${name}">0°</span></div>
    <input type="range" id="r${name}" min="-180" max="180" step="1" value="0" data-plane="${name}" />
  `).join("");

  const viewport = $("viewport");
  const renderer = new THREE.WebGLRenderer({ antialias: aa, powerPreference: "high-performance" });
  renderer.setPixelRatio(pr);
  renderer.setSize(Math.max(4, viewport.clientWidth), Math.max(4, viewport.clientHeight), false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40);
  camera.position.set(2.8, 1.9, 3.3);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !settings.reducedMotion;
  scene.add(new THREE.HemisphereLight(0xd8ecff, 0x1a140c, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(3, 4, 2);
  scene.add(key);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 2.46, 64),
    new THREE.MeshBasicMaterial({ color: 0x243044, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.35;
  scene.add(ring);

  const linePos = new THREE.BufferAttribute(new Float32Array(240 * 6), 3);
  const lineCol = new THREE.BufferAttribute(new Float32Array(240 * 6), 3);
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 })
  );
  lines.geometry.setAttribute("position", linePos);
  lines.geometry.setAttribute("color", lineCol);
  scene.add(lines);

  const dots = new THREE.Group();
  scene.add(dots);
  const facesMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshPhongMaterial({
      color: 0x7a5cff, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false, shininess: 40,
    })
  );
  scene.add(facesMesh);

  const sphereGeo = new THREE.SphereGeometry(0.055, 14, 10);
  let mesh = buildShape(st.id);
  let projected = [];

  function colorFor(w, vv, dim) {
    const t = 0.5 + 0.5 * Math.tanh(w * 0.7);
    const u = dim >= 5 ? 0.5 + 0.5 * Math.tanh(vv * 0.7) : 0.35;
    return new THREE.Color().setHSL(0.72 - t * 0.28, 0.7, 0.45 + u * 0.18);
  }

  function setShape(id) {
    st.id = id;
    mesh = buildShape(id);
    const meta = SHAPES[id];
    $("mShape").textContent = meta.name.split(" ")[0];
    $("mDim").textContent = String(meta.dim);
    $("mV").textContent = String(mesh.verts.length);
    $("mE").textContent = String(mesh.edges.length);
    $("shapeBlurb").textContent = meta.blurb;
    root.querySelectorAll("#shapeSeg [data-shape]").forEach((b) => b.classList.toggle("active", b.dataset.shape === id));
    planeBox.querySelectorAll("[data-plane]").forEach((el) => {
      const name = el.dataset.plane;
      const need = name.includes("V") ? meta.dim >= 5 : name.includes("W") ? meta.dim >= 4 : true;
      el.style.display = need ? "" : "none";
    });
    while (dots.children.length) {
      const c = dots.children[0];
      dots.remove(c);
      c.material.dispose();
    }
    for (let i = 0; i < mesh.verts.length; i++) {
      const m = new THREE.Mesh(sphereGeo, new THREE.MeshPhongMaterial({
        color: 0x7af0c8, emissive: 0x1a3a30, shininess: 80,
      }));
      dots.add(m);
    }
    setStatus(meta.name + " · " + mesh.verts.length + " verts / " + mesh.edges.length + " edges");
    Bus.set("nd", { shape: id, dim: meta.dim, verts: mesh.verts.length, edges: mesh.edges.length });
  }
  setShape("tesseract");

  function project() {
    const dim = SHAPES[st.id].dim;
    projected = mesh.verts.map((src) => {
      const v = src.slice();
      while (v.length < 5) v.push(0);
      for (const [name, i, j] of PLANES) {
        if (j >= dim) continue;
        rotatePair(v, i, j, st.angles[name]);
      }
      let x = v[0], y = v[1], z = v[2];
      const w = v[3] || 0;
      const vv = v[4] || 0;
      const kw = 1 / Math.max(0.15, 1 + w / st.dW);
      x *= kw; y *= kw; z *= kw;
      if (dim >= 5) {
        const kv = 1 / Math.max(0.15, 1 + vv / st.dV);
        x *= kv; y *= kv; z *= kv;
      }
      return { x: x * st.scale, y: y * st.scale, z: z * st.scale, w, vv };
    });

    const ecount = mesh.edges.length;
    for (let i = 0; i < ecount; i++) {
      const [a, b] = mesh.edges[i];
      const pa = projected[a], pb = projected[b];
      const o = i * 6;
      linePos.array[o] = pa.x; linePos.array[o + 1] = pa.y; linePos.array[o + 2] = pa.z;
      linePos.array[o + 3] = pb.x; linePos.array[o + 4] = pb.y; linePos.array[o + 5] = pb.z;
      const ca = colorFor(pa.w, pa.vv, dim);
      const cb = colorFor(pb.w, pb.vv, dim);
      lineCol.array[o] = ca.r; lineCol.array[o + 1] = ca.g; lineCol.array[o + 2] = ca.b;
      lineCol.array[o + 3] = cb.r; lineCol.array[o + 4] = cb.g; lineCol.array[o + 5] = cb.b;
    }
    lines.geometry.setDrawRange(0, ecount * 2);
    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;

    projected.forEach((p, i) => {
      const d = dots.children[i];
      if (!d) return;
      d.position.set(p.x, p.y, p.z);
      d.material.color.copy(colorFor(p.w, p.vv, dim));
    });

    if (st.faces && st.id === "tesseract") {
      const faces = tesseractSquares(mesh.verts);
      const pos = [];
      for (const face of faces) {
        const pts = face.map((i) => projected[i]);
        const mid = {
          x: pts.reduce((s, p) => s + p.x, 0) / 4,
          y: pts.reduce((s, p) => s + p.y, 0) / 4,
          z: pts.reduce((s, p) => s + p.z, 0) / 4,
        };
        pts.sort((p, q) => Math.atan2(p.y - mid.y, p.x - mid.x) - Math.atan2(q.y - mid.y, q.x - mid.x));
        const A = pts[0], B = pts[1], C = pts[2], D = pts[3];
        pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
        pos.push(A.x, A.y, A.z, C.x, C.y, C.z, D.x, D.y, D.z);
      }
      facesMesh.geometry.dispose();
      facesMesh.geometry = new THREE.BufferGeometry();
      facesMesh.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
      facesMesh.geometry.computeVertexNormals();
      facesMesh.visible = true;
    } else {
      facesMesh.visible = false;
    }
  }

  on($("shapeSeg"), "click", (e) => {
    const b = e.target.closest("[data-shape]");
    if (b) { setShape(b.dataset.shape); toast(SHAPES[st.id].name); }
  });
  on($("rW"), "input", (e) => { st.dW = parseFloat(e.target.value); $("vW").textContent = st.dW.toFixed(2); });
  on($("rV"), "input", (e) => { st.dV = parseFloat(e.target.value); $("vV").textContent = st.dV.toFixed(2); });
  on($("rS"), "input", (e) => { st.scale = parseFloat(e.target.value); $("vS").textContent = st.scale.toFixed(2); });
  on($("cFaces"), "change", (e) => { st.faces = e.target.checked; });
  PLANES.forEach(([name]) => {
    on($("r" + name), "input", (e) => {
      st.angles[name] = parseFloat(e.target.value) * Math.PI / 180;
      $("v" + name).textContent = e.target.value + "°";
    });
  });
  on($("btnSpin"), "click", () => {
    st.spinning = !st.spinning;
    $("mSpin").textContent = st.spinning ? "on" : "off";
  });
  on($("btnReset"), "click", () => {
    for (const [name] of PLANES) {
      st.angles[name] = 0;
      const el = $("r" + name);
      if (el) el.value = 0;
      const lab = $("v" + name);
      if (lab) lab.textContent = "0°";
    }
  });
  $("mSpin").textContent = st.spinning ? "on" : "off";
  const unbindView = bindViewport(viewport, camera, renderer);

  const clock = new THREE.Clock();
  let raf = 0;
  const ctl = { paused: false };
  function frame() {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    if (ctl.paused) return;
    const dt = Math.min(0.05, clock.getDelta());
    if (st.spinning) {
      for (const key of Object.keys(st.auto)) {
        if (key.includes("V") && SHAPES[st.id].dim < 5) continue;
        st.angles[key] += st.auto[key] * dt;
        const deg = ((st.angles[key] * 180 / Math.PI + 180) % 360) - 180;
        const el = $("r" + key), lab = $("v" + key);
        if (el) el.value = deg.toFixed(0);
        if (lab) lab.textContent = deg.toFixed(0) + "°";
      }
    }
    project();
    controls.update();
    renderer.render(scene, camera);
  }
  frame();
  toast("4D / 5D lab — " + Object.keys(SHAPES).length + " polytopes");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      unbindView();
      disposeThree(renderer, scene);
      root.innerHTML = "";
    },
  };
}
