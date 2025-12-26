import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@doccov/db', '@doccov/auth', '@doccov/api-shared', '@openpkg-ts/spec'],
  // Don't bundle SDK for server routes - it uses child_process
  serverExternalPackages: ['@doccov/sdk'],
  // Enable Turbopack (default in Next.js 16)
  turbopack: {},
};

export default nextConfig;
