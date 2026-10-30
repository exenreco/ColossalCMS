// Kept server-side by productionRuntime. No private service-account keys.
export function playHosting(config) {
  return {
    publicKey: (config.MEDIA_MANAGER_PLAY_PUBLIC_KEY || "").replace(/\s/g, ""),
    audience: config.MEDIA_MANAGER_PLAY_WIF_AUDIENCE || "",
    serviceAccount: config.MEDIA_MANAGER_PLAY_SERVICE_ACCOUNT || "",
    // Vercel provides the deployment's signed OIDC token. Google validates its
    // issuer, audience and scoped subject using the configured federation policy.
    identityToken: () => config.VERCEL_OIDC_TOKEN || "",
    pushAudience: config.MEDIA_MANAGER_PLAY_PUSH_AUDIENCE || "",
    pushEmail: config.MEDIA_MANAGER_PLAY_PUSH_EMAIL || "",
    subscription: config.MEDIA_MANAGER_PLAY_PUSH_SUBSCRIPTION || "",
  };
}

// Function tokens are request headers, not build-time environment variables.
// Keep the supplier request-local: warm/concurrent invocations must not share it.
export function playRequestHosting(binding, headers, isVercel) {
  if (!isVercel) return binding;
  const token = headers["x-vercel-oidc-token"];
  return {
    ...binding,
    identityToken: () =>
      typeof token === "string" && token.length <= 20000 ? token : "",
  };
}
