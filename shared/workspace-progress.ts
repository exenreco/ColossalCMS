import type { State } from "./models";

export const WORKSPACE_STEPS = [
  {
    label: "Themes",
    message: "Checking installed themes and template updates…",
  },
  {
    label: "Plugins",
    message: "Registering core plugins and checking their settings…",
  },
  {
    label: "Site data",
    message: "Preparing site settings and built-in content…",
  },
  {
    label: "Dashboard",
    message: "Loading your content, media, and workspace settings…",
  },
] as const;

export interface WorkspaceProgress {
  completed: number;
  total: number;
  message: string;
  phase: "connecting" | "working" | "ready";
  passwordAuth?: boolean;
}

interface WorkspaceResult {
  setup?: boolean;
  passwordAuth?: boolean;
  state?: State;
}

/** Consume real server milestones, including messages split across network chunks. */
export async function readWorkspaceStream(
  response: Response,
  report: (progress: WorkspaceProgress) => void,
): Promise<WorkspaceResult> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || "Unable to prepare your workspace. Try again.",
    );
  }
  if (
    !response.headers.get("Content-Type")?.startsWith("application/x-ndjson")
  ) {
    const data = await response.json();
    if (data.setup === true) return data;
    throw new Error(
      "The workspace progress response was not recognized. Try again.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader)
    throw new Error("Workspace progress was interrupted. Try again.");
  const decoder = new TextDecoder();
  let pending = "",
    completed = 0;
  let result: WorkspaceResult | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error")
      throw new Error(
        event.message || "Unable to prepare your workspace. Try again.",
      );
    if (event.type === "progress") {
      if (
        !Number.isInteger(event.completed) ||
        event.completed < completed ||
        event.completed > WORKSPACE_STEPS.length ||
        event.total !== WORKSPACE_STEPS.length ||
        typeof event.message !== "string"
      )
        throw new Error("Workspace progress was interrupted. Try again.");
      completed = event.completed;
      report({
        completed,
        total: event.total,
        message: event.message,
        phase: completed === event.total ? "ready" : "working",
        passwordAuth: event.passwordAuth === true,
      });
    } else if (
      event.type === "complete" &&
      event.state?.user &&
      Array.isArray(event.state.plugins)
    ) {
      result = {
        state: event.state,
        passwordAuth: event.passwordAuth === true,
      };
    }
  };
  try {
    while (true) {
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      lines.forEach(consume);
      if (chunk.done) break;
    }
    if (pending.trim()) consume(pending);
    if (!result || completed !== WORKSPACE_STEPS.length)
      throw new Error("Workspace progress was interrupted. Try again.");
    return result;
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof SyntaxError)
      throw new Error("Workspace progress was interrupted. Try again.");
    throw error;
  } finally {
    reader.releaseLock();
  }
}
