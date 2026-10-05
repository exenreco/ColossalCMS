import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { ApiService } from "../../../../shared/api.service";
@Component({
  selector: "cl-extension",
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `<div class="page-heading">
      <div>
        <p class="eyebrow">YOUR EXTENSIONS</p>
        <h1>
          {{ reading ? "Time well spent." : "Something worth announcing." }}
        </h1>
        <p>
          {{
            reading
              ? "Give every story a little context before the first word."
              : "One short message, right where your visitors will see it."
          }}
        </p>
      </div>
    </div>
    @if (!enabled) {
      <section class="panel empty-cell">
        <h2>This extension is inactive</h2>
        <a class="button primary" routerLink="/plugins">Manage plugins</a>
      </section>
    } @else if (reading) {
      <section class="panel settings-panel">
        <div class="form-content">
          <h2>Reading time is active</h2>
          <p>
            Your public posts show an estimated reading time, calculated at 200
            words per minute. It updates automatically as you write.
          </p>
          <a class="button" href="/" target="_blank">See it on your site</a>
        </div>
      </section>
    } @else {
      <form class="panel settings-panel" (ngSubmit)="save()">
        <div class="form-content">
          <label
            >Announcement text<textarea
              name="announcement"
              [(ngModel)]="announcement"
              maxlength="240"
              rows="3"
              required
            ></textarea
            ><small
              >This message appears above the public site header.</small
            ></label
          >
          @if (error) {
            <p class="error" role="alert">{{ error }}</p>
          }
          <button class="button primary" [disabled]="busy">
            {{ busy ? "Saving…" : "Save announcement" }}
          </button>
        </div>
      </form>
    }`,
})
export class ExtensionComponent {
  api = inject(ApiService);
  router = inject(Router);
  reading = this.router.url.includes("reading-time");
  announcement = this.api.state()!.settings.announcement;
  busy = false;
  error = "";
  get enabled() {
    return (
      this.api.state()!.user.role === "admin" &&
      this.api
        .state()!
        .plugins.some(
          (p) =>
            p.active &&
            p.id.endsWith(this.reading ? "reading-time" : "announcement"),
        )
    );
  }
  async save() {
    this.busy = true;
    try {
      await this.api.mutate(
        "/admin/settings",
        "POST",
        { ...this.api.state()!.settings, announcement: this.announcement },
        "Announcement saved.",
      );
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
}
