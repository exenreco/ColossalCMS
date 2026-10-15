import aiAssistant from "../plugins/ai-assistant/server.mjs";
import { createPluginRegistry } from "./plugin-registry.mjs";
import maintenance from "../plugins/maintenance/server.mjs";
import googleAds from "../plugins/google-ads/server.mjs";
import seo from "../plugins/seo/server.mjs";
import connections from "../plugins/production-connections/server.mjs";
import loginSecurity from "../plugins/login-security/server.mjs";
import settings from "../plugins/settings/server.mjs";
import trivia from "../plugins/trivia/server.mjs";
import messaging from "../plugins/messaging/server.mjs";
import lazyLoad from "../plugins/lazy-load/server.mjs";

// The composition root is the only place that knows which reviewed integrations are bundled.
export const pluginRuntime = createPluginRegistry([
  lazyLoad,
  messaging,
  trivia,
  aiAssistant,
  maintenance,
  googleAds,
  seo,
  connections,
  loginSecurity,
  settings,
]);
