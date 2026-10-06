// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
import { seededRandom } from "./scene-math";
import { SceneComponent, SceneFrame } from "./scene-component";

/** A real sphere with procedural craters, directional light and an atmospheric rim. */
export class MoonComponent implements SceneComponent {
  object: any;
  private texture: any;
  private baseX = -1.8;
  constructor(doc: Document, size: number, elevation: number, tint: string) {
    this.object = new THREE.Group();
    this.object.position.set(this.baseX, elevation + 2.6, -17);
    const canvas = doc.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#afc7d4";
    ctx.fillRect(0, 0, 1024, 512);
    const random = seededRandom(127);
    for (let i = 0; i < 11000; i++) {
      const shade = Math.round(120 + random() * 105);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},.19)`;
      ctx.fillRect(
        random() * 1024,
        random() * 512,
        2 + random() * 5,
        2 + random() * 4,
      );
    }
    for (let i = 0; i < 12; i++) {
      const x = random() * 1024,
        y = random() * 512,
        r = 28 + random() * 95;
      const mare = ctx.createRadialGradient(x, y, 0, x, y, r);
      mare.addColorStop(0, "#3a586174");
      mare.addColorStop(0.6, "#637d8540");
      mare.addColorStop(1, "#7c96a000");
      ctx.fillStyle = mare;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 450; i++) {
      const x = random() * 1024,
        y = random() * 512,
        r = 1.4 + random() * 15;
      const gradient = ctx.createRadialGradient(
        x - r * 0.2,
        y - r * 0.2,
        0,
        x,
        y,
        r,
      );
      gradient.addColorStop(0, "#607d9180");
      gradient.addColorStop(0.72, "#819ba84a");
      gradient.addColorStop(0.86, "#e8f8fb77");
      gradient.addColorStop(1, "#b8d5e000");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(size, 64, 48),
      new THREE.ShaderMaterial({
        uniforms: {
          surface: { value: this.texture },
          tint: { value: new THREE.Color(tint) },
        },
        vertexShader: `varying vec2 vUv; varying vec3 vNormal; void main(){vUv=uv; vNormal=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform sampler2D surface; uniform vec3 tint; varying vec2 vUv; varying vec3 vNormal; void main(){float light=max(0.,dot(normalize(vNormal),normalize(vec3(-.9,.25,.24)))); vec3 craters=texture2D(surface,vUv).rgb; gl_FragColor=vec4(craters*tint*(.045+light*.95),1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      }),
    );
    sphere.rotation.y = 0.5;
    this.object.add(sphere);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(size * 1.018, 48, 32),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { tint: { value: new THREE.Color(tint) } },
        vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.); vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz); gl_Position=projectionMatrix*p;}`,
        fragmentShader: `uniform vec3 tint; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.); gl_FragColor=vec4(tint,rim*.28);}`,
      }),
    );
    this.object.add(halo);
  }
  update(frame: SceneFrame) {
    this.object.rotation.y = frame.progress * 0.08;
    this.object.position.x = this.baseX + frame.progress * 1.1;
  }
  resize(aspect: number) {
    this.baseX = aspect < 0.9 ? 0 : -1.8;
  }
  dispose() {
    this.texture.dispose();
  }
}
