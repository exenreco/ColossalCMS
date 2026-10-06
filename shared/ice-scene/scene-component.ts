export interface SceneFrame {
  time: number;
  delta: number;
  progress: number;
  reducedMotion: boolean;
  wind: number;
}

/** Each part owns its scene object and animation; the host owns the renderer. */
export interface SceneComponent {
  object: any;
  update(frame: SceneFrame): void;
  dispose?(): void;
}
