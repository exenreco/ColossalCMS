import caching from "../plugins/caching/plugin.manifest.json";
import themes from "../plugins/themes/plugin.manifest.json";
import media from "../plugins/media/plugin.manifest.json";
import { Injectable } from "@angular/core";
import dashboard from "../plugins/dashboard/plugin.manifest.json";
import pages from "../plugins/pages/plugin.manifest.json";
import posts from "../plugins/posts/plugin.manifest.json";
import plugins from "../plugins/plugins/plugin.manifest.json";
import settings from "../plugins/settings/plugin.manifest.json";
import readingTime from "../plugins/reading-time/plugin.manifest.json";
import announcement from "../plugins/announcement/plugin.manifest.json";
import googleAds from "../plugins/google-ads/plugin.manifest.json";
import productionConnections from "../plugins/production-connections/plugin.manifest.json";
import loginSecurity from "../plugins/login-security/plugin.manifest.json";
import maintenance from "../plugins/maintenance/plugin.manifest.json";
import seo from "../plugins/seo/plugin.manifest.json";
import aiAssistant from "../plugins/ai-assistant/plugin.manifest.json";
import trivia from "../plugins/trivia/plugin.manifest.json";
import messaging from "../plugins/messaging/plugin.manifest.json";
import lazyLoad from "../plugins/lazy-load/plugin.manifest.json";
import mediaManagerPlay from "../plugins/media-manager-play/plugin.manifest.json";
export const PLUGIN_MANIFESTS = [
  mediaManagerPlay,
  caching,
  lazyLoad,
  messaging,
  trivia,
  aiAssistant,
  themes,
  media,
  dashboard,
  pages,
  posts,
  plugins,
  settings,
  readingTime,
  announcement,
  googleAds,
  productionConnections,
  loginSecurity,
  maintenance,
  seo,
];
/** Maps reviewed manifest entry names to lazy Angular components; arbitrary uploaded code is never executed. */
export const PLUGIN_COMPONENTS: Record<string, () => Promise<any>> = {
  MediaManagerPlayComponent: () =>
    import("../plugins/media-manager-play/admin").then(
      (m) => m.MediaManagerPlayComponent,
    ),
  CachingComponent: () =>
    import("../plugins/caching/admin").then((m) => m.CachingComponent),
  LazyLoadComponent: () =>
    import("../plugins/lazy-load/admin").then((m) => m.LazyLoadComponent),
  MessagingComponent: () =>
    import("../plugins/messaging/admin").then((m) => m.MessagingComponent),
  TriviaComponent: () =>
    import("../plugins/trivia/admin").then((m) => m.TriviaComponent),
  AiAssistantComponent: () =>
    import("../projects/admin/src/plugins/ai-assistant").then(
      (m) => m.AiAssistantComponent,
    ),
  SeoComponent: () =>
    import("../projects/admin/src/plugins/seo").then((m) => m.SeoComponent),
  MaintenanceComponent: () =>
    import("../projects/admin/src/plugins/maintenance").then(
      (m) => m.MaintenanceComponent,
    ),
  LoginSecurityComponent: () =>
    import("../projects/admin/src/plugins/login-security").then(
      (m) => m.LoginSecurityComponent,
    ),
  ProductionConnectionsComponent: () =>
    import("../projects/admin/src/plugins/production-connections").then(
      (m) => m.ProductionConnectionsComponent,
    ),
  GoogleAdsComponent: () =>
    import("../projects/admin/src/plugins/google-ads").then(
      (m) => m.GoogleAdsComponent,
    ),
  ThemesComponent: () =>
    import("../projects/admin/src/plugins/themes").then(
      (m) => m.ThemesComponent,
    ),
  MediaLibraryComponent: () =>
    import("./media-library.component").then((m) => m.MediaLibraryComponent),
  DashboardComponent: () =>
    import("../projects/admin/src/plugins/dashboard").then(
      (m) => m.DashboardComponent,
    ),
  PagesAdminComponent: () =>
    import("../projects/admin/src/plugins/content").then(
      (m) => m.ContentComponent,
    ),
  PostsAdminComponent: () =>
    import("../projects/admin/src/plugins/content").then(
      (m) => m.ContentComponent,
    ),
  PluginsComponent: () =>
    import("../projects/admin/src/plugins/plugins").then(
      (m) => m.PluginsComponent,
    ),
  SettingsComponent: () =>
    import("../projects/admin/src/plugins/settings").then(
      (m) => m.SettingsComponent,
    ),
  ExtensionComponent: () =>
    import("../projects/admin/src/plugins/extension").then(
      (m) => m.ExtensionComponent,
    ),
};
@Injectable({ providedIn: "root" })
export class PluginRegistryService {
  readonly manifests = PLUGIN_MANIFESTS;
}
