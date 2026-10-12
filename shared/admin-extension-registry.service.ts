import { Injectable, Type } from "@angular/core";
import { seoAdminExtensions } from "../plugins/seo/admin";

export interface AdminExtension {
  id: string;
  pluginId: string;
  slot: string;
  load: () => Promise<Type<unknown>>;
}

/** Composition root for reviewed UI contributions; manifests do not execute uploaded code. */
const contributions: AdminExtension[] = [...seoAdminExtensions];
@Injectable({ providedIn: "root" })
export class AdminExtensionRegistry {
  private loaded = new Map<string, Promise<Type<unknown>>>();
  forSlot(slot: string, activeIds: Set<string>) {
    return contributions.filter(
      (extension) =>
        extension.slot === slot && activeIds.has(extension.pluginId),
    );
  }
  load(extension: AdminExtension) {
    let component = this.loaded.get(extension.id);
    if (!component) {
      component = extension.load().catch((error) => {
        this.loaded.delete(extension.id);
        throw error;
      });
      this.loaded.set(extension.id, component);
    }
    return component;
  }
}
