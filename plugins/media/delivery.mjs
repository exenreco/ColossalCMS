export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920];
export function responsiveSourceSet(media, previewToken = "") {
  const metadata = media?.metadata || {};
  if (
    !media?.updatedAt ||
    metadata.webpStatus === "skipped" ||
    media.type !== "image" ||
    !["image/png", "image/jpeg", "image/webp"].includes(media.mime) ||
    (metadata.webp?.pages || 1) !== 1
  )
    return "";
  const width = metadata.webp?.width || metadata.width;
  if (!width) return "";
  return IMAGE_WIDTHS.filter((size) => size <= width)
    .map((size) => {
      const query = new URLSearchParams({
        format: "webp",
        width: String(size),
        v: media.updatedAt,
      });
      if (previewToken) query.set("themePreview", previewToken);
      return `/api/media/${encodeURIComponent(media.id)}/file?${query} ${size}w`;
    })
    .join(", ");
}
export const responsiveKey = (key, width) => `${key}.w${width}.webp`;
