import {
  handleMaintenance,
  maintenanceState,
  maintenanceRender,
  maintenanceHtml,
} from "../../server/maintenance.mjs";
import { publicThemeRender } from "../../server/themes.mjs";
import { json } from "../../server/v2-utils.mjs";

export default {
  id: "com.colossal.maintenance",
  routes: [
    {
      scope: "public",
      path: "/api/themes/render",
      methods: ["GET"],
      async handle({ request, database }) {
        if (new URL(request.url).searchParams.has("themePreview")) return null;
        const state = await maintenanceState(database(), request);
        return state ? json(await maintenanceRender(database(), state)) : null;
      },
    },
    {
      scope: "public",
      path: "/api/public",
      methods: ["GET"],
      async handle({ request, database }) {
        return (await maintenanceState(database(), request))
          ? json({
              maintenance: true,
              settings: {},
              content: [],
              plugins: [],
              media: [],
            })
          : null;
      },
    },
    {
      scope: "admin",
      prefix: "/api/maintenance",
      methods: ["GET", "POST", "PUT", "DELETE", "HEAD"],
      admin: true,
      handle: ({ request, env, user, path }) =>
        handleMaintenance(request, env, user, path),
    },
  ],
  async document({ request, env, database }) {
    const state = await maintenanceState(database(), request);
    if (!state) return null;
    if (new URL(request.url).searchParams.has("themePreview")) {
      await publicThemeRender(request, env);
      return null;
    }
    const rendered = await maintenanceRender(database(), state);
    return {
      rendered,
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(state.settings.retryAfter),
        "X-Robots-Tag": "noindex",
      },
      html: (shell, transformed = rendered) =>
        maintenanceHtml(shell, transformed),
    };
  },
};
