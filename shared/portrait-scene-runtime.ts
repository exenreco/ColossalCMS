// Loaded only for a visible portrait scene; ordinary pages do not download Three.js.
// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
// @ts-ignore See above.
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** An alpha portrait plane surrounded by live, refractive 3D crystal artifacts. */
export async function mountPortraitScene(host: HTMLElement) {
  const view = host.ownerDocument.defaultView || window;
  const fallback = host.querySelector<HTMLImageElement>(
    ".cl-portrait-fallback",
  );
  let renderer: any, environment: any, texture: any, scene: any;
  let resizeObserver: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;
  let animation = 0;
  let disposed = false;
  const cleanups: (() => void)[] = [];
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animation);
    cleanups.forEach((fn) => fn());
    resizeObserver?.disconnect();
    intersection?.disconnect();
    scene?.traverse((object: any) => {
      object.geometry?.dispose();
      (Array.isArray(object.material) ? object.material : [object.material])
        .filter(Boolean)
        .forEach((material: any) => material.dispose());
    });
    texture?.dispose();
    environment?.dispose();
    renderer?.dispose();
  };
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: host.ownerDocument.createElement("canvas"),
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(view.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    texture = await new THREE.TextureLoader().loadAsync(
      host.dataset["portraitUrl"],
    );
    if (!host.isConnected) {
      dispose();
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    const zoom = Number(host.dataset["cameraZoom"] || 1);
    camera.position.set(0, 0, 8.8 / zoom);
    const group = new THREE.Group();
    const ratio = texture.image.width / texture.image.height;
    const portrait = new THREE.Mesh(
      new THREE.PlaneGeometry(4.55 * ratio, 4.55),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    );
    portrait.position.y = -0.18;
    group.add(portrait);
    scene.add(group);
    const tint = new THREE.Color(host.dataset["iceTint"] || "#c5e5ff");
    const intensity = Number(host.dataset["lightIntensity"] || 2);
    scene.add(new THREE.HemisphereLight(0xe3f1ff, 0x292c3e, intensity));
    const key = new THREE.DirectionalLight(0xf6fbff, intensity * 2.5);
    key.position.set(-4, 6, 4);
    scene.add(key);
    const rim = new THREE.PointLight(tint, intensity * 10, 20);
    rim.position.set(3, 2, 4);
    scene.add(rim);
    const crystals: any[] = [];
    const count = Math.round(Number(host.dataset["fragmentCount"] || 0));
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996;
      const material = new THREE.MeshPhysicalMaterial({
        color: tint,
        metalness: 0.18,
        roughness: 0.12,
        transmission: 0.86,
        thickness: 0.8,
        ior: 1.31,
        clearcoat: 1,
        envMapIntensity: 1.9,
      });
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.09 + (i % 4) * 0.035, 0),
        material,
      );
      const radius = 2.15 + (i % 3) * 0.32;
      mesh.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * 2.2,
        ((i % 3) - 1) * 1.3,
      );
      mesh.rotation.set(i * 0.4, i * 0.7, i * 0.2);
      mesh.scale.set(0.5 + (i % 3) * 0.25, 0.9 + (i % 4) * 0.3, 0.7);
      mesh.userData.origin = mesh.position.clone();
      crystals.push(mesh);
      group.add(mesh);
    }
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(180 * 3);
    for (let i = 0; i < positions.length; i++)
      positions[i] = Math.sin(i * 127.1) * (i % 3 === 2 ? 2 : 3.6);
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: tint,
        size: 0.018,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      }),
    );
    group.add(particles);
    const canvas = renderer.domElement as HTMLCanvasElement;
    canvas.style.cssText =
      "display:block;width:100%;height:100%;position:absolute;inset:0;";
    canvas.setAttribute("aria-hidden", "true");
    host.style.position = "relative";
    host.style.overflow = "hidden";
    host.append(canvas);
    const preview =
      host.ownerDocument !== document
        ? host.ownerDocument.createElement("img")
        : null;
    if (preview) {
      preview.alt = "";
      preview.setAttribute("aria-hidden", "true");
      preview.style.cssText = canvas.style.cssText;
      host.append(preview);
    }
    let width = 0,
      height = 0,
      visible = true,
      dirty = true;
    const resize = () => {
      width = Math.max(1, host.clientWidth);
      height = Math.max(100, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Keep the same composition on narrow screens rather than cropping the face.
      camera.position.z = (8.8 / zoom) * Math.max(1, 0.9 / camera.aspect);
      camera.updateProjectionMatrix();
      dirty = true;
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    intersection = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      dirty = true;
    });
    intersection.observe(host);
    const motionPreference = view.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const pointer = { x: 0, y: 0 };
    let scroll = 0;
    const scrollStrength = Number(host.dataset["scrollStrength"] || 1);
    const pointerStrength = Number(host.dataset["motionStrength"] || 0.6);
    const move = (event: PointerEvent) => {
      if (
        motionPreference.matches ||
        host.dataset["pointerInteractive"] === "false"
      )
        return;
      const rect = host.getBoundingClientRect();
      pointer.x =
        ((event.clientX - rect.left) / rect.width - 0.5) * pointerStrength;
      pointer.y =
        ((event.clientY - rect.top) / rect.height - 0.5) * pointerStrength;
      dirty = true;
    };
    const leave = () => {
      pointer.x = pointer.y = 0;
      dirty = true;
    };
    const scrolling = () => {
      const rect = host.getBoundingClientRect();
      scroll =
        host.dataset["scrollInteractive"] === "false" ||
        motionPreference.matches
          ? 0
          : Math.max(-1, Math.min(1, -rect.top / Math.max(rect.height, 1))) *
            scrollStrength;
      dirty = true;
    };
    const keys = (event: KeyboardEvent) => {
      if (
        motionPreference.matches ||
        host.dataset["pointerInteractive"] === "false" ||
        !event.key.startsWith("Arrow")
      )
        return;
      event.preventDefault();
      if (event.key === "ArrowLeft") pointer.x -= 0.15;
      if (event.key === "ArrowRight") pointer.x += 0.15;
      if (event.key === "ArrowUp") pointer.y -= 0.15;
      if (event.key === "ArrowDown") pointer.y += 0.15;
      pointer.x = Math.max(-1, Math.min(1, pointer.x));
      pointer.y = Math.max(-1, Math.min(1, pointer.y));
      dirty = true;
    };
    const preferenceChanged = () => {
      leave();
      scrolling();
    };
    motionPreference.addEventListener("change", preferenceChanged);
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    host.addEventListener("keydown", keys);
    view.addEventListener("scroll", scrolling, { passive: true });
    cleanups.push(
      () => host.removeEventListener("pointermove", move),
      () => host.removeEventListener("pointerleave", leave),
      () => host.removeEventListener("keydown", keys),
      () => view.removeEventListener("scroll", scrolling),
      () => motionPreference.removeEventListener("change", preferenceChanged),
    );
    scrolling();
    let last = 0,
      lastSnapshot = 0;
    const tick = (time: number) => {
      if (!host.isConnected) {
        dispose();
        return;
      }
      animation = requestAnimationFrame(tick);
      if (
        !visible ||
        host.ownerDocument.hidden ||
        time - last < (preview ? 66 : 33)
      )
        return;
      last = time;
      if (!motionPreference.matches) {
        group.rotation.y +=
          (pointer.x * 0.28 + scroll * 0.15 - group.rotation.y) * 0.075;
        group.rotation.x += (-pointer.y * 0.16 - group.rotation.x) * 0.075;
        group.position.y += (-scroll * 0.2 - group.position.y) * 0.075;
        crystals.forEach((crystal, i) => {
          crystal.rotation.y += 0.003;
          crystal.position.y =
            crystal.userData.origin.y + Math.sin(time * 0.00045 + i) * 0.12;
        });
        particles.rotation.z = time * 0.000025;
      } else {
        group.rotation.set(0, 0, 0);
        group.position.y = 0;
        if (!dirty) return;
      }
      renderer.render(scene, camera);
      if (fallback) fallback.style.visibility = "hidden";
      if (preview && time - lastSnapshot >= 66) {
        preview.src = canvas.toDataURL("image/webp", 0.85);
        lastSnapshot = time;
      }
      dirty = false;
      host.dataset["sceneReady"] = "true";
    };
    animation = requestAnimationFrame(tick);
    canvas.addEventListener(
      "webglcontextlost",
      () => {
        if (fallback) fallback.style.visibility = "visible";
        dispose();
        canvas.remove();
        preview?.remove();
      },
      { once: true },
    );
  } catch {
    dispose();
    renderer?.domElement?.remove();
    // Keep the alpha artwork visible when WebGL, CORS, or texture loading fails.
    if (fallback) fallback.style.visibility = "visible";
  }
}
