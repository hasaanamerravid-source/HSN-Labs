/**
 * Coupled multiphysics kernels shared by Nexus (and any future bench).
 *
 * Domains that talk to each other:
 *   EM     — Lorentz force on charges, magnetic-gradient force on iron
 *   beam   — bunch current adds a small B that iron can feel
 *   thermal— Joule heating detunes the RF kick
 *   4D     — tesseract W-projection scales the lab B
 *
 * Classroom scale: numbers are chosen so the coupling is visible, not SI-exact.
 */

export function rotatePair(v, i, j, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const vi = v[i], vj = v[j];
  v[i] = vi * c - vj * s;
  v[j] = vi * s + vj * c;
}

export function hypercube4() {
  const verts = [];
  for (let i = 0; i < 16; i++) {
    verts.push([
      i & 1 ? 1 : -1,
      i & 2 ? 1 : -1,
      i & 4 ? 1 : -1,
      i & 8 ? 1 : -1,
    ]);
  }
  const edges = [];
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      let d = 0;
      for (let k = 0; k < 4; k++) if (verts[i][k] !== verts[j][k]) d++;
      if (d === 1) edges.push([i, j]);
    }
  }
  return { verts, edges };
}

/** Boris pusher in 3-space. Mutates p.vx, p.vy, p.vz. */
export function borisPush(p, Bx, By, Bz, Ex, Ey, Ez, dt) {
  const qmh = (p.q / p.m) * dt * 0.5;
  let vx = p.vx + Ex * qmh;
  let vy = (p.vy || 0) + Ey * qmh;
  let vz = p.vz + Ez * qmh;
  const tx = qmh * Bx, ty = qmh * By, tz = qmh * Bz;
  const t2 = tx * tx + ty * ty + tz * tz;
  const sx = (2 * tx) / (1 + t2);
  const sy = (2 * ty) / (1 + t2);
  const sz = (2 * tz) / (1 + t2);
  const vpx = vx + (vy * tz - vz * ty);
  const vpy = vy + (vz * tx - vx * tz);
  const vpz = vz + (vx * ty - vy * tx);
  vx = vx + (vpy * sz - vpz * sy);
  vy = vy + (vpz * sx - vpx * sz);
  vz = vz + (vpx * sy - vpy * sx);
  p.vx = vx + Ex * qmh;
  p.vy = vy + Ey * qmh;
  p.vz = vz + Ez * qmh;
}

/** W-perspective scale from a 4D rotation angle. */
export function cageScale(cageA) {
  const w = Math.cos(cageA) * 0.85;
  return 1 / Math.max(0.35, 1 + w / 2.4);
}

/**
 * Soft-iron clustering raises the local permeability, so the beam feels
 * a stronger |B|. Returns a multiplier around 1.
 */
export function ironBackReaction(irons, B0) {
  if (!irons.length) return 1;
  let pack = 0;
  for (const iron of irons) {
    const r = Math.hypot(iron.x, iron.z);
    pack += (iron.chi || 2) / (1 + r * r * 8);
  }
  return 1 + Math.min(0.55, pack * 0.012 * Math.max(0.2, B0));
}

/**
 * Toy Biot–Savart: each charge adds a B ~ q (v × r̂) / r² at a sample point
 * on the pole face. Used so the beam can tug iron scraps.
 */
export function beamFieldAt(particles, x, z) {
  let Bx = 0, Bz = 0;
  for (const p of particles) {
    if (!p.alive) continue;
    const dx = x - p.x;
    const dz = z - p.z;
    const r2 = dx * dx + dz * dz + 0.04;
    const inv = p.q * 0.018 / (r2 * Math.sqrt(r2));
    Bx += (-p.vz) * inv * dz;
    Bz += (p.vx) * inv * dx;
  }
  return { Bx, Bz };
}

/** First-order ∇(m · B) pull toward the pole, plus optional beam-B kick. */
export function ironStep(iron, h, B0, useM, beamB) {
  if (!useM) {
    iron.x += iron.vx * h;
    iron.z += iron.vz * h;
    return;
  }
  const r2 = iron.x * iron.x + iron.z * iron.z + 0.02;
  const pull = B0 * iron.chi * 0.35 / r2;
  iron.vx += -iron.x * pull * h;
  iron.vz += -iron.z * pull * h;
  if (beamB) {
    iron.vx += beamB.Bx * iron.chi * 0.08 * h;
    iron.vz += beamB.Bz * iron.chi * 0.08 * h;
  }
  iron.vx *= 0.98;
  iron.vz *= 0.98;
  iron.x += iron.vx * h;
  iron.z += iron.vz * h;
  const rr = Math.hypot(iron.x, iron.z);
  if (rr < 0.12) {
    iron.x *= 0.12 / rr;
    iron.z *= 0.12 / rr;
    iron.vx = iron.vz = 0;
  }
}

/**
 * Lumped thermal node for the RF gap / coil.
 * Heat from effective current, Newton's-law cooling back to T0.
 */
export function thermalStep(th, dt, current, resistance) {
  const P = current * current * resistance;
  th.T += (P * th.kIn - th.kCool * (th.T - th.T0)) * dt;
  if (th.T < th.T0) th.T = th.T0;
  const detune = 1 / (1 + Math.max(0, th.T - th.T0) * 0.012);
  return detune;
}

export function makeThermal() {
  return { T: 24, T0: 24, kIn: 0.55, kCool: 0.18 };
}

/**
 * One coupled tick: cage → B, iron μ → B, heat → RF, then
 * Boris on the beam and gradient force on iron.
 */
export function coupleStep(st, dt) {
  const By0 = st.useB ? st.B0 * (st.useCage ? (0.55 + 0.9 * cageScale(st.cageA)) : 1) : 0;
  const mu = st.useM ? ironBackReaction(st.irons, st.B0) : 1;
  const By = By0 * mu;
  const Ieq = st.particles.reduce((s, p) => s + (p.alive ? Math.hypot(p.vx, p.vz) * Math.abs(p.q) : 0), 0);
  const detune = st.useHeat ? thermalStep(st.thermal, dt, Ieq * 0.35 + (st.useE ? st.kick * 0.04 : 0), 6.5) : 1;
  const rf = Math.sin(st.phase);
  const kick = st.kick * detune;
  st.phase += Math.max(0.05, By) * dt;
  st.cageA += st.spin * dt;
  st.lastBy = By;
  st.lastMu = mu;
  st.lastDetune = detune;
  st.lastI = Ieq;
  st.lastT = st.thermal.T;

  const sub = 8;
  const h = dt / sub;
  for (let s = 0; s < sub; s++) {
    for (const p of st.particles) {
      if (!p.alive) continue;
      let Ex = 0;
      if (st.useE && Math.abs(p.x) < 0.07) Ex = kick * 0.03 * rf;
      borisPush(p, 0, By, 0, Ex, 0, 0, h);
      p.x += p.vx * h;
      p.z += p.vz * h;
      p.y = 0.3;
      p.vy = 0;
      if (Math.hypot(p.x, p.z) > 1.12) {
        p.alive = false;
        if (p.mesh) p.mesh.visible = false;
      }
    }
    for (const iron of st.irons) {
      const beamB = st.useBeamB ? beamFieldAt(st.particles, iron.x, iron.z) : null;
      ironStep(iron, h, st.B0, st.useM, beamB);
    }
  }
  return { By, mu, detune, rf, Ieq };
}

export function lawText(st) {
  const parts = [];
  if (st.useE && st.useB) parts.push("q(E + v × B)");
  else if (st.useE) parts.push("qE");
  else if (st.useB) parts.push("q v × B");
  if (st.useM) parts.push("∇(m·B)_iron");
  if (st.useBeamB) parts.push("B_beam→iron");
  if (st.useHeat) parts.push("Joule detune");
  if (st.useCage) parts.push("B·cage(W)");
  return parts.length ? "F = " + parts.join(" + ") : "F = 0";
}
