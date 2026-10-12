import { handleLoginSecurity } from "../../server/login-security.mjs";
export default {
  id: "com.colossal.login-security",
  routes: [
    {
      scope: "admin",
      prefix: "/api/admin/login-security",
      methods: ["GET", "POST", "PUT", "DELETE"],
      admin: true,
      handle: ({ request, env, user }) =>
        handleLoginSecurity(request, env, user),
    },
  ],
};
