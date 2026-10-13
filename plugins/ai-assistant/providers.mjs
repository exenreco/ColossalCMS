export const providers = {
  openai: { label: "OpenAI", key: "OPENAI_API_KEY" },
  anthropic: { label: "Anthropic", key: "ANTHROPIC_API_KEY" },
  gemini: { label: "Google Gemini", key: "GEMINI_API_KEY" },
  custom: { label: "Custom provider", key: "CUSTOM_AI_API_KEY" },
};
export const defaults = {
  enabled: false,
  provider: "",
  models: { openai: "", anthropic: "", gemini: "", custom: "" },
  maxOutputTokens: 4096,
};
export function validateSettings(input) {
  if (
    !input ||
    typeof input.enabled !== "boolean" ||
    !(
      Object.hasOwn(providers, input.provider) ||
      (!input.enabled && input.provider === "")
    )
  )
    throw Error("Choose a supported AI provider.");
  const models = Object.fromEntries(
    Object.keys(providers).map((provider) => {
      const value = input.models?.[provider] ?? "";
      if (typeof value !== "string" || /[\x00-\x1f\x7f]/.test(value))
        throw Error("Enter a valid model name or model ID.");
      const model = value.trim();
      if (model.length > 120)
        throw Error("Model name or model ID must be 120 characters or fewer.");
      return [provider, model];
    }),
  );
  if (
    !Number.isInteger(input.maxOutputTokens) ||
    input.maxOutputTokens < 512 ||
    input.maxOutputTokens > 16384
  )
    throw Error("Output limit must be between 512 and 16,384 tokens.");
  return {
    enabled: input.enabled,
    provider: input.provider,
    models,
    maxOutputTokens: input.maxOutputTokens,
  };
}

/** Custom endpoints are hosting/admin configuration, never supplied by chat. */
export function customEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw Error("Enter a valid HTTPS API base URL for Custom provider.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== "443") ||
    !/^[a-z0-9.-]+$/.test(host) ||
    !host.includes(".") ||
    /^[\d.]+$/.test(host) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
  )
    throw Error(
      "Use a public HTTPS API base URL without credentials, query parameters or a custom port.",
    );
  return url.href.replace(/\/+$/, "");
}

export async function* providerText(
  settings,
  key,
  system,
  prompt,
  signal,
  fetcher = fetch,
) {
  const model = settings.models[settings.provider];
  let url,
    headers = { "Content-Type": "application/json" },
    body;
  if (settings.provider === "openai") {
    url = "https://api.openai.com/v1/responses";
    headers.Authorization = "Bearer " + key;
    body = {
      model,
      instructions: system,
      input: prompt,
      max_output_tokens: settings.maxOutputTokens,
      stream: true,
      store: false,
    };
  } else if (settings.provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model,
      system,
      messages: [{ role: "user", content: prompt }],
      max_tokens: settings.maxOutputTokens,
      stream: true,
    };
  } else if (settings.provider === "custom") {
    url = customEndpoint(settings.customBaseUrl) + "/chat/completions";
    headers.Authorization = "Bearer " + key;
    body = {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: settings.maxOutputTokens,
      stream: true,
    };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    headers["x-goog-api-key"] = key;
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: settings.maxOutputTokens,
        responseMimeType: "application/json",
      },
    };
  }
  const response = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "error",
    signal,
  });
  if (!response.ok)
    throw Error(
      response.status === 401 || response.status === 403
        ? "Provider rejected authentication. Check the API key and account access."
        : response.status === 429
          ? "Provider rate limit or billing quota reached."
          : "Provider request failed. Check the model name or model ID and provider availability.",
    );
  if (!response.body) throw Error("The provider returned no response stream.");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    total = 0;
  const parse = (frame) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") return "";
    const event = JSON.parse(data);
    if (
      event.error ||
      ["error", "response.failed", "response.incomplete"].includes(event.type)
    )
      throw Error(
        "The provider could not finish the proposal. Try a smaller request or higher output limit.",
      );
    if (settings.provider === "openai")
      return event.type === "response.output_text.delta" ? event.delta : "";
    if (settings.provider === "anthropic") {
      if (event.delta?.stop_reason === "max_tokens")
        throw Error(
          "Output limit reached. Try a smaller request or higher output limit.",
        );
      return event.delta?.type === "text_delta" ? event.delta.text : "";
    }
    if (settings.provider === "custom") {
      const choice = event.choices?.[0];
      if (choice?.finish_reason && choice.finish_reason !== "stop")
        throw Error(
          "Custom provider could not finish the proposal. Check the output limit and request.",
        );
      return choice?.delta?.content || "";
    }
    if (
      event.candidates?.[0]?.finishReason &&
      !["STOP"].includes(event.candidates[0].finishReason)
    )
      throw Error(
        "Gemini could not finish the proposal. Check the output limit and request.",
      );
    return (event.candidates?.[0]?.content?.parts || [])
      .filter((part) => !part.thought)
      .map((part) => part.text || "")
      .join("");
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 2_000_000)
        throw Error("Provider response exceeded the limit.");
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const text = parse(frame);
        if (text) yield text;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const text = parse(buffer);
      if (text) yield text;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Query only configured provider endpoints; never expose raw provider metadata. */
export async function providerModels(
  provider,
  key,
  baseUrl,
  signal,
  fetcher = fetch,
) {
  if (!Object.hasOwn(providers, provider))
    throw Error("Choose a supported AI provider.");
  const headers = { Accept: "application/json" };
  const base =
    provider === "openai"
      ? "https://api.openai.com/v1/models"
      : provider === "anthropic"
        ? "https://api.anthropic.com/v1/models"
        : provider === "gemini"
          ? "https://generativelanguage.googleapis.com/v1beta/models"
          : customEndpoint(baseUrl) + "/models";
  if (provider === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider === "gemini") headers["x-goog-api-key"] = key;
  else headers.Authorization = "Bearer " + key;
  const models = new Map();
  let cursor = "",
    truncated = false;
  const seen = new Set();
  for (let page = 0; page < 10; page++) {
    const url = new URL(base);
    if (provider === "anthropic") {
      url.searchParams.set("limit", "100");
      if (cursor) url.searchParams.set("after_id", cursor);
    }
    if (provider === "gemini") {
      url.searchParams.set("pageSize", "100");
      if (cursor) url.searchParams.set("pageToken", cursor);
    }
    const response = await fetcher(url.href, {
      headers,
      redirect: "error",
      signal,
    });
    if (!response.ok || !response.body)
      throw Error(
        "Unable to query models. Check saved credentials and provider availability.",
      );
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let text = "",
      bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 1_000_000)
          throw Error("Model catalog exceeded the response limit.");
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const data = JSON.parse(text),
      entries = provider === "gemini" ? data.models : data.data;
    if (!Array.isArray(entries))
      throw Error("Provider did not return a supported model catalog.");
    for (const item of entries) {
      if (
        provider === "gemini" &&
        !item.supportedGenerationMethods?.includes("generateContent")
      )
        continue;
      const id =
        provider === "gemini" ? item.name?.replace(/^models\//, "") : item.id;
      if (
        typeof id !== "string" ||
        !id.trim() ||
        id.length > 120 ||
        /[\x00-\x1f\x7f]/.test(id)
      )
        continue;
      const name = item.display_name || item.displayName || id;
      models.set(id, {
        id,
        label: typeof name === "string" ? name.slice(0, 160) : id,
      });
      if (models.size >= 500) {
        truncated = true;
        break;
      }
    }
    cursor =
      provider === "anthropic" && data.has_more
        ? data.last_id
        : provider === "gemini"
          ? data.nextPageToken
          : "";
    if (!cursor || truncated) break;
    if (
      typeof cursor !== "string" ||
      cursor.length > 2000 ||
      seen.has(cursor)
    ) {
      truncated = true;
      break;
    }
    seen.add(cursor);
    if (page === 9) truncated = true;
  }
  return {
    models: [...models.values()].sort((a, b) => a.id.localeCompare(b.id)),
    truncated,
  };
}
