import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Using API routes for backend communication instead of rewrites
  // This provides better control and error handling
  
  // Enable React debugging in development
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  
  // Enhanced logging for debugging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // For Docker builds, treat lint/type errors as warnings
  typescript: {
    ignoreBuildErrors: process.env.DOCKER_BUILD === "true",
  },

  eslint: {
    // Allow builds to complete even with ESLint warnings
    // Warnings are still shown but won't block the build
    ignoreDuringBuilds: true,
  },

  // Air-gapped environment optimizations
  images: {
    // Disable external image optimization for air-gapped environments
    unoptimized: process.env.NEXT_PUBLIC_AIR_GAPPED === "true",
    // Allow local and data URLs for avatars
    domains: [],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Bundle analyzer and optimization settings
  experimental: {
    // Optimize for offline usage
    optimizeCss: false, // Disable to avoid critters issue
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Security and caching headers
  async headers() {
    const securityHeaders = [
      // Strict CSP for all routes (API docs excluded via middleware)
      {
        source: '/:path((?!api/docs|api/redoc|api/openapi.json).*)*',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer policy for better privacy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline and unsafe-eval
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "worker-src 'self' blob:", // Monaco editor web workers
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Prevent XSS attacks
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Remove server information
          {
            key: 'Server',
            value: 'Cockpit-NG',
          },
        ],
      },
    ];

    const cacheHeaders = process.env.NEXT_PUBLIC_AIR_GAPPED === "true" ? [
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ] : [];

    return [...securityHeaders, ...cacheHeaders];
  },
};

export default nextConfig;
