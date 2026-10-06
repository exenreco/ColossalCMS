// @ts-ignore Three.js runtime declarations are separate from its package.
import * as THREE from "three";
// @ts-ignore See above.
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MoonComponent } from "./moon-component";
import { TerrainComponent } from "./terrain-component";
import { SnowComponent } from "./snow-component";
import { WindComponent } from "./wind-component";
import { StarsComponent } from "./stars-component";
import { SkyComponent } from "./sky-component";
import { ThroneComponent } from "./throne-component";
import { IceFragmentsComponent } from "./ice-fragments-component";
import { SceneComponent, SceneFrame } from "./scene-component";
import { clamp, scrollProgress } from "./scene-math";

/** One renderer, with independent scene components and a viewport-sized background. */
export async function mountIceWorld(host: HTMLElement) {
  const doc = host.ownerDocument,
    view = doc.defaultView || window;
  const embeddingFrame = view.frameElement;
  const attached = () =>
    host.isConnected && (!embeddingFrame || embeddingFrame.isConnected);
  const fallback = host.querySelector<HTMLImageElement>(
    ".cl-portrait-fallback",
  );
  const full = host.dataset["fullViewport"] === "true";
  const components: SceneComponent[] = [];
  const cleanups: (() => void)[] = [];
  let renderer: any, environment: any, texture: any, scene: any;
  let resizeObserver: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;
  let animation = 0,
    disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animation);
    cleanups.forEach((fn) => fn());
    resizeObserver?.disconnect();
    intersection?.disconnect();
    components.forEach((component) => component.dispose?.());
    const geometries = new Set<any>(),
      materials = new Set<any>();
    scene?.traverse((object: any) => {
      if (object.geometry) geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material])
        .filter(Boolean)
        .forEach((material: any) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    texture?.dispose();
    environment?.dispose();
    renderer?.dispose();
    delete host.dataset["sceneReady"];
  };
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: doc.createElement("canvas"),
      powerPreference: "low-power",
    });
    renderer.setClearColor(0, 0);
    renderer.setPixelRatio(Math.min(view.devicePixelRatio || 1, 1.35));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    texture = await new THREE.TextureLoader().loadAsync(
      host.dataset["portraitUrl"],
    );
    if (!attached()) {
      dispose();
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#203b52", 0.009);
    const room = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 450);
    const distance =
      12 / clamp(Number(host.dataset["cameraZoom"] || 1), 0.5, 3);
    camera.position.set(0, 0, distance);
    const intensity = clamp(Number(host.dataset["lightIntensity"] || 2), 0, 5);
    scene.add(new THREE.HemisphereLight("#cceaff", "#0b1727", intensity * 0.8));
    const moonlight = new THREE.DirectionalLight("#deefff", intensity * 2.2);
    moonlight.position.set(-14, 10, 8);
    scene.add(moonlight);
    const tint = host.dataset["iceTint"] || "#c5e5ff";
    const add = <T extends SceneComponent>(component: T): T => {
      components.push(component);
      scene.add(component.object);
      return component;
    };
    add(new SkyComponent());
    add(new StarsComponent());
    const moon =
      host.dataset["moonEnabled"] !== "false"
        ? add(
            new MoonComponent(
              doc,
              clamp(Number(host.dataset["moonSize"] || 4.5), 1, 7),
              clamp(Number(host.dataset["moonElevation"] || 0), -4, 5),
              host.dataset["moonTint"] || "#b9dcef",
            ),
          )
        : null;
    if (host.dataset["terrainEnabled"] !== "false")
      add(new TerrainComponent(tint));
    const throne = add(new ThroneComponent(texture));
    const fragments = add(
      new IceFragmentsComponent(
        Math.round(clamp(Number(host.dataset["fragmentCount"] || 0), 0, 40)),
        tint,
      ),
    );
    const wind =
      host.dataset["windEnabled"] !== "false"
        ? add(
            new WindComponent(
              clamp(Number(host.dataset["windStrength"] || 0), 0, 3),
            ),
          )
        : null;
    if (host.dataset["snowEnabled"] !== "false")
      add(
        new SnowComponent(
          Math.round(clamp(Number(host.dataset["snowDensity"] || 0), 0, 1800)),
        ),
      );
    const canvas = renderer.domElement as HTMLCanvasElement;
    canvas.style.cssText =
      "display:block;width:100%;height:100%;position:absolute;inset:0;";
    canvas.setAttribute("aria-hidden", "true");
    host.style.position = full ? "fixed" : "relative";
    if (full) {
      host.style.inset = "0";
      host.style.width = "100%";
      host.style.height = "100vh";
      host.style.zIndex = "0";
      host.style.pointerEvents = "none";
    }
    host.style.overflow = "hidden";
    host.append(canvas);
    const preview = doc !== document ? doc.createElement("img") : null;
    if (preview) {
      preview.alt = "";
      preview.setAttribute("aria-hidden", "true");
      preview.style.cssText = canvas.style.cssText;
      host.append(preview);
    }
    let visible = true,
      dirty = true,
      progress = 0,
      width = 0,
      height = 0;
    const resize = () => {
      width = Math.max(1, host.clientWidth);
      height = Math.max(100, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      throne.resize(camera.aspect, distance);
      moon?.resize(camera.aspect);
      fragments.resize(throne.object);
      dirty = true;
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    if (!full) {
      intersection = new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
        dirty = true;
      });
      intersection.observe(host);
    }
    const motion = view.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0 };
    const scrolling = () => {
      const origin = full
        ? 0
        : host.getBoundingClientRect().top + (view.scrollY || 0);
      progress =
        host.dataset["scrollInteractive"] === "false"
          ? 0
          : scrollProgress(
              Math.max(0, (view.scrollY || 0) - origin),
              view.innerHeight,
              clamp(Number(host.dataset["scrollStrength"] || 0), 0, 4),
              motion.matches,
            );
      host.dataset["sceneProgress"] = progress.toFixed(3);
      dirty = true;
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || host.dataset["pointerInteractive"] === "false")
        return;
      const strength = clamp(Number(host.dataset["motionStrength"] || 0), 0, 2);
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / width - 0.5) * strength;
      pointer.y = ((event.clientY - rect.top) / height - 0.5) * strength;
      dirty = true;
    };
    const leave = () => {
      pointer.x = pointer.y = 0;
      dirty = true;
    };
    const keys = (event: KeyboardEvent) => {
      if (
        motion.matches ||
        host.dataset["pointerInteractive"] === "false" ||
        !event.key.startsWith("Arrow")
      )
        return;
      event.preventDefault();
      pointer.x = clamp(
        pointer.x +
          (event.key === "ArrowLeft"
            ? -0.15
            : event.key === "ArrowRight"
              ? 0.15
              : 0),
        -1,
        1,
      );
      pointer.y = clamp(
        pointer.y +
          (event.key === "ArrowUp"
            ? -0.15
            : event.key === "ArrowDown"
              ? 0.15
              : 0),
        -1,
        1,
      );
      dirty = true;
    };
    const preference = () => {
      leave();
      scrolling();
    };
    const pointerTarget = full ? view : host;
    pointerTarget.addEventListener("pointermove", move as EventListener, {
      passive: true,
    });
    pointerTarget.addEventListener("pointerleave", leave);
    host.addEventListener("keydown", keys);
    view.addEventListener("scroll", scrolling, { passive: true });
    view.addEventListener("resize", resize);
    motion.addEventListener("change", preference);
    cleanups.push(
      () =>
        pointerTarget.removeEventListener("pointermove", move as EventListener),
      () => pointerTarget.removeEventListener("pointerleave", leave),
      () => host.removeEventListener("keydown", keys),
      () => view.removeEventListener("scroll", scrolling),
      () => view.removeEventListener("resize", resize),
      () => motion.removeEventListener("change", preference),
    );
    scrolling();
    let last = 0,
      lastSnapshot = 0;
    const tick = (time: number) => {
      if (!attached()) {
        dispose();
        return;
      }
      animation = requestAnimationFrame(tick);
      if (!visible || doc.hidden || time - last < (preview ? 66 : 33)) return;
      const delta = Math.min(0.05, (time - last) / 1000);
      last = time;
      if (motion.matches && !dirty) return;
      const frame: SceneFrame = {
        time: time / 1000,
        delta,
        progress,
        reducedMotion: motion.matches,
        wind: wind?.velocity(time / 1000, progress) || 0,
      };
      components.forEach((component) => component.update(frame));
      camera.position.x +=
        (motion.matches
          ? -camera.position.x
          : pointer.x * 0.32 - camera.position.x) * 0.07;
      camera.position.y +=
        (motion.matches
          ? -camera.position.y
          : -pointer.y * 0.18 - camera.position.y) * 0.07;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      if (fallback) fallback.style.visibility = "hidden";
      if (preview && time - lastSnapshot >= 66) {
        preview.src = canvas.toDataURL("image/webp", 0.84);
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
    if (fallback) fallback.style.visibility = "visible";
  }
}
