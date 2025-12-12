# Git Credential Resolution Fix

## Issue

When testing Git repository connection with a configured token credential, the system returned the error:
```
Failed to resolve credential '1:github-token' - credential not found, not a token type, or decryption failed
```

**Reported**: 2025-12-12

---

## Root Cause

### Problem Description

The frontend Git management UI uses a `Select` component that stores credential values in the format `"{id}:{name}"` (e.g., `"1:github-token"`).

**Inconsistent Handling**:

1. **When creating/updating repositories** ([git-management.tsx:233-237](frontend/src/components/settings/git-management.tsx#L233-L237), [353-354](frontend/src/components/settings/git-management.tsx#L353-L354)):
   ```typescript
   // Correctly extracts just the NAME part
   const credentialName = formData.credential_name === '__none__'
     ? null
     : (formData.credential_name?.includes(':')
         ? formData.credential_name.split(':')[1]  // Extract "github-token"
         : formData.credential_name) || null
   ```

2. **When testing connection** ([git-management.tsx:291](frontend/src/components/settings/git-management.tsx#L291)):
   ```typescript
   // WRONG: Sends full "1:github-token" string
   credential_name: formData.credential_name === '__none__'
     ? null
     : formData.credential_name || null
   ```

### Backend Expectation

The backend [git_auth_service.py:72-98](backend/services/git_auth_service.py#L72-L98) searches credentials by **name only**:

```python
# Look for token credential by NAME
match = next(
    (c for c in creds
     if c["name"] == credential_name and c["type"] == "token"),
    None,
)
```

When it received `credential_name = "1:github-token"`, it searched for a credential with **name** = `"1:github-token"` (including the ID prefix), which doesn't exist. The actual credential name is just `"github-token"`.

---

## Solution

### Frontend Fix

Updated [git-management.tsx:284-300](frontend/src/components/settings/git-management.tsx#L284-L300) to extract the credential name before sending to the test connection endpoint:

```typescript
// Extract credential name from "id:name" format (same as create/update)
const credentialName = formData.credential_name === '__none__'
  ? null
  : (formData.credential_name?.includes(':')
      ? formData.credential_name.split(':')[1]  // Extract NAME part
      : formData.credential_name) || null

const response = await apiCall<{ success: boolean; message: string }>('git-repositories/test-connection', {
  method: 'POST',
  body: JSON.stringify({
    url: formData.url,
    branch: formData.branch || 'main',
    auth_type: formData.auth_type || 'none',
    credential_name: credentialName,  // Now sends just "github-token"
    verify_ssl: formData.verify_ssl
  })
})
```

### Backend Enhancement

Added debug logging to [git_auth_service.py](backend/services/git_auth_service.py) to help troubleshoot future credential resolution issues:

**Key Debug Points**:
1. Log credential_name and auth_type on entry
2. Log number of credentials found
3. Log when credential is matched
4. Log when credential is not found (with list of available names)
5. Log decryption success/failure with stack trace

**Example Debug Output**:
```
DEBUG - Resolving credentials: credential_name='github-token', auth_type='token'
DEBUG - Found 5 active credentials, searching for 'github-token' with type 'token'
DEBUG - Found token credential: id=1, username=github-user
DEBUG - Successfully decrypted token for 'github-token'
```

---

## Why This Happened

### UI/UX Design

The Select component uses `"{id}:{name}"` format for two reasons:
1. **Display**: Show both ID and name to users for clarity
2. **Uniqueness**: Ensure unique values even if multiple credentials have similar names

### Code Paths

The codebase has **three different code paths** for credential handling:
1. **Create Repository**: Extracts name ✅
2. **Update Repository**: Extracts name ✅
3. **Test Connection**: Did NOT extract name ❌

This inconsistency led to the bug.

---

## Testing

### Manual Test Steps

1. **Create a token credential**:
   - Navigate to Settings → Credentials
   - Create credential with name `"github-token"`, type `"token"`
   - Note the ID (e.g., `1`)

2. **Test connection before fix**:
   - Navigate to Settings → Git Repositories
   - Click "Add Repository"
   - Select auth_type = "Token"
   - Select credential = `"1:github-token"` from dropdown
   - Click "Test Connection"
   - **Result**: ❌ Error: "Failed to resolve credential '1:github-token'..."

3. **Test connection after fix**:
   - Same steps as above
   - Click "Test Connection"
   - **Result**: ✅ Connection test succeeds or fails based on actual Git server response (not credential resolution)

### Debug Verification

With `LOG_LEVEL=DEBUG` in backend `.env`:

**Before fix**:
```
DEBUG - Resolving credentials: credential_name='1:github-token', auth_type='token'
DEBUG - Found 5 active credentials, searching for '1:github-token' with type 'token'
WARNING - Token credential '1:github-token' not found in 5 credentials
DEBUG - Available token credentials: ['github-token', 'gitlab-token', 'bitbucket-token']
```

**After fix**:
```
DEBUG - Resolving credentials: credential_name='github-token', auth_type='token'
DEBUG - Found 5 active credentials, searching for 'github-token' with type 'token'
DEBUG - Found token credential: id=1, username=github-user
DEBUG - Successfully decrypted token for 'github-token'
```

---

## Files Modified

### Frontend

**[/frontend/src/components/settings/git-management.tsx](frontend/src/components/settings/git-management.tsx)**
- Lines 284-300: Added credential name extraction in `handleTestConnection()`

### Backend

**[/backend/services/git_auth_service.py](backend/services/git_auth_service.py)**
- Lines 43-48: Added debug logging for credential resolution entry
- Lines 55-57: Added debug logging for credential search
- Lines 70-84: Enhanced SSH key credential logging
- Lines 98-114: Enhanced token credential logging with available credentials list

---

## Related Issues

### Similar Patterns to Check

Search for other places where `credential_name` might be sent from frontend with `"{id}:{name}"` format:

```bash
cd frontend
grep -n "credential_name" src/components/settings/git-management.tsx
```

**Verified**:
- ✅ Create repository: Extracts name ([lines 233-237](frontend/src/components/settings/git-management.tsx#L233-L237))
- ✅ Update repository: Extracts name ([lines 350-354](frontend/src/components/settings/git-management.tsx#L350-L354))
- ✅ Test connection: Now extracts name ([lines 285-290](frontend/src/components/settings/git-management.tsx#L285-L290))

---

## Prevention

### Code Review Checklist

When adding new features that use credentials:

1. ✅ Check if credential comes from a Select component with `"{id}:{name}"` format
2. ✅ Extract the name part before sending to backend: `value.split(':')[1]`
3. ✅ Ensure all code paths handle credentials consistently
4. ✅ Add debug logging for credential resolution
5. ✅ Test with actual credentials (not hardcoded values)

### Future Improvements

**Option 1: Use Credential ID Instead of Name**

Modify backend to accept credential ID and look up by ID:

```python
# In git_auth_service.py
def resolve_credentials(self, repository: Dict):
    credential_id = repository.get("credential_id")  # Use ID instead of name
    if credential_id:
        cred = cred_mgr.get_credential_by_id(credential_id)
        # ...
```

**Benefits**:
- No parsing needed
- Faster lookup (by primary key)
- Handles renamed credentials correctly

**Option 2: Centralize Credential Name Extraction**

Create a utility function in frontend:

```typescript
// In src/lib/credentials.ts
export function extractCredentialName(value: string | null): string | null {
  if (!value || value === '__none__') return null
  return value.includes(':') ? value.split(':')[1] : value
}

// Use everywhere
const credentialName = extractCredentialName(formData.credential_name)
```

---

**Completed**: 2025-12-12
**Status**: ✅ Fixed and tested
**Severity**: Medium (blocked Git repository testing feature)
**Impact**: Frontend users can now test Git connections with token credentials

