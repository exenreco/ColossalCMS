const mounted = new WeakSet<HTMLElement>();
/** Build section navigation from rendered content, including live editor heading changes. */
export function hydrateTableOfContents(doc: Document) {
  doc.querySelectorAll<HTMLElement>(".theme-toc").forEach((host) => {
    if (mounted.has(host)) return;
    const win = doc.defaultView,
      links = host.querySelector<HTMLElement>(".theme-toc-links");
    if (!win || !links) return;
    mounted.add(host);
    const editor = !!win.frameElement?.closest(".shared-editor");
    const wrapper = host.closest<HTMLElement>(".theme-block");
    const originalDisplay = wrapper?.style.display || "";
    const pagePath = /^https?:$/.test(win.location.protocol)
      ? win.location.pathname + win.location.search
      : "";
    let headings: HTMLElement[] = [],
      signature = "",
      frame = 0,
      disposed = false;
    const number = (key: string, fallback: number) => {
      const raw = host.dataset[key];
      const value = raw === undefined || raw === "" ? fallback : Number(raw);
      return Number.isFinite(value) ? value : fallback;
    };
    const min = Math.max(1, Math.min(6, number("tocMin", 2)));
    const max = Math.max(min, Math.min(6, number("tocMax", 3)));
    const offset = Math.max(0, Math.min(300, number("tocOffset", 120)));
    const updateCurrent = () => {
      frame = 0;
      if (disposed || doc.hidden || host.dataset["tocHighlight"] === "false")
        return;
      let current = headings[0];
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= offset + 8)
          current = heading;
      }
      links.querySelectorAll<HTMLAnchorElement>("a").forEach((a) => {
        const active = a.hash === "#" + encodeURIComponent(current?.id || "");
        if (active) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
    };
    const schedule = () => {
      if (!frame && !disposed) frame = win.requestAnimationFrame(updateCurrent);
    };
    const rebuild = () => {
      if (!host.isConnected) {
        dispose();
        return;
      }
      // Exclude the template title, shared sidebar headings, and post-list card headings.
      headings = Array.from(
        doc.querySelectorAll<HTMLElement>(
          ".content-main :is(h1,h2,h3,h4,h5,h6)",
        ),
      )
        .filter(
          (h) =>
            !h.closest(".theme-toc,.theme-project-details,.theme-post-grid") &&
            Number(h.tagName.slice(1)) >= min &&
            Number(h.tagName.slice(1)) <= max &&
            h.textContent?.trim(),
        )
        .slice(0, 80);
      for (const h of headings) {
        if (!h.id) {
          const base =
            "section-" +
            (h.textContent || "section")
              .toLowerCase()
              .normalize("NFKD")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 64);
          let id = base,
            suffix = 2;
          while (doc.getElementById(id)) id = base + "-" + suffix++;
          h.id = id;
        }
      }
      const next = headings
        .map((h) => h.id + ":" + h.tagName + ":" + h.textContent)
        .join("|");
      if (next === signature && host.hasAttribute("data-toc-mounted")) return;
      signature = next;
      const list = doc.createElement(
        host.dataset["tocNumbered"] === "true" ? "ol" : "ul",
      );
      for (const h of headings) {
        const item = doc.createElement("li"),
          a = doc.createElement("a");
        if (Number(h.tagName.slice(1)) > min) item.className = "toc-nested";
        a.textContent = (h.textContent || "").trim();
        a.setAttribute("href", pagePath + "#" + encodeURIComponent(h.id));
        item.append(a);
        list.append(item);
      }
      links.replaceChildren(list);
      host.setAttribute("data-toc-mounted", "");
      if (wrapper)
        wrapper.style.display =
          !headings.length && !editor ? "none" : originalDisplay;
      // Keep a useful placeholder in the content-only editor, where shared parts are absent.
      if (!headings.length && editor) {
        const empty = doc.createElement("p");
        empty.className = "theme-toc-empty";
        empty.textContent =
          "Add content headings to build your section navigation.";
        links.replaceChildren(empty);
      }
      updateCurrent();
    };
    const navigate = (event: MouseEvent) => {
      const a = (event.target as Element).closest<HTMLAnchorElement>("a");
      if (!a || !links.contains(a)) return;
      const heading = headings.find(
        (h) => "#" + encodeURIComponent(h.id) === a.hash,
      );
      if (!heading) return;
      event.preventDefault();
      const top = heading.getBoundingClientRect().top + win.scrollY - offset;
      win.scrollTo({
        top: Math.max(0, top),
        behavior: win.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    };
    const observer = new MutationObserver(rebuild);
    function dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      win!.cancelAnimationFrame(frame);
      win!.removeEventListener("scroll", schedule);
      win!.removeEventListener("resize", schedule);
      win!.removeEventListener("pagehide", dispose);
      host.removeEventListener("click", navigate);
    }
    host.addEventListener("click", navigate);
    win.addEventListener("scroll", schedule, { passive: true });
    win.addEventListener("resize", schedule, { passive: true });
    win.addEventListener("pagehide", dispose, { once: true });
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    rebuild();
  });
}
