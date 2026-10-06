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
      "moonPlacement",
      "moonSize",
      "moonElevation",
      "moonTint",
      "terrainEnabled",
      "snowEnabled",
      "snowDensity",
      "snowSize",
      "snowSpeed",
      "snowFlutter",
      "windEnabled",
      "windStrength",
      "sceneSpeed",
      "backgroundZoom",
      "sceneVeilEnabled",
      "sceneVeilOpacity",
      "scenePixelsEnabled",
      "scenePixelSize",
    ].includes(key)
  ) {
    if (!portrait || settings["scenePreset"] !== "ice-world") return false;
    if (
      ["moonPlacement", "moonSize", "moonElevation", "moonTint"].includes(key)
    )
      return settings["moonEnabled"] !== false;
    if (["snowDensity", "snowSize", "snowSpeed", "snowFlutter"].includes(key))
      return settings["snowEnabled"] !== false;
    if (
      ["sceneVeilOpacity", "scenePixelsEnabled", "scenePixelSize"].includes(key)
    ) {
      if (settings["sceneVeilEnabled"] === false) return false;
      if (key === "scenePixelSize")
        return settings["scenePixelsEnabled"] !== false;
    }
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
