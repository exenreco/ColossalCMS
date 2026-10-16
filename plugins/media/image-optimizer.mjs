let codecPromise;
const MAX_PIXELS = 40_000_000;
let active = 0;
function animatedPng(bytes) {
  if (bytes[0] !== 137) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = view.getUint32(offset);
    const tag = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (tag === "acTL") return true;
    if (tag === "IDAT" || tag === "IEND") break;
    offset += size + 12;
  }
  return false;
}
/** Node-only codec; the storage-independent Media API receives this as a capability. */
export const imageOptimizer = {
  async toWebp(bytes, mime, width) {
    if (
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime) ||
      animatedPng(bytes)
    )
      return null;
    // Keep first-use backfills from exhausting a serverless instance under load.
    // A busy converter defers this image and serves its original immediately.
    if (active >= 2) return undefined;
    active++;
    try {
      const sharp = await (codecPromise ||= import("sharp").then(
        (module) => module.default,
      ));
      const image = sharp(bytes, {
        animated: true,
        limitInputPixels: MAX_PIXELS,
        failOn: "warning",
      });
      const metadata = await image.metadata();
      if (
        (metadata.pages || 1) > 100 ||
        !metadata.width ||
        !metadata.height ||
        metadata.width * metadata.height > MAX_PIXELS
      )
        return null;
      const pipeline = (metadata.pages || 1) > 1 ? image : image.autoOrient();
      // Resizing animated media can alter frame geometry; retain its full variant.
      if (width && (metadata.pages || 1) > 1) return null;
      if (width) pipeline.resize({ width, withoutEnlargement: true });
      const output = await pipeline
        .timeout({ seconds: 10 })
        .webp({ quality: 85, alphaQuality: 100, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return {
        bytes: new Uint8Array(output.data),
        width: output.info.width,
        height: output.info.pageHeight || output.info.height,
        pages: output.info.pages || 1,
      };
    } finally {
      active--;
    }
  },
};
