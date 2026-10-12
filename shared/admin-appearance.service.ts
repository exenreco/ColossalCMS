import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { ApiService } from "./api.service";

@Injectable({ providedIn: "root" })
export class AdminAppearanceService {
  private api = inject(ApiService);
  private media = window.matchMedia("(prefers-color-scheme: dark)");
  private systemDark = signal(this.media.matches);
  colorMode = computed<"light" | "dark">(() => {
    const mode = this.api.state()?.settings.adminColorMode || "system";
    return mode === "system" ? (this.systemDark() ? "dark" : "light") : mode;
  });
  constructor() {
    this.media.addEventListener("change", (event) =>
      this.systemDark.set(event.matches),
    );
    effect(() => {
      document.documentElement.dataset["adminMode"] = this.colorMode();
    });
    // Pick up changes saved in another admin tab without losing editor drafts.
    window.addEventListener("focus", () => {
      if (this.api.state()) void this.api.load().catch(() => {});
    });
  }
}
