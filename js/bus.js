/**
 * Shared telemetry + mission board.
 */
const listeners = new Set();
const metrics = new Map();

const MISSIONS = [
  {
    id: "nexus-first",
    title: "Ignite the workbench",
    lab: "nexus",
    hint: "Open the workbench and inject a charged bunch into the magnetic field.",
    test: (m) => (m.nexus && m.nexus.particles > 0),
  },
  {
    id: "worldline",
    title: "Scrub a worldline",
    lab: "nexus",
    hint: "Record a few seconds, pause, and drag the time slider backward.",
    test: (m) => m.nexus && m.nexus.scrubbed,
  },
  {
    id: "coupled",
    title: "Observe the coupling",
    lab: "nexus",
    hint: "Leave iron, beam field, and heat enabled so the bunch and scraps interact.",
    test: (m) => m.nexus && m.nexus.coupled && m.nexus.particles > 0 && m.nexus.irons > 0,
  },
  {
    id: "beam-turns",
    title: "Eight cyclotron turns",
    lab: "accel",
    hint: "Keep a bunch on orbit for eight revolutions.",
    test: (m) => m.accel && m.accel.turns >= 8,
  },
  {
    id: "see-24",
    title: "Inspect the 24-cell",
    lab: "nd",
    hint: "In Higher-Dimensional Geometry, switch to the 24-cell.",
    test: (m) => m.nd && m.nd.shape === "icositetrachoron",
  },
  {
    id: "coil-on",
    title: "Energize the coil",
    lab: "em",
    hint: "Turn the electromagnet on.",
    test: (m) => m.em && m.em.powered,
  },
  {
    id: "domains-sat",
    title: "Saturate the lattice",
    lab: "domains",
    hint: "Drive H to saturation or heat the sample through the Curie point.",
    test: (m) => m.domains && (m.domains.saturated || m.domains.heated),
  },
  {
    id: "reactor-crit",
    title: "Reach criticality",
    lab: "reactor",
    hint: "Withdraw rods until k-effective reaches 1.00 without a thermal trip.",
    test: (m) => m.reactor && m.reactor.k >= 1,
  },
  {
    id: "titrate",
    title: "Pass the equivalence point",
    lab: "acidbase",
    hint: "Add titrant until the curve passes equivalence (strong pair at pH 7, or a weak-acid jump).",
    test: (m) => m.acidbase && m.acidbase.crossed,
  },
  {
    id: "stoich",
    title: "Stoichiometric flame",
    lab: "combustion",
    hint: "Set the equivalence ratio near 1.0 and light the burner.",
    test: (m) => m.combustion && m.combustion.lit && Math.abs(m.combustion.phi - 1) < 0.08,
  },
];

function loadDone() {
  try { return JSON.parse(localStorage.getItem("hsn-missions-v27") || "[]"); }
  catch { return []; }
}
let done = new Set(loadDone());

function emit() {
  const snap = Object.fromEntries(metrics);
  for (const fn of listeners) {
    try { fn(snap); } catch (_) {}
  }
}

export const Bus = {
  set(labId, data) {
    metrics.set(labId, { ...(metrics.get(labId) || {}), ...data, at: Date.now() });
    let changed = false;
    const all = Object.fromEntries(metrics);
    for (const m of MISSIONS) {
      if (done.has(m.id)) continue;
      try {
        if (m.test(all)) { done.add(m.id); changed = true; }
      } catch (_) {}
    }
    if (changed) localStorage.setItem("hsn-missions-v27", JSON.stringify([...done]));
    emit();
  },
  get(labId) { return metrics.get(labId) || null; },
  all() { return Object.fromEntries(metrics); },
  missions() {
    return MISSIONS.map((m) => ({ ...m, done: done.has(m.id) }));
  },
  progress() {
    return { done: done.size, total: MISSIONS.length };
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  resetMissions() {
    done = new Set();
    try { localStorage.removeItem("hsn-missions-v26"); localStorage.removeItem("hsn-missions-v27"); } catch (_) {}
    emit();
  },
};
