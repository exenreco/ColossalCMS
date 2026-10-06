// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { throneFrame } from "./scene-math";
import { SceneComponent, SceneFrame } from "./scene-component";

/** Foreground artwork preserves its aspect ratio at every viewport size. */
export class ThroneComponent implements SceneComponent {
  object: any;
  private origin = { x: 0, y: 0 };
  constructor(private texture: any) {
    this.object = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    this.object.position.z = 1;
    this.object.renderOrder = 2;
  }
  resize(aspect: number, distance: number) {
    const frame = throneFrame(
      aspect,
      this.texture.image.width / this.texture.image.height,
      distance - 1,
    );
    this.object.scale.set(frame.width, frame.height, 1);
    this.origin = { x: frame.x, y: frame.y };
    this.object.position.set(frame.x, frame.y, 1);
  }
  update(frame: SceneFrame) {
    this.object.position.y = this.origin.y - frame.progress * 0.13;
    this.object.rotation.y = frame.reducedMotion ? 0 : frame.progress * 0.035;
  }
}
