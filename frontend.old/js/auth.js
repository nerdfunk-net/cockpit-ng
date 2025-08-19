/**
 * Authentication Module
 * Handles login, logout, token management, and protected API calls
 */

class AuthManager {
  constructor() {
    console.log("🔐 AuthManager: Constructor starting");
    console.log("🔐 AuthManager: window.location =", {
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      href: window.location.href,
    });

    // Use configuration if available, default to localhost
    this.baseURL = window.CockpitConfig
      ? window.CockpitConfig.api.baseUrl
      : "http://localhost:8000";
    console.log("🔐 AuthManager: Initial baseURL from config:", this.baseURL);

    // Check for container override
    if (window.COCKPIT_API_URL) {
      console.log(
        "🔐 AuthManager: Found COCKPIT_API_URL override:",
        window.COCKPIT_API_URL,
      );
      console.log(
        "🔐 AuthManager: Container mode active:",
        !!window.COCKPIT_CONTAINER_MODE,
      );
    }

    // Determine if we're in development mode (Vite dev server)
    // Check multiple indicators: port, baseURL, and whether container config was bypassed
    const portBasedDev =
      window.location.port === "3000" || window.location.port === "3001";
    const baseURLEmpty = this.baseURL === "";
    const containerModeBypassed = !window.COCKPIT_CONTAINER_MODE; // If no container mode, we're likely in Vite

    this.isDevelopment = portBasedDev || baseURLEmpty || containerModeBypassed;

    console.log("🔐 AuthManager: Development mode detection:", {
      port: window.location.port,
      portBasedDev,
      baseURLEmpty,
      containerModeBypassed,
      containerMode: !!window.COCKPIT_CONTAINER_MODE,
      isDevelopment: this.isDevelopment,
    });

    this.token = localStorage.getItem("auth_token");
    this.user = JSON.parse(localStorage.getItem("user_info") || "null");
    this.tokenExpiry = localStorage.getItem("token_expiry");

    // Refresh configuration
    this.refreshThresholdMs = 2 * 60 * 1000; // 2 minutes before expiry
    // Consider user active within last 10 minutes for keeping session alive
    this.activityWindowMs = 10 * 60 * 1000;
    // Max idle timeout: logout after 10 minutes of no activity
    this.idleTimeoutMs = 10 * 60 * 1000;
    this.lastActivity = Date.now();
    this._refreshInFlight = false;

    console.log("🔐 AuthManager: Auth state:", {
      hasToken: !!this.token,
      hasUser: !!this.user,
      hasExpiry: !!this.tokenExpiry,
    });

    // Update user display immediately if we have user data
    if (this.user && typeof document !== "undefined") {
      // Use a small delay to ensure DOM is ready
      setTimeout(() => this.updateUserDisplay(), 100);
    }

    // Track user activity to keep session alive when user is active
    this._attachActivityListeners();

    // Periodically check and refresh if near expiry
    this._startRefreshScheduler();
    this._startIdleWatcher();

    console.log("🔐 AuthManager: Constructor complete. Final config:", {
      baseURL: this.baseURL,
      isDevelopment: this.isDevelopment,
    });
  }

  /**
   * Login user with credentials
   */
  async login(username, password) {
    console.log("🔐 AuthManager: Login attempt started");
    console.log("🔐 AuthManager: Current state:", {
      baseURL: this.baseURL,
      isDevelopment: this.isDevelopment,
      username: username,
    });

    try {
      // Use relative URL in development mode (Vite proxy handles routing)
      const url = this.isDevelopment
        ? "/auth/login"
        : `${this.baseURL}/auth/login`;
      console.log("🔐 AuthManager: Login URL constructed:", url);
      console.log("🔐 AuthManager: Request details:", {
        url,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        bodyData: { username, password: "***" },
      });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      console.log("🔐 AuthManager: Login response received:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();

      // Store authentication data
      this.token = data.access_token;
      this.user = data.user;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      localStorage.setItem("auth_token", this.token);
      localStorage.setItem("user_info", JSON.stringify(this.user));
      localStorage.setItem("token_expiry", this.tokenExpiry);

      return { success: true, user: this.user };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register new user
   */
  async register(username, password, email, fullName) {
    try {
      // Use relative URL in development mode (Vite proxy handles routing)
      const url = this.isDevelopment
        ? "/auth/register"
        : `${this.baseURL}/auth/register`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          email,
          full_name: fullName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Registration failed");
      }

      const data = await response.json();

      // Store authentication data
      this.token = data.access_token;
      this.user = data.user;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      localStorage.setItem("auth_token", this.token);
      localStorage.setItem("user_info", JSON.stringify(this.user));
      localStorage.setItem("token_expiry", this.tokenExpiry);

      return { success: true, user: this.user };
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout user and clear stored data
   */
  logout() {
    console.log("AuthManager: Logging out user"); // Debug log
    this.token = null;
    this.user = null;
    this.tokenExpiry = null;

    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_info");
    localStorage.removeItem("token_expiry");

    console.log("AuthManager: Cleared localStorage, redirecting to login"); // Debug log
    // Redirect to login page
    window.location.href = "login.html";
  }

  /**
   * Check if user is authenticated and token is valid
   */
  isAuthenticated() {
    if (!this.token || !this.tokenExpiry) {
      return false;
    }

    // Only consider the token invalid once it's actually expired
    if (Date.now() > parseInt(this.tokenExpiry)) {
      this.logout();
      return false;
    }

    return true;
  }

  /**
   * Get current user information
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Make authenticated API request
   */
  async apiRequest(endpoint, options = {}) {
    // Try refreshing if we're close to expiry and the user is active
    await this._maybeRefresh();

    if (!this.isAuthenticated()) {
      throw new Error("Not authenticated");
    }

    const config = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        ...options.headers,
      },
    };

    try {
      // Use relative URL in development mode (Vite proxy handles routing)
      const url = this.isDevelopment ? endpoint : `${this.baseURL}${endpoint}`;

      const response = await fetch(url, config);

      if (response.status === 401) {
        // Token expired or invalid
        this.logout();
        throw new Error("Authentication expired");
      }

      if (!response.ok) {
        // Try to parse JSON body; fall back to text
        let errBody;
        try {
          errBody = await response.json();
        } catch (e) {
          try {
            errBody = await response.text();
          } catch (e2) {
            errBody = null;
          }
        }

        let msg = `HTTP ${response.status}`;
        if (errBody) {
          if (typeof errBody === "string") msg = errBody;
          else if (errBody.detail) {
            // FastAPI commonly returns { detail: [...] } for 422
            if (Array.isArray(errBody.detail)) {
              try {
                msg = errBody.detail
                  .map((d) => {
                    if (typeof d === "string") return d;
                    const loc = Array.isArray(d.loc)
                      ? d.loc.join(".")
                      : d.loc || "";
                    const m =
                      d.msg ||
                      d.message ||
                      d.detail ||
                      d.type ||
                      JSON.stringify(d);
                    return loc ? `${loc}: ${m}` : String(m);
                  })
                  .join("\n");
              } catch (_) {
                msg = JSON.stringify(errBody.detail);
              }
            } else {
              try {
                msg =
                  typeof errBody.detail === "object"
                    ? JSON.stringify(errBody.detail)
                    : String(errBody.detail);
              } catch (_) {
                msg = String(errBody.detail);
              }
            }
          } else {
            try {
              msg = JSON.stringify(errBody);
            } catch (e) {
              msg = String(errBody);
            }
          }
        }

        throw new Error(msg || `HTTP ${response.status}`);
      }

      // Parse and return JSON response; if parsing fails, return raw text
      try {
        return await response.json();
      } catch (e) {
        return await response.text();
      }
    } catch (error) {
      // Normalize error objects so callers get a readable message
      console.error("API request error:", error);
      if (error instanceof Error) throw error;
      try {
        throw new Error(JSON.stringify(error));
      } catch (e) {
        throw new Error(String(error));
      }
    }
  }

  /**
   * Protect page - redirect to login if not authenticated
   */
  requireAuth() {
    // Try refreshing before redirecting if near expiry
    // Note: this is fire-and-forget; requireAuth callers run at DOMContentLoaded
    this._maybeRefresh();
    if (!this.isAuthenticated()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }

  /**
   * Update user display in UI
   */
  updateUserDisplay() {
    if (this.user) {
      // Update sidebar username
      const sidebarUsername = document.getElementById("sidebar-username");
      if (sidebarUsername) {
        sidebarUsername.textContent = this.user.full_name || this.user.username;
      }

      // Update navbar username
      const navbarUsername = document.getElementById("navbar-username");
      if (navbarUsername) {
        navbarUsername.textContent = this.user.full_name || this.user.username;
      }

      // Update welcome message
      const welcomeMessage = document.getElementById("welcome-message");
      if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${this.user.username}!`;
      }

      // Legacy support for existing selectors (in case other pages use them)
      const profileNameElements = document.querySelectorAll(
        ".profile_info h2, .user-profile",
      );
      profileNameElements.forEach((element) => {
        // Skip elements we've already handled with specific IDs
        if (element.id === "sidebar-username") return;

        if (element.classList.contains("user-profile")) {
          // For dropdown toggle, preserve image and structure
          const img = element.querySelector("img");
          element.innerHTML = "";
          if (img) element.appendChild(img);
          element.appendChild(
            document.createTextNode(this.user.full_name || this.user.username),
          );
        } else {
          element.textContent = this.user.full_name || this.user.username;
        }
      });

      // Legacy welcome message support
      const welcomeElements = document.querySelectorAll(
        ".profile_info span:not(#welcome-message)",
      );
      welcomeElements.forEach((element) => {
        if (
          element.textContent === "Welcome," ||
          element.textContent.startsWith("Welcome,")
        ) {
          element.textContent = `Welcome, ${this.user.username}!`;
        }
      });
    } else {
      // Clear user display when not authenticated
      const sidebarUsername = document.getElementById("sidebar-username");
      if (sidebarUsername) {
        sidebarUsername.textContent = "Guest User";
      }

      const navbarUsername = document.getElementById("navbar-username");
      if (navbarUsername) {
        navbarUsername.textContent = "Guest User";
      }

      const welcomeMessage = document.getElementById("welcome-message");
      if (welcomeMessage) {
        welcomeMessage.textContent = "Welcome,";
      }
    }
  }

  // ----- Refresh & Activity helpers -----
  _attachActivityListeners() {
    const mark = () => (this.lastActivity = Date.now());
    [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
      "visibilitychange",
    ].forEach((evt) => window.addEventListener(evt, mark, { passive: true }));
  }

  _startRefreshScheduler() {
    // Check every 30 seconds
    setInterval(() => {
      this._maybeRefresh();
    }, 30 * 1000);
  }

  async _maybeRefresh() {
    try {
      if (!this.token || !this.tokenExpiry || this._refreshInFlight) return;
      const now = Date.now();
      const exp = parseInt(this.tokenExpiry);
      const timeLeft = exp - now;
      const recentlyActive = now - this.lastActivity <= this.activityWindowMs;

      if (
        timeLeft > 0 &&
        timeLeft <= this.refreshThresholdMs &&
        recentlyActive
      ) {
        await this._refreshToken();
      }
    } catch (err) {
      console.warn("Token refresh attempt failed:", err);
    }
  }

  async _refreshToken() {
    if (this._refreshInFlight) return;
    this._refreshInFlight = true;
    try {
      const endpoint = "/auth/refresh";
      const url = this.isDevelopment ? endpoint : `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: HTTP ${response.status}`);
      }
      const data = await response.json();

      // Update token and expiry (reuse existing user object)
      this.token = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;
      localStorage.setItem("auth_token", this.token);
      localStorage.setItem("token_expiry", this.tokenExpiry);

      // Optionally update user from response if present
      if (data.user) {
        this.user = data.user;
        localStorage.setItem("user_info", JSON.stringify(this.user));
      }
    } finally {
      this._refreshInFlight = false;
    }
  }

  _startIdleWatcher() {
    setInterval(() => {
      if (!this.token || !this.tokenExpiry) return;
      const now = Date.now();
      if (now - this.lastActivity > this.idleTimeoutMs) {
        console.log("Logging out due to inactivity");
        this.logout();
      }
    }, 30 * 1000);
  }
}

// Create global auth manager instance
window.authManager = new AuthManager();

// Create global logout function for direct HTML usage
window.logout = function () {
  console.log("Global logout function called");
  if (window.authManager) {
    window.authManager.logout();
  } else {
    // Basic logout if authManager isn't available
    localStorage.clear();
    window.location.href = "login.html";
  }
};

// Auto-protect pages (except login page)
document.addEventListener("DOMContentLoaded", function () {
  console.log("Auth.js: DOMContentLoaded fired"); // Debug log
  const currentPage = window.location.pathname.split("/").pop();
  console.log("Auth.js: Current page:", currentPage); // Debug log

  if (currentPage !== "login.html" && currentPage !== "") {
    if (window.authManager.requireAuth()) {
      window.authManager.updateUserDisplay();
    }
  }

  // Add logout event listeners with multiple selectors
  const logoutSelectors = [
    'a[href="login.html"]',
    'a[title="Logout"]',
    'a[href*="login.html"]',
    '.dropdown-item[href="login.html"]',
    "#sidebar-logout",
    "#dropdown-logout",
  ];

  console.log("Auth.js: Setting up logout listeners"); // Debug log
  let logoutLinksFound = 0;

  logoutSelectors.forEach((selector) => {
    const logoutLinks = document.querySelectorAll(selector);
    console.log(
      `Auth.js: Found ${logoutLinks.length} elements for selector '${selector}'`,
    ); // Debug log

    logoutLinks.forEach((link) => {
      // Check if link text contains logout-related words or has logout attributes
      const linkText = link.textContent.toLowerCase();
      const isLogoutLink =
        linkText.includes("log out") ||
        linkText.includes("logout") ||
        link.getAttribute("title") === "Logout" ||
        link.href.includes("login.html") ||
        link.id.includes("logout");

      if (isLogoutLink) {
        console.log("Auth.js: Adding logout listener to:", link); // Debug log
        logoutLinksFound++;
        link.addEventListener("click", function (e) {
          e.preventDefault();
          console.log("Logout clicked!"); // Debug log
          window.authManager.logout();
        });
      }
    });
  });

  console.log(`Auth.js: Total logout links configured: ${logoutLinksFound}`); // Debug log
});
