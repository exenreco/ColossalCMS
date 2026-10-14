// @ts-ignore Node native TypeScript imports require the extension.
import { renderIcon, validIcon } from "./icon-catalog.ts";

export interface MenuItem {
  id: string;
  label: string;
  pageId?: string;
  href?: string;
  children?: MenuItem[];
}
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function safeNavigationHref(value: unknown): string {
  const href = String(value ?? "").trim();
  return href.length <= 2048 &&
    !/[\s\\\u0000-\u001f]/.test(href) &&
    (/^\/(?!\/)/.test(href) ||
      /^#[\w-]*$/.test(href) ||
      /^(https?:\/\/|mailto:|tel:)/i.test(href))
    ? href
    : "";
}
export function navigationSettingsError(
  type: string,
  settings: Record<string, any>,
): string {
  if (["core/button", "core/menu-item", "core/custom-link"].includes(type)) {
    if (
      type === "core/custom-link" &&
      settings.label !== undefined &&
      (typeof settings.label !== "string" || settings.label.length > 160)
    )
      return "Custom Links need a text label of at most 160 characters.";
    if (
      type === "core/menu-item" &&
      ((settings.label !== undefined &&
        (typeof settings.label !== "string" || settings.label.length > 160)) ||
        (settings.pageId !== undefined && typeof settings.pageId !== "string"))
    )
      return "Menu Items need a text label and a valid page ID.";
    if (settings.href && !safeNavigationHref(settings.href))
      return type === "core/custom-link"
        ? "Choose a safe custom link."
        : type === "core/menu-item"
          ? "Choose a safe menu item link."
          : "Choose a safe button link.";
    if (settings.iconName && !validIcon(settings.iconName))
      return "Choose an icon from the bundled library.";
  }
  if (type !== "core/menu") return "";
  if (settings.mobileIcon && !validIcon(settings.mobileIcon))
    return "Choose an icon from the bundled library.";
  if (settings.items === undefined) return "";
  let count = 0;
  const ids = new Set<string>();
  const check = (items: any, depth: number): boolean =>
    Array.isArray(items) &&
    depth <= 4 &&
    items.every((item: any) => {
      if (
        ++count > 100 ||
        !item ||
        typeof item.id !== "string" ||
        !item.id ||
        ids.has(item.id) ||
        typeof item.label !== "string" ||
        item.label.length > 160 ||
        (item.href && !safeNavigationHref(item.href)) ||
        (item.pageId !== undefined && typeof item.pageId !== "string")
      )
        return false;
      ids.add(item.id);
      return item.children === undefined || check(item.children, depth + 1);
    });
  return check(settings.items, 0)
    ? ""
    : "Menu items need unique IDs, safe links, and at most five levels and 100 items.";
}
export function renderButton(settings: Record<string, any>): string {
  const icon =
    settings.iconName && settings.iconPosition !== "none"
      ? renderIcon({
          iconName: settings.iconName,
          iconSize: settings.iconSize || 20,
        })
      : "";
  const text = `<span>${escape(settings.text ?? "Button")}</span>`;
  return `<a class="theme-button" aria-label="${escape(settings.ariaLabel || settings.text || "Button")}" href="${escape(safeNavigationHref(settings.href) || "#")}" target="${settings.newTab ? "_blank" : "_self"}" rel="noopener noreferrer">${settings.iconPosition === "after" ? text + icon : icon + text}</a>`;
}
export function renderMenuItem(
  settings: Record<string, any>,
  context: any,
  children = "",
  appearance = "",
): string {
  const page =
    settings.pageId &&
    (context.allContent || []).find(
      (p: any) =>
        p.id === settings.pageId &&
        (p.status === undefined || p.status === "published"),
    );
  if (settings.pageId && !page) return "";
  const href = page
    ? page.id === context.settings?.homePageId
      ? "/"
      : "/" + page.slug
    : safeNavigationHref(settings.href);
  const label = escape(settings.label || page?.title || "Menu item");
  const link = href
    ? `<a class="theme-menu-link"${appearance} href="${escape(href)}" target="${settings.newTab ? "_blank" : "_self"}" rel="noopener noreferrer">${label}</a>`
    : `<span class="theme-menu-link"${appearance}>${label}</span>`;
  return children
    ? `<details class="theme-menu-dropdown"><summary>${link}<span aria-hidden="true">⌄</span></summary><div class="theme-menu-submenu">${children}</div></details>`
    : link;
}
export function renderMenu(
  settings: Record<string, any>,
  context: any,
  fallback: string,
  childMarkup = "",
): string {
  const pages = context.allContent || [];
  const renderItems = (items: MenuItem[], depth = 0): string =>
    depth > 4
      ? ""
      : items
          .map((item) => {
            const page =
              item.pageId &&
              pages.find(
                (p: any) =>
                  p.id === item.pageId &&
                  (p.status === undefined || p.status === "published"),
              );
            if (item.pageId && !page) return "";
            const href = page
              ? page.id === context.settings?.homePageId
                ? "/"
                : "/" + page.slug
              : safeNavigationHref(item.href);
            const label = escape(item.label || page?.title || "Menu item");
            const link = href
              ? `<a href="${escape(href)}">${label}</a>`
              : `<span>${label}</span>`;
            const nested = renderItems(item.children || [], depth + 1);
            return nested
              ? `<details class="theme-menu-dropdown"><summary>${link}<span aria-hidden="true">⌄</span></summary><div class="theme-menu-submenu">${nested}</div></details>`
              : link;
          })
          .join("");
  const breakpoint = ["640", "768", "1024"].includes(
    String(settings.mobileBreakpoint),
  )
    ? settings.mobileBreakpoint
    : "768";
  const direction = settings.orientation === "vertical" ? "column" : "row";
  const mobileAlign =
    settings.mobileAlign === "center"
      ? "center"
      : settings.mobileAlign === "right"
        ? "flex-end"
        : "flex-start";
  const mobileDirection =
    settings.mobileOrientation === "horizontal" ? "row" : "column";
  const align =
    settings.align === "center"
      ? "center"
      : settings.align === "right"
        ? "flex-end"
        : "flex-start";
  return `<nav class="theme-menu theme-menu-breakpoint-${breakpoint}${settings.mobileMode === "expanded" ? " theme-menu-expanded" : ""}" aria-label="${escape(settings.menuLabel || "Site navigation")}" style="--menu-direction:${direction};--menu-mobile-direction:${mobileDirection};--menu-align:${align};--menu-mobile-align:${mobileAlign}"><button class="theme-menu-toggle" type="button" aria-expanded="false" aria-label="Toggle navigation">${renderIcon({ iconName: settings.mobileIcon || "bars", iconSize: 24 })}<span>${escape(settings.mobileLabel ?? "Menu")}</span></button><div class="theme-menu-items">${Array.isArray(settings.items) ? renderItems(settings.items) : settings.automaticPages === false ? "" : fallback}${childMarkup}</div></nav>`;
}
export const MENU_CSS = `.theme-button{display:inline-flex;align-items:center;justify-content:center;gap:.55em;padding:.7em 1.1em;border:1px solid currentColor;border-radius:.5em;text-decoration:none;max-width:100%;font:inherit;color:inherit}.theme-button .theme-icon{flex-shrink:0}.theme-menu{position:relative;display:flex;justify-content:var(--menu-align,flex-start)}.theme-menu-items{display:flex;align-items:center;flex-wrap:wrap;gap:1.5rem;flex-direction:var(--menu-direction,row)}.theme-menu-toggle{display:none;align-items:center;gap:.5rem;color:inherit;background:transparent;border:1px solid currentColor;border-radius:.4rem;padding:.5rem;cursor:pointer;font:inherit}.theme-menu-dropdown{position:relative}.theme-menu-dropdown>summary{display:flex;align-items:center;gap:.5em;cursor:pointer;list-style:none}.theme-menu-dropdown>summary::-webkit-details-marker{display:none}.theme-menu-submenu{position:absolute;top:100%;left:0;z-index:30;min-width:12rem;padding:1rem;display:flex;flex-direction:column;gap:1rem;background:var(--theme-menu-background,#17191bf2);color:var(--theme-menu-color,#fff);border:1px solid #ffffff30;border-radius:.5rem;box-shadow:0 8px 24px #0003}.theme-menu-submenu .theme-menu-submenu{left:100%;top:0}.theme-menu a:focus-visible,.theme-menu button:focus-visible,.theme-menu summary:focus-visible{outline:2px solid currentColor;outline-offset:4px}${[640, 768, 1024].map((n) => `@media(max-width:${n}px){.theme-menu-breakpoint-${n}{flex-direction:column;align-items:var(--menu-mobile-align,flex-start)}.theme-menu-breakpoint-${n} .theme-menu-toggle{display:inline-flex}.theme-menu-breakpoint-${n} .theme-menu-items{display:none;flex-direction:var(--menu-mobile-direction,column);align-items:stretch;width:100%;padding-top:1rem}.theme-menu-breakpoint-${n}[data-menu-open]>.theme-menu-items,.theme-menu-breakpoint-${n}.theme-menu-expanded>.theme-menu-items{display:flex}.theme-menu-breakpoint-${n}.theme-menu-expanded>.theme-menu-toggle{display:none}.theme-menu-breakpoint-${n} .theme-menu-submenu{position:static;margin-top:.5rem;min-width:0}}`).join("")}`;
