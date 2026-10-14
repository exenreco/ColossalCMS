const hydrated = new WeakSet<Document>();
/** Native GET search with a progressively enhanced expanding glass input. */
export function hydrateSearch(doc: Document) {
  if (hydrated.has(doc)) return;
  hydrated.add(doc);
  doc.addEventListener("click", (event) => {
    const target = event.target as Element;
    const clear = target.closest<HTMLButtonElement>(".theme-search-clear");
    if (clear) {
      const input = clear
        .closest(".theme-search")
        ?.querySelector<HTMLInputElement>("input");
      if (input) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
      return;
    }
    const toggle = target.closest<HTMLButtonElement>(".theme-search-toggle");
    if (toggle) {
      const form = toggle.closest<HTMLFormElement>(".theme-search")!;
      form.setAttribute("data-search-open", "");
      toggle.setAttribute("aria-expanded", "true");
      form.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    doc
      .querySelectorAll<HTMLFormElement>(".theme-search[data-search-open]")
      .forEach((form) => {
        if (!form.contains(target) && form.dataset["searchMode"] !== "inline") {
          form.removeAttribute("data-search-open");
          form
            .querySelector(".theme-search-toggle")
            ?.setAttribute("aria-expanded", "false");
        }
      });
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const form = (event.target as Element).closest<HTMLFormElement>(
      ".theme-search",
    );
    if (!form || form.dataset["searchMode"] === "inline") return;
    form.removeAttribute("data-search-open");
    const toggle = form.querySelector<HTMLButtonElement>(
      ".theme-search-toggle",
    );
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.focus();
  });
}
