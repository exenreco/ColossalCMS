import { MESSAGING_ID } from "./config.mjs";
export function renderMessaging(s, ctx, { esc }) {
  const preview = !!(
    ctx.renderingContentCanvas ||
    ctx.previewToken ||
    ctx.adsPreview
  );
  if (!preview && !ctx.plugins?.some((p) => p.id === MESSAGING_ID)) return "";
  return `<section class="cl-messaging cl-messaging-columns-${s.columns === 2 || s.columns === "2" ? 2 : 1}" data-messaging-preview="${preview}" data-messaging-title="${esc(String(s.title || "").slice(0, 160))}" data-messaging-description="${esc(String(s.description || "").slice(0, 500))}"><h3>${esc(s.title || "Send us a message")}</h3><p class="cl-messaging-intro">${esc(s.description || "Have a question or an idea? We’d love to hear from you.")}</p><div class="cl-messaging-stage" aria-live="polite"><p>${preview ? "Messaging form preview — configure fields in the Messaging plugin." : "Loading the message form…"}</p></div></section>`;
}
export const MESSAGING_CSS = `
.theme-root .cl-messaging{width:100%;padding:28px;border:1px solid #8899aa40;border-radius:20px;background-color:#8899aa0d;color:inherit}
.theme-root .cl-messaging h3{font-size:24px;line-height:32px;letter-spacing:-0.5px;margin:0 0 12px}
.theme-root .cl-messaging p{font-size:14px;line-height:22px;margin:0 0 20px}
.theme-root .cl-messaging-fields{display:grid;grid-template-columns:1fr;gap:20px;margin-bottom:24px}
.theme-root .cl-messaging-columns-2 .cl-messaging-fields{grid-template-columns:1fr 1fr}
.theme-root .cl-messaging-field{display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:22px;min-width:0}
.theme-root .cl-messaging-wide{grid-column:1/-1}
.theme-root .cl-messaging-check{flex-direction:row;align-items:center}
.theme-root .cl-messaging input,.theme-root .cl-messaging select,.theme-root .cl-messaging textarea{width:100%;background-color:#8899aa12;color:inherit;border:1px solid #8899aa50;padding:12px 14px;border-radius:10px;font:inherit}
.theme-root .cl-messaging textarea{min-height:160px;resize:vertical}
.theme-root .cl-messaging input[type=checkbox]{width:auto}
.theme-root .cl-messaging button{padding:13px 24px;border:1px solid #8899aa50;border-radius:10px;background-color:#8899aa20;color:inherit;cursor:pointer;font:inherit}
.theme-root .cl-messaging button:disabled{opacity:0.6;cursor:default}
.theme-root .cl-messaging-honeypot{display:none}
.theme-root .cl-messaging-error{color:#e99874}
.theme-root .cl-messaging-success{padding:20px;border:1px solid #56df9540;border-radius:12px;color:#56df95}
@media(max-width:640px){.theme-root .cl-messaging{padding:20px}.theme-root .cl-messaging-columns-2 .cl-messaging-fields{grid-template-columns:1fr}}
`;
export default {
  id: MESSAGING_ID,
  styles: MESSAGING_CSS,
  blockRenderers: { "messaging/form": renderMessaging },
};
