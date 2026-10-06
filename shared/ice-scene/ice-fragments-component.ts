// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";

export class IceFragmentsComponent implements SceneComponent {
  object = new THREE.Group();
  private fragments: any[] = [];
  constructor(count: number, tint: string) {
    const material = new THREE.MeshPhysicalMaterial({
      color: tint,
      metalness: 0.12,
      roughness: 0.18,
      transmission: 0.72,
      thickness: 0.5,
      ior: 1.31,
      clearcoat: 1,
      envMapIntensity: 1.4,
    });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.07 + (i % 4) * 0.025),
        material,
      );
      const angle = i * 2.39996;
      mesh.position.set(
        Math.cos(angle) * 2.9,
        Math.sin(angle) * 2.9,
        (i % 3) * 0.3,
      );
      mesh.rotation.set(i * 0.4, i * 0.7, i * 0.2);
      mesh.scale.set(0.6, 1.6, 0.7);
      mesh.userData.y = mesh.position.y;
      this.object.add(mesh);
      this.fragments.push(mesh);
    }
  }
  resize(throne: any) {
    this.object.position.copy(throne.position);
    this.object.scale.setScalar(throne.scale.y / 7);
  }
  update(frame: SceneFrame) {
    if (frame.reducedMotion) return;
    this.fragments.forEach((fragment, i) => {
      fragment.rotation.y += frame.delta * 0.07;
      fragment.position.y =
        fragment.userData.y + Math.sin(frame.time * 0.4 + i) * 0.12;
    });
  }
}
