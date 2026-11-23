import { describe, expect, it } from 'vitest';
import { guardMcp, MAX_BODY_BYTES } from './mcpGuard';

describe('guardMcp', () => {
  async function ok(req: Request) {
    return new Response(await req.text());
  }
  function post(body: string) {
    return new Request('https://x.test/api/mcp', {
      method: 'POST',
      body,
      headers: { 'x-real-ip': '9.9.9.9' },
    });
  }

  it('rejects oversized bodies with a JSON-RPC 413', async () => {
    const res = await guardMcp(ok)(post('x'.repeat(MAX_BODY_BYTES + 1)));
    expect(res.status).toBe(413);
    expect((await res.json()).error.message).toMatch(/too large/);
  });

  it('forwards the body unchanged', async () => {
    const res = await guardMcp(ok)(post('{"method":"tools/list"}'));
    expect(await res.text()).toBe('{"method":"tools/list"}');
  });
});
