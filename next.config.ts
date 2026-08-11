import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Dev-server only. Next 16 refuses to serve /_next/* dev assets to a Host it
   * does not recognise, and `127.0.0.1` is not on the default list — so opening
   * http://127.0.0.1:3000 during development gives you a page whose JavaScript
   * 403s and an OS stuck on the boot screen. Listing it here makes the loopback
   * address work exactly like `localhost`. Has no effect on a production build.
   */
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
