const mounted = new WeakSet<HTMLElement>();
export function hydrateProtectedFiles(doc: Document) {
  for (const host of Array.from(
    doc.querySelectorAll<HTMLElement>(".cl-protected-file"),
  )) {
    if (mounted.has(host) || host.dataset["protectedPreview"] === "true")
      continue;
    const trigger = host.querySelector<HTMLButtonElement>("button"),
      win = doc.defaultView;
    const id = host.dataset["protectedFile"];
    if (!trigger || !win || !id) continue;
    mounted.add(host);
    let dialog: HTMLDialogElement | null = null,
      controller: AbortController | null = null;
    const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
      const el = doc.createElement(tag);
      el.textContent = text;
      return el;
    };
    const dispose = () => {
      controller?.abort();
      dialog?.remove();
      dialog = null;
      observer.disconnect();
      win.removeEventListener("pagehide", dispose);
    };
    const observer = new MutationObserver(() => {
      if (!host.isConnected) dispose();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    win.addEventListener("pagehide", dispose, { once: true });
    trigger.addEventListener("click", () => {
      if (dialog) {
        dialog.focus();
        return;
      }
      dialog = node("dialog");
      dialog.className = "cl-protected-dialog";
      const heading = node("h2", "Protected download"),
        explanation = node(
          "p",
          "Enter the file password to download a protected copy.",
        ),
        form = node("form"),
        label = node("label", "Password"),
        input = node("input"),
        error = node("p"),
        actions = node("div"),
        cancel = node("button", "Cancel"),
        submit = node("button", "Download");
      const headingId = "protected-heading-" + win.crypto.randomUUID();
      heading.id = headingId;
      dialog.setAttribute("aria-labelledby", headingId);
      input.type = "password";
      input.required = true;
      input.autocomplete = "current-password";
      label.append(input);
      error.className = "cl-protected-error";
      error.setAttribute("role", "alert");
      actions.className = "cl-protected-dialog-actions";
      cancel.type = "button";
      submit.type = "submit";
      actions.append(cancel, submit);
      form.append(label, error, actions);
      dialog.append(heading, explanation, form);
      doc.body.append(dialog);
      cancel.addEventListener("click", () => dialog?.close());
      dialog.addEventListener(
        "close",
        () => {
          controller?.abort();
          dialog?.remove();
          dialog = null;
          trigger.focus();
        },
        { once: true },
      );
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submit.disabled) return;
        submit.disabled = true;
        error.textContent = "";
        submit.textContent = "Checking…";
        controller = new AbortController();
        const activeDialog = dialog,
          timeout = win.setTimeout(() => controller?.abort(), 60000);
        try {
          const response = await win.fetch(
            "/api/protected-files/" + encodeURIComponent(id) + "/download",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: input.value }),
              signal: controller.signal,
            },
          );
          input.value = "";
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Unable to download this file.");
          }
          const blob = await response.blob();
          if (!host.isConnected || dialog !== activeDialog) return;
          const url = win.URL.createObjectURL(blob),
            anchor = node("a");
          const disposition = response.headers.get("Content-Disposition") || "",
            filename = disposition.split("filename*=UTF-8''")[1];
          anchor.href = url;
          anchor.download = filename
            ? decodeURIComponent(filename)
            : "download";
          doc.body.append(anchor);
          anchor.click();
          anchor.remove();
          win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
          dialog?.close();
        } catch (e) {
          if (dialog === activeDialog)
            error.textContent =
              (e as Error).name === "AbortError"
                ? "Download cancelled or timed out. Please try again."
                : (e as Error).message;
        } finally {
          win.clearTimeout(timeout);
          submit.disabled = false;
          submit.textContent = "Download";
        }
      });
      dialog.showModal();
      input.focus();
    });
  }
}
