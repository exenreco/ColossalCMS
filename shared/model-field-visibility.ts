/** Keep model/portrait controls consistent in every block Inspector. */
export function modelFieldVisible(
  type: string | undefined,
  settings: Record<string, any>,
  key: string,
) {
  if (type !== "core/gltf") return true;
  const portrait = settings["source"] === "portrait";
  if (
    [
      "portraitImage",
      "portraitUrl",
      "fragmentCount",
      "pointerInteractive",
      "motionStrength",
      "iceTint",
      "lightIntensity",
    ].includes(key)
  )
    return portrait;
  if (
    [
      "mediaId",
      "url",
      "controls",
      "autoRotate",
      "autoRotateSpeed",
      "poster",
    ].includes(key)
  )
    return !portrait;
  return true;
}
