import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@doccov/ui', '@doccov/config'],
};

export default nextConfig;
