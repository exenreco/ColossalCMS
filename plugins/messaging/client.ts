const mounted = new WeakSet<HTMLElement>();
interface Field {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  options: string[];
}
interface FormData {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  fields: Field[];
  token: string;
}
/** The plugin hydrates its own form; the server owns configuration, validation and delivery. */
export function hydrateMessaging(doc: Document) {
  doc.querySelectorAll<HTMLElement>(".cl-messaging").forEach((host) => {
    if (mounted.has(host) || host.dataset["messagingPreview"] === "true")
      return;
    const stage = host.querySelector<HTMLElement>(".cl-messaging-stage"),
      win = doc.defaultView;
    if (!stage || !win) return;
    mounted.add(host);
    let disposed = false,
      controller: AbortController | null = null;
    const node = <K extends keyof HTMLElementTagNameMap>(
      tag: K,
      text = "",
      cls = "",
    ) => {
      const el = doc.createElement(tag);
      el.textContent = text;
      el.className = cls;
      return el;
    };
    const request = async <T>(path: string, body?: unknown): Promise<T> => {
      controller?.abort();
      controller = new AbortController();
      const timeout = win.setTimeout(() => controller?.abort(), 30000);
      try {
        const response = await win.fetch(path, {
          method: body ? "POST" : "GET",
          headers: body ? { "Content-Type": "application/json" } : {},
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Unable to send your message. Please try again.",
          );
        return data as T;
      } finally {
        win.clearTimeout(timeout);
      }
    };
    const retry = () => {
      const button = node("button", "Reload form");
      button.type = "button";
      button.addEventListener("click", () => void load());
      return button;
    };
    async function load() {
      stage!.replaceChildren(node("p", "Loading the message form…"));
      try {
        const config = await request<FormData>("/api/messaging/form");
        if (disposed || !host.isConnected) return;
        host.querySelector("h3")!.textContent =
          host.dataset["messagingTitle"] || config.title;
        host.querySelector(".cl-messaging-intro")!.textContent =
          host.dataset["messagingDescription"] || config.description;
        const form = node("form"),
          fields = node("div", "", "cl-messaging-fields"),
          controls = new Map<
            string,
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          >();
        for (const field of config.fields) {
          const label = node(
              "label",
              "",
              "cl-messaging-field" +
                (field.type === "textarea" ? " cl-messaging-wide" : "") +
                (field.type === "checkbox" ? " cl-messaging-check" : ""),
            ),
            caption = node("span", field.label + (field.required ? " *" : ""));
          let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          if (field.type === "textarea") {
            input = node("textarea");
            input.maxLength = 5000;
            input.placeholder = field.placeholder;
          } else if (field.type === "select") {
            input = node("select");
            const blank = node(
              "option",
              field.placeholder || "Select an option",
            );
            blank.value = "";
            input.append(blank);
            for (const value of field.options) {
              const option = node("option", value);
              option.value = value;
              input.append(option);
            }
          } else {
            input = node("input");
            input.type = field.type;
            input.maxLength = field.type === "email" ? 254 : 1000;
            if (field.type === "number") input.step = "any";
            input.placeholder = field.placeholder;
          }
          input.name = field.key;
          input.required = field.required;
          controls.set(field.key, input);
          if (field.type === "checkbox") label.append(input, caption);
          else label.append(caption, input);
          fields.append(label);
        }
        const trap = node("input");
        trap.name = "website";
        trap.type = "text";
        trap.tabIndex = -1;
        trap.autocomplete = "off";
        trap.className = "cl-messaging-honeypot";
        trap.setAttribute("aria-hidden", "true");
        const submit = node("button", config.submitLabel);
        submit.type = "submit";
        const error = node("p", "", "cl-messaging-error");
        error.setAttribute("role", "alert");
        form.append(fields, trap, error, submit);
        stage!.replaceChildren(form);
        let busy = false;
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (busy) return;
          busy = true;
          submit.disabled = true;
          submit.textContent = "Sending…";
          error.textContent = "";
          const values: Record<string, string | boolean> = {};
          for (const field of config.fields) {
            const control = controls.get(field.key)!;
            values[field.key] =
              field.type === "checkbox"
                ? (control as HTMLInputElement).checked
                : control.value;
          }
          try {
            const result = await request<{ message: string }>(
              "/api/messaging/submit",
              {
                token: config.token,
                website: trap.value,
                values,
                sourcePath: win!.location.pathname,
              },
            );
            if (disposed) return;
            const success = node("p", result.message, "cl-messaging-success");
            success.setAttribute("role", "status");
            const another = node("button", "Send another message");
            another.type = "button";
            another.addEventListener("click", () => void load());
            stage!.replaceChildren(success, another);
          } catch (e) {
            if (!disposed) {
              error.textContent = (e as Error).message;
              if (
                (e as Error).message.includes("expired") ||
                (e as Error).message.includes("already submitted")
              )
                form.append(retry());
            }
          } finally {
            busy = false;
            submit.disabled = false;
            submit.textContent = config.submitLabel;
          }
        });
      } catch (e) {
        if (!disposed)
          stage!.replaceChildren(
            node("p", (e as Error).message, "cl-messaging-error"),
            retry(),
          );
      }
    }
    const observer = new MutationObserver(() => {
      if (!host.isConnected) dispose();
    });
    function dispose() {
      if (disposed) return;
      disposed = true;
      controller?.abort();
      observer.disconnect();
      win!.removeEventListener("pagehide", dispose);
    }
    observer.observe(doc.body, { childList: true, subtree: true });
    win.addEventListener("pagehide", dispose, { once: true });
    void load();
  });
}
