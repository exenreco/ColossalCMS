// Three.js is imported only by the model host's dynamic import.
// @ts-ignore Three.js ships runtime modules separately from community declarations.
import * as THREE from "three";
// @ts-ignore See above.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// @ts-ignore See above.
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export async function mountModel(host: HTMLElement) {
  let renderer: any,
    controls: any,
    frame = 0,
    observer: ResizeObserver | undefined;
  try {
    const model = await new GLTFLoader().loadAsync(host.dataset["modelUrl"]);
    if (!host.isConnected) return;
    // The Theme Editor renders blocks inside an iframe. Create the WebGL canvas
    // in the host document so its context remains tied to the visible preview.
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: host.ownerDocument.createElement("canvas"),
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      host.getAttribute("aria-label") ||
        "3D model. Arrow keys orbit the model.",
    );
    // A sandboxed srcdoc iframe does not paint canvases driven by its parent
    // document in Chromium. Present snapshots as an image in editor previews;
    // the WebGL canvas remains the live source for camera interaction.
    const iframePreview = host.ownerDocument !== document;
    const preview = iframePreview
      ? host.ownerDocument.createElement("img")
      : undefined;
    if (preview) {
      preview.alt = "";
      preview.setAttribute(
        "aria-label",
        renderer.domElement.getAttribute("aria-label") || "3D model",
      );
      preview.tabIndex = 0;
      preview.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;";
    }
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
    scene.add(model.scene, new THREE.HemisphereLight(0xffffff, 0x666666, 3));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 4);
    scene.add(light);
    const box = new THREE.Box3().setFromObject(model.scene),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    model.scene.position.sub(center);
    const originalRotation = model.scene.rotation.clone();
    const scrollEnabled = host.dataset["scrollInteractive"] === "true";
    const scrollStrength = Math.max(
      0,
      Math.min(4, Number(host.dataset["scrollStrength"] || 1)),
    );
    const view = host.ownerDocument.defaultView || window;
    let scrollProgress = 0;
    const updateScroll = () => {
      const rect = host.getBoundingClientRect();
      scrollProgress = Math.max(
        0,
        Math.min(
          1,
          (view.innerHeight - rect.top) / (view.innerHeight + rect.height),
        ),
      );
    };
    if (scrollEnabled) {
      view.addEventListener("scroll", updateScroll, { passive: true });
      updateScroll();
    }
    const zoom = Math.max(
      0.5,
      Math.min(3, Number(host.dataset["cameraZoom"] || 1)),
    );
    const distance = (Math.max(size.x, size.y, size.z, 0.1) * 2) / zoom;
    camera.position.set(distance, distance * 0.6, distance);
    controls = new OrbitControls(camera, preview || renderer.domElement);
    controls.enabled = host.dataset["controls"] !== "false";
    controls.autoRotate =
      host.dataset["autoRotate"] === "true" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = Number(host.dataset["rotateSpeed"] || 2) / 6;
    const keys = (event: KeyboardEvent) => {
      if (
        !controls.enabled ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      spherical.theta +=
        event.key === "ArrowLeft" ? 0.1 : event.key === "ArrowRight" ? -0.1 : 0;
      spherical.phi = Math.max(
        0.1,
        Math.min(
          Math.PI - 0.1,
          spherical.phi +
            (event.key === "ArrowUp"
              ? -0.1
              : event.key === "ArrowDown"
                ? 0.1
                : 0),
        ),
      );
      camera.position.setFromSpherical(spherical);
      controls.update();
    };
    (preview || renderer.domElement).addEventListener("keydown", keys);
    let previewDirty = true;
    let lastSnapshot = 0;
    controls.addEventListener("change", () => (previewDirty = true));
    const resize = () => {
      const w = Math.max(1, host.clientWidth),
        h = Math.max(100, host.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      previewDirty = true;
    };
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    host.replaceChildren(renderer.domElement, ...(preview ? [preview] : []));
    let last = performance.now();
    const tick = (time: number) => {
      if (!host.isConnected) {
        if (scrollEnabled) view.removeEventListener("scroll", updateScroll);
        observer?.disconnect();
        controls.dispose();
        renderer.dispose();
        model.scene.traverse((o: any) => {
          o.geometry?.dispose();
          for (const m of (Array.isArray(o.material)
            ? o.material
            : [o.material]
          ).filter(Boolean)) {
            for (const value of Object.values(m) as any[])
              if (value?.isTexture) value.dispose();
            m.dispose();
          }
        });
        return;
      }
      if (matchMedia("(prefers-reduced-motion: reduce)").matches)
        controls.autoRotate = false;
      else if (scrollEnabled) {
        const motion = (scrollProgress - 0.5) * scrollStrength;
        model.scene.rotation.y +=
          (originalRotation.y +
            motion * Math.PI * 0.75 -
            model.scene.rotation.y) *
          0.075;
        model.scene.rotation.x +=
          (originalRotation.x + motion * 0.22 - model.scene.rotation.x) * 0.075;
        previewDirty = true;
      }
      controls.update(Math.min((time - last) / 1000, 0.1));
      last = time;
      renderer.render(scene, camera);
      if (preview && previewDirty && time - lastSnapshot >= 33) {
        preview.src = renderer.domElement.toDataURL("image/webp", 0.85);
        previewDirty = false;
        lastSnapshot = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  } catch (error) {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    controls?.dispose();
    renderer?.dispose();
    console.warn(
      "The model could not load. Check WebGL and the model URL’s CORS policy.",
      error,
    );
    const note = host.ownerDocument.createElement("p");
    note.textContent =
      "3D preview unavailable. " + (host.getAttribute("aria-label") || "");
    host.append(note);
  }
}
