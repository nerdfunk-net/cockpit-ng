# Endpoint usage mapping (frontend ↔ backend)

This file documents which frontend code calls which backend endpoints. It's a living document created by scanning backend FastAPI routers under `backend/routers` and frontend usages of the `apiCall(...)` helper (which goes through `/api/proxy/...`).

Proxy translation rules (exact)
- Frontend calls `apiCall(endpoint)` (which fetches `/api/proxy/${endpoint}`) and the proxy (`frontend/src/app/api/proxy/[...path]/route.ts`) forwards as follows:
  - If the proxied path begins with `auth/`, `profile` or `user-management` → forward to BACKEND_URL + '/' + pathAfterProxy (do NOT prepend `/api/`).
  - Otherwise → forward to BACKEND_URL + '/api/' + pathAfterProxy.

How to read this file
- `Backend path` is the FastAPI route (router prefix + decorator path).
- `Frontend proxy string` is the string passed to `apiCall(...)` (or the literal path used with `/api/proxy/...`).
- `Evidence` shows one or more frontend source files (under `frontend/src`) that call the endpoint. `.next` artifacts may be listed but prefer `frontend/src` references.

---

## Confirmed endpoint usage (sample)

- Backend path: /api/templates
  - Frontend proxy string: `templates`
  - Methods: GET (list), POST (create)
  - Evidence:
    - frontend/src/components/settings/template-management.tsx — calls `apiCall('templates')`, `apiCall('templates/categories')`, `apiCall(`templates/${id}/content`), `apiCall('templates/sync')`, `apiCall('templates/import')`.

- Backend path: /api/cache
  - Frontend proxy string: `settings/cache` (settings wrapper) and `cache/*` for cache operations
  - Methods: GET/POST
  - Evidence:
    - frontend/src/components/settings/cache-management.tsx — uses `apiCall('settings/cache')`, `apiCall('cache/stats')`, `apiCall('cache/entries?...')`, `apiCall('cache/cleanup')`, `apiCall('cache/clear')`.

- Backend path: /api/file-compare
  - Frontend proxy string: `file-compare/*`
  - Evidence:
    - frontend/src/components/compare/file-compare.tsx — `apiCall('git-repositories')`, `apiCall(`file-compare/list?repo_id=${repoId}`)`, `apiCall('file-compare/compare', { method: 'POST' })`.

- Backend path: /api/git-repositories and /api/git/{repo_id}
  - Frontend proxy strings: `git-repositories`, `git/${repoId}/...`
  - Evidence:
    - frontend/src/components/settings/git-management.tsx — `apiCall('git-repositories')`, `apiCall(`git/${repo.id}/sync`)`, `apiCall(`git/${repo.id}/remove-and-sync`)`.
    - frontend/src/components/configs/configs-view-page.tsx — accesses `git-repositories/${selectedRepository}` and `git/${selectedRepository}/commits/${branchName}`.

- Backend path group: /api/nautobot, /api/nb2cmk, /api/checkmk, /api/scan, /api/jobs
  - Frontend proxy strings: `nautobot/*`, `nb2cmk/*`, `checkmk/*`, `scan/*`, `jobs/*`
  - Evidence (representative):
    - frontend/src/components/scan-and-add/scan-and-add-page.tsx — `apiCall('nautobot/health-check')`, `apiCall('scan/start')`, `apiCall('scan/{job}/status')`, `apiCall('scan/{job}/onboard')`.
    - frontend/src/components/checkmk/* — many `apiCall('nb2cmk/device/${id}/update')`, `apiCall('checkmk/changes/activate')`, `apiCall('nb2cmk/device/${id}/add')`.
    - frontend/src/components/jobs/* and frontend/src/components/apscheduler-test.tsx — `apiCall('jobs/compare-devices')`, `apiCall('jobs/{id}/cancel')`.

- Backend path: /api/config
  - Frontend proxy strings: `config/checkmk.yaml`, `config/snmp_mapping.yaml` and other `config/*` files
  - Evidence: frontend/src/components/settings/checkmk-settings.tsx — calls `apiCall('config/checkmk.yaml')` and `apiCall('config/snmp_mapping.yaml')`.

- Backend path: /api/credentials
  - Frontend proxy strings: `credentials`, `credentials/{id}`
  - Evidence: frontend/src/components/settings/credentials-management.tsx — uses `apiCall('credentials')`, `apiCall(`credentials/${id}`)`, etc.

- Backend path: /profile
  - Frontend proxy string: `profile` (special-case, forwarded to BACKEND_URL/profile)
  - Evidence: frontend/src/... — calls `apiCall('profile')` (see front-end src matches)

- Backend path: /auth
  - Frontend proxy strings: `auth/*` (login, refresh, api-key login)
  - Evidence: login flows call `apiCall('auth/login')`, etc. (search frontend for `auth/` usages).

- Backend path: /user-management
  - Frontend proxy string: `user-management/*` (special-case, forwarded to BACKEND_URL/user-management)
  - Evidence: frontend/src/components/settings/user-management.tsx — `apiCall('user-management')`, `apiCall('user-management/bulk-action')`, `apiCall(`user-management/${id}/toggle-status`)`.

---

## Unreferenced endpoints (to investigate)

The exhaustive per-route check is still in-progress. After an exhaustive router-by-router pass, each backend decorator route will be either:
- Marked as referenced with one or more frontend source files listed as evidence, or
- Marked as unreferenced (no frontend caller found). These unreferenced endpoints may be for API usage by external tools, CLI scripts, or might be dead code.

Planned next steps
- Complete a decorator-level mapping for all routers under `backend/routers` and add every backend endpoint and its evidence to this file.
- For parameterized routes, expand search to template-literal patterns used in the frontend (e.g., `templates/${id}/content`).
- When finished, list endpoints that appear unused and suggest one of: add telemetry, mark as deprecated, or remove.

If you want, I can complete the exhaustive pass now and update this file with every endpoint and a definitive used/unreferenced status. Reply "continue" to proceed.
# Endpoint usage mapping (auto-generated)

This document maps backend endpoints to frontend usages (files/components) found in the repository. It was generated from repository scans and the frontend proxy mapping rules in `frontend/src/app/api/proxy/[...path]/route.ts`.

Proxy rules summary
- If frontend calls `/api/proxy/auth/...`, `/api/proxy/profile` or `/api/proxy/user-management/...` the backend target is `${BACKEND_URL}/auth/...`, `${BACKEND_URL}/profile`, `${BACKEND_URL}/user-management/...` (no `/api/` prefix).
- Otherwise frontend call `/api/proxy/<path>` maps to backend `${BACKEND_URL}/api/<path>`.

Legend
- Backend endpoint: HTTP_METHOD backend_path
- Frontend usage: file path and example call


## Mapped endpoints (selected)

### Profile
- GET /profile
  - Frontend: `frontend/src/components/profile/profile-page.tsx` (debugFetch('/api/proxy/profile'))
  - Frontend: `frontend/src/contexts/debug-context.tsx` (fetch('/api/proxy/profile'))
- PUT /profile
  - Frontend: `frontend/src/components/profile/profile-page.tsx` (debugFetch('/api/proxy/profile', { method: 'PUT' }))


### Auth
- POST /auth/login
  - Frontend: `frontend/src/lib/auth-debug.ts` (fetch('/api/proxy/auth/login'))


### Nautobot (backend `/api/nautobot/*`)
- GET /api/nautobot/stats
  - Frontend: `frontend/src/components/dashboard-overview.tsx` (apiCall('nautobot/stats'))
- GET /api/nautobot/devices
  - Frontend: `frontend/src/components/configs/configs-view-page.tsx` and various components (apiCall('nautobot/devices'))
- Many other Nautobot-related endpoints used across settings, onboarding, sync, and offboard pages (search for `apiCall('nautobot/` in frontend).


### Jobs (backend `/api/jobs/*`)
- GET /api/jobs/
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch('/api/proxy/jobs/'))
  - Frontend: `frontend/src/components/settings/jobs-management.tsx` (fetch('/api/proxy/jobs/'))
- GET /api/jobs/{job_id}
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch(`/api/proxy/jobs/${jobId}`))
- POST /api/jobs/compare-devices
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch('/api/proxy/jobs/compare-devices'))
- POST /api/jobs/cleanup
  - Frontend: `frontend/src/components/settings/jobs-management.tsx` (fetch('/api/proxy/jobs/cleanup'))


### nb2cmk (backend `/api/nb2cmk/*`)
- GET /api/nb2cmk/get_default_site
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch('/api/proxy/nb2cmk/get_default_site'))
- POST /api/nb2cmk/start-diff-job
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch('/api/proxy/nb2cmk/start-diff-job'))
- POST /api/nb2cmk/device/{id}/update
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch(`/api/proxy/nb2cmk/device/${device.id}/update`))
- POST /api/nb2cmk/device/{id}/add
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch(`/api/proxy/nb2cmk/device/${device.id}/add`))


### Checkmk (backend `/api/checkmk/*`)
- POST /api/checkmk/changes/pending
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch('/api/proxy/checkmk/changes/pending'))
- POST /api/checkmk/changes/activate
  - Frontend: `frontend/src/components/checkmk/sync-devices-page.tsx` (fetch('/api/proxy/checkmk/changes/activate'))


### Ansbile inventory
- POST /api/ansible-inventory/download
  - Frontend: `frontend/src/components/ansible-inventory/ansible-inventory-page.tsx` (fetch('/api/proxy/ansible-inventory/download'))


### File Compare (/api/file-compare)
- GET /api/git-repositories
  - Frontend: `frontend/src/components/compare/file-compare.tsx` (loadRepositories uses `apiCall('git-repositories')`)
- GET /api/file-compare/list?repo_id={repo_id}
  - Frontend: `frontend/src/components/compare/file-compare.tsx` (loadFiles uses `apiCall(`file-compare/list?repo_id=${selectedRepo.id}`)`)
- POST /api/file-compare/compare
  - Frontend: `frontend/src/components/compare/file-compare.tsx` (handleCompare uses `apiCall('file-compare/compare', { method: 'POST' })`)


## Unreferenced backend router prefixes (no frontend usages found in `frontend/src`)
- /api/git-compare (git-compare)
- /api/git/{repo_id} (git-files/git-operations/version-control) — note: repository-specific git operations are typically driven from the Git Repositories UI; if not used by frontend, they may be used by CLI or external integrations.
- /api/templates
- /api/credentials
- /api/cache
- /api/config
- /api/git-repositories (some endpoints may be used by frontend via other helper functions; grep for `git-repositories` returned limited/no direct `/api/proxy/git-repositories` calls)

Note: "Unreferenced" above means no direct match for `/api/proxy/<path>` was found in `frontend/src` during this scan. They may still be used by external clients, server-side tasks, or feature flag gated UI paths.


## Notes and caveats
- The frontend uses helper `useApi().apiCall` which calls `/api/proxy/<endpoint>`; many components pass endpoints like `nautobot/...` or `settings/...`. Searching for `apiCall('nautobot/` and similar is a reliable way to find usages.
- This scan looked only inside `frontend/src`. There may be other consumers (scripts, mcp, CLI, external automation) using backend endpoints.
- Some router prefixes contain path parameters (e.g., `/api/git/{repo_id}`) — frontend usage often includes concrete repo IDs so a direct string match may not find them unless variable patterns are considered.


## How this file was generated
- I scanned backend routers to extract router prefixes and decorator paths, then searched the frontend for `/api/proxy/<path>` usages. For endpoints with no frontend matches I listed them in the unreferenced section.


---

Generated by automated analysis.

---

Small pass: concrete evidence (verified)

The following frontend file references were found in a quick, targeted pass for high-value tokens.

Templates
- `frontend/src/components/settings/template-management.tsx`
  - examples: `apiCall('templates')` (line ~380), `apiCall('templates/sync')` (line ~452)

Git repositories
- `frontend/src/components/settings/git-management.tsx`
  - example: `apiCall('git-repositories')` (line ~206)

Nautobot
- `frontend/src/components/scan-and-add/scan-and-add-page.tsx`
  - example: `apiCall('nautobot/health-check')` (line ~251)
- `frontend/src/components/settings/nautobot-settings.tsx`
  - examples: `apiCall('nautobot/statuses/device')`, `apiCall('nautobot/statuses/interface')`, `apiCall('nautobot/statuses/ipaddress')`, `apiCall('nautobot/statuses/prefix')`, `apiCall('nautobot/namespaces')`, `apiCall('nautobot/roles/devices')`, `apiCall('nautobot/platforms')`, `apiCall('nautobot/locations')`, `apiCall('nautobot/secret-groups')` (lines ~430-438)
  - example: `apiCall('nautobot/custom-fields/devices')` (line ~489)

Jobs
- `frontend/src/components/apscheduler-test.tsx`
  - example: `apiCall('jobs/compare-devices')` (line ~49)

Checkmk
- `frontend/src/components/checkmk/live-update-page.tsx`
  - example: `apiCall('checkmk/changes/activate')` (line ~402)

---

I'll continue the exhaustive pass next and populate a per-endpoint table.
