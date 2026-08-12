import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@public-operations-observatory/ui'],
};

export default nextConfig;
