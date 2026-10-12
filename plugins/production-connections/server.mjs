import { handleConnections } from "../../server/production-connections.mjs";
export default {
  id: "com.colossal.production-connections",
  routes: [
    {
      scope: "admin",
      prefix: "/api/admin/connections",
      methods: ["GET", "POST", "PUT", "DELETE"],
      admin: true,
      handle: ({ request, env, user }) => handleConnections(request, env, user),
    },
  ],
};
