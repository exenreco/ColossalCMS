const hydrated = new WeakSet<Document>();
/** Native loading keeps src/srcset usable without JS. No wrappers alter theme layout. */
export function hydrateLazyLoad(doc: Document) {
  if (hydrated.has(doc) || !doc.querySelector("[data-cl-lazy-config]")) return;
  hydrated.add(doc);
  const tracked = new WeakSet<HTMLImageElement>();
  const scan = () => {
    doc
      .querySelectorAll<HTMLImageElement>("img[data-cl-lazy-image]")
      .forEach((image) => {
        if (tracked.has(image)) return;
        tracked.add(image);
        const settle = () => {
          image.classList.remove("cl-lazy-pending");
          image.removeAttribute("aria-busy");
          if (image.dataset["clLazyMinHeight"] === "true") {
            image.style.removeProperty("min-height");
            delete image.dataset["clLazyMinHeight"];
          }
        };
        const start = () => {
          if (image.complete) {
            settle();
            return;
          }
          image.classList.add("cl-lazy-pending");
          image.setAttribute("aria-busy", "true");
          if (!image.getBoundingClientRect().height && !image.style.minHeight) {
            image.style.minHeight = "48px";
            image.dataset["clLazyMinHeight"] = "true";
          }
        };
        image.addEventListener("load", settle);
        image.addEventListener("error", settle);
        start();
      });
  };
  scan();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (
        record.type === "attributes" &&
        record.target instanceof doc.defaultView!.HTMLImageElement
      ) {
        const image = record.target as HTMLImageElement;
        if (image.hasAttribute("data-cl-lazy-image") && !image.complete) {
          image.classList.add("cl-lazy-pending");
          image.setAttribute("aria-busy", "true");
        }
      }
    }
    if (records.some((record) => record.type === "childList")) scan();
  });
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "sizes"],
  });
  doc.defaultView?.addEventListener(
    "pagehide",
    () => {
      observer.disconnect();
      hydrated.delete(doc);
    },
    { once: true },
  );
}
