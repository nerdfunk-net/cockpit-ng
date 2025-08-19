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
};

export default nextConfig;
