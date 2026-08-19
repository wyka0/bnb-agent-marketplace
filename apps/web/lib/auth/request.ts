import { AUTH_MAX_BODY_BYTES } from "./constants.ts";

export function isSameOrigin(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === expectedOrigin;
}

export function isCanonicalRequestOrigin(request: Request, expectedOrigin: string): boolean {
  let requestUrlOrigin: string;
  try {
    requestUrlOrigin = new URL(request.url).origin;
  } catch {
    return false;
  }
  return requestUrlOrigin === expectedOrigin;
}

export function isPostRequest(request: Request): boolean {
  return request.method === "POST";
}

export function isJsonRequest(request: Request): boolean {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

export function isFetchMetadataSafe(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "same-site";
}

export function hasSafeMutationRequest(request: Request, expectedOrigin: string): boolean {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  return (
    isPostRequest(request) &&
    isSameOrigin(request, expectedOrigin) &&
    isCanonicalRequestOrigin(request, expectedOrigin) &&
    isJsonRequest(request) &&
    isFetchMetadataSafe(request) &&
    contentLength <= AUTH_MAX_BODY_BYTES
  );
}

export async function readJson<T>(request: Request, maxBytes: number = AUTH_MAX_BODY_BYTES): Promise<T | null> {
  const body = await readBodyWithLimit(request.body, maxBytes);
  if (body === null) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

/**
 * Read a Web Request/Response stream without buffering beyond `maxBytes`.
 * Chunked bodies with no Content-Length are rejected as soon as the real byte
 * cap is crossed (X.49 L-2/L-3/L-5).
 */
export async function readBodyWithLimit(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<string | null> {
  if (body === null || maxBytes < 0) return null;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
