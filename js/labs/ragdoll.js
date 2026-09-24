/**
 * Dedicated ragdoll / articulated-figure physics sandbox.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as CANNON from "cannon-es";
import { bindViewport, disposeThree } from "../runtime.js";
import { Bus } from "../bus.js";

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Figures</label><b id="mN">0</b></div>
      <div class="metric"><label>Bodies</label><b id="mB">0</b></div>
      <div class="metric"><label>Gravity</label><b id="mG">9.81</b></div>
      <div class="metric"><label>Wind</label><b id="mW">0.0</b></div>
      <div class="metric"><label>FPS</label><b id="mFps">—</b></div>
    </div>
    <div class="header-actions">
      <button id="btnSpawn" class="primary">Spawn figure</button>
      <button id="btnNudge">Soft nudge</button>
      <button id="btnClear">Clear figures</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>World</h2>
      <div class="row"><label>Gravity</label><span class="val" id="vG">9.81</span></div>
      <input type="range" id="rG" min="0" max="25" step="0.01" value="9.81" />
      <div class="row"><label>Wind +X</label><span class="val" id="vW">0.0</span></div>
      <input type="range" id="rW" min="-20" max="20" step="0.1" value="0" />
      <div class="row"><label>Time scale</label><span class="val" id="vTs">1.00×</span></div>
      <input type="range" id="rTs" min="0.1" max="2" step="0.05" value="1" />
    </div>
    <div class="section">
      <h2>Figure</h2>
      <div class="row"><label>Size</label><span class="val" id="vSize">1.00×</span></div>
      <input type="range" id="rSize" min="0.6" max="1.8" step="0.05" value="1" />
      <div class="row"><label>Joint stiffness</label><span class="val" id="vStiff">80</span></div>
      <input type="range" id="rStiff" min="20" max="250" step="5" value="80" />
      <div class="row"><label><input type="checkbox" id="cBlocks" checked /> Stack of blocks</label></div>
    </div>
    <div class="section">
      <h2>How joints work</h2>
      <p class="help">
        Each limb is a rigid box. Hinge constraints pin two bodies on an axis,
        like a knee or shoulder. Gravity, contacts, and a small wind force do the rest.
      </p>
      <p class="help" style="margin-top:8px">
        Drag a limb to pose it. Wheel while holding lifts. Release tosses with the drag velocity.
      </p>
    </div>
  </aside>
  <div id="viewport">
    <div class="overlay-hud">Drag a limb · scroll wheel lifts · release applies an impulse</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Selection</h2>
      <div id="selNone" class="help">Click a limb.</div>
      <div id="selBox" style="display:none">
        <div class="row"><label>Part</label><b id="sName">—</b></div>
        <div class="row"><label>Mass</label><span class="val" id="sMass">—</span></div>
        <div class="row"><label>Speed</label><span class="val" id="sSpd">—</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Classroom note</h2>
      <p class="help">
        This is a dummy made of boxes and hinges — the same idea used in animation
        and engineering multibody models. It is a physics toy, not a person simulator.
      </p>
    </div>
  </div>
</div>
`;

export function mount(root, ctx) {
  const toast = (ctx && ctx.toast) || (() => {});
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id);
  const ac = new AbortController();
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, { ...(opt || {}), signal: ac.signal });
  const ctl = { paused: false };

  const st = { g: 9.81, wind: 0, timeScale: 1, size: 1, stiff: 80, objects: [], constraints: [], selected: null, fps: 0 };

  const viewport = $("viewport");
  const settings = (ctx && ctx.settings) || {};
  const quality = settings.quality || "high";
  const aa = settings.antialias !== false && quality !== "low";
  const renderer = new THREE.WebGLRenderer({ antialias: aa, powerPreference: "high-performance" });
  renderer.setPixelRatio(quality === "high" ? Math.min(devicePixelRatio || 1, 1.5) : 1);
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  const camera = new THREE.PerspectiveCamera(50, viewport.clientWidth / Math.max(1, viewport.clientHeight), 0.05, 50);
  camera.position.set(3.2, 2.2, 3.8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !settings.reducedMotion;
  controls.target.set(0, 0.8, 0);
  scene.add(new THREE.HemisphereLight(0xb7d4f0, 0x1a140c, 1.05));
  const key = new THREE.DirectionalLight(0xfff2dc, 0.85);
  key.position.set(3, 5, 2);
  scene.add(key);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshLambertMaterial({ color: 0x141c26 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  scene.add(new THREE.GridHelper(8, 16, 0x243044, 0x16202c));

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 18;
  world.allowSleep = true;
  const matS = new CANNON.Material("s");
  const matD = new CANNON.Material("d");
  world.addContactMaterial(new CANNON.ContactMaterial(matS, matD, { friction: 0.5, restitution: 0.05 }));
  world.addContactMaterial(new CANNON.ContactMaterial(matD, matD, { friction: 0.35, restitution: 0.05 }));

  const ground = new CANNON.Body({ mass: 0, material: matS });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  // ramp + platform
  function addStaticBox(sx, sy, sz, x, y, z, color = 0x1c2734) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0, material: matS });
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
    body.position.set(x, y, z);
    world.addBody(body);
  }
  addStaticBox(3.2, 0.08, 1.6, 0, 0.04, 0, 0x1c2734);
  addStaticBox(1.4, 0.08, 0.8, 1.6, 0.35, -0.1, 0x243044);
  addStaticBox(0.9, 0.08, 0.7, 2.2, 0.7, -0.1, 0x2a3544);

  const blockMeshes = [];
  function spawnBlocks() {
    for (const m of blockMeshes) scene.remove(m.mesh);
    for (const m of blockMeshes) world.removeBody(m.body);
    blockMeshes.length = 0;
    if (!$("cBlocks").checked) return;
    for (let i = 0; i < 6; i++) {
      const a = 0.16;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(a, a, a), new THREE.MeshLambertMaterial({ color: 0x6ea0c8 }));
      const body = new CANNON.Body({ mass: 0.4, material: matD, shape: new CANNON.Box(new CANNON.Vec3(a / 2, a / 2, a / 2)) });
      body.position.set(-0.7 + (i % 3) * 0.18, 0.2 + Math.floor(i / 3) * 0.18, 0.35);
      world.addBody(body);
      scene.add(mesh);
      const obj = { mesh, body, spec: { name: "Block" }, kind: "block" };
      blockMeshes.push(obj);
      st.objects.push(obj);
    }
  }

  function addLimb(name, size, pos, color) {
    const [sx, sy, sz] = size;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshLambertMaterial({ color }));
    const mass = Math.max(0.08, sx * sy * sz * 900);
    const body = new CANNON.Body({ mass, material: matD, shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)) });
    body.position.set(pos.x, pos.y, pos.z);
    body.linearDamping = 0.12;
    body.angularDamping = 0.22;
    world.addBody(body);
    scene.add(mesh);
    const obj = { mesh, body, spec: { name }, kind: "limb" };
    st.objects.push(obj);
    return obj;
  }

  function hinge(a, b, pa, pb, axis = [1, 0, 0]) {
    const c = new CANNON.HingeConstraint(a.body, b.body, {
      pivotA: new CANNON.Vec3(...pa),
      pivotB: new CANNON.Vec3(...pb),
      axisA: new CANNON.Vec3(...axis),
      axisB: new CANNON.Vec3(...axis),
      maxForce: st.stiff,
    });
    world.addConstraint(c);
    st.constraints.push(c);
  }

  function spawnFigure(origin) {
    const s = st.size;
    const torso = addLimb("Torso", [0.16 * s, 0.28 * s, 0.1 * s], origin, 0x4d7ea8);
    const head = addLimb("Head", [0.12 * s, 0.12 * s, 0.12 * s], { x: origin.x, y: origin.y + 0.22 * s, z: origin.z }, 0x7af0c8);
    const uArmL = addLimb("Upper arm L", [0.07 * s, 0.16 * s, 0.07 * s], { x: origin.x - 0.14 * s, y: origin.y + 0.06 * s, z: origin.z }, 0x6ea0c8);
    const lArmL = addLimb("Forearm L", [0.06 * s, 0.15 * s, 0.06 * s], { x: origin.x - 0.14 * s, y: origin.y - 0.1 * s, z: origin.z }, 0x5b8cb0);
    const uArmR = addLimb("Upper arm R", [0.07 * s, 0.16 * s, 0.07 * s], { x: origin.x + 0.14 * s, y: origin.y + 0.06 * s, z: origin.z }, 0x6ea0c8);
    const lArmR = addLimb("Forearm R", [0.06 * s, 0.15 * s, 0.06 * s], { x: origin.x + 0.14 * s, y: origin.y - 0.1 * s, z: origin.z }, 0x5b8cb0);
    const uLegL = addLimb("Thigh L", [0.08 * s, 0.2 * s, 0.08 * s], { x: origin.x - 0.05 * s, y: origin.y - 0.26 * s, z: origin.z }, 0x3d6588);
    const lLegL = addLimb("Shin L", [0.07 * s, 0.2 * s, 0.07 * s], { x: origin.x - 0.05 * s, y: origin.y - 0.48 * s, z: origin.z }, 0x345870);
    const uLegR = addLimb("Thigh R", [0.08 * s, 0.2 * s, 0.08 * s], { x: origin.x + 0.05 * s, y: origin.y - 0.26 * s, z: origin.z }, 0x3d6588);
    const lLegR = addLimb("Shin R", [0.07 * s, 0.2 * s, 0.07 * s], { x: origin.x + 0.05 * s, y: origin.y - 0.48 * s, z: origin.z }, 0x345870);

    hinge(torso, head, [0, 0.15 * s, 0], [0, -0.07 * s, 0]);
    hinge(torso, uArmL, [-0.1 * s, 0.1 * s, 0], [0, 0.08 * s, 0], [1, 0, 0]);
    hinge(uArmL, lArmL, [0, -0.09 * s, 0], [0, 0.08 * s, 0], [1, 0, 0]);
    hinge(torso, uArmR, [0.1 * s, 0.1 * s, 0], [0, 0.08 * s, 0], [1, 0, 0]);
    hinge(uArmR, lArmR, [0, -0.09 * s, 0], [0, 0.08 * s, 0], [1, 0, 0]);
    hinge(torso, uLegL, [-0.05 * s, -0.15 * s, 0], [0, 0.1 * s, 0], [1, 0, 0]);
    hinge(uLegL, lLegL, [0, -0.11 * s, 0], [0, 0.1 * s, 0], [1, 0, 0]);
    hinge(torso, uLegR, [0.05 * s, -0.15 * s, 0], [0, 0.1 * s, 0], [1, 0, 0]);
    hinge(uLegR, lLegR, [0, -0.11 * s, 0], [0, 0.1 * s, 0], [1, 0, 0]);
    toast("Spawned articulated figure");
  }

  const grabBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
  grabBody.collisionFilterGroup = 0;
  grabBody.collisionFilterMask = 0;
  world.addBody(grabBody);
  const drag = { obj: null, constraint: null, plane: new THREE.Plane(), last: new THREE.Vector3(), vel: new THREE.Vector3() };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const _hit = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _local = new CANNON.Vec3();

  function endDrag(toss = true) {
    if (!drag.obj) return;
    if (drag.constraint) { world.removeConstraint(drag.constraint); drag.constraint = null; }
    drag.obj.body.allowSleep = true;
    if (toss) drag.obj.body.velocity.set(drag.vel.x * 16, drag.vel.y * 16, drag.vel.z * 16);
    drag.obj = null;
    controls.enabled = true;
  }

  function setPointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  on(renderer.domElement, "pointerdown", (e) => {
    if (e.button !== 0) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(st.objects.map((o) => o.mesh), false);
    st.selected = hits.length ? st.objects.find((o) => o.mesh === hits[0].object) : null;
    $("selNone").style.display = st.selected ? "none" : "block";
    $("selBox").style.display = st.selected ? "block" : "none";
    if (st.selected) {
      $("sName").textContent = st.selected.spec.name;
      $("sMass").textContent = st.selected.body.mass.toFixed(3) + " kg";
      const p = hits[0].point;
      endDrag(false);
      drag.obj = st.selected;
      drag.last.copy(p);
      drag.vel.set(0, 0, 0);
      camera.getWorldDirection(_n);
      drag.plane.setFromNormalAndCoplanarPoint(_n, p);
      grabBody.position.set(p.x, p.y, p.z);
      const lp = st.selected.body.pointToLocalFrame(new CANNON.Vec3(p.x, p.y, p.z), _local);
      drag.constraint = new CANNON.PointToPointConstraint(st.selected.body, lp.clone(), grabBody, new CANNON.Vec3(0, 0, 0));
      world.addConstraint(drag.constraint);
      st.selected.body.wakeUp();
      controls.enabled = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    }
  });
  on(renderer.domElement, "pointermove", (e) => {
    if (!drag.obj) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(drag.plane, _hit)) {
      _hit.y = Math.max(0.05, _hit.y);
      drag.vel.copy(_hit).sub(drag.last);
      drag.last.copy(_hit);
      grabBody.position.set(_hit.x, _hit.y, _hit.z);
      drag.obj.body.wakeUp();
    }
  });
  on(renderer.domElement, "pointerup", () => endDrag(true));
  on(renderer.domElement, "wheel", (e) => {
    if (!drag.obj) return;
    e.preventDefault();
    drag.last.y = Math.max(0.05, Math.min(2.5, drag.last.y - Math.sign(e.deltaY) * 0.02));
    camera.getWorldDirection(_n);
    drag.plane.setFromNormalAndCoplanarPoint(_n, drag.last);
    grabBody.position.y = drag.last.y;
  }, { passive: false });

  function clearFigures() {
    endDrag(false);
    for (const c of st.constraints) world.removeConstraint(c);
    st.constraints.length = 0;
    for (const o of st.objects) {
      world.removeBody(o.body);
      scene.remove(o.mesh);
    }
    st.objects.length = 0;
    blockMeshes.length = 0;
    st.selected = null;
    spawnBlocks();
  }

  on($("btnSpawn"), "click", () => spawnFigure({ x: (Math.random() - 0.5) * 1.2, y: 1.4, z: (Math.random() - 0.3) * 0.4 }));
  on($("btnClear"), "click", () => { clearFigures(); toast("Cleared"); });
  on($("btnNudge"), "click", () => {
    for (const o of st.objects) {
      if (o.kind !== "limb") continue;
      o.body.wakeUp();
      o.body.velocity.x += (Math.random() - 0.5) * 1.2;
      o.body.velocity.y += 0.4 + Math.random() * 0.6;
      o.body.velocity.z += (Math.random() - 0.5) * 1.2;
    }
    toast("Soft nudge");
  });
  on($("rG"), "input", (e) => { st.g = parseFloat(e.target.value); world.gravity.set(0, -st.g, 0); $("vG").textContent = st.g.toFixed(2); });
  on($("rW"), "input", (e) => { st.wind = parseFloat(e.target.value); $("vW").textContent = st.wind.toFixed(1); });
  on($("rTs"), "input", (e) => { st.timeScale = parseFloat(e.target.value); $("vTs").textContent = st.timeScale.toFixed(2) + "×"; });
  on($("rSize"), "input", (e) => { st.size = parseFloat(e.target.value); $("vSize").textContent = st.size.toFixed(2) + "×"; });
  on($("rStiff"), "input", (e) => {
    st.stiff = parseFloat(e.target.value);
    $("vStiff").textContent = String(st.stiff);
    for (const c of st.constraints) {
      if (c.equation && c.equation.maxForce !== undefined) c.equation.maxForce = st.stiff;
      if (typeof c.setMaxForce === "function") c.setMaxForce(st.stiff);
    }
  });
  on($("cBlocks"), "change", () => { clearFigures(); spawnFigure({ x: 0, y: 1.35, z: 0 }); });

  const unbindView = bindViewport(viewport, camera, renderer);

  spawnBlocks();
  spawnFigure({ x: 0, y: 1.4, z: 0 });

  const clock = new THREE.Clock();
  let raf = 0, acc = 0, frames = 0;
  function frame() {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    if (ctl.paused) return;
    const raw = Math.min(0.05, clock.getDelta());
    const dt = raw * st.timeScale;
    acc += raw; frames++;
    if (acc > 0.4) { st.fps = Math.round(frames / acc); acc = 0; frames = 0; }
    if (st.wind) {
      for (const o of st.objects) o.body.force.x += st.wind * o.body.mass * 0.15;
    }
    world.step(1 / 60, dt, 3);
    for (const o of st.objects) {
      o.mesh.position.copy(o.body.position);
      o.mesh.quaternion.copy(o.body.quaternion);
    }
    const figs = new Set(st.objects.filter((o) => o.kind === "limb").map((o) => o.spec.name.split(" ")[0]));
    $("mN").textContent = String(Math.round(st.objects.filter((o) => o.kind === "limb").length / 10));
    $("mB").textContent = String(st.objects.length);
    $("mG").textContent = st.g.toFixed(2);
    $("mW").textContent = st.wind.toFixed(1);
    $("mFps").textContent = st.fps + " fps";
    if (st.selected) $("sSpd").textContent = st.selected.body.velocity.length().toFixed(2) + " m/s";
    Bus.set("ragdoll", { figures: Math.round(st.objects.filter((o) => o.kind === "limb").length / 10), bodies: st.objects.length });
    controls.update();
    renderer.render(scene, camera);
  }
  frame();

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
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
