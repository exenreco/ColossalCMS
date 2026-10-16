/** Mount each rendered slider once, including sliders inside the editor's canvas iframe. */
export function hydrateSliders(root: ParentNode, editing = false) {
  root.querySelectorAll<HTMLElement>(".cl-swiper").forEach((host) => {
    if (host.dataset["swiperMounted"]) return;
    host.dataset["swiperMounted"] = "true";
    const load = () =>
      import("./swiper-runtime")
        .then((module) => module.mountSlider(host, editing))
        .catch(() => delete host.dataset["swiperMounted"]);
    if (editing || !globalThis.IntersectionObserver) {
      void load();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          if (host.isConnected) void load();
        } else if (!host.isConnected) observer.disconnect();
      },
      { rootMargin: "200px" },
    );
    observer.observe(host);
  });
}
