import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Forward progress immediately; ordinary responses keep their existing buffered behavior. */
export async function writeResponseBody(response, res, head = false) {
  if (head) {
    res.end();
    return;
  }
  if (
    response.headers.get("Content-Type")?.startsWith("application/x-ndjson") &&
    response.body
  ) {
    res.flushHeaders?.();
    try {
      await pipeline(Readable.fromWeb(response.body), res);
    } catch (error) {
      if (!res.destroyed) throw error;
    }
  } else {
    res.end(Buffer.from(await response.arrayBuffer()));
  }
}
