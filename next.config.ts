import type { NextConfig } from 'next';
import { getLegacyRedirects } from './src/lib/legacy-redirects';

const nextConfig: NextConfig = {
  // Match the existing extensionless public URLs.
  trailingSlash: false,
  poweredByHeader: false,
  devIndicators: false,
  // The browser uses Replit's proxy host rather than a direct local address.
  allowedDevOrigins: ['**.replit.dev', '**.repl.co', '127.0.0.1'],
  async redirects() {
    return getLegacyRedirects();
  },
};

export default nextConfig;
