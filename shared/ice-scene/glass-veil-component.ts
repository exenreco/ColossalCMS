// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";

/** A screen-space charcoal veil with a restrained animated pixel weave over the world. */
export class GlassVeilComponent implements SceneComponent {
  object: any;
  constructor(opacity: number, pixels: boolean, pixelSize: number) {
    this.object = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          opacity: { value: opacity },
          pixels: { value: pixels },
          pixelSize: { value: pixelSize },
          resolution: { value: new THREE.Vector2(1, 1) },
          time: { value: 0 },
        },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: `uniform float opacity; uniform bool pixels; uniform float pixelSize; uniform vec2 resolution; uniform float time; varying vec2 vUv; float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} void main(){vec2 cell=floor(vUv*resolution/pixelSize); float grain=hash(cell); float weave=step(.82,fract((cell.x+cell.y)*.17+time*.12)); float shimmer=.5+.5*sin(time*2.4+cell.x*.17+cell.y*.11); float pattern=pixels ? (grain-.5)*.055+weave*shimmer*.035 : 0.; float edge=pow(abs(vUv.x-.5)*2.,1.5); float alpha=clamp(opacity*(1.+edge*.16+pattern*2.),0.,.92); vec3 silver=vec3(.035,.04,.052)+vec3(pixels ? weave*shimmer*.012 : 0.); gl_FragColor=vec4(silver,alpha);}`,
      }),
    );
    this.object.frustumCulled = false;
    this.object.renderOrder = 100;
  }
  resize(width: number, height: number) {
    this.object.material.uniforms.resolution.value.set(width, height);
  }
  update(frame: SceneFrame) {
    this.object.material.uniforms.time.value = frame.reducedMotion
      ? 0
      : frame.time;
  }
}
