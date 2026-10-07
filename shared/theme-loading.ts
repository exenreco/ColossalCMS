export interface ThemeLoading {
  background?: string;
  color?: string;
  accent?: string;
  animation?: "glare" | "pulse" | "none";
}

export const DEFAULT_THEME_LOADING: Required<ThemeLoading> = {
  background: "#f7f9f3",
  color: "#243e2f",
  accent: "#246b50",
  animation: "glare",
};

const hex = (value: unknown): value is string =>
  typeof value === "string" &&
  /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value);

/** A small presentation contract; the CMS retains ownership of readiness and errors. */
export function resolveThemeLoading(
  loading?: ThemeLoading,
  body: Record<string, unknown> = {},
): Required<ThemeLoading> {
  return {
    background: hex(loading?.background)
      ? loading.background
      : hex(body["background"])
        ? body["background"]
        : DEFAULT_THEME_LOADING.background,
    color: hex(loading?.color)
      ? loading.color
      : hex(body["color"])
        ? body["color"]
        : DEFAULT_THEME_LOADING.color,
    accent: hex(loading?.accent)
      ? loading.accent
      : DEFAULT_THEME_LOADING.accent,
    animation: ["glare", "pulse", "none"].includes(loading?.animation || "")
      ? loading!.animation!
      : DEFAULT_THEME_LOADING.animation,
  };
}

export function validThemeLoading(value: unknown): value is ThemeLoading {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  return Object.entries(config).every(([key, setting]) =>
    ["background", "color", "accent"].includes(key)
      ? hex(setting)
      : key === "animation" &&
        typeof setting === "string" &&
        ["glare", "pulse", "none"].includes(setting),
  );
}

export function themeLoadingCss(loading?: ThemeLoading) {
  const config = resolveThemeLoading(loading);
  return `.theme-root{--cl-loading-background:${config.background};--cl-loading-color:${config.color};--cl-loading-accent:${config.accent};--cl-skeleton-base:color-mix(in srgb,${config.color} 12%,${config.background});--cl-skeleton-glare:color-mix(in srgb,${config.color} 18%,transparent)}.theme-root .public-skeleton,.theme-root .public-load-error{color:var(--cl-loading-color);background:var(--cl-loading-background)}.theme-root .public-load-error .button{background:var(--cl-loading-accent);color:var(--cl-loading-background)}.theme-root .public-skeleton .cl-skel::after{animation:${config.animation === "none" ? "none" : `cl-skeleton-${config.animation} 1.6s ease-in-out infinite`}}@media(prefers-reduced-motion:reduce){.theme-root .public-skeleton .cl-skel::after{animation:none}}`;
}
