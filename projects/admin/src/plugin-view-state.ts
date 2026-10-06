import { Injectable, signal } from "@angular/core";

/** Display preferences shared by the Plugins page and its topbar controls. */
@Injectable({ providedIn: "root" })
export class PluginViewState {
  view = signal<"list" | "grid">("list");
  showCore = signal(false);
}
