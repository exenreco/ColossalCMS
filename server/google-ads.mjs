import { fail, parse } from "./v2-utils.mjs";

export const GOOGLE_ADS_ID = "com.colossal.google-ads";
export const ADS_BLOCK = "google-ads/ad";
export const adDefaults = {
  publisherId: "",
  slotId: "",
  format: "auto",
  sizing: "responsive",
  width: 300,
  height: 250,
  liveAds: false,
};
const formats = ["auto", "horizontal", "rectangle", "vertical"];
export function validateAdSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail("Check the Google Ads settings.");
  const publisherId = String(input.publisherId || "")
    .trim()
    .replace(/^pub-/, "ca-pub-");
  const slotId = String(input.slotId || "").trim();
  if (publisherId && !/^ca-pub-\d{16}$/.test(publisherId))
    fail("Enter an AdSense publisher ID such as ca-pub-1234567890123456.");
  if (slotId && !/^\d{1,20}$/.test(slotId))
    fail("Enter the numeric ad slot ID from your AdSense ad unit.");
  if (
    !formats.includes(input.format) ||
    !["responsive", "fixed"].includes(input.sizing)
  )
    fail("Choose a valid ad format and sizing mode.");
  for (const key of ["width", "height"])
    if (!Number.isInteger(input[key]) || input[key] < 50 || input[key] > 2000)
      fail("Ad dimensions must be whole numbers between 50 and 2000 pixels.");
  if (typeof input.liveAds !== "boolean")
    fail("Choose whether live ads are enabled.");
  if (input.liveAds && (!publisherId || !slotId))
    fail("Add a publisher ID and default ad slot before enabling live ads.");
  return {
    publisherId,
    slotId,
    format: input.format,
    sizing: input.sizing,
    width: input.width,
    height: input.height,
    liveAds: input.liveAds,
  };
}
export async function readAdSettings(db) {
  const row = await db
    .prepare("SELECT value FROM config WHERE id='google-ads'")
    .first();
  return { ...adDefaults, ...parse(row?.value) };
}
export function resolveAdUnit(config, block = {}) {
  const settings = { ...adDefaults, ...config };
  const slotId = String(block.slotId || settings.slotId).trim();
  if (
    !/^ca-pub-\d{16}$/.test(settings.publisherId) ||
    !/^\d{1,20}$/.test(slotId)
  )
    return null;
  const sizing = ["responsive", "fixed"].includes(block.sizing)
    ? block.sizing
    : settings.sizing;
  return {
    publisherId: settings.publisherId,
    slotId,
    format: formats.includes(block.format) ? block.format : settings.format,
    sizing,
    width: Math.max(
      50,
      Math.min(
        2000,
        Number(
          block.sizing === "fixed"
            ? block.width || settings.width
            : settings.width,
        ) || 300,
      ),
    ),
    height: Math.max(
      50,
      Math.min(
        2000,
        Number(
          block.sizing === "fixed"
            ? block.height || settings.height
            : settings.height,
        ) || 250,
      ),
    ),
    liveAds: settings.liveAds === true,
  };
}
