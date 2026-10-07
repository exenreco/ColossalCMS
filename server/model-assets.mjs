// Keep existing Brilliant documents usable without installing the retired core theme.
export const BRILLIANT_MODEL_URL = "/brilliant/hero.glb";
export const BRILLIANT_POSTER_URL = "/brilliant/hero.svg";

export function modelSourceUrl(value) {
  if (value === BRILLIANT_MODEL_URL) return value;
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? value
      : "";
  } catch {
    return "";
  }
}
