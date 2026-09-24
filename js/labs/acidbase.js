/**
 * Acid–base titration laboratory.
 */
import { Bus } from "../bus.js";

const REAGENTS = {
  hcl: { name: "Hydrochloric acid", type: "acid", strong: true, pKa: -6.3, color: "#7dd3fc" },
  hno3: { name: "Nitric acid", type: "acid", strong: true, pKa: -1.4, color: "#67e8f9" },
  h2so4: { name: "Sulfuric acid", type: "acid", strong: true, diprotic: true, pKa: -3, pKa2: 1.99, color: "#38bdf8" },
  acetic: { name: "Acetic acid", type: "acid", strong: false, pKa: 4.76, color: "#f9a8d4" },
  formic: { name: "Formic acid", type: "acid", strong: false, pKa: 3.75, color: "#f472b6" },
  naoh: { name: "Sodium hydroxide", type: "base", strong: true, pKaBH: 15.7, color: "#86efac" },
  koh: { name: "Potassium hydroxide", type: "base", strong: true, pKaBH: 15.7, color: "#4ade80" },
  nh3: { name: "Aqueous ammonia", type: "base", strong: false, pKaBH: 9.25, color: "#a3e635" },
};

const INDICATORS = {
  methyl: { name: "Methyl orange", lo: 3.1, hi: 4.4, acid: "#f97316", base: "#eab308" },
  bromo: { name: "Bromothymol blue", lo: 6.0, hi: 7.6, acid: "#facc15", base: "#22c55e" },
  phen: { name: "Phenolphthalein", lo: 8.2, hi: 10.0, acid: "#f8fafc", base: "#ec4899" },
};

const TEMPLATE = `
<div class="lab-frame">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>pH</label><b id="mPH">7.00</b></div>
      <div class="metric"><label>Volume</label><b id="mV">25.0 mL</b></div>
      <div class="metric"><label>Titrant</label><b id="mTit">0.00 mL</b></div>
      <div class="metric"><label>Indicator</label><b id="mInd">Bromothymol</b></div>
      <div class="metric"><label>[H+]</label><b id="mH">1.0e-7</b></div>
    </div>
    <div class="header-actions">
      <button id="btnDrop" class="primary">Add 0.5 mL</button>
      <button id="btnReset">Rinse glassware</button>
    </div>
  </div>
  <aside>
    <div class="section">
      <h2>Analyte</h2>
      <select id="sAnalyte">
        <option value="hcl">HCl (strong acid)</option>
        <option value="acetic" selected>CH3COOH (weak acid)</option>
        <option value="formic">HCOOH (weak acid)</option>
        <option value="hno3">HNO3 (strong acid)</option>
        <option value="h2so4">H2SO4 (diprotic)</option>
        <option value="naoh">NaOH (strong base)</option>
        <option value="nh3">NH3 (weak base)</option>
      </select>
      <div class="row"><label>Concentration</label><span class="val" id="vCA">0.10 M</span></div>
      <input type="range" id="rCA" min="0.02" max="0.5" step="0.01" value="0.10" />
      <div class="row"><label>Aliquot</label><span class="val" id="vVA">25 mL</span></div>
      <input type="range" id="rVA" min="10" max="40" step="1" value="25" />
    </div>
    <div class="section">
      <h2>Titrant</h2>
      <select id="sTitrant">
        <option value="naoh" selected>NaOH (strong base)</option>
        <option value="koh">KOH (strong base)</option>
        <option value="hcl">HCl (strong acid)</option>
        <option value="nh3">NH3 (weak base)</option>
      </select>
      <div class="row"><label>Concentration</label><span class="val" id="vCB">0.10 M</span></div>
      <input type="range" id="rCB" min="0.02" max="0.5" step="0.01" value="0.10" />
    </div>
    <div class="section">
      <h2>Indicator</h2>
      <div class="seg" id="indSeg">
        <button data-ind="methyl">Methyl orange</button>
        <button data-ind="bromo" class="active">Bromothymol</button>
        <button data-ind="phen">Phenolphthalein</button>
      </div>
    </div>
    <div class="section">
      <h2>Theory</h2>
      <p class="help">Strong–strong: equivalence at pH 7. Weak acid + strong base: equivalence above 7. The buffer region sits near pKa.</p>
    </div>
  </aside>
  <div id="viewport">
    <canvas id="abCanvas"></canvas>
  </div>
  <div class="inspector wide-only">
    <div class="section">
      <h2>Readout</h2>
      <p class="help" id="readTxt">Fill the burette and begin the titration.</p>
    </div>
    <div class="section">
      <h2>Curve</h2>
      <p class="help">The right panel traces pH versus titrant volume. A sharp jump marks the equivalence point.</p>
    </div>
  </div>
</div>
`;

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = (pa >> 16) * (1 - t) + (pb >> 16) * t;
  const g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t;
  const bl = (pa & 255) * (1 - t) + (pb & 255) * t;
  return `rgb(${r|0},${g|0},${bl|0})`;
}

function fromH(h) {
  return -Math.log10(Math.min(1, Math.max(1e-14, h)));
}

function computePH(st) {
  const A = REAGENTS[st.analyte];
  const B = REAGENTS[st.titrant];
  const Va = st.va / 1000;
  const Vb = st.vb / 1000;
  const V = Math.max(Va + Vb, 1e-12);
  const Kw = 1e-14;
  const nAnalyte = st.ca * Va;
  const nTitrant = st.cb * Vb;
  const analyteAcid = A.type === "acid";
  const titrantAcid = B.type === "acid";

  if (A.diprotic && analyteAcid && B.strong && !titrantAcid) {
    const Ka2 = Math.pow(10, -(A.pKa2 || 1.99));
    const nOH = nTitrant;
    const nH2A = nAnalyte;
    if (nOH <= 0) return fromH(2 * st.ca);
    if (nOH < nH2A) return fromH((nH2A - nOH) / V);
    if (Math.abs(nOH - nH2A) < 1e-9) {
      const h = 0.5 * (-Ka2 + Math.sqrt(Ka2 * Ka2 + 4 * Ka2 * (nH2A / V)));
      return fromH(h);
    }
    if (nOH < 2 * nH2A) {
      const nHA = 2 * nH2A - nOH;
      const nA = nOH - nH2A;
      return fromH(Ka2 * nHA / Math.max(nA, 1e-16));
    }
    if (Math.abs(nOH - 2 * nH2A) < 1e-9) {
      const kb = Kw / Ka2;
      return fromH(Kw / Math.sqrt(kb * (nH2A / V)));
    }
    return fromH(Kw / ((nOH - 2 * nH2A) / V));
  }

  if (A.strong && B.strong) {
    let nH = 0, nOH = 0;
    if (analyteAcid) nH += nAnalyte; else nOH += nAnalyte;
    if (titrantAcid) nH += nTitrant; else nOH += nTitrant;
    const excessH = nH - nOH;
    if (Math.abs(excessH) < 1e-9) return 7;
    if (excessH > 0) return fromH(excessH / V);
    return fromH(Kw / ((-excessH) / V));
  }

  if (analyteAcid && !A.strong && B.strong && !titrantAcid) {
    const Ka = Math.pow(10, -A.pKa);
    if (nTitrant <= 0) {
      const h = 0.5 * (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * st.ca));
      return fromH(h);
    }
    if (nTitrant < nAnalyte - 1e-9) {
      return fromH(Ka * (nAnalyte - nTitrant) / Math.max(nTitrant, 1e-16));
    }
    if (Math.abs(nTitrant - nAnalyte) < 1e-9) {
      const kb = Kw / Ka;
      return fromH(Kw / Math.sqrt(kb * (nAnalyte / V)));
    }
    return fromH(Kw / ((nTitrant - nAnalyte) / V));
  }

  if (!analyteAcid && !A.strong && titrantAcid && B.strong) {
    const Ka = Math.pow(10, -(A.pKaBH || 9.25));
    if (nTitrant <= 0) {
      const kb = Kw / Ka;
      return fromH(Kw / Math.sqrt(kb * st.ca));
    }
    if (nTitrant < nAnalyte - 1e-9) {
      return fromH(Ka * nTitrant / Math.max(nAnalyte - nTitrant, 1e-16));
    }
    if (Math.abs(nTitrant - nAnalyte) < 1e-9) {
      return fromH(Math.sqrt(Ka * (nAnalyte / V)));
    }
    return fromH((nTitrant - nAnalyte) / V);
  }

  if (!A.strong && !B.strong) {
    const pKaA = analyteAcid ? A.pKa : (A.pKaBH || 9.25);
    const pKaB = titrantAcid ? B.pKa : (B.pKaBH || 9.25);
    const mid = 0.5 * (pKaA + pKaB);
    if (nTitrant <= 0) {
      if (analyteAcid) {
        const Ka = Math.pow(10, -pKaA);
        return fromH(0.5 * (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * st.ca)));
      }
      const Ka = Math.pow(10, -pKaA);
      return fromH(Kw / Math.sqrt((Kw / Ka) * st.ca));
    }
    const frac = Math.min(1.5, nTitrant / Math.max(nAnalyte, 1e-16));
    return mid + (frac - 0.5) * 3;
  }

  let nH = 0, nOH = 0;
  if (analyteAcid) nH += nAnalyte; else nOH += nAnalyte;
  if (titrantAcid) nH += nTitrant; else nOH += nTitrant;
  const excessH = nH - nOH;
  if (Math.abs(excessH) < 1e-9) return 7;
  if (excessH > 0) return fromH(excessH / V);
  return fromH(Kw / ((-excessH) / V));
}

export function mount(root, ctx) {
  const toast = (ctx && ctx.toast) || (() => {});
  const setStatus = (ctx && ctx.setStatus) || (() => {});
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id);
  const ac = new AbortController();
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { signal: ac.signal });
  const ctl = { paused: false };

  const st = {
    analyte: "acetic",
    titrant: "naoh",
    ca: 0.10,
    cb: 0.10,
    va: 25,
    vb: 0,
    ind: "bromo",
    curve: [],
    crossed: false,
    lastPH: 7,
  };

  const canvas = $("abCanvas");
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

  function resetCurve() {
    st.vb = 0;
    st.curve = [];
    st.crossed = false;
    const pH = computePH(st);
    st.curve.push({ v: 0, pH });
    st.lastPH = pH;
  }

  on($("sAnalyte"), "change", (e) => { st.analyte = e.target.value; resetCurve(); });
  on($("sTitrant"), "change", (e) => { st.titrant = e.target.value; resetCurve(); });
  on($("rCA"), "input", (e) => { st.ca = parseFloat(e.target.value); $("vCA").textContent = st.ca.toFixed(2) + " M"; resetCurve(); });
  on($("rCB"), "input", (e) => { st.cb = parseFloat(e.target.value); $("vCB").textContent = st.cb.toFixed(2) + " M"; resetCurve(); });
  on($("rVA"), "input", (e) => { st.va = parseFloat(e.target.value); $("vVA").textContent = st.va.toFixed(0) + " mL"; resetCurve(); });
  on($("indSeg"), "click", (e) => {
    const b = e.target.closest("[data-ind]");
    if (!b) return;
    st.ind = b.dataset.ind;
    $("indSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
  });
  on($("btnDrop"), "click", () => {
    st.vb = Math.min(80, st.vb + 0.5);
    const pH = computePH(st);
    const A = REAGENTS[st.analyte];
    const nA = st.ca * st.va / 1000;
    const nB = st.cb * st.vb / 1000;
    const need = A.diprotic ? 2 * nA : nA;
    if (nB >= need * 0.98 && st.vb > 0.2) st.crossed = true;
    st.lastPH = pH;
    st.curve.push({ v: st.vb, pH });
  });
  on($("btnReset"), "click", () => { resetCurve(); toast("Glassware rinsed"); });

  let raf = 0;
  function frame() {
    if (ac.signal.aborted) return;
    raf = requestAnimationFrame(frame);
    if (ctl.paused) return;
    const vp = $("viewport");
    const w = vp.clientWidth, h = vp.clientHeight;
    const pH = computePH(st);
    const ind = INDICATORS[st.ind];
    let t = 0;
    if (pH <= ind.lo) t = 0;
    else if (pH >= ind.hi) t = 1;
    else t = (pH - ind.lo) / (ind.hi - ind.lo);
    const col = mixColor(ind.acid, ind.base, t);

    g.clearRect(0, 0, w, h);
    g.fillStyle = "#07090d";
    g.fillRect(0, 0, w, h);

    const bx = w * 0.28, by = h * 0.22, bw = 90, bh = h * 0.55;
    g.fillStyle = "#1c2734";
    g.fillRect(bx - 8, by - 16, bw + 16, 16);
    g.strokeStyle = "#8aa0b8";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx, by + bh);
    g.quadraticCurveTo(bx + bw / 2, by + bh + 28, bx + bw, by + bh);
    g.lineTo(bx + bw, by);
    g.stroke();
    const fillH = Math.min(bh - 8, 40 + st.vb * 2.2);
    g.fillStyle = col;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(bx + 4, by + bh - fillH);
    g.lineTo(bx + 4, by + bh);
    g.quadraticCurveTo(bx + bw / 2, by + bh + 20, bx + bw - 4, by + bh);
    g.lineTo(bx + bw - 4, by + bh - fillH);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = "#eceef1";
    g.font = "12px IBM Plex Mono, monospace";
    g.fillText(REAGENTS[st.analyte].name, bx - 10, by + bh + 48);

    const px = w * 0.52, py = h * 0.14, pw = w * 0.42, ph = h * 0.7;
    g.fillStyle = "#10141b";
    g.fillRect(px, py, pw, ph);
    g.strokeStyle = "#2e323a";
    g.strokeRect(px, py, pw, ph);
    g.fillStyle = "#6d7380";
    g.fillText("pH", px + 8, py + 16);
    g.fillText("mL titrant", px + pw - 80, py + ph - 8);
    if (st.curve.length > 1) {
      g.beginPath();
      g.strokeStyle = "#7af0c8";
      g.lineWidth = 2;
      st.curve.forEach((pt, i) => {
        const x = px + 16 + (pt.v / 80) * (pw - 32);
        const y = py + ph - 20 - (pt.pH / 14) * (ph - 36);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    }

    $("mPH").textContent = pH.toFixed(2);
    $("mV").textContent = (st.va + st.vb).toFixed(1) + " mL";
    $("mTit").textContent = st.vb.toFixed(2) + " mL";
    $("mInd").textContent = ind.name.split(" ")[0];
    $("mH").textContent = Math.pow(10, -pH).toExponential(2);
    $("readTxt").textContent = "pH " + pH.toFixed(2) + " · " + (t > 0.7 ? "indicator in basic form" : t < 0.3 ? "indicator in acidic form" : "indicator transitioning");
    setStatus("Acid–base  pH " + pH.toFixed(2));
    Bus.set("acidbase", { pH, vb: st.vb, crossed: st.crossed, analyte: st.analyte });
  }
  resetCurve();
  frame();
  toast("Acid–base laboratory ready");

  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() { return { ...st }; },
    setState(s) { Object.assign(st, s); },
    unmount() {
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      root.innerHTML = "";
    },
  };
}
