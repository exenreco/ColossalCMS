import {
  Component,
  ChangeDetectorRef,
  OnDestroy,
  inject,
  ElementRef,
  HostListener,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { EditorIconComponent } from "../../shared/editor-icon.component";
import { EditorAutomationApi } from "../../shared/editor-automation.service";
import { ApiService } from "../../shared/api.service";
import { assistantStream } from "./client";

@Component({
  selector: "cl-ai-editor-chat",
  standalone: true,
  imports: [FormsModule, EditorIconComponent],
  styles: `
    :host {
      display: contents;
    }
    .ai-trigger {
      border: 0;
      background: transparent;
      color: inherit;
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      cursor: pointer;
    }
    .ai-trigger:hover,
    .ai-trigger[aria-expanded="true"] {
      background: var(--editor-hover);
      color: var(--editor-accent);
    }
    .ai-chat {
      position: fixed;
      z-index: 110;
      box-sizing: border-box;
      color: var(--editor-text);
      font-size: 13px;
      line-height: 1.5;
      font-family: inherit;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: calc(100dvh - 112px);
    }
    .ai-chat button,
    .ai-chat a {
      font: inherit;
      color: inherit;
    }
    .ai-chat button {
      cursor: pointer;
    }
    .ai-chat button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .ai-chat button:focus-visible,
    .ai-chat a:focus-visible {
      outline: 2px solid var(--editor-accent);
      outline-offset: 3px;
    }
    .ai-conversation,
    .ai-composer {
      background: var(--editor-bg);
      border: 1px solid var(--editor-border);
      box-shadow: 0 16px 56px #0003;
      border-radius: 22px;
    }
    .ai-conversation {
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: ai-reveal 180ms ease-out;
    }
    .ai-heading {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 13px 16px;
      border-bottom: 1px solid var(--editor-border);
    }
    .ai-heading h2 {
      font-size: 13px;
      margin: 0;
      flex: 1;
      font-weight: 600;
    }
    .ai-chat .ai-icon-button {
      width: 30px;
      height: 30px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
    }
    .ai-icon-button:hover {
      background: var(--editor-hover);
    }
    .ai-icon-button cl-editor-icon {
      width: 17px;
      height: 17px;
    }
    .ai-chat-log {
      padding: 14px 18px;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--editor-border) transparent;
      min-height: 0;
      max-height: min(44dvh, 430px);
      overscroll-behavior: contain;
    }
    .ai-message {
      margin: 0 0 18px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .ai-message strong {
      display: block;
      font-size: 11px;
      color: var(--editor-muted);
      margin-bottom: 5px;
    }
    .ai-message.ai-user {
      padding: 10px 13px;
      background: var(--editor-panel);
      border-radius: 14px;
      margin-left: 36px;
    }
    .ai-progress {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: var(--editor-muted);
    }
    .ai-progress .ai-orbit {
      width: 10px;
      height: 10px;
      margin-top: 5px;
      flex: 0 0 10px;
      border-radius: 50%;
      background: var(--editor-accent);
      animation: ai-pulse 1.2s infinite alternate;
    }
    .ai-preview {
      padding: 14px;
      background: var(--editor-panel);
      border: 1px solid var(--editor-border);
      border-radius: 14px;
    }
    .ai-preview h3 {
      font-size: 13px;
      margin: 0 0 5px;
    }
    .ai-preview p {
      margin: 0 0 10px;
      color: var(--editor-muted);
    }
    .ai-preview details {
      padding: 6px 0;
    }
    .ai-preview summary {
      cursor: pointer;
      overflow-wrap: anywhere;
    }
    .ai-preview pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 11px;
    }
    .ai-chat-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .ai-chat-actions button {
      border: 1px solid var(--editor-border);
      border-radius: 8px;
      padding: 7px 12px;
      background: var(--editor-bg);
    }
    .ai-chat-actions .ai-apply {
      background: var(--editor-accent);
      color: #07150d;
      border-color: transparent;
    }
    .ai-error {
      color: #e57a7a;
      overflow-wrap: anywhere;
    }
    .ai-notice {
      color: var(--editor-accent);
    }
    .ai-composer {
      position: relative;
      padding: 14px 12px 10px;
      transition:
        border-color 180ms,
        box-shadow 180ms;
    }
    .ai-composer:focus-within {
      border-color: color-mix(
        in srgb,
        var(--editor-accent) 45%,
        var(--editor-border)
      );
      box-shadow:
        0 16px 56px #0003,
        0 0 0 2px color-mix(in srgb, var(--editor-accent) 8%, transparent);
    }
    .ai-composer textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 44px;
      max-height: 130px;
      padding: 3px 5px 10px;
      resize: none;
      field-sizing: content;
      background: transparent;
      border: 0;
      outline: none;
      font: inherit;
      color: inherit;
      scrollbar-width: thin;
    }
    .ai-composer textarea::placeholder {
      color: var(--editor-muted);
    }
    .ai-controls {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .ai-chat .ai-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 10px;
      background: var(--editor-panel);
      border: 1px solid var(--editor-border);
      border-radius: 24px;
      max-width: 230px;
      min-width: 0;
    }
    .ai-pill span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ai-pill cl-editor-icon {
      width: 14px;
      height: 14px;
    }
    .ai-pill[aria-expanded="true"] {
      background: var(--editor-hover);
      border-color: var(--editor-accent);
    }
    .ai-controls .ai-spacer {
      flex: 1;
    }
    .ai-chat .ai-send {
      background: var(--editor-accent);
      color: #07150d;
      width: 34px;
      height: 34px;
    }
    .ai-chat .ai-stop {
      background: var(--editor-panel);
      color: var(--editor-text);
    }
    .ai-menu {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 0;
      width: min(310px, calc(100vw - 48px));
      box-sizing: border-box;
      padding: 8px;
      border: 1px solid var(--editor-border);
      background: var(--editor-bg);
      border-radius: 18px;
      box-shadow: 0 12px 40px #0004;
      animation: ai-reveal 170ms ease-out;
      transform-origin: bottom left;
    }
    .ai-menu.model-menu {
      left: 100px;
    }
    .ai-menu h3 {
      color: var(--editor-muted);
      font-size: 11px;
      margin: 7px 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .ai-menu button.ai-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 11px;
      text-align: left;
      padding: 10px;
      background: transparent;
      border: 0;
      border-radius: 10px;
    }
    .ai-option:hover,
    .ai-option[aria-checked="true"] {
      background: var(--editor-hover);
    }
    .ai-option > span {
      flex: 1;
      min-width: 0;
    }
    .ai-option strong {
      font-weight: 500;
      display: block;
      overflow-wrap: anywhere;
    }
    .ai-option small {
      display: block;
      color: var(--editor-muted);
      font-size: 11px;
    }
    .ai-option cl-editor-icon {
      width: 18px;
      height: 18px;
    }
    .ai-model-mark {
      color: var(--editor-accent);
    }
    .ai-context-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin: 0 4px 8px;
    }
    .ai-chat .ai-chip {
      border: 1px solid var(--editor-border);
      border-radius: 7px;
      background: var(--editor-panel);
      padding: 3px 6px;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      max-width: 100%;
    }
    .ai-chip span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ai-chip cl-editor-icon {
      width: 12px;
      height: 12px;
    }
    .ai-context-tabs {
      display: flex;
      gap: 6px;
      margin: 5px 8px 10px;
    }
    .ai-context-tabs button {
      border: 0;
      background: var(--editor-panel);
      border-radius: 7px;
      padding: 5px 10px;
    }
    .ai-context-tabs button[aria-pressed="true"] {
      color: var(--editor-accent);
      background: var(--editor-hover);
    }
    .ai-menu input {
      box-sizing: border-box;
      width: 100%;
      padding: 8px 10px;
      color: inherit;
      background: var(--editor-panel);
      border: 1px solid var(--editor-border);
      border-radius: 10px;
      font: inherit;
    }
    .ai-context-results {
      max-height: 220px;
      overflow: auto;
      scrollbar-width: thin;
    }
    .ai-context-results img {
      width: 30px;
      height: 30px;
      object-fit: cover;
      border-radius: 6px;
    }
    .ai-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      color: var(--editor-muted);
      font-size: 10px;
    }
    .ai-footer span {
      flex: 1;
    }
    .ai-footer button {
      border: 0;
      background: transparent;
      padding: 0;
      font-size: 11px;
    }
    .ai-empty {
      margin: 8px 10px;
      color: var(--editor-muted);
    }
    .ai-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
    @keyframes ai-reveal {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes ai-pulse {
      from {
        opacity: 0.3;
      }
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before {
        animation: none !important;
        transition: none !important;
      }
    }
    @media (max-width: 700px) {
      .ai-menu.model-menu {
        left: 20px;
      }
      .ai-pill {
        max-width: 140px !important;
      }
      .ai-footer span {
        font-size: 9px;
      }
    }
  `,
  template: `
    <button
      class="ai-trigger"
      aria-label="AI Assistant"
      title="AI Assistant"
      [attr.aria-expanded]="open"
      aria-controls="ai-editor-chat"
      (click)="toggle()"
    >
      <cl-editor-icon name="ai" />
    </button>
    @if (open) {
      <section
        id="ai-editor-chat"
        class="ai-chat"
        aria-label="AI Assistant"
        [style.left.px]="dockLeft"
        [style.width.px]="dockWidth"
        [style.bottom.px]="dockBottom"
        (keydown.escape)="escape($event)"
        (keydown)="menuKeys($event)"
      >
        @if (
          expanded && (messages.length || busy || preview || error || notice)
        ) {
          <div class="ai-conversation">
            <div class="ai-heading">
              <cl-editor-icon name="ai" />
              <h2>AI Assistant</h2>
              <button
                type="button"
                class="ai-icon-button"
                title="New chat"
                aria-label="New chat"
                [disabled]="busy"
                (click)="clear()"
              >
                <cl-editor-icon name="plus" />
              </button>
              <button
                type="button"
                class="ai-icon-button"
                title="Minimize conversation"
                aria-label="Minimize conversation"
                (click)="expanded = false"
              >
                <cl-editor-icon name="chevron" />
              </button>
              <button
                type="button"
                class="ai-icon-button"
                aria-label="Close AI Assistant"
                (click)="close()"
              >
                <cl-editor-icon name="close" />
              </button>
            </div>
            <div
              #chatLog
              class="ai-chat-log"
              role="log"
              aria-label="Conversation"
              aria-live="polite"
            >
              @for (message of messages; track $index) {
                <div
                  class="ai-message"
                  [class.ai-user]="message.role === 'user'"
                >
                  <strong>{{
                    message.role === "user" ? "You" : "Assistant"
                  }}</strong
                  >{{ message.text }}
                </div>
              }
              @if (busy) {
                <p class="ai-progress">
                  <span class="ai-orbit" aria-hidden="true"></span
                  >{{ progress }}
                </p>
              }
              @if (error) {
                <p class="ai-error" role="alert">{{ error }}</p>
              }
              @if (notice) {
                <p class="ai-notice" role="status">{{ notice }}</p>
              }
              @if (preview) {
                <div class="ai-preview">
                  <h3>Proposed changes</h3>
                  <p>
                    {{ preview.changes.length }} block changes · current
                    document only
                  </p>
                  @for (change of preview.changes; track $index) {
                    <details>
                      <summary>{{ change.action }} · {{ change.type }}</summary>
                      @if (change.before) {
                        <strong>Before</strong>
                        <pre>{{ json(change.before) }}</pre>
                      }
                      @if (change.after) {
                        <strong>After</strong>
                        <pre>{{ json(change.after) }}</pre>
                      }
                    </details>
                  }
                  <div class="ai-chat-actions">
                    <button
                      class="ai-apply"
                      [disabled]="busy"
                      (click)="apply()"
                    >
                      Apply changes</button
                    ><button
                      [disabled]="busy"
                      (click)="preview = null; notice = 'Proposal discarded.'"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
        <form class="ai-composer" (ngSubmit)="send()" [attr.data-menu]="menu">
          @if (attachments.length) {
            <div class="ai-context-chips">
              @for (item of attachments; track item.id) {
                <button
                  type="button"
                  class="ai-chip"
                  [disabled]="busy"
                  [attr.aria-label]="'Remove context ' + item.label"
                  (click)="removeContext(item.id)"
                >
                  <cl-editor-icon
                    [name]="item.kind === 'media' ? 'theme' : 'outline'"
                  /><span>{{ item.label }}</span
                  ><cl-editor-icon name="close" />
                </button>
              }
            </div>
          }
          <label class="ai-sr-only" for="ai-prompt">Describe your change</label>
          <textarea
            #promptInput
            id="ai-prompt"
            name="prompt"
            [value]="prompt"
            (input)="updatePrompt($event)"
            maxlength="8000"
            placeholder="Plan, build, explain… @ for context"
            [disabled]="busy"
            (keydown)="promptKeys($event)"
          ></textarea>
          <div class="ai-controls">
            <button
              type="button"
              class="ai-icon-button"
              aria-label="Add context"
              title="Add context or media"
              aria-haspopup="menu"
              [attr.aria-expanded]="menu === 'context'"
              [disabled]="busy"
              (click)="toggleMenu('context')"
            >
              <cl-editor-icon name="plus" />
            </button>
            <button
              type="button"
              class="ai-pill"
              aria-label="Assistant mode"
              aria-haspopup="menu"
              [attr.aria-expanded]="menu === 'mode'"
              [disabled]="busy"
              (click)="toggleMenu('mode')"
            >
              <span>{{ modeLabels[mode] }}</span
              ><cl-editor-icon name="chevron" />
            </button>
            <button
              type="button"
              class="ai-pill"
              aria-label="Assistant model"
              aria-haspopup="menu"
              [attr.aria-expanded]="menu === 'model'"
              [disabled]="busy"
              (click)="toggleMenu('model')"
            >
              <cl-editor-icon class="ai-model-mark" name="ai" /><span>{{
                loadingModels
                  ? "Loading models…"
                  : selectedModel?.model || "Select model"
              }}</span
              ><cl-editor-icon name="chevron" />
            </button>
            <span class="ai-spacer"></span>
            @if (busy) {
              <button
                type="button"
                class="ai-icon-button ai-stop"
                aria-label="Stop response"
                title="Stop response"
                (click)="controller?.abort()"
              >
                <cl-editor-icon name="stop" />
              </button>
            } @else {
              <button
                class="ai-icon-button ai-send"
                aria-label="Send"
                title="Send (Enter)"
                [disabled]="
                  !prompt.trim() ||
                  !status?.enabled ||
                  !status?.configured ||
                  !selectedModel ||
                  loadingModels
                "
              >
                <cl-editor-icon name="arrow-up" /><span class="ai-sr-only"
                  >Send</span
                >
              </button>
            }
          </div>
          @if (menu === "mode") {
            <div class="ai-menu" role="menu" aria-label="Assistant modes">
              <h3>Work with your canvas</h3>
              @for (item of modes; track item.id) {
                <button
                  type="button"
                  class="ai-option"
                  role="menuitemradio"
                  [attr.aria-checked]="mode === item.id"
                  (click)="chooseMode(item.id)"
                >
                  <cl-editor-icon [name]="item.icon" /><span
                    ><strong>{{ item.label }}</strong
                    ><small>{{ item.description }}</small></span
                  >
                  @if (mode === item.id) {
                    <cl-editor-icon name="check" />
                  }
                </button>
              }
            </div>
          }
          @if (menu === "model") {
            <div
              class="ai-menu model-menu"
              role="menu"
              aria-label="Available models"
            >
              <h3>Available models</h3>
              @for (item of modelChoices; track item.provider + item.model) {
                <button
                  type="button"
                  class="ai-option"
                  role="menuitemradio"
                  [attr.aria-checked]="
                    selectedModel?.provider === item.provider &&
                    selectedModel?.model === item.model
                  "
                  (click)="chooseModel(item)"
                >
                  <cl-editor-icon name="ai" /><span
                    ><strong>{{ item.model }}</strong
                    ><small>{{ item.label }}</small></span
                  >
                  @if (
                    selectedModel?.provider === item.provider &&
                    selectedModel?.model === item.model
                  ) {
                    <cl-editor-icon name="check" />
                  }
                </button>
              }
              @if (!modelChoices.length) {
                <button
                  type="button"
                  role="menuitem"
                  [disabled]="loadingModels"
                  (click)="loadModels()"
                >
                  {{
                    loadingModels
                      ? "Loading models…"
                      : "Reload available models"
                  }}
                </button>
                <p class="ai-empty">No available models loaded.</p>
              }
              <a
                class="ai-option"
                role="menuitem"
                href="/admin/ai-assistant"
                target="_blank"
                rel="noopener"
                >Configure providers ↗</a
              >
            </div>
          }
          @if (menu === "context") {
            <div class="ai-menu" aria-label="Add editor context">
              <h3>Add context</h3>
              <div class="ai-context-tabs">
                <button
                  type="button"
                  [attr.aria-pressed]="contextTab === 'blocks'"
                  (click)="contextTab = 'blocks'"
                >
                  Blocks</button
                ><button
                  type="button"
                  [attr.aria-pressed]="contextTab === 'media'"
                  (click)="contextTab = 'media'"
                >
                  Media
                </button>
              </div>
              <input
                name="contextQuery"
                aria-label="Search context"
                [(ngModel)]="mediaQuery"
                placeholder="Search blocks or media…"
              />
              <div class="ai-context-results">
                @if (contextTab === "blocks") {
                  @for (item of matchingBlocks; track item.id) {
                    <button
                      type="button"
                      class="ai-option"
                      (click)="attach(item)"
                    >
                      <cl-editor-icon name="outline" /><span
                        ><strong>{{ item.label }}</strong
                        ><small>{{ item.id }}</small></span
                      >
                    </button>
                  }
                  @if (!matchingBlocks.length) {
                    <p class="ai-empty">No matching blocks.</p>
                  }
                } @else {
                  @for (
                    media of automation.searchMedia(mediaQuery);
                    track media.id
                  ) {
                    <button
                      type="button"
                      class="ai-option"
                      (click)="attachMedia(media)"
                    >
                      @if (media.thumbnailUrl) {
                        <img [src]="media.thumbnailUrl" alt="" />
                      }
                      <span
                        ><strong>{{ media.name }}</strong
                        ><small>{{ media.type }}</small></span
                      >
                    </button>
                  }
                }
              </div>
            </div>
          }
        </form>
        <div class="ai-footer">
          <span>{{
            !status?.enabled || !status?.configured
              ? "Configure and enable AI Assistant to begin."
              : "Current canvas context · Changes are reviewed before applying."
          }}</span>
          @if (messages.length || preview || error || notice) {
            <button type="button" (click)="expanded = !expanded">
              {{ expanded ? "Hide chat" : "Show chat" }}
            </button>
          }
          <button
            type="button"
            [disabled]="busy || !automation.getFeedback().canUndo"
            (click)="undo()"
          >
            Undo
          </button>
          <button
            type="button"
            title="Close AI Assistant"
            aria-label="Close assistant bar"
            (click)="close()"
          >
            <cl-editor-icon name="close" />
          </button>
        </div>
      </section>
    }
  `,
})
export class AiEditorChatComponent implements OnDestroy {
  automation = inject(EditorAutomationApi);
  api = inject(ApiService);
  cdr = inject(ChangeDetectorRef);
  element: ElementRef<HTMLElement> = inject(ElementRef);
  @ViewChild("promptInput") promptInput?: ElementRef<HTMLTextAreaElement>;
  @ViewChild("chatLog") chatLog?: ElementRef<HTMLElement>;
  open = false;
  expanded = true;
  menu = "";
  mode: "build" | "plan" | "explain" = "build";
  modeLabels = { build: "Build", plan: "Plan", explain: "Explain" };
  modes = [
    {
      id: "build" as const,
      label: "Build",
      icon: "edit",
      description: "Propose changes to review and apply",
    },
    {
      id: "plan" as const,
      label: "Plan",
      icon: "list",
      description: "Outline an approach without editing",
    },
    {
      id: "explain" as const,
      label: "Explain",
      icon: "help",
      description: "Ask about the current canvas",
    },
  ];
  modelChoices: { provider: string; model: string; label: string }[] = [];
  selectedModel?: { provider: string; model: string; label: string };
  attachments: { id: string; label: string; kind: "block" | "media" }[] = [];
  contextBlocks: { id: string; label: string; kind: "block" }[] = [];
  contextTab = "blocks";
  dockLeft = 100;
  dockWidth = 560;
  dockBottom = 24;
  private resizeObserver?: ResizeObserver;
  get matchingBlocks() {
    return this.contextBlocks
      .filter((b) =>
        (b.label + " " + b.id)
          .toLowerCase()
          .includes(this.mediaQuery.toLowerCase()),
      )
      .slice(0, 40);
  }
  @HostListener("window:resize") position() {
    const canvas = this.element.nativeElement
      .closest(".shared-editor")
      ?.querySelector(".shared-editor-canvas");
    const rect = canvas?.getBoundingClientRect();
    const available =
      rect && rect.width >= 280
        ? rect
        : {
            left: 12,
            width: window.innerWidth - 24,
            bottom: window.innerHeight,
          };
    this.dockWidth = Math.min(640, available.width - 32);
    this.dockLeft = available.left + (available.width - this.dockWidth) / 2;
    this.dockBottom = Math.max(18, window.innerHeight - available.bottom + 18);
    this.cdr.markForCheck();
  }
  @HostListener("document:click", ["$event"]) outside(event: MouseEvent) {
    if (!(event.target as HTMLElement)?.closest?.(".ai-chat")) this.menu = "";
  }
  close() {
    this.open = false;
    this.menu = "";
    this.resizeObserver?.disconnect();
    this.element.nativeElement
      .querySelector<HTMLButtonElement>(".ai-trigger")
      ?.focus();
  }
  escape(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.menu) {
      this.menu = "";
      this.promptInput?.nativeElement.focus();
    } else this.close();
  }
  menuKeys(event: KeyboardEvent) {
    if (
      !this.menu ||
      (event.target as HTMLElement).tagName === "INPUT" ||
      !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    )
      return;
    const items = Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        '.ai-menu button.ai-option, .ai-menu a[role="menuitem"]',
      ),
    );
    if (!items.length) return;
    event.preventDefault();
    event.stopPropagation();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[next].focus();
  }
  promptKeys(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }
  setPrompt(value: string) {
    this.prompt = value;
    if (this.promptInput) this.promptInput.nativeElement.value = value;
    this.cdr.markForCheck();
  }
  updatePrompt(event: Event) {
    this.prompt = (event.target as HTMLTextAreaElement).value;
    this.promptChanged();
  }
  promptChanged() {
    if (this.prompt.endsWith("@")) void this.toggleMenu("context", true);
  }
  async toggleMenu(menu: string, force = false) {
    this.menu = !force && this.menu === menu ? "" : menu;
    requestAnimationFrame(() =>
      this.element.nativeElement
        .querySelector<HTMLElement>(
          this.menu === "context"
            ? ".ai-menu input"
            : ".ai-menu button.ai-option",
        )
        ?.focus(),
    );
    if (this.menu === "context") {
      try {
        const context = await this.automation.getContext();
        const items: typeof this.contextBlocks = [];
        const walk = (node: any) => {
          items.push({
            id: node.id,
            label:
              node.label ||
              context.catalog.find((b: any) => b.type === node.type)?.label ||
              node.type.replace("core/", ""),
            kind: "block",
          });
          for (const child of node.children || []) walk(child);
        };
        walk(context.root);
        this.contextBlocks = items;
      } catch (error) {
        this.error = (error as Error).message;
        this.expanded = true;
      }
      this.cdr.markForCheck();
    }
  }
  chooseMode(mode: "build" | "plan" | "explain") {
    this.mode = mode;
    this.menu = "";
    this.promptInput?.nativeElement.focus();
  }
  chooseModel(model: { provider: string; model: string; label: string }) {
    this.selectedModel = model;
    this.status.configured = true;
    this.menu = "";
    this.promptInput?.nativeElement.focus();
  }
  attach(item: { id: string; label: string; kind: "block" | "media" }) {
    if (
      this.attachments.length < 20 &&
      !this.attachments.some((a) => a.id === item.id)
    )
      this.attachments.push(item);
    this.setPrompt(this.prompt.replace(/@$/, ""));
    this.menu = "";
    this.promptInput?.nativeElement.focus();
  }
  attachMedia(media: any) {
    this.attach({ id: media.id, label: media.name, kind: "media" });
  }
  removeContext(id: string) {
    this.attachments = this.attachments.filter((a) => a.id !== id);
  }
  scrollChat() {
    requestAnimationFrame(() => {
      const el = this.chatLog?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  status: any;
  prompt = "";
  mediaQuery = "";
  messages: { role: string; text: string }[] = [];
  preview: any;
  busy = false;
  progress = "";
  error = "";
  notice = "";
  controller?: AbortController;
  json(value: unknown) {
    return JSON.stringify(value, null, 2);
  }
  async toggle() {
    if (this.open) {
      this.close();
      return;
    }
    this.open = true;
    this.position();
    const canvas = this.element.nativeElement
      .closest(".shared-editor")
      ?.querySelector(".shared-editor-canvas");
    if (canvas) {
      this.resizeObserver = new ResizeObserver(() => this.position());
      this.resizeObserver.observe(canvas);
    }
    if (this.open) {
      try {
        this.status = await this.api.request("/admin/ai-assistant/status");
        this.modelChoices = [];
        if (this.status.enabled && this.status.configured)
          await this.loadModels();
        requestAnimationFrame(() => this.promptInput?.nativeElement.focus());
      } catch (e) {
        this.error = (e as Error).message;
      }
      this.cdr.markForCheck();
    }
  }
  loadingModels = false;
  async loadModels() {
    this.loadingModels = true;
    this.error = "";
    this.cdr.markForCheck();
    try {
      const data = await this.api.request("/admin/ai-assistant/models");
      this.modelChoices = data.models.map(
        (m: { id: string; label: string }) => ({
          provider: data.provider,
          model: m.id,
          label: m.label,
        }),
      );
      this.selectedModel =
        this.modelChoices.find(
          (m) =>
            m.provider === this.selectedModel?.provider &&
            m.model === this.selectedModel?.model,
        ) || this.modelChoices.find((m) => m.model === this.status.model);
      if (!this.modelChoices.length)
        this.error = "No available models were returned by this provider.";
    } catch (e) {
      this.error = (e as Error).message;
      this.selectedModel = undefined;
    } finally {
      this.loadingModels = false;
      this.cdr.markForCheck();
    }
  }
  ngOnDestroy() {
    this.controller?.abort();
    this.resizeObserver?.disconnect();
  }
  clear() {
    this.messages = [];
    this.attachments = [];
    this.setPrompt("");
    this.preview = null;
    this.error = "";
    this.notice = "";
  }
  undo() {
    this.automation.undo();
    this.notice = "Used editor Undo.";
    this.preview = null;
    this.expanded = true;
  }
  async send() {
    if (
      this.busy ||
      !this.prompt.trim() ||
      !this.status?.enabled ||
      !this.status?.configured ||
      !this.selectedModel ||
      this.loadingModels
    )
      return;
    this.busy = true;
    this.expanded = true;
    this.menu = "";
    this.error = "";
    this.notice = "";
    this.preview = null;
    this.progress = "Reading the current document…";
    this.controller = new AbortController();
    const message = this.prompt;
    const attached = this.attachments.map((a) => ({ ...a }));
    const history = this.messages.slice(-8);
    this.messages.push({ role: "user", text: message });
    this.prompt = "";
    this.attachments = [];
    this.scrollChat();
    let result: any;
    let text = "";
    try {
      const context = await this.automation.getContext();
      await assistantStream(
        "chat",
        {
          message,
          context,
          history,
          mode: this.mode,
          provider: this.selectedModel?.provider,
          model: this.selectedModel?.model,
          attachments: attached,
        },
        this.controller.signal,
        (event) => {
          if (event.type === "status") this.progress = event.message;
          if (event.type === "delta") {
            text += event.text;
            this.progress = "Generating a proposal…";
            const match = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (match) {
              try {
                this.progress = JSON.parse('"' + match[1] + '"');
              } catch {}
            }
          }
          if (event.type === "proposal") result = event;
          this.cdr.markForCheck();
        },
      );
      this.messages.push({ role: "assistant", text: result.message });
      if (this.mode === "build" && result.commands.length) {
        this.progress = "Validating proposed changes…";
        this.preview = await this.automation.previewBatch(
          result.commands,
          result.revision,
        );
      } else
        this.notice =
          this.mode === "build"
            ? "No document changes proposed."
            : "Discussion only — no document changes proposed.";
    } catch (e) {
      this.error = this.controller.signal.aborted
        ? "Request stopped. No changes applied."
        : (e as Error).message;
      this.messages.push({
        role: "assistant",
        text: "Proposal was not applied: " + this.error,
      });
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
      this.scrollChat();
    }
  }
  async apply() {
    this.busy = true;
    this.error = "";
    try {
      await this.automation.applyBatch(this.preview);
      this.preview = null;
      this.notice =
        "Changes applied as one undo step. Save or publish when ready.";
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
