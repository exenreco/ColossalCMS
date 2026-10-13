export async function assistantStream(
  path: string,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: any) => void,
) {
  const response = await fetch("/api/admin/ai-assistant/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok)
    throw Error((await response.json()).error || "AI request failed.");
  const reader = response.body!.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    completed = false;
  const emit = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") throw Error(event.message);
    if (event.type === "proposal") completed = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        emit(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) emit(buffer);
    if (!completed)
      throw Error("The response ended before the proposal was complete.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
