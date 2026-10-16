/** Keep fallback gradients in document coordinates, including unavailable WebGL. */
export function hydrateStaticVeil(host: HTMLElement) {
  const view = host.ownerDocument.defaultView;
  if (!view || !host.querySelector(".cl-scene-static-veil")) return;
  const update = () => {
    if (!host.isConnected) {
      view.removeEventListener("scroll", update);
      view.removeEventListener("resize", update);
      return;
    }
    host.style.setProperty(
      "--scene-scroll-y",
      `${Math.max(0, view.scrollY)}px`,
    );
    host.style.setProperty("--scene-height", `${host.clientHeight}px`);
  };
  update();
  view.addEventListener("scroll", update, { passive: true });
  view.addEventListener("resize", update);
}
