export function renderProtectedFile(settings, context, esc) {
  const id =
    typeof settings.downloadId === "string" &&
    /^[a-f0-9-]{36}$/.test(settings.downloadId)
      ? settings.downloadId
      : "";
  const preview = !!(
    context.renderingContentCanvas ||
    context.previewToken ||
    context.adsPreview
  );
  return `<div class="cl-protected-file" data-protected-file="${esc(id)}" data-protected-preview="${preview}"><button type="button"${!id || preview ? " disabled" : ""}>${esc(String(settings.label || "Download file").slice(0, 200))}</button>${preview && !id ? "<small>Choose a file and set its password in the Inspector.</small>" : ""}</div>`;
}
export const PROTECTED_FILE_CSS = `
.theme-root .cl-protected-file>button{cursor:pointer;color:inherit;background:#8899aa20;border:1px solid #8899aa50;border-radius:10px;padding:12px 20px;font:inherit}
.theme-root .cl-protected-file>button:disabled{cursor:default;opacity:.6}
.theme-root .cl-protected-file small{display:block;font-size:12px;margin-top:8px}
.cl-protected-dialog{position:fixed;inset:0;margin:auto;width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:28px;border:1px solid #8899aa50;border-radius:18px;background:#17191bf5;color:#f1f2f4;box-shadow:0 24px 80px #0008;font:14px/1.5 sans-serif;z-index:2147483000}
.cl-protected-dialog::backdrop{background:#0009;backdrop-filter:blur(8px)}
.cl-protected-dialog[open]>h2[id]{font-size:22px;line-height:1.35;letter-spacing:0;margin:0 0 12px}.cl-protected-dialog label{display:flex;flex-direction:column;gap:8px}.cl-protected-dialog input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #8899aa60;border-radius:8px;background:#ffffff0a;color:inherit;font:inherit}.cl-protected-dialog-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}.cl-protected-dialog button{font:inherit;color:inherit;padding:10px 16px;border:1px solid #8899aa60;border-radius:8px;background:#ffffff0a;cursor:pointer}.cl-protected-error{color:#f1a065}
`;
