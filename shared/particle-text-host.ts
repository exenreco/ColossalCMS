const mounted = new WeakSet<HTMLElement>();
/** Trusted canvas enhancement shared by the frontend and script-free editor frames. */
export function hydrateParticleText(doc: Document) {
  doc.querySelectorAll<HTMLElement>(".glossy-particle-text").forEach((host) => {
    if (mounted.has(host)) return;
    const win = doc.defaultView;
    if (!win) return;
    const canvas = doc.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const mask = doc.createElement("canvas");
    const maskCtx = mask.getContext("2d", { willReadFrequently: true });
    if (!ctx || !maskCtx) return;
    mounted.add(host);
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    const number = (
      key: string,
      fallback: number,
      min: number,
      max: number,
    ) => {
      const raw = host.dataset[key];
      const value = raw === undefined || raw === "" ? fallback : Number(raw);
      return Number.isFinite(value)
        ? Math.max(min, Math.min(max, value))
        : fallback;
    };
    const color = /^#[a-f\d]{6}$/i.test(host.dataset["particleColor"] || "")
      ? host.dataset["particleColor"]!
      : "#c5e5ff";
    const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      disposed = false;
    let points: {
      ax: number;
      ay: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
    }[] = [];
    const pointer = { x: -1000, y: -1000 };
    const move = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const leave = () => {
      pointer.x = pointer.y = -1000;
    };
    const scatter = (event: PointerEvent) => {
      if (
        reduced.matches ||
        (event.target as Element)?.closest("a,button,input")
      )
        return;
      move(event);
      const strength = number("particleStrength", 1, 0, 3);
      for (const p of points) {
        const dx = p.x - pointer.x,
          dy = p.y - pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < 240) {
          p.vx += (dx / distance) * (1 - distance / 240) * 22 * strength;
          p.vy += (dy / distance) * (1 - distance / 240) * 22 * strength;
        }
      }
    };
    const draw = (time: number) => {
      frame = 0;
      if (disposed || !host.isConnected) {
        dispose();
        return;
      }
      if (doc.hidden) return;
      const dt = Math.min((time - (last || time)) / 16.667, 2);
      last = time;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      const radius = number("particleRadius", 130, 40, 240);
      const strength = number("particleStrength", 1, 0, 3);
      for (const p of points) {
        if (reduced.matches) {
          p.x = p.ax;
          p.y = p.ay;
          p.vx = p.vy = 0;
        } else {
          const dx = p.x - pointer.x,
            dy = p.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < radius) {
            const angle =
              distance > 0.01 ? Math.atan2(dy, dx) : p.alpha * Math.PI * 2;
            const force = (1 - distance / radius) * 2.5 * strength * dt;
            p.vx += Math.cos(angle) * force;
            p.vy += Math.sin(angle) * force;
          }
          p.vx = (p.vx + (p.ax - p.x) * 0.018 * dt) * Math.pow(0.88, dt);
          p.vy = (p.vy + (p.ay - p.y) * 0.018 * dt) * Math.pow(0.88, dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduced.matches) frame = win.requestAnimationFrame(draw);
    };
    const resume = () => {
      win.cancelAnimationFrame(frame);
      last = 0;
      if (!disposed && !doc.hidden) frame = win.requestAnimationFrame(draw);
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(win.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Sample a bounded mask, regardless of monitor size or device pixel ratio.
      const scale = Math.min(1, 1400 / width);
      mask.width = Math.round(width * scale);
      mask.height = Math.round(Math.min(height, 1200) * scale);
      const text = (host.dataset["particleText"] || "404").slice(0, 12);
      let fontSize = Math.min(mask.width * 0.34, mask.height * 0.4, 420);
      maskCtx.font = `900 ${fontSize}px Arial`;
      const measured = maskCtx.measureText(text).width;
      if (measured > mask.width * 0.86)
        fontSize *= (mask.width * 0.86) / measured;
      maskCtx.font = `900 ${fontSize}px Arial`;
      maskCtx.textAlign = "center";
      maskCtx.textBaseline = "middle";
      maskCtx.fillStyle = "#fff";
      maskCtx.fillText(
        text,
        mask.width / 2,
        Math.min(height * 0.37, 440) * scale,
      );
      const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
      points = [];
      const step = Math.max(4, Math.round(mask.width / 170));
      for (let y = 0; y < mask.height; y += step)
        for (let x = 0; x < mask.width; x += step) {
          if (
            pixels[(y * mask.width + x) * 4 + 3] < 128 ||
            points.length >= 3000
          )
            continue;
          const ax = x / scale,
            ay = y / scale;
          points.push({
            ax,
            ay,
            x: ax,
            y: ay,
            vx: 0,
            vy: 0,
            size: (0.65 + Math.random() * 1.15) / scale,
            alpha: 0.35 + Math.random() * 0.65,
          });
        }
      host.setAttribute("data-particle-mounted", "");
      resume();
    };
    const observer = new ResizeObserver(resize);
    const removal = new MutationObserver(() => {
      if (!host.isConnected) dispose();
    });
    function dispose() {
      if (disposed) return;
      disposed = true;
      win!.cancelAnimationFrame(frame);
      observer.disconnect();
      removal.disconnect();
      doc.removeEventListener("pointermove", move);
      doc.removeEventListener("pointerleave", leave);
      doc.removeEventListener("pointerdown", scatter);
      doc.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", resume);
      win!.removeEventListener("pagehide", dispose);
    }
    doc.addEventListener("pointermove", move, { passive: true });
    doc.addEventListener("pointerleave", leave);
    doc.addEventListener("pointerdown", scatter, { passive: true });
    doc.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    win.addEventListener("pagehide", dispose, { once: true });
    observer.observe(host);
    removal.observe(doc.body, { childList: true, subtree: true });
    resize();
  });
}
