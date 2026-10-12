import { parse } from "./v2-utils.mjs";
import { GOOGLE_ADS_ID, adDefaults } from "../plugins/google-ads/config.mjs";
export {
  GOOGLE_ADS_ID,
  ADS_BLOCK,
  adDefaults,
  validateAdSettings,
  resolveAdUnit,
} from "../plugins/google-ads/config.mjs";
export async function readAdSettings(db) {
  const row = await db
    .prepare("SELECT value FROM config WHERE id='google-ads'")
    .first();
  return { ...adDefaults, ...parse(row?.value) };
}
export async function adVerification(db) {
  const plugin = await db
    .prepare("SELECT active FROM plugins WHERE id=?")
    .bind(GOOGLE_ADS_ID)
    .first();
  if (!plugin?.active) return { publisher: null, adsTxt: null };
  const settings = await readAdSettings(db);
  const valid = /^ca-pub-\d{16}$/.test(settings.publisherId);
  const custom =
    typeof settings.adsTxtContent === "string" ? settings.adsTxtContent : "";
  return {
    publisher: valid && settings.verificationMeta ? settings.publisherId : null,
    adsTxt:
      settings.adsTxtEnabled && valid
        ? (custom.trim() ||
            `google.com, ${settings.publisherId.slice(3)}, DIRECT, f08c47fec0942fa0`) +
          "\n"
        : null,
  };
}
