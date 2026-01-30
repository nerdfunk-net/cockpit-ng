# Session Timeout Bug Analysis

## Summary
Users are being logged out even while actively using the application. This is caused by a **race condition** between the token refresh mechanism and the token expiry check, combined with a **configuration mismatch** between backend token expiry and frontend activity timeout.

## Root Causes

### 1. Configuration Mismatch ⚠️ CRITICAL

**Backend Token Expiry:**
- **Default**: 10 minutes (`backend/config.py:54`)
- **Recommended**: 30 minutes (`.env.example:42`)
- **Current**: Likely using default 10 minutes (no `ACCESS_TOKEN_EXPIRE_MINUTES` in .env)

**Frontend Activity Timeout:**
- **Setting**: 15 minutes (`frontend/src/hooks/use-session-manager.ts:17`)
- **Purpose**: Maximum idle time before stopping auto-refresh

**The Problem:**
The frontend's activity timeout (15 minutes) is LONGER than the backend's token expiry (10 minutes). This means:
- Token expires after 10 minutes
- Frontend still considers user "active" for 15 minutes
- But there's only a short window (8-10 minutes) where refresh can happen

### 2. Race Condition Between Refresh and Expiry Check ⚠️ CRITICAL

**Timeline of Events:**
```
0:00 - User logs in, token expires at 0:10
0:08 - Scheduled refresh triggered (2 min before expiry)
0:08 - Token refresh API call starts
0:08-0:10 - Network delay, backend processing...
0:09.5 - Periodic check runs (every 30s)
0:10 - Token expires!
0:10 - Periodic check detects expired token
0:10 - USER LOGGED OUT (even though refresh was in progress!)
0:10.5 - Refresh response arrives (too late)
```

**The Bug in Code:**

In `use-session-manager.ts:243-254`, the periodic check triggers a refresh but doesn't wait for it:
```typescript
// If token is about to expire and user is active, refresh immediately
if (timeUntilExpiry < finalConfig.refreshBeforeExpiry && timeUntilExpiry > 0) {
  if (isUserActive()) {
    refreshToken().then(success => { // ❌ Fire-and-forget, not awaited!
      // ...
    })
  }
}

// If token has expired, logout (lines 258-265)
if (timeUntilExpiry <= 0) {
  console.log('Session Manager: Token has expired, logging out')
  logout() // ❌ Logs out even if refresh is in progress!
}
```

The periodic check is NOT async/await, so it:
1. Fires the refresh (doesn't wait)
2. Immediately checks if token expired
3. Logs out if expired (even though refresh might succeed in 1 second)

### 3. No Retry Mechanism ⚠️ MEDIUM

The scheduled refresh (line 177-193) only fires ONCE:
- If network is slow → User logged out
- If backend is slow → User logged out
- If any transient error → User logged out

There's no retry or fallback.

### 4. Single Point of Refresh Timing ⚠️ LOW

The refresh is scheduled exactly 2 minutes before expiry:
- If user makes an API call at 0:07.5 (30s before refresh)
- That API call might fail with 401 if token expires during processing
- No mechanism to refresh "just in time" before API calls

## Evidence

### Backend Configuration
**File**: `backend/config.py:53-54`
```python
access_token_expire_minutes: int = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10")  # ❌ Default 10 minutes
)
```

### Frontend Configuration
**File**: `frontend/src/hooks/use-session-manager.ts:15-19`
```typescript
const DEFAULT_CONFIG: Required<SessionConfig> = {
  refreshBeforeExpiry: 2 * 60 * 1000, // 2 minutes before expiry
  activityTimeout: 15 * 60 * 1000, // ❌ 15 minutes (longer than token!)
  checkInterval: 30 * 1000, // Check every 30 seconds
}
```

### Recommended Configuration
**File**: `backend/.env.example:42`
```bash
ACCESS_TOKEN_EXPIRE_MINUTES=30  # ✅ Recommended 30 minutes
```

## Why This Happens Intermittently

Users experience this bug inconsistently because it depends on:

1. **Network Latency**: If refresh completes in <2 seconds, no problem. If it takes >2 seconds when token is close to expiry, logout happens.

2. **User Activity Pattern**:
   - Active user making API calls → More likely to hit race condition
   - Idle user → Refresh has more time to complete

3. **Backend Load**: Slow refresh responses increase race condition window

4. **Timing Alignment**:
   - If periodic check (every 30s) runs right after scheduled refresh starts → Bug triggers
   - If periodic check runs right before scheduled refresh → More time to complete

## Solutions

### IMMEDIATE FIX (Required)

**1. Set Correct Token Expiry in Backend**

Create or update `backend/.env`:
```bash
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

This ensures token expiry (30 min) > activity timeout (15 min).

### SHORT-TERM FIX (Recommended)

**2. Make Periodic Check Aware of In-Progress Refresh**

Add a flag to track if refresh is in progress:
```typescript
const isRefreshingRef = useRef(false)

// In periodic check:
if (timeUntilExpiry <= 0 && !isRefreshingRef.current) {
  logout()
}

// In refreshToken function:
isRefreshingRef.current = true
try {
  // ... refresh logic
} finally {
  isRefreshingRef.current = false
}
```

**3. Align Frontend Activity Timeout**

Update `use-session-manager.ts` to match token expiry:
```typescript
activityTimeout: 25 * 60 * 1000, // 25 minutes (< 30 min token expiry)
```

### LONG-TERM FIX (Best Practice)

**4. Implement Retry Mechanism**

Add exponential backoff retry for failed refreshes:
```typescript
const refreshWithRetry = async (maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    const success = await refreshToken()
    if (success) return true
    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
  }
  return false
}
```

**5. Add Grace Period for Token Expiry**

Don't logout immediately when token expires; give refresh 30-60 seconds to complete:
```typescript
if (timeUntilExpiry <= -60000) { // 60 second grace period
  logout()
}
```

**6. Proactive Refresh on User Activity**

Refresh token on any user activity if it's close to expiry:
```typescript
const updateActivity = useCallback(() => {
  lastActivityRef.current = Date.now()

  const timeUntilExpiry = getTokenExpiry(token) - Date.now()
  if (timeUntilExpiry < refreshBeforeExpiry && timeUntilExpiry > 0) {
    refreshToken() // Refresh immediately on activity if close to expiry
  }
}, [])
```

## Testing the Fix

1. **Set token expiry to 30 minutes in .env**
2. **Monitor browser console** for session manager logs
3. **Keep app open for 29 minutes** without interaction
4. **At 28 minutes**, make a user action (click something)
5. **Verify**: Token should refresh, user stays logged in

## Verification Steps

### Check Current Token Expiry
```bash
# Check if ACCESS_TOKEN_EXPIRE_MINUTES is set
grep ACCESS_TOKEN_EXPIRE backend/.env

# If not found, it's using default (10 minutes)
```

### Monitor Session Manager Logs
Open browser console and filter for "Session Manager":
- Should see "Token refresh scheduled in X seconds"
- Should see "User is active, refreshing token"
- Should see "Token refreshed successfully"
- Should NOT see "Token has expired, logging out" for active users

## Related Files

- `backend/config.py` - Token expiry configuration
- `backend/core/auth.py` - JWT token creation
- `backend/routers/auth/auth.py` - Refresh endpoint
- `frontend/src/hooks/use-session-manager.ts` - Frontend session management
- `frontend/src/app/api/auth/refresh/route.ts` - Next.js refresh proxy
- `frontend/src/lib/auth-store.ts` - Auth state management

## Recommendations

1. ✅ **IMMEDIATE**: Set `ACCESS_TOKEN_EXPIRE_MINUTES=30` in `backend/.env`
2. ✅ **HIGH PRIORITY**: Add in-progress refresh flag to prevent race condition
3. ✅ **MEDIUM PRIORITY**: Align frontend activity timeout with backend token expiry
4. ✅ **NICE TO HAVE**: Add retry mechanism and grace period
5. ✅ **FUTURE**: Consider sliding window token expiry (refresh extends expiry)

## Expected Behavior After Fix

- Token expires after 30 minutes
- User is considered inactive after 25 minutes
- Token refresh scheduled at 28 minutes (2 min before expiry)
- Active users NEVER logged out unexpectedly
- Inactive users logged out after token expires (gracefully)
