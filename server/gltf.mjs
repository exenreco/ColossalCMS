import { inspectZip } from "./plugin-installer.mjs";
import { imageSize } from "image-size";
import { fail } from "./v2-utils.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
const allowedExtensions = new Set([
  "KHR_materials_unlit",
  "KHR_materials_clearcoat",
  "KHR_materials_transmission",
  "KHR_materials_ior",
  "KHR_materials_specular",
  "KHR_materials_sheen",
  "KHR_materials_emissive_strength",
  "KHR_texture_transform",
  "KHR_lights_punctual",
]);
const base64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};

/** Validate uploaded resources locally, then embed bundle resources in a single owned item. */
export function inspectModel(bytes, filename, limits = {}) {
  const max = limits.bytes || 100 * 1024 * 1024;
  if (bytes.length > max) fail("Model exceeds the 100 MB model budget.");
  let ext = filename.split(".").pop().toLowerCase(),
    files,
    entry = filename,
    binary;
  if (ext === "zip") {
    files = inspectZip(bytes, null, { maxEntry: max, maxTotal: max }).files;
    const entries = Object.keys(files).filter((p) => p.endsWith(".gltf"));
    if (entries.length !== 1)
      fail("A model bundle must contain exactly one .gltf entry point.");
    entry = entries[0];
    bytes = files[entry];
    ext = "gltf";
  }
  let model;
  try {
    if (ext === "glb") {
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      if (
        bytes.length < 20 ||
        view.getUint32(0, true) !== 0x46546c67 ||
        view.getUint32(4, true) !== 2 ||
        view.getUint32(8, true) !== bytes.length
      )
        fail("Invalid GLB header.");
      const size = view.getUint32(12, true);
      if (
        view.getUint32(16, true) !== 0x4e4f534a ||
        size % 4 ||
        20 + size > bytes.length
      )
        fail("Invalid GLB JSON chunk.");
      model = JSON.parse(decoder.decode(bytes.subarray(20, 20 + size)));
      if (20 + size < bytes.length) {
        const offset = 20 + size;
        if (
          offset + 8 > bytes.length ||
          view.getUint32(offset + 4, true) !== 0x004e4942 ||
          offset + 8 + view.getUint32(offset, true) !== bytes.length
        )
          fail("Invalid GLB binary chunk.");
        binary = bytes.subarray(offset + 8);
      }
    } else model = JSON.parse(decoder.decode(bytes));
  } catch (e) {
    fail(e.status ? e.message : "Invalid glTF JSON or binary data.");
  }
  if (model?.asset?.version !== "2.0") fail("Models must use glTF 2.0.");
  for (const key of [
    "buffers",
    "bufferViews",
    "accessors",
    "meshes",
    "materials",
    "nodes",
    "scenes",
    "images",
    "textures",
    "animations",
  ])
    if (model[key] !== undefined && !Array.isArray(model[key]))
      fail("Invalid glTF " + key + ".");
  let embeddedSize = 0;
  const resource = (uri, image = false) => {
    let data,
      mime = image ? "image/png" : "application/octet-stream";
    if (
      /^data:(application\/(octet-stream|gltf-buffer)|image\/(png|jpeg|webp));base64,[a-zA-Z0-9+/]*={0,2}$/.test(
        uri,
      )
    ) {
      const encoded = uri.slice(uri.indexOf(",") + 1);
      mime = uri.slice(5, uri.indexOf(";"));
      if (encoded.length > max * 1.4)
        fail("Embedded resource exceeds the model budget.");
      data = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    } else {
      if (
        !files ||
        typeof uri !== "string" ||
        /[:\\?#\x00-\x20]/.test(uri) ||
        uri.startsWith("/") ||
        uri.split("/").some((s) => !s || s === ".." || s === ".")
      )
        fail(
          "Model resources must be embedded or inside the uploaded bundle; remote references are forbidden.",
        );
      const path = entry.slice(0, entry.lastIndexOf("/") + 1) + uri;
      data = files[path];
      if (!data) fail("Missing model resource: " + uri);
      if (image)
        mime = /\.jpe?g$/i.test(uri)
          ? "image/jpeg"
          : /\.webp$/i.test(uri)
            ? "image/webp"
            : "image/png";
    }
    embeddedSize += data.length;
    if (embeddedSize > max)
      fail("Decoded model resources exceed the model budget.");
    if (image) {
      let size;
      try {
        size = imageSize(data);
      } catch {
        fail("Unsupported model texture.");
      }
      if (
        size.width > (limits.textureSize || 4096) ||
        size.height > (limits.textureSize || 4096)
      )
        fail("Model texture dimensions exceed 4096 pixels.");
    }
    return { data, uri: "data:" + mime + ";base64," + base64(data) };
  };
  const buffers = (model.buffers || []).map((b, i) => {
    if (
      !Number.isSafeInteger(b.byteLength) ||
      b.byteLength < 0 ||
      b.byteLength > max
    )
      fail("Invalid model buffer length.");
    let data;
    if (b.uri) {
      const r = resource(b.uri);
      b.uri = r.uri;
      data = r.data;
    } else if (i === 0 && binary) data = binary;
    else fail("Missing model buffer.");
    if (data.length < b.byteLength) fail("Truncated model buffer.");
    return data;
  });
  for (const v of model.bufferViews || [])
    if (
      !buffers[v.buffer] ||
      !Number.isSafeInteger(v.byteLength) ||
      v.byteLength < 0 ||
      !Number.isSafeInteger(v.byteOffset || 0) ||
      (v.byteOffset || 0) < 0 ||
      (v.byteOffset || 0) + v.byteLength > buffers[v.buffer].length
    )
      fail("Invalid model buffer view.");
  for (const a of model.accessors || [])
    if (
      !Number.isSafeInteger(a.count) ||
      a.count < 0 ||
      a.count > 6000000 ||
      !["SCALAR", "VEC2", "VEC3", "VEC4", "MAT2", "MAT3", "MAT4"].includes(
        a.type,
      ) ||
      ![5120, 5121, 5122, 5123, 5125, 5126].includes(a.componentType)
    )
      fail("Invalid model accessor.");
  for (const image of model.images || []) {
    if (image.uri) image.uri = resource(image.uri, true).uri;
    else {
      const v = model.bufferViews?.[image.bufferView];
      if (!v) fail("Missing image buffer view.");
      resource(
        "data:" +
          image.mimeType +
          ";base64," +
          base64(
            buffers[v.buffer].subarray(
              v.byteOffset || 0,
              (v.byteOffset || 0) + v.byteLength,
            ),
          ),
        true,
      );
    }
  }
  let triangles = 0;
  for (const mesh of model.meshes || []) {
    if (!Array.isArray(mesh.primitives)) fail("Invalid model mesh.");
    for (const primitive of mesh.primitives) {
      const a =
        model.accessors?.[primitive.indices ?? primitive.attributes?.POSITION];
      if (!a) fail("Missing mesh geometry accessor.");
      const mode = primitive.mode ?? 4;
      triangles +=
        mode === 4
          ? Math.floor(a.count / 3)
          : [5, 6].includes(mode)
            ? Math.max(0, a.count - 2)
            : 0;
    }
  }
  if (
    triangles > (limits.triangles || 1000000) ||
    (model.meshes?.length || 0) > (limits.meshes || 1000) ||
    (model.materials?.length || 0) > (limits.materials || 256)
  )
    fail("Model exceeds triangle, mesh, or material budget.");
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const mesh of model.meshes || [])
    for (const primitive of mesh.primitives || []) {
      const a = model.accessors?.[primitive.attributes?.POSITION];
      if (a?.type !== "VEC3" || !Array.isArray(a.min) || !Array.isArray(a.max))
        continue;
      for (let i = 0; i < 3; i++) {
        if (Number.isFinite(a.min[i]))
          bounds.min[i] = Math.min(bounds.min[i], a.min[i]);
        if (Number.isFinite(a.max[i]))
          bounds.max[i] = Math.max(bounds.max[i], a.max[i]);
      }
    }
  const boundingBox =
    bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite)
      ? bounds.max.map((v, i) => Math.max(0, v - bounds.min[i]))
      : null;
  const warnings = [];
  const scanUris = (value, depth = 0) => {
    if (!value || typeof value !== "object") return;
    if (depth > 64) fail("Model JSON exceeds the structure budget.");
    for (const [key, child] of Object.entries(value)) {
      if (
        key === "uri" &&
        (typeof child !== "string" || !child.startsWith("data:"))
      )
        fail("External model references are forbidden.");
      if (Array.isArray(child))
        child.forEach((item) => scanUris(item, depth + 1));
      else scanUris(child, depth + 1);
    }
  };
  scanUris(model);
  let visited = 0;
  const scrub = (value, depth = 0) => {
    if (!value || typeof value !== "object") return;
    if (++visited > 100000 || depth > 64)
      fail("Model JSON exceeds the structure budget.");
    if (value.extensions)
      for (const key of Object.keys(value.extensions))
        if (!allowedExtensions.has(key)) {
          delete value.extensions[key];
          warnings.push("Ignored unsupported extension: " + key);
        }
    for (const [key, child] of Object.entries(value)) {
      if (
        key === "uri" &&
        (typeof child !== "string" || !child.startsWith("data:"))
      )
        fail("External model references are forbidden.");
      if (key !== "extras") {
        if (Array.isArray(child))
          child.forEach((item) => scrub(item, depth + 1));
        else scrub(child, depth + 1);
      }
    }
    delete value.extras;
  };
  scrub(model);
  model.extensionsUsed = (model.extensionsUsed || []).filter((e) =>
    allowedExtensions.has(e),
  );
  model.extensionsRequired = (model.extensionsRequired || []).filter((e) =>
    allowedExtensions.has(e),
  );
  // Convert GLB's buffer to embedded JSON too, so stripped extensions never reach a client.
  if (binary && model.buffers?.[0] && !model.buffers[0].uri)
    model.buffers[0].uri =
      "data:application/octet-stream;base64," + base64(binary);
  const output = new TextEncoder().encode(JSON.stringify(model));
  return {
    type: "model",
    mime: "model/gltf+json",
    ext: "gltf",
    bytes: output,
    metadata: {
      size: output.length,
      meshCount: model.meshes?.length || 0,
      triangleCount: triangles,
      materialCount: model.materials?.length || 0,
      animationCount: model.animations?.length || 0,
      warnings: [...new Set(warnings)],
      boundingBox,
    },
  };
}
