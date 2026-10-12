export const seoAdminExtensions = [
  {
    id: "seo-overview",
    pluginId: "com.colossal.seo",
    slot: "dashboard",
    load: () =>
      import("../../shared/seo-overview.component").then(
        (module) => module.SeoOverviewComponent,
      ),
  },
];
