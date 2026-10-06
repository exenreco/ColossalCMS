/** The heavy renderer remains a lazy chunk until a model is near the viewport. */
export function hydrateModels(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>("[data-model-url], [data-portrait-url]")
    .forEach((host) => {
      if (host.dataset["modelMounted"]) return;
      host.dataset["modelMounted"] = "true";
      const load = () =>
        host.dataset["portraitUrl"]
          ? host.dataset["scenePreset"] === "ice-world"
            ? import("./ice-scene/ice-world-runtime").then((m) =>
                m.mountIceWorld(host),
              )
            : import("./portrait-scene-runtime").then((m) =>
                m.mountPortraitScene(host),
              )
          : import("./gltf-runtime").then((m) => m.mountModel(host));
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
