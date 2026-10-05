/** Mount each rendered slider once, including sliders inside the editor's canvas iframe. */
export function hydrateSliders(root: ParentNode, editing = false) {
  root.querySelectorAll<HTMLElement>(".cl-swiper").forEach((host) => {
    if (host.dataset["swiperMounted"]) return;
    host.dataset["swiperMounted"] = "true";
    void import("./swiper-runtime")
      .then((module) => module.mountSlider(host, editing))
      .catch(() => delete host.dataset["swiperMounted"]);
  });
}
