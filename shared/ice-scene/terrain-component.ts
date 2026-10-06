// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";

/** Layered snow ridges recede toward the moon; normals and vertex colors give real depth. */
export class TerrainComponent implements SceneComponent {
  object = new THREE.Group();
  constructor(tint: string) {
    const low = new THREE.Color("#153044"),
      high = new THREE.Color(tint);
    for (let layer = 0; layer < 3; layer++) {
      const geometry = new THREE.PlaneGeometry(200, 110, 100, 64);
      geometry.rotateX(-Math.PI / 2);
      const points = geometry.attributes.position;
      const colors = new Float32Array(points.count * 3);
      for (let i = 0; i < points.count; i++) {
        const x = points.getX(i),
          z = points.getZ(i);
        const far = (55 - z) / 110;
        const ridges = Math.abs(
          Math.sin(x * 0.082 + layer * 1.8) +
            Math.cos(x * 0.17 - z * 0.025) * 0.56,
        );
        const detail = Math.sin(x * 0.35 + z * 0.22) * Math.cos(z * 0.3) * 0.35;
        const height =
          far * far * (ridges * (4 + layer * 2) + detail) +
          Math.sin(x * 0.04 + z * 0.06) * 0.5;
        points.setY(i, height);
        const color = low
          .clone()
          .lerp(high, 0.25 + Math.min(0.55, height / 16));
        colors.set([color.r, color.g, color.b], i * 3);
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          color: "#35556e",
          envMapIntensity: 0.12,
          roughness: 0.96,
          metalness: 0.04,
          side: THREE.DoubleSide,
        }),
      );
      mesh.position.set(0, -3.9 - layer * 0.7, -47 - layer * 64);
      this.object.add(mesh);
    }
  }
  update(_frame: SceneFrame) {}
}
