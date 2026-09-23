/**
 * HSN-Sim EM Lab — temporary electromagnet laboratory
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as CANNON from "cannon-es";
import { bindViewport, disposeThree } from "../runtime.js";
import { Bus } from "../bus.js";

const TEMPLATE = `
<div class="lab-frame" id="app">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Voltage</label><b id="mV">12.0 V</b></div>
      <div class="metric"><label>Current</label><b id="mI">0.00 A</b></div>
      <div class="metric"><label>Field B</label><b id="mB">0.00 T</b></div>
      <div class="metric"><label>Amp-turns</label><b id="mNI">0</b></div>
      <div class="metric"><label>Force peak</label><b id="mF">0.00 N</b></div>
      <div class="metric"><label>Coil temp</label><b id="mT">24 °C</b></div>
      <div class="metric"><label>Frame</label><b id="mFps">— fps</b></div>
    </div>
    <div class="power-toggle">
      <span id="powerLabel" style="color:#8b9bb0">STANDBY</span>
      <div class="switch" id="powerSwitch" title="Energize coil"></div>
    </div>
    <div class="header-actions">
      <button id="btnReset">Reset scene</button>
      <button class="primary" id="btnDemo">Run demo</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Coil drive</h2>
      <div class="row"><label>Supply voltage</label><span class="val" id="vVoltage">12.0 V</span></div>
      <input type="range" id="rVoltage" min="0" max="48" step="0.5" value="12" />
      <div class="row"><label>Turns N</label><span class="val" id="vTurns">400</span></div>
      <input type="range" id="rTurns" min="20" max="1200" step="10" value="400" />
      <div class="row"><label>Coil resistance</label><span class="val" id="vR">8.0 Ω</span></div>
      <input type="range" id="rR" min="0.5" max="40" step="0.1" value="8" />
      <div class="row"><label>Solenoid length</label><span class="val" id="vL">80 mm</span></div>
      <input type="range" id="rL" min="30" max="180" step="2" value="80" />
      <div class="row"><label>Core μr</label><span class="val" id="vMu">200</span></div>
      <input type="range" id="rMu" min="1" max="2000" step="1" value="200" />
      <select id="sCore">
        <option value="1">Air core (μr ≈ 1)</option>
        <option value="200" selected>Soft iron (temporary)</option>
        <option value="400">Silicon steel</option>
        <option value="800">Ferrite</option>
        <option value="2000">Permalloy</option>
      </select>
    </div>
    <div class="section">
      <h2>Physics & graphics</h2>
      <div class="row"><label>Gravity</label><span class="val" id="vG">9.81 m/s²</span></div>
      <input type="range" id="rG" min="0" max="20" step="0.01" value="9.81" />
      <div class="row"><label>Time scale</label><span class="val" id="vTs">1.00×</span></div>
      <input type="range" id="rTs" min="0.1" max="2" step="0.05" value="1" />
      <div class="row"><label>Field viz intensity</label><span class="val" id="vFv">70%</span></div>
      <input type="range" id="rFv" min="0" max="100" step="1" value="70" />
      <div class="row"><label><input type="checkbox" id="cField" checked /> Field lines</label></div>
      <div class="row"><label><input type="checkbox" id="cGlow" checked /> Coil energize glow</label></div>
      <div class="row"><label><input type="checkbox" id="cTrail" /> Motion trails</label></div>
      <div class="row"><label><input type="checkbox" id="cShadows" /> Shadows</label></div>
      <div class="row"><label><input type="checkbox" id="cColliders" /> Show colliders</label></div>
      <div class="row"><label><input type="checkbox" id="cFast" checked /> Fast graphics</label></div>
    </div>
    <div class="section">
      <h2>Spawn object</h2>
      <div class="grid-2" id="spawnGrid">
        <div class="chip" data-type="ironSphere">Iron sphere</div>
        <div class="chip" data-type="steelNail">Steel nail</div>
        <div class="chip" data-type="paperclip">Paperclip</div>
        <div class="chip" data-type="woodBlock">Wood block</div>
        <div class="chip" data-type="aluCube">Aluminum cube</div>
        <div class="chip" data-type="chain">Link chain</div>
        <div class="chip" data-type="ragdoll">Ragdoll figure</div>
        <div class="chip" data-type="plate">Steel plate</div>
      </div>
    </div>
    <div class="section">
      <h2>Scene files</h2>
      <p class="help">Import / export a JSON scene with objects, magnet pose, and coil settings.</p>
      <div class="file-row">
        <button id="btnExport">Export .json</button>
        <button id="btnImport">Import .json</button>
      </div>
      <input type="file" id="fileIn" accept="application/json,.json" hidden />
      <div id="dropzone">Drop an HSN-Sim scene JSON here</div>
    </div>
  </aside>
  <div id="viewport">
    <div class="overlay-hud" id="hud">
      EM Lab · drag object · wheel while held = lift · LMB empty = orbit
    </div>
    <div class="legend">
      <div><i style="background:#c4cdd6"></i>Ferromagnetic</div>
      <div><i style="background:#9aa7b8"></i>Paramagnetic / weak</div>
      <div><i style="background:#7a5a32"></i>Non-magnetic</div>
      <div><i style="background:#3ec7ff"></i>Energized coil</div>
    </div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Selection</h2>
      <div id="selNone" class="help">No object selected. Click a body in the viewport.</div>
      <div id="selBox" style="display:none">
        <div class="row"><label>Name</label><b id="sName">—</b></div>
        <div class="row"><label>Material</label><span class="val" id="sMat">—</span></div>
        <div class="row"><label>Mass</label><span class="val" id="sMass">—</span></div>
        <div class="row"><label>μᵣ / χ_eff</label><span class="val" id="sChi">—</span></div>
        <div class="row"><label>Speed</label><span class="val" id="sSpd">—</span></div>
        <div class="row"><label>Force</label><span class="val" id="sForce">—</span></div>
        <button id="btnDelete" class="danger" style="width:100%;margin-top:8px">Remove object</button>
      </div>
    </div>
    <div class="section">
      <h2>Theory (temporary magnet)</h2>
      <p class="help">Soft-iron core is a magnetized cylinder (M saturates ~1.6 MA/m). Force uses demagnetization:</p>
      <p class="help" style="font-family:var(--mono);color:#7af0c8;margin:8px 0">
        χ_eff = 3(μᵣ−1)/(μᵣ+2)<br />F = ∇(m · B) + contact B²A/2μ₀
      </p>
      <p class="help">Aluminum and wood have μᵣ ≈ 1, so they do not lift. Power off → M → 0.</p>
    </div>
  </div>
</div>
`;

export function mount(root, ctx) {
  const toast = (ctx && ctx.toast) || (() => {});
  const settings = (ctx && ctx.settings) || {};
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id) || document.getElementById(id);
  const ac = new AbortController();
  const on = (el, ev, fn, opt) => {
    if (!el) return;
    el.addEventListener(ev, fn, { ...(opt || {}), signal: ac.signal });
  };
  const ctl = { paused: false };

  const MU0 = 1.2566370614e-6;
  const TWO_MU0 = 2 * MU0;
  const MS_IRON = 1.6e6;
  const CORE_R = 0.028;
  const POLE = { x: 0, y: 0.152, z: 0 };
  const MAG_DROP = 0.133;
  const GROUP_STATIC = 1;
  const GROUP_DYN = 2;

  const state = {
    powered: false, voltage: 12, turns: 400, resistance: 8, length: 0.08, muR: 200,
    gravity: 9.81, timeScale: 1, fieldViz: 0.7, showField: true, showGlow: true,
    trails: false, shadows: false, showColliders: false, fastGfx: true,
    current: 0, targetCurrent: 0, Bcore: 0, Bgap: 0, moment: 0, peakForce: 0,
    tempC: 24, saturated: false, selected: null, objects: [], constraints: [], fps: 0,
  };

  const MATERIALS = {
    ironSphere: { name: "Soft iron sphere", muR: 250, density: 7870, color: 0xb8c2cc, magnetic: true },
    steelNail: { name: "Mild-steel nail", muR: 400, density: 7850, color: 0x9aa3ad, magnetic: true },
    paperclip: { name: "Steel paperclip", muR: 200, density: 7800, color: 0xd0d5dc, magnetic: true },
    woodBlock: { name: "Hardwood block", muR: 1, density: 650, color: 0x7a5a32, magnetic: false },
    aluCube: { name: "Aluminum cube", muR: 1.000022, density: 2700, color: 0x9aa7b8, magnetic: false },
    plate: { name: "Low-carbon steel plate", muR: 500, density: 7850, color: 0x8e99a6, magnetic: true },
    chain: { name: "Steel chain link", muR: 300, density: 7850, color: 0xa8b0b8, magnetic: true },
    ragdoll: { name: "Composite figure", muR: 8, density: 1100, color: 0x6ea0c8, magnetic: true },
  };

  function chiEff(muR) {
    if (muR <= 1.000001) return Math.max(0, muR - 1);
    return (3 * (muR - 1)) / (muR + 2);
  }

  const viewport = $("viewport");
  const quality = settings.quality || "high";
  const aa = settings.antialias !== false && quality !== "low";
  const renderer = new THREE.WebGLRenderer({ antialias: aa, powerPreference: "high-performance" });
  renderer.setPixelRatio(quality === "high" ? Math.min(devicePixelRatio || 1, 1.5) : 1);
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const camera = new THREE.PerspectiveCamera(50, viewport.clientWidth / Math.max(1, viewport.clientHeight), 0.05, 40);
  camera.position.set(1.35, 1.05, 1.65);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.32, 0);
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 0.45;
  controls.maxDistance = 7;

  scene.add(new THREE.HemisphereLight(0xb7d4f0, 0x1a140c, 1.05));
  const key = new THREE.DirectionalLight(0xfff2dc, 0.85);
  key.position.set(2.2, 3.6, 1.4);
  scene.add(key);
  const coilLight = new THREE.PointLight(0xff7a3c, 0, 1.8, 2);
  coilLight.position.set(0, 0.22, 0);
  scene.add(coilLight);

  const lambert = (color, emissive = 0x000000) =>
    new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 0 });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 24), lambert(0x141c26));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(5, 16, 0x243044, 0x16202c);
  grid.position.y = 0.001;
  scene.add(grid);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.86), lambert(0x1c2734));
  bench.position.set(0, 0.03, 0);
  scene.add(bench);

  const magnetGroup = new THREE.Group();
  magnetGroup.position.y = -MAG_DROP;
  scene.add(magnetGroup);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.048, 0.42, 8), lambert(0x2a3544));
  stand.position.set(0, 0.27, -0.28);
  magnetGroup.add(stand);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.36), lambert(0x334155));
  arm.position.set(0, 0.46, -0.12);
  magnetGroup.add(arm);
  const coreMat = lambert(0x6b7380, 0x1a3a48);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(CORE_R, CORE_R, 0.16, 10), coreMat);
  core.position.set(0, 0.38, 0);
  magnetGroup.add(core);
  const coilMat = lambert(0x8a4b1e, 0xff6a2a);
  const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.11, 10), coilMat);
  coil.position.set(0, 0.38, 0);
  magnetGroup.add(coil);
  const poleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 10), lambert(0x9aa3ae));
  poleCap.position.set(0, POLE.y, 0);
  magnetGroup.add(poleCap);

  const FIELD_COUNT = 8, FIELD_SEGS = 10;
  const fieldGroup = new THREE.Group();
  scene.add(fieldGroup);
  const fieldLines = [];
  {
    const pts = new Float32Array(FIELD_SEGS * 3);
    for (let i = 0; i < FIELD_COUNT; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pts.slice(), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3ec7ff, transparent: true, opacity: 0.4 }));
      fieldGroup.add(line);
      fieldLines.push({ line, seed: (i / FIELD_COUNT) * Math.PI * 2 });
    }
  }

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 16;
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.55;
  world.defaultContactMaterial.restitution = 0.05;

  const matStatic = new CANNON.Material("static");
  const matDyn = new CANNON.Material("dyn");
  world.addContactMaterial(new CANNON.ContactMaterial(matStatic, matDyn, { friction: 0.55, restitution: 0.04 }));
  world.addContactMaterial(new CANNON.ContactMaterial(matDyn, matDyn, { friction: 0.4, restitution: 0.08 }));

  function staticBody() {
    const b = new CANNON.Body({ mass: 0, material: matStatic, type: CANNON.Body.STATIC });
    b.collisionFilterGroup = GROUP_STATIC;
    b.collisionFilterMask = GROUP_DYN;
    return b;
  }
  function addYCylinder(body, rt, rb, h, x, y, z) {
    const shape = new CANNON.Cylinder(rt, rb, h, 8);
    const q = new CANNON.Quaternion();
    q.setFromEuler(-Math.PI / 2, 0, 0);
    body.addShape(shape, new CANNON.Vec3(x, y, z), q);
  }

  const groundBody = staticBody();
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);
  const benchBody = staticBody();
  benchBody.addShape(new CANNON.Box(new CANNON.Vec3(0.75, 0.03, 0.43)));
  benchBody.position.set(0, 0.03, 0);
  world.addBody(benchBody);
  const magnetBody = staticBody();
  addYCylinder(magnetBody, 0.048, 0.048, 0.42, 0, 0.27 - MAG_DROP, -0.28);
  magnetBody.addShape(new CANNON.Box(new CANNON.Vec3(0.03, 0.02, 0.18)), new CANNON.Vec3(0, 0.46 - MAG_DROP, -0.12));
  addYCylinder(magnetBody, 0.05, 0.05, 0.17, 0, 0.38 - MAG_DROP, 0);
  addYCylinder(magnetBody, 0.033, 0.033, 0.016, 0, POLE.y, 0);
  world.addBody(magnetBody);

  const colliderHelper = new THREE.Group();
  colliderHelper.visible = false;
  scene.add(colliderHelper);

  let idSeq = 1;
  const _qY = new CANNON.Quaternion();
  _qY.setFromEuler(-Math.PI / 2, 0, 0);

  function configureDyn(body) {
    body.material = matDyn;
    body.collisionFilterGroup = GROUP_DYN;
    body.collisionFilterMask = GROUP_STATIC | GROUP_DYN;
    body.linearDamping = 0.18;
    body.angularDamping = 0.28;
    body.allowSleep = true;
  }

  function addSimObject({ type, position, extra = {} }) {
    const spec = { ...(MATERIALS[type] || MATERIALS.ironSphere) };
    if (extra.muR) spec.muR = extra.muR;
    if (extra.name) spec.name = extra.name;
    const id = extra.id || `obj-${idSeq++}`;
    let mesh, body, volume, faceArea;
    if (type === "ironSphere") {
      const r = extra.r || 0.02;
      volume = (4 / 3) * Math.PI * r ** 3;
      faceArea = Math.PI * r * r;
      mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), lambert(spec.color));
      body = new CANNON.Body({ mass: Math.max(0.02, volume * spec.density), shape: new CANNON.Sphere(r) });
    } else if (type === "steelNail") {
      const r = 0.0035, h = 0.07;
      volume = Math.PI * r * r * h;
      faceArea = Math.PI * r * r;
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.35, h, 6), lambert(spec.color));
      body = new CANNON.Body({ mass: Math.max(0.008, volume * spec.density) });
      body.addShape(new CANNON.Cylinder(r, r * 0.4, h, 6), new CANNON.Vec3(0, 0, 0), _qY);
    } else if (type === "paperclip") {
      volume = 2 * Math.PI * 0.014 * Math.PI * 0.0022 ** 2;
      faceArea = 0.00012;
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0024, 6, 10), lambert(spec.color));
      body = new CANNON.Body({ mass: Math.max(0.003, volume * spec.density), shape: new CANNON.Sphere(0.015) });
    } else if (type === "woodBlock") {
      const s = extra.s || [0.07, 0.036, 0.045];
      volume = s[0] * s[1] * s[2];
      faceArea = s[0] * s[2];
      mesh = new THREE.Mesh(new THREE.BoxGeometry(...s), lambert(spec.color));
      body = new CANNON.Body({ mass: volume * spec.density, shape: new CANNON.Box(new CANNON.Vec3(s[0] / 2, s[1] / 2, s[2] / 2)) });
    } else if (type === "aluCube") {
      const a = extra.a || 0.045;
      volume = a ** 3;
      faceArea = a * a;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(a, a, a), lambert(spec.color));
      body = new CANNON.Body({ mass: volume * spec.density, shape: new CANNON.Box(new CANNON.Vec3(a / 2, a / 2, a / 2)) });
    } else if (type === "plate") {
      const s = [0.1, 0.006, 0.07];
      volume = s[0] * s[1] * s[2];
      faceArea = s[0] * s[2];
      mesh = new THREE.Mesh(new THREE.BoxGeometry(...s), lambert(spec.color));
      body = new CANNON.Body({ mass: volume * spec.density, shape: new CANNON.Box(new CANNON.Vec3(s[0] / 2, s[1] / 2, s[2] / 2)) });
    } else if (type === "chain") {
      const r = 0.012, tube = 0.004;
      volume = 2 * Math.PI * r * Math.PI * tube * tube;
      faceArea = Math.PI * (r + tube) ** 2 * 0.25;
      mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 8), lambert(spec.color));
      body = new CANNON.Body({ mass: Math.max(0.01, volume * spec.density), shape: new CANNON.Sphere(r + tube) });
    } else {
      const s = extra.size || [0.04, 0.04, 0.04];
      volume = s[0] * s[1] * s[2];
      faceArea = s[0] * s[2];
      mesh = new THREE.Mesh(new THREE.BoxGeometry(...s), lambert(spec.color));
      body = new CANNON.Body({ mass: Math.max(0.02, volume * spec.density), shape: new CANNON.Box(new CANNON.Vec3(s[0] / 2, s[1] / 2, s[2] / 2)) });
    }
    configureDyn(body);
    mesh.userData.id = id;
    const p = position || { x: (Math.random() - 0.5) * 0.5, y: 0.5, z: 0.15 + Math.random() * 0.15 };
    mesh.position.set(p.x, p.y, p.z);
    body.position.set(p.x, p.y, p.z);
    if (extra.quat) body.quaternion.set(extra.quat.x, extra.quat.y, extra.quat.z, extra.quat.w);
    world.addBody(body);
    scene.add(mesh);
    const obj = { id, type, mesh, body, spec, volume, faceArea, lastForce: new THREE.Vector3(), trail: null };
    if (state.trails) attachTrail(obj);
    state.objects.push(obj);
    return obj;
  }

  function attachTrail(obj) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(20 * 3), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7af0c8, transparent: true, opacity: 0.3 }));
    scene.add(line);
    obj.trail = { line, hist: [] };
  }

  function spawnChain(origin) {
    const links = [];
    let prev = null;
    for (let i = 0; i < 6; i++) {
      const obj = addSimObject({ type: "chain", position: { x: origin.x, y: origin.y - i * 0.036, z: origin.z } });
      if (prev) {
        const c = new CANNON.DistanceConstraint(prev.body, obj.body, 0.034);
        world.addConstraint(c);
        state.constraints.push(c);
      }
      prev = obj;
      links.push(obj);
    }
    return links;
  }

  function spawnRagdoll(origin) {
    const parts = [];
    const makePart = (name, pos, size, muR) => {
      const obj = addSimObject({ type: "ragdoll", position: pos, extra: { size, name, muR } });
      parts.push(obj);
      return obj;
    };
    const torso = makePart("Torso", { x: origin.x, y: origin.y, z: origin.z }, [0.06, 0.09, 0.036], 12);
    const head = makePart("Head", { x: origin.x, y: origin.y + 0.075, z: origin.z }, [0.04, 0.04, 0.04], 4);
    const armL = makePart("Arm L", { x: origin.x - 0.055, y: origin.y + 0.015, z: origin.z }, [0.026, 0.07, 0.026], 8);
    const armR = makePart("Arm R", { x: origin.x + 0.055, y: origin.y + 0.015, z: origin.z }, [0.026, 0.07, 0.026], 8);
    const legL = makePart("Leg L", { x: origin.x - 0.02, y: origin.y - 0.09, z: origin.z }, [0.028, 0.09, 0.028], 14);
    const legR = makePart("Leg R", { x: origin.x + 0.02, y: origin.y - 0.09, z: origin.z }, [0.028, 0.09, 0.028], 14);
    const hinge = (a, b, pivotA, pivotB) => {
      const c = new CANNON.HingeConstraint(a.body, b.body, {
        pivotA: new CANNON.Vec3(...pivotA), pivotB: new CANNON.Vec3(...pivotB),
        axisA: new CANNON.Vec3(1, 0, 0), axisB: new CANNON.Vec3(1, 0, 0), maxForce: 80,
      });
      world.addConstraint(c);
      state.constraints.push(c);
    };
    hinge(torso, head, [0, 0.05, 0], [0, -0.022, 0]);
    hinge(torso, armL, [-0.034, 0.032, 0], [0, 0.032, 0]);
    hinge(torso, armR, [0.034, 0.032, 0], [0, 0.032, 0]);
    hinge(torso, legL, [-0.018, -0.048, 0], [0, 0.045, 0]);
    hinge(torso, legR, [0.018, -0.048, 0], [0, 0.045, 0]);
    return parts;
  }

  const grabBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
  grabBody.collisionFilterGroup = 0;
  grabBody.collisionFilterMask = 0;
  world.addBody(grabBody);
  const drag = { obj: null, constraint: null, plane: new THREE.Plane(), height: 0.12, last: new THREE.Vector3(), vel: new THREE.Vector3() };

  function endDrag(throwOnRelease = true) {
    if (!drag.obj) return;
    if (drag.constraint) { world.removeConstraint(drag.constraint); drag.constraint = null; }
    const o = drag.obj;
    o.body.allowSleep = true;
    if (throwOnRelease) o.body.velocity.set(drag.vel.x * 18, drag.vel.y * 18, drag.vel.z * 18);
    drag.obj = null;
    controls.enabled = true;
    renderer.domElement.style.cursor = "default";
  }

  function clearDynamic() {
    endDrag(false);
    for (const c of state.constraints) world.removeConstraint(c);
    state.constraints.length = 0;
    for (const o of state.objects) {
      world.removeBody(o.body);
      scene.remove(o.mesh);
      if (o.trail) scene.remove(o.trail.line);
    }
    state.objects.length = 0;
    state.selected = null;
    updateInspector();
  }

  function seedDefaultScene() {
    clearDynamic();
    addSimObject({ type: "ironSphere", position: { x: 0.045, y: 0.095, z: 0.05 } });
    addSimObject({ type: "ironSphere", position: { x: -0.05, y: 0.095, z: 0.04 } });
    addSimObject({ type: "steelNail", position: { x: 0.02, y: 0.11, z: 0.08 } });
    addSimObject({ type: "paperclip", position: { x: -0.02, y: 0.09, z: 0.1 } });
    addSimObject({ type: "woodBlock", position: { x: 0.28, y: 0.1, z: 0.16 } });
    addSimObject({ type: "aluCube", position: { x: -0.28, y: 0.1, z: 0.16 } });
    addSimObject({ type: "plate", position: { x: 0.12, y: 0.09, z: 0.12 } });
  }

  const _B = new THREE.Vector3(), _Bp = new THREE.Vector3(), _f = new THREE.Vector3();

  function updateMagnetState() {
    const L = Math.max(0.03, state.length);
    const Rhot = state.resistance * (1 + Math.max(0, state.tempC - 24) * 0.0039);
    state.targetCurrent = state.powered ? state.voltage / Math.max(0.25, Rhot) : 0;
    const Lcoil = MU0 * (state.turns ** 2) * Math.PI * CORE_R * CORE_R / L * Math.min(12, Math.sqrt(state.muR));
    const tau = Math.max(0.008, Lcoil / Math.max(0.25, Rhot));
    return { Rhot, tau, L };
  }

  function sampleB(out, x, y, z) {
    const L = Math.max(0.03, state.length);
    const vol = Math.PI * CORE_R * CORE_R * L;
    const M = vol > 0 ? state.moment / vol : 0;
    const k = 0.5 * MU0 * M;
    const g = POLE.y - y;
    const dx = x - POLE.x, dz = z - POLE.z;
    const rho = Math.hypot(dx, dz);
    const end = (s) => s / Math.sqrt(s * s + CORE_R * CORE_R);
    const ByAxis = k * (end(g + L) - end(Math.max(g, 1e-4)));
    const atten = (CORE_R * CORE_R) / (CORE_R * CORE_R + rho * rho);
    const By = ByAxis * atten;
    const pull = By * 0.85 / Math.max(CORE_R, Math.abs(g) + rho * 0.5);
    out.set(-dx * pull, By, -dz * pull);
    return out;
  }

  function electromagnetForce(obj) {
    _f.set(0, 0, 0);
    obj.lastForce.set(0, 0, 0);
    if (Math.abs(state.moment) < 1e-6 && Math.abs(state.Bgap) < 1e-4) return _f;
    const xe = chiEff(obj.spec.muR);
    if (xe < 1e-6) return _f;
    const p = obj.body.position;
    sampleB(_B, p.x, p.y, p.z);
    const Bmag = _B.length();
    if (Bmag < 1e-5) return _f;
    const nx = POLE.x - p.x, ny = POLE.y - p.y, nz = POLE.z - p.z;
    const nd = Math.hypot(nx, ny, nz) || 1;
    const h = 0.008;
    sampleB(_Bp, p.x + (nx / nd) * h, p.y + (ny / nd) * h, p.z + (nz / nd) * h);
    const dB = (_Bp.length() - Bmag) / h;
    const mInd = (xe * obj.volume / MU0) * Bmag;
    let Fgrad = mInd * dB;
    const Fmax = Math.max(8, 25 * obj.body.mass);
    Fgrad = Math.max(-Fmax, Math.min(Fmax, Fgrad));
    _f.set(nx / nd, ny / nd, nz / nd).multiplyScalar(Fgrad);
    const gap = p.y - POLE.y;
    const radial = Math.hypot(p.x - POLE.x, p.z - POLE.z);
    if (obj.spec.magnetic && gap < 0.04 && gap > -0.14 && radial < 0.11 && state.Bgap > 0.04) {
      const cover = Math.min(1, obj.faceArea / (Math.PI * CORE_R * CORE_R));
      const prox = Math.max(0, 1 - Math.abs(gap + 0.02) / 0.04);
      const hold = (state.Bgap * state.Bgap * Math.PI * CORE_R * CORE_R * cover * prox) / TWO_MU0;
      _f.y += Math.min(hold, Fmax);
    }
    obj.lastForce.copy(_f);
    return _f;
  }

  function applyForces() {
    state.peakForce = 0;
    for (const obj of state.objects) {
      const f = electromagnetForce(obj);
      if (f.x || f.y || f.z) {
        obj.body.wakeUp();
        obj.body.force.x += f.x;
        obj.body.force.y += f.y;
        obj.body.force.z += f.z;
        const fl = Math.hypot(f.x, f.y, f.z);
        if (fl > state.peakForce) state.peakForce = fl;
      }
    }
  }

  function updateElectrical(dt) {
    const { Rhot, tau, L } = updateMagnetState();
    state.current += (state.targetCurrent - state.current) * (1 - Math.exp(-dt / tau));
    const nI = state.turns * state.current;
    const H = nI / L;
    const chi = Math.max(0, state.muR - 1);
    const Mlin = chi * H;
    const M = MS_IRON * Math.tanh(Mlin / Math.max(MS_IRON, 1));
    const vol = Math.PI * CORE_R * CORE_R * L;
    state.moment = M * vol;
    state.Bcore = MU0 * (H + M);
    const leak = L / (L + 2 * CORE_R);
    state.Bgap = Math.min(1.7, MU0 * M * leak * 0.55 + MU0 * nI / Math.sqrt(L * L + 4 * CORE_R * CORE_R) * 0.5);
    if (!state.powered && Math.abs(state.current) < 0.02) {
      state.moment *= 0.15;
      if (Math.abs(state.current) < 0.002) { state.moment = 0; state.Bgap = 0; state.Bcore = 0; }
    }
    state.saturated = Math.abs(Mlin) > 0.75 * MS_IRON && state.muR > 2;
    const power = state.current * state.current * Rhot;
    state.tempC += (power * 0.12 - (state.tempC - 24) * 0.32) * dt;
    state.tempC = Math.min(210, Math.max(18, state.tempC));
  }

  let vizTick = 0;
  function updateFieldLines() {
    fieldGroup.visible = state.showField && state.fieldViz > 0.02;
    if (!fieldGroup.visible) return;
    const strength = Math.min(1, state.Bgap / 0.6) * state.fieldViz;
    const reach = 0.12 + strength * 0.42;
    for (const fl of fieldLines) {
      const pos = fl.line.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = i / (pos.count - 1);
        const r = 0.01 + Math.sin(u * Math.PI) * reach * (0.5 + 0.4 * Math.sin(fl.seed * 2));
        const y = POLE.y - u * reach * 1.25 + Math.sin(u * Math.PI) * 0.03;
        pos.setXYZ(i, Math.cos(fl.seed) * r, y, Math.sin(fl.seed) * r);
      }
      pos.needsUpdate = true;
      fl.line.material.opacity = 0.1 + strength * 0.5;
    }
  }

  function updateVisuals() {
    const on = Math.min(1, Math.abs(state.current) / 3);
    coilMat.emissiveIntensity = state.showGlow ? on * 0.7 : 0;
    coreMat.emissiveIntensity = state.showGlow ? on * 0.35 : 0;
    coilLight.intensity = state.showGlow ? (state.fastGfx ? on * 0.6 : on * 1.6) : 0;
    coil.scale.set(1, Math.max(0.55, state.length / 0.08), 1);
    core.scale.set(1, 0.65 + state.length / 0.18, 1);
    if ((vizTick++ & 1) === 0) updateFieldLines();
    for (const obj of state.objects) {
      obj.mesh.position.copy(obj.body.position);
      obj.mesh.quaternion.copy(obj.body.quaternion);
    }
  }

  function updateInspector() {
    const none = $("selNone"), box = $("selBox");
    if (!none) return;
    if (!state.selected) { none.style.display = "block"; box.style.display = "none"; return; }
    none.style.display = "none";
    box.style.display = "block";
    const o = state.selected;
    $("sName").textContent = o.spec.name;
    $("sMat").textContent = o.type;
    $("sMass").textContent = o.body.mass.toFixed(4) + " kg";
    $("sChi").textContent = o.spec.muR.toFixed(3) + " / " + chiEff(o.spec.muR).toFixed(3);
  }

  function updateHUD() {
    $("mV").textContent = state.voltage.toFixed(1) + " V";
    $("mI").textContent = state.current.toFixed(2) + " A";
    $("mB").textContent = state.Bgap.toFixed(3) + " T";
    $("mNI").textContent = String(Math.round(state.turns * state.current));
    $("mF").textContent = state.peakForce.toFixed(2) + " N";
    $("mT").textContent = Math.round(state.tempC) + " °C";
    $("mFps").textContent = state.fps + " fps";
    $("vVoltage").textContent = state.voltage.toFixed(1) + " V";
    $("vTurns").textContent = String(state.turns);
    $("vR").textContent = state.resistance.toFixed(1) + " Ω";
    $("vL").textContent = Math.round(state.length * 1000) + " mm";
    $("vMu").textContent = String(Math.round(state.muR));
    $("vG").textContent = state.gravity.toFixed(2) + " m/s²";
    $("vTs").textContent = state.timeScale.toFixed(2) + "×";
    $("vFv").textContent = Math.round(state.fieldViz * 100) + "%";
    const dot = $("runDot"), txt = $("runText");
    Bus.set("em", { powered: state.powered, voltage: state.voltage, B: state.Bgap || state.Bcore });
    if (!state.powered) { if (dot) dot.className = "status-dot off"; if (txt) txt.textContent = "Coil open — M → 0"; }
    else if (state.tempC > 140) { if (dot) dot.className = "status-dot hot"; if (txt) txt.textContent = "THERMAL WARNING > 140 °C"; }
    else if (state.tempC > 80) { if (dot) dot.className = "status-dot warn"; if (txt) txt.textContent = "I²R heating"; }
    else { if (dot) dot.className = "status-dot"; if (txt) txt.textContent = state.saturated ? "Core near saturation" : "Energized temporary magnet"; }
    $("powerLabel").textContent = state.powered ? "ENERGIZED" : "STANDBY";
    $("powerLabel").style.color = state.powered ? "#3ec7ff" : "#8b9bb0";
    if (state.selected) {
      $("sSpd").textContent = state.selected.body.velocity.length().toFixed(2) + " m/s";
      $("sForce").textContent = state.selected.lastForce.length().toFixed(3) + " N";
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const _hit = new THREE.Vector3();
  const _planeN = new THREE.Vector3();
  const _grabLocal = new CANNON.Vec3();

  function setPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  on(renderer.domElement, "pointerdown", (e) => {
    if (e.button !== 0) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(state.objects.map((o) => o.mesh), false);
    state.selected = hits.length ? state.objects.find((o) => o.mesh === hits[0].object) || null : null;
    updateInspector();
    if (state.selected) {
      e.preventDefault();
      renderer.domElement.setPointerCapture(e.pointerId);
      const point = hits[0].point;
      endDrag(false);
      drag.obj = state.selected;
      drag.height = point.y;
      drag.last.copy(point);
      drag.vel.set(0, 0, 0);
      camera.getWorldDirection(_planeN);
      drag.plane.setFromNormalAndCoplanarPoint(_planeN, point);
      grabBody.position.set(point.x, point.y, point.z);
      const lp = state.selected.body.pointToLocalFrame(new CANNON.Vec3(point.x, point.y, point.z), _grabLocal);
      drag.constraint = new CANNON.PointToPointConstraint(state.selected.body, lp.clone(), grabBody, new CANNON.Vec3(0, 0, 0));
      world.addConstraint(drag.constraint);
      state.selected.body.wakeUp();
      state.selected.body.allowSleep = false;
      controls.enabled = false;
    }
  });
  on(renderer.domElement, "pointermove", (e) => {
    if (!drag.obj) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(drag.plane, _hit)) {
      _hit.y = Math.max(0.04, _hit.y);
      drag.vel.copy(_hit).sub(drag.last);
      drag.last.copy(_hit);
      grabBody.position.set(_hit.x, _hit.y, _hit.z);
      drag.obj.body.wakeUp();
    }
  });
  on(renderer.domElement, "pointerup", (e) => {
    if (e.button !== 0) return;
    if (drag.obj) {
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (_) {}
      endDrag(true);
    }
  });
  on(renderer.domElement, "wheel", (e) => {
    if (!drag.obj) return;
    e.preventDefault();
    drag.height = Math.max(0.05, Math.min(1.2, drag.height + Math.sign(e.deltaY) * -0.018));
    drag.last.y = drag.height;
    camera.getWorldDirection(_planeN);
    drag.plane.setFromNormalAndCoplanarPoint(_planeN, drag.last);
    grabBody.position.y = drag.height;
  }, { passive: false });

  const bindSlider = (id, key, parse, after) => {
    on($(id), "input", (e) => { state[key] = parse(e.target.value); if (after) after(); });
  };
  bindSlider("rVoltage", "voltage", parseFloat);
  bindSlider("rTurns", "turns", (v) => parseInt(v, 10));
  bindSlider("rR", "resistance", parseFloat);
  bindSlider("rL", "length", (v) => parseFloat(v) / 1000);
  bindSlider("rMu", "muR", parseFloat);
  bindSlider("rG", "gravity", parseFloat, () => world.gravity.set(0, -state.gravity, 0));
  bindSlider("rTs", "timeScale", parseFloat);
  bindSlider("rFv", "fieldViz", (v) => parseFloat(v) / 100);
  on($("sCore"), "change", (e) => { state.muR = parseFloat(e.target.value); $("rMu").value = state.muR; });
  on($("cField"), "change", (e) => (state.showField = e.target.checked));
  on($("cGlow"), "change", (e) => (state.showGlow = e.target.checked));
  on($("cTrail"), "change", (e) => {
    state.trails = e.target.checked;
    for (const o of state.objects) {
      if (state.trails && !o.trail) attachTrail(o);
      if (!state.trails && o.trail) {
        scene.remove(o.trail.line);
        o.trail = null;
      }
    }
  });
  on($("cShadows"), "change", (e) => {
    renderer.shadowMap.enabled = e.target.checked;
    key.castShadow = e.target.checked;
  });
  on($("cColliders"), "change", (e) => (colliderHelper.visible = e.target.checked));
  on($("cFast"), "change", (e) => {
    state.fastGfx = e.target.checked;
    renderer.setPixelRatio(state.fastGfx ? 1 : Math.min(devicePixelRatio, 1.5));
  });
  on($("powerSwitch"), "click", () => {
    state.powered = !state.powered;
    $("powerSwitch").classList.toggle("on", state.powered);
    for (const o of state.objects) o.body.wakeUp();
  });
  on($("btnReset"), "click", () => { seedDefaultScene(); toast("Scene reset"); });
  on($("btnDemo"), "click", () => {
    seedDefaultScene();
    spawnChain({ x: -0.26, y: 0.42, z: 0.2 });
    spawnRagdoll({ x: 0.3, y: 0.42, z: 0.16 });
    state.voltage = 24; state.turns = 600; state.resistance = 6; state.muR = 400;
    $("rVoltage").value = 24; $("rTurns").value = 600; $("rR").value = 6; $("rMu").value = 400; $("sCore").value = "400";
    if (!state.powered) { state.powered = true; $("powerSwitch").classList.add("on"); }
    toast("Demo: 24 V · chain + figure");
  });
  on($("btnDelete"), "click", () => {
    if (!state.selected) return;
    const o = state.selected;
    const keep = [];
    for (const c of state.constraints) {
      if (c.bodyA === o.body || c.bodyB === o.body) world.removeConstraint(c);
      else keep.push(c);
    }
    state.constraints = keep;
    world.removeBody(o.body); scene.remove(o.mesh);
    if (o.trail) scene.remove(o.trail.line);
    state.objects = state.objects.filter((x) => x !== o);
    state.selected = null; updateInspector();
  });
  root.querySelectorAll("#spawnGrid .chip").forEach((chip) => {
    on(chip, "click", () => {
      const type = chip.dataset.type;
      const pos = { x: (Math.random() - 0.5) * 0.45, y: 0.55, z: 0.14 + Math.random() * 0.16 };
      if (type === "chain") spawnChain(pos);
      else if (type === "ragdoll") spawnRagdoll(pos);
      else addSimObject({ type, position: pos });
      toast("Spawned " + type);
    });
  });

  on($("btnExport"), "click", () => {
    const data = {
      format: "HSN-Sim-EM-1.1",
      savedAt: new Date().toISOString(),
      magnet: { voltage: state.voltage, turns: state.turns, resistance: state.resistance, length: state.length, muR: state.muR, powered: state.powered, gravity: state.gravity },
      objects: state.objects.map((o) => ({
        id: o.id, type: o.type,
        position: { x: o.body.position.x, y: o.body.position.y, z: o.body.position.z },
        quat: { x: o.body.quaternion.x, y: o.body.quaternion.y, z: o.body.quaternion.z, w: o.body.quaternion.w },
      })),
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "HSN-Sim-scene.json";
    a.click();
    toast("Exported scene");
  });
  on($("btnImport"), "click", () => $("fileIn").click());
  on($("fileIn"), "change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      clearDynamic();
      if (data.magnet) {
        Object.assign(state, {
          voltage: data.magnet.voltage ?? state.voltage,
          turns: data.magnet.turns ?? state.turns,
          resistance: data.magnet.resistance ?? state.resistance,
          length: data.magnet.length ?? state.length,
          muR: data.magnet.muR ?? state.muR,
          powered: !!data.magnet.powered,
          gravity: data.magnet.gravity ?? state.gravity,
        });
        $("rVoltage").value = state.voltage;
        $("rTurns").value = state.turns;
        $("powerSwitch").classList.toggle("on", state.powered);
        world.gravity.set(0, -state.gravity, 0);
      }
      for (const o of (data.objects || []).filter((x) => x.type !== "chain" && x.type !== "ragdoll")) {
        addSimObject({ type: o.type, position: o.position, extra: { quat: o.quat, id: o.id } });
      }
      toast("Imported scene");
    } catch (err) {
      toast("Import failed: " + err.message);
    }
    e.target.value = "";
  });

  const unbindView = bindViewport(viewport, camera, renderer);

  const clock = new THREE.Clock();
  let fpsAccum = 0, fpsFrames = 0, hudTick = 0, raf = 0;
  const FIXED = 1 / 60;
  function frame() {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    if (ctl.paused) return;
    const raw = Math.min(0.05, clock.getDelta());
    const dt = raw * state.timeScale;
    fpsAccum += raw; fpsFrames++;
    if (fpsAccum >= 0.4) { state.fps = Math.round(fpsFrames / fpsAccum); fpsAccum = 0; fpsFrames = 0; }
    updateElectrical(dt);
    applyForces();
    world.step(FIXED, dt, 3);
    updateVisuals();
    if ((hudTick++ & 3) === 0) updateHUD();
    controls.update();
    renderer.render(scene, camera);
  }

  seedDefaultScene();
  frame();
  toast("EM Lab ready — flip the power switch to energize");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() {
      return {
        magnet: { voltage: state.voltage, turns: state.turns, resistance: state.resistance, length: state.length, muR: state.muR, powered: state.powered, gravity: state.gravity },
        objects: state.objects.map((o) => ({
          id: o.id, type: o.type,
          position: { x: o.body.position.x, y: o.body.position.y, z: o.body.position.z },
        })),
      };
    },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      endDrag(false);
      unbindView();
      disposeThree(renderer, scene);
      root.innerHTML = "";
    },
  };
}
