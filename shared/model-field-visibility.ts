/** Keep model/portrait controls consistent in every block Inspector. */
export function modelFieldVisible(
  type: string | undefined,
  settings: Record<string, any>,
  key: string,
) {
  if (type !== "core/gltf") return true;
  const portrait = settings["source"] === "portrait";
  if (key === "scenePreset") return portrait;
  if (
    [
      "fullViewport",
      "moonEnabled",
      "moonSize",
      "moonElevation",
      "moonTint",
      "terrainEnabled",
      "snowEnabled",
      "snowDensity",
      "windEnabled",
      "windStrength",
    ].includes(key)
  ) {
    if (!portrait || settings["scenePreset"] !== "ice-world") return false;
    if (["moonSize", "moonElevation", "moonTint"].includes(key))
      return settings["moonEnabled"] !== false;
    if (key === "snowDensity") return settings["snowEnabled"] !== false;
    if (key === "windStrength") return settings["windEnabled"] !== false;
    return true;
  }
  if (
    key === "height" &&
    portrait &&
    settings["scenePreset"] === "ice-world" &&
    settings["fullViewport"] === true
  )
    return false;
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
