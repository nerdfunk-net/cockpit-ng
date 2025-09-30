import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { localFonts } from "@/lib/local-fonts";
import { DebugProvider } from "@/contexts/debug-context";
import { AuthHydration } from "@/components/auth/auth-hydration";

// Use local font configuration for air-gapped environments
const geistSans = {
  variable: localFonts.geistSans.variable,
  className: localFonts.geistSans.className,
};

const geistMono = {
  variable: localFonts.geistMono.variable,
  className: localFonts.geistMono.className,
};

export const metadata: Metadata = {
  title: "Cockpit Network Management",
  description: "Modern network management dashboard for network engineers and NetDevOps teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Enhanced error reporting in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const originalError = console.error
    console.error = function(...args) {
      if (args.some(arg => typeof arg === 'string' && (
        arg.includes('key') || 
        arg.includes('Warning') ||
        arg.includes('Each child in a list')
      ))) {
        console.group('🚨 REACT KEY WARNING DETECTED:')
        originalError.apply(console, args)
        console.trace('Call stack:')
        console.groupEnd()
      } else {
        originalError.apply(console, args)
      }
    }
  }

  return (
    <html lang="en">
      <head>
        {/* Load local fonts for air-gapped environments */}
        <link rel="stylesheet" href="/fonts/geist.css" media="all" />
        <link rel="stylesheet" href="/fonts/geist-mono.css" media="all" />
        {/* Air-gapped fallback CSS */}
        {process.env.NEXT_PUBLIC_AIR_GAPPED === "true" && (
          <link rel="stylesheet" href="/airgap-fallback.css" media="all" />
        )}
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --font-geist-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              --font-geist-mono: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', Consolas, 'Courier New', monospace;
            }
          `
        }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <React.StrictMode>
          <AuthHydration />
          <DebugProvider>
            {children}
          </DebugProvider>
        </React.StrictMode>
      </body>
    </html>
  );
}
