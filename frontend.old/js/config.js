// Configuration for Cockpit application
// This file contains environment-specific settings

const CockpitConfig = {
  // API Backend Configuration
  api: {
    // Auto-detect backend URL based on current environment
    baseUrl: (() => {
      console.log("🔧 Config.js: Starting baseUrl detection");
      console.log("🔧 Config.js: window.location =", {
        hostname: window.location.hostname,
        port: window.location.port,
        protocol: window.location.protocol,
        href: window.location.href,
      });

      // Check for environment variable first (Docker containers)
      if (typeof window !== "undefined" && window.COCKPIT_API_URL) {
        console.log(
          "🔧 Config.js: Found COCKPIT_API_URL override:",
          window.COCKPIT_API_URL,
        );
        // But if we detect this is likely a Vite dev environment behind a proxy,
        // we should still use relative URLs
        const isLikelyViteProxy =
          window.location.pathname.includes("login.html") ||
          window.location.pathname.includes("index.html") ||
          document.querySelector('script[src*="vite"]') ||
          document.querySelector('script[type="module"]');

        if (isLikelyViteProxy) {
          console.log(
            "🔧 Config.js: Detected Vite environment behind proxy - using relative URLs",
          );
          return "";
        }

        return window.COCKPIT_API_URL;
      }

      // Detect if we're running on Vite dev server (ports 3000 or 3001)
      // In this case, we should use relative URLs for proxy support
      const currentPort = window.location.port;
      const isDevelopment = currentPort === "3000" || currentPort === "3001";

      console.log("🔧 Config.js: Port detection:", {
        currentPort,
        isDevelopment,
      });

      if (isDevelopment) {
        // Development mode - use empty string to enable relative URLs
        // Vite proxy will handle forwarding to backend
        console.log(
          "🔧 Config.js: Development mode detected - using empty baseUrl for Vite proxy",
        );
        return "";
      }

      // Check if we're likely in a Vite environment (look for Vite-specific elements)
      const hasViteElements = !!(
        document.querySelector('script[type="module"]') ||
        document.querySelector('script[src*="/src/"]') ||
        window.__vite_plugin_react_preamble_installed__
      );

      if (hasViteElements) {
        console.log(
          "🔧 Config.js: Detected Vite environment indicators - using empty baseUrl for proxy",
        );
        return "";
      }

      // Production/container mode - backend on same host, port 8000
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      const productionUrl = `${protocol}//${hostname}:8000`;
      console.log(
        "🔧 Config.js: Production mode detected - using baseUrl:",
        productionUrl,
      );
      return productionUrl;
    })(),

    // Alternative: detect from current host
    // baseUrl: `${window.location.protocol}//${window.location.hostname}:8000`,

    endpoints: {
      auth: {
        login: "/auth/login",
        register: "/auth/register",
      },
      nautobot: {
        locations: "/api/nautobot/locations",
        namespaces: "/api/nautobot/namespaces",
        roles: "/api/nautobot/roles",
        deviceRoles: "/api/nautobot/roles/devices",
        platforms: "/api/nautobot/platforms",
        statuses: "/api/nautobot/statuses",
        deviceStatuses: "/api/nautobot/statuses/device",
        interfaceStatuses: "/api/nautobot/statuses/interface",
        ipAddressStatuses: "/api/nautobot/statuses/ipaddress",
        combinedStatuses: "/api/nautobot/statuses/combined",
        secretGroups: "/api/nautobot/secret-groups",
        stats: "/api/nautobot/stats",
        checkIp: "/api/nautobot/check-ip",
        onboardDevice: "/api/nautobot/devices/onboard",
      },
    },
  },

  // Frontend Configuration
  frontend: {
    // Auto-detect frontend URL
    baseUrl: `${window.location.protocol}//${window.location.host}`,
  },

  // Environment Detection
  environment: {
    isDevelopment:
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1",
    isProduction:
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1",
    isContainer:
      typeof window !== "undefined" &&
      (window.COCKPIT_CONTAINER_MODE === true ||
        (document.body && document.body.classList.contains("container-mode"))),
  },

  // Debug Settings
  debug: {
    enabled:
      window.location.hostname === "localhost" || window.COCKPIT_DEBUG === true,
    logLevel: window.location.hostname === "localhost" ? "debug" : "error",
  },
};

// Helper function to get full API URL
CockpitConfig.getApiUrl = function (endpoint) {
  return this.api.baseUrl + endpoint;
};

// Helper function to get full frontend URL
CockpitConfig.getFrontendUrl = function (path = "") {
  return this.frontend.baseUrl + path;
};

// Simple API call helper
CockpitConfig.apiCall = async function (endpoint, options = {}) {
  const url = this.getApiUrl(endpoint);

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    throw error;
  }
};

// Make config globally available
window.CockpitConfig = CockpitConfig;

// Log configuration in development or when debug is enabled
if (CockpitConfig.debug.enabled) {
  console.log("🚀 Cockpit Configuration Loaded:", {
    environment: CockpitConfig.environment,
    apiBaseUrl: CockpitConfig.api.baseUrl,
  });

  if (
    CockpitConfig.debug.showContainerInfo &&
    CockpitConfig.environment.isContainer
  ) {
    console.log("🐳 Container mode detected");
  }
}
