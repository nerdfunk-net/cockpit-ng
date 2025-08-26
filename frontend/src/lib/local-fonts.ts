/**
 * Local Font Loader for Air-gapped Environments
 * 
 * This utility provides fallback font loading that works offline.
 * It prioritizes system fonts when Google Fonts are unavailable.
 */

export const localFonts = {
  geistSans: {
    variable: "--font-geist-sans",
    className: "font-sans",
    fallback: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  },
  geistMono: {
    variable: "--font-geist-mono", 
    className: "font-mono",
    fallback: "'SF Mono', Monaco, Inconsolata, 'Roboto Mono', Consolas, 'Courier New', monospace"
  }
};

/**
 * Load local font CSS files for air-gapped environments
 */
export function loadLocalFonts() {
  if (typeof document === 'undefined') return;

  // Check if fonts are already loaded
  if (document.querySelector('#local-fonts-geist')) return;

  // Create link elements for local font CSS
  const geistLink = document.createElement('link');
  geistLink.id = 'local-fonts-geist';
  geistLink.rel = 'stylesheet';
  geistLink.href = '/fonts/geist.css';
  geistLink.media = 'all';

  const geistMonoLink = document.createElement('link');
  geistMonoLink.id = 'local-fonts-geist-mono';
  geistMonoLink.rel = 'stylesheet';
  geistMonoLink.href = '/fonts/geist-mono.css';
  geistMonoLink.media = 'all';

  // Add to document head
  document.head.appendChild(geistLink);
  document.head.appendChild(geistMonoLink);
}

/**
 * CSS variables for font families with fallbacks
 */
export const fontVariables = `
  :root {
    --font-geist-sans: 'Geist', ${localFonts.geistSans.fallback};
    --font-geist-mono: 'Geist Mono', ${localFonts.geistMono.fallback};
  }
`;
