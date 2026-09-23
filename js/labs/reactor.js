/**
 * Classroom fission / fusion reactor — educational model only.
 */
import { Bus } from "../bus.js";

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Mode</label><b id="mMode">Fission</b></div>
      <div class="metric"><label>k-eff</label><b id="mK">0.00</b></div>
      <div class="metric"><label>Power</label><b id="mP">0 MW*</b></div>
      <div class="metric"><label>T core</label><b id="mT">290 °C</b></div>
      <div class="metric"><label>Neutrons</label><b id="mN">0</b></div>
      <div class="metric"><label>Q fus</label><b id="mQ">—</b></div>
    </div>
    <div class="header-actions">
      <button id="btnPulse" class="primary">Source pulse</button>
      <button id="btnScram">Scram</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Facility</h2>
      <div class="seg" id="modeSeg">
        <button data-mode="fission" class="active">Fission core</button>
        <button data-mode="fusion">Fusion vessel</button>
      </div>
    </div>
    <div class="section" id="fisSec">
      <h2>Fission controls</h2>
      <div class="row"><label>Control-rod insertion</label><span class="val" id="vRod">55%</span></div>
      <input type="range" id="rRod" min="0" max="100" step="1" value="55" />
      <div class="row"><label>Moderator quality</label><span class="val" id="vMod">0.80</span></div>
      <input type="range" id="rMod" min="0.2" max="1" step="0.01" value="0.80" />
      <div class="row"><label>Fuel enrichment</label><span class="val" id="vEnr">3.5%</span></div>
      <input type="range" id="rEnr" min="0.7" max="5" step="0.1" value="3.5" />
      <p class="help">Classroom six-factor model. k ≈ η f p ε L_f L_t. Not a licensed core, not a weapons model.</p>
    </div>
    <div class="section" id="fusSec" hidden>
      <h2>Fusion controls</h2>
      <div class="row"><label>Ion temperature</label><span class="val" id="vTi">8 keV</span></div>
      <input type="range" id="rTi" min="1" max="30" step="0.5" value="8" />
      <div class="row"><label>Density</label><span class="val" id="vN">0.8</span></div>
      <input type="range" id="rN" min="0.1" max="2" step="0.05" value="0.8" />
      <div class="row"><label>Confinement τ</label><span class="val" id="vTau">0.40 s</span></div>
      <input type="range" id="rTau" min="0.05" max="2" step="0.05" value="0.40" />
      <p class="help">D–T reactivity rises with T. Lawson-like Q = P_fus / P_heat. Classroom units.</p>
    </div>
    <div class="section">
      <h2>Notes</h2>
      <p class="help" id="noteTxt">Withdraw rods to raise k. k &lt; 1 subcritical, k = 1 critical, k &gt; 1 power rises.</p>
    </div>
  </aside>
  <div id="viewport">
    <canvas id="rxCanvas"></canvas>
    <div class="overlay-hud" id="hud">Educational reactor model</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Balance</h2>
      <p class="help" id="balTxt">Waiting.</p>
    </div>
    <div class="section">
      <h2>Safety</h2>
      <p class="help">A thermal trip inserts rods automatically. This is a teaching toy with no inventory of real fuel.</p>
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

  const st = {
    mode: "fission",
    rod: 0.55,
    mod: 0.8,
    enr: 3.5,
    k: 0.7,
    power: 0.02,
    T: 290,
    nPop: 18,
    ti: 8,
    dens: 0.8,
    tau: 0.4,
    q: 0,
    scram: false,
    neutrons: [],
    sparks: [],
  };

  const canvas = $("rxCanvas");
  const ctx2 = canvas.getContext("2d");

  function resize() {
    const vp = $("viewport");
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(4, vp.clientWidth) * dpr;
    canvas.height = Math.max(4, vp.clientHeight) * dpr;
    canvas.style.width = vp.clientWidth + "px";
    canvas.style.height = vp.clientHeight + "px";
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe($("viewport"));

  function keff() {
    if (st.scram) return 0.35;
    const eta = 1.6 + st.enr * 0.12;
    const f = 0.55 + st.enr * 0.04;
    const p = 0.75 * st.mod;
    const eps = 1.03;
    const Lf = 0.97;
    const Lt = 0.96 * st.mod;
    const rodWorth = 1 - st.rod * 0.72;
    return Math.max(0.2, eta * f * p * eps * Lf * Lt * rodWorth * 0.22);
  }

  function fusionQ() {
    const T = st.ti;
    const sv = Math.exp(-20 / Math.max(2, T)) * (T / 10) * (T / 10);
    const pfus = st.dens * st.dens * sv * 12;
    const pheat = 2.2 / Math.max(0.08, st.tau) + 0.15 * T;
    return pfus / pheat;
  }

  function spawnNeutron(x, y, fissionBorn) {
    const a = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 80;
    st.neutrons.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 1.6 + Math.random(),
      born: fissionBorn,
    });
    if (st.neutrons.length > 220) st.neutrons.splice(0, st.neutrons.length - 220);
  }

  function pulse() {
    const vp = $("viewport");
    const w = vp.clientWidth, h = vp.clientHeight;
    for (let i = 0; i < 12; i++) spawnNeutron(w * 0.5 + (Math.random() - 0.5) * 80, h * 0.5 + (Math.random() - 0.5) * 80, false);
    toast("Source pulse");
  }

  on($("modeSeg"), "click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b) return;
    st.mode = b.dataset.mode;
    $("modeSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    $("fisSec").hidden = st.mode !== "fission";
    $("fusSec").hidden = st.mode !== "fusion";
    $("noteTxt").textContent = st.mode === "fission"
      ? "Withdraw rods to raise k. k < 1 subcritical, k = 1 critical, k > 1 power rises."
      : "Raise temperature and confinement. Q > 1 means more fusion power than heating power in this toy Lawson plot.";
  });
  on($("rRod"), "input", (e) => { st.rod = parseFloat(e.target.value) / 100; $("vRod").textContent = Math.round(st.rod * 100) + "%"; st.scram = false; });
  on($("rMod"), "input", (e) => { st.mod = parseFloat(e.target.value); $("vMod").textContent = st.mod.toFixed(2); });
  on($("rEnr"), "input", (e) => { st.enr = parseFloat(e.target.value); $("vEnr").textContent = st.enr.toFixed(1) + "%"; });
  on($("rTi"), "input", (e) => { st.ti = parseFloat(e.target.value); $("vTi").textContent = st.ti.toFixed(1) + " keV"; });
  on($("rN"), "input", (e) => { st.dens = parseFloat(e.target.value); $("vN").textContent = st.dens.toFixed(2); });
  on($("rTau"), "input", (e) => { st.tau = parseFloat(e.target.value); $("vTau").textContent = st.tau.toFixed(2) + " s"; });
  on($("btnPulse"), "click", pulse);
  on($("btnScram"), "click", () => {
    st.scram = true;
    st.rod = 1;
    $("rRod").value = 100;
    $("vRod").textContent = "100%";
    toast("Scram — rods fully inserted");
  });

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
    const cx = w * 0.5, cy = h * 0.52;

    if (st.mode === "fission") {
      st.k = keff();
      const growth = Math.pow(st.k, dt * 8);
      st.power = Math.min(120, Math.max(0.01, st.power * growth));
      st.T += (st.power * 0.35 - (st.T - 290) * 0.12) * dt;
      if (st.T > 620) {
        st.scram = true;
        st.rod = 1;
        $("rRod").value = 100;
        $("vRod").textContent = "100%";
      }
      st.nPop = Math.min(220, 8 + st.power * 1.6);
      while (st.neutrons.length < st.nPop * 0.35) spawnNeutron(cx + (Math.random() - 0.5) * 90, cy + (Math.random() - 0.5) * 90, true);
    } else {
      st.q = fusionQ();
      st.power = Math.min(80, Math.max(0.01, st.q * 8));
      st.T = 1e7 * (st.ti / 10);
      st.k = st.q;
      if (Math.random() < dt * st.q * 4) {
        const a = Math.random() * Math.PI * 2;
        st.sparks.push({ x: cx + Math.cos(a) * 40, y: cy + Math.sin(a) * 22, life: 0.5 });
      }
    }

    for (const n of st.neutrons) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.life -= dt;
      const dx = n.x - cx, dy = n.y - cy;
      if (st.mode === "fission" && dx * dx + dy * dy < 95 * 95 && Math.random() < dt * st.k * 0.8) {
        n.life = 0;
        if (Math.random() < 0.55 * st.k) spawnNeutron(n.x, n.y, true);
        if (Math.random() < 0.35 * st.k) spawnNeutron(n.x, n.y, true);
      }
    }
    st.neutrons = st.neutrons.filter((n) => n.life > 0 && n.x > -20 && n.y > -20 && n.x < w + 20 && n.y < h + 20);
    st.sparks = st.sparks.filter((s) => (s.life -= dt) > 0);

    ctx2.clearRect(0, 0, w, h);
    const g = ctx2.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.7);
    g.addColorStop(0, "#122033");
    g.addColorStop(1, "#07090d");
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, w, h);

    if (st.mode === "fission") {
      ctx2.fillStyle = "#1c2734";
      ctx2.beginPath();
      ctx2.arc(cx, cy, 118, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.strokeStyle = "#3a4658";
      ctx2.lineWidth = 6;
      ctx2.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = cx + Math.cos(a) * 54;
        const y = cy + Math.sin(a) * 54;
        ctx2.fillStyle = st.power > 8 ? "#7af0c8" : "#4a5a6c";
        ctx2.fillRect(x - 5, y - 22, 10, 44);
        const insert = st.rod;
        ctx2.fillStyle = "#c4a0ff";
        ctx2.fillRect(x - 3, y - 22, 6, 44 * insert);
      }
      for (const n of st.neutrons) {
        ctx2.fillStyle = n.born ? "#7af0c8" : "#3ec7ff";
        ctx2.beginPath();
        ctx2.arc(n.x, n.y, 2.4, 0, Math.PI * 2);
        ctx2.fill();
      }
    } else {
      ctx2.save();
      ctx2.translate(cx, cy);
      ctx2.scale(1.6, 0.85);
      ctx2.strokeStyle = "#3ec7ff";
      ctx2.lineWidth = 8;
      ctx2.beginPath();
      ctx2.arc(0, 0, 70, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.strokeStyle = "rgba(122,240,200,0.45)";
      ctx2.lineWidth = 3;
      ctx2.beginPath();
      ctx2.arc(0, 0, 48, 0, Math.PI * 2);
      ctx2.stroke();
      ctx2.restore();
      const glow = Math.min(1, st.q / 2);
      ctx2.fillStyle = `rgba(62,199,255,${0.08 + glow * 0.25})`;
      ctx2.beginPath();
      ctx2.ellipse(cx, cy, 90, 48, 0, 0, Math.PI * 2);
      ctx2.fill();
      for (const s of st.sparks) {
        ctx2.fillStyle = `rgba(255,176,32,${s.life})`;
        ctx2.beginPath();
        ctx2.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx2.fill();
      }
    }

    $("mMode").textContent = st.mode === "fission" ? "Fission" : "Fusion";
    $("mK").textContent = st.mode === "fission" ? st.k.toFixed(3) : st.q.toFixed(2);
    $("mP").textContent = st.power.toFixed(1) + " MW*";
    $("mT").textContent = st.mode === "fission" ? st.T.toFixed(0) + " °C" : (st.ti).toFixed(1) + " keV";
    $("mN").textContent = String(st.neutrons.length);
    $("mQ").textContent = st.mode === "fusion" ? st.q.toFixed(2) : "—";
    $("balTxt").textContent = st.mode === "fission"
      ? (st.k < 0.98 ? "Subcritical — population decays." : st.k < 1.02 ? "Near critical — power holds." : "Supercritical — power rising. Watch temperature.")
      : (st.q < 1 ? "Driven plasma. Heating still exceeds fusion power." : "Q ≥ 1 in this classroom Lawson model.");
    setStatus(st.mode === "fission" ? ("Fission  k=" + st.k.toFixed(3)) : ("Fusion  Q=" + st.q.toFixed(2)), st.T > 500 ? "hot" : "ok");
    Bus.set("reactor", {
      k: st.mode === "fission" ? st.k : 0,
      Q: st.mode === "fusion" ? st.q : 0,
      power: st.power,
      mode: st.mode,
      T: st.T,
    });
  }
  frame(performance.now());
  toast("Reactor model online — educational use only");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() { return { ...st, neutrons: [], sparks: [] }; },
    setState(s) { Object.assign(st, s); },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      root.innerHTML = "";
    },
  };
}
