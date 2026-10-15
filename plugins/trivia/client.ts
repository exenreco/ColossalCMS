const mounted = new WeakSet<HTMLElement>();
interface Question {
  id: string;
  prompt: string;
  options: string[];
  source: { title: string; url: string };
}
interface Result {
  correct: boolean;
  answer: string;
  explanation: string;
  source: { title: string; url: string };
}
/** Trivia owns its DOM, requests and round score; correctness is checked by the server. */
export function hydrateTrivia(doc: Document) {
  doc.querySelectorAll<HTMLElement>(".cl-trivia").forEach((host) => {
    if (mounted.has(host) || host.dataset["triviaPreview"] === "true") return;
    const stage = host.querySelector<HTMLElement>(".cl-trivia-stage"),
      win = doc.defaultView;
    if (!stage || !win) return;
    mounted.add(host);
    let questions: Question[] = [],
      index = 0,
      score = 0,
      answered = false,
      busy = false,
      disposed = false;
    let controller: AbortController | null = null;
    const scope = host.dataset["triviaScope"] || "default",
      contentId = host.dataset["triviaContent"] || "";
    const node = <K extends keyof HTMLElementTagNameMap>(
      tag: K,
      text = "",
      cls = "",
    ) => {
      const element = doc.createElement(tag);
      element.textContent = text;
      element.className = cls;
      return element;
    };
    const button = (label: string, action: () => void) => {
      const element = node("button", label);
      element.type = "button";
      element.addEventListener("click", action);
      return element;
    };
    const request = async <T>(url: string, body?: unknown): Promise<T> => {
      controller?.abort();
      controller = new AbortController();
      const timeout = win.setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await win.fetch(url, {
          method: body ? "POST" : "GET",
          headers: body ? { "Content-Type": "application/json" } : {},
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Trivia is unavailable. Please try again.",
          );
        return data as T;
      } finally {
        win.clearTimeout(timeout);
      }
    };
    const sourceLink = (source: Question["source"]) => {
      const p = node("p", "Source: ", "cl-trivia-source"),
        a = node("a", source.title);
      if (/^\/(?!\/)/.test(source.url)) a.setAttribute("href", source.url);
      p.append(a);
      return p;
    };
    const submit = async (answer: string, feedback: HTMLElement) => {
      if (busy || answered || !answer.trim()) return;
      busy = true;
      stage.setAttribute("aria-busy", "true");
      stage
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((b) => (b.disabled = true));
      try {
        const result = await request<Result>("/api/trivia/answer", {
          id: questions[index].id,
          answer,
          scope,
          contentId,
        });
        if (disposed || !host.isConnected) return;
        answered = true;
        if (result.correct) score++;
        feedback.className =
          "cl-trivia-result " + (result.correct ? "correct" : "incorrect");
        feedback.replaceChildren(
          node(
            "strong",
            result.correct
              ? "Correct!"
              : "Incorrect. The answer is “" + result.answer + "”.",
          ),
          node("p", result.explanation),
          sourceLink(result.source),
        );
        stage.append(
          button(
            index + 1 === questions.length ? "See results" : "Next question",
            () => {
              index++;
              render();
            },
          ),
        );
      } catch (error) {
        if (!disposed) {
          feedback.textContent = (error as Error).message;
          stage
            .querySelectorAll<HTMLButtonElement>("button")
            .forEach((b) => (b.disabled = false));
          if ((error as Error).message.includes("no longer available"))
            stage.append(button("Start a new round", start));
        }
      } finally {
        busy = false;
        stage.removeAttribute("aria-busy");
      }
    };
    const render = () => {
      stage.replaceChildren();
      answered = false;
      if (index >= questions.length) {
        stage.append(
          node(
            "p",
            `You scored ${score} out of ${questions.length}.`,
            "cl-trivia-prompt",
          ),
          button("Play again", start),
        );
        return;
      }
      const q = questions[index],
        progress = node("progress");
      progress.max = questions.length;
      progress.value = index;
      progress.setAttribute("aria-label", "Round progress");
      const feedback = node("div");
      feedback.setAttribute("role", "status");
      stage.append(
        node("p", `Question ${index + 1} of ${questions.length}`),
        progress,
        node(
          "p",
          `Complete this statement from “${q.source.title}”.`,
          "cl-trivia-source",
        ),
        node("p", q.prompt, "cl-trivia-prompt"),
      );
      if (host.dataset["triviaStyle"] === "text") {
        const form = node("form"),
          input = node("input"),
          check = node("button", "Check answer");
        input.type = "text";
        input.required = true;
        input.maxLength = 200;
        input.autocomplete = "off";
        input.setAttribute("aria-label", "Your answer");
        input.placeholder = "Type the missing word…";
        check.type = "submit";
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          void submit(input.value, feedback);
        });
        form.append(input, check);
        stage.append(form);
      } else {
        const options = node("div", "", "cl-trivia-options");
        for (const option of q.options) {
          const answerButton = button(option, () => {
            answerButton.setAttribute("aria-pressed", "true");
            void submit(option, feedback);
          });
          options.append(answerButton);
        }
        stage.append(options);
      }
      stage.append(feedback);
    };
    async function start() {
      if (busy || disposed) return;
      busy = true;
      stage!.replaceChildren(node("p", "Loading a new round…"));
      try {
        const query = new URLSearchParams({
          scope,
          contentId,
        });
        if (Number(host.dataset["triviaCount"]) > 0)
          query.set("count", host.dataset["triviaCount"]!);
        const data = await request<{ questions: Question[] }>(
          "/api/trivia/questions?" + query,
        );
        if (disposed || !host.isConnected) return;
        questions = data.questions;
        index = score = 0;
        if (!questions.length)
          stage!.replaceChildren(
            node(
              "p",
              "There aren’t enough published statements for trivia yet.",
            ),
            button("Try again", start),
          );
        else render();
      } catch (error) {
        if (!disposed)
          stage!.replaceChildren(
            node("p", (error as Error).message),
            button("Try again", start),
          );
      } finally {
        busy = false;
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
    stage.replaceChildren(button("Start trivia", start));
  });
}
