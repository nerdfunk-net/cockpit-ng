---
applyTo: "**/*.js"
---

## JavaScript style & best practices (short)

Keep code small, predictable and defensive. Follow these lightweight rules which match the patterns used across the frontend (for example `production/settings-cache.html`) and the Vite-based build:

- Use modern syntax
	- Prefer ES modules, `const` / `let` (no `var`).
	- Use `async` / `await` for async flows instead of nested `.then()` chains.

- Keep DOM-init safe
	- Wait for DOMContentLoaded before accessing elements.
	- Guard feature detection (e.g. `if (window.Switchery) { ... }`).
	- Avoid globals; expose a single app object when needed (e.g. `window.authManager`).

- API access
	- Always use the project's API helper (e.g. `authManager.apiRequest('/api/...')`) so auth, base URLs and proxy behavior stay consistent.
	- Use relative URLs in development to leverage the Vite proxy (do not hardcode http://localhost:8000).

- Error handling and UX
	- Handle and display errors to users (small alert/status helper as in `showStatus`).
	- Disable buttons during network operations and re-enable in finally blocks.
	- Use short timeouts for UI feedback and avoid blocking the UI thread.

- Defensive parsing
	- Wrap JSON.parse in try/catch when reading from localStorage.
	- Validate inputs (types, ranges) before sending to the backend.

- DOM & event patterns
	- Use delegated listeners where appropriate and keep listeners idempotent.
	- Throttle/debounce frequently-fired handlers (search, input) to reduce work.

- Security & sanitation
	- Never set innerHTML with untrusted strings; sanitize or use textContent.
	- Avoid leaking secrets into client-side logs.

- Caching & performance
	- Read and populate UI from backend endpoints; support cached responses by backend when available.
	- Render fast, then hydrate interactive parts asynchronously.

- Style, linting & tooling
	- Run ESLint and Prettier before committing; prefer a shared configuration.
	- Keep lines reasonably short and prefer clear naming (camelCase for variables/functions).

- Tests & observability
	- Write small unit tests for view-model logic and API wrappers.
	- Log important lifecycle events at INFO level and errors at WARN/ERROR (the repo uses console + logger patterns).

These rules are intentionally compact — follow them and the existing patterns in `production/` to keep the frontend consistent and maintainable.
