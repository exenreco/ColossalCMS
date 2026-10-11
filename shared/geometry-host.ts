const mounted = new WeakSet<HTMLElement>();
/** Trusted host runtime; template markup remains script-free, including the editor. */
export function hydrateGeometry(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>(".maintenance-geometry")
    .forEach((host) => {
      if (mounted.has(host)) return;
      mounted.add(host);
      host.dataset["geometryMounted"] = "true";
      const doc = host.ownerDocument,
        win = doc.defaultView;
      if (!win) return;
      const canvas = doc.createElement("canvas"),
        ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.setAttribute("aria-hidden", "true");
      host.append(canvas);
      const number = (
        key: string,
        fallback: number,
        min: number,
        max: number,
      ) => {
        const value = Number(host.dataset[key]);
        return Number.isFinite(value)
          ? Math.max(min, Math.min(max, value))
          : fallback;
      };
      const count = number("geometryCount", 72, 12, 120);
      const points = Array.from({ length: count }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.000055,
        vy: (Math.random() - 0.5) * 0.000055,
        radius: i % 9 === 0 ? 16 + Math.random() * 26 : 2 + Math.random() * 3,
      }));
      let width = 0,
        height = 0,
        frame = 0,
        last = 0,
        disposed = false;
      const pointer = { x: -1000, y: -1000 };
      const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
      const move = (event: PointerEvent) => {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
      };
      const leave = () => {
        pointer.x = pointer.y = -1000;
      };
      const draw = (time: number) => {
        frame = 0;
        if (disposed || !host.isConnected) {
          dispose();
          return;
        }
        const dt =
          reduced.matches || doc.hidden
            ? 0
            : Math.min(time - (last || time), 40) *
              number("geometrySpeed", 1, 0, 4);
        last = time;
        ctx.clearRect(0, 0, width, height);
        const distance = Math.min(
          number("geometryDistance", 180, 60, 320),
          Math.max(width, height) * 0.5,
        );
        points.forEach((p, i) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.x < 0 || p.x > 1) p.vx *= -1;
          if (p.y < 0 || p.y > 1) p.vy *= -1;
          p.x = Math.max(0, Math.min(1, p.x));
          p.y = Math.max(0, Math.min(1, p.y));
          const x = p.x * width,
            y = p.y * height;
          for (let j = i + 1; j < points.length; j++) {
            const other = points[j],
              ox = other.x * width,
              oy = other.y * height;
            const length = Math.hypot(x - ox, y - oy);
            if (length > distance) continue;
            ctx.strokeStyle = `rgba(174,211,255,${(1 - length / distance) * 0.75})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(ox, oy);
            ctx.stroke();
          }
          const proximity = Math.hypot(pointer.x - x, pointer.y - y);
          if (!reduced.matches && proximity < 180) {
            ctx.strokeStyle = `rgba(212,233,255,${(1 - proximity / 180) * 0.85})`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(
            x,
            y,
            p.radius +
              (!reduced.matches ? Math.max(0, 1 - proximity / 150) * 8 : 0),
            0,
            Math.PI * 2,
          );
          ctx.strokeStyle = "rgba(202,227,255,.85)";
          ctx.lineWidth = 1.1;
          ctx.stroke();
          if (p.radius < 5) {
            ctx.fillStyle = "rgba(174,211,255,.5)";
            ctx.fill();
          }
        });
        if (!reduced.matches && !doc.hidden)
          frame = win.requestAnimationFrame(draw);
      };
      const resume = () => {
        win.cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
        if (!doc.hidden && !disposed) frame = win.requestAnimationFrame(draw);
      };
      const resize = () => {
        const rect = host.getBoundingClientRect(),
          dpr = Math.min(win.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        win.cancelAnimationFrame(frame);
        last = 0;
        draw(win.performance.now());
      };
      const resizeObserver = new ResizeObserver(resize),
        removal = new MutationObserver(() => {
          if (!host.isConnected) dispose();
        });
      function dispose() {
        if (disposed) return;
        disposed = true;
        win!.cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        removal.disconnect();
        doc.removeEventListener("pointermove", move);
        doc.removeEventListener("pointerleave", leave);
        doc.removeEventListener("visibilitychange", resume);
        reduced.removeEventListener("change", resume);
        win!.removeEventListener("pagehide", dispose);
      }
      doc.addEventListener("pointermove", move, { passive: true });
      doc.addEventListener("pointerleave", leave);
      doc.addEventListener("visibilitychange", resume);
      reduced.addEventListener("change", resume);
      win.addEventListener("pagehide", dispose, { once: true });
      resizeObserver.observe(host);
      removal.observe(doc.body, { childList: true, subtree: true });
      resize();
    });
}
