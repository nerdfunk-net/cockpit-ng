// Basic Manager for Cockpit
// Provides simple initialization without caching features

class BasicManager {
  constructor(config = window.CockpitConfig) {
    this.config = config;
    this.isInitialized = false;

    // Only init if config is available
    if (this.config) {
      this.init();
    } else {
      console.warn(
        "BasicManager: CockpitConfig not available, deferring initialization",
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
      console.warn("BasicManager: Cannot initialize without config");
      return;
    }

    this.isInitialized = true;
    console.log("🔧 BasicManager initialized");
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
window.initializeOfflineManager = function () {
  if (window.OfflineManager && window.OfflineManager.isInitialized) {
    return; // Already initialized
  }

  if (window.CockpitConfig) {
    // Create global instance with config (keeping same name for compatibility)
    window.OfflineManager = new BasicManager(window.CockpitConfig);

    // Simple fetch function for components to use (keeping same interface)
    window.offlineFetch = async (endpoint, options) => {
      if (!window.OfflineManager) {
        console.error("OfflineManager not available");
        return Promise.reject(new Error("OfflineManager not available"));
      }

      try {
        const data = await window.OfflineManager.fetch(endpoint, options);
        // Return response-like object for compatibility
        return { ok: true, json: () => Promise.resolve(data) };
      } catch (error) {
        throw error;
      }
    };

    console.log("✅ BasicManager initialized with config");
  } else {
    console.warn(
      "⚠️ CockpitConfig not available, cannot initialize BasicManager",
    );
  }
};

// Try to initialize immediately if config is available
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    // DOM is still loading, wait for it
    document.addEventListener(
      "DOMContentLoaded",
      window.initializeOfflineManager,
    );
  } else {
    // DOM is already loaded, try to initialize
    window.initializeOfflineManager();
  }
}

// Export for module use
if (typeof module !== "undefined" && module.exports) {
  module.exports = BasicManager;
}
