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

/** Frame-rate independent response for scroll, camera dolly and pointer motion. */
export function easeTo(
  current: number,
  target: number,
  delta: number,
  response = 9,
) {
  return (
    current +
    (target - current) * (1 - Math.exp(-Math.max(0, delta) * response))
  );
}

/** Crop approximately half of the moon across the upper and left viewport edges. */
export function moonCornerFrame(
  aspect: number,
  distance: number,
  radius: number,
  elevation = 0,
) {
  const halfHeight = Math.tan((38 * Math.PI) / 360) * distance;
  return {
    x: -halfHeight * aspect + radius * 0.32,
    y: halfHeight - radius * 0.42 + elevation,
  };
}

/** Independent phases give each flake a falling-leaf sway, spin and edge-on flutter. */
export function flakeMotion(
  time: number,
  phase: number,
  frequency: number,
  wind: number,
  speed: number,
  flutter: number,
) {
  const wave = time * frequency + phase;
  return {
    x: wind * 0.65 + Math.sin(wave) * flutter * 0.8,
    y: -speed * (0.85 + Math.sin(wave * 0.7) * 0.18),
    angle: phase + (time * frequency * 0.65 + Math.sin(wave * 0.55)) * flutter,
    flip:
      1 -
      Math.min(1, flutter) +
      Math.cos(wave * 0.8) * 0.75 * Math.min(1, flutter),
  };
}
