import { effect, Injectable, signal } from "@angular/core";

const storageKey = "colossal.plugins.display";
function savedPreferences(): { view: "list" | "grid"; showCore: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    return {
      view: saved?.view === "grid" ? "grid" : "list",
      showCore: saved?.showCore === true,
    };
  } catch {
    return { view: "list", showCore: false };
  }
}

/** Display preferences shared by the Plugins page and its topbar controls. */
@Injectable({ providedIn: "root" })
export class PluginViewState {
  private saved = savedPreferences();
  view = signal<"list" | "grid">(this.saved.view);
  showCore = signal(this.saved.showCore);

  constructor() {
    effect(() => {
      const preferences = { view: this.view(), showCore: this.showCore() };
      try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
      } catch {
        // Keep the controls usable when browser storage is unavailable.
      }
    });
  }
}
