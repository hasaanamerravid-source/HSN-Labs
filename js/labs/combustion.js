/**
 * Premixed combustion laboratory — fuel–air ratio and flame completeness.
 */
import { Bus } from "../bus.js";

const FUELS = {
  ch4: { name: "Methane", stoich: 9.52, carbon: 1, phiLo: 0.50, phiHi: 1.70, Tad: 2226, rxn: "CH4 + 2 O2 → CO2 + 2 H2O" },
  c3h8: { name: "Propane", stoich: 23.8, carbon: 3, phiLo: 0.51, phiHi: 1.70, Tad: 2268, rxn: "C3H8 + 5 O2 → 3 CO2 + 4 H2O" },
  h2: { name: "Hydrogen", stoich: 2.38, carbon: 0, phiLo: 0.30, phiHi: 2.20, Tad: 2382, rxn: "2 H2 + O2 → 2 H2O" },
  c2h5oh: { name: "Ethanol", stoich: 14.3, carbon: 2, phiLo: 0.50, phiHi: 1.65, Tad: 2195, rxn: "C2H5OH + 3 O2 → 2 CO2 + 3 H2O" },
};

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Fuel</label><b id="mFuel">Methane</b></div>
      <div class="metric"><label>φ</label><b id="mPhi">1.00</b></div>
      <div class="metric"><label>Flame T</label><b id="mT">— K</b></div>
      <div class="metric"><label>CO2</label><b id="mCO2">0</b></div>
      <div class="metric"><label>Soot</label><b id="mSoot">low</b></div>
      <div class="metric"><label>State</label><b id="mLit">unlit</b></div>
    </div>
    <div class="header-actions">
      <button id="btnLite" class="primary">Ignite</button>
      <button id="btnOut">Extinguish</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Fuel</h2>
      <select id="sFuel">
        <option value="ch4">Methane (CH4)</option>
        <option value="c3h8">Propane (C3H8)</option>
        <option value="h2">Hydrogen (H2)</option>
        <option value="c2h5oh">Ethanol (C2H5OH)</option>
      </select>
    </div>
    <div class="section">
      <h2>Mixture</h2>
      <div class="row"><label>Equivalence ratio φ</label><span class="val" id="vPhi">1.00</span></div>
      <input type="range" id="rPhi" min="0.5" max="1.8" step="0.01" value="1.00" />
      <div class="row"><label>Flow</label><span class="val" id="vFlow">0.60</span></div>
      <input type="range" id="rFlow" min="0.15" max="1.4" step="0.01" value="0.60" />
      <p class="help">φ &lt; 1 lean (excess air). φ = 1 stoichiometric. φ &gt; 1 rich (soot and leftover fuel).</p>
    </div>
    <div class="section">
      <h2>Reaction</h2>
      <p class="help" id="rxn">CH4 + 2 O2 → CO2 + 2 H2O</p>
    </div>
  </aside>
  <div id="viewport">
    <canvas id="cbCanvas"></canvas>
    <div class="overlay-hud">Premixed flame · Tad from stoich air tables, scaled by φ</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Products</h2>
      <p class="help" id="prodTxt">Ignite to start the energy balance.</p>
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

  const st = { fuel: "ch4", phi: 1, flow: 0.6, lit: false, T: 300, sparks: [] };
  const canvas = $("cbCanvas");
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

  function adiabatic() {
    const f = FUELS[st.fuel];
    const phi = st.phi;
    // Peak at φ = 1. Equivalence scales available oxidizer or leftover fuel.
    const avail = phi <= 1 ? phi : 1 / phi;
    const richLoss = phi > 1 ? 1 - 0.18 * Math.min(0.8, phi - 1) : 1;
    return 298 + (f.Tad - 298) * avail * richLoss;
  }

  on($("sFuel"), "change", (e) => { st.fuel = e.target.value; });
  on($("rPhi"), "input", (e) => { st.phi = parseFloat(e.target.value); $("vPhi").textContent = st.phi.toFixed(2); });
  on($("rFlow"), "input", (e) => { st.flow = parseFloat(e.target.value); $("vFlow").textContent = st.flow.toFixed(2); });
  on($("btnLite"), "click", () => {
    const f = FUELS[st.fuel];
    if (st.phi < f.phiLo || st.phi > f.phiHi) { toast("Outside " + f.name + " flammability window"); return; }
    st.lit = true;
    toast("Ignited");
  });
  on($("btnOut"), "click", () => { st.lit = false; toast("Flame out"); });

  let last = performance.now();
  let raf = 0;
  function frame(now) {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (ctl.paused) return;
    const vp = $("viewport");
    const w = vp.clientWidth, h = vp.clientHeight;
    const target = st.lit ? adiabatic() : 300;
    st.T += (target - st.T) * Math.min(1, dt * 2.2);
    const soot = st.lit ? Math.max(0, (st.phi - 1) * 1.6) : 0;
    const co2 = st.lit && FUELS[st.fuel].carbon > 0 ? Math.min(1, st.phi <= 1 ? st.phi : 1 / st.phi) : 0;

    if (st.lit) {
      for (let i = 0; i < 3 + st.flow * 6; i++) {
        st.sparks.push({
          x: w * 0.5 + (Math.random() - 0.5) * 18,
          y: h * 0.72,
          vy: -(80 + Math.random() * 90) * st.flow,
          vx: (Math.random() - 0.5) * 30,
          life: 0.35 + Math.random() * 0.35,
          hot: Math.random(),
        });
      }
    }
    for (const s of st.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    if (st.sparks.length > 400) st.sparks.splice(0, st.sparks.length - 400);
    st.sparks = st.sparks.filter((s) => s.life > 0);

    g.clearRect(0, 0, w, h);
    g.fillStyle = "#07090d";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1c2734";
    g.fillRect(w * 0.5 - 26, h * 0.72, 52, 48);
    g.fillStyle = "#2a3544";
    g.fillRect(w * 0.5 - 10, h * 0.68, 20, 12);

    for (const s of st.sparks) {
      const a = Math.max(0, s.life * 2);
      const r = st.phi > 1.15 ? 255 : 255;
      const gg = st.phi > 1.2 ? 140 : 200;
      const b = st.fuel === "h2" ? 220 : 40;
      g.fillStyle = `rgba(${r},${gg},${b},${a})`;
      g.beginPath();
      g.arc(s.x, s.y, 3 + soot * 2, 0, Math.PI * 2);
      g.fill();
    }
    if (st.lit) {
      const grd = g.createRadialGradient(w * 0.5, h * 0.62, 8, w * 0.5, h * 0.5, 90 + st.flow * 40);
      grd.addColorStop(0, st.phi < 1 ? "rgba(122,240,200,0.28)" : "rgba(255,176,32,0.32)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grd;
      g.fillRect(w * 0.3, h * 0.2, w * 0.4, h * 0.55);
    }

    const f = FUELS[st.fuel];
    $("mFuel").textContent = f.name;
    $("mPhi").textContent = st.phi.toFixed(2);
    $("mT").textContent = Math.round(st.T) + " K";
    $("mCO2").textContent = co2.toFixed(2);
    $("mSoot").textContent = soot < 0.15 ? "low" : soot < 0.6 ? "moderate" : "high";
    $("mLit").textContent = st.lit ? "lit" : "unlit";
    $("rxn").textContent = f.rxn + (st.lit && st.phi > 1.08 && f.carbon ? "  (+ soot if rich)" : "");
    $("prodTxt").textContent = st.lit
      ? (st.phi < 0.95 ? "Lean flame. Excess oxygen, cooler products, little soot."
        : st.phi > 1.08 ? "Rich flame. Incomplete oxidation, soot, leftover fuel."
        : "Near stoichiometric. Highest classroom flame temperature.")
      : "Burner idle.";
    setStatus(st.lit ? ("Combustion  φ=" + st.phi.toFixed(2)) : "Burner idle", st.lit ? "ok" : "off");
    Bus.set("combustion", { phi: st.phi, lit: st.lit, T: st.T, fuel: st.fuel, soot });
  }
  frame(performance.now());
  toast("Combustion laboratory ready");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() { return { fuel: st.fuel, phi: st.phi, flow: st.flow, lit: st.lit }; },
    setState(s) { Object.assign(st, s || {}); },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      root.innerHTML = "";
    },
  };
}
