import { createPluginRegistry } from "./plugin-registry.mjs";
import googleAds from "../plugins/google-ads/renderer.mjs";
export const pluginBlocks = createPluginRegistry([googleAds]);
