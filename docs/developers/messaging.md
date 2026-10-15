# Messaging

Messaging is a reviewed, bundled, non-core plugin (`com.colossal.messaging`). Install and activate it from **Plugins**, then open **Messaging** (`/admin/messaging`). Configuration, inbox UI, rendering and submission handlers belong to the plugin; email delivery uses the shared SMTP service.

## Configure the form

**Messaging → Settings** controls the public heading, introduction, submit label, confirmation message, acceptance of messages and email notifications. Add, remove or reorder up to 20 fields. Every field has a unique internal key, a label, a type, a required flag and an optional placeholder. Dropdown choices are entered one per line.

| Type      | Behavior                                                              |
| --------- | --------------------------------------------------------------------- |
| Text      | Single-line text, up to 1,000 characters.                             |
| Email     | Validated email address; the first email field identifies the sender. |
| Textarea  | Multiline message, up to 5,000 characters.                            |
| Telephone | Telephone text; no country-specific format is enforced.               |
| URL       | HTTP or HTTPS URL.                                                    |
| Number    | A finite numeric value.                                               |
| Select    | One of 1–20 configured choices.                                       |
| Checkbox  | Stored as Yes/No; a required checkbox must be checked.                |

Existing inbox entries preserve the labels and values from the form at submission time. Changing the form does not rewrite earlier messages. The default `name` field supplies the sender name; otherwise it is Visitor. An optional field with key `subject`, configured through the API, supplies a subject; otherwise it is Website message.

## Block and Glossy template

Add **Message form** (`messaging/form`) from the **Plugin** block category. The Inspector supports one or two columns, optional heading/description overrides and shared appearance controls. Empty overrides inherit the current plugin settings. Multiline fields span both columns; small screens use one column. Editors and previews display a safe placeholder without submitting messages.

Glossy includes a **Contact** page template with native title, introductory text, page content, Message form and shared Sidebar. Create or edit a page, assign Contact through the editor or Quick Edit, then publish it. The migration adds the template to existing Glossy themes without creating a page or replacing an existing custom Contact layout.

## Inbox and bulk actions

The Inbox displays 50 messages per page. Filter by all, unread, read, archived or trash; search applies to the currently loaded page. All messages excludes trash. Opening an unread message marks it read. Details show the submitted field snapshots and source page, with an email reply link when an email address was provided.

The admin navigation displays a Messaging badge when there are received messages. It counts all messages except trash (including read and archived messages), refreshes every 30 seconds while the admin is visible and when the window gains focus, and updates after inbox actions. Zero hides the badge. The count is an administrator-only plugin contribution; the shared shell does not query message records.

Select messages to mark read/unread, archive, move to trash or restore to the unread inbox. Trash is recoverable; no permanent deletion action is provided. Email retry accepts up to five selected messages and skips already-sent messages and trash. Reply by email opens the administrator's mail application; it does not send a reply through the CMS.

## SMTP notifications

Configure and enable shared mail under **Settings → SMTP**. Messaging's **Send notifications through SMTP** setting is enabled by default. Set **Notification recipient**, or leave it blank to use the shared SMTP From address. The shared transport supplies the configured sender and Reply-to address; visitors cannot override those headers.

The server stores each message before attempting delivery. Notifications contain plain-text field labels/values, the source path and message ID. The inbox records Disabled, Not configured, Sent or Failed delivery status. A mail failure still returns a successful form receipt because the message is saved. Use the retry bulk action after correcting SMTP settings. SMTP acceptance does not guarantee inbox delivery.

Messaging adds no environment keys and never exposes SMTP credentials in the public form response. SMTP configuration and encrypted credentials continue to use the existing shared mail service. Native Cloudflare Workers require a compatible `MAIL` adapter; Node hosting uses the supplied SMTP transport.

## API

| Method | Endpoint                                          | Access                        | Purpose                                                 |
| ------ | ------------------------------------------------- | ----------------------------- | ------------------------------------------------------- |
| GET    | `/api/messaging/form`                             | Public; active/enabled plugin | Read public fields/text and obtain a submission token.  |
| POST   | `/api/messaging/submit`                           | Public; same-origin request   | Validate and save a message, then attempt notification. |
| GET    | `/api/admin/messaging/settings`                   | Administrator                 | Read settings and non-secret SMTP configuration.        |
| POST   | `/api/admin/messaging/settings`                   | Administrator                 | Validate and save the complete settings object.         |
| GET    | `/api/admin/messaging/messages?status=all&page=1` | Administrator                 | Read filtered inbox entries and total count.            |
| GET    | `/api/admin/messaging/count`                      | Administrator                 | Read the navigation count, excluding trash.             |
| POST   | `/api/admin/messaging/bulk`                       | Administrator                 | Apply an action to selected IDs.                        |

Submission payload:

```json
{
  "token": "token returned by GET /api/messaging/form",
  "website": "",
  "sourcePath": "/contact",
  "values": {
    "name": "Jane Visitor",
    "email": "jane@example.com",
    "message": "I would like to discuss a project."
  }
}
```

Keys in `values` must match the configured fields. Unknown keys are rejected. A successful new submission returns `201` with `{ "ok": true, "message": "..." }`; resubmitting the same saved token returns success without a second message or email. Tokens expire after 30 minutes and become invalid when field configuration changes. Expired forms return `409` and must be reloaded. Validation failures return `400`, cross-origin submissions `403`, unavailable forms `404` and excessive form requests `429`.

Bulk payload:

```json
{ "ids": ["message-id"], "action": "archive" }
```

Actions are `read`, `unread`, `archive`, `trash`, `restore` and `retry-email`. The limit is 100 IDs per operation, or five for retries. Administrator mutations use the existing authenticated, same-origin API boundary and write activity entries.

## Storage and protections

Migration `drizzle/0008_messaging.sql` adds `messaging_messages` and `messaging_tokens`. Settings use the `config` record named `messaging`. SQLite and Cloudflare D1 use the SQL schema; MongoDB derives collections and indexes through the production schema pipeline. The inbox uses count and offset pagination supported by all three adapters.

Messages remain in the configured database until an administrator manages them; the plugin does not enforce automatic retention or forward attachments. It stores no visitor IP addresses. Public form loading has a 30-request-per-minute, per-process IP limit, short-lived tokens and a hidden honeypot. Submission validation is server-side, notification text is plain text and form content is created through safe DOM APIs. These controls are basic abuse protections, not a distributed limiter or CAPTCHA service. Apply hosting/WAF limits if stronger protection is needed.

## Verification

Run `node --test tests/messaging.test.mjs` for settings and field validation, persistence-before-delivery, SMTP failure handling, idempotency, token expiry, origin/honeypot checks, administrator bulk actions, Glossy integration and MongoDB pagination. Run `pnpm build` to compile the admin, public application and server. Tests use a mock mail adapter and do not send real email.
