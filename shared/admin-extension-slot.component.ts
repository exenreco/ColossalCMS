import { Component, computed, inject, input } from "@angular/core";
import { AsyncPipe, NgComponentOutlet } from "@angular/common";
import { ApiService } from "./api.service";
import { AdminExtensionRegistry } from "./admin-extension-registry.service";

@Component({
  selector: "cl-admin-extension-slot",
  standalone: true,
  imports: [AsyncPipe, NgComponentOutlet],
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `@for (extension of extensions(); track extension.id) {
    @if (registry.load(extension) | async; as component) {
      <ng-container *ngComponentOutlet="component" />
    }
  }`,
})
export class AdminExtensionSlotComponent {
  slot = input.required<string>();
  registry = inject(AdminExtensionRegistry);
  api = inject(ApiService);
  extensions = computed(() =>
    this.registry.forSlot(
      this.slot(),
      new Set(
        (this.api.state()?.plugins || [])
          .filter((plugin) => plugin.active)
          .map((plugin) => plugin.id),
      ),
    ),
  );
}
