import { Injectable, inject, signal } from "@angular/core";
import { ApiService } from "./api.service";
import { AdminAppearanceService } from "./admin-appearance.service";

@Injectable({ providedIn: "root" })
export class EditorPreferencesService {
  private api = inject(ApiService);
  colorMode = inject(AdminAppearanceService).colorMode;
  walkthroughVersion = signal(0);
  ready = signal(false);
  private user = "";
  private pending?: Promise<void>;
  private writes = Promise.resolve();
  load() {
    const user = this.api.state()?.user.id || "";
    if (user === this.user && this.pending) return this.pending;
    this.user = user;
    this.ready.set(false);
    this.pending = this.api
      .request("/admin/editor/preferences")
      .then((p) => {
        this.walkthroughVersion.set(p.walkthroughVersion);
        this.ready.set(true);
      })
      .catch(() => {
        // If the provider is temporarily offline, do not repeatedly show a dismissed tour.
        const cache = localStorage.getItem(
          `colossal.editor.preferences:${user}`,
        );
        try {
          const p = JSON.parse(cache || "{}");
          this.walkthroughVersion.set(p.walkthroughVersion === 1 ? 1 : 0);
        } catch {
          this.walkthroughVersion.set(0);
        }
        this.ready.set(true);
      });
    return this.pending;
  }
  update(patch: { walkthroughVersion?: number }) {
    if (patch.walkthroughVersion)
      this.walkthroughVersion.set(patch.walkthroughVersion);
    const current = {
      colorMode: this.colorMode(),
      walkthroughVersion: this.walkthroughVersion(),
    };
    localStorage.setItem(
      `colossal.editor.preferences:${this.user}`,
      JSON.stringify(current),
    );
    this.writes = this.writes
      .then(() =>
        this.api.request("/admin/editor/preferences", "PUT", {
          ...(current.walkthroughVersion === 1
            ? { walkthroughVersion: 1 }
            : {}),
        }),
      )
      .then(() => undefined)
      .catch(() =>
        this.api.toast(
          "Editor preference saved on this device. Server sync will retry on your next change.",
        ),
      );
    return this.writes;
  }
}
