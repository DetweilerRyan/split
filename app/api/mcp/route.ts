import { createMcpHandler } from 'mcp-handler';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildIngestUrl } from '../../../src/store/seedCodec';
import { guardMcp } from '../../../src/server/mcpGuard';
import { receiptSeedSchema } from '../../../src/types/seedSchema';

const SKILL_URI = 'skill://receipt-generation/SKILL.md';

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'create_receipt_room',
      {
        title: 'Create SplitSmart receipt link',
        description:
          'Turn an extracted restaurant receipt into a shareable SplitSmart link. Follow the field descriptions strictly: unroll multi-quantity lines into 1x items, never add tax/VAT/subtotal lines as items, and apply defaults (0 tips and bankUsd, [] roster) instead of asking for optional metadata. The link opens a new live room that anyone with the link can join.',
        inputSchema: receiptSeedSchema,
      },
      async (seed, ctx) => {
        const origin = new URL(ctx.http?.req?.url ?? 'https://split.detweiler.me').origin;
        const url = buildIngestUrl(origin, seed);
        return {
          content: [{ type: 'text', text: `Receipt room link (anyone with it can open it): ${url}` }],
        };
      },
    );

    server.registerResource(
      'receipt-skill',
      SKILL_URI,
      { title: 'Receipt generation skill', mimeType: 'text/markdown' },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: await readFile(path.join(process.cwd(), 'skills/receipt-generation/SKILL.md'), 'utf8'),
          },
        ],
      }),
    );
  },
  { serverInfo: { name: 'splitsmart', version: '0.1.0' } },
);

const guarded = guardMcp(handler);

export const maxDuration = 30;
export { guarded as GET, guarded as POST, guarded as DELETE };
