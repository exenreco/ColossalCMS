// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";
import { sceneTint } from "./scene-math";

/** A screen-space charcoal veil with a restrained animated pixel weave over the world. */
export class GlassVeilComponent implements SceneComponent {
  object: any;
  constructor(
    opacity: number,
    pixels: boolean,
    pixelSize: number,
    color = "#17191bc9",
  ) {
    const tint = sceneTint(color);
    this.object = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          opacity: { value: opacity },
          tint: { value: new THREE.Color(tint.color) },
          tintAlpha: { value: tint.alpha },
          pixels: { value: pixels },
          pixelSize: { value: pixelSize },
          resolution: { value: new THREE.Vector2(1, 1) },
          time: { value: 0 },
        },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: `uniform float opacity; uniform vec3 tint; uniform float tintAlpha; uniform bool pixels; uniform float pixelSize; uniform vec2 resolution; uniform float time; varying vec2 vUv; float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} void main(){vec2 cell=floor(vUv*resolution/pixelSize); float grain=hash(cell); float weave=step(.82,fract((cell.x+cell.y)*.17+time*.12)); float shimmer=.5+.5*sin(time*2.4+cell.x*.17+cell.y*.11); float pattern=pixels ? (grain-.5)*.055+weave*shimmer*.035 : 0.; float alpha=clamp(opacity*tintAlpha,0.,1.); vec3 silver=max(vec3(0.),tint+vec3(pattern*.045)); gl_FragColor=vec4(silver,alpha);
          #include <colorspace_fragment>
        }`,
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
