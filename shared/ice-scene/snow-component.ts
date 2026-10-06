// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { seededRandom, flakeMotion } from "./scene-math";
import { SceneComponent, SceneFrame } from "./scene-component";

/** Image-backed six-branch flakes tumble, sway and flutter with individual seeded phases. */
export class SnowComponent implements SceneComponent {
  object: any;
  private positions: Float32Array;
  private phases: Float32Array;
  private frequencies: Float32Array;
  private speeds: Float32Array;
  private angles: Float32Array;
  private flips: Float32Array;
  private material: any;
  constructor(
    count: number,
    texture: any,
    size = 1,
    private speed = 1.4,
    private flutter = 1.3,
  ) {
    const random = seededRandom(823);
    this.positions = new Float32Array(count * 3);
    this.phases = new Float32Array(count);
    this.frequencies = new Float32Array(count);
    this.speeds = new Float32Array(count);
    this.angles = new Float32Array(count);
    this.flips = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.positions.set(
        [(random() - 0.5) * 32, (random() - 0.5) * 18, random() * 17 - 9],
        i * 3,
      );
      this.phases[i] = random() * Math.PI * 2;
      this.frequencies[i] = 0.45 + random() * 1.25;
      this.speeds[i] = 0.5 + random() * 1.2;
      sizes[i] = (0.1 + Math.pow(random(), 2) * 0.38) * size;
      const pose = flakeMotion(
        0,
        this.phases[i],
        this.frequencies[i],
        0,
        0,
        flutter,
      );
      this.angles[i] = pose.angle;
      this.flips[i] = pose.flip;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute("flakeSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute(
      "flakeAngle",
      new THREE.BufferAttribute(this.angles, 1),
    );
    geometry.setAttribute(
      "flakeFlip",
      new THREE.BufferAttribute(this.flips, 1),
    );
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        opacity: { value: 0.65 },
        flake: { value: texture },
        hasImage: { value: !!texture },
        scale: { value: 1000 },
      },
      vertexShader: `uniform float scale; attribute float flakeSize; attribute float flakeAngle; attribute float flakeFlip; varying float angle; varying float flip; void main(){angle=flakeAngle; flip=flakeFlip; vec4 p=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(flakeSize*scale/max(1.,-p.z),2.,72.); gl_Position=projectionMatrix*p;}`,
      fragmentShader: `uniform sampler2D flake; uniform bool hasImage; uniform float opacity; varying float angle; varying float flip; void main(){vec2 p=gl_PointCoord-.5; float c=cos(angle),s=sin(angle); vec2 uv=mat2(c,-s,s,c)*p; uv.x/=max(.24,abs(flip)); uv+=.5; if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))) discard; float ink; if(hasImage){vec3 source=texture2D(flake,uv).rgb; ink=1.-min(source.r,min(source.g,source.b));}else{vec2 q=uv-.5; float a=atan(q.y,q.x); ink=(1.-smoothstep(.012,.038,abs(sin(a*3.))*length(q)))*(1.-smoothstep(.36,.48,length(q)));} float alpha=smoothstep(.02,.32,ink); gl_FragColor=vec4(mix(vec3(.65,.8,.94),vec3(.94,.98,1.),alpha*.7),alpha*opacity);}`,
    });
    this.object = new THREE.Points(geometry, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 4;
  }
  resize(height: number) {
    this.material.uniforms.scale.value =
      height / (2 * Math.tan((38 * Math.PI) / 360));
  }
  update(frame: SceneFrame) {
    this.material.uniforms.opacity.value = 0.55 + frame.progress * 0.25;
    if (frame.reducedMotion) return;
    for (let i = 0; i < this.speeds.length; i++) {
      const n = i * 3;
      const motion = flakeMotion(
        frame.time,
        this.phases[i],
        this.frequencies[i],
        frame.wind,
        this.speeds[i] * this.speed,
        this.flutter,
      );
      this.positions[n] += motion.x * frame.delta;
      this.positions[n + 1] += motion.y * frame.delta;
      this.angles[i] = motion.angle;
      this.flips[i] = motion.flip;
      if (this.positions[n + 1] < -9) this.positions[n + 1] = 9;
      if (this.positions[n] > 16) this.positions[n] = -16;
      if (this.positions[n] < -16) this.positions[n] = 16;
    }
    for (const key of ["position", "flakeAngle", "flakeFlip"])
      this.object.geometry.attributes[key].needsUpdate = true;
  }
}
