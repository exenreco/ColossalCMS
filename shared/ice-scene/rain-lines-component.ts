// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";
import { sceneTint } from "./scene-math";

/** Thin, translucent full-width bands, drawn over the world and pixel veil. */
export class RainLinesComponent implements SceneComponent {
  object: any;
  constructor(
    color: string,
    density: number,
    speed: number,
    width: number,
    opacity: number,
  ) {
    const tint = sceneTint(color);
    this.object = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tint: { value: new THREE.Color(tint.color) },
          opacity: { value: tint.alpha * opacity },
          density: { value: density },
          speed: { value: speed },
          lineWidth: { value: width },
          resolution: { value: new THREE.Vector2(1, 1) },
          time: { value: 0 },
        },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}`,
        fragmentShader: `uniform vec3 tint; uniform float opacity; uniform float density; uniform float speed; uniform float lineWidth; uniform vec2 resolution; uniform float time; varying vec2 vUv;
          float hash(float p){return fract(sin(p*127.1+311.7)*43758.5453);}
          void main(){
            if(density<=0.) discard;
            float rows=max(1.,round(resolution.y/900.*density));
            float cellHeight=resolution.y/rows;
            float fall=mod(vUv.y*resolution.y+time*speed*65.,resolution.y);
            float row=floor(fall/cellHeight);
            float seed=hash(row);
            float center=cellHeight*(.15+hash(row+13.)*.7);
            float distance=abs(mod(fall,cellHeight)-center);
            float line=1.-smoothstep(lineWidth*.5,lineWidth*.5+.55,distance);
            float alpha=line*opacity*(.55+seed*.45);
            if(alpha<.005) discard;
            gl_FragColor=vec4(tint,alpha);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.object.frustumCulled = false;
    this.object.renderOrder = 110;
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
