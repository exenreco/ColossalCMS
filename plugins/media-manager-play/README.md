# Media Manager Play Billing

A reviewed, bundled Colossal CMS plugin. The CMS host supplies HTTPS; this plugin
supplies the purchase-verification API. No separate Cloud Run service is needed.
It is not a TLS proxy, media server, or arbitrary uploaded-code plugin. Compile
and deploy the CMS after installing these source files and registry contributions.

## Current state

Verification is disabled by default. Deploy the current CMS build to receive
the encrypted configuration inputs. Google workload identity setup and Android
integration remain separate prerequisites. Mock-provider tests are not evidence
of a successful live payment. No private Google keys or hosting credentials are
shipped in the plugin.

The existing Google identity is
`media-manager-play-verifier@portfolio-457414.iam.gserviceaccount.com`, with
Media Manager-only Play purchase permissions. Those permissions do not authorize
a Vercel deployment to impersonate it until Workload Identity Federation is set up.

## Installation and activation

The manifest is registered in both plugin catalogs, the server contribution in
`server/plugin-runtime.mjs`, and the admin component in the lazy component registry.
The Node production adapter passes only the plugin's server environment binding.
No package dependency or database migration is required. Availability uses the
existing config table; the three configuration fields use its encrypted credential
records. Raw receipts and purchase tokens are not stored in the CMS database.

1. Configure a permanent HTTPS CMS origin and a stable `CMS_ENCRYPTION_KEY` in
   hosting secrets. Open the plugin page to save the three verification fields
   encrypted in the CMS database.
2. Configure Google Workload Identity Federation for the exact production hosting
   project/team/environment. For Vercel, use its signed deployment OIDC identity.
   Bind only that production subject to `roles/iam.workloadIdentityUser` on the
   existing verifier service account. Do not grant project-wide Editor/Owner.
3. Enable the Security Token Service and IAM Service Account Credentials APIs as
   required by federation. Keep the Play Developer API enabled.
4. Build and deploy the CMS. In Plugins activate **Media Manager Play Billing**;
   open **Media Manager** in the admin menu and enable verification. Configuration
   indicators do not contact Google; validate with a real test receipt afterward.
5. Build Android integration that sends receipts from native code over HTTPS and
   consumes the verifier response. This plugin does not change the existing APK.

Google IAM/federation changes and deployment require the owner's authorization.
Existing hosting charges/limits still apply. This plugin does not upgrade Google
Cloud billing or provision new hosting.

## Encrypted plugin settings

The plugin page provides three masked inputs: Play licensing public key,
workload identity provider audience, and verifier service account. All three are
stored through the shared credential vault as AES-256-GCM envelopes in the config
table. The vault uses a random IV and binds each ciphertext to its field name.
Raw values are never returned by the admin API, written to logs or placed in
ordinary plugin settings. Blank inputs preserve existing values; enter a replacement
to update a field. Validation of every replacement happens before writes.

The stable 32-byte `CMS_ENCRYPTION_KEY` must remain in hosting secrets, outside
the database it encrypts. Without it, the page reports that encrypted storage is
unavailable and rejects credential writes. Keep the original key across deploys.

Server requests decrypt the saved values on demand, so saving a replacement does
not require a redeploy. Existing hosting environment overrides retain precedence
and are marked managed/read-only. If previously configured there, use the existing
Connections credential migration, verify the encrypted copies, then remove those
three overrides and redeploy before editing the fields in this page. Workload
federation and Pub/Sub still require external Google/hosting setup.

## Hosting bindings and legacy environment fallbacks

| Variable                               | Value                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MEDIA_MANAGER_PLAY_PUBLIC_KEY`        | Legacy fallback; prefer the encrypted Play licensing public key input                                         |
| `MEDIA_MANAGER_PLAY_WIF_AUDIENCE`      | `//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER` |
| `MEDIA_MANAGER_PLAY_SERVICE_ACCOUNT`   | `media-manager-play-verifier@portfolio-457414.iam.gserviceaccount.com`                                        |
| `VERCEL_OIDC_TOKEN`                    | Signed token provided by Vercel; do not paste a fixed token into CMS settings                                 |
| `MEDIA_MANAGER_PLAY_PUSH_AUDIENCE`     | Exact HTTPS notification URL configured as the Pub/Sub OIDC audience                                          |
| `MEDIA_MANAGER_PLAY_PUSH_EMAIL`        | Dedicated Pub/Sub push-authentication service account email                                                   |
| `MEDIA_MANAGER_PLAY_PUSH_SUBSCRIPTION` | `projects/PROJECT_ID/subscriptions/SUBSCRIPTION_ID`                                                           |

This initial hosting adapter supports Vercel's environment-provided OIDC token.
On another host, provide a trusted, refreshable `identityToken()` supplier in the
server-only `env.MEDIA_MANAGER_PLAY` binding. A static copied access/OIDC token is
not a production setup. No private-key fallback is implemented.

## Android protocol

`POST /api/media-manager/play/verify`, JSON:

```json
{
  "receipt": "<exact Purchase.originalJson>",
  "signature": "<Purchase.signature>"
}
```

The exact Google-signed receipt is the proof of possession for this accountless
app. Treat it as confidential. No CMS login, API key embedded in the APK, or
client ownership flag can substitute for it. The server verifies RSA signature,
package `com.tvshowmanager.app`, product `remove_ads`, quantity and token before
any Google purchase lookup. Signed pending receipts are accepted as proof of a
transaction, but their purchase state is never trusted as its current status.

Example successful response:

```json
{
  "owned": true,
  "state": "PURCHASED",
  "acknowledged": true,
  "checkedAt": "2026-10-30T00:00:00.000Z",
  "recheckAfterSeconds": 30
}
```

Google ProductPurchaseV2 is checked fresh on every accepted verification. Only a
completed, unconsumed, unrefunded quantity-one purchase grants ad removal. Pending,
canceled, voided or fully refunded purchases do not. Completed purchases are
acknowledged server-side; this is non-consumable, so they are never consumed.
Temporary Google/identity/acknowledgement failures return 503, rather than a false
revocation. Android must retain previously verified ownership on transient errors,
retry with backoff and honor 429; it must not interpret errors as a free entitlement.

Android also needs a distinct private server-verification record: a server-confirmed
PURCHASED result may arrive while Play's local signed receipt still says pending.
Do not fabricate a new Google signature or reuse the old native PURCHASED-only
receipt cache for this result. Bind it to the signed transaction and validate
server responses in native code. Restore queries send each valid signed transaction;
fresh server state can then override stale local Store state while online.

## Notifications and operations

Configure Play real-time developer notifications to a Pub/Sub topic, with an
authenticated push subscription targeting
`POST /api/media-manager/play/notifications`. Use the exact audience, subscription
and dedicated push identity above. The endpoint verifies Google's RS256 ID token,
issuer, audience, email, expiry and signature before reading notification data.
It rejects unsigned webhooks. It checks Google for current status instead of
trusting event order/type; duplicate events safely repeat that check and
idempotent acknowledgement. Transient errors stay non-2xx so Pub/Sub retries.

This version keeps no durable entitlement database and sends no device push.
Refund events trigger a current-state check, while Android learns the updated
status on its next online verification. It cannot revoke an offline device
instantly. It does not log receipts, tokens or Google authorization payloads.
If accounts or cross-platform entitlements are later added, implement durable
token-to-account binding and event processing before expanding that scope.

Local per-instance safeguards limit request bodies to 24 KB, requests to 200 per
minute, and repeated verification of the same signed token to once per three
seconds. Put distributed rate limits in the hosting firewall before exposing
production traffic; per-instance memory limits alone are not global protection.
Monitor 5xx rates without logging request bodies or Authorization headers.

Run `node --test tests/media-manager-play.test.mjs tests/plugin-registry.test.mjs`,
the CMS regression suite, and `pnpm build`. Then repeat live pending approval,
decline, refund, acknowledgement and restore tests against the deployed URL.

References: [Play verification](https://developer.android.com/google/play/billing/security),
[ProductPurchaseV2](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2),
[Vercel federation](https://vercel.com/docs/oidc/gcp),
[Google notifications](https://developer.android.com/google/play/billing/rtdn-reference).
