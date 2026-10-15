import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "../../shared/api.service";
interface TriviaSettings {
  enabled: boolean;
  scope: string;
  questionCount: number;
  excludedIds: string[];
}
@Component({
  selector: "cl-trivia-admin",
  standalone: true,
  imports: [FormsModule],
  styles: `
    .trivia-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      align-items: start;
    }
    .trivia-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .trivia-toggle input {
      width: auto;
      margin: 0;
    }
    .trivia-sources {
      max-height: 320px;
      overflow: auto;
      margin: 16px 0;
    }
    .trivia-sources label {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
    }
    .trivia-sources input {
      width: auto;
    }
    .trivia-preview {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .trivia-preview p {
      line-height: 1.6;
    }
    .trivia-preview small {
      color: var(--muted);
    }
    @media (max-width: 800px) {
      .trivia-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">TRIVIA</p>
        <h1>Turn your content into a quiz.</h1>
        <p>
          Questions use statements from your published pages and posts. No AI
          provider is required.
        </p>
      </div>
      <a class="button" href="/" target="_blank" rel="noopener">Visit site ↗</a>
    </div>
    @if (error) {
      <p class="notice" role="alert">{{ error }}</p>
    }
    @if (notice) {
      <p class="notice" role="status">{{ notice }}</p>
    }
    <div class="trivia-grid">
      <section class="panel">
        <div class="form-content">
          <h2>Trivia settings</h2>
          <label class="trivia-toggle admin-checkbox-row"
            ><input type="checkbox" [(ngModel)]="settings.enabled" /><span
              >Enable trivia</span
            ></label
          >
          <label
            >Content sources<select [(ngModel)]="settings.scope">
              <option value="all">Pages and posts</option>
              <option value="pages">Pages only</option>
              <option value="posts">Posts only</option>
            </select></label
          >
          <label
            >Default questions per round<input
              type="number"
              min="1"
              max="20"
              [(ngModel)]="settings.questionCount"
          /></label>
          <p class="field-note">
            Block controls can narrow sources to posts, pages, or the current
            content. The source restriction set here always applies.
          </p>
          <h3>Exclude content</h3>
          <p class="field-note">
            Checked items won’t be used to generate questions.
          </p>
          <div class="trivia-sources">
            @for (source of sources; track source.id) {
              <label class="admin-checkbox-row"
                ><input
                  type="checkbox"
                  [ngModel]="settings.excludedIds.includes(source.id)"
                  (ngModelChange)="exclude(source.id, $event)"
                /><span
                  >{{ source.title }} <small>({{ source.kind }})</small></span
                ></label
              >
            }
          </div>
          <button class="button primary" [disabled]="busy" (click)="save()">
            {{ busy ? "Saving…" : "Save Trivia settings" }}
          </button>
        </div>
      </section>
      <section class="panel">
        <div class="form-content">
          <h2>Question bank</h2>
          <p>
            <strong>{{ available }}</strong> questions available from your
            current published content.
          </p>
          <p class="field-note">
            The bank refreshes as content changes. Visitors complete a missing
            word, receive correct/incorrect feedback and a source link, then see
            their round score. Their responses aren’t stored.
          </p>
          <h3>Preview</h3>
          @for (question of preview; track question.id) {
            <div class="trivia-preview">
              <small>{{ question.source.title }}</small>
              <p>{{ question.prompt }}</p>
              <small>{{ question.options.join(" · ") }}</small>
            </div>
          } @empty {
            <p class="field-note">
              Add published content with complete sentences to generate trivia.
            </p>
          }
          <button class="button" [disabled]="busy" (click)="load()">
            Refresh preview
          </button>
          <h3>Add to your site</h3>
          <p class="field-note">
            Open a theme, page or post editor and add
            <strong>Trivia</strong> from the Plugin category. Its Inspector
            controls the heading, introduction, sources, round length and answer
            style.
          </p>
        </div>
      </section>
    </div>
  `,
})
export class TriviaComponent implements OnInit {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  settings: TriviaSettings = {
    enabled: true,
    scope: "all",
    questionCount: 5,
    excludedIds: [],
  };
  sources: { id: string; title: string; kind: string }[] = [];
  preview: {
    id: string;
    prompt: string;
    options: string[];
    source: { title: string };
  }[] = [];
  available = 0;
  busy = false;
  error = "";
  notice = "";
  ngOnInit() {
    void this.load();
  }
  exclude(id: string, excluded: boolean) {
    this.settings.excludedIds = excluded
      ? [...new Set([...this.settings.excludedIds, id])]
      : this.settings.excludedIds.filter((value) => value !== id);
  }
  async load() {
    this.error = "";
    try {
      const data = await this.api.request("/admin/trivia");
      this.settings = data.settings;
      this.sources = data.sources;
      this.preview = data.preview;
      this.available = data.available;
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  async save() {
    this.busy = true;
    this.notice = "";
    this.error = "";
    try {
      await this.api.request("/admin/trivia", "POST", this.settings);
      await this.load();
      this.notice = "Trivia settings saved.";
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
