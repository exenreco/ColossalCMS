import { createPluginRegistry } from "./plugin-registry.mjs";
import googleAds from "../plugins/google-ads/renderer.mjs";
import trivia from "../plugins/trivia/renderer.mjs";
import messaging from "../plugins/messaging/renderer.mjs";
export const pluginBlocks = createPluginRegistry([
  googleAds,
  trivia,
  messaging,
]);
