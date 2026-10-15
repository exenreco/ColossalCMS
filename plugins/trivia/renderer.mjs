import { TRIVIA_ID } from "./questions.mjs";
export function renderTrivia(settings, ctx, { esc }) {
  const preview = !!(
    ctx.renderingContentCanvas ||
    ctx.previewToken ||
    ctx.adsPreview
  );
  if (!preview && !ctx.plugins?.some((plugin) => plugin.id === TRIVIA_ID))
    return "";
  const scope = ["default", "all", "pages", "posts", "current"].includes(
    settings.scope,
  )
    ? settings.scope
    : "default";
  const requestedCount = Number(settings.questionCount);
  const count =
    Number.isFinite(requestedCount) && requestedCount > 0
      ? Math.max(1, Math.min(20, Math.floor(requestedCount)))
      : 0;
  const style = settings.answerStyle === "text" ? "text" : "multiple-choice";
  return `<section class="cl-trivia" data-trivia-scope="${scope}" data-trivia-count="${count}" data-trivia-style="${style}" data-trivia-content="${esc(ctx.content?.id || "")}" data-trivia-preview="${preview}"><h3>${esc(String(settings.title || "Test your knowledge").slice(0, 160))}</h3><p class="cl-trivia-intro">${esc(String(settings.description || "How well do you know this site? Complete each statement.").slice(0, 300))}</p><div class="cl-trivia-stage" aria-live="polite"><p>${preview ? "Trivia preview — visitors answer questions from your published pages and posts." : "Loading a new round…"}</p></div></section>`;
}
export const TRIVIA_CSS = `
.theme-root .cl-trivia{border:1px solid #8899aa40;border-radius:20px;padding:28px;background-color:#8899aa0d;color:inherit;max-width:760px}
.theme-root .cl-trivia h3{font-size:24px;line-height:32px;letter-spacing:-0.5px;margin:0 0 12px}
.theme-root .cl-trivia p{font-size:15px;line-height:24px;margin:0 0 18px}
.theme-root .cl-trivia-intro,.theme-root .cl-trivia-source{opacity:0.7}
.theme-root .cl-trivia-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}
.theme-root .cl-trivia button,.theme-root .cl-trivia input{color:inherit;background-color:#8899aa12;border:1px solid #8899aa50;border-radius:10px;padding:12px 16px;font-size:14px;line-height:20px}
.theme-root .cl-trivia button{cursor:pointer}
.theme-root .cl-trivia button:hover{background-color:#8899aa30}
.theme-root .cl-trivia button:disabled{cursor:default;opacity:0.6}
.theme-root .cl-trivia button[aria-pressed=true]{border-color:#56df95}
.theme-root .cl-trivia progress{width:100%;height:6px;margin-bottom:20px}
.theme-root .cl-trivia form{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.theme-root .cl-trivia input{flex:1;min-width:140px}
.theme-root .cl-trivia-result{padding:16px;border:1px solid #8899aa40;border-radius:12px;margin-bottom:18px}
.theme-root .cl-trivia-result.correct{border-color:#56df95;color:#56df95}
.theme-root .cl-trivia-result.incorrect{border-color:#f1a065;color:#f1a065}
.theme-root .cl-trivia-source a{color:inherit}
.theme-root .cl-trivia .cl-trivia-prompt{font-size:18px;line-height:28px;font-weight:600}
@media(max-width:600px){.theme-root .cl-trivia{padding:20px}.theme-root .cl-trivia-options{grid-template-columns:1fr}}
`;
export default {
  id: TRIVIA_ID,
  styles: TRIVIA_CSS,
  blockRenderers: { "trivia/quiz": renderTrivia },
};
