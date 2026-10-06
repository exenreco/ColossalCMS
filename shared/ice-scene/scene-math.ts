export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

export function seededRandom(seed = 2027) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** A contained portrait, never a stretched texture or a cropped throne. */
export function throneFrame(
  aspect: number,
  imageAspect: number,
  distance: number,
) {
  const worldHeight = 2 * Math.tan((38 * Math.PI) / 360) * distance;
  const worldWidth = worldHeight * aspect;
  const narrow = aspect < 0.9;
  const height = Math.min(
    worldHeight * (narrow ? 0.58 : 0.8),
    (worldWidth * (narrow ? 0.92 : 0.58)) / imageAspect,
  );
  return {
    width: height * imageAspect,
    height,
    x: narrow ? 0 : worldWidth * 0.2,
    y: narrow ? worldHeight * 0.11 : -worldHeight * 0.035,
  };
}

export function scrollProgress(
  scrollY: number,
  viewportHeight: number,
  strength: number,
  reducedMotion = false,
) {
  return reducedMotion
    ? 0
    : clamp((scrollY / Math.max(1, viewportHeight)) * strength, 0, 1);
}
