/**
 * Shared WebGL / loop helpers — safer mount and teardown.
 */
export function bindViewport(viewport, camera, renderer) {
  const apply = () => {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (w < 4 || h < 4) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(viewport);
  const onLost = (e) => e.preventDefault();
  const onRestored = () => {
    try { apply(); } catch (_) {}
  };
  renderer.domElement.addEventListener("webglcontextlost", onLost);
  renderer.domElement.addEventListener("webglcontextrestored", onRestored);
  return () => {
    ro.disconnect();
    renderer.domElement.removeEventListener("webglcontextlost", onLost);
    renderer.domElement.removeEventListener("webglcontextrestored", onRestored);
  };
}

export function disposeThree(renderer, scene) {
  try {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mat = obj.material;
      if (!mat) return;
      const list = Array.isArray(mat) ? mat : [mat];
      for (const m of list) {
        for (const key of Object.keys(m)) {
          const v = m[key];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    });
  } catch (_) {}
  try {
    renderer.dispose();
    if (typeof renderer.forceContextLoss === "function") renderer.forceContextLoss();
  } catch (_) {}
  if (renderer.domElement && renderer.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
}

export function startLoop(step, ctl) {
  let raf = 0;
  let alive = true;
  const clock = { last: performance.now() };
  const frame = (now) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - clock.last) / 1000);
    clock.last = now;
    if (ctl && ctl.paused) return;
    try {
      step(dt);
    } catch (err) {
      console.error("lab frame", err);
    }
  };
  raf = requestAnimationFrame(frame);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}

export function sessionApi(ctl, extra = {}) {
  return {
    pause() { ctl.paused = true; },
    resume() { ctl.paused = false; },
    getState() { return extra.getState ? extra.getState() : null; },
    setState(s) { if (extra.setState && s) extra.setState(s); },
    unmount() { if (extra.unmount) extra.unmount(); },
  };
}
