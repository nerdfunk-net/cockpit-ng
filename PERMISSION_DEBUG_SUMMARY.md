# Settings Menu Permission Debug - Root Cause & Fix

## Problem
User assigned `dashboard.settings:read` permission to the operator role, but test user with operator role cannot see the Settings menu.

## Root Cause Analysis

### Backend Status: ✅ Working Correctly
```
✓ Permission exists: dashboard.settings:read (ID: 134)
✓ Operator role has the permission assigned
✓ Test user has operator role
✓ Test user's effective permissions include dashboard.settings:read
✓ Login API returns full permissions array (35 permissions)
```

### Frontend Issue: ❌ Permissions Lost on Page Refresh

**The Problem:**
1. Permissions array is **excluded from cookies** to avoid 4KB cookie size limit
2. On login: User gets full permissions in memory ✅
3. On page refresh: Only minimal user data restored from cookies (no permissions!) ❌
4. Permission check fails because `user.permissions` is undefined

**Code Evidence:**
```typescript
// frontend/src/lib/auth-store.ts (lines 54-63)
const setCookieUser = (user: User) => {
  const minimalUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    roles: user.roles,
    // Omit permissions array - too large for cookies ❌
  }
  Cookies.set('cockpit_user_info', JSON.stringify(minimalUser), COOKIE_CONFIG)
}
```

## Solution Implemented

### Automatic Permission Refresh on Hydration

Updated `useAuthStore.hydrate()` to:
1. Load minimal user data from cookies (for instant UI render)
2. **Automatically call `/auth/refresh` endpoint** to fetch fresh permissions
3. Update store with full user object including permissions

**Code Changes:**
```typescript
// frontend/src/lib/auth-store.ts
hydrate: async () => {
  const token = getCookieToken()
  const user = getCookieUser()

  if (token && user) {
    // Set initial state with cookie data
    set({ token, user, isAuthenticated: true })

    // Fetch fresh permissions via token refresh
    const response = await fetch('/api/proxy/auth/refresh', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (response.ok) {
      const data = await response.json()
      // Update with fresh permissions
      set({ token: data.access_token, user: data.user })
    }
  }
}
```

## Testing Instructions

### 1. Check Backend Permissions (Already Verified ✅)
```bash
cd backend
PYTHONPATH=/Users/mp/programming/cockpit-ng/backend \
  python tools/check_user_permissions.py test
```

Expected output:
```
✓ Has dashboard.settings:read: True
  Total: 35 permissions
```

### 2. Test Frontend (With Debug Logs)

#### Login as test user:
1. Open browser DevTools Console
2. Log in as `test` user
3. Check console logs:

```
[AUTH] Login called with user: test
[AUTH] User permissions count: 35
[AUTH] Hydrating with user permissions: undefined  ← Was the problem!
[AUTH] Fetching fresh permissions via token refresh...
[AUTH] Token refresh successful
[AUTH] Fresh user permissions: 35  ← Now fixed!

[PERMISSIONS] User has 35 permissions
[PERMISSIONS] Check dashboard.settings:read result: true  ← Should be true!

[SIDEBAR] Can view settings: true  ← Settings menu visible!
```

### 3. Test Page Refresh
1. Refresh the page (F5)
2. Check console - should see:
```
[AUTH] Hydrate called
[AUTH] Fetching fresh permissions via token refresh...
[AUTH] Fresh user permissions: 35
```
3. Settings menu should remain visible

### 4. Verify Permission Check
```
[PERMISSIONS] Check dashboard.settings:read result: true
[PERMISSIONS] Permissions for resource "dashboard.settings":
  [{resource: "dashboard.settings", action: "read", granted: true}]
```

## What Changed

### Files Modified:

1. **`frontend/src/lib/auth-store.ts`**
   - Made `hydrate()` async
   - Added automatic token refresh on page load
   - Fetches fresh permissions from backend
   - Added debug logging

2. **`frontend/src/lib/permissions.ts`**
   - Added extensive debug logging
   - Shows all permissions being checked
   - Logs permission array details

3. **`frontend/src/components/layout/app-sidebar.tsx`**
   - Added debug logs for permission checks
   - Shows why Settings menu is/isn't visible

4. **`backend/routers/auth/auth.py`**
   - Added debug logging to login endpoint
   - Shows which permissions are returned

5. **`backend/tools/seed_rbac.py`**
   - Added `dashboard.settings:read` permission
   - Assigned to admin and network_engineer roles
   - (You manually assigned it to operator role via UI ✅)

## Expected Behavior

### ✅ After Fix:
- Login → Settings menu visible (permissions in memory)
- Refresh page → Settings menu **STILL visible** (auto-refresh fetches permissions)
- No need to log out/in to get updated permissions
- Permission changes reflected after page refresh

### ❌ Before Fix:
- Login → Settings menu visible
- Refresh page → Settings menu **DISAPPEARS** (permissions lost)
- Had to log out/in to restore permissions

## Clean Up Debug Logs (Optional)

After confirming everything works, you can remove debug logs from:
- `frontend/src/lib/permissions.ts` (lines with `console.log`)
- `frontend/src/components/layout/app-sidebar.tsx` (console logs)
- `backend/routers/auth/auth.py` (AUTH DEBUG logs)

Or keep them for future debugging - they're helpful!

## Summary

**Root Cause:** Permissions not stored in cookies → lost on page refresh
**Solution:** Auto-refresh permissions on app hydration
**Result:** Settings menu visibility persists across page refreshes
**Bonus:** All permission changes reflected without logout/login
