// API Manager for Cockpit
// Provides simple API call functionality

class ApiManager {
  constructor(config = window.CockpitConfig) {
    this.config = config;
    this.isInitialized = false;

    // Only init if config is available
    if (this.config) {
      this.init();
    } else {
      console.warn(
        "ApiManager: CockpitConfig not available, deferring initialization",
      );
    }
  }

  // Method to initialize later if config wasn't available
  initializeWithConfig(config) {
    if (this.isInitialized) return;

    this.config = config;
    this.init();
  }

  init() {
    if (this.isInitialized) return;

    if (!this.config) {
      console.warn("ApiManager: Cannot initialize without config");
      return;
    }

    this.isInitialized = true;
    console.log("🔧 ApiManager initialized");
  }

  // Simple fetch wrapper using the config's apiCall method
  async fetch(endpoint, options = {}) {
    if (!this.config || !this.config.apiCall) {
      throw new Error("Config or apiCall method not available");
    }

    return this.config.apiCall(endpoint, options);
  }
}

// Initialize when DOM and config are ready
window.initializeApiManager = function () {
  if (window.ApiManager && window.ApiManager.isInitialized) {
    return; // Already initialized
  }

  if (window.CockpitConfig) {
    // Create global instance with config
    window.ApiManager = new ApiManager(window.CockpitConfig);

    // Simple fetch function for components to use
    window.apiFetch = async (endpoint, options) => {
      if (!window.ApiManager) {
        console.error("ApiManager not available");
        return Promise.reject(new Error("ApiManager not available"));
      }

      try {
        const data = await window.ApiManager.fetch(endpoint, options);
        // Return response-like object for compatibility
        return { ok: true, json: () => Promise.resolve(data) };
      } catch (error) {
        throw error;
      }
    };

    console.log("✅ ApiManager initialized with config");
  } else {
    console.warn(
      "⚠️ CockpitConfig not available, cannot initialize ApiManager",
    );
  }
};

// Try to initialize immediately if config is available
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    // DOM is still loading, wait for it
    document.addEventListener("DOMContentLoaded", window.initializeApiManager);
  } else {
    // DOM is already loaded, try to initialize
    window.initializeApiManager();
  }
}

// Export for module use
if (typeof module !== "undefined" && module.exports) {
  module.exports = ApiManager;
}
