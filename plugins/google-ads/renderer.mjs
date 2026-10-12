import { ADS_BLOCK, GOOGLE_ADS_ID, resolveAdUnit } from "./config.mjs";
export function renderAdsBlock(s, ctx, { esc }) {
  const preview = !!(
    ctx.adsPreview ||
    ctx.renderingContentCanvas ||
    ctx.previewToken
  );
  const active = ctx.plugins?.some((p) => p.id === GOOGLE_ADS_ID);
  if (!active && !preview) return "";
  const unit = resolveAdUnit(ctx.adSettings, s);
  if (!unit && !preview) return "";
  if (preview || !unit?.liveAds) {
    const message = !active
      ? "Google Ads plugin is inactive"
      : !unit
        ? "Configure the publisher and ad slot in Google Ads"
        : `Ad preview · ${unit.format} · slot ${unit.slotId}`;
    return `<aside class="cl-ad-preview" aria-label="Advertisement preview" style="height:${unit?.sizing === "fixed" ? unit.height : 180}px"><strong>Advertisement</strong><p>${esc(message)}</p></aside>`;
  }
  return `<aside class="cl-ad-unit" aria-label="Advertisement"><span class="cl-ad-label">Advertisement</span><div class="cl-google-ad" data-google-ad-client="${esc(unit.publisherId)}" data-google-ad-slot="${esc(unit.slotId)}" data-google-ad-format="${esc(unit.format)}" data-google-ad-sizing="${esc(unit.sizing)}" data-google-ad-width="${unit.width}" data-google-ad-height="${unit.height}"></div></aside>`;
}

export default {
  id: GOOGLE_ADS_ID,
  blockRenderers: { [ADS_BLOCK]: renderAdsBlock },
};
