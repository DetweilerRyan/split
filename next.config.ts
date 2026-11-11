import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingIncludes: {
    '/api/mcp': ['./skills/receipt-generation/SKILL.md'],
  },
  async headers() {
    return [
      {
        source: '/r/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        source: '/ingest',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
