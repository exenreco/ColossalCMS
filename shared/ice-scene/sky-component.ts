// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";

export class SkyComponent implements SceneComponent {
  object: any;
  constructor() {
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { progress: { value: 0 } },
      vertexShader: `varying float height; void main(){height=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float progress; varying float height; void main(){vec3 night=vec3(.018,.035,.075); vec3 horizon=mix(vec3(.10,.22,.32),vec3(.16,.32,.43),progress); float t=smoothstep(-.08,.33,height); gl_FragColor=vec4(mix(horizon,night,t),1.);}`,
    });
    this.object = new THREE.Mesh(
      new THREE.SphereGeometry(190, 40, 24),
      material,
    );
    this.object.renderOrder = -10;
  }
  update(frame: SceneFrame) {
    this.object.material.uniforms.progress.value = frame.progress;
  }
}
