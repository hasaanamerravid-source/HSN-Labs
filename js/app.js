/**
 * HSN-Sim launcher — instrument rack, control room, live laboratory mount.
 */
import { Bus } from "./bus.js";

const $ = (id) => document.getElementById(id);
const APP_VERSION = "2.6.0";

export const CATALOG = [
  {
    id: "em",
    short: "EM",
    name: "Electromagnet Laboratory",
    tag: "Fields",
    accent: "#3ec7ff",
    blurb: "Solenoid drive, core permeability, heating, and magnetic materials on the bench.",
    detail: "Voltage · turns · relative permeability",
    theory: "Induced moment follows H and saturates. Force uses an effective susceptibility.",
    module: () => import("./labs/em.js"),
  },
  {
    id: "accel",
    short: "ACC",
    name: "Particle Accelerator",
    tag: "Beams",
    accent: "#7af0c8",
    blurb: "Cyclotron and linear accelerator models with a Boris integrator and worldline tape.",
    detail: "Boris pusher · worldline tape",
    theory: "Non-relativistic cyclotron frequency ω = |q|B/m.",
    module: () => import("./labs/accelerator.js"),
  },
  {
    id: "nd",
    short: "nD",
    name: "Higher-Dimensional Geometry",
    tag: "Geometry",
    accent: "#c4a0ff",
    blurb: "Regular polytopes rotated in extra planes and projected into ordinary 3-space.",
    detail: "Tesseract · 24-cell · 5-cube",
    theory: "Rotate in coordinate planes, then perspective-divide extra axes.",
    module: () => import("./labs/nd-shapes.js"),
  },
  {
    id: "ragdoll",
    short: "MBD",
    name: "Multibody Dynamics",
    tag: "Mechanics",
    accent: "#ffb020",
    blurb: "Articulated rigid bodies with hinge constraints, contacts, and applied impulses.",
    detail: "Rigid bodies + hinge constraints",
    theory: "Box limbs with hinge joints. Contacts resolve against the floor.",
    module: () => import("./labs/ragdoll.js"),
  },
  {
    id: "nexus",
    short: "NX",
    name: "Coupled Multiphysics Workbench",
    tag: "Coupled",
    accent: "#ff6ad5",
    blurb: "Beam, iron, coil heat, and a 4D cage share one editable force law. Rewind the tape.",
    detail: "Coupled multiphysics · worldline",
    theory: "F = q(E + v × B) + ∇(m·B) + B_beam + Joule detune, with B scaled by a projected tesseract.",
    module: () => import("./labs/nexus.js"),
  },
  {
    id: "domains",
    short: "MD",
    name: "Magnetic Domain Laboratory",
    tag: "Fields",
    accent: "#38bdf8",
    blurb: "Weiss domains, wall motion, Barkhausen jumps, hysteresis, and the Curie point.",
    detail: "M–H loop · pinning · Curie temperature",
    theory: "Exchange-aligned domains. Walls move, then moments rotate. Heat above Tc removes order.",
    module: () => import("./labs/domains.js"),
  },
  {
    id: "reactor",
    short: "RX",
    name: "Fission & Fusion Reactor",
    tag: "Nuclear",
    accent: "#7af0c8",
    blurb: "Classroom chain-reaction core and a D–T fusion vessel. Control rods, k-effective, and confinement.",
    detail: "Neutron cycle · fusion Q",
    theory: "Fission: k = η f p ε L. Fusion: D + T → He-4 + n. Educational model only.",
    module: () => import("./labs/reactor.js"),
  },
  {
    id: "acidbase",
    short: "AB",
    name: "Acid–Base Laboratory",
    tag: "Chemistry",
    accent: "#f472b6",
    blurb: "Strong and weak acids and bases, indicators, and a live titration curve.",
    detail: "pH · equivalence · Ka / Kb",
    theory: "pH = −log10[H+]. Weak acids use the Henderson–Hasselbalch relation near the buffer region.",
    module: () => import("./labs/acidbase.js"),
  },
  {
    id: "states",
    short: "SM",
    name: "States of Matter",
    tag: "Matter",
    accent: "#a78bfa",
    blurb: "Solid, liquid, gas, plasma, supercritical fluid, Bose–Einstein condensate, and a quantum spin liquid.",
    detail: "Phase diagram · exotic order",
    theory: "Temperature, density, and interactions select the phase. Exotic states need extra order parameters.",
    module: () => import("./labs/states.js"),
  },
  {
    id: "combustion",
    short: "CB",
    name: "Combustion Laboratory",
    tag: "Chemistry",
    accent: "#fb923c",
    blurb: "Premixed flame, fuel–air ratio, completeness of burn, and product gases.",
    detail: "Equivalence ratio · adiabatic flame",
    theory: "Fuel + oxidizer → products + heat. Lean, stoichiometric, and rich regimes.",
    module: () => import("./labs/combustion.js"),
  },
];

const LAB_ICONS = {
  em: `<svg viewBox="0 0 24 24" fill="none"><path d="M7 8h10M7 16h10M9 8v8M15 8v8" stroke="#041018" stroke-width="1.8" stroke-linecap="round"/><path d="M4 12h3M17 12h3" stroke="#041018" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  accel: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="#041018" stroke-width="1.8"/><path d="M12 12l5-2" stroke="#041018" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  nd: `<svg viewBox="0 0 24 24" fill="none"><rect x="7" y="7" width="10" height="10" stroke="#041018" stroke-width="1.6"/><path d="M9 5h10v10" stroke="#041018" stroke-width="1.6"/></svg>`,
  ragdoll: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="6.5" r="2.1" stroke="#041018" stroke-width="1.6"/><path d="M12 8.8v5.2M8 11.2h8M9.2 19l2.8-5 2.8 5" stroke="#041018" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  nexus: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16M7 7l10 10M17 7 7 17" stroke="#041018" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  domains: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 8h6v8H5zM13 8h6v8h-6z" stroke="#041018" stroke-width="1.6"/><path d="M8 10v4M16 10v4" stroke="#041018" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  reactor: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" stroke="#041018" stroke-width="1.6"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.2 6.2l2.2 2.2M15.6 15.6l2.2 2.2M17.8 6.2l-2.2 2.2M8.4 15.6l-2.2 2.2" stroke="#041018" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  acidbase: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 3h6M10 3v5l-4.5 9.2A2.6 2.6 0 0 0 7.8 21h8.4a2.6 2.6 0 0 0 2.3-3.8L14 8V3" stroke="#041018" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 16h8" stroke="#041018" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  states: `<svg viewBox="0 0 24 24" fill="none"><circle cx="7" cy="9" r="1.4" stroke="#041018" stroke-width="1.5"/><circle cx="11" cy="7" r="1.4" stroke="#041018" stroke-width="1.5"/><circle cx="9" cy="12.5" r="1.4" stroke="#041018" stroke-width="1.5"/><circle cx="16.5" cy="10" r="2.6" stroke="#041018" stroke-width="1.5"/><path d="M5 18h14" stroke="#041018" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  combustion: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20c3.2 0 5.2-2.2 5.2-5.2C17.2 11 12 4.5 12 4.5S6.8 11 6.8 14.8C6.8 17.8 8.8 20 12 20Z" stroke="#041018" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 17.2c1.2 0 2-.8 2-1.9 0-1.3-2-3.4-2-3.4s-2 2.1-2 3.4c0 1.1.8 1.9 2 1.9Z" stroke="#041018" stroke-width="1.4"/></svg>`,
};

function labIcon(lab) {
  return LAB_ICONS[lab.id] || `<span class="short">${lab.short}</span>`;
}

const SETTINGS_KEY = "hsn-sim-settings-v26";
const DEFAULTS = {
  quality: "high",
  antialias: true,
  showStatusBar: true,
  reducedMotion: false,
  maxParticles: 24,
  accent: "cyan",
  shortcuts: true,
};

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  applyChrome(s);
}

function applyChrome(s) {
  document.documentElement.dataset.accent = s.accent || "cyan";
  $("stage").classList.toggle("status-off", !s.showStatusBar);
}

const instances = [];
let activeId = null;
let lastId = null;
let currentSession = null;
let seq = 1;
let bootGen = 0;
let switching = false;
let page = "home";
let settings = loadSettings();
const pendingLaunches = [];

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1700);
}

export function setStatus(text, kind = "ok") {
  const dot = $("runDot");
  const label = $("runText");
  if (label) label.textContent = text;
  if (dot) dot.className = "status-dot" + (kind === "ok" ? "" : " " + kind);
}

function countOf(labId) {
  return instances.filter((i) => i.labId === labId).length;
}

let labFilter = "all";

function filterCatalog(q) {
  const s = (q || "").trim().toLowerCase();
  return CATALOG.filter((l) => {
    if (labFilter !== "all" && l.tag !== labFilter) return false;
    if (!s) return true;
    return (l.name + " " + l.tag + " " + l.blurb + " " + l.detail).toLowerCase().includes(s);
  });
}

function renderMissions() {
  const box = $("missionGrid");
  const prog = $("missionProg");
  if (!box) return;
  const list = Bus.missions();
  const p = Bus.progress();
  if (prog) prog.textContent = p.done + " / " + p.total + " completed";
  box.innerHTML = list.map((m) => {
    const lab = CATALOG.find((l) => l.id === m.lab);
    return `<button class="mission ${m.done ? "done" : ""}" data-lab="${m.lab}">
      <div class="mission-top">
        <span class="badge">${lab ? lab.short : m.lab}</span>
        <span class="mission-state">${m.done ? "COMPLETE" : "OPEN"}</span>
      </div>
      <h3>${m.title}</h3>
      <p>${m.hint}</p>
    </button>`;
  }).join("");
}

function renderRack() {
  const q = $("searchBox") ? $("searchBox").value : "";
  const list = filterCatalog(q);
  const tags = ["all", ...new Set(CATALOG.map((l) => l.tag))];
  $("labFilters").innerHTML = tags.map((tag) =>
    `<button class="chip ${labFilter === tag ? "active" : ""}" data-filter="${tag}">${tag === "all" ? "All" : tag}</button>`
  ).join("");
  $("labsGrid").innerHTML = list.map((lab) => {
    const n = countOf(lab.id);
    const tel = Bus.get(lab.id);
    const live = tel ? Object.entries(tel).filter(([k]) => k !== "at").slice(0, 3).map(([k, v]) =>
      `${k} ${typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : v}`
    ).join(" · ") : lab.detail;
    return `<article class="rack-row">
      <div class="icon" style="background:${lab.accent}">${labIcon(lab)}</div>
      <div class="rack-copy">
        <h3>${lab.name}</h3>
        <p>${lab.blurb}</p>
        <small>${lab.theory || live}</small>
      </div>
      <div class="rack-side">
        <span class="badge">${n ? n + " session" + (n === 1 ? "" : "s") : lab.tag}</span>
        <button class="primary" data-lab="${lab.id}">Open</button>
      </div>
    </article>`;
  }).join("") || `<p class="help">No instruments match that filter.</p>`;
  $("labCount").textContent = list.length + " instrument" + (list.length === 1 ? "" : "s");
}

function renderGrids() {
  renderRack();
  renderMissions();
}

function renderJump() {
  const row = $("jumpRow");
  const box = $("jumpCards");
  if (!instances.length) {
    row.hidden = true;
    box.innerHTML = "";
    return;
  }
  row.hidden = false;
  box.innerHTML = instances
    .slice()
    .reverse()
    .slice(0, 5)
    .map((ins) => {
      const lab = CATALOG.find((l) => l.id === ins.labId);
      return `<button class="jump-card" data-focus="${ins.id}">
        <b>${ins.title}</b>
        <small>${lab ? lab.tag : ""} · ${ins.id === activeId ? "active" : "held"}</small>
      </button>`;
    })
    .join("");
}

function renderSessions() {
  const box = $("sessionList");
  const hint = $("sessionHint");
  const board = $("telemetryBoard");
  const all = Bus.all();
  const tiles = Object.entries(all).map(([id, m]) => {
    const lab = CATALOG.find((l) => l.id === id);
    const bits = Object.entries(m).filter(([k]) => k !== "at").slice(0, 4)
      .map(([k, v]) => `<div class="tel-kv"><label>${k}</label><b>${typeof v === "number" ? (Number.isInteger(v) ? v : Number(v).toFixed(2)) : String(v)}</b></div>`)
      .join("");
    return `<div class="tel-card">
      <div class="tel-head">${lab ? lab.name : id}</div>
      <div class="tel-grid">${bits}</div>
    </div>`;
  }).join("");
  if (board) board.innerHTML = tiles || `<p class="help">No telemetry yet. Open an instrument and readings persist after you leave the viewport.</p>`;
  if (!instances.length) {
    box.innerHTML = `<p class="help">Control room is empty. Open the workbench or any instrument from Laboratories.</p>`;
    if (hint) hint.textContent = "Open sessions keep their engines. Telemetry survives when you change pages.";
    return;
  }
  if (hint) hint.textContent = instances.length + " session" + (instances.length === 1 ? "" : "s") + " in the rack";
  box.innerHTML = instances
    .map((ins) => {
      const lab = CATALOG.find((l) => l.id === ins.labId);
      const live = ins.id === activeId;
      const tel = Bus.get(ins.labId);
      const extra = tel && tel.law ? tel.law : (tel && tel.shape ? tel.shape : (lab ? lab.tag : ""));
      return `<div class="session-row">
        <span class="${live ? "live" : "parked"}">${live ? "ACTIVE" : "HELD"}</span>
        <b>${ins.title}</b>
        <small style="color:var(--dim)">${extra}</small>
        <button data-focus="${ins.id}">${live ? "Show" : "Resume"}</button>
        <button class="danger" data-kill="${ins.id}">Close</button>
      </div>`;
    })
    .join("");
}

function renderStrip() {
  $("sessionStrip").innerHTML = instances
    .map((ins) => {
      const lab = CATALOG.find((l) => l.id === ins.labId);
      return `<button class="tab ${ins.id === activeId ? "active" : ""}" data-tab="${ins.id}">
        ${lab ? lab.short : "LAB"} · ${ins.title}
        <span class="x" data-kill="${ins.id}" title="Close">×</span>
      </button>`;
    })
    .join("");
}

function titlesFor(pageId) {
  const map = {
    home: ["Home", "Missions and the coupled workbench"],
    labs: ["Laboratories", "Specialized instruments"],
    sessions: ["Control Room", "Telemetry from held sessions"],
    settings: ["Preferences", "Graphics and application options"],
    lab: ["Laboratory", "Running simulation"],
  };
  return map[pageId] || map.home;
}

function showPage(id) {
  page = id;
  for (const v of ["viewHome", "viewLabs", "viewSessions", "viewSettings", "viewLab"]) {
    const el = $(v);
    if (el) el.hidden = true;
  }
  const viewId = id === "lab" ? "viewLab" : "view" + id[0].toUpperCase() + id.slice(1);
  const view = $(viewId);
  if (view) view.hidden = false;
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === (id === "lab" ? "sessions" : id));
  });
  const [t, s] = titlesFor(id);
  $("pageTitle").textContent = t;
  $("pageSub").textContent = s;
  $("searchBox").parentElement.style.visibility = id === "labs" ? "visible" : "hidden";
  $("searchBox").placeholder = id === "labs" ? "Filter instruments…" : "Search…";
  if (id === "home") { renderMissions(); renderJump(); }
  if (id === "labs") renderRack();
  if (id === "sessions") renderSessions();
  if (id === "lab") {
    if (currentSession && currentSession.resume) currentSession.resume();
  } else if (currentSession && currentSession.pause) {
    currentSession.pause();
  }
}

function captureActiveState() {
  const ins = instances.find((i) => i.id === activeId);
  if (!ins || !currentSession) return;
  try {
    if (currentSession.getState) ins.state = currentSession.getState();
  } catch (err) {
    console.warn("getState", err);
  }
}

function destroyEngine() {
  captureActiveState();
  if (currentSession && currentSession.unmount) {
    try { currentSession.unmount(); } catch (err) { console.warn("unmount", err); }
  }
  currentSession = null;
  const root = $("labRoot");
  if (root) root.innerHTML = "";
}

async function launch(labId) {
  const lab = CATALOG.find((l) => l.id === labId);
  if (!lab) return;
  const n = countOf(labId) + 1;
  const ins = {
    id: "i" + seq++,
    labId,
    title: n === 1 ? lab.name : `${lab.name} ${n}`,
    openedAt: Date.now(),
    state: null,
  };
  instances.push(ins);
  await activate(ins.id);
}

async function activate(id) {
  const ins = instances.find((i) => i.id === id);
  if (!ins) return;
  if (switching) {
    pendingLaunches.push(id);
    return;
  }
  if (activeId === id && currentSession) {
    showPage("lab");
    $("pageTitle").textContent = ins.title;
    if (currentSession.resume) currentSession.resume();
    return;
  }
  switching = true;
  const gen = ++bootGen;
  destroyEngine();
  activeId = id;
  lastId = id;
  const lab = CATALOG.find((l) => l.id === ins.labId);
  showPage("lab");
  $("pageTitle").textContent = ins.title;
  $("pageSub").textContent = lab ? lab.tag : "Laboratory";
  renderStrip();
  renderGrids();
  renderJump();
  const root = $("labRoot");
  root.innerHTML = `<div class="help" style="padding:20px">Loading ${ins.title}…</div>`;
  setStatus("Loading " + ins.title, "warn");
  try {
    const mod = await lab.module();
    if (gen !== bootGen) return;
    root.innerHTML = "";
    currentSession = mod.mount(root, {
      toast,
      instance: ins,
      settings: loadSettings(),
      setStatus,
      initialState: ins.state,
    });
    if (ins.state && currentSession && currentSession.setState) {
      try { currentSession.setState(ins.state); } catch (err) { console.warn("setState", err); }
    }
    setStatus(ins.title + " ready");
    toast(ins.title + " ready");
  } catch (err) {
    if (gen !== bootGen) return;
    root.innerHTML = `<div class="help" style="padding:24px">Failed to load laboratory: ${err.message}</div>`;
    setStatus("Load failed", "hot");
    console.error(err);
  } finally {
    if (gen === bootGen) {
      switching = false;
      const next = pendingLaunches.shift();
      if (next && next !== activeId) activate(next);
    }
  }
}

function closeInstance(id) {
  const idx = instances.findIndex((i) => i.id === id);
  if (idx < 0) return;
  const wasActive = activeId === id;
  if (activeId === id) destroyEngine();
  instances.splice(idx, 1);
  if (lastId === id) lastId = instances[0] ? instances[0].id : null;
  if (!instances.length) {
    activeId = null;
    showPage("home");
    setStatus("Ready", "off");
    return;
  }
  renderStrip();
  renderSessions();
  renderJump();
  renderGrids();
  if (wasActive && (page === "lab" || !currentSession)) activate(instances[Math.max(0, idx - 1)].id);
}

function resume(id) {
  activate(id);
}

function bindSettings() {
  const s = settings;
  $("setQuality").value = s.quality;
  $("setAA").checked = !!s.antialias;
  $("setStatusBar").checked = s.showStatusBar !== false;
  $("setMotion").checked = !!s.reducedMotion;
  $("setParticles").value = s.maxParticles;
  $("setPartLabel").textContent = String(s.maxParticles);
  $("setAccent").value = s.accent;
  $("setKeys").checked = s.shortcuts !== false;

  const persist = () => {
    settings = {
      quality: $("setQuality").value,
      antialias: $("setAA").checked,
      showStatusBar: $("setStatusBar").checked,
      reducedMotion: $("setMotion").checked,
      maxParticles: Number($("setParticles").value),
      accent: $("setAccent").value,
      shortcuts: $("setKeys").checked,
    };
    $("setPartLabel").textContent = String(settings.maxParticles);
    saveSettings(settings);
  };
  ["setQuality", "setAA", "setStatusBar", "setMotion", "setParticles", "setAccent", "setKeys"].forEach((id) => {
    const el = $(id);
    el.addEventListener("input", persist);
    el.addEventListener("change", persist);
  });
}

function bind() {
  applyChrome(settings);
  renderGrids();
  renderJump();
  renderSessions();
  bindSettings();
  setStatus("Ready", "off");
  const ver = $("statusRight");
  if (ver) ver.textContent = "HSN-Sim Laboratories v" + APP_VERSION + " · MIT";
  const note = $("settingsNote");
  if (note) note.textContent = "Graphics changes apply the next time a laboratory mounts.";
  const about = $("settingsAbout");
  if (about) about.textContent = "HSN-Sim Laboratories v" + APP_VERSION + " · MIT License · HasaanAmerRavid";

  $("navRail").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav]");
    if (!btn) return;
    const dest = btn.dataset.nav;
    if (dest !== "lab") {
      if (currentSession && currentSession.pause) currentSession.pause();
      setStatus(instances.length ? instances.length + " session(s) held" : "Ready", "off");
    }
    showPage(dest);
  });

  document.body.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav && nav.closest(".section-head")) showPage(nav.dataset.nav);
    const labBtn = e.target.closest("[data-lab]");
    if (labBtn) launch(labBtn.dataset.lab);
    const focus = e.target.closest("[data-focus]");
    if (focus) resume(focus.dataset.focus);
    const kill = e.target.closest("[data-kill]");
    if (kill && !kill.closest("#sessionStrip")) closeInstance(kill.dataset.kill);
  });

  $("sessionStrip").addEventListener("click", (e) => {
    const kill = e.target.closest("[data-kill]");
    if (kill) {
      e.preventDefault();
      e.stopPropagation();
      closeInstance(kill.dataset.kill);
      return;
    }
    const tab = e.target.closest("[data-tab]");
    if (tab) activate(tab.dataset.tab);
  });

  $("searchBox").addEventListener("input", renderRack);
  $("labFilters").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    labFilter = chip.dataset.filter;
    renderRack();
  });
  Bus.subscribe(() => {
    if (page === "home") renderMissions();
    if (page === "sessions") renderSessions();
  });

  window.addEventListener("keydown", (e) => {
    if (!settings.shortcuts) return;
    if (e.key === "Escape") {
      if (page === "lab" || page === "settings" || page === "sessions") {
        if (currentSession && currentSession.pause) currentSession.pause();
        showPage("home");
        setStatus(instances.length ? "Sessions held" : "Ready", "off");
      }
      return;
    }
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key >= "1" && e.key <= "9" && CATALOG[Number(e.key) - 1]) launch(CATALOG[Number(e.key) - 1].id);
  });

  window.addEventListener("pagehide", destroyEngine);
}

bind();
