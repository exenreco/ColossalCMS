/** Responsive img natural dimensions are density-corrected, unlike its GPU pixels.
 * Rasterizing the decoded image gives WebGL an unambiguous pixel buffer without
 * downloading the artwork again or depending on the visible image's CSS size.
 */
export function decodedPortraitCanvas(image: HTMLImageElement) {
  const canvas = image.ownerDocument.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
