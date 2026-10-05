import { Component, Input, Output, EventEmitter, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DatePipe, DecimalPipe } from "@angular/common";
import { ApiService } from "./api.service";
import { MediaItem } from "./models";
import { IconComponent } from "./icon.component";
import { DialogFocusDirective } from "./dialog-focus.directive";
import { GltfViewerComponent } from "./gltf-viewer.component";
@Component({
  selector: "cl-media-library",
  standalone: true,
  imports: [
    GltfViewerComponent,
    FormsModule,
    DatePipe,
    DecimalPipe,
    IconComponent,
    DialogFocusDirective,
  ],
  template: `
    @if (!picker) {
      <div class="page-heading">
        <div>
          <p class="eyebrow">YOUR CREATIVE LIBRARY</p>
          <h1>A home for every asset.</h1>
          <p>
            Images, sounds, and stories in motion. Ready when you need them.
          </p>
        </div>
        <button class="button primary" (click)="uploadOpen = true">
          <cl-icon name="plus" />Upload media
        </button>
      </div>
    }
    <section class="panel media-library">
      <div class="content-toolbar">
        <div class="tabs" aria-label="Media type">
          @for (type of types; track type.value) {
            @if (
              !accept.length ||
              type.value === "all" ||
              accept.includes($any(type.value))
            ) {
              <button
                [class.selected]="filter === type.value"
                (click)="filter = type.value"
              >
                {{ type.label }}
              </button>
            }
          }
        </div>
        <div class="media-tools">
          <label class="search-field"
            ><cl-icon name="search" /><input
              [(ngModel)]="search"
              placeholder="Search name, alt text, or tags"
              aria-label="Search media" /></label
          ><button
            class="icon-button"
            [class.selected]="view === 'grid'"
            aria-label="Grid view"
            (click)="view = 'grid'"
          >
            <cl-icon name="dashboard" /></button
          ><button
            class="icon-button"
            [class.selected]="view === 'list'"
            aria-label="List view"
            (click)="view = 'list'"
          >
            <cl-icon name="menu" />
          </button>
          @if (picker) {
            <button class="button small" (click)="uploadOpen = true">
              Upload
            </button>
          }
        </div>
      </div>
      @if (error) {
        <p class="error" role="alert">{{ error }}</p>
      }
      <div [class]="view === 'grid' ? 'media-grid' : 'media-list'">
        @for (item of filtered; track item.id) {
          <article
            class="media-card"
            [class.chosen]="selectedIds.includes(item.id)"
          >
            <button
              class="media-preview"
              [attr.aria-label]="(picker ? 'Select ' : 'View ') + item.name"
              [attr.aria-pressed]="
                picker ? selectedIds.includes(item.id) : null
              "
              (click)="choose(item)"
            >
              @if (item.type === "image") {
                <img
                  [src]="item.url + '?v=' + item.updatedAt"
                  [alt]="item.altText"
                  loading="lazy"
                />
              } @else if (item.type === "model") {
                @if (item.thumbnailUrl) {
                  <img
                    [src]="item.thumbnailUrl"
                    [alt]="item.altText || item.name"
                    loading="lazy"
                  />
                } @else {
                  <span class="audio-chip" aria-hidden="true">◇</span>
                }
                <span class="media-type-overlay">3D model</span>
              } @else if (item.type === "video") {
                <video
                  [src]="item.url + '#t=0.1'"
                  preload="metadata"
                  muted
                ></video
                ><span class="media-type-overlay">Video</span>
              } @else {
                <span class="audio-chip" aria-hidden="true"
                  >▂ ▅ ▃ ▇ ▂ ▆ ▄ ▅ ▂</span
                ><span class="media-type-overlay">Audio</span>
              }
              @if (selectedIds.includes(item.id) && picker) {
                <span class="selection-check"><cl-icon name="check" /></span>
              }
            </button>
            <div class="media-card-info">
              <div>
                <strong>{{ item.name }}</strong
                ><small
                  >{{ item.type }} ·
                  {{ item.metadata.size / 1024 | number: "1.0-1" }} KB</small
                >
              </div>
              <button
                class="icon-button"
                [attr.aria-label]="'Details for ' + item.name"
                (click)="openDetails(item)"
              >
                <cl-icon name="settings" />
              </button>
            </div>
          </article>
        } @empty {
          <div class="empty-cell media-empty">
            <cl-icon name="media" />
            <h3>
              {{ search ? "No matching media" : "Your library starts here." }}
            </h3>
            <p>
              {{
                search
                  ? "Try a different search or filter."
                  : "Upload an image, audio clip, or video to get started."
              }}
            </p>
            <button class="button" (click)="uploadOpen = true">
              Upload media
            </button>
          </div>
        }
      </div>
      <div class="table-footer">
        <span
          >{{ filtered.length }}
          {{ filtered.length === 1 ? "file" : "files" }}</span
        ><span>Reusable across pages, posts, and settings.</span>
      </div>
    </section>
    @if (uploadOpen) {
      <div class="modal-overlay media-upload-layer">
        <section
          class="confirm-dialog upload-dialog"
          clDialogFocus
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
        >
          <div class="modal-heading">
            <h2 id="upload-title">
              {{ replacement ? "Replace file" : "Upload media" }}
            </h2>
            <button
              class="icon-button"
              aria-label="Close upload"
              [disabled]="busy"
              (click)="closeUpload()"
            >
              <cl-icon name="close" />
            </button>
          </div>
          <div class="form-content">
            <label
              class="upload-dropzone"
              (dragover)="$event.preventDefault()"
              (drop)="drop($event)"
              ><cl-icon name="media" /><strong>{{
                file?.name || "Drop a file here or browse"
              }}</strong
              ><span>Images, audio, or video · up to 25 MB</span
              ><input
                type="file"
                aria-label="Choose media file"
                accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.mp3,.wav,.ogg,.mp4,.webm,.glb,.gltf,.zip"
                (change)="picked($event)"
            /></label>
            @if (fileIsImage) {
              <label
                >Image alt text<input
                  [(ngModel)]="altText"
                  placeholder="Describe what the image shows"
                  maxlength="500"
                /><small
                  >Required so everyone can understand this image.</small
                ></label
              >
            }
            @if (uploadError) {
              <p class="error" role="alert">{{ uploadError }}</p>
            }
            @if (busy) {
              <progress max="100" [value]="progress"></progress>
              <p>
                {{
                  progress === 100
                    ? "Processing file…"
                    : "Uploading " + progress + "%"
                }}
              </p>
            }
            <button
              class="button primary"
              [disabled]="!file || busy || (fileIsImage && !altText.trim())"
              (click)="upload()"
            >
              {{
                busy
                  ? "Uploading…"
                  : replacement
                    ? "Replace file"
                    : "Upload file"
              }}
            </button>
          </div>
        </section>
      </div>
    }
    @if (detail) {
      <div class="modal-overlay media-drawer-layer" (click)="detail = null">
        <section
          class="media-drawer"
          clDialogFocus
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-detail-title"
          (click)="$event.stopPropagation()"
        >
          <div class="modal-heading">
            <h2 id="media-detail-title">Media details</h2>
            <button
              class="icon-button"
              aria-label="Close media details"
              (click)="detail = null"
            >
              <cl-icon name="close" />
            </button>
          </div>
          <div class="media-detail-preview">
            @if (detail.type === "image") {
              <img
                [src]="detail.url + '?v=' + detail.updatedAt"
                [alt]="detail.altText"
              />
            } @else if (detail.type === "model") {
              <cl-gltf-viewer
                [url]="detail.url"
                [alt]="detail.altText || detail.name"
              />
            } @else if (detail.type === "audio") {
              <audio [src]="detail.url" controls></audio>
            } @else {
              <video [src]="detail.url" controls></video>
            }
          </div>
          <form (ngSubmit)="saveDetails()" class="form-content">
            <label
              >Name<input
                name="name"
                [(ngModel)]="detail.name"
                required
                maxlength="200"
            /></label>
            @if (detail.type === "image") {
              <label
                >Alt text<input
                  name="altText"
                  [(ngModel)]="detail.altText"
                  required
                  maxlength="500"
              /></label>
            }
            <label
              >Caption<input
                name="caption"
                [(ngModel)]="detail.caption"
                maxlength="1000" /></label
            ><label
              >Description<textarea
                name="description"
                [(ngModel)]="detail.description"
                rows="3"
                maxlength="5000"
              ></textarea></label
            ><label
              >Tags<input
                name="tags"
                [(ngModel)]="tags"
                placeholder="Separate tags with commas"
            /></label>
            <dl class="media-metadata">
              @if (detail.type === "model") {
                <dt>Meshes</dt>
                <dd>{{ detail.metadata.meshCount }}</dd>
                <dt>Triangles</dt>
                <dd>{{ detail.metadata.triangleCount }}</dd>
                <dt>Materials</dt>
                <dd>{{ detail.metadata.materialCount }}</dd>
                <dt>Animations</dt>
                <dd>{{ detail.metadata.animationCount }}</dd>
                @for (
                  warning of detail.metadata.warnings || [];
                  track warning
                ) {
                  <dd>{{ warning }}</dd>
                }
              }
              <dt>File size</dt>
              <dd>{{ detail.metadata.size / 1024 | number: "1.0-1" }} KB</dd>
              @if (detail.metadata.width) {
                <dt>Dimensions</dt>
                <dd>
                  {{ detail.metadata.width }} × {{ detail.metadata.height }}
                </dd>
              }
              @if (detail.metadata.duration !== undefined) {
                <dt>Duration</dt>
                <dd>
                  {{ detail.metadata.duration | number: "1.0-1" }} seconds
                </dd>
              }
              <dt>Uploaded by</dt>
              <dd>{{ detail.uploadedBy }}</dd>
              <dt>Uploaded</dt>
              <dd>{{ detail.uploadedAt | date: "medium" }}</dd>
            </dl>
            @if (detailError) {
              <p class="error" role="alert">{{ detailError }}</p>
            }
            @if (refs.length) {
              <div class="in-use-note">
                <strong>Used by:</strong>
                <ul>
                  @for (ref of refs; track $index) {
                    <li>{{ ref.title }}</li>
                  }
                </ul>
              </div>
            }
            <div class="dialog-actions">
              <button type="button" class="button" (click)="replace()">
                Replace file</button
              ><button class="button primary" [disabled]="busy">
                Save details
              </button>
            </div>
            <button
              type="button"
              class="text-button danger-text media-delete"
              (click)="confirmDelete = true"
            >
              Delete media
            </button>
          </form>
        </section>
      </div>
    }
    @if (confirmDelete && detail) {
      <div class="modal-overlay media-confirm-layer">
        <section
          class="confirm-dialog"
          clDialogFocus
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-media-title"
        >
          <h2 id="delete-media-title">Delete {{ detail.name }}?</h2>
          <p>
            This file will be permanently removed. Files in use cannot be
            deleted.
          </p>
          <div class="dialog-actions">
            <button class="button" (click)="confirmDelete = false">
              Cancel</button
            ><button class="button danger" [disabled]="busy" (click)="remove()">
              Delete file
            </button>
          </div>
        </section>
      </div>
    }
  `,
})
export class MediaLibraryComponent {
  api = inject(ApiService);
  @Input() picker = false;
  @Input() accept: ("image" | "audio" | "video" | "model")[] = [];
  @Input() multiple = false;
  @Input() selectedIds: string[] = [];
  @Output() selectionChange = new EventEmitter<MediaItem[]>();
  types = [
    { value: "all", label: "All" },
    { value: "image", label: "Images" },
    { value: "audio", label: "Audio" },
    { value: "video", label: "Video" },
    { value: "model", label: "3D models" },
  ];
  filter = "all";
  view = "grid";
  search = "";
  error = "";
  uploadOpen = false;
  file: File | null = null;
  altText = "";
  busy = false;
  progress = 0;
  uploadError = "";
  detail: MediaItem | null = null;
  detailError = "";
  tags = "";
  refs: { title: string }[] = [];
  confirmDelete = false;
  replacement: MediaItem | null = null;
  get filtered() {
    return (this.api.state()?.media || []).filter(
      (m) =>
        (!this.accept.length || this.accept.includes(m.type)) &&
        (this.filter === "all" || m.type === this.filter) &&
        (m.name + " " + m.altText + " " + m.tags.join(" "))
          .toLowerCase()
          .includes(this.search.toLowerCase()),
    );
  }
  get fileIsImage() {
    return !!this.file && /\.(png|jpe?g|gif|webp|svg)$/i.test(this.file.name);
  }
  choose(item: MediaItem) {
    if (!this.picker) {
      this.openDetails(item);
      return;
    }
    this.selectedIds = this.multiple
      ? this.selectedIds.includes(item.id)
        ? this.selectedIds.filter((id) => id !== item.id)
        : [...this.selectedIds, item.id]
      : [item.id];
    this.selectionChange.emit(
      this.api.state()!.media.filter((m) => this.selectedIds.includes(m.id)),
    );
  }
  picked(event: Event) {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] || null;
    this.uploadError = "";
  }
  drop(event: DragEvent) {
    event.preventDefault();
    this.file = event.dataTransfer?.files[0] || null;
    this.uploadError = "";
  }
  closeUpload() {
    this.uploadOpen = false;
    this.file = null;
    this.replacement = null;
    this.uploadError = "";
    this.altText = "";
  }
  async metadata(file: File) {
    if (!/\.(mp3|wav|ogg|mp4|webm)$/i.test(file.name)) return {};
    return new Promise<Record<string, number>>((resolve) => {
      const element = document.createElement(
        /\.(mp4|webm)$/i.test(file.name) ? "video" : "audio",
      );
      const url = URL.createObjectURL(file);
      const finish = () => {
        const duration = element.duration;
        URL.revokeObjectURL(url);
        element.removeAttribute("src");
        resolve(Number.isFinite(duration) ? { duration } : {});
      };
      element.onloadedmetadata = finish;
      element.onerror = finish;
      element.preload = "metadata";
      element.src = url;
      setTimeout(finish, 5000);
    });
  }
  async upload() {
    if (!this.file) return;
    this.busy = true;
    this.uploadError = "";
    this.progress = 0;
    try {
      const form = new FormData();
      form.set("file", this.file);
      form.set("altText", this.altText);
      form.set("metadata", JSON.stringify(await this.metadata(this.file)));
      const item = await this.api.upload(
        this.replacement
          ? "/media/" + this.replacement.id + "/replace"
          : "/media",
        form,
        (p) => (this.progress = p),
      );
      await this.api.load();
      if (this.detail?.id === item.id) this.detail = item;
      this.closeUpload();
      this.api.toast("Media saved to your library.");
    } catch (e) {
      this.uploadError = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
  async openDetails(item: MediaItem) {
    this.detail = { ...item, tags: [...item.tags] };
    this.tags = item.tags.join(", ");
    this.detailError = "";
    this.refs = [];
    try {
      this.refs = await this.api.request("/media/" + item.id + "/references");
    } catch (e) {
      this.detailError = (e as Error).message;
    }
  }
  async saveDetails() {
    if (!this.detail) return;
    this.busy = true;
    this.detailError = "";
    try {
      this.detail = await this.api.request(
        "/media/" + this.detail.id,
        "PATCH",
        {
          ...this.detail,
          tags: this.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      );
      await this.api.load();
      this.api.toast("Media details saved.");
    } catch (e) {
      this.detailError = (e as Error).message;
    } finally {
      this.busy = false;
    }
  }
  replace() {
    if (!this.detail) return;
    this.replacement = this.detail;
    this.altText = this.detail.altText;
    this.file = null;
    this.uploadOpen = true;
  }
  async remove() {
    if (!this.detail) return;
    this.busy = true;
    try {
      await this.api.request("/media/" + this.detail.id, "DELETE", {});
      this.detail = null;
      await this.api.load();
      this.api.toast("Media deleted.");
    } catch (e) {
      this.detailError = (e as Error).message;
      this.refs = (e as any).references || this.refs;
    } finally {
      this.confirmDelete = false;
      this.busy = false;
    }
  }
}
