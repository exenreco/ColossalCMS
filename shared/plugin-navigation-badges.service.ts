import { Injectable, effect, inject, signal, untracked } from "@angular/core";
import { ApiService } from "./api.service";
import { messagingNavigationBadge } from "../plugins/messaging/navigation";

/** Reviewed plugins contribute counts without teaching the admin shell their data model. */
@Injectable({ providedIn: "root" })
export class PluginNavigationBadges {
  private api = inject(ApiService);
  private contributions = [messagingNavigationBadge];
  private counts = signal<Record<string, number>>({});
  private generation = 0;
  private sequence = 0;
  constructor() {
    effect((onCleanup) => {
      const state = this.api.state();
      const generation = ++this.generation;
      if (!state || state.user.role !== "admin") {
        this.counts.set({});
        return;
      }
      untracked(() => void this.refresh(generation));
      const refresh = () => {
        if (!document.hidden) void this.refresh(generation);
      };
      const timer = setInterval(refresh, 30000);
      window.addEventListener("focus", refresh);
      onCleanup(() => {
        clearInterval(timer);
        window.removeEventListener("focus", refresh);
      });
    });
  }
  count(pluginId: string) {
    return this.counts()[pluginId] || 0;
  }
  label(pluginId: string) {
    return (
      this.contributions.find((item) => item.pluginId === pluginId)?.label ||
      "items"
    );
  }
  async refresh(generation = this.generation) {
    const state = this.api.state();
    if (!state || state.user.role !== "admin") return;
    const sequence = ++this.sequence;
    const entries = await Promise.all(
      this.contributions.map(async (item) => {
        if (!state.plugins.some((p) => p.id === item.pluginId && p.active))
          return [item.pluginId, 0] as const;
        try {
          const data = await this.api.request(item.endpoint);
          return [
            item.pluginId,
            Math.max(0, Math.trunc(Number(data.count) || 0)),
          ] as const;
        } catch {
          return [item.pluginId, 0] as const;
        }
      }),
    );
    if (generation === this.generation && sequence === this.sequence)
      this.counts.set(Object.fromEntries(entries));
  }
}
