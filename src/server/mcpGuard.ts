import { ipAddress } from '@vercel/functions';
import { isRateLimited, normalizeIp } from './rateLimit';

export const MAX_BODY_BYTES = 64 * 1024;
const LIMIT = 30;
const WINDOW_MS = 60_000;

function jsonRpcError(status: number, message: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function readCapped(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function hasToolCall(body: string): boolean {
  try {
    const parsed: unknown = JSON.parse(body);
    return (Array.isArray(parsed) ? parsed : [parsed]).some(
      (message) => (message as { method?: unknown } | null)?.method === 'tools/call',
    );
  } catch {
    return false;
  }
}

/**
 * Caps POST bodies and rate limits only `tools/call`; handshake, listing and
 * stream requests are left to the Vercel Firewall rule.
 */
export function guardMcp(handler: (request: Request) => Promise<Response> | Response) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return handler(request);

    const body = await readCapped(request);
    if (body === null) return jsonRpcError(413, 'Request body too large');

    const rawIp = ipAddress(request);
    if (rawIp && hasToolCall(body) && isRateLimited(normalizeIp(rawIp), LIMIT, WINDOW_MS)) {
      return jsonRpcError(429, 'Rate limit exceeded', {
        'Retry-After': String(WINDOW_MS / 1000),
        'RateLimit-Limit': String(LIMIT),
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': String(WINDOW_MS / 1000),
      });
    }
    return handler(new Request(request.url, { method: request.method, headers: request.headers, body }));
  };
}
