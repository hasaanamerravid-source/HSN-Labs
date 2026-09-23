/**
 * Worldline tape — record a simulation, scrub time, replay, interpolate.
 *
 * A "worldline" here is just the recorded path of the system through
 * configuration space. Pause, drag the slider, or replay at a chosen rate.
 */

function lerpSnap(a, b, t) {
  if (a == null) return b;
  if (b == null) return a;
  if (typeof a === "number" && typeof b === "number") {
    if (!Number.isFinite(a)) return b;
    if (!Number.isFinite(b)) return a;
    return a + (b - a) * t;
  }
  if (typeof a === "boolean" || typeof a === "string") return t < 1 ? a : b;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = lerpSnap(a[i] ?? b[i], b[i] ?? a[i], t);
    return out;
  }
  if (a && typeof a === "object" && b && typeof b === "object") {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) out[k] = lerpSnap(a[k], b[k], t);
    return out;
  }
  return t < 1 ? a : b;
}

export function createWorldline(opts = {}) {
  const max = opts.max || 360;
  const minDt = 1 / (opts.hz || 36);

  const tape = {
    frames: [],
    simTime: 0,
    acc: 0,
    paused: false,
    scrubbed: false,
    replaying: false,
    playRate: 1,
    cursor: 1,
  };

  function duration() {
    if (!tape.frames.length) return 0;
    return tape.frames[tape.frames.length - 1].t - tape.frames[0].t;
  }

  function sample(u) {
    const frames = tape.frames;
    if (!frames.length) return null;
    if (frames.length === 1) return frames[0].snap;
    const t0 = frames[0].t;
    const t1 = frames[frames.length - 1].t;
    const target = t0 + Math.max(0, Math.min(1, u)) * (t1 - t0);
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].t < target) lo = mid + 1;
      else hi = mid;
    }
    const i1 = Math.max(1, lo);
    const i0 = i1 - 1;
    const span = frames[i1].t - frames[i0].t || 1e-6;
    const a = (target - frames[i0].t) / span;
    return lerpSnap(frames[i0].snap, frames[i1].snap, a);
  }

  function seek01(u, apply) {
    tape.paused = true;
    tape.replaying = false;
    tape.scrubbed = true;
    tape.cursor = Math.max(0, Math.min(1, u));
    const snap = sample(tape.cursor);
    if (snap && apply) apply(snap, tape.cursor);
    return snap;
  }

  function record(dt, snap) {
    if (tape.paused || tape.replaying) return false;
    tape.simTime += dt;
    tape.acc += dt;
    if (tape.acc < minDt && tape.frames.length) return false;
    tape.acc = 0;
    tape.frames.push({ t: tape.simTime, snap });
    if (tape.frames.length > max) tape.frames.shift();
    tape.cursor = 1;
    return true;
  }

  function advanceReplay(dt, apply) {
    if (!tape.replaying || !tape.frames.length) return null;
    const span = duration() || 1e-6;
    tape.cursor += (dt * tape.playRate) / span;
    if (tape.cursor >= 1) {
      tape.cursor = 1;
      tape.replaying = false;
      tape.paused = false;
    }
    const snap = sample(tape.cursor);
    if (snap && apply) apply(snap, tape.cursor);
    return snap;
  }

  function label() {
    if (!tape.frames.length) return "empty";
    if (!tape.paused && !tape.replaying) return "live";
    if (tape.replaying) return "replay " + (tape.cursor * duration()).toFixed(2) + " s";
    return (tape.cursor * duration()).toFixed(2) + " s";
  }

  return {
    tape,
    duration,
    sample,
    seek01,
    record,
    advanceReplay,
    label,
    pause() {
      tape.paused = true;
      tape.replaying = false;
    },
    live() {
      tape.paused = false;
      tape.replaying = false;
      tape.cursor = 1;
    },
    replay() {
      if (!tape.frames.length) return;
      tape.paused = true;
      tape.replaying = true;
      tape.scrubbed = true;
      if (tape.cursor >= 0.995) tape.cursor = 0;
    },
    clear() {
      tape.frames.length = 0;
      tape.simTime = 0;
      tape.acc = 0;
      tape.cursor = 1;
      tape.paused = false;
      tape.replaying = false;
    },
    get scrubbed() { return tape.scrubbed; },
    get paused() { return tape.paused; },
    get replaying() { return tape.replaying; },
    get liveMode() { return !tape.paused && !tape.replaying; },
    get cursor() { return tape.cursor; },
    get count() { return tape.frames.length; },
    setPlayRate(r) { tape.playRate = Math.max(0.1, Math.min(4, r)); },
    toJSON() {
      return {
        frames: tape.frames,
        simTime: tape.simTime,
        cursor: tape.cursor,
        playRate: tape.playRate,
      };
    },
    fromJSON(data) {
      if (!data || !Array.isArray(data.frames)) return;
      tape.frames = data.frames;
      tape.simTime = data.simTime || 0;
      tape.cursor = data.cursor == null ? 1 : data.cursor;
      tape.playRate = data.playRate || 1;
      tape.acc = 0;
      tape.paused = false;
      tape.replaying = false;
    },
  };
}

export function worldlineTemplate(extraHelp) {
  return `
    <div class="section">
      <h2>Worldline</h2>
      <p class="help" id="wlHelp">${extraHelp || "Recording live. Pause and drag time backward along the same trajectory."}</p>
      <div class="row"><label>Scrub</label><span class="val" id="vScrub">live</span></div>
      <input type="range" id="rScrub" min="0" max="1000" step="1" value="1000" />
      <div class="row"><label>Replay rate</label><span class="val" id="vRate">1.00×</span></div>
      <input type="range" id="rRate" min="0.25" max="3" step="0.05" value="1" />
      <div class="seg" style="margin-top:8px">
        <button id="btnWlPause">Pause / scrub</button>
        <button id="btnWlReplay">Replay tape</button>
        <button id="btnWlLive">Live</button>
      </div>
    </div>
  `;
}

export function bindWorldlineControls(root, wl, apply, hooks = {}) {
  const $ = (id) => root.querySelector("#" + id);
  const on = hooks.on || ((el, ev, fn) => el && el.addEventListener(ev, fn));

  function paint() {
    if ($("vScrub")) $("vScrub").textContent = wl.label();
    if ($("rScrub")) $("rScrub").value = String(Math.round(wl.cursor * 1000));
    if ($("wlHelp")) {
      $("wlHelp").textContent = wl.liveMode
        ? "Recording live. Pause to drag time, or replay the tape."
        : wl.replaying
          ? "Replaying the recorded worldline. Live recording is frozen."
          : "Tape paused. Drag scrub to walk the worldline backward or forward.";
    }
    if (hooks.onPaint) hooks.onPaint(wl);
  }

  on($("rScrub"), "input", (e) => {
    const u = parseFloat(e.target.value) / 1000;
    wl.seek01(u, apply);
    paint();
  });
  on($("rRate"), "input", (e) => {
    const r = parseFloat(e.target.value);
    wl.setPlayRate(r);
    if ($("vRate")) $("vRate").textContent = r.toFixed(2) + "×";
  });
  on($("btnWlPause"), "click", () => {
    if (wl.liveMode) wl.pause();
    else wl.live();
    paint();
    if (hooks.toast) hooks.toast(wl.liveMode ? "Back to live" : "Worldline paused");
  });
  on($("btnWlReplay"), "click", () => {
    wl.replay();
    paint();
    if (hooks.toast) hooks.toast("Replaying worldline");
  });
  on($("btnWlLive"), "click", () => {
    wl.live();
    paint();
    if (hooks.toast) hooks.toast("Live recording");
  });

  paint();
  return paint;
}
