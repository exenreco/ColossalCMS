# Password-protected files

Add **Password-protected file** (`core/protected-file`) from the Content block category in the theme, page or post editor. Set the **Button label** in the Inspector, choose an uploaded file from the media library, enter a file password and click **Create protected copy**. Save/publish the page or template normally.

The selected original remains unchanged, with its existing public/private availability. The block creates an independent copy under a private storage key; that copy is not a public Media Library record. Updating or deleting the original does not modify the copy. Choosing another media file creates another copy. Removing a block does not delete its stored copy, so revisions and duplicated blocks can continue using it.

Passwords require at least eight characters and no more than 72 UTF-8 bytes. The server hashes them with bcrypt at cost 12. Passwords and hashes never enter block settings, published HTML, revisions or the public configuration API. The Inspector can replace an existing password but cannot reveal it. Changing a password affects every block referencing that protected copy.

Visitors click the button, enter the password in an accessible dialog and receive the downloaded file after server validation. Every download requires the current password. There are no reusable public download URLs or browser-stored passwords. Editor previews disable downloads. The button supports the editor's shared appearance controls.

## API

| Method | Endpoint                            | Access                    | Behavior                                                                                                |
| ------ | ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| POST   | `/api/admin/protected-files`        | Administrator/editor      | `{ "mediaId": "...", "password": "..." }` creates a copy and returns `{ "id", "name", "hasPassword" }`. |
| GET    | `/api/admin/protected-files/:id`    | Administrator/editor      | Reads non-secret copy metadata.                                                                         |
| POST   | `/api/admin/protected-files/:id`    | Administrator/editor      | `{ "password": "..." }` replaces the copy's password.                                                   |
| POST   | `/api/protected-files/:id/download` | Public; password required | `{ "password": "..." }` returns the attachment bytes.                                                   |

Administrator mutations use the existing authenticated, same-origin boundary. Public downloads also require a same-origin request. Incorrect passwords return `401`; cross-origin requests return `403`; missing copies return `404`; GET/HEAD downloads return `405`. The download response uses `Content-Disposition: attachment`, `Cache-Control: private, no-store`, `nosniff` and a restrictive sandbox policy. Protected copies cannot be accessed through `/api/media/:id/file`.

The database limits each copy/client-IP combination to ten attempts per 15-minute window, including successful downloads. Attempts reserve a slot atomically before bcrypt comparison. Stored attempt IDs hash the copy ID and trusted hosting IP rather than retaining the raw IP. Expired attempts are removed on subsequent requests. A blocked client receives `429` until the window expires.

## Persistence and hosting

Migration `drizzle/0009_protected_files.sql` adds `protected_files` and `protected_file_attempts`. SQLite, Cloudflare D1 and MongoDB use the same migration-derived schema and supported prepared-query grammar. Private copy bytes use the configured local-files, GridFS or R2-compatible storage adapter. Local-to-production migration includes protected records and copy bytes. No additional environment variables are required.

Copies support uploaded files up to 25 MB. External media URLs must first be imported into storage; the server does not fetch arbitrary external URLs. The hosting provider's function response-size limits still apply to downloads. Browser download implementations receive the bytes as a Blob and release the temporary object URL after starting the download.

Anyone who already has the original public file or downloads the copy can retain or share those bytes; password protection applies to retrieving the private copy through the CMS. Use a strong file password and an HTTPS production origin.

## Verification

`node --test tests/protected-files.test.mjs` covers authentication/origin checks, private copy isolation, unchanged originals, bcrypt hashing and password rotation, metadata redaction, attachment responses, rate-limit enforcement/expiry and safe preview rendering. Queries are also checked against the production MongoDB grammar while executing against SQLite.
