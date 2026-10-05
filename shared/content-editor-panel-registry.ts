import { Injectable, signal, Type } from "@angular/core";
import { Content } from "./models";
export interface ContentEditorPanel {
  id: string;
  title: string;
  order: number;
  component?: Type<unknown>;
  fields?: { key: string; label: string; type?: "text" | "textarea" }[];
  pluginId?: string;
}
@Injectable({ providedIn: "root" })
export class ContentEditorPanelRegistry {
  panels = signal<ContentEditorPanel[]>([
    { id: "status", title: "Status", order: 10 },
    { id: "summary", title: "Excerpt", order: 12 },
    { id: "template", title: "Template", order: 15 },
    { id: "featured", title: "Featured image", order: 20 },
    { id: "taxonomy", title: "Categories & tags", order: 30 },
    { id: "seo", title: "SEO", order: 40 },
    { id: "authoring", title: "Authoring & revisions", order: 50 },
  ]);
  register(panel: ContentEditorPanel) {
    if (this.panels().some((p) => p.id === panel.id))
      throw new Error("An editor panel already uses " + panel.id);
    this.panels.update((p) => [...p, panel].sort((a, b) => a.order - b.order));
  }
  removePlugin(pluginId: string) {
    this.panels.update((p) => p.filter((x) => x.pluginId !== pluginId));
  }
}
@Injectable({ providedIn: "root" })
export class ContentEditorContext {
  content = signal<Content | null>(null);
  updatePanel(key: string, value: unknown) {
    const c = this.content();
    if (c) {
      c.details ??= {};
      c.details.panelData = { ...c.details.panelData, [key]: value };
      this.content.set({ ...c });
    }
  }
}
