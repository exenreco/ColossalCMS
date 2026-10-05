import themes from "./themes/plugin.manifest.json" with { type: "json" };
import media from "./media/plugin.manifest.json" with { type: "json" };
import dashboard from "./dashboard/plugin.manifest.json" with { type: "json" };
import pages from "./pages/plugin.manifest.json" with { type: "json" };
import posts from "./posts/plugin.manifest.json" with { type: "json" };
import plugins from "./plugins/plugin.manifest.json" with { type: "json" };
import settings from "./settings/plugin.manifest.json" with { type: "json" };
import reading_time from "./reading-time/plugin.manifest.json" with { type: "json" };
import announcement from "./announcement/plugin.manifest.json" with { type: "json" };
import google_ads from "./google-ads/plugin.manifest.json" with { type: "json" };
import production_connections from "./production-connections/plugin.manifest.json" with { type: "json" };
export const manifests = [
  themes,
  media,
  dashboard,
  pages,
  posts,
  plugins,
  settings,
  reading_time,
  announcement,
  google_ads,
  production_connections,
];
