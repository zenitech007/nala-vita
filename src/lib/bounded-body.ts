export class BodyReadError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** Reject declared and actual oversize bodies before parsing or buffering them in full. */
export async function readBoundedBody(request: Request, limit: number): Promise<Buffer> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) throw new BodyReadError(400, "Invalid Content-Length");
    if (Number(declared) > limit) throw new BodyReadError(413, "Request is too large");
  }
  if (!request.body) throw new BodyReadError(400, "Request body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        void reader.cancel().catch(() => undefined);
        throw new BodyReadError(413, "Request is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, length);
}

export async function readBoundedJson(request: Request, limit: number): Promise<unknown> {
  const body = await readBoundedBody(request, limit);
  try {
    return JSON.parse(body.toString("utf8")) as unknown;
  } catch {
    throw new BodyReadError(400, "Invalid JSON body");
  }
}
