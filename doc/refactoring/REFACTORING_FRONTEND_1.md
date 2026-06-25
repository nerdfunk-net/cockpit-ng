# Frontend Security Refactoring Plan

**Date:** 2026-06-25
**Source analysis:** `doc/refactoring/ANALYSIS_FRONTEND_1.md`
**Scope:** Security flaws only. Each flaw below is self-contained with exact file paths, current ("before") code, and target ("after") code so it can be implemented later without re-analyzing the codebase.

---

## Important context (read before starting)

- **Next.js version:** 16.2.6. In Next.js 16 the edge-middleware file convention was renamed from `middleware.ts` to **`proxy.ts`** with an exported `proxy()` function + `config`. The file `frontend/src/proxy.ts` is therefore the **active** edge middleware — **not dead code** (the earlier analysis flagged it as "possibly dead"; that was wrong). It currently only relaxes CSP for `/api/docs`, `/api/redoc`, `/api/openapi.json`.
- **Two proxies exist:**
  - `frontend/src/app/api/proxy/[...path]/route.ts` — the documented app proxy used by `hooks/use-api.ts` (calls `/api/proxy/<endpoint>`).
  - `frontend/src/app/api/[...path]/route.ts` — a second catch-all that additionally proxies backend Swagger docs (`/api/docs`, `/api/redoc`, `/api/openapi.json`) and forwards extra headers.
- **Backend auth contract:** the backend authenticates via `Authorization: Bearer <jwt>` (see `core/auth.py` `verify_token`). The refactor must keep sending that header to the backend; only the *client-side storage* of the token changes. No backend changes are required.
- **Token lifetime today:** cookie `expires: 1` day; real expiry is the JWT `exp` claim.

**Recommended implementation order:** Flaw 1 → 4 → 5 → 2 → 3 → 6. (Flaw 1 changes how the token reaches the proxy; Flaws 4/5 touch the same proxy/middleware files, so batch them.)

---

## Flaw 1 — JWT stored in a JavaScript-readable cookie (HIGH)

**Risk:** XSS token theft. The access token is written with `js-cookie`, producing a non-`httpOnly` cookie readable via `document.cookie`. The app CSP requires `'unsafe-inline'`/`'unsafe-eval'` (Next.js constraint), so XSS is not fully mitigated by CSP alone.

**Files involved:**
- `frontend/src/lib/auth-store.ts`
- `frontend/src/app/api/auth/login/route.ts`
- `frontend/src/app/api/auth/refresh/route.ts`
- `frontend/src/app/api/auth/logout/route.ts`
- `frontend/src/app/api/proxy/[...path]/route.ts`
- `frontend/src/hooks/use-api.ts`

**Strategy:** Move the access token into an **`httpOnly`, `Secure`, `SameSite=Strict`** cookie that is set/cleared **server-side** by the Next.js route handlers. The token never touches client JS. The app proxy reads the cookie and injects the `Authorization: Bearer` header when forwarding to the backend. The Zustand store keeps only non-sensitive user info (in memory; rehydrated via `/auth/refresh`).

Cookie name to standardize on: **`cockpit_auth_token`** (same name, now httpOnly).

### 1a. Login route — set the httpOnly cookie server-side

**Before refactoring** — `frontend/src/app/api/auth/login/route.ts` returns the token in the JSON body and lets the client store it:

```ts
// Return the successful response - let client handle cookies for now
// This maintains compatibility with existing auth flow
return NextResponse.json(responseData, {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

**After refactoring** — set the token as an httpOnly cookie and strip it from the JSON body so client JS never receives it. Backend response shape is `{ access_token, user, ... }`.

```ts
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const AUTH_COOKIE = 'cockpit_auth_token'
const TOKEN_MAX_AGE = 60 * 60 * 24 // 1 day, in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const backendResponse = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const responseData = await backendResponse.json()
    if (!backendResponse.ok) {
      return NextResponse.json(responseData, { status: backendResponse.status })
    }

    // Strip the token from the body the client receives.
    const { access_token, ...safeData } = responseData

    const res = NextResponse.json(safeData, { status: 200 })
    if (access_token) {
      res.cookies.set(AUTH_COOKIE, access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_MAX_AGE,
      })
    }
    return res
  } catch (error) {
    console.error('Frontend API login error:', error)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Cannot connect to backend server' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

> NOTE: confirm the actual login endpoint the UI calls. `hooks/use-api.ts` posts to `/api/proxy/auth/login`, which is handled by the **proxy** route, not `app/api/auth/login/route.ts`. The login page (`frontend/src/app/login/page.tsx`) may call `/api/auth/login` directly. **Before implementing, grep for the login call** (`grep -rn "auth/login" frontend/src`) and apply the cookie-set logic to whichever route actually serves login. If login goes through the proxy, add the same `access_token` → cookie extraction in the proxy's success branch for the `auth/login` path (see 1d).

### 1b. Refresh route — rotate the httpOnly cookie

**Before refactoring** — `frontend/src/app/api/auth/refresh/route.ts` reads `Authorization` from the request header (client-supplied) and returns the new token in the body:

```ts
const authHeader = request.headers.get('Authorization')
const backendResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(authHeader && { Authorization: authHeader }),
  },
})
const responseData = await backendResponse.json()
// ...
return NextResponse.json(responseData, { status: 200, headers: { 'Content-Type': 'application/json' } })
```

**After refactoring** — read the token from the httpOnly cookie, forward it to the backend as the Bearer header, then rotate the cookie and strip the token from the body:

```ts
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const AUTH_COOKIE = 'cockpit_auth_token'
const TOKEN_MAX_AGE = 60 * 60 * 24

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const backendResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const responseData = await backendResponse.json()
    if (!backendResponse.ok) {
      return NextResponse.json(responseData, { status: backendResponse.status })
    }

    const { access_token, ...safeData } = responseData
    const res = NextResponse.json(safeData, { status: 200 })
    if (access_token) {
      res.cookies.set(AUTH_COOKIE, access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: TOKEN_MAX_AGE,
      })
    }
    return res
  } catch (error) {
    console.error('Frontend API refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 1c. Logout route — clear the httpOnly cookie

**Before refactoring** — `frontend/src/app/api/auth/logout/route.ts` reads the client `Authorization` header and the comment says "client will handle cookie cleanup":

```ts
const authHeader = request.headers.get('Authorization')
// ...forward...
return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
```

**After refactoring** — read the cookie for the backend audit call, then delete the cookie server-side:

```ts
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
const AUTH_COOKIE = 'cockpit_auth_token'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  try {
    if (token) {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {}) // best-effort audit log
    }
  } catch (error) {
    console.error('Frontend API logout error:', error)
  }

  const res = NextResponse.json({ message: 'Logged out successfully' }, { status: 200 })
  res.cookies.delete(AUTH_COOKIE)
  return res
}
```

### 1d. App proxy — inject Authorization from the cookie

**Before refactoring** — `frontend/src/app/api/proxy/[...path]/route.ts` copies the `authorization` header from the client request (client must hold the token):

```ts
const headersToCopy = [
  'authorization',
  'content-type',
  'accept',
  'user-agent',
  'x-forwarded-for',
]
headersToCopy.forEach(headerName => {
  const value = request.headers.get(headerName)
  if (value) {
    headers[headerName] = value
  }
})
```

**After refactoring** — drop `authorization` from the copy list and inject the Bearer header from the httpOnly cookie. (Keep accepting a client-supplied header only as a temporary fallback during migration — remove the fallback once 1e ships.)

```ts
const AUTH_COOKIE = 'cockpit_auth_token'

const headersToCopy = ['content-type', 'accept', 'user-agent', 'x-forwarded-for']
headersToCopy.forEach(headerName => {
  const value = request.headers.get(headerName)
  if (value) {
    headers[headerName] = value
  }
})

// Inject auth from the httpOnly cookie (single source of truth).
const cookieToken = request.cookies.get(AUTH_COOKIE)?.value
if (cookieToken) {
  headers['authorization'] = `Bearer ${cookieToken}`
}
```

> If login is served through this proxy (see note in 1a), also extract `access_token` from the JSON success body for the `auth/login` and `auth/refresh` paths and set the cookie here, mirroring 1a/1b.

### 1e. Auth store — stop persisting the token in JS

**Before refactoring** — `frontend/src/lib/auth-store.ts` writes the token to a JS-readable cookie via `js-cookie`:

```ts
const setCookieToken = (token: string) => {
  Cookies.set('cockpit_auth_token', token, COOKIE_CONFIG)
}
// ...
login: (token, user) => {
  setCookieToken(token)
  setCookieUser(user)
  set({ token, user, isAuthenticated: true })
},
```

**After refactoring** — the store no longer reads/writes the token cookie. The token is owned by the server (httpOnly cookie). Keep `token` out of the store entirely; derive `isAuthenticated` from the presence of a hydrated `user`.

Key changes:
- Remove `setCookieToken`, `getCookieToken`, and the `token` field from `AuthState` (or keep `token: null` permanently if too many call sites read it — see migration note below).
- `login(user)` now takes only the user (the route handler already set the cookie). Signature becomes `login: (user: User) => void`.
- `hydrate()` calls `/api/proxy/auth/refresh` (no manual Authorization header — the cookie is sent automatically same-origin). On success, set `user` + `isAuthenticated: true`. On 401, clear state.
- `logout()` calls `/api/proxy/auth/logout` (cookie sent automatically), then clears in-memory state and the non-sensitive `cockpit_user_info` cookie.

```ts
// hydrate — cookie is sent automatically; no Authorization header needed
hydrate: async () => {
  try {
    const response = await fetch('/api/proxy/auth/refresh', { method: 'POST' })
    if (response.ok) {
      const data = await response.json()
      set({ user: data.user, isAuthenticated: true })
      setCookieUser(data.user)
    } else {
      removeCookies()
      set({ user: null, isAuthenticated: false })
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
    set({ user: null, isAuthenticated: false })
  }
},
```

**Migration note (avoid breaking ~all call sites):** Many components read `token` from the store (`hooks/use-api.ts`, `dashboard-layout.tsx`, `session-status.tsx`, etc.). To limit blast radius, keep a `token` field in the store typed `string | null` but **always `null`** (never populated), and update consumers that *gate on* `token` to gate on `isAuthenticated`/`user` instead. `hooks/use-api.ts` must stop attaching `Authorization` from `tokenRef` (see 1f).

### 1f. use-api — stop sending the token from JS

**Before refactoring** — `frontend/src/hooks/use-api.ts` attaches the token from the store:

```ts
const { token, logout } = useAuthStore()
// ...
if (tokenRef.current) {
  defaultHeaders.Authorization = `Bearer ${tokenRef.current}`
}
```

**After refactoring** — remove the Authorization injection entirely; the same-origin httpOnly cookie is sent automatically with the `fetch('/api/proxy/...')` call and the proxy injects the Bearer header (1d). Keep the 401 → `logout()` + redirect behavior.

```ts
const { logout } = useAuthStore()
// ...no Authorization header set here; cookie travels automatically...
```

> `fetch` to a same-origin URL includes cookies by default, so no `credentials` option is needed. If any call uses an absolute URL, add `credentials: 'include'` — but all current calls are same-origin (`/api/proxy/...`).

### 1g. Update login page call site

`frontend/src/app/login/page.tsx` currently calls `login(token, user)`. After 1e it must call `login(user)` (token already in cookie). Grep and update: `grep -rn "\.login(" frontend/src` and `grep -rn "useAuthStore" frontend/src`.

**Verification for Flaw 1:**
1. Log in. In DevTools → Application → Cookies, confirm `cockpit_auth_token` shows **HttpOnly ✓, Secure ✓ (prod), SameSite=Strict**.
2. In the browser console, run `document.cookie` — it must **not** contain `cockpit_auth_token`.
3. Confirm API calls still succeed (Network tab: request to `/api/proxy/...` returns 200; backend receives `Authorization: Bearer`).
4. Hard-refresh the page — session persists via `hydrate()` → `/auth/refresh`.
5. Log out — cookie is gone; protected calls return 401 and redirect to `/login`.
6. `npm run type-check && npm run lint` clean.

---

## Flaw 2 — Redundant wide-open proxy exposing backend API docs (MEDIUM)

**Risk:** Information disclosure. `app/api/[...path]/route.ts` proxies the backend Swagger/ReDoc/OpenAPI (`/api/docs`, `/api/redoc`, `/api/openapi.json`) and forwards extra headers (`cookie`, `referer`, `x-forwarded-*`). `src/proxy.ts` relaxes CSP specifically so these docs render. In production this hands attackers a full API map.

**Files involved:**
- `frontend/src/app/api/[...path]/route.ts`
- `frontend/src/proxy.ts`

**Decision required (pick one):**
- **Option A (recommended): env-gate the docs in non-production.** Keep the dev convenience, eliminate prod exposure.
- **Option B: remove entirely.** Delete `app/api/[...path]/route.ts` and the docs branch of `src/proxy.ts`. Choose this if no one uses the docs through the frontend.

This plan documents **Option A**.

### 2a. Gate the docs proxy route

**Before refactoring** — `frontend/src/app/api/[...path]/route.ts` unconditionally proxies docs:

```ts
if (
  pathAfterApi === 'docs' ||
  pathAfterApi === 'redoc' ||
  pathAfterApi === 'openapi.json' ||
  pathAfterApi.startsWith('docs/') ||
  pathAfterApi.startsWith('redoc/')
) {
  backendPath = pathAfterApi
} else {
  backendPath = `api/${pathAfterApi}`
}
```

**After refactoring** — return 404 for docs paths in production, and reduce the forwarded-header set to match the curated list in the main proxy (drop `cookie`, `referer`, `x-forwarded-proto`, `x-forwarded-host` unless explicitly needed):

```ts
const DOCS_ENABLED = process.env.NODE_ENV !== 'production'
const isDocsPath =
  pathAfterApi === 'docs' ||
  pathAfterApi === 'redoc' ||
  pathAfterApi === 'openapi.json' ||
  pathAfterApi.startsWith('docs/') ||
  pathAfterApi.startsWith('redoc/')

if (isDocsPath && !DOCS_ENABLED) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

let backendPath: string
if (isDocsPath) {
  backendPath = pathAfterApi
} else {
  backendPath = `api/${pathAfterApi}`
}
```

And tighten the header copy list:

```ts
// Before:
const headersToCopy = [
  'authorization', 'content-type', 'accept', 'user-agent',
  'cookie', 'referer', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host',
]
// After:
const headersToCopy = ['authorization', 'content-type', 'accept', 'user-agent', 'x-forwarded-for']
```

> If this route also handles non-docs API traffic that some component depends on, verify with `grep -rn "fetch('/api/[^p]" frontend/src` and `grep -rn "apiCall('/api/" frontend/src` before tightening. Current analysis found only `use-celery-queries.ts` passing a `/api/celery/status` style path (which the main proxy handles) — re-confirm at implementation time.

### 2b. Gate the docs CSP relaxation in middleware

**Before refactoring** — `frontend/src/proxy.ts` always relaxes CSP for docs paths.

**After refactoring** — short-circuit to a 404 (or `NextResponse.next()` without relaxation) in production:

```ts
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isDocs =
    pathname === '/api/docs' ||
    pathname === '/api/redoc' ||
    pathname === '/api/openapi.json' ||
    pathname.startsWith('/api/docs/') ||
    pathname.startsWith('/api/redoc/')

  if (isDocs) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Not found', { status: 404 })
    }
    // dev only: relaxed CSP for Swagger UI (unchanged block)
    const response = NextResponse.next()
    response.headers.set('Content-Security-Policy', /* ...existing dev CSP... */)
    // ...existing security headers...
    return response
  }

  return NextResponse.next()
}
```

**Verification for Flaw 2:**
1. With `NODE_ENV=production` (`npm run build && npm start`), `GET /api/docs`, `/api/redoc`, `/api/openapi.json` all return **404**.
2. In `npm run dev`, the docs still load.
3. `grep` confirms no app code depends on the docs route for runtime data.

---

## Flaw 3 — TypeScript errors ignored in Docker builds (MEDIUM)

**Risk:** `next.config.ts` disables type checking when `DOCKER_BUILD === "true"`, so production images can ship type-unsafe code, bypassing the "Definition of Done" gate.

**File:** `frontend/next.config.ts`

**Before refactoring:**

```ts
// For Docker builds, treat lint/type errors as warnings
typescript: {
  ignoreBuildErrors: process.env.DOCKER_BUILD === "true",
},
```

**After refactoring** — remove the escape hatch so all builds enforce types:

```ts
// Type errors fail the build in every environment (including Docker).
typescript: {
  ignoreBuildErrors: false,
},
```

**Prerequisite:** the build must already be type-clean. Before merging, run `cd frontend && npm run type-check` and fix all reported errors. If a large backlog exists, fix it first (separate task) — do **not** keep the bypass.

**Verification for Flaw 3:**
1. `cd frontend && npm run type-check` → 0 errors.
2. `DOCKER_BUILD=true npm run build` → completes only when types are clean; introduce a deliberate type error to confirm it now fails, then revert.

---

## Flaw 4 — No edge route protection for dashboard routes (MEDIUM)

**Risk:** Auth is enforced only client-side (`components/layout/dashboard-layout.tsx` redirects after render). Protected UI can flash before redirect; there is no defense-in-depth at the edge. Now that the token lives in an httpOnly cookie (Flaw 1), the edge middleware (`src/proxy.ts`) can check it.

**File:** `frontend/src/proxy.ts` (the Next.js 16 middleware) + its `config.matcher`.

**Before refactoring** — `config.matcher` only covers docs paths; no auth gating exists:

```ts
export const config = {
  matcher: ['/api/docs/:path*', '/api/redoc/:path*', '/api/openapi.json'],
}
```

**After refactoring** — extend the matcher to cover dashboard routes and redirect unauthenticated requests (no auth cookie) to `/login`. Keep the existing docs handling.

```ts
const AUTH_COOKIE = 'cockpit_auth_token'

// Route groups like (dashboard) are not part of the URL; match the real top-level paths.
const PROTECTED_PREFIXES = [
  '/clients', '/settings', '/tools', '/nautobot', '/network', '/netmiko',
  '/agents', '/compliance', '/sync-devices', '/logs', '/profile', '/inventory',
  '/configs', '/onboard-device', '/offboard-device', '/templates', '/automation',
  '/server-clients', '/jobs', '/backup', '/help', '/tig-stack', '/checkmk',
  '/nautobot-add-device', '/nautobot-add-vm', '/nautobot-export',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ...existing docs branch (now prod-gated per Flaw 2)...

  const isProtected = PROTECTED_PREFIXES.some(
    p => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (isProtected && !request.cookies.get(AUTH_COOKIE)?.value) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Run on app routes; exclude Next internals and static assets.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|login|api/auth).*)',
    '/api/docs/:path*',
    '/api/redoc/:path*',
    '/api/openapi.json',
  ],
}
```

> IMPORTANT: route-group folders `(dashboard)` and `(auth)` do **not** appear in the URL. Derive `PROTECTED_PREFIXES` from the actual segment names under `app/(dashboard)/` (listed above from the current tree). Re-verify the list at implementation time with `ls "frontend/src/app/(dashboard)"`. The matcher above takes the inverse approach (protect everything except public assets/`/login`/`/api/auth`); choose either the explicit-prefix check **or** the inverse matcher, not both, to avoid surprises. The explicit-prefix check is safer to start.
>
> The middleware only verifies cookie **presence** (cheap, no JWT verification at the edge). Real validation still happens at the backend per request. This is intentional defense-in-depth, not the primary control.

**Verification for Flaw 4:**
1. Clear cookies, navigate directly to `/jobs` → redirected to `/login` with no UI flash.
2. Log in, navigate to `/jobs` → renders.
3. `/login` and `/api/auth/*` remain reachable while logged out (no redirect loop).

---

## Flaw 5 — App proxy path not normalized (LOW)

**Risk:** `app/api/proxy/[...path]/route.ts` builds the backend URL from the raw `request.nextUrl.pathname` with no `..`/normalization checks. Exploitability is low (every URL is prefixed with `BACKEND_URL` and the backend enforces auth), but path-traversal rejection is cheap hardening.

**File:** `frontend/src/app/api/proxy/[...path]/route.ts`

**Before refactoring** — path is used directly:

```ts
const pathAfterProxy = originalPath.startsWith(proxyPrefix)
  ? originalPath.slice(proxyPrefix.length)
  : pathSegments.join('/')
```

**After refactoring** — reject traversal sequences and control characters before building the URL:

```ts
const pathAfterProxy = originalPath.startsWith(proxyPrefix)
  ? originalPath.slice(proxyPrefix.length)
  : pathSegments.join('/')

// Reject path traversal and encoded traversal attempts.
const decoded = decodeURIComponent(pathAfterProxy)
if (decoded.includes('..') || decoded.includes('\\') || /[ -]/.test(decoded)) {
  return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
}
```

Apply the same guard in `app/api/[...path]/route.ts` if that route is kept (Flaw 2 Option A).

**Verification for Flaw 5:**
1. `GET /api/proxy/../../etc/passwd` (and URL-encoded variants) → **400**.
2. Normal endpoints (e.g. `/api/proxy/job-runs/dashboard/stats`) still return 200.

---

## Flaw 6 — `dangerouslySetInnerHTML` in root layout (INFO / optional)

**Risk:** None today — `frontend/src/app/layout.tsx` injects a **static** CSS string (font variables) with no user data. Flagged only to remove the pattern.

**File:** `frontend/src/app/layout.tsx`

**Before refactoring:**

```tsx
<style
  dangerouslySetInnerHTML={{
    __html: `
    :root {
      --font-geist-sans: system-ui, -apple-system, ... ;
      --font-geist-mono: 'SF Mono', Monaco, ... ;
    }
  `,
  }}
/>
```

**After refactoring** — move these two custom properties into `frontend/src/app/globals.css` (under the existing `:root` block) and delete the inline `<style>` element.

```css
/* globals.css :root */
--font-geist-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-geist-mono: 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', Consolas, 'Courier New', monospace;
```

**Verification for Flaw 6:** fonts render identically; `grep -rn "dangerouslySetInnerHTML" frontend/src` returns nothing.

---

## Global verification (after all flaws)

```bash
cd frontend
npm run type-check     # 0 errors
npm run lint           # clean
npm run build          # succeeds with NODE_ENV=production
npm run test:run       # auth-store / proxy tests pass (add tests if missing)
```

Manual smoke test of the full auth lifecycle (login → API call → refresh on reload → logout) per the Flaw 1 verification steps, plus the edge-redirect check from Flaw 4.

## Suggested commit breakdown

1. `feat(auth): move JWT to httpOnly cookie set server-side` (Flaw 1, all sub-steps together — they are interdependent).
2. `fix(security): env-gate backend API docs proxy and tighten forwarded headers` (Flaw 2).
3. `fix(build): enforce TypeScript errors in Docker builds` (Flaw 3).
4. `feat(security): add edge auth guard for dashboard routes` (Flaw 4).
5. `fix(security): reject path traversal in api proxy` (Flaw 5).
6. `refactor: move inline font CSS to globals.css` (Flaw 6).
