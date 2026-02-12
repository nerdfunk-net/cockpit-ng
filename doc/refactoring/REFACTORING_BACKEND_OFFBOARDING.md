# Refactor `backend/services/nautobot/offboarding.py` - Plan

## Status: 📋 PLANNED
**Plan Created:** February 12, 2026

## Overview

The `offboarding.py` service is a 873-line monolithic class (`OffboardingService`) that handles all device offboarding workflows. It mixes multiple concerns (device removal, custom field management, IP cleanup, CheckMK integration, cache invalidation, audit logging) into a single class. This plan breaks it into focused modules following the established Nautobot services architecture (resolvers / managers / common pattern).

---

## Current Issues

### 1. Latent Bug — Non-Existent Cache Key Methods
**Severity: HIGH** — Will cause `AttributeError` at runtime.

Lines 686, 691, 695, 718, 723, 727, 751, 756, 760 call instance methods that **do not exist**:
```python
self._device_cache_key(device_id)        # ❌ Not defined
self._device_details_cache_key(device_id) # ❌ Not defined
self._device_list_cache_key()             # ❌ Not defined
```

The file already imports the correct free functions at the top (line 13-18) but three internal methods (`_update_device`, `_clear_device_name`, `_clear_device_serial`) call the non-existent instance methods instead. Only `_delete_device` and `_delete_ip_address` use the imports correctly.

### 2. DEBUG Logs at Wrong Level
12 log statements use `logger.info("DEBUG: ...")` or `logger.error("DEBUG: ...")` — these are development leftovers that should either be removed or changed to `logger.debug()`.

### 3. Mixed Responsibilities (Single Responsibility Violation)
The class handles six distinct concerns:
- Device removal (REST DELETE)
- Device attribute updates (status, role, location, name, serial)
- Custom field management (fetch definitions, apply values)
- IP address cleanup (interface IPs + primary IP)
- CheckMK host removal
- Audit logging

### 4. Duplicated Cache Invalidation
Three methods (`_update_device`, `_clear_device_name`, `_clear_device_serial`) contain identical cache invalidation logic (set device cache, set details cache, delete list cache). `_delete_device` and `_delete_ip_address` have similar but slightly different patterns.

### 5. Inline Exception Translation
`_translate_exception()` is a generic HTTP-status-code mapper that could be shared across the Nautobot service layer.

### 6. Late Imports
Three lazy imports inside methods (`audit_log_repo`, `checkmk_host_service`, `nautobot_metadata_service`) add hidden dependencies and make the code harder to test.

---

## Refactoring Strategy

Follow the existing Nautobot services architecture:
- **Common** — shared cache invalidation, exception translation
- **Managers** — device write operations (update, delete, clear fields)
- **Orchestrator** — slim service that coordinates the offboarding workflow

### Target File Structure

```
backend/services/nautobot/
├── offboarding/
│   ├── __init__.py                 # Re-export offboarding_service singleton
│   ├── service.py                  # OffboardingService (orchestrator, ~150 lines)
│   ├── device_cleanup.py           # DeviceCleanupManager (~180 lines)
│   ├── ip_cleanup.py               # IPCleanupManager (~120 lines)
│   ├── custom_fields.py            # CustomFieldManager (~130 lines)
│   ├── checkmk_cleanup.py          # CheckMKCleanupManager (~50 lines)
│   ├── audit.py                    # log_offboarding_event() (~60 lines)
│   ├── settings.py                 # Settings loading + validation (~80 lines)
│   └── types.py                    # OffboardingResult TypedDict + constants
```

**Estimated total: ~770 lines** across 9 files (vs 873 in one file), but each file has a single clear responsibility.

---

## Step-by-Step Plan

### Step 0: Fix the Bug First (Pre-Refactoring)
> Do this before any structural changes to avoid shipping broken code.

**File:** `backend/services/nautobot/offboarding.py`

Replace all 9 occurrences of `self._device_cache_key`, `self._device_details_cache_key`, and `self._device_list_cache_key` with the already-imported free functions:
```python
# Before (broken):
cache_service.set(self._device_cache_key(device_id), ...)

# After (correct):
cache_service.set(get_device_cache_key(device_id), ...)
```

### Step 1: Create `offboarding/types.py` — Result Type + Constants

Extract the results dict structure into a `TypedDict` and move constants:

```python
"""Types and constants for the offboarding module."""
from __future__ import annotations
from typing import Any, Dict, List, TypedDict

DEVICE_CACHE_TTL = 30 * 60  # 30 minutes

class OffboardingResult(TypedDict):
    success: bool
    device_id: str
    device_name: str
    removed_items: List[str]
    skipped_items: List[str]
    errors: List[str]
    summary: str

def make_result(device_id: str) -> OffboardingResult:
    """Create a fresh offboarding result dict."""
    return OffboardingResult(
        success=True,
        device_id=device_id,
        device_name="",
        removed_items=[],
        skipped_items=[],
        errors=[],
        summary="",
    )
```

### Step 2: Create `offboarding/settings.py` — Settings Loading + Validation

Extract `_get_offboarding_settings()`, `_validate_offboarding_settings()`, and `_normalize_integration_mode()`:

```python
"""Offboarding settings loading and validation."""
from __future__ import annotations
import logging
from typing import Any, Dict, Optional
from settings_manager import settings_manager
from services.nautobot.offboarding.types import OffboardingResult

logger = logging.getLogger(__name__)

def get_offboarding_settings() -> Optional[Dict[str, Any]]:
    """Load offboarding settings from the settings manager."""
    ...

def validate_offboarding_settings(
    settings: Optional[Dict[str, Any]],
    results: OffboardingResult,
) -> bool:
    """Validate settings before processing. Returns True if valid."""
    ...

def normalize_integration_mode(mode: Optional[str]) -> str:
    """Convert integration mode aliases to canonical values ('remove' | 'set-offboarding')."""
    ...
```

### Step 3: Create `offboarding/device_cleanup.py` — Device Write Operations

Consolidate device mutation methods with shared cache invalidation:

```python
"""Device cleanup operations for offboarding (delete, update, clear name/serial)."""
from __future__ import annotations
import logging
from typing import Any, Dict
from fastapi import HTTPException
from services.nautobot import nautobot_service
from services.settings.cache import cache_service
from services.nautobot_helpers import (
    get_device_cache_key,
    get_device_details_cache_key,
    get_device_list_cache_key,
)
from services.nautobot.offboarding.types import DEVICE_CACHE_TTL, OffboardingResult

logger = logging.getLogger(__name__)

class DeviceCleanupManager:
    """Handles device-level mutations during offboarding."""

    async def delete_device(self, device_id: str) -> Dict[str, Any]: ...

    async def update_device(self, device_id: str, payload: Dict[str, Any]) -> Dict[str, Any]: ...

    async def clear_device_name(self, device_id: str) -> Dict[str, Any]: ...

    async def clear_device_serial(self, device_id: str) -> Dict[str, Any]: ...

    async def update_device_attributes(
        self,
        device_id: str,
        results: OffboardingResult,
        settings: Dict[str, Any],
    ) -> None:
        """Update location, status, and role based on offboarding settings."""
        ...

    # --- internal helpers ---

    def _invalidate_device_cache(self, device_id: str) -> None:
        """Delete all cached entries for a device."""
        cache_service.delete(get_device_cache_key(device_id))
        cache_service.delete(get_device_details_cache_key(device_id))
        cache_service.delete(get_device_list_cache_key())

    def _update_device_cache(self, device_id: str, device_data: Dict[str, Any]) -> None:
        """Set device cache entries and invalidate list cache."""
        cache_service.set(get_device_cache_key(device_id), device_data, DEVICE_CACHE_TTL)
        cache_service.set(get_device_details_cache_key(device_id), device_data, DEVICE_CACHE_TTL)
        cache_service.delete(get_device_list_cache_key())
```

This eliminates the duplicated cache logic in `_update_device`, `_clear_device_name`, and `_clear_device_serial`.

### Step 4: Create `offboarding/ip_cleanup.py` — IP Address Cleanup

Extract `_remove_interface_ips()`, `_remove_primary_ip()`, and `_delete_ip_address()`:

```python
"""IP address cleanup during offboarding."""
from __future__ import annotations
import logging
from typing import Any, Dict, List
from fastapi import HTTPException
from models.nautobot import OffboardDeviceRequest
from services.nautobot import nautobot_service
from services.settings.cache import cache_service
from services.nautobot_helpers import (
    get_device_cache_key,
    get_device_details_cache_key,
    get_device_list_cache_key,
    get_ip_address_cache_key,
)
from services.nautobot.offboarding.types import OffboardingResult

logger = logging.getLogger(__name__)

class IPCleanupManager:
    """Handles IP address removal during offboarding."""

    async def remove_interface_ips(
        self,
        device_id: str,
        device_details: Dict[str, Any],
        results: OffboardingResult,
    ) -> List[Dict[str, Any]]: ...

    async def remove_primary_ip(
        self,
        device_id: str,
        device_details: Dict[str, Any],
        interface_ips_removed: List[Dict[str, Any]],
        request: OffboardDeviceRequest,
        results: OffboardingResult,
    ) -> None: ...

    async def _delete_ip_address(self, ip_id: str, device_id: str) -> Dict[str, Any]: ...
```

### Step 5: Create `offboarding/custom_fields.py` — Custom Field Management

Extract `_handle_set_offboarding_values()`:

```python
"""Custom field management during offboarding."""
from __future__ import annotations
import logging
from typing import Any, Dict
from services.nautobot.offboarding.types import OffboardingResult

logger = logging.getLogger(__name__)

class CustomFieldManager:
    """Handles custom field updates during offboarding."""

    def __init__(self, device_cleanup: "DeviceCleanupManager"):
        self._device_cleanup = device_cleanup

    async def apply_offboarding_values(
        self,
        device_id: str,
        results: OffboardingResult,
        settings: Dict[str, Any],
        device_details: Dict[str, Any],
    ) -> None:
        """Fetch custom field definitions and apply offboarding values."""
        ...
```

### Step 6: Create `offboarding/checkmk_cleanup.py` — CheckMK Integration

Extract `_remove_from_checkmk()`:

```python
"""CheckMK host cleanup during offboarding."""
from __future__ import annotations
import logging
from typing import Any, Dict
from services.nautobot.offboarding.types import OffboardingResult

logger = logging.getLogger(__name__)

class CheckMKCleanupManager:
    """Handles CheckMK host removal during offboarding."""

    async def remove_host(
        self,
        device_details: Dict[str, Any],
        current_user: Dict[str, Any],
        results: OffboardingResult,
    ) -> None: ...
```

### Step 7: Create `offboarding/audit.py` — Audit Logging

Extract the inline audit logging block (~50 lines) into a dedicated function:

```python
"""Audit logging for offboarding events."""
from __future__ import annotations
import logging
from typing import Any, Dict
from models.nautobot import OffboardDeviceRequest
from services.nautobot.offboarding.types import OffboardingResult

logger = logging.getLogger(__name__)

def log_offboarding_event(
    results: OffboardingResult,
    device_details: Dict[str, Any],
    request: OffboardDeviceRequest,
    current_user: Dict[str, Any],
    integration_mode: str,
) -> None:
    """Write an audit log entry for the offboarding operation."""
    ...
```

### Step 8: Create `offboarding/service.py` — Slim Orchestrator

The main `OffboardingService` becomes a lightweight orchestrator that delegates to managers:

```python
"""Offboarding workflow orchestrator."""
from __future__ import annotations
import logging
from typing import Any, Dict
from models.nautobot import OffboardDeviceRequest
from services.nautobot.offboarding.types import OffboardingResult, make_result
from services.nautobot.offboarding.settings import (
    get_offboarding_settings,
    normalize_integration_mode,
    validate_offboarding_settings,
)
from services.nautobot.offboarding.device_cleanup import DeviceCleanupManager
from services.nautobot.offboarding.ip_cleanup import IPCleanupManager
from services.nautobot.offboarding.custom_fields import CustomFieldManager
from services.nautobot.offboarding.checkmk_cleanup import CheckMKCleanupManager
from services.nautobot.offboarding.audit import log_offboarding_event

logger = logging.getLogger(__name__)

class OffboardingService:
    """Orchestrates the device offboarding workflow."""

    def __init__(self) -> None:
        self._device_cleanup = DeviceCleanupManager()
        self._ip_cleanup = IPCleanupManager()
        self._custom_fields = CustomFieldManager(self._device_cleanup)
        self._checkmk_cleanup = CheckMKCleanupManager()

    async def offboard_device(
        self,
        device_id: str,
        request: OffboardDeviceRequest,
        current_user: Dict[str, Any],
    ) -> OffboardingResult:
        """Offboard a device based on the provided request configuration."""
        results = make_result(device_id)

        # 1. Fetch device details
        device_details = await self._fetch_device_details(device_id)
        results["device_name"] = device_details.get("name", device_id)

        # 2. Determine integration mode
        offboarding_settings = get_offboarding_settings()
        integration_mode = normalize_integration_mode(
            request.nautobot_integration_mode or "remove"
        )

        # 3. Execute mode-specific path
        if integration_mode == "remove":
            await self._device_cleanup.handle_removal(device_id, results)
        else:
            if not validate_offboarding_settings(offboarding_settings, results):
                return results
            await self._apply_offboarding_settings(
                device_id, results, offboarding_settings, device_details
            )

        # 4. IP cleanup
        interface_ips_removed = await self._handle_ip_cleanup(
            device_id, device_details, request, results
        )

        # 5. Primary IP
        await self._ip_cleanup.remove_primary_ip(
            device_id, device_details, interface_ips_removed, request, results
        )

        # 6. CheckMK
        if request.remove_from_checkmk:
            await self._checkmk_cleanup.remove_host(device_details, current_user, results)
        else:
            results["skipped_items"].append("CheckMK removal was not requested")

        # 7. Summary
        self._build_summary(results)

        # 8. Audit
        log_offboarding_event(
            results, device_details, request, current_user, integration_mode
        )

        return results
```

### Step 9: Create `offboarding/__init__.py` — Public API

```python
"""Nautobot device offboarding module."""
from services.nautobot.offboarding.service import OffboardingService

offboarding_service = OffboardingService()

__all__ = ["offboarding_service", "OffboardingService"]
```

### Step 10: Update Parent `__init__.py`

Update `backend/services/nautobot/__init__.py` to import from the new package:

```python
# Before:
from services.nautobot.offboarding import offboarding_service

# After (same import path, new internal structure):
from services.nautobot.offboarding import offboarding_service
```

Verify all consumers import `offboarding_service` from `services.nautobot` — the public API should not change.

### Step 11: Clean Up Logging

Across all new files:
- Remove all 12 `"DEBUG: ..."` prefixed log messages
- Replace with proper `logger.debug()` calls (no "DEBUG:" prefix)
- Ensure log levels match intent: `debug` for tracing, `info` for workflow events, `warning/error` for failures

### Step 12: Move `_translate_exception` to Common

Move the static `_translate_exception()` method to `services/nautobot/common/exceptions.py` as a free function:

```python
# In common/exceptions.py:
def translate_http_exception(exc: Exception, context: str) -> HTTPException:
    """Map common Nautobot API errors to appropriate HTTP status codes."""
    ...
```

This makes it reusable by other Nautobot services (e.g., onboarding, device update).

### Step 13: Delete Old File

Remove `backend/services/nautobot/offboarding.py` (the monolithic file).

---

## Validation Checklist

After refactoring, verify:

- [ ] All existing unit tests pass without modification
- [ ] `from services.nautobot import offboarding_service` still works
- [ ] `offboarding_service.offboard_device()` signature is unchanged
- [ ] No `"DEBUG: ..."` strings remain in log calls
- [ ] No references to `self._device_cache_key` (bug is fixed)
- [ ] `translate_http_exception` is available in `common/exceptions.py`
- [ ] `grep -r "from services.nautobot.offboarding" backend/` shows all imports resolve
- [ ] Each new file has < 200 lines
- [ ] Each class/module has a single responsibility

---

## Summary

| Aspect | Before | After |
|---|---|---|
| Files | 1 (873 lines) | 9 files (~770 lines total) |
| Classes | 1 monolithic | 5 focused managers + 1 orchestrator |
| Cache bug | 9 broken references | Fixed (uses imported helpers) |
| Debug logs | 12 misleveled `"DEBUG:"` | Proper `logger.debug()` |
| Cache invalidation | Duplicated 3x | Shared `_invalidate_device_cache()` |
| Exception mapping | Instance method | Shared free function in `common/` |
| Audit logging | 50 lines inline | Dedicated `audit.py` module |
| Testability | Hard (one giant class) | Easy (inject/mock each manager) |
