/**
 * Teaching fission core — six-factor k-eff + one delayed-neutron group.
 * Not a licensed plant model and not a weapons model.
 */
import { Bus } from "../bus.js";

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>k-eff</label><b id="mK">0.00</b></div>
      <div class="metric"><label>Reactivity</label><b id="mRho">0 pcm</b></div>
      <div class="metric"><label>Power</label><b id="mP">0.02 MW</b></div>
      <div class="metric"><label>T fuel</label><b id="mT">290 °C</b></div>
      <div class="metric"><label>n / C</label><b id="mNC">—</b></div>
      <div class="metric"><label>Period</label><b id="mPer">—</b></div>
    </div>
    <div class="header-actions">
      <button id="btnPulse" class="primary">Source pulse</button>
      <button id="btnScram">Scram</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Core controls</h2>
      <div class="row"><label>Control-rod insertion</label><span class="val" id="vRod">55%</span></div>
      <input type="range" id="rRod" min="0" max="100" step="1" value="55" />
      <div class="row"><label>Moderator quality</label><span class="val" id="vMod">0.80</span></div>
      <input type="range" id="rMod" min="0.2" max="1" step="0.01" value="0.80" />
      <div class="row"><label>Fuel enrichment</label><span class="val" id="vEnr">3.5%</span></div>
      <input type="range" id="rEnr" min="0.7" max="5" step="0.1" value="3.5" />
      <p class="help">k = η f p ε L<sub>f</sub> L<sub>t</sub> × rod worth, then a small negative temperature coefficient. One delayed group (β = 0.0065, λ = 0.08 s⁻¹, Λ = 5×10⁻⁵ s).</p>
    </div>
    <div class="section">
      <h2>Notes</h2>
      <p class="help" id="noteTxt">k &lt; 1 subcritical, k = 1 delayed critical, k &gt; 1 power rises. Prompt critical would be ρ &gt; β; this model trips before that.</p>
    </div>
  </aside>
  <div id="viewport">
    <canvas id="rxCanvas"></canvas>
    <div class="overlay-hud" id="hud">Point-kinetics teaching core</div>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Balance</h2>
      <p class="help" id="balTxt">Waiting.</p>
    </div>
    <div class="section">
      <h2>Safety</h2>
      <p class="help">Thermal trip fully inserts rods. There is no fuel inventory and no decay-heat curve beyond a lumped cool-down.</p>
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

  const BETA = 0.0065;
  const LAMBDA_D = 0.08;
  const LAMBDA_P = 5e-5;
  const ALPHA_T = 2.5e-5; // 1/K Doppler-like feedback
  const T0 = 290;

  const st = {
    rod: 0.55,
    mod: 0.8,
    enr: 3.5,
    k0: 0.97,
    k: 0.97,
    power: 0.02,
    T: T0,
    n: 0.02,
    C: 0.02 * BETA / (LAMBDA_D * LAMBDA_P),
    scram: false,
    neutrons: [],
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

  function keffCold() {
    if (st.scram) return 0.32;
    const eta = 1.72 + st.enr * 0.06;
    const f = 0.62 + st.enr * 0.03;
    const p = 0.70 + 0.28 * st.mod;
    const eps = 1.03;
    const Lf = 0.97;
    const Lt = 0.88 + 0.10 * st.mod;
    const rodWorth = 1 - st.rod * 0.40;
    return Math.max(0.25, Math.min(1.45, eta * f * p * eps * Lf * Lt * rodWorth));
  }

  function spawnNeutron(x, y) {
    const a = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 80;
    st.neutrons.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 1.2 + Math.random(),
    });
    if (st.neutrons.length > 180) st.neutrons.splice(0, st.neutrons.length - 180);
  }

  function pulse() {
    const vp = $("viewport");
    const w = vp.clientWidth, h = vp.clientHeight;
    for (let i = 0; i < 12; i++) spawnNeutron(w * 0.5 + (Math.random() - 0.5) * 80, h * 0.5 + (Math.random() - 0.5) * 80);
    st.n += 0.004;
    toast("Source pulse");
  }

  on($("rRod"), "input", (e) => { st.rod = parseFloat(e.target.value) / 100; $("vRod").textContent = Math.round(st.rod * 100) + "%"; st.scram = false; });
  on($("rMod"), "input", (e) => { st.mod = parseFloat(e.target.value); $("vMod").textContent = st.mod.toFixed(2); });
  on($("rEnr"), "input", (e) => { st.enr = parseFloat(e.target.value); $("vEnr").textContent = st.enr.toFixed(1) + "%"; });
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

    st.k0 = keffCold();
    st.k = Math.max(0.2, st.k0 - ALPHA_T * (st.T - T0) * 40);
    const rho = (st.k - 1) / st.k;
    const n = st.n;
    const C = st.C;
    const nDot = ((st.k * (1 - BETA) - 1) / LAMBDA_P) * n + LAMBDA_D * C;
    const cDot = (BETA / LAMBDA_P) * n - LAMBDA_D * C;
    st.n = Math.max(1e-6, n + nDot * dt);
    st.C = Math.max(1e-9, C + cDot * dt);
    st.power = Math.min(120, st.n);
    st.T += (st.power * 0.35 - (st.T - T0) * 0.12) * dt;
    if (st.T > 620) {
      st.scram = true;
      st.rod = 1;
      $("rRod").value = 100;
      $("vRod").textContent = "100%";
    }

    const want = Math.min(180, 6 + st.power * 1.4);
    while (st.neutrons.length < want * 0.35) spawnNeutron(cx + (Math.random() - 0.5) * 90, cy + (Math.random() - 0.5) * 90);

    for (const nn of st.neutrons) {
      nn.x += nn.vx * dt;
      nn.y += nn.vy * dt;
      nn.life -= dt;
      const dx = nn.x - cx, dy = nn.y - cy;
      if (dx * dx + dy * dy < 95 * 95 && Math.random() < dt * Math.max(0.15, st.k) * 0.7) {
        nn.life = 0;
        if (Math.random() < 0.5 * st.k) spawnNeutron(nn.x, nn.y);
      }
    }
    st.neutrons = st.neutrons.filter((n0) => n0.life > 0 && n0.x > -20 && n0.y > -20 && n0.x < w + 20 && n0.y < h + 20);

    ctx2.clearRect(0, 0, w, h);
    const g = ctx2.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.7);
    g.addColorStop(0, "#122033");
    g.addColorStop(1, "#07090d");
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, w, h);
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
      ctx2.fillStyle = "#c4a0ff";
      ctx2.fillRect(x - 3, y - 22, 6, 44 * st.rod);
    }
    for (const n0 of st.neutrons) {
      ctx2.fillStyle = "#7af0c8";
      ctx2.beginPath();
      ctx2.arc(n0.x, n0.y, 2.4, 0, Math.PI * 2);
      ctx2.fill();
    }

    const pcm = rho * 1e5;
    let period = "—";
    if (Math.abs(st.k - 1) > 0.002) {
      const T = (BETA - rho) / (LAMBDA_D * rho);
      period = Number.isFinite(T) ? T.toFixed(1) + " s" : "—";
    } else period = "∞";

    $("mK").textContent = st.k.toFixed(4);
    $("mRho").textContent = Math.round(pcm) + " pcm";
    $("mP").textContent = st.power.toFixed(2) + " MW";
    $("mT").textContent = st.T.toFixed(0) + " °C";
    $("mNC").textContent = st.n.toFixed(3) + " / " + st.C.toFixed(1);
    $("mPer").textContent = period;
    $("balTxt").textContent = st.k < 0.995
      ? "Subcritical — population decays after the source dies."
      : st.k < 1.005
        ? "Near delayed critical — power holds if temperature is stable."
        : rho > BETA
          ? "Prompt supercritical — scram expected."
          : "Supercritical on delayed neutrons — period " + period + ".";
    setStatus("Fission  k=" + st.k.toFixed(4), st.T > 500 ? "hot" : "ok");
    Bus.set("reactor", {
      k: st.k,
      power: st.power,
      mode: "fission",
      T: st.T,
      rho: pcm,
    });
  }
  frame(performance.now());
  toast("Point-kinetics core online — teaching model only");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() { return { rod: st.rod, mod: st.mod, enr: st.enr, n: st.n, C: st.C, T: st.T, scram: st.scram }; },
    setState(s) { Object.assign(st, s || {}); },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      root.innerHTML = "";
    },
  };
}
