// The one module that imports the MCP client SDK, so replacing it changes only this file.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

export type McpSession = Pick<Client, 'callTool' | 'close'>;
export type ToolResult = Awaited<ReturnType<Client['callTool']>>;

export async function connectToMcpServer(endpoint: URL): Promise<McpSession> {
  const client = new Client({ name: 'splitsmart-e2e', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(endpoint));
  return client;
}
