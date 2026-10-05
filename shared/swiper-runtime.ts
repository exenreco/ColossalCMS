import Swiper from "swiper";
import {
  A11y,
  Autoplay,
  EffectFade,
  Navigation,
  Pagination,
} from "swiper/modules";

export function mountSlider(host: HTMLElement, editing: boolean) {
  if (!host.isConnected) return;
  const slides = host.querySelectorAll(
    ":scope > .swiper-wrapper > .swiper-slide",
  );
  if (!slides.length) return;
  const number = (key: string, fallback: number) =>
    Number(host.dataset[key]) || fallback;
  const perView = Math.max(1, Math.min(6, number("swiperPerView", 1)));
  const effect = host.dataset["swiperEffect"] === "fade" ? "fade" : "slide";
  const next = host.querySelector<HTMLElement>(".swiper-button-next");
  const prev = host.querySelector<HTMLElement>(".swiper-button-prev");
  const dots = host.querySelector<HTMLElement>(".swiper-pagination");
  const options = {
    modules: [A11y, Autoplay, EffectFade, Navigation, Pagination],
    slidesPerView: effect === "fade" ? 1 : perView,
    spaceBetween: Math.max(0, number("swiperGap", 0)),
    speed: Math.max(0, number("swiperSpeed", 400)),
    effect,
    loop:
      !editing &&
      host.dataset["swiperLoop"] === "true" &&
      slides.length > (effect === "fade" ? 1 : perView),
    autoplay:
      !editing && host.dataset["swiperAutoplay"] === "true"
        ? {
            delay: Math.max(500, number("swiperDelay", 5000)),
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          }
        : false,
    navigation:
      next && prev ? { nextEl: next, prevEl: prev, addIcons: false } : false,
    pagination: dots ? { el: dots, clickable: true } : false,
    allowTouchMove: !editing,
    observer: false,
    resizeObserver: false,
  };
  // The editor canvas is a script-free iframe. Swiper's mount() checks the
  // parent realm's HTMLElement, so use the canvas realm for its synchronous init.
  const nativeElement = globalThis.HTMLElement;
  const frameElement = host.ownerDocument.defaultView?.HTMLElement;
  let slider: Swiper;
  try {
    if (frameElement) globalThis.HTMLElement = frameElement;
    slider = new Swiper(host, options);
  } finally {
    globalThis.HTMLElement = nativeElement;
  }
  if (slider.initialized) host.dataset["swiperReady"] = "true";
  return slider;
}
