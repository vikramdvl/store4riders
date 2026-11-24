/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,  // Disable double-render in dev — makes everything 2x faster
  output: 'standalone',    // Essential for lean Docker and VPS deployments
  async redirects() {
    return [
      {
        source: '/exchange',
        destination: '/returns',
        permanent: true,
      },
      {
        source: '/shipping-policy',
        destination: '/shipping',
        permanent: true,
      },
      {
        source: '/terms-and-conditions',
        destination: '/terms',
        permanent: true,
      },
      {
        source: '/privacy-policy-cookie-restriction-mode',
        destination: '/privacy',
        permanent: true,
      },
      {
        source: '/customer-service',
        destination: '/support',
        permanent: true,
      },
      {
        source: '/customer/account/login',
        destination: '/login',
        permanent: true,
      },
      {
        source: '/customer/account/create',
        destination: '/register',
        permanent: true,
      },
      {
        source: '/customer/account',
        destination: '/account',
        permanent: true,
      },
      {
        source: '/sales/order/history',
        destination: '/account/orders',
        permanent: true,
      },
      {
        source: '/checkout/cart',
        destination: '/cart',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(images|brands|uploads)/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,  // Cache optimized images for 30 days
    deviceSizes: [640, 750, 1080, 1200],   // Fewer breakpoints = fewer variants to generate
    imageSizes: [128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroicons/react'],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
