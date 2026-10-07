/** Rebuild the compatibility asset used by already-installed Brilliant themes. */
import { mkdir, writeFile } from "node:fs/promises";
import {
  Scene,
  Mesh,
  MeshPhysicalMaterial,
  TorusGeometry,
  IcosahedronGeometry,
  SphereGeometry,
} from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

// GLTFExporter reads its output Blob through the browser FileReader interface.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
const scene = new Scene();
scene.name = "Brilliant orbital sculpture";
const pearl = new MeshPhysicalMaterial({
  color: "#9b8cff",
  metalness: 0.55,
  roughness: 0.18,
  clearcoat: 1,
  clearcoatRoughness: 0.1,
  iridescence: 0.9,
  iridescenceIOR: 1.35,
});
const silver = new MeshPhysicalMaterial({
  color: "#c8f5ff",
  metalness: 0.75,
  roughness: 0.2,
  clearcoat: 1,
});
const gem = new Mesh(new IcosahedronGeometry(0.73, 2), pearl);
gem.name = "Faceted iridescent core";
scene.add(gem);
for (const [index, rotation] of [
  [0, [0.55, 0.3, 0.2]],
  [1, [1.8, 0.5, -0.45]],
  [2, [0.35, 1.25, 0.75]],
]) {
  const ring = new Mesh(
    new TorusGeometry(1.38 + index * 0.2, 0.065, 20, 144),
    index === 1 ? silver : pearl,
  );
  ring.name = "Orbital ring " + (index + 1);
  ring.rotation.set(...rotation);
  scene.add(ring);
  const satellite = new Mesh(new SphereGeometry(0.13, 24, 16), silver);
  satellite.name = "Orbital satellite " + (index + 1);
  satellite.position.set(1.38 + index * 0.2, 0, 0);
  ring.add(satellite);
}
const result = await new GLTFExporter().parseAsync(scene, {
  binary: true,
  copyright: "Colossal CMS contributors. MIT License.",
});
await mkdir("public/brilliant", { recursive: true });
await writeFile("public/brilliant/hero.glb", Buffer.from(result));
console.log(
  "Built public/brilliant/hero.glb (" + result.byteLength + " bytes).",
);
