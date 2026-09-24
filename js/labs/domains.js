/**
 * MagDomain — Weiss domains, wall motion, Barkhausen jumps, hysteresis.
 * Mounts the standalone lattice page inside the HSN lab chrome.
 */
import { Bus } from "../bus.js";

const TEMPLATE = `
<div class="lab-frame iframe-lab">
  <div class="lab-toolbar">
    <div class="header-metrics">
      <div class="metric"><label>Lab</label><b>MagDomain</b></div>
      <div class="metric"><label>H</label><b id="mH">0.0 Oe</b></div>
      <div class="metric"><label>M</label><b id="mM">0.00</b></div>
      <div class="metric"><label>T</label><b id="mT">300 K</b></div>
      <div class="metric"><label>Phase</label><b id="mPhase">domains</b></div>
    </div>
    <div class="header-actions">
      <a class="btn" href="labs/magdomain.html" target="_blank" rel="noopener">Open standalone</a>
    </div>
  </div>
  <iframe id="domainFrame" title="Domain Theory of Magnetism" src="labs/magdomain.html"></iframe>
</div>
`;

export function mount(root, ctx) {
  const setStatus = (ctx && ctx.setStatus) || (() => {});
  const toast = (ctx && ctx.toast) || (() => {});
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector("#" + id);

  function onMsg(ev) {
    const data = ev.data;
    if (!data || data.type !== "hsn-domains") return;
    if ($("mH")) $("mH").textContent = Number(data.H).toFixed(1) + " Oe";
    if ($("mM")) $("mM").textContent = Number(data.M).toFixed(2);
    if ($("mT")) $("mT").textContent = Math.round(data.T) + " K";
    if ($("mPhase")) $("mPhase").textContent = data.phase || "—";
    Bus.set("domains", {
      H: data.H,
      M: data.M,
      T: data.T,
      phase: data.phase,
      saturated: Math.abs(data.M) > 0.85,
      heated: data.T >= (data.tc || 1043),
    });
    setStatus("MagDomain · " + (data.phase || "live"));
  }

  window.addEventListener("message", onMsg);
  toast("MagDomain lattice online");
  setStatus("MagDomain ready");

  return {
    pause() {
      const frame = $("domainFrame");
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "hsn-domains-ctl", paused: true }, "*");
      }
    },
    resume() {
      const frame = $("domainFrame");
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "hsn-domains-ctl", paused: false }, "*");
      }
    },
    unmount() {
      window.removeEventListener("message", onMsg);
      root.innerHTML = "";
    },
  };
}
