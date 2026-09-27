import { sanitizeTrace, type LensTrace } from "@/lib/lens";

// Shared Lens recordings travel through the server gzip-compressed, and the
// server only relays the bytes. These limits keep every message well under
// Socket.IO's 1 MB default (the server enforces the same limits).
export const LENS_SHARE_MAX_BYTES = 800_000;
export const LENS_SHARE_MAX_CODE = 60_000;
// A recording can't unpack to more than this, however it was compressed.
const MAX_UNPACKED_BYTES = 40_000_000;

export function canShareLens(): boolean {
  return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
}

// Reads a stream to the end, giving up (null) once it passes the limit.
async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

// null when compression isn't available or the result is too big to share.
export async function packTrace(trace: LensTrace): Promise<Uint8Array | null> {
  if (!canShareLens()) return null;
  try {
    const stream = new Blob([JSON.stringify(trace)]).stream().pipeThrough(new CompressionStream("gzip"));
    return await readAll(stream, LENS_SHARE_MAX_BYTES);
  } catch {
    return null;
  }
}

// null for anything that isn't a valid, reasonably sized recording.
export async function unpackTrace(data: ArrayBuffer | Uint8Array): Promise<LensTrace | null> {
  if (!canShareLens()) return null;
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.byteLength === 0 || bytes.byteLength > LENS_SHARE_MAX_BYTES) return null;
    const stream = new Blob([bytes.slice()]).stream().pipeThrough(new DecompressionStream("gzip"));
    const raw = await readAll(stream, MAX_UNPACKED_BYTES);
    if (!raw) return null;
    return sanitizeTrace(JSON.parse(new TextDecoder().decode(raw)));
  } catch {
    return null;
  }
}