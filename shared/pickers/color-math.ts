export function normalizeHex(value: string): string {
  const short = /^#([\da-f]{3})$/i.exec(value || "");
  if (short) return "#" + [...short[1]].map((digit) => digit + digit).join("");
  return /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value || "")
    ? value.slice(0, 7)
    : "#000000";
}

export function hexToHsv(value: string) {
  const hex = normalizeHex(value);
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let hue = 0;
  if (delta)
    hue =
      ((max === r
        ? (g - b) / delta
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4) *
        60 +
        360) %
      360;
  return { hue, saturation: max ? delta / max : 0, brightness: max };
}

export function hsvToHex(
  hue: number,
  saturation: number,
  brightness: number,
): string {
  const h = (((hue % 360) + 360) % 360) / 60;
  const s = Math.max(0, Math.min(1, saturation));
  const v = Math.max(0, Math.min(1, brightness));
  const chroma = v * s,
    secondary = chroma * (1 - Math.abs((h % 2) - 1)),
    base = v - chroma;
  const rgb =
    h < 1
      ? [chroma, secondary, 0]
      : h < 2
        ? [secondary, chroma, 0]
        : h < 3
          ? [0, chroma, secondary]
          : h < 4
            ? [0, secondary, chroma]
            : h < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round((n + base) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
