import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, Routes, Router, CanActivateFn } from "@angular/router";
import { inject } from "@angular/core";
import { ApiService } from "../../../shared/api.service";
import { AdminComponent } from "./shell";
import {
  PLUGIN_MANIFESTS,
  PLUGIN_COMPONENTS,
} from "../../../shared/plugin-registry.service";
const guard: CanActivateFn = async (route) => {
  const api = inject(ApiService),
    router = inject(Router);
  try {
    if (!api.state() && (await api.openWorkspace()).setup) return false;
    const state = api.state()!;
    const plugin = state.plugins.find((p) => p.id === route.data["pluginId"]);
    if (
      !plugin?.active ||
      (state.user.role !== "admin" &&
        ![
          "DashboardComponent",
          "PagesAdminComponent",
          "PostsAdminComponent",
          "MediaLibraryComponent",
        ].includes(plugin.admin.entryComponent))
    )
      return router.parseUrl("/dashboard");
    return true;
  } catch {
    return false;
  }
};
const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "dashboard" },
  ...PLUGIN_MANIFESTS.map((p) => ({
    path: p.admin.menu.path.replace("/admin/", ""),
    canActivate: [guard],
    loadComponent: PLUGIN_COMPONENTS[p.admin.entryComponent],
    children: ["com.colossal.pages", "com.colossal.posts"].includes(p.id)
      ? [
          {
            path: "new",
            loadComponent: () =>
              import("../../../shared/content-editor-modal.component").then(
                (m) => m.ContentEditorModalComponent,
              ),
            canDeactivate: [(component: any) => component.canLeave()],
          },
          {
            path: "edit/:id",
            loadComponent: () =>
              import("../../../shared/content-editor-modal.component").then(
                (m) => m.ContentEditorModalComponent,
              ),
            canDeactivate: [(component: any) => component.canLeave()],
          },
        ]
      : ["com.colossal.themes", "com.colossal.maintenance"].includes(p.id)
        ? [
            {
              path: "edit/:id",
              loadComponent: () =>
                import("../../../shared/theme-editor.component").then(
                  (m) => m.ThemeEditorComponent,
                ),
              canDeactivate: [(component: any) => component.canLeave()],
            },
          ]
        : [],
    data: {
      pluginId: p.id,
      kind: p.id === "com.colossal.pages" ? "page" : "post",
    },
  })),
  { path: "**", redirectTo: "dashboard" },
];
bootstrapApplication(AdminComponent, {
  providers: [provideRouter(routes)],
}).catch(console.error);
