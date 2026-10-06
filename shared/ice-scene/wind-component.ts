// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";

/** Thin curved gusts are independent of snowfall and can be switched off. */
export class WindComponent implements SceneComponent {
  object = new THREE.Group();
  private material = new THREE.LineBasicMaterial({
    color: "#bce2f4",
    transparent: true,
    opacity: 0.025,
    depthWrite: false,
  });
  constructor(private strength: number) {
    for (let i = 0; i < 7; i++) {
      const points = [];
      for (let j = 0; j < 70; j++) {
        const x = -19 + j * 0.55;
        points.push(
          new THREE.Vector3(
            x,
            Math.sin(x * 0.14 + i) * 0.3 - 2.1 + (i % 3) * 0.8,
            -2 - i * 0.9,
          ),
        );
      }
      this.object.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          this.material,
        ),
      );
    }
  }
  velocity(time: number, progress: number) {
    return (
      this.strength * (0.35 + progress * 1.4 + Math.sin(time * 0.33) * 0.2)
    );
  }
  update(frame: SceneFrame) {
    this.material.opacity = 0.008 + frame.progress * 0.03 * this.strength;
    if (!frame.reducedMotion)
      this.object.position.x = Math.sin(frame.time * 0.18) * 3;
  }
}
