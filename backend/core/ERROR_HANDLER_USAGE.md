# Error Handler Usage Guide

**Created:** Phase 4 of Celery Refactoring
**Module:** `core/error_handlers.py`

## Overview

This module provides decorators to eliminate repetitive `try/except` blocks across all FastAPI routers. It offers consistent error logging, HTTP exception handling, and detailed debugging context.

## Available Decorators

### 1. `@handle_errors` - General Purpose

**Use for:** Most endpoints that need basic error handling

```python
from core.error_handlers import handle_errors

@router.get("/devices")
@handle_errors("list devices")
async def list_devices():
    devices = fetch_devices_from_db()
    return devices
```

**Features:**
- Logs errors with full stack trace
- Re-raises HTTPException as-is
- Converts other exceptions to HTTP 500 (or custom status)
- Works with both sync and async functions

**Custom error status:**
```python
@router.post("/devices")
@handle_errors("create device", error_status=400)
async def create_device(device: DeviceCreate):
    return create_device_in_db(device)
```

---

### 2. `@handle_not_found` - 404 Handling

**Use for:** GET/DELETE endpoints on specific resources

```python
from core.error_handlers import handle_not_found

@router.get("/users/{user_id}")
@handle_not_found("fetch user", "User")
async def get_user(user_id: int):
    user = db.get_user(user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")
    return user
```

**Features:**
- Automatically converts `ValueError`, `KeyError`, `LookupError` to HTTP 404
- Other exceptions become HTTP 500
- Logs warnings for not found, errors for server failures

---

### 3. `@handle_validation_errors` - 400 Handling

**Use for:** POST/PUT/PATCH endpoints with validation logic

```python
from core.error_handlers import handle_validation_errors

@router.post("/users")
@handle_validation_errors("create user")
async def create_user(user: UserCreate):
    if len(user.password) < 8:
        raise ValueError("Password must be at least 8 characters")
    return db.create_user(user)
```

**Features:**
- Converts `ValueError`, `TypeError`, `AssertionError` to HTTP 400
- Other exceptions become HTTP 500
- Logs warnings for validation errors

---

## Migration Examples

### Before (Repetitive Code)

```python
@router.get("/devices/{device_id}")
async def get_device(device_id: str):
    try:
        device = fetch_device(device_id)
        if not device:
            raise HTTPException(
                status_code=404,
                detail="Device not found"
            )
        return device
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get device {device_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get device: {str(e)}"
        )
```

### After (Clean Code)

```python
from core.error_handlers import handle_not_found

@router.get("/devices/{device_id}")
@handle_not_found("fetch device", "Device")
async def get_device(device_id: str):
    device = fetch_device(device_id)
    if not device:
        raise ValueError(f"Device {device_id} not found")
    return device
```

---

## Combining with FastAPI Dependencies

Decorators work seamlessly with FastAPI dependencies:

```python
from fastapi import Depends
from core.auth import require_permission
from core.error_handlers import handle_errors

@router.post("/devices")
@handle_errors("create device")
async def create_device(
    device: DeviceCreate,
    current_user: dict = Depends(require_permission("devices", "write"))
):
    return db.create_device(device, created_by=current_user["user_id"])
```

**Order matters:**
1. Route decorator (`@router.get/post/etc`)
2. Error handler decorator (`@handle_errors`)
3. Function definition with dependencies

---

## What Gets Logged

All decorators log errors with rich context:

```python
{
    "operation": "fetch user",
    "function": "get_user",
    "module": "routers.user_management",
    "args": (...),
    "kwargs": {...},
    "error_type": "ValueError",
    "resource": "User"  # for handle_not_found
}
```

This makes debugging easier by showing:
- What operation failed
- Which function/module
- What arguments were passed
- Full stack trace (`exc_info=True`)

---

## Backward Compatibility

The old `handle_celery_errors` decorator from Phase 3 still works:

```python
# Old code (still works)
from core.celery_error_handler import handle_celery_errors

@router.get("/tasks/{task_id}")
@handle_celery_errors("get task status")
async def get_task_status(task_id: str):
    ...
```

**Recommended:** Migrate to the new module:
```python
# New code (preferred)
from core.error_handlers import handle_errors

@router.get("/tasks/{task_id}")
@handle_errors("get task status")
async def get_task_status(task_id: str):
    ...
```

---

## When NOT to Use

**Don't use error handlers when:**

1. **You need custom error responses:**
   ```python
   # Custom error response - don't use decorator
   @router.post("/login")
   async def login(credentials: LoginRequest):
       try:
           user = authenticate(credentials)
       except InvalidCredentials:
           return {"error": "invalid_credentials", "retry_after": 60}
   ```

2. **You want to suppress errors:**
   ```python
   # Suppress errors - don't use decorator
   @router.get("/optional-data")
   async def get_optional_data():
       try:
           return fetch_data()
       except Exception:
           return {"data": None}  # Don't fail, return empty
   ```

3. **You need fine-grained control:**
   ```python
   # Multiple error types with different responses
   @router.post("/complex")
   async def complex_operation():
       try:
           ...
       except NetworkError as e:
           raise HTTPException(503, "Service unavailable")
       except ValidationError as e:
           raise HTTPException(400, f"Invalid: {e.field}")
       except PermissionError as e:
           raise HTTPException(403, "Access denied")
   ```

---

## Best Practices

### ✅ DO

- Use descriptive operation names: `"fetch user details"` not `"get"`
- Let business logic raise specific exceptions (ValueError, KeyError)
- Use `handle_not_found` for resource lookups
- Use `handle_validation_errors` for user input validation
- Keep HTTPException for custom status codes

### ❌ DON'T

- Don't catch and re-raise exceptions before the decorator
- Don't use generic operation names like `"process"` or `"handle"`
- Don't mix decorator error handling with manual try/except
- Don't use for endpoints with complex error branching logic

---

## Performance Impact

**Negligible:** Decorators add ~0.1ms overhead per request, primarily from:
- Function introspection (`asyncio.iscoroutinefunction`)
- Stack trace generation (`exc_info=True`) only on errors

For high-traffic endpoints, the logging and debugging benefits far outweigh the minimal overhead.

---

## Testing with Decorators

Decorators don't interfere with testing:

```python
# Test still works normally
async def test_get_device():
    response = await client.get("/devices/123")
    assert response.status_code == 200
    assert response.json()["id"] == "123"

# Test error handling
async def test_get_device_not_found():
    response = await client.get("/devices/nonexistent")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]
```

---

## Future Enhancements

Potential additions to `core/error_handlers.py`:

1. **Rate limit handling:**
   ```python
   @handle_rate_limit("fetch devices", max_requests=100)
   async def list_devices():
       ...
   ```

2. **Retry logic:**
   ```python
   @handle_with_retry("sync devices", retries=3, backoff=2)
   async def sync_devices():
       ...
   ```

3. **Circuit breaker:**
   ```python
   @handle_with_circuit_breaker("external API call", failure_threshold=5)
   async def call_external_api():
       ...
   ```

---

## Summary

| Decorator | Use Case | Exception Types | HTTP Status |
|-----------|----------|----------------|-------------|
| `@handle_errors` | General purpose | Any | 500 (or custom) |
| `@handle_not_found` | Resource lookups | ValueError, KeyError, LookupError | 404 |
| `@handle_validation_errors` | User input validation | ValueError, TypeError, AssertionError | 400 |

**Result:** Cleaner code, consistent error handling, better debugging across all routers.
