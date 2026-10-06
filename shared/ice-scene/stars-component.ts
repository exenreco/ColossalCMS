// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { seededRandom } from "./scene-math";
import { SceneComponent, SceneFrame } from "./scene-component";

export class StarsComponent implements SceneComponent {
  object: any;
  constructor() {
    const random = seededRandom(408),
      positions = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++)
      positions.set(
        [(random() - 0.5) * 130, random() * 35 - 2, -35 - random() * 55],
        i * 3,
      );
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.object = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: "#bbd8ed",
        size: 0.07,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
  }
  update(frame: SceneFrame) {
    this.object.material.opacity = 0.55 - frame.progress * 0.22;
  }
}
