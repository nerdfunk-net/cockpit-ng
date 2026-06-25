# Frontend Analysis — Cockpit-NG

**Date:** 2026-06-25
**Scope:** `frontend/src` (907 TS/TSX files)
**Baseline:** Best practices defined in `CLAUDE.md` + global rules (TypeScript coding style, security, testing)

---

## Executive Summary

The frontend is, on the whole, **well-aligned** with the architectural standards in `CLAUDE.md`. TanStack Query is broadly adopted, GraphQL is centralized, the proxy pattern is in place, feature-based organization is consistent, Shadcn UI is used throughout, and meaningful security headers (CSP, `X-Frame-Options`, `nosniff`) are configured.

However, there are **real gaps** worth addressing, in three buckets:

| Area | Severity | Count / Examples |
|------|----------|------------------|
| **Security** — JWT in JS-readable cookie | HIGH | `auth-store.ts` (js-cookie, non-httpOnly) |
| **Security** — redundant wide-open proxy exposing backend docs | MEDIUM | `app/api/[...path]/route.ts` + `src/proxy.ts` |
| **Security** — type errors ignored in Docker builds | MEDIUM | `next.config.ts` `ignoreBuildErrors` |
| **Compliance** — route files with logic / oversize | HIGH | `help/page.tsx` (1081 lines), `nautobot-export/page.tsx` |
| **Compliance** — manual `useState+useEffect+apiCall` for server data | MEDIUM | 36 components (all dashboard widgets) |
| **Compliance** — `any` types | MEDIUM | ~40 occurrences |
| **Maintainability** — oversize files (>800 lines) | MEDIUM | 3 files over limit, ~25 in the 600–800 zone |

None are catastrophic; the highest-leverage fixes are the **token storage model** and the **route-stub / data-fetching consistency**.

---

## 1. What the Frontend Does Well (Compliant)

- **TanStack Query adoption** — 114 `useQuery`/`useMutation` usages, a dedicated `hooks/queries/` directory, a `queryKeys` factory in `lib/query-keys.ts`, plus `BEST_PRACTICES.md` and `OPTIMISTIC_UPDATES.md` docs. This matches the CLAUDE.md mandate closely.
- **Centralized GraphQL** — no inline GraphQL queries found in components; everything routes through `services/nautobot-graphql.ts` as required.
- **Feature-based organization** — `components/features/{domain}/` with `components/`, `hooks/`, `dialogs/`, `tabs/`, `types/` substructure is followed consistently.
- **Proxy pattern** — frontend calls go through `/api/proxy/*`; no direct `fetch('http://…backend…')` calls exist in component code.
- **Shadcn UI / Radix** — UI primitives come from `components/ui/*`; no competing UI libraries.
- **React anti-loop discipline** — `use-api.ts` is a good example: `EMPTY_OPTIONS`/`EMPTY_HEADERS` constants, refs to avoid recreating `apiCall`, `useMemo` on the returned object.
- **Security headers** — `next.config.ts` defines CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`.
- **Cookie hardening (partial)** — `sameSite: 'strict'`, `secure` in production.
- **Air-gapped support** — local fonts, `unoptimized` images, fallback CSS — a thoughtful operational concern.

---

## 2. Security Findings

### 2.1 HIGH — JWT stored in a JavaScript-readable cookie
**File:** `src/lib/auth-store.ts`

The access token is written with `js-cookie` (`Cookies.set('cockpit_auth_token', …)`), which creates a **non-`httpOnly`** cookie. Any script running on the page can read it via `document.cookie`. This is the same XSS-token-theft exposure as `localStorage`.

The risk is amplified by the CSP in `next.config.ts`, which necessarily allows `script-src 'self' 'unsafe-inline' 'unsafe-eval'` (a Next.js requirement). `'unsafe-inline'` + `'unsafe-eval'` substantially weakens the XSS protection that would otherwise mitigate a readable token.

**Recommendation (preferred):** Move to an `httpOnly`, `Secure`, `SameSite=Strict` cookie set by the Next.js route handler (`app/api/auth/login/route.ts`) via `Set-Cookie` / `cookies()`. The proxy already forwards the `Authorization` header; switch to forwarding the cookie server-side so the token never touches client JS. Note the login route already flags this debt: `// Return the successful response - let client handle cookies for now`.

**Recommendation (interim, if httpOnly is deferred):** Keep token in memory only (Zustand, no cookie persistence) and rely on the existing `auth/refresh` flow for rehydration, accepting a re-login on hard refresh. This still removes the persistent JS-readable token.

### 2.2 MEDIUM — Redundant wide-open proxy exposing backend API docs
**Files:** `src/app/api/[...path]/route.ts`, `src/proxy.ts`

There are **two** proxy implementations:
- `app/api/proxy/[...path]/route.ts` — the documented, intended proxy used by `use-api.ts`.
- `app/api/[...path]/route.ts` — a second catch-all that also proxies `/api/docs`, `/api/redoc`, `/api/openapi.json` to the backend, and forwards extra headers (`cookie`, `referer`, `x-forwarded-*`).

Issues:
- **Backend API docs are reachable through the frontend in production.** Swagger/ReDoc/OpenAPI schema disclosure is an information-leak that aids attackers. These should be gated (env flag, disabled in prod) or removed.
- **Header forwarding of `cookie`/`referer`** widens what reaches the backend versus the curated header list in the main proxy — inconsistent trust boundary.
- **`src/proxy.ts`** exports a `matcher` (the Next.js *middleware* convention) but is **not named `middleware.ts`**, so it likely does **not** run as middleware at all. This is either dead code or a latent bug — verify and either rename to `middleware.ts` or delete.

**Recommendation:** Consolidate to a single proxy. If API-doc passthrough is genuinely needed for development, guard it behind `NODE_ENV !== 'production'` (or an explicit env flag) and document it. Remove `src/proxy.ts` if it isn't wired in.

### 2.3 MEDIUM — Type errors silently ignored in Docker builds
**File:** `next.config.ts` — `typescript.ignoreBuildErrors: process.env.DOCKER_BUILD === "true"`

Production (Docker) builds bypass TypeScript error checking. This defeats the "Definition of Done" guarantees and can ship broken types to production. **Recommendation:** Remove this escape hatch; fix type errors in CI instead so Docker builds and local builds enforce the same bar.

### 2.4 LOW — No server-side route protection (auth is client-only)
There is no `middleware.ts` guarding `(dashboard)` routes. Protection lives in `components/layout/dashboard-layout.tsx`, which redirects client-side after render. The backend enforces auth per-endpoint, so data is not exposed, but protected UI can briefly flash before redirect, and there's no defense-in-depth at the edge. **Recommendation:** Add a `middleware.ts` that checks for the auth cookie and redirects unauthenticated requests to `/login` before rendering.

### 2.5 LOW — Proxy path is not normalized/validated
**File:** `app/api/proxy/[...path]/route.ts`

`pathAfterProxy` is derived from the raw `request.nextUrl.pathname` with no normalization (no `..` rejection). Exploitability is limited because every URL is prefixed with `BACKEND_URL` and the backend enforces auth, but defensively rejecting `..` segments and overly long paths is cheap hardening.

### 2.6 INFO — `dangerouslySetInnerHTML` in `app/layout.tsx`
Used only to inject a **static** CSS string for font variables. No user data flows in, so this is safe. Noted for completeness; consider moving it into `globals.css` to avoid the pattern entirely.

---

## 3. CLAUDE.md Compliance Gaps

### 3.1 HIGH — Route files violate the "stubs only" rule
The rule: `app/(dashboard)/*/page.tsx` must be pure stubs (no logic, state, hooks; ≤ trivial).

- **`app/(dashboard)/help/page.tsx` — 1081 lines.** A massive static help page living directly in a route file. Violates both the stub rule *and* the 800-line max. Should move to `components/features/help/help-page.tsx` and be split into per-section components; the route becomes a 5-line stub.
- **`app/(dashboard)/nautobot-export/page.tsx` — 206 lines** with `'use client'`, `useState`, `useMemo`, `useEffect`, and `useApi()` directly in the route file. Move all logic into `components/features/nautobot/export/nautobot-export-page.tsx`.
- **`app/login/oidc-test-callback/page.tsx` — 583 lines** (outside the dashboard group, so the stub rule is softer here, but it's still far too large and full of logic). Extract into a feature component.

Most other route stubs are correct (5–12 line wrappers) — these are the outliers.

### 3.2 MEDIUM — Manual `useState + useEffect + apiCall` for server data
CLAUDE.md: *"MANDATORY for all data fetching: Use TanStack Query instead of manual state management."*

**36 components** still fetch server data with the manual `useState(loading/error/data) + useEffect + apiCall` pattern. The cleanest cluster to fix first is the **dashboard widgets**, all of which follow this anti-pattern:

- `components/layout/dashboard-job-stats.tsx`
- `components/layout/dashboard-scan-prefix-stats.tsx`
- `components/layout/dashboard-device-backup-status.tsx`
- `components/layout/dashboard-ip-addresses-stats.tsx`
- `components/layout/dashboard-checkmk-sync-status.tsx`
- `components/layout/dashboard-overview.tsx`

Others include `settings/connections/*`, several `checkmk/hosts-inventory/dialogs/*`, and `nautobot/tools/bulk-edit/*`. These also tend to use a `refreshTrigger` prop to force refetch — exactly the manual pattern TanStack Query's `invalidateQueries` replaces.

**Recommendation:** Convert each to a `useQuery` hook under `hooks/queries/` with a `queryKeys` entry, dropping the local loading/error/data state. The dashboard widgets are low-risk, high-visibility wins.

### 3.3 MEDIUM — `any` types
~40 occurrences, concentrated in Nautobot add-device / add-vm query+mutation hooks (e.g. `use-vm-dropdowns-query.ts`, `use-device-mutations.ts` use `apiCall<any>(…)`), plus `zodResolver(vmFormSchema) as any` and `nautobotData: any` props. The TS rule is explicit: avoid `any`; use `unknown` + narrowing or generics. **Recommendation:** Define response interfaces (or infer from Zod schemas) for these API calls; the `zodResolver(... ) as any` casts usually indicate a schema/`useForm` generic mismatch worth fixing properly.

### 3.4 MEDIUM — Files exceeding the size guideline
CLAUDE.md / coding-style: 200–400 lines typical, **800 max**.

Over the hard limit:
- `app/(dashboard)/help/page.tsx` — 1081
- `components/features/jobs/templates/components/template-form-dialog.tsx` — 1048
- `components/features/tools/database-migration/database-migration-page.tsx` — 869

In the 600–800 "split soon" zone (~25 files), notably: `oidc-test-page.tsx` (820), `tests-baseline-page.tsx` (804), `csv-upload-modal.tsx` (852), `template-editor-page.tsx` (777), `inventory-help.tsx` (725), `interface-table.tsx` (702), `device-sync-dialog.tsx` (688), `file-diff-dialog.tsx` (674).

**Recommendation:** Extract sub-components, hooks, and constants from the largest dialogs/pages. `template-form-dialog.tsx` (1048) and `database-migration-page.tsx` (869) are the priorities.

### 3.5 LOW — `console.*` usage
186 `console.*` calls (mostly `console.error`/`console.warn`, only **1** `console.log`). `next.config.ts` strips all but `error`/`warn` in production (`removeConsole`), so runtime leakage is limited. Still, the TS rule discourages `console.log`; remove the stray one and prefer a thin logger wrapper. Low priority.

---

## 4. Prioritized Refactor Plan

**Phase 1 — Security (do first)**
1. Move JWT to `httpOnly` cookie set server-side (§2.1).
2. Remove or env-gate the redundant `app/api/[...path]/route.ts` doc proxy; delete/fix `src/proxy.ts` (§2.2).
3. Drop `ignoreBuildErrors` so Docker builds enforce types (§2.3).
4. Add `middleware.ts` for edge route protection (§2.4).

**Phase 2 — Architectural compliance**
5. Move `help/page.tsx` and `nautobot-export/page.tsx` logic into `components/features/*`; reduce routes to stubs (§3.1).
6. Convert the 6 dashboard widgets to TanStack Query hooks; then the remaining 30 manual-fetch components (§3.2).

**Phase 3 — Quality**
7. Replace `any` in the add-device/add-vm hooks with typed responses (§3.3).
8. Split the 3 over-limit files; chip away at the 600–800 zone (§3.4).
9. Remove the stray `console.log` (§3.5).

---

## 5. Notes / Items to Verify

- Confirm whether `src/proxy.ts` is actually loaded anywhere — its `matcher` export suggests it was meant to be `middleware.ts`. If unused, it's dead code.
- `use-celery-queries.ts` calls `apiCall('/api/celery/status')` with a leading-slash `/api/` prefix, which the proxy special-cases. Minor inconsistency vs. the convention of passing a bare endpoint (`celery/status`); worth normalizing.
- Test coverage was not measured here. CLAUDE.md mandates 80% with unit/integration/E2E; a follow-up coverage run (`npm run test:coverage`) is recommended to validate against that bar.
