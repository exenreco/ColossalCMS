import { fail, all } from "./v2-utils.mjs";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
import {
  editorBatch,
  editorDiff,
  editorRevision,
} from "../shared/editor-batch.ts";
import { sharedPartDefinitions } from "../shared/shared-part-blocks.ts";
import {
  defaultTheme,
  validateDocument,
  themeMediaIds,
} from "./theme-engine.mjs";

/** Neutral editor draft validation; no provider requests or persistence. */
function documentScope(body) {
  if (!["Body", "Main"].includes(body.kind))
    fail("Choose a valid editor document kind.");
  const d = structuredClone(body.document);
  if (!d?.manifest || !d.templates || !d.parts || !Array.isArray(d.blocks))
    fail("Provide the current editor document.");
  const scopes = body.part ? d.parts : d.templates;
  const key = body.part || body.templateId;
  if (typeof key !== "string" || !Object.hasOwn(scopes, key))
    fail("The editor scope no longer exists.", 404);
  const root = scopes[key];
  if (!root) fail("The editor scope no longer exists.", 404);
  return { d, root };
}
export async function validatePreview(db, body) {
  const basis = {
    document: body.document,
    templateId: body.templateId,
    part: body.part,
    kind: body.kind,
  };
  if ((await editorRevision(basis)) !== body.revision)
    fail("Editor revision does not match the supplied document.", 409);
  const { d, root } = documentScope(body);
  const active = new Set(
    (
      await all(db, "SELECT id FROM plugins WHERE active=1 AND installed=1")
    ).map((p) => p.id),
  );
  const catalog = [
    ...definitions.map((b) => ({
      ...b,
      disabled: !!b.pluginId && !active.has(b.pluginId),
    })),
    ...d.blocks.filter(
      (b) => !definitions.some((core) => core.type === b.type),
    ),
    ...sharedPartDefinitions(d.parts, body.part || "", body.kind === "Main"),
  ];
  let result;
  try {
    result = editorBatch(root, body.commands, catalog);
  } catch (error) {
    fail(error.message || "Invalid block batch.");
  }
  if (!result.root.children?.length) {
    const initialized = editorBatch(
      result.root,
      [
        {
          type: "insert",
          blockType: "core/paragraph",
          parentId: result.root.id,
          index: 0,
        },
      ],
      catalog,
    );
    result.root = initialized.root;
    result.selectedId = initialized.selectedId;
  }
  let validation;
  if (body.kind === "Main") {
    validation = defaultTheme();
    validation.manifest.version = "1.0.0";
    validation.manifest.templates = validation.manifest.templates.filter(
      (t) => t.id === "home",
    );
    validation.manifest.templates[0].isDefault = true;
    validation.manifest.parts = {};
    validation.parts = {};
    validation.blocks = [];
    validation.templates = { home: result.root };
  } else {
    validation = d;
    if (body.part) validation.parts[body.part] = result.root;
    else validation.templates[body.templateId] = result.root;
  }
  const sanitized = validateDocument(validation, true);
  const after =
    body.kind === "Main"
      ? sanitized.templates.home
      : body.part
        ? sanitized.parts[body.part]
        : sanitized.templates[body.templateId];
  for (const id of themeMediaIds({
    ...sanitized,
    templates: { scope: after },
    parts: {},
  }))
    if (!(await db.prepare("SELECT id FROM media WHERE id=?").bind(id).first()))
      fail("A referenced media item no longer exists.");
  return {
    apiVersion: 1,
    revision: body.revision,
    root: after,
    selectedId: result.selectedId,
    changes: editorDiff(root, after),
    saved: false,
    published: false,
  };
}
