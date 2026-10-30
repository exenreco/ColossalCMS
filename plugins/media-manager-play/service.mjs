// Host-neutral Web Crypto/fetch implementation. No private keys or media files.
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API =
  "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/";
const encoder = new TextEncoder();
export const ID = "com.colossal.media-manager-play";
export class PlayError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status) => {
  throw new PlayError(message, status);
};
function bytes(value, url = false) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 32000 ||
    !(url ? /^[A-Za-z0-9_-]+$/ : /^[A-Za-z0-9+/]+={0,2}$/).test(value)
  )
    fail("Invalid encoded data.");
  try {
    return Uint8Array.from(
      atob(value.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
  } catch {
    fail("Invalid encoded data.");
  }
}
export async function readBody(request) {
  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    fail("JSON is required.", 415);
  const reader = request.body?.getReader();
  if (!reader) fail("A request body is required.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 24000) {
      await reader.cancel();
      fail("Request too large.", 413);
    }
    chunks.push(value);
  }
  try {
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    const input = JSON.parse(new TextDecoder().decode(data));
    if (!input || typeof input !== "object" || Array.isArray(input))
      fail("Invalid JSON.");
    return input;
  } catch (error) {
    if (error instanceof PlayError) throw error;
    fail("Invalid JSON.");
  }
}
export function readiness(config = {}) {
  return {
    packageName: "com.tvshowmanager.app",
    productId: "remove_ads",
    identityConfigured:
      /^\/\/iam\.googleapis\.com\/projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(
        config.audience || "",
      ) &&
      /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(
        config.serviceAccount || "",
      ) &&
      typeof config.identityToken === "function",
    receiptKeyConfigured: !!config.publicKey,
    notificationsConfigured:
      /^https:\/\//.test(config.pushAudience || "") &&
      /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(
        config.pushEmail || "",
      ) &&
      /^projects\/[^/]+\/subscriptions\/[^/]+$/.test(config.subscription || ""),
  };
}
export function createPlayService({ fetcher = fetch, clock = Date.now } = {}) {
  let certs,
    certExpiry = 0;
  const access = new Map(),
    recent = new Map();
  let minute = 0,
    calls = 0;
  function budget() {
    const bucket = Math.floor(clock() / 60000);
    if (bucket !== minute) {
      minute = bucket;
      calls = 0;
    }
    if (++calls > 200)
      fail("Too many verification requests. Try again shortly.", 429);
  }
  async function remote(url, options = {}) {
    let response;
    try {
      response = await fetcher(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      fail("Purchase verification is temporarily unavailable.", 503);
    }
    return response;
  }
  async function jsonResponse(response) {
    if (!response.ok)
      fail("Purchase verification is temporarily unavailable.", 503);
    try {
      return await response.json();
    } catch {
      fail("Invalid verification service response.", 503);
    }
  }
  async function accessToken(config) {
    if (!readiness(config).identityConfigured)
      fail("Purchase verification is not configured.", 503);
    const cacheKey = config.audience + config.serviceAccount;
    const saved = access.get(cacheKey);
    if (saved?.until > clock()) return saved.token;
    const subject = await config.identityToken();
    if (typeof subject !== "string" || subject.length > 20000 || !subject)
      fail("Hosting identity unavailable.", 503);
    const sts = await jsonResponse(
      await remote("https://sts.googleapis.com/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          audience: config.audience,
          grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
          requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
          subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
          subject_token: subject,
          scope: "https://www.googleapis.com/auth/cloud-platform",
        }),
      }),
    );
    if (typeof sts.access_token !== "string" || !sts.access_token)
      fail("Hosting identity unavailable.", 503);
    const result = await jsonResponse(
      await remote(
        "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" +
          encodeURIComponent(config.serviceAccount) +
          ":generateAccessToken",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + sts.access_token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ scope: [SCOPE], lifetime: "600s" }),
        },
      ),
    );
    if (typeof result.accessToken !== "string" || !result.accessToken)
      fail("Hosting identity unavailable.", 503);
    const expiry = Date.parse(result.expireTime);
    if (!Number.isFinite(expiry) || expiry <= clock() + 30000)
      fail("Hosting identity unavailable.", 503);
    if (access.size > 8) access.clear();
    access.set(cacheKey, {
      token: result.accessToken,
      until: Math.min(expiry - 30000, clock() + 540000),
    });
    return result.accessToken;
  }
  async function proof(input, config) {
    if (typeof input.receipt !== "string" || input.receipt.length > 12000)
      fail("A signed Play receipt is required.", 401);
    let key;
    try {
      key = await crypto.subtle.importKey(
        "spki",
        bytes(config.publicKey),
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" },
        false,
        ["verify"],
      );
    } catch {
      fail("Receipt verification is not configured.", 503);
    }
    let valid = false;
    try {
      valid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        bytes(input.signature),
        encoder.encode(input.receipt),
      );
    } catch {}
    if (!valid) fail("Invalid Play receipt.", 401);
    let receipt;
    try {
      receipt = JSON.parse(input.receipt);
    } catch {
      fail("Invalid Play receipt.", 401);
    }
    const token = receipt.purchaseToken || receipt.token;
    if (
      receipt.packageName !== "com.tvshowmanager.app" ||
      receipt.productId !== "remove_ads" ||
      (receipt.quantity ?? 1) !== 1 ||
      typeof token !== "string" ||
      !token ||
      token.length > 4096
    )
      fail("Invalid Play receipt.", 401);
    return token;
  }
  async function current(token, config) {
    const bearer = await accessToken(config);
    const root = API + "com.tvshowmanager.app/";
    const response = await remote(
      root + "purchases/productsv2/tokens/" + encodeURIComponent(token),
      { headers: { Authorization: "Bearer " + bearer } },
    );
    if ([404, 410].includes(response.status))
      return { owned: false, state: "NOT_OWNED", acknowledged: false };
    const purchase = await jsonResponse(response);
    const state = purchase.purchaseStateContext?.purchaseState;
    const items = purchase.productLineItem;
    if (
      !["PURCHASED", "PENDING", "CANCELLED"].includes(state) ||
      !Array.isArray(items) ||
      items.length !== 1 ||
      items[0].productId !== "remove_ads"
    )
      fail("Unexpected purchase response.", 503);
    const offer = items[0].productOfferDetails;
    if (
      state === "PURCHASED" &&
      (!Number.isInteger(offer?.quantity) ||
        offer.quantity < 1 ||
        !Number.isInteger(offer?.refundableQuantity) ||
        offer.refundableQuantity < 0 ||
        offer.refundableQuantity > offer.quantity ||
        ![
          "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
          "CONSUMPTION_STATE_CONSUMED",
        ].includes(offer?.consumptionState))
    )
      fail("Unexpected purchase response.", 503);
    const owned =
      state === "PURCHASED" &&
      offer?.quantity === 1 &&
      offer?.refundableQuantity === 1 &&
      offer?.consumptionState === "CONSUMPTION_STATE_YET_TO_BE_CONSUMED";
    let acknowledged =
      purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    if (owned && !acknowledged) {
      const ack = await remote(
        root +
          "purchases/products/remove_ads/tokens/" +
          encodeURIComponent(token) +
          ":acknowledge",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + bearer,
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      if (!ack.ok)
        fail(
          "Payment confirmed; acknowledgement will be retried. Try again shortly.",
          503,
        );
      acknowledged = true;
    }
    return {
      owned,
      state: owned ? "PURCHASED" : state === "PURCHASED" ? "NOT_OWNED" : state,
      acknowledged,
    };
  }
  async function authenticatePush(request, config) {
    if (!readiness(config).notificationsConfigured)
      fail("Notifications are not configured.", 503);
    const jwt = (request.headers.get("authorization") || "").match(
      /^Bearer ([A-Za-z0-9_.-]{1,20000})$/,
    )?.[1];
    let parts, header, claims;
    try {
      parts = jwt.split(".");
      if (parts.length !== 3) throw Error();
      header = JSON.parse(new TextDecoder().decode(bytes(parts[0], true)));
      claims = JSON.parse(new TextDecoder().decode(bytes(parts[1], true)));
    } catch {
      fail("Unauthorized notification.", 401);
    }
    const now = Math.floor(clock() / 1000);
    if (
      header.alg !== "RS256" ||
      !["accounts.google.com", "https://accounts.google.com"].includes(
        claims.iss,
      ) ||
      claims.aud !== config.pushAudience ||
      claims.email !== config.pushEmail ||
      claims.email_verified !== true ||
      !Number.isFinite(claims.exp) ||
      claims.exp <= now ||
      !Number.isFinite(claims.iat) ||
      claims.iat > now + 60 ||
      claims.iat < now - 3700
    )
      fail("Unauthorized notification.", 401);
    if (!certs || certExpiry < clock()) {
      certs = await jsonResponse(
        await remote("https://www.googleapis.com/oauth2/v3/certs"),
      );
      certExpiry = clock() + 300000;
    }
    const jwk = certs.keys?.find(
      (k) => k.kid === header.kid && k.kty === "RSA" && k.alg === "RS256",
    );
    if (!jwk) {
      certExpiry = 0;
      fail("Unauthorized notification.", 401);
    }
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        bytes(parts[2], true),
        encoder.encode(parts[0] + "." + parts[1]),
      ))
    )
      fail("Unauthorized notification.", 401);
  }
  return {
    async verify(input, config) {
      budget();
      const token = await proof(input, config);
      // Bound memory and repeated Google API calls; never cache ownership.
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", encoder.encode(token)),
        ),
      ).join(",");
      if ((recent.get(hash) || 0) > clock() - 3000)
        fail("Wait a moment before checking again.", 429);
      if (recent.size > 4000) recent.clear();
      recent.set(hash, clock());
      return {
        ...(await current(token, config)),
        checkedAt: new Date(clock()).toISOString(),
        recheckAfterSeconds: 30,
      };
    },
    async notification(request, inputReader, config) {
      budget();
      await authenticatePush(request, config);
      const input = await inputReader();
      if (
        input.subscription !== config.subscription ||
        typeof input.message?.data !== "string"
      )
        fail("Invalid notification.");
      let event;
      try {
        event = JSON.parse(new TextDecoder().decode(bytes(input.message.data)));
      } catch {
        fail("Invalid notification.");
      }
      if (event.packageName !== "com.tvshowmanager.app")
        fail("Wrong notification package.");
      if (event.testNotification) return { ok: true, test: true };
      const item =
        event.oneTimeProductNotification || event.voidedPurchaseNotification;
      if (!item) return { ok: true, ignored: true };
      if (item.sku && item.sku !== "remove_ads")
        return { ok: true, ignored: true };
      if (
        typeof item.purchaseToken !== "string" ||
        !item.purchaseToken ||
        item.purchaseToken.length > 4096
      )
        fail("Invalid notification token.");
      // Do not trust event order or grant from the notification itself. Fresh Google
      // state and idempotent acknowledgement also make redelivery safe.
      await current(item.purchaseToken, config);
      return { ok: true };
    },
  };
}
