// Docker Container Configuration
// This file is loaded in Docker container environments to override default settings

console.log("🐳 Container config loading started");
console.log("🐳 Current window.location =", {
  hostname: window.location.hostname,
  port: window.location.port,
  protocol: window.location.protocol,
  href: window.location.href,
});

// Check if we're actually in a Vite development environment
// even though we're not on localhost
const isViteEnvironment = !!(
  document.querySelector('script[type="module"]') ||
  document.querySelector('script[src*="/src/"]') ||
  document.querySelector('script[src*="vite"]') ||
  window.location.pathname.includes(".html") // Static HTML files suggest Vite dev mode
);

console.log("🐳 Vite environment detected:", isViteEnvironment);

if (isViteEnvironment) {
  console.log(
    "🐳 ABORTING container config - Vite environment detected behind proxy",
  );
  console.log(
    "🐳 This prevents container config from overriding Vite proxy setup",
  );
  // Don't set any container overrides
} else {
  console.log("🐳 Proceeding with container configuration");

  // Container-specific environment variables
  window.COCKPIT_CONTAINER_MODE = true;
  const containerApiUrl =
    window.COCKPIT_API_URL ||
    `${window.location.protocol}//${window.location.hostname}:8000`;
  window.COCKPIT_API_URL = containerApiUrl;
  window.COCKPIT_DEBUG = false; // Disable debug in production containers

  console.log("🐳 Container config set:", {
    COCKPIT_CONTAINER_MODE: window.COCKPIT_CONTAINER_MODE,
    COCKPIT_API_URL: window.COCKPIT_API_URL,
    calculatedUrl: containerApiUrl,
  });

  // Add container class to body for CSS targeting
  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("container-mode");
    console.log("🐳 Added container-mode class to body");
  });

  // Container-specific console logging
  console.log("🐳 Cockpit Container Mode Initialized", {
    apiUrl: window.COCKPIT_API_URL,
    host: window.location.hostname,
    protocol: window.location.protocol,
  });
}
