/**
 * States of matter — classical phases plus selected exotic orders.
 */
import { Bus } from "../bus.js";

const PHASES = {
  solid: { name: "Solid (crystal)", tag: "Classical", blurb: "Particles locked on a lattice. They vibrate but do not change neighbors." },
  liquid: { name: "Liquid", tag: "Classical", blurb: "Dense and disordered. Neighbors rearrange; volume stays nearly fixed." },
  gas: { name: "Gas", tag: "Classical", blurb: "Dilute, high kinetic energy, weak interactions, fills the container." },
  plasma: { name: "Plasma", tag: "Classical", blurb: "Ionized gas. Free charges screen fields and glow. Most baryonic matter in the universe." },
  scf: { name: "Supercritical fluid", tag: "Classical", blurb: "Above the critical point there is no liquid–gas meniscus. Density is liquid-like, mobility is gas-like." },
  bec: { name: "Bose–Einstein condensate", tag: "Quantum", blurb: "A macroscopic number of bosons occupy the ground state. The cloud moves as one wave." },
  spinliq: { name: "Quantum spin liquid", tag: "Quantum", blurb: "Spins stay disordered at low T because of frustration and entanglement, not thermal noise." },
  superfluid: { name: "Superfluid", tag: "Quantum", blurb: "A quantum liquid with zero viscosity. Flow can persist around a ring." },
};

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Phase</label><b id="mPhase">Solid</b></div>
      <div class="metric"><label>T</label><b id="mT">120 K</b></div>
      <div class="metric"><label>Density</label><b id="mD">0.70</b></div>
      <div class="metric"><label>Order</label><b id="mOrd">0.90</b></div>
      <div class="metric"><label>Class</label><b id="mClass">Classical</b></div>
    </div>
    <div class="header-actions">
      <button id="btnKick" class="primary">Thermal kick</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Phase</h2>
      <div class="seg" id="phaseSeg">
        <button data-ph="solid" class="active">Solid</button>
        <button data-ph="liquid">Liquid</button>
        <button data-ph="gas">Gas</button>
        <button data-ph="plasma">Plasma</button>
        <button data-ph="scf">Supercritical</button>
        <button data-ph="bec">BEC</button>
        <button data-ph="spinliq">Spin liquid</button>
        <button data-ph="superfluid">Superfluid</button>
      </div>
    </div>
    <div class="section">
      <h2>Conditions</h2>
      <div class="row"><label>Temperature</label><span class="val" id="vT">120 K</span></div>
      <input type="range" id="rT" min="1" max="800" step="1" value="120" />
      <div class="row"><label>Density</label><span class="val" id="vD">0.70</span></div>
      <input type="range" id="rD" min="0.08" max="1" step="0.01" value="0.70" />
    </div>
    <div class="section">
      <h2>What you are seeing</h2>
      <p class="help" id="blurb"></p>
    </div>
  </aside>
  <div id="viewport">
    <canvas id="stCanvas"></canvas>
    <div class="overlay-hud">Particle view is schematic — not a full many-body solver</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Order parameter</h2>
      <p class="help" id="ordTxt">Lattice order is high in a crystal and collapses in a liquid or gas.</p>
    </div>
  </div>
</div>
`;

export function mount(root, ctx) {
  const toast = (ctx && ctx.toast) || (() => {});
  const setStatus = (ctx && ctx.setStatus) || (() => {});
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id);
  const ac = new AbortController();
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ac.signal });
  const ctl = { paused: false };

  const st = { phase: "solid", T: 120, dens: 0.7, parts: [], spins: [], order: 0.9 };
  const canvas = $("stCanvas");
  const g = canvas.getContext("2d");

  function resize() {
    const vp = $("viewport");
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(4, vp.clientWidth) * dpr;
    canvas.height = Math.max(4, vp.clientHeight) * dpr;
    canvas.style.width = vp.clientWidth + "px";
    canvas.style.height = vp.clientHeight + "px";
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe($("viewport"));

  function seed() {
    st.parts = [];
    st.spins = [];
    const n = 8 + Math.round(st.dens * 70);
    const vp = $("viewport");
    const w = vp.clientWidth, h = vp.clientHeight;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      st.parts.push({
        x: w * 0.2 + (c + 0.5) * (w * 0.6 / cols),
        y: h * 0.18 + (r + 0.5) * (h * 0.64 / rows),
        vx: 0, vy: 0,
        hx: 0, hy: 0,
      });
    }
    for (let i = 0; i < 36; i++) st.spins.push(Math.random() * Math.PI * 2);
    $("blurb").textContent = PHASES[st.phase].blurb;
  }

  on($("phaseSeg"), "click", (e) => {
    const b = e.target.closest("[data-ph]");
    if (!b) return;
    st.phase = b.dataset.ph;
    $("phaseSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    if (st.phase === "bec") { st.T = 4; $("rT").value = 4; $("vT").textContent = "4 K"; }
    if (st.phase === "gas") { st.dens = 0.18; $("rD").value = 0.18; $("vD").textContent = "0.18"; }
    if (st.phase === "solid") { st.dens = 0.78; $("rD").value = 0.78; $("vD").textContent = "0.78"; }
    seed();
  });
  on($("rT"), "input", (e) => { st.T = parseFloat(e.target.value); $("vT").textContent = st.T.toFixed(0) + " K"; });
  on($("rD"), "input", (e) => { st.dens = parseFloat(e.target.value); $("vD").textContent = st.dens.toFixed(2); seed(); });
  on($("btnKick"), "click", () => {
    for (const p of st.parts) {
      p.vx += (Math.random() - 0.5) * 80;
      p.vy += (Math.random() - 0.5) * 80;
    }
    toast("Thermal kick");
  });

  seed();
  let last = performance.now();
  let raf = 0;
  function frame(now) {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (ctl.paused) return;
    const vp = $("viewport");
    const w = vp.clientWidth, h = vp.clientHeight;
    const ph = st.phase;
    const temp = st.T / 400;
    const meta = PHASES[ph];

    let order = 0;
    for (const p of st.parts) {
      if (!p.hx) { p.hx = p.x; p.hy = p.y; }
      if (ph === "solid") {
        p.vx += (p.hx - p.x) * 18 * dt;
        p.vy += (p.hy - p.y) * 18 * dt;
        p.vx += (Math.random() - 0.5) * temp * 40 * dt;
        p.vy += (Math.random() - 0.5) * temp * 40 * dt;
        p.vx *= 0.9; p.vy *= 0.9;
      } else if (ph === "liquid" || ph === "scf") {
        p.vx += (Math.random() - 0.5) * (30 + temp * 80) * dt;
        p.vy += (Math.random() - 0.5) * (30 + temp * 80) * dt + (ph === "liquid" ? 8 * dt : 0);
        p.vx *= 0.985; p.vy *= 0.985;
      } else if (ph === "gas" || ph === "plasma") {
        p.vx += (Math.random() - 0.5) * (80 + temp * 140) * dt;
        p.vy += (Math.random() - 0.5) * (80 + temp * 140) * dt;
      } else if (ph === "bec") {
        const cx = w * 0.5, cy = h * 0.5;
        p.vx += (cx - p.x) * 6 * dt;
        p.vy += (cy - p.y) * 6 * dt;
        p.vx *= 0.96; p.vy *= 0.96;
      } else if (ph === "superfluid") {
        const cx = w * 0.5, cy = h * 0.5;
        const ang = Math.atan2(p.y - cy, p.x - cx) + dt * 1.4;
        const r = Math.hypot(p.x - cx, p.y - cy) * 0.999 + 0.2;
        p.x = cx + Math.cos(ang) * r;
        p.y = cy + Math.sin(ang) * r;
      }
      if (ph !== "superfluid") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (p.x < 16 || p.x > w - 16) p.vx *= -1;
      if (p.y < 16 || p.y > h - 16) p.vy *= -1;
      p.x = Math.max(16, Math.min(w - 16, p.x));
      p.y = Math.max(16, Math.min(h - 16, p.y));
      order += 1 / (1 + Math.hypot(p.x - p.hx, p.y - p.hy));
    }
    st.order = order / Math.max(1, st.parts.length);
    if (ph === "spinliq") {
      for (let i = 0; i < st.spins.length; i++) st.spins[i] += (Math.random() - 0.5) * 0.15;
    }

    g.clearRect(0, 0, w, h);
    g.fillStyle = "#07090d";
    g.fillRect(0, 0, w, h);

    if (ph === "plasma") {
      g.fillStyle = "rgba(62,199,255,0.08)";
      g.fillRect(0, 0, w, h);
    }
    if (ph === "bec") {
      const grd = g.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, 160);
      grd.addColorStop(0, "rgba(196,160,255,0.35)");
      grd.addColorStop(1, "rgba(196,160,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }

    if (ph === "spinliq") {
      const cols = 6, rows = 6;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = w * 0.25 + c * 48;
          const y = h * 0.22 + r * 48;
          const a = st.spins[r * cols + c] || 0;
          g.strokeStyle = "#c4a0ff";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16);
          g.stroke();
          g.fillStyle = "#7af0c8";
          g.beginPath();
          g.arc(x, y, 3, 0, Math.PI * 2);
          g.fill();
        }
      }
    } else {
      for (const p of st.parts) {
        g.fillStyle = ph === "plasma" ? "#3ec7ff" : ph === "bec" ? "#c4a0ff" : "#7af0c8";
        g.beginPath();
        g.arc(p.x, p.y, ph === "gas" ? 2.2 : 3.4, 0, Math.PI * 2);
        g.fill();
      }
    }

    $("mPhase").textContent = meta.name.split(" (")[0];
    $("mT").textContent = st.T.toFixed(0) + " K";
    $("mD").textContent = st.dens.toFixed(2);
    $("mOrd").textContent = st.order.toFixed(2);
    $("mClass").textContent = meta.tag;
    $("ordTxt").textContent = meta.blurb;
    setStatus(meta.name);
    Bus.set("states", { phase: st.phase, T: st.T, dens: st.dens, order: st.order });
  }
  frame(performance.now());
  toast("States of matter laboratory ready");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() { return { phase: st.phase, T: st.T, dens: st.dens }; },
    setState(s) {
      if (!s) return;
      st.phase = s.phase || st.phase;
      st.T = s.T ?? st.T;
      st.dens = s.dens ?? st.dens;
      seed();
    },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      root.innerHTML = "";
    },
  };
}
