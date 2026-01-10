import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { localFonts } from "@/lib/local-fonts";
import { AuthHydration } from "@/components/auth/auth-hydration";
import { QueryProvider } from "@/providers/query-provider";

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
  // Note: Console override removed due to React immutability rules
  // Use React DevTools and browser console for debugging instead

  return (
    <html lang="en">
      <head>
        {/* Load local fonts for air-gapped environments */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/geist.css" media="all" />
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/geist-mono.css" media="all" />
        {/* Air-gapped fallback CSS */}
        {process.env.NEXT_PUBLIC_AIR_GAPPED === "true" && (
          // eslint-disable-next-line @next/next/no-css-tags
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
          <QueryProvider>
            <AuthHydration />
            {children}
          </QueryProvider>
        </React.StrictMode>
      </body>
    </html>
  );
}
