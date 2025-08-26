/**
 * Air-gapped Environment Configuration
 * 
 * This configuration ensures the app works completely offline
 * by providing local alternatives to external dependencies.
 */

export const airGapConfig = {
  // Font configuration for offline usage
  fonts: {
    primary: {
      name: 'Geist',
      fallbacks: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      cssPath: '/fonts/geist.css'
    },
    mono: {
      name: 'Geist Mono', 
      fallbacks: ['SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
      cssPath: '/fonts/geist-mono.css'
    }
  },

  // Avatar configuration
  avatars: {
    useLocal: true,
    fallbackToInitials: true,
    colors: [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1',
    ]
  },

  // External service alternatives
  services: {
    // Disable external analytics, CDN, etc.
    analytics: false,
    cdn: false,
    externalFonts: false,
    externalImages: false,
  },

  // Build configuration for air-gapped environments
  build: {
    // Inline all critical CSS
    inlineCSS: true,
    // Bundle all dependencies
    bundleAll: true,
    // Disable external optimizations
    disableExternalOptimizations: true,
  }
};

/**
 * Check if we're running in an air-gapped environment
 */
export function isAirGapped(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for common air-gapped indicators
  return (
    !navigator.onLine ||
    process.env.NEXT_PUBLIC_AIR_GAPPED === 'true' ||
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Get appropriate font stack for current environment
 */
export function getFontStack(fontType: 'primary' | 'mono'): string {
  const config = airGapConfig.fonts[fontType];
  
  if (isAirGapped()) {
    return config.fallbacks.join(', ');
  }
  
  return `'${config.name}', ${config.fallbacks.join(', ')}`;
}
