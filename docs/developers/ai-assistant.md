# AI Assistant

AI Assistant is an optional, bundled plugin (`com.colossal.ai-assistant`). It contributes its server routes and editor tool through the plugin registry. The shared editor shell mounts a generic `editor-tools` extension slot; it contains no provider-specific logic.

## Configuration

1. Install and activate **AI Assistant** in Plugins.
2. Open its admin page, check **Enable editor AI Assistant**, and choose OpenAI, Anthropic, Google Gemini, or **Custom provider**.
3. Supply the provider API key (and base URL for Custom provider). Available models load automatically when selecting a configured provider or leaving the credential field.
4. Save, and optionally use **Test saved provider** to verify model-list access without generating a response.
5. Open its chat button from any shared editor and choose an available text chat model from the model dropdown.

| Provider        | Environment key     | Transport                                |
| --------------- | ------------------- | ---------------------------------------- |
| OpenAI          | `OPENAI_API_KEY`    | Responses API, streaming, `store: false` |
| Anthropic       | `ANTHROPIC_API_KEY` | Messages API, streaming                  |
| Google Gemini   | `GEMINI_API_KEY`    | Generate Content API, SSE                |
| Custom provider | `CUSTOM_AI_API_KEY` | OpenAI-compatible Chat Completions, SSE  |

Provider, enabled state, legacy model preferences and output limit are stored in the database's `config` record `ai-assistant`. Plaintext keys are excluded from settings records, responses, exports and logs; encrypted credentials use separate reserved configuration records. AI credentials are stored as AES-256-GCM encrypted database records through the shared credential service. Configure `CMS_ENCRYPTION_KEY` once in hosting secrets, then enter keys on this page, including on Vercel. Explicit hosting overrides remain read-only. Blank key inputs preserve existing keys. Remove a key through your private environment configuration. Only the active provider needs a key.

Enable editor AI Assistant to reveal the provider dropdown to the left of the checkbox. New configurations start at **-- Select Provider --**. Only the selected provider’s fields appear. Discovery uses the entered key or saved credentials, without persisting entered credentials. There is no manual model field or query checkbox. The editor automatically loads the saved provider’s catalog and requires choosing a model before sending; failures show an error and a reload action. Custom providers must support `GET {CUSTOM_AI_BASE_URL}/models`. Queries time out after 20 seconds, cap responses at 1 MB per page and return at most 500 models across 10 pages. Catalogs are cached in server memory for five minutes, keyed by a private credential/endpoint fingerprint, with concurrent requests combined. Admin configuration queries refresh the cache. OpenAI/custom catalogs may include models unsuitable for text chat; Gemini results are filtered to `generateContent` support. Each chat model is checked against the provider catalog on the server.

**Custom provider** supports an OpenAI-compatible streaming Chat Completions API. Configure `CUSTOM_AI_BASE_URL` (for example `https://api.example.com/v1`) and `CUSTOM_AI_API_KEY`, then select one of its discovered models in the assistant. The plugin appends `/chat/completions`. Administrators can save the URL and key encrypted through this page on Node and Vercel; hosting environment overrides remain supported. Choose a trusted public HTTPS endpoint: it receives your editor context and custom API key. IP literals, local hostnames, embedded credentials, query parameters and custom ports are rejected; redirects are disabled. Custom URLs are administrator/hosting configuration, never chat instructions. Custom headers, provider tools and uploaded scripts are not accepted.

## Editor workflow

The editor tool opens a rounded composer docked at the bottom of the available canvas. Its buttons expand into animated, keyboard-accessible menus that inherit the editor’s light/dark appearance. **Build** proposes a reviewable batch; **Plan** and **Explain** return discussion only, with commands suppressed on the server. The model menu lists the saved provider’s discovered models, and its selection applies to this conversation’s requests. A valid legacy model preference is preselected; otherwise choose a model before sending. Use **+** or type **@** to attach block or media references from the current workspace. Enter sends; Shift+Enter inserts a newline. Conversations can be minimized, reopened or cleared; closing the bar keeps the current editor-session conversation. Streaming can be stopped.

The assistant reads the open editor scope: a template, a shared part, or a post/page Main document. It receives the actual block catalog, settings and placement rules, selected block, media names/IDs and recent chat. It proposes a bounded JSON batch, then the CMS validates and sanitizes that batch against the current document. The author reviews inserted, removed, moved and changed blocks, including before/after settings, before applying.

Applying commits the complete batch as one undo step. No partial mutation occurs if validation fails. The result updates the open draft without calling a save or publish endpoint. The content editor's existing autosave behavior still applies. **Undo**, **Save**, and **Publish** remain normal editor operations.

SHA-256 revisions include the full editor document and active scope. Changing the document or switching scope invalidates a pending proposal. Apply compares the current document synchronously with the exact preview basis. Validated previews are held privately by the editor service; modifying the returned preview object cannot change the committed tree. A consumed preview cannot be applied again.

Chat is held in memory until cleared or the editor closes. Requesting a response sends current block content/settings and recent chat to the selected provider. It does not send other templates' trees, provider keys, member records or database configuration. Post/page context also includes the current entry's title, excerpt, slug and status. The full editor document goes only to the CMS's authenticated preview endpoint for validation. Providers have their own retention policies; `store: false` is not a guarantee of zero provider retention.

## Live editor automation API

Reviewed integrations can inject `EditorAutomationApi` from `shared/editor-automation.service.ts` inside the editor provider scope. Same-window integrations can use `window.colossalEditorAutomation` after `colossal:automation-ready`; the global is removed when that editor is destroyed.

| Method                             | Result                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `getContext()`                     | Promise of detached scope, block tree, catalog, selection, dirty state and revision               |
| `getCatalog()`                     | Active block definitions, fields/defaults/options, appearance setting keys and child constraints  |
| `searchMedia(query?, type?)`       | Up to 30 media records with stable IDs and preview URLs                                           |
| `previewBatch(commands, revision)` | Server-validated detached tree and a before/after change list                                     |
| `applyBatch(preview)`              | One local undoable commit of a preview issued by this service                                     |
| `undo()`                           | Uses the shared editor undo journal                                                               |
| `getFeedback()`                    | Current validation/render errors, notices and undo/redo availability; also included in AI context |

```js
const editor = window.colossalEditorAutomation;
const context = await editor.getContext();
const preview = await editor.previewBatch(
  [
    {
      type: "insert",
      blockType: "core/container",
      parentId: context.root.id,
      index: 0,
      ref: "hero",
    },
    {
      type: "insert",
      blockType: "core/heading",
      parentId: "$hero",
      index: 0,
      settings: { text: "Welcome", level: "h1" },
    },
  ],
  context.revision,
);
// Present preview.changes to the author before applying.
await editor.applyBatch(preview);
```

Batches accept the existing Outline document commands: `insert`, `move`, `duplicate`, `remove`, `update`, `rename`, `icon`, and `paste`. An optional unique `ref` names an inserted block for later `$ref` IDs within the same batch. A batch has 1–40 commands; ordinary document limits still apply (2,000 blocks, eight nesting levels). Unknown settings, unsupported options, invalid nesting, shared-part cycles, missing media and script HTML are rejected or sanitized. Slider animation stays controlled by Swiper. Clipboard, selection and undo/redo commands use the existing [Outline API](outline-api.md).

## HTTP API

All routes are under `/api/admin/ai-assistant`. Authoring routes require an authenticated admin/editor. Settings and testing require an administrator. Mutations require JSON and the current workspace Origin. Chat, the plugin preview alias, media and test require the plugin to be installed and active. The neutral `POST /api/admin/editor/batch/preview` endpoint is available to authenticated administrators/editors independently of AI Assistant; `EditorAutomationApi` uses this core endpoint.

| Method | Path           | Purpose                                                                                                      |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------ |
| GET    | `/settings`    | Non-secret configuration and key configured/read-only status                                                 |
| POST   | `/settings`    | Save `{ settings, keys? }`; local keys are stored privately                                                  |
| GET    | `/models`      | Discovered catalog for the saved provider (admin/editor)                                                     |
| GET    | `/status`      | Enabled state, active provider/model, key availability                                                       |
| POST   | `/test`        | Verify saved provider model-list access                                                                      |
| POST   | `/chat`        | `{ message, context, model, provider?, history? }`; streaming proposal                                       |
| POST   | `/preview`     | `{ document, templateId, part, kind, revision, commands }`; validated scope tree/change list, no persistence |
| GET    | `/media?q=...` | Search media metadata and stable IDs                                                                         |

Chat/test use `application/x-ndjson` with `status`, `delta`, `proposal`, or `error` events. Only a complete `proposal` can be validated and applied. Truncated streams, cancellations, provider refusals/errors and invalid JSON leave the document unchanged. The UI places validation failures in recent chat so the next request can correct the proposal.

Provider requests have a 90-second timeout, bounded input/output and a configurable 512–16,384 output-token limit. A per-process member guard allows one concurrent request and at most ten starts per minute. It is not a distributed billing quota across serverless instances. Provider account budgets and rate limits remain authoritative. Hosting request-duration limits may be shorter than the plugin timeout.

## Verification

`node --test tests/ai-assistant.test.mjs` checks atomic rollback, fresh block references, revision checks, sanitization, native Main documents, all three streaming adapters, roles/origins, activation and secret masking. `CMS_E2E_SPEC=tests/e2e/ai-assistant.cy.mjs pnpm e2e` exercises provider settings, editor previews, apply, single-step undo and stale-proposal rejection using a mocked provider response. Tests do not call paid AI providers.

Provider references: [OpenAI streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Gemini API](https://ai.google.dev/api/generate-content).
