import { Injectable, OnDestroy, inject } from "@angular/core";
import { ThemeEditorState } from "./theme-editor-state";
import { ApiService } from "./api.service";
import { ThemeOutlineApi } from "./theme-outline-api";
import {
  appearanceFields,
  editorRevision,
  type BatchCommand,
} from "./editor-batch";
import type { BlockNode } from "./theme-models";
import { ContentEditorContext } from "./content-editor-panel-registry";

@Injectable()
export class EditorAutomationApi implements OnDestroy {
  private state = inject(ThemeEditorState);
  private api = inject(ApiService);
  private outline = inject(ThemeOutlineApi);
  private contentContext = inject(ContentEditorContext, { optional: true });
  private renderError = "";
  reportRenderError(message = "") {
    this.renderError = message;
  }
  getFeedback() {
    return {
      validationError: this.state.error,
      renderError: this.renderError,
      notice: this.state.notice,
      canUndo: !!this.state.past.length,
      canRedo: !!this.state.future.length,
    };
  }
  private previews = new WeakMap<
    object,
    { basis: string; root: BlockNode; selectedId: string }
  >();
  constructor() {
    if (typeof window !== "undefined") {
      window.colossalEditorAutomation = this;
      window.dispatchEvent(
        new CustomEvent("colossal:automation-ready", {
          detail: { api: this, apiVersion: 1 },
        }),
      );
    }
  }
  ngOnDestroy() {
    if (
      typeof window !== "undefined" &&
      window.colossalEditorAutomation === this
    )
      delete window.colossalEditorAutomation;
  }
  private basis() {
    return {
      document: this.state.document(),
      templateId: this.state.templateId,
      part: this.state.part,
      kind: this.state.rootLabel,
    };
  }
  async getContext() {
    if (!this.state.root) throw Error("Wait for the editor document to load.");
    const basis = structuredClone(this.basis());
    const catalog = this.getCatalog();
    const selectedId = this.state.selected(),
      dirty = this.state.dirty;
    const entry = basis.kind === "Main" ? this.contentContext?.content() : null;
    return {
      apiVersion: 1,
      revision: await editorRevision(basis),
      kind: basis.kind,
      themeId: basis.document!.manifest.id,
      templateId: basis.templateId,
      part: basis.part,
      selectedId,
      dirty,
      root: basis.part
        ? basis.document!.parts[basis.part]
        : basis.document!.templates[basis.templateId],
      catalog,
      sharedParts: Object.keys(basis.document!.parts),
      feedback: this.getFeedback(),
      content: entry
        ? {
            id: entry.id,
            kind: entry.kind,
            title: entry.title,
            excerpt: entry.excerpt,
            slug: entry.slug,
            status: entry.status,
          }
        : null,
      appearanceExamples: {
        margin: { top: "auto", right: "auto", bottom: "auto", left: "auto" },
        padding: { top: "24px", right: "24px", bottom: "24px", left: "24px" },
        backgroundGradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#17191b", position: 0 },
            { color: "#286d50", position: 100 },
          ],
        },
        transform: {
          translateX: "0px",
          translateY: "0px",
          rotate: 0,
          scaleX: 1,
          scaleY: 1,
        },
        animations: {
          In: {
            event: "load",
            preset: "fade",
            duration: 500,
            delay: 0,
            ease: "ease",
            loop: false,
          },
        },
      },
    };
  }
  getCatalog() {
    const active = new Set(
      (this.api.state()?.plugins || [])
        .filter((p) => p.active)
        .map((p) => p.id),
    );
    return this.state.blocks
      .filter(
        (b) =>
          !b.disabled && !b.legacy && (!b.pluginId || active.has(b.pluginId)),
      )
      .map((b) => ({
        type: b.type,
        label: b.label,
        category: b.category,
        icon: b.icon,
        container: !!b.container,
        fields: structuredClone(b.fields),
        appearanceFields: appearanceFields.filter(
          (key) => b.type !== "core/slider" || key !== "animations",
        ),
        allowedChildren:
          b.type === "core/slider"
            ? ["core/slide"]
            : b.type === "core/columns"
              ? ["core/column"]
              : b.type === "core/gltf"
                ? ["core/overlay"]
                : ["core/menu", "core/menu-item"].includes(b.type)
                  ? ["core/menu-item", "core/custom-link", "core/button"]
                  : b.container
                    ? ["any valid block; placement rules apply"]
                    : [],
      }));
  }
  searchMedia(query = "", type = "") {
    return (this.api.state()?.media || [])
      .filter(
        (m) =>
          (!type || m.type === type) &&
          `${m.name} ${m.altText} ${m.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .slice(0, 30)
      .map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        altText: m.altText,
        thumbnailUrl: m.thumbnailUrl,
        url: m.url,
      }));
  }
  async previewBatch(commands: BatchCommand[], revision: string) {
    const basis = structuredClone(this.basis());
    if ((await editorRevision(basis)) !== revision)
      throw Error(
        "The document changed. Generate a new proposal before applying it.",
      );
    const preview = await this.api.request(
      "/admin/editor/batch/preview",
      "POST",
      { ...basis, revision, commands },
    );
    this.previews.set(preview, {
      basis: JSON.stringify(basis),
      root: structuredClone(preview.root),
      selectedId: preview.selectedId,
    });
    return preview;
  }
  async applyBatch(preview: {
    revision: string;
    root: BlockNode;
    selectedId: string;
  }) {
    const validated = this.previews.get(preview);
    if (!validated)
      throw Error("Preview and validate this batch before applying it.");
    if (JSON.stringify(this.basis()) !== validated.basis)
      throw Error(
        "The document changed. Generate a new proposal before applying it.",
      );
    this.state.commit(() => {
      const d = this.state.document()!;
      if (this.state.part)
        d.parts[this.state.part] = structuredClone(validated.root);
      else d.templates[this.state.templateId] = structuredClone(validated.root);
    });
    if (this.state.error) throw Error(this.state.error);
    this.state.selected.set(
      this.state.find(validated.selectedId)
        ? validated.selectedId
        : this.state.root!.id,
    );
    this.previews.delete(preview);
    return { applied: true, canUndo: true, saved: false, published: false };
  }
  undo() {
    this.outline.dispatch({ type: "undo" });
  }
}
declare global {
  interface Window {
    colossalEditorAutomation?: EditorAutomationApi;
  }
}
