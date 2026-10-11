/** Mirror Body appearance and apply shared editor scrollbars inside the iframe. */
export function syncEditorCanvasAppearance(frame?: HTMLIFrameElement) {
  const doc = frame?.contentDocument;
  const canvas = frame?.closest<HTMLElement>(".shared-editor-canvas");
  if (!doc?.body || !doc.defaultView || !canvas) return;
  const background = doc.defaultView.getComputedStyle(doc.body).background;
  if (
    canvas.style.getPropertyValue("--editor-preview-background") !== background
  )
    canvas.style.setProperty("--editor-preview-background", background);
  const editor = frame!.closest<HTMLElement>(".shared-editor");
  if (!editor) return;
  const editorStyle = getComputedStyle(editor);
  for (const [target, source] of [
    ["--cl-editor-scrollbar", "--editor-border"],
    ["--cl-editor-scrollbar-track", "--editor-bg"],
    ["--cl-editor-bg", "--editor-bg"],
    ["--cl-editor-surface", "--editor-panel"],
    ["--cl-editor-text", "--editor-text"],
    ["--cl-editor-muted", "--editor-muted"],
    ["--cl-editor-border", "--editor-border"],
  ]) {
    const value = editorStyle.getPropertyValue(source).trim();
    if (doc.documentElement.style.getPropertyValue(target) !== value)
      doc.documentElement.style.setProperty(target, value);
  }
  const light = editor.dataset["colorMode"] === "light";
  for (const [token, colors] of Object.entries({
    tag: ["#95cbb8", "#22664e"],
    attribute: ["#bac3f3", "#435b9b"],
    string: ["#e0bb87", "#94622a"],
    value: ["#cdade2", "#79509a"],
  }))
    doc.documentElement.style.setProperty(
      "--cl-editor-code-" + token,
      colors[light ? 1 : 0],
    );
  if (!doc.getElementById("cl-editor-scrollbars")) {
    const style = doc.createElement("style");
    style.id = "cl-editor-scrollbars";
    style.textContent = `:root,*{scrollbar-width:thin!important;scrollbar-color:var(--cl-editor-scrollbar) var(--cl-editor-scrollbar-track)!important}
      ::-webkit-scrollbar{width:5px!important;height:5px!important}
      ::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:var(--cl-editor-scrollbar-track)!important}
      ::-webkit-scrollbar-thumb{background:var(--cl-editor-scrollbar)!important;border-radius:8px!important}
      ::-webkit-scrollbar-button{display:none!important;width:0!important;height:0!important}
      @supports selector(::-webkit-scrollbar){:root,*{scrollbar-width:auto!important;scrollbar-color:auto!important}}`;
    doc.head.append(style);
  }
}
