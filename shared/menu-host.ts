import { hydrateSearch } from "./search-host";
import { hydrateParticleText } from "./particle-text-host";
import { hydrateTableOfContents } from "./table-of-contents-host";
import { hydrateTrivia } from "../plugins/trivia/client";
import { hydrateMessaging } from "../plugins/messaging/client";
const hydrated = new WeakSet<Document>();
const editorSelections = new WeakMap<Document, Element | null>();
/** Reveal the selected menu branch without overriding subsequent manual toggles. */
export function revealEditorMenu(doc: Document, selected: Element | null) {
  if (editorSelections.get(doc) === selected) return;
  editorSelections.set(doc, selected);
  const menu =
    selected?.closest<HTMLElement>(".theme-menu") ||
    selected?.querySelector<HTMLElement>(":scope > .theme-menu");
  if (!menu || !selected) return;
  menu.setAttribute("data-menu-open", "");
  menu
    .querySelector(".theme-menu-toggle")
    ?.setAttribute("aria-expanded", "true");
  if (selected.contains(menu)) {
    menu
      .querySelectorAll<HTMLDetailsElement>(".theme-menu-dropdown")
      .forEach((dropdown) => {
        dropdown.open = true;
      });
  } else {
    selected
      .querySelector<HTMLDetailsElement>(":scope > .theme-menu-dropdown")
      ?.setAttribute("open", "");
    for (
      let parent = selected.parentElement;
      parent && parent !== menu;
      parent = parent.parentElement
    ) {
      if (parent.matches(".theme-menu-dropdown"))
        parent.setAttribute("open", "");
    }
  }
}
/** Host-side listeners also work inside the editor's script-free canvas. */
export function hydrateMenus(doc: Document) {
  hydrateSearch(doc);
  hydrateParticleText(doc);
  hydrateTableOfContents(doc);
  hydrateTrivia(doc);
  hydrateMessaging(doc);
  if (hydrated.has(doc)) return;
  hydrated.add(doc);
  doc.addEventListener("click", (event) => {
    const target = event.target as Element;
    const toggle = target.closest<HTMLButtonElement>(".theme-menu-toggle");
    if (toggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const menu = toggle.closest(".theme-menu")!;
      const open = !menu.hasAttribute("data-menu-open");
      menu.toggleAttribute("data-menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      return;
    }
    const summary = target.closest<HTMLElement>(
      ".theme-menu-dropdown > summary",
    );
    if (summary && !target.closest("a")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const details = summary.parentElement as HTMLDetailsElement;
      details.open = !details.open;
    }
  });
  doc.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) {
      const control = (event.target as Element).closest<HTMLElement>(
        ".theme-menu-toggle,.theme-menu-dropdown > summary",
      );
      if (control && !(event.target as Element).closest("a")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        control.click();
        return;
      }
    }
    if (event.key !== "Escape") return;
    const menu = (event.target as Element).closest(".theme-menu");
    if (!menu) return;
    menu.removeAttribute("data-menu-open");
    menu
      .querySelectorAll("details[open]")
      .forEach((item) => item.removeAttribute("open"));
    const toggle = menu.querySelector<HTMLButtonElement>(".theme-menu-toggle");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.focus();
  });
}
