import { hydrateStaticVeil } from "./ice-scene/static-veil";

/** The heavy renderer remains a lazy chunk until a model is near the viewport. */
export function hydrateModels(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>("[data-model-url], [data-portrait-url]")
    .forEach((host) => {
      if (host.dataset["modelMounted"]) return;
      host.dataset["modelMounted"] = "true";
      const progressive = host.dataset["progressiveScene"] === "true";
      if (progressive) hydrateStaticVeil(host);
      const fadeBackground =
        !progressive &&
        host.ownerDocument === document &&
        host.dataset["scenePreset"] === "ice-world" &&
        host.dataset["fullViewport"] === "true";
      // Prepare before the lazy import so the fallback cannot flash before the fade.
      if (fadeBackground) host.style.opacity = "0";
      const mount = () =>
        (host.dataset["portraitUrl"]
          ? host.dataset["scenePreset"] === "ice-world"
            ? import("./ice-scene/ice-world-runtime").then((m) =>
                m.mountIceWorld(host),
              )
            : import("./portrait-scene-runtime").then((m) =>
                m.mountPortraitScene(host),
              )
          : import("./gltf-runtime").then((m) => m.mountModel(host))
        ).catch(() => {
          // Keep the static image available if the scene chunk cannot load.
          if (fadeBackground) host.style.opacity = "1";
        });
      const load = () => {
        if (!progressive) return mount();
        // Let the already-discovered hero finish before competing for its bandwidth.
        const image = host.querySelector<HTMLImageElement>(
          ".cl-portrait-fallback",
        );
        const ready =
          !image || image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                const done = () => {
                  image.removeEventListener("load", done);
                  image.removeEventListener("error", done);
                  clearTimeout(timer);
                  resolve();
                };
                const timer = setTimeout(done, 4000);
                image.addEventListener("load", done, { once: true });
                image.addEventListener("error", done, { once: true });
              });
        return ready.then(
          () =>
            new Promise<void>((resolve) => {
              const run = () => {
                if (host.isConnected) void mount().finally(resolve);
                else resolve();
              };
              const idle = (
                window as Window & {
                  requestIdleCallback?: (
                    callback: () => void,
                    options: { timeout: number },
                  ) => number;
                }
              ).requestIdleCallback;
              if (idle) idle.call(window, run, { timeout: 1500 });
              else setTimeout(run, 100);
            }),
        );
      };
      if (host.dataset["lazyLoad"] === "false") {
        void load();
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer.disconnect();
            void load();
          }
        },
        { rootMargin: "200px" },
      );
      observer.observe(host);
    });
}
