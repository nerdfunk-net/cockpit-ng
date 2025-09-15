/**
 * Debug utility that provides conditional logging based on user debug preference
 */

let debugEnabled = false;

// Debug logger that only logs when debug mode is enabled
export const debug = {
  log: (...args: unknown[]) => {
    if (debugEnabled) {
      console.log('🐛 [DEBUG]', ...args);
    }
  },
  
  info: (...args: unknown[]) => {
    if (debugEnabled) {
      console.info('ℹ️ [DEBUG]', ...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    if (debugEnabled) {
      console.warn('⚠️ [DEBUG]', ...args);
    }
  },
  
  error: (...args: unknown[]) => {
    if (debugEnabled) {
      console.error('❌ [DEBUG]', ...args);
    }
  },
  
  group: (label: string) => {
    if (debugEnabled) {
      console.group(`🔍 [DEBUG] ${label}`);
    }
  },
  
  groupEnd: () => {
    if (debugEnabled) {
      console.groupEnd();
    }
  },
  
  table: (data: unknown) => {
    if (debugEnabled) {
      console.table(data);
    }
  },
  
  time: (label: string) => {
    if (debugEnabled) {
      console.time(`⏱️ [DEBUG] ${label}`);
    }
  },
  
  timeEnd: (label: string) => {
    if (debugEnabled) {
      console.timeEnd(`⏱️ [DEBUG] ${label}`);
    }
  }
};

// Function to enable/disable debug mode
export const setDebugEnabled = (enabled: boolean) => {
  debugEnabled = enabled;
  if (enabled) {
    debug.log('Debug mode ENABLED - Enhanced logging active');
  } else {
    console.log('🐛 [DEBUG] Debug mode DISABLED - Enhanced logging stopped');
  }
};

// Check if debug is currently enabled
export const isDebugEnabled = () => debugEnabled;

// Enhanced fetch wrapper with debug logging
export const debugFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  debug.group(`HTTP ${options?.method || 'GET'} ${url}`);
  debug.time(`Request to ${url}`);
  
  if (options?.body) {
    debug.log('Request body:', options.body);
  }
  
  if (options?.headers) {
    debug.log('Request headers:', options.headers);
  }

  try {
    const response = await fetch(url, options);
    
    debug.timeEnd(`Request to ${url}`);
    debug.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      debug.warn('Response not OK:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });
    }
    
    debug.groupEnd();
    return response;
    
  } catch (error) {
    debug.timeEnd(`Request to ${url}`);
    debug.error('Fetch error:', error);
    debug.groupEnd();
    throw error;
  }
};

// Component lifecycle debug helpers
export const debugComponent = {
  mount: (componentName: string) => {
    debug.log(`🔄 Component mounted: ${componentName}`);
  },
  
  unmount: (componentName: string) => {
    debug.log(`🔄 Component unmounted: ${componentName}`);
  },
  
  render: (componentName: string, props?: unknown) => {
    debug.log(`🎨 Component rendering: ${componentName}`, props ? { props } : '');
  },
  
  stateChange: (componentName: string, oldState: unknown, newState: unknown) => {
    debug.group(`🔄 State change in ${componentName}`);
    debug.log('Old state:', oldState);
    debug.log('New state:', newState);
    debug.groupEnd();
  }
};