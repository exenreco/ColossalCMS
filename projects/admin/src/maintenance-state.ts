import { inject, Injectable, signal } from "@angular/core";
import { ApiService } from "../../../shared/api.service";

@Injectable({ providedIn: "root" })
export class MaintenanceState {
  private api = inject(ApiService);
  data = signal<any>(null);
  busy = signal(false);
  async load() {
    const data = await this.api.request("/maintenance");
    this.data.set(data);
    return data;
  }
  async toggle() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      // Change only the saved mode, preserving the published layout selection.
      const current = await this.load();
      const enabled = !current.settings.enabled;
      await this.api.request("/maintenance/settings", "POST", {
        ...current.settings,
        enabled,
        revision: current.revision,
      });
      await this.load();
      this.api.toast(`Maintenance mode ${enabled ? "on" : "off"}.`);
    } catch (error) {
      this.api.toast((error as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
