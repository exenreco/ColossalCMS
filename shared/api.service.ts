import { Injectable, signal } from "@angular/core";
import { State } from "./models";
import {
  readWorkspaceStream,
  WorkspaceProgress,
  WORKSPACE_STEPS,
} from "./workspace-progress";
/** Shared API boundary. Server authorization is authoritative. */
@Injectable({ providedIn: "root" })
export class ApiService {
  state = signal<State | null>(null);
  notice = signal("");
  workspacePasswordAuth = signal<boolean | null>(null);
  workspaceProgress = signal<WorkspaceProgress>({
    completed: 0,
    total: WORKSPACE_STEPS.length,
    message: "Connecting to your database and checking your session…",
    phase: "connecting",
  });
  private workspaceLoad?: Promise<{ setup: boolean; passwordAuth: boolean }>;
  private workspaceSession = { setup: false, passwordAuth: false };
  openWorkspace() {
    if (this.workspaceLoad) return this.workspaceLoad;
    if (this.state()) return Promise.resolve(this.workspaceSession);
    this.workspaceProgress.set({
      completed: 0,
      total: WORKSPACE_STEPS.length,
      message: "Connecting to your database and checking your session…",
      phase: "connecting",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const pending = (async () => {
      const response = await fetch("/api/admin/bootstrap", {
        headers: { Accept: "application/x-ndjson" },
        signal: controller.signal,
      });
      const result = await readWorkspaceStream(response, (progress) => {
        this.workspacePasswordAuth.set(progress.passwordAuth === true);
        this.workspaceProgress.set(progress);
      });
      this.workspaceSession = {
        setup: result.setup === true,
        passwordAuth: result.passwordAuth === true,
      };
      if (result.state) this.state.set(result.state);
      return this.workspaceSession;
    })()
      .catch((error) => {
        if (controller.signal.aborted)
          throw new Error(
            "Your database is taking longer than expected. Check the connection and try again.",
          );
        throw error;
      })
      .finally(() => {
        clearTimeout(timeout);
        if (this.workspaceLoad === pending) this.workspaceLoad = undefined;
      });
    this.workspaceLoad = pending;
    return pending;
  }
  async request(path: string, method = "GET", body?: unknown): Promise<any> {
    const response = await fetch("/api" + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(data.error || "Unable to complete this request."),
        { references: data.references },
      );
    return data;
  }
  upload(
    path: string,
    form: FormData,
    onProgress: (value: number) => void,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api" + path);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data: any;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error("The upload could not be processed."));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || "Upload failed."));
      };
      xhr.onerror = () =>
        reject(new Error("The connection was interrupted. Try again."));
      xhr.send(form);
    });
  }
  async load() {
    this.state.set(await this.request("/admin/state"));
  }
  async mutate(path: string, method: string, body: unknown, message: string) {
    const r = await this.request(path, method, body);
    await this.load();
    this.toast(message);
    return r;
  }
  toast(message: string) {
    this.notice.set(message);
    setTimeout(() => this.notice.set(""), 4500);
  }
}
