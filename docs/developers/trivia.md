# Trivia

Trivia is a reviewed, bundled, non-core plugin (`com.colossal.trivia`). Install and activate it from **Plugins**, then configure it at **Trivia** (`/admin/trivia`). It needs no external provider or environment variables.

## Configuration

| Setting                     | Behavior                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Enable trivia               | Enables public question and answer endpoints.                                        |
| Content sources             | Pages and posts, pages only, or posts only. This restriction applies to every block. |
| Default questions per round | 1–20; defaults to 5.                                                                 |
| Exclude content             | Excludes selected page/post IDs from generation.                                     |

The plugin page displays the available question count and sample questions. Refresh preview reads current content; save persists settings in the database's `config` record named `trivia`.

## Trivia block

Add **Trivia** (`trivia/quiz`) from the editor's **Plugin** category. The Inspector configures:

- Heading and introduction.
- Source scope: plugin default, all eligible content, pages, posts, or the current page/post.
- Questions per round: `0` inherits the plugin default; `1–20` overrides it.
- Answer style: multiple choice or typed missing word.
- Shared appearance and layout controls.

Visitors start a round, complete each statement, receive correct/incorrect feedback, and see their final score. Feedback includes the exact source statement and a link to its page or post. Play again starts a shuffled round. Multiple blocks have independent scores and requests. The editor displays a safe placeholder rather than making public trivia requests.

## Generation and checking

Questions are English fill-in-the-blank statements extracted from published content. Native paragraph, heading and Formatted HTML content, legacy rich text and plain bodies are supported. Native blocks take precedence over stale legacy bodies. The generator removes scripts/markup, selects a distinctive word that appears once in a sentence, and supplies distractors from other eligible answers. It does not infer facts, generate semantic questions with AI, or accept synonyms as equivalent answers.

Drafts, pending content, future scheduled content, the assigned 404 page, and configured exclusions never become public questions. Scheduled content becomes eligible after its publication date. Generation considers the 200 most recently updated published/scheduled records, caps text at 50,000 characters per source, and generates at most 8 questions per source and 500 total. Each round uses up to the requested number of available questions.

The server derives opaque question IDs from source ID, statement and answer. The public question payload contains choices but no correctness marker or answer/explanation fields. Answer submissions are checked against current eligible content; deleted, unpublished or changed questions return `409` and require a new round. Comparison ignores case, surrounding whitespace, accents and most punctuation. Scores live only in the visitor's current block instance; responses and visitor identities are not stored.

## API

| Method | Endpoint                | Access                                 | Purpose                                            |
| ------ | ----------------------- | -------------------------------------- | -------------------------------------------------- |
| GET    | `/api/trivia/questions` | Public; active/enabled plugin required | Generate a shuffled round.                         |
| POST   | `/api/trivia/answer`    | Public; active/enabled plugin required | Check one response and return feedback.            |
| GET    | `/api/admin/trivia`     | Administrator                          | Settings, source list, question count and preview. |
| POST   | `/api/admin/trivia`     | Administrator                          | Validate and save settings.                        |

Question query parameters: optional `count=1..20`, `scope=default|all|pages|posts|current`, and `contentId` (required for `current`). Omitting count uses the saved default. A block may narrow the plugin's allowed sources but cannot expand them.

```json
{
  "id": "<64-character question ID>",
  "answer": "collections",
  "scope": "default",
  "contentId": ""
}
```

Successful answer responses contain `correct`, `answer`, `explanation`, and `source: { id, title, url }`. Empty/oversized answers and invalid scopes/counts return `400`; unavailable trivia returns `404`. These endpoints use `Cache-Control: no-store`.

## Integration and validation

Plugin-owned implementation lives in `plugins/trivia/`. Composition roots register the manifest, lazy admin component, server routes, block renderer/styles and browser hydration. The shared editor's declarative catalog supplies the block definition; the core contains no trivia generation or scoring logic.

```powershell
node --test tests/trivia.test.mjs tests/plugin-registry.test.mjs
pnpm build
```

Regression coverage includes publication/source restrictions, native content extraction, script removal, opaque questions, answer checking, stale questions, inactive plugins, admin permissions and declarative rendering.
