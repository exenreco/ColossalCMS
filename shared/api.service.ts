import { Injectable, signal } from "@angular/core";
import { State } from "./models";
/** Shared API boundary. Server authorization is authoritative. */
@Injectable({ providedIn: "root" })
export class ApiService {
  state = signal<State | null>(null);
  notice = signal("");
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
