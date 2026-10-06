// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { SceneComponent, SceneFrame } from "./scene-component";
import { sceneTint } from "./scene-math";

/** Fine screen-space rain streaks, drawn over the world and pixel veil. */
export class RainLinesComponent implements SceneComponent {
  object: any;
  constructor(color: string, density: number, speed: number, width: number) {
    const tint = sceneTint(color);
    this.object = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          tint: { value: new THREE.Color(tint.color) },
          opacity: { value: tint.alpha },
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
            vec2 p=vUv*resolution;
            float columns=max(1.,resolution.x/1440.*density);
            float cellWidth=resolution.x/columns;
            float slant=p.x+p.y*.12;
            float column=floor(slant/cellWidth);
            float seed=hash(column);
            float center=cellWidth*(.15+hash(column+13.)*.7);
            float distance=abs(mod(slant,cellWidth)-center);
            float line=1.-smoothstep(lineWidth*.5,lineWidth*.5+.55,distance);
            float cycle=resolution.y*1.2+200.;
            float fall=mod(p.y+time*speed*(170.+seed*170.)+hash(column+29.)*cycle,cycle);
            float length=18.+hash(column+43.)*85.;
            float tail=1.-smoothstep(0.,length,fall);
            float alpha=line*tail*opacity*(.35+seed*.6);
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
