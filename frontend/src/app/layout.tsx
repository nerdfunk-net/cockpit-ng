import type { Metadata } from "next";
import React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <React.StrictMode>
          {children}
        </React.StrictMode>
      </body>
    </html>
  );
}
