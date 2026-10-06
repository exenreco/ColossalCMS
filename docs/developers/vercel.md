# Vercel deployment

Vercel reads **`vercel.json`**, not `vercel.yaml`. The root configuration builds both Angular applications into `dist/client` and routes dynamic requests to `api/cms.mjs`, a Node 24 Function. There is no persistent `pnpm start` process on this host.

The server build also generates `dist/server/vercel-runtime.mjs`. This bundles the HTML sanitizer with its parser so Vercel does not need to load an ESM parser through CommonJS `require()`. Database and storage SDKs remain external dependencies. Run the build before importing the Function entry point.

## Project settings

| Setting           | Value                                         |
| ----------------- | --------------------------------------------- |
| Git repository    | `exenreco/ColossalCMS`                        |
| Production branch | `main`                                        |
| Framework preset  | Other                                         |
| Root directory    | Repository root                               |
| Install command   | `pnpm install --frozen-lockfile --prod=false` |
| Build command     | `pnpm build`                                  |
| Output directory  | `dist/client`                                 |
| Node.js           | 24.x                                          |

The committed JSON supplies build settings and routing. Admin navigation/assets, authentication, health checks, media, and APIs go through the Function. Existing public static files use Vercel's filesystem; other routes reach the public application through the handler. Dynamic responses use `Cache-Control: no-store`.

## Environment variables

Set these in **Project Settings → Environment Variables**, then deploy:

Changes to environment variables apply to new deployments. Verify the Production scope and any branch overrides, then redeploy. Provider option values tolerate surrounding spaces, paired quotes and capitalization; credentials and database names are kept exactly as entered.

| Variable                | Value                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| `CMS_PUBLIC_URL`        | Exact HTTPS production origin, such as `https://your-project.vercel.app` |
| `CMS_DB_PROVIDER`       | `mongodb`                                                                |
| `CMS_STORAGE_PROVIDER`  | `gridfs`                                                                 |
| `MONGODB_URI`           | Your private MongoDB connection string                                   |
| `MONGODB_DATABASE`      | `ColossalCMS`                                                            |
| `MONGODB_GRIDFS_BUCKET` | `colossal_media`                                                         |
| `MONGODB_DNS_SERVERS`   | `1.1.1.1,8.8.8.8`, or empty for system DNS                               |
| `CMS_SETUP_TOKEN`       | Random token of at least 32 characters for first setup                   |

D1 and R2-compatible storage are also supported using the variables in `.env.example`. Local storage is rejected because Function filesystems are not durable. Do not upload `.env.production`; the Function uses hosting variables only. Private dotenv/local data are excluded from the deployment bundle.

After deployment, open `/setup`, create the administrator, and sign in at `/login`. Remove the setup token after credentials exist and redeploy. Database initialization and missing built-in data are handled on the first Function invocation. Warm invocations reuse database/storage clients; cold invocations reconnect. `/healthz` checks that initialization completed.

## Serverless differences

- Configure provider credentials in Vercel, then redeploy. Connections presents provider configuration as read-only; file saves and background connection console jobs are disabled.
- Member password API operations remain available. Local-to-production migration must run from the development server with access to SQLite/uploads, before switching to the Vercel production application.
- No heartbeat is necessary to keep a Function process alive. Credentials and records live in external providers, not Function memory.
- Authentication attempt counters are per Function instance; use host-level protections for additional distributed request limiting.
- Vercel Function request **and response** payloads are limited to **4.5 MB**. Multipart overhead counts. Existing large media uploads, ZIP installation/export, and large file downloads can exceed this limit; range requests may help playback but do not provide a complete large-file transfer solution. Direct-to-storage large uploads are not implemented here.
- The Function has a configured 60-second maximum duration. Initialization and synchronous operations must complete within it; large maintenance jobs belong on a persistent runtime.
- Git preview deployments require their own exact `CMS_PUBLIC_URL` and isolated provider configuration. Using the production origin on a preview URL causes browser mutation-origin checks to fail. Do not point an unreviewed preview at production data.

## Verification

Run `pnpm test` for the handler's connection reuse/retry, authentication, origin checks, routing, and serverless restrictions. Run `pnpm build` before deployment. A real Vercel deployment and its provider credentials still need verification on the hosting account.

References: [Vercel JSON configuration](https://vercel.com/docs/project-configuration/vercel-json), [Node Functions](https://vercel.com/docs/functions/runtimes/node-js), and [Function limits](https://vercel.com/docs/functions/limitations).
