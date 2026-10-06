// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { seededRandom } from "./scene-math";
import { SceneComponent, SceneFrame } from "./scene-component";

/** Soft flakes at different depths, advected by the separate wind component. */
export class SnowComponent implements SceneComponent {
  object: any;
  private positions: Float32Array;
  private speeds: Float32Array;
  private material: any;
  constructor(count: number) {
    const random = seededRandom(823);
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.positions.set(
        [(random() - 0.5) * 32, (random() - 0.5) * 18, random() * 17 - 9],
        i * 3,
      );
      this.speeds[i] = 0.45 + random() * 1.1;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { opacity: { value: 0.4 } },
      vertexShader: `void main(){vec4 p=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(19./max(1.,-p.z),1.1,5.); gl_Position=projectionMatrix*p;}`,
      fragmentShader: `uniform float opacity; void main(){float d=length(gl_PointCoord-.5); float a=1.-smoothstep(.08,.5,d); gl_FragColor=vec4(.88,.96,1.,a*opacity);}`,
    });
    this.object = new THREE.Points(geometry, this.material);
    this.object.frustumCulled = false;
  }
  update(frame: SceneFrame) {
    this.material.uniforms.opacity.value = 0.28 + frame.progress * 0.38;
    if (frame.reducedMotion) return;
    for (let i = 0; i < this.speeds.length; i++) {
      const n = i * 3;
      this.positions[n] += frame.wind * frame.delta * (0.5 + this.speeds[i]);
      this.positions[n + 1] -=
        this.speeds[i] * frame.delta * (0.7 + frame.progress);
      if (this.positions[n + 1] < -9) this.positions[n + 1] = 9;
      if (this.positions[n] > 16) this.positions[n] = -16;
      if (this.positions[n] < -16) this.positions[n] = 16;
    }
    this.object.geometry.attributes.position.needsUpdate = true;
  }
}
