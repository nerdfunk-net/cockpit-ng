# Refactoring Plan: Network Configuration Backup

**Component:** `frontend/src/components/features/network/configs/backup/backup-page.tsx`
**Created:** 2026-01-30
**Status:** PLANNED
**Lines of Code:** 864
**Priority:** HIGH
**Complexity:** HIGH (requires backend implementation)

---

## TL;DR - What's Wrong & How to Fix It

**Problems:**
1. 🚫 **No backend implementation** - All backup operations are mocked (performBackup, showBackupHistory)
2. 🚫 **Architecture violation** - Manual `useState`/`useEffect` instead of mandatory TanStack Query
3. 📏 **LARGE SIZE** - 864 lines (should be < 300 per component)
4. ⚙️ **Client-side heavy** - All filtering, sorting, pagination done in browser instead of backend
5. 🔁 **Manual state management** - 25+ useState hooks for server/UI state
6. ❌ **No form validation** - Filter inputs have no validation
7. 🗂️ **No component decomposition** - Everything in one massive file
8. 🎯 **Mock functionality** - setTimeout instead of real API calls

**Solution:**
1. ✅ **Implement backend layers** - Repository/Service/Router for backup operations
2. ✅ **Migrate to TanStack Query** - Replaces manual state management
3. ✅ **Decompose into components** - Table, filters, history dialog, action buttons
4. ✅ **Add backend pagination/filtering** - Move heavy lifting to backend
5. ✅ **Add form validation** - Zod schemas for filter inputs
6. ✅ **Real API integration** - Connect to actual backup service
7. ✅ **Follow CLAUDE.md patterns** - Repository → Service → Router architecture

**Critical Path:** Backend (Phase 1) → TanStack Query (Phase 2) → Component Decomposition (Phase 3)

**Minimum Viable:** Phases 1-2 establishes functional backup with proper architecture

---

## Executive Summary

The Network Configuration Backup component is an **864-line frontend-only file** with **no backend implementation**. All backup functionality is mocked with `setTimeout` calls and hardcoded data. The component suffers from **critical architecture violations** and requires both backend infrastructure and frontend refactoring.

### Critical Issues

| Issue | Current State | Required State |
|-------|---------------|----------------|
| **Backend API** | ❌ None (mocked) | ✅ Full implementation needed |
| **TanStack Query** | ❌ Manual state | ✅ Query/mutation hooks |
| **Lines of Code** | 864 | < 300 per component |
| **Filtering** | Client-side (197-254) | Backend with query params |
| **Pagination** | Client-side (318-328) | Backend with offset/limit |
| **Validation** | ❌ None | Zod schemas |
| **Caching** | ❌ None | TanStack Query auto-cache |
| **useState Hooks** | 25+ | < 5 (UI state only) |

### Comparison to Similar Components

| Metric | Backup Page | Nautobot Devices | Job Templates |
|--------|-------------|------------------|---------------|
| **Lines of Code** | 864 | ~950 | 958 |
| **Backend Exists** | ❌ NO | ✅ YES | ✅ YES |
| **TanStack Query** | ❌ NO | ❌ NO | ❌ NO |
| **Component Decomposition** | ❌ NO | ❌ NO | ❌ NO |
| **Mock APIs** | ✅ YES (2) | ❌ NO | ❌ NO |

**Bottom Line:** Backup page is similar size to other components but uniquely lacks backend implementation.

---

## Current Architecture

```
frontend/src/components/features/network/configs/backup/
└── backup-page.tsx              # 864 lines - Everything in one file

backend/routers/network/configs/
└── compare.py                   # Only compare router exists
└── backup.py                    # ❌ MISSING
```

**Main Page Responsibilities:**
- Device list table with filters (lines 529-798)
- Filter controls (lines 477-526)
- Backup history modal (lines 800-860)
- 25+ state variables (lines 64-108)
- Manual device loading (lines 118-194)
- Client-side filtering (lines 197-254)
- Client-side sorting (lines 227-250)
- Client-side pagination (lines 318-328)
- Mock backup operations (lines 272-295)
- Mock history loading (lines 297-316)

**Total:** 864 lines with completely mixed concerns and no backend

---

## Problem Analysis

### Problem 1: No Backend Implementation

**Affected Lines:** 272-316 (Mock operations)

**Mock Backup Operation:**
```tsx
// Lines 272-295
const performBackup = useCallback(async (device: Device) => {
  try {
    setBackupInProgress(prev => new Set(prev.add(device.id)))
    showMessage(`Starting backup for ${device.name}`)

    // ❌ Simulate backup API call - replace with actual endpoint
    await new Promise(resolve => setTimeout(resolve, 2000))

    showMessage(`Backup completed for ${device.name}`)
    setTimeout(() => loadDevices(), 1000)
  } catch (err) {
    showMessage(`Backup failed for ${device.name}: ${message}`)
  } finally {
    setBackupInProgress(prev => {
      const newSet = new Set(prev)
      newSet.delete(device.id)
      return newSet
    })
  }
}, [loadDevices, showMessage])
```

**Mock History:**
```tsx
// Lines 297-316
const showBackupHistory = useCallback(async (device: Device) => {
  try {
    setSelectedDevice(device)

    // ❌ Load backup history - replace with actual API call
    const mockHistory: BackupHistoryEntry[] = [
      {
        id: '1',
        date: '2024-01-15 10:30:00',
        size: '2.3 MB',
        status: 'success'
      }
    ]

    setBackupHistory(mockHistory)
    setIsHistoryModalOpen(true)
  } catch {
    showMessage('Failed to load backup history')
  }
}, [showMessage])
```

**Issues:**
- No actual backup functionality
- No connection to job system
- No Git repository integration
- No configuration file storage
- No history tracking
- All operations are fake

**Required Backend:**
```
backend/
├── models.py                    # Already has backup-related fields
├── repositories/
│   └── backup_repository.py    # ❌ MISSING - Data access layer
├── services/
│   └── backup_service.py       # ❌ MISSING - Business logic
└── routers/network/configs/
    └── backup.py               # ❌ MISSING - API endpoints
```

---

### Problem 2: Architecture Violation - Manual State Management

**Affected Lines:** 64-108

**25+ useState hooks breakdown:**

**Server Data (4 variables) - CRITICAL VIOLATION:**
```tsx
// Lines 64-68: Should NEVER use useState for server data
const [devices, setDevices] = useState<Device[]>([])
const [filteredDevices, setFilteredDevices] = useState<Device[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
```

**Pagination State (6 variables):**
```tsx
// Lines 71-81: Manual pagination tracking
const [currentPage, setCurrentPage] = useState(0)
const [pageSize, setPageSize] = useState(50)
const [paginationState, setPaginationState] = useState<PaginationState>({
  isBackendPaginated: false,
  hasMore: false,
  totalCount: 0,
  currentLimit: null,
  currentOffset: 0,
  filterType: null,
  filterValue: null,
})
```

**Filter State (6 variables):**
```tsx
// Lines 84-90: Manual filter state
const [deviceNameFilter, setDeviceNameFilter] = useState('')
const [roleFilter, setRoleFilter] = useState('')
const [locationFilter, setLocationFilter] = useState('')
const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
const [statusFilter, setStatusFilter] = useState('')
const [dateFilter, setDateFilter] = useState('')
const [dateComparison, setDateComparison] = useState('')
```

**Sorting State (2 variables):**
```tsx
// Lines 93-94: Manual sorting state
const [sortColumn, setSortColumn] = useState('')
const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none')
```

**Filter Options (1 variable):**
```tsx
// Lines 97-102: Derived data stored in state
const [filterOptions, setFilterOptions] = useState<FilterOptions>({
  roles: new Set(),
  locations: new Set(),
  deviceTypes: new Set(),
  statuses: new Set(),
})
```

**Modal/UI State (5 variables):**
```tsx
// Lines 105-108: UI state (acceptable)
const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([])
const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
const [backupInProgress, setBackupInProgress] = useState<Set<string>>(new Set())
const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)
```

**Issues:**
- Violates CLAUDE.md: "❌ Manual `useState + useEffect` for server data"
- 25+ separate useState hooks
- Manual synchronization between states
- No automatic caching
- No automatic refetch
- Difficult to maintain

---

### Problem 3: Client-Side Heavy Operations

**Affected Lines:** 197-254 (applyFilters), 227-250 (sorting), 318-328 (pagination)

**Client-Side Filtering:**
```tsx
// Lines 197-254: 58 lines of complex filter logic
const applyFilters = useCallback(() => {
  let filtered = devices.filter(device => {
    // Device name filter
    if (deviceNameFilter) {
      const deviceName = (device.name || '').toLowerCase()
      if (!deviceName.includes(deviceNameFilter.toLowerCase())) {
        return false
      }
    }

    // Header filters
    if (roleFilter && device.role?.name !== roleFilter) return false
    if (locationFilter && device.location?.name !== locationFilter) return false
    if (deviceTypeFilter && device.device_type?.model !== deviceTypeFilter) return false
    if (statusFilter && device.status?.name !== statusFilter) return false

    // Date filter
    if (dateFilter && dateComparison && device.cf_last_backup) {
      const deviceDate = new Date(device.cf_last_backup)
      const filterDate = new Date(dateFilter)

      if (dateComparison === 'lte' && deviceDate > filterDate) return false
      if (dateComparison === 'lt' && deviceDate >= filterDate) return false
    }

    return true
  })

  // Apply sorting
  if (sortColumn && sortOrder !== 'none') {
    filtered = filtered.slice().sort((a, b) => {
      // ... 23 lines of sorting logic
    })
  }

  setFilteredDevices(filtered)
  setCurrentPage(0)
}, [devices, deviceNameFilter, roleFilter, locationFilter, deviceTypeFilter, statusFilter, dateFilter, dateComparison, sortColumn, sortOrder])
```

**Issues:**
- All filtering done in browser (performance issues with many devices)
- All sorting done in browser
- Re-runs on every state change (58-line function)
- Should be backend query params
- No debouncing on filter inputs
- Loads ALL devices then filters client-side

**Backend Should Handle:**
```typescript
// Backend API with query params
GET /api/network/devices?
  name__icontains=router
  &role=edge-router
  &location=datacenter-1
  &status=active
  &last_backup__lte=2024-01-30
  &sort=last_backup
  &order=desc
  &limit=50
  &offset=0
```

---

### Problem 4: Manual Device Loading

**Affected Lines:** 118-194 (loadDevices function)

**77 lines of manual API call logic:**
```tsx
const loadDevices = useCallback(async (
  deviceNameFilter = '',
  useBackendPagination = false,
  limit: number | null = null,
  offset = 0
) => {
  try {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (useBackendPagination && limit) {
      params.append('limit', limit.toString())
      params.append('offset', offset.toString())
    }
    if (deviceNameFilter) {
      params.append('filter_type', 'name')
      params.append('filter_value', deviceNameFilter)
    }

    const endpoint = `nautobot/devices${params.toString() ? '?' + params.toString() : ''}`
    const response = await apiCall<{...}>(endpoint)

    if (response?.devices) {
      const newDevices = response.devices
      setDevices(newDevices)

      // Update pagination state (30+ lines)
      setPaginationState({...})

      // Extract filter options (20+ lines)
      if (!useBackendPagination) {
        const newFilterOptions: FilterOptions = {...}
        newDevices.forEach((device: Device) => {
          // Populate filter dropdowns
        })
        setFilterOptions(newFilterOptions)
      }

      setStatusMessage(null)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load devices'
    setError(message)
    showMessage(message)
  } finally {
    setLoading(false)
  }
}, [apiCall, showMessage])
```

**Issues:**
- 77 lines of manual fetch logic
- Manual loading/error state management
- No caching
- No automatic refetch
- Inconsistent error handling
- Complex parameter handling

**TanStack Query Eliminates All Of This:**
```tsx
export function useBackupDevices(filters: DeviceFilters) {
  const { apiCall } = useApi()
  return useQuery({
    queryKey: queryKeys.network.backupDevices(filters),
    queryFn: async () => {
      const params = new URLSearchParams({
        ...filters,
        limit: filters.limit?.toString() || '50',
        offset: filters.offset?.toString() || '0',
      })
      const response = await apiCall(`/api/network/backup/devices?${params}`)
      return response?.devices || []
    },
    staleTime: 30 * 1000,
  })
}
```

---

### Problem 5: Component Size (864 Lines)

**Current Structure:**
- Lines 1-14: Imports (14 lines)
- Lines 16-54: Type definitions (39 lines)
- Lines 56-108: Component state (53 lines)
- Lines 110-194: Data loading logic (85 lines)
- Lines 196-269: Filter/reset handlers (74 lines)
- Lines 271-316: Backup operations (46 lines)
- Lines 318-341: Pagination/sorting (24 lines)
- Lines 343-356: Effects (14 lines)
- Lines 358-383: Helper functions (26 lines)
- Lines 385-862: **JSX rendering (477 lines)**
  - Lines 477-526: Filter controls (50 lines)
  - Lines 529-798: Device table (270 lines)
  - Lines 800-860: History modal (61 lines)

**Target per CLAUDE.md:** < 300 lines per component

**Required Decomposition:**
1. `backup-page.tsx` - Main container (~120 lines)
2. `components/backup-filters.tsx` - Filter controls (~100 lines)
3. `components/backup-devices-table.tsx` - Table wrapper (~150 lines)
4. `components/backup-history-dialog.tsx` - History modal (~80 lines)
5. `hooks/use-backup-devices.tsx` - Device query hook (~50 lines)
6. `hooks/use-backup-mutations.tsx` - Backup mutations (~100 lines)
7. `types/index.ts` - Type definitions (~60 lines)
8. `utils/constants.ts` - Constants (~40 lines)

---

### Problem 6: No Form Validation

**Affected Lines:** Filter inputs (492-511)

**Date Filter (No Validation):**
```tsx
// Lines 492-511: No validation on date input
<Input
  id="backup-date-filter"
  type="date"
  value={dateFilter}
  onChange={(e) => setDateFilter(e.target.value)}
  className="min-w-[150px]"
/>

<Select value={dateComparison || "none"} onValueChange={(value) => setDateComparison(value === "none" ? "" : value)}>
  <SelectContent>
    <SelectItem value="none">No Date Filter</SelectItem>
    <SelectItem value="lte">≤ (Less/Equal)</SelectItem>
    <SelectItem value="lt">&lt; (Less Than)</SelectItem>
  </SelectContent>
</Select>
```

**Issues:**
- No date format validation
- No range validation (prevent future dates?)
- No required field validation
- Date comparison can be set without date
- No error messages

**Required Fix:**
```tsx
// Use Zod schema for filter validation
const backupFilterSchema = z.object({
  deviceName: z.string().optional(),
  role: z.string().optional(),
  location: z.string().optional(),
  deviceType: z.string().optional(),
  status: z.string().optional(),
  lastBackupDate: z.string().optional(),
  dateComparison: z.enum(['lte', 'lt', '']).optional(),
}).refine((data) => {
  // Date comparison requires date
  if (data.dateComparison && data.dateComparison !== '' && !data.lastBackupDate) {
    return false
  }
  return true
}, {
  message: "Date comparison requires a date to be selected",
  path: ["lastBackupDate"]
})
```

---

### Problem 7: Inefficient Re-renders

**Affected Lines:** 353-356 (useEffect)

**Problematic useEffect:**
```tsx
// Lines 353-356: Runs on every filter/sort change
useEffect(() => {
  applyFilters()
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [devices, deviceNameFilter, roleFilter, locationFilter, deviceTypeFilter, statusFilter, dateFilter, dateComparison, sortColumn, sortOrder])
```

**Issues:**
- Runs 58-line `applyFilters` function on every state change
- No debouncing on text inputs
- Filters entire device array on every keystroke
- Should use backend filtering with debounced query
- Disabled exhaustive-deps (bad practice)

**Better Approach:**
```tsx
// Debounced backend query
const debouncedFilters = useDebounce(filters, 300)
const { data: devices } = useBackupDevices(debouncedFilters)

// No need for applyFilters - backend handles it
```

---

## Proposed Refactoring Plan

### Phase 1: Backend Implementation (HIGH PRIORITY)

**1.1: Create Backup Repository**

**File:** `/backend/repositories/backup_repository.py` (new)

```python
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.core.models import Device, GitRepository
from backend.repositories.base import BaseRepository

class BackupRepository(BaseRepository):
    def get_devices_for_backup(
        self,
        db: Session,
        *,
        name: Optional[str] = None,
        role: Optional[str] = None,
        location: Optional[str] = None,
        device_type: Optional[str] = None,
        status: Optional[str] = None,
        last_backup_before: Optional[str] = None,
        last_backup_comparison: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: str = 'asc',
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[Device], int]:
        """
        Get devices with backup filtering, sorting, and pagination.
        Returns (devices, total_count).
        """
        # Query implementation with filters
        pass

    def get_backup_history(
        self,
        db: Session,
        *,
        device_id: str,
        limit: int = 50
    ) -> List[dict]:
        """
        Get backup history for a device from Git repository.
        """
        # Query git commit history for device configs
        pass

    def get_latest_backup_date(
        self,
        db: Session,
        device_id: str
    ) -> Optional[str]:
        """
        Get the latest backup timestamp for a device.
        """
        pass
```

---

**1.2: Create Backup Service**

**File:** `/backend/services/backup_service.py` (new)

```python
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.repositories.backup_repository import BackupRepository
from backend.services.job_manager import JobManager

class BackupService:
    def __init__(self):
        self.repository = BackupRepository()
        self.job_manager = JobManager()

    async def get_devices_for_backup(
        self,
        db: Session,
        filters: dict,
        pagination: dict,
        sorting: dict
    ) -> dict:
        """
        Get devices with backup status and filtering.
        """
        devices, total = self.repository.get_devices_for_backup(
            db,
            name=filters.get('name'),
            role=filters.get('role'),
            location=filters.get('location'),
            device_type=filters.get('device_type'),
            status=filters.get('status'),
            last_backup_before=filters.get('last_backup_date'),
            last_backup_comparison=filters.get('date_comparison'),
            sort_by=sorting.get('column'),
            sort_order=sorting.get('order', 'asc'),
            limit=pagination.get('limit', 50),
            offset=pagination.get('offset', 0)
        )

        return {
            'devices': devices,
            'total': total,
            'limit': pagination.get('limit', 50),
            'offset': pagination.get('offset', 0)
        }

    async def trigger_device_backup(
        self,
        db: Session,
        device_id: str,
        user_id: int
    ) -> dict:
        """
        Trigger backup job for a single device.
        Uses existing job template system.
        """
        # Create backup job using job template
        # Link to Celery task
        # Return task_id for polling
        pass

    async def trigger_bulk_backup(
        self,
        db: Session,
        device_ids: List[str],
        user_id: int
    ) -> dict:
        """
        Trigger backup job for multiple devices.
        """
        pass

    async def get_backup_history(
        self,
        db: Session,
        device_id: str
    ) -> List[dict]:
        """
        Get backup history from Git repository.
        """
        return self.repository.get_backup_history(db, device_id=device_id)

    async def download_backup(
        self,
        db: Session,
        device_id: str,
        backup_id: str
    ) -> bytes:
        """
        Download a specific backup file.
        """
        pass

    async def restore_backup(
        self,
        db: Session,
        device_id: str,
        backup_id: str,
        user_id: int
    ) -> dict:
        """
        Trigger restore job for a backup.
        """
        pass
```

---

**1.3: Create Backup Router**

**File:** `/backend/routers/network/configs/backup.py` (new)

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from backend.core.database import get_db
from backend.core.auth import verify_token, require_permission
from backend.services.backup_service import BackupService
from pydantic import BaseModel

router = APIRouter(prefix="/backup", tags=["network-backup"])
backup_service = BackupService()

class BackupFilters(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None
    last_backup_date: Optional[str] = None
    date_comparison: Optional[str] = None

class BackupTrigger(BaseModel):
    device_id: str

class BulkBackupTrigger(BaseModel):
    device_ids: list[str]

@router.get(
    "/devices",
    dependencies=[Depends(require_permission("network", "read"))]
)
async def get_backup_devices(
    name: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    device_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    last_backup_date: Optional[str] = Query(None),
    date_comparison: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: str = Query('asc'),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token)
):
    """
    Get devices with backup status, filtering, sorting, and pagination.
    """
    filters = {
        'name': name,
        'role': role,
        'location': location,
        'device_type': device_type,
        'status': status,
        'last_backup_date': last_backup_date,
        'date_comparison': date_comparison
    }

    pagination = {'limit': limit, 'offset': offset}
    sorting = {'column': sort_by, 'order': sort_order}

    return await backup_service.get_devices_for_backup(
        db, filters, pagination, sorting
    )

@router.post(
    "/trigger",
    dependencies=[Depends(require_permission("network", "write"))]
)
async def trigger_backup(
    payload: BackupTrigger,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token)
):
    """
    Trigger backup for a single device.
    """
    return await backup_service.trigger_device_backup(
        db, payload.device_id, user['user_id']
    )

@router.post(
    "/trigger-bulk",
    dependencies=[Depends(require_permission("network", "write"))]
)
async def trigger_bulk_backup(
    payload: BulkBackupTrigger,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token)
):
    """
    Trigger backup for multiple devices.
    """
    return await backup_service.trigger_bulk_backup(
        db, payload.device_ids, user['user_id']
    )

@router.get(
    "/history/{device_id}",
    dependencies=[Depends(require_permission("network", "read"))]
)
async def get_backup_history(
    device_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token)
):
    """
    Get backup history for a device.
    """
    return await backup_service.get_backup_history(db, device_id)

@router.get(
    "/download/{device_id}/{backup_id}",
    dependencies=[Depends(require_permission("network", "read"))]
)
async def download_backup(
    device_id: str,
    backup_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token)
):
    """
    Download a specific backup file.
    """
    content = await backup_service.download_backup(db, device_id, backup_id)
    return Response(content=content, media_type="text/plain")

@router.post(
    "/restore/{device_id}/{backup_id}",
    dependencies=[Depends(require_permission("network", "write"))]
)
async def restore_backup(
    device_id: str,
    backup_id: str,
    db: Session = Depends(get_db),
    user: dict = Depends(verify_token)
):
    """
    Trigger restore job for a backup.
    """
    return await backup_service.restore_backup(
        db, device_id, backup_id, user['user_id']
    )
```

---

**1.4: Register Router**

**File:** `/backend/routers/network/configs/__init__.py` (modify)

```python
from .compare import router as compare_router
from .backup import router as backup_router

# Combine routers
from fastapi import APIRouter
router = APIRouter()
router.include_router(compare_router)
router.include_router(backup_router)

__all__ = ["router"]
```

**File:** `/backend/main.py` (verify registration)

```python
# Should already include network router
from backend.routers.network import router as network_router
app.include_router(network_router, prefix="/api/network")
```

---

### Phase 2: TanStack Query Migration

**2.1: Extract Type Definitions**

**File:** `types/index.ts` (new)

```typescript
export interface Device {
  id: string
  name: string
  primary_ip4?: { address: string }
  role?: { name: string }
  location?: { name: string }
  device_type?: { model: string }
  status?: { name: string }
  cf_last_backup?: string
}

export interface BackupHistoryEntry {
  id: string
  date: string
  size: string
  status: 'success' | 'failed' | 'in_progress'
  commit_hash?: string
}

export interface DeviceFilters {
  name?: string
  role?: string
  location?: string
  deviceType?: string
  status?: string
  lastBackupDate?: string
  dateComparison?: 'lte' | 'lt' | ''
}

export interface BackupPagination {
  limit: number
  offset: number
}

export interface BackupSorting {
  column: string
  order: 'asc' | 'desc' | 'none'
}

export interface FilterOptions {
  roles: Set<string>
  locations: Set<string>
  deviceTypes: Set<string>
  statuses: Set<string>
}
```

---

**2.2: Extract Constants**

**File:** `utils/constants.ts` (new)

```typescript
import type { Device, BackupHistoryEntry, FilterOptions } from '../types'

export const EMPTY_DEVICES: Device[] = []
export const EMPTY_HISTORY: BackupHistoryEntry[] = []
export const EMPTY_FILTER_OPTIONS: FilterOptions = {
  roles: new Set(),
  locations: new Set(),
  deviceTypes: new Set(),
  statuses: new Set(),
}

export const DEFAULT_PAGE_SIZE = 50
export const DEFAULT_PAGINATION = {
  limit: 50,
  offset: 0,
}

export const STALE_TIME = {
  DEVICES: 30 * 1000,        // 30 seconds
  HISTORY: 60 * 1000,        // 1 minute
  FILTER_OPTIONS: 5 * 60 * 1000,  // 5 minutes
} as const

export const STATUS_BADGE_VARIANTS = {
  active: 'default',
  online: 'default',
  offline: 'destructive',
  failed: 'destructive',
  maintenance: 'secondary',
} as const
```

---

**2.3: Create Query Keys**

**File:** `/frontend/src/lib/query-keys.ts` (modify)

```typescript
export const queryKeys = {
  // ... existing keys ...

  network: {
    all: ['network'] as const,

    // Backup
    backupDevices: (filters?: DeviceFilters) =>
      filters
        ? ([...queryKeys.network.all, 'backup-devices', filters] as const)
        : ([...queryKeys.network.all, 'backup-devices'] as const),
    backupHistory: (deviceId: string) =>
      [...queryKeys.network.all, 'backup-history', deviceId] as const,
  },
}
```

---

**2.4: Create Query Hooks**

**File:** `hooks/use-backup-devices.ts` (new)

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { STALE_TIME, EMPTY_DEVICES } from '../utils/constants'
import type { Device, DeviceFilters, BackupPagination, BackupSorting } from '../types'

interface UseBackupDevicesOptions {
  filters?: DeviceFilters
  pagination?: BackupPagination
  sorting?: BackupSorting
  enabled?: boolean
}

const DEFAULT_OPTIONS: UseBackupDevicesOptions = {
  enabled: true
}

export function useBackupDevices(options: UseBackupDevicesOptions = DEFAULT_OPTIONS) {
  const { apiCall } = useApi()
  const { filters, pagination, sorting, enabled = true } = options

  return useQuery({
    queryKey: queryKeys.network.backupDevices({ ...filters, ...pagination, ...sorting }),
    queryFn: async () => {
      const params = new URLSearchParams()

      // Filters
      if (filters?.name) params.append('name', filters.name)
      if (filters?.role) params.append('role', filters.role)
      if (filters?.location) params.append('location', filters.location)
      if (filters?.deviceType) params.append('device_type', filters.deviceType)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.lastBackupDate) params.append('last_backup_date', filters.lastBackupDate)
      if (filters?.dateComparison) params.append('date_comparison', filters.dateComparison)

      // Pagination
      if (pagination?.limit) params.append('limit', pagination.limit.toString())
      if (pagination?.offset) params.append('offset', pagination.offset.toString())

      // Sorting
      if (sorting?.column) params.append('sort_by', sorting.column)
      if (sorting?.order && sorting.order !== 'none') params.append('sort_order', sorting.order)

      const response = await apiCall<{
        devices: Device[]
        total: number
        limit: number
        offset: number
      }>(`/api/network/backup/devices?${params}`)

      return {
        devices: response?.devices || EMPTY_DEVICES,
        total: response?.total || 0,
        limit: response?.limit || 50,
        offset: response?.offset || 0
      }
    },
    enabled,
    staleTime: STALE_TIME.DEVICES,
  })
}

export function useBackupHistory(deviceId: string, options: { enabled?: boolean } = {}) {
  const { apiCall } = useApi()
  const { enabled = true } = options

  return useQuery({
    queryKey: queryKeys.network.backupHistory(deviceId),
    queryFn: async () => {
      const response = await apiCall<BackupHistoryEntry[]>(
        `/api/network/backup/history/${deviceId}`
      )
      return response || EMPTY_HISTORY
    },
    enabled: enabled && !!deviceId,
    staleTime: STALE_TIME.HISTORY,
  })
}
```

---

**2.5: Create Mutation Hooks**

**File:** `hooks/use-backup-mutations.ts` (new)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import { useMemo } from 'react'

export function useBackupMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Trigger backup for single device
  const triggerBackup = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiCall('/api/network/backup/trigger', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId })
      })
    },
    onSuccess: (data, deviceId) => {
      // Invalidate devices query to refresh backup status
      queryClient.invalidateQueries({ queryKey: queryKeys.network.backupDevices() })

      toast({
        title: 'Backup Started',
        description: `Backup job initiated. Task ID: ${data.task_id}`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Backup Failed',
        description: error.message || 'Failed to start backup.',
        variant: 'destructive'
      })
    }
  })

  // Trigger bulk backup
  const triggerBulkBackup = useMutation({
    mutationFn: async (deviceIds: string[]) => {
      return apiCall('/api/network/backup/trigger-bulk', {
        method: 'POST',
        body: JSON.stringify({ device_ids: deviceIds })
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.network.backupDevices() })

      toast({
        title: 'Bulk Backup Started',
        description: `Backup initiated for ${data.device_count} devices.`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk Backup Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Download backup
  const downloadBackup = useMutation({
    mutationFn: async ({ deviceId, backupId }: { deviceId: string; backupId: string }) => {
      return apiCall(`/api/network/backup/download/${deviceId}/${backupId}`, {
        method: 'GET'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Download Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  // Restore backup
  const restoreBackup = useMutation({
    mutationFn: async ({ deviceId, backupId }: { deviceId: string; backupId: string }) => {
      return apiCall(`/api/network/backup/restore/${deviceId}/${backupId}`, {
        method: 'POST'
      })
    },
    onSuccess: () => {
      toast({
        title: 'Restore Started',
        description: 'Configuration restore job has been initiated.',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Restore Failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  return useMemo(() => ({
    triggerBackup,
    triggerBulkBackup,
    downloadBackup,
    restoreBackup,
  }), [triggerBackup, triggerBulkBackup, downloadBackup, restoreBackup])
}
```

---

### Phase 3: Component Decomposition

**3.1: Extract Filter Component**

**File:** `components/backup-filters.tsx` (new)

```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Filter, RotateCcw } from 'lucide-react'
import type { DeviceFilters } from '../types'

interface BackupFiltersProps {
  filters: DeviceFilters
  onFiltersChange: (filters: DeviceFilters) => void
  onReset: () => void
  activeFiltersCount: number
}

export function BackupFilters({
  filters,
  onFiltersChange,
  onReset,
  activeFiltersCount
}: BackupFiltersProps) {
  return (
    <Card>
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Filter & Controls</h3>
            <p className="text-blue-100 text-xs">Filter devices by backup date and manage display options</p>
          </div>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="backup-date-filter">Last Backup Date</Label>
            <Input
              id="backup-date-filter"
              type="date"
              value={filters.lastBackupDate || ''}
              onChange={(e) => onFiltersChange({ ...filters, lastBackupDate: e.target.value })}
              className="min-w-[150px]"
            />
          </div>

          <div>
            <Label htmlFor="date-comparison">Date Comparison</Label>
            <Select
              value={filters.dateComparison || "none"}
              onValueChange={(value) => onFiltersChange({
                ...filters,
                dateComparison: value === "none" ? "" : value as 'lte' | 'lt'
              })}
            >
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="No Date Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Date Filter</SelectItem>
                <SelectItem value="lte">≤ (Less/Equal)</SelectItem>
                <SelectItem value="lt">&lt; (Less Than)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

**3.2: Extract Devices Table**

**File:** `components/backup-devices-table.tsx` (new)

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, History, Search } from 'lucide-react'
import { useBackupMutations } from '../hooks/use-backup-mutations'
import type { Device, DeviceFilters, FilterOptions } from '../types'

interface BackupDevicesTableProps {
  devices: Device[]
  total: number
  filters: DeviceFilters
  onFiltersChange: (filters: DeviceFilters) => void
  filterOptions: FilterOptions
  onShowHistory: (device: Device) => void
  backupInProgress: Set<string>
}

export function BackupDevicesTable({
  devices,
  total,
  filters,
  onFiltersChange,
  filterOptions,
  onShowHistory,
  backupInProgress
}: BackupDevicesTableProps) {
  const { triggerBackup } = useBackupMutations()

  const handleBackup = (device: Device) => {
    triggerBackup.mutate(device.id)
  }

  const isDeviceOffline = (status: string) => {
    const statusLower = status.toLowerCase()
    return statusLower.includes('offline') || statusLower.includes('failed')
  }

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active') || statusLower.includes('online')) {
      return 'default'
    } else if (statusLower.includes('offline') || statusLower.includes('failed')) {
      return 'destructive'
    } else if (statusLower.includes('maintenance')) {
      return 'secondary'
    }
    return 'outline'
  }

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Device Backup Management</h3>
            <p className="text-blue-100 text-xs">
              Showing {devices.length} of {total} devices
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">
                  <div className="space-y-1">
                    <div>Device Name</div>
                    <div>
                      <Input
                        placeholder="Filter by name..."
                        value={filters.name || ''}
                        onChange={(e) => onFiltersChange({ ...filters, name: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </th>
                <th className="text-left p-2 font-medium">IP Address</th>
                <th className="text-left p-2 font-medium">
                  <div className="space-y-1">
                    <div>Role</div>
                    <div>
                      <Select
                        value={filters.role || "all"}
                        onValueChange={(value) => onFiltersChange({
                          ...filters,
                          role: value === "all" ? "" : value
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          {Array.from(filterOptions.roles).sort().map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </th>
                {/* Similar for location, device type, status */}
                <th className="text-left p-2 font-medium">Last Backup</th>
                <th className="text-left p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const isOffline = isDeviceOffline(device.status?.name || '')
                const isBackingUp = backupInProgress.has(device.id)

                return (
                  <tr key={device.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{device.name}</td>
                    <td className="p-2">{device.primary_ip4?.address || 'N/A'}</td>
                    <td className="p-2">{device.role?.name || 'Unknown'}</td>
                    <td className="p-2">
                      <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
                        {device.status?.name || 'Unknown'}
                      </Badge>
                    </td>
                    <td className="p-2">{device.cf_last_backup || 'Never'}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBackup(device)}
                          disabled={isOffline || isBackingUp}
                          title="Backup Device"
                        >
                          {isBackingUp ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onShowHistory(device)}
                          title="View Backup History"
                        >
                          <History className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

---

**3.3: Extract History Dialog**

**File:** `components/backup-history-dialog.tsx` (new)

```typescript
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download } from 'lucide-react'
import { useBackupHistory } from '../hooks/use-backup-devices'
import { useBackupMutations } from '../hooks/use-backup-mutations'
import type { Device } from '../types'

interface BackupHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: Device | null
}

export function BackupHistoryDialog({
  open,
  onOpenChange,
  device
}: BackupHistoryDialogProps) {
  const { data: history = [], isLoading } = useBackupHistory(
    device?.id || '',
    { enabled: open && !!device }
  )
  const { downloadBackup, restoreBackup } = useBackupMutations()

  const handleDownload = (backupId: string) => {
    if (!device) return
    downloadBackup.mutate({ deviceId: device.id, backupId })
  }

  const handleRestore = (backupId: string) => {
    if (!device) return
    if (!confirm('Are you sure you want to restore this configuration?')) return
    restoreBackup.mutate({ deviceId: device.id, backupId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Backup History - {device?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center p-8">Loading history...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Date</th>
                  <th className="text-left p-2 font-medium">Size</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-muted-foreground">
                      No backup history found
                    </td>
                  </tr>
                ) : (
                  history.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2">{entry.date}</td>
                      <td className="p-2">{entry.size}</td>
                      <td className="p-2">
                        <Badge
                          variant={
                            entry.status === 'success' ? 'default' :
                            entry.status === 'failed' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(entry.id)}
                            disabled={downloadBackup.isPending}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(entry.id)}
                            disabled={restoreBackup.isPending}
                          >
                            Restore
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

**3.4: Refactor Main Page**

**File:** `backup-page.tsx` (refactored)

```typescript
'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Save, RotateCcw } from 'lucide-react'
import { useBackupDevices } from './hooks/use-backup-devices'
import { useBackupMutations } from './hooks/use-backup-mutations'
import { BackupFilters } from './components/backup-filters'
import { BackupDevicesTable } from './components/backup-devices-table'
import { BackupHistoryDialog } from './components/backup-history-dialog'
import { DEFAULT_PAGE_SIZE } from './utils/constants'
import type { Device, DeviceFilters } from './types'

export default function BackupPage() {
  // UI state only
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [backupInProgress, setBackupInProgress] = useState<Set<string>>(new Set())

  // Filter/pagination state
  const [filters, setFilters] = useState<DeviceFilters>({})
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // TanStack Query - replaces ALL manual state management
  const { data, isLoading } = useBackupDevices({
    filters,
    pagination: {
      limit: pageSize,
      offset: currentPage * pageSize
    }
  })

  const { triggerBulkBackup } = useBackupMutations()

  const devices = data?.devices || []
  const total = data?.total || 0

  // Derived state (use useMemo, not useState)
  const filterOptions = useMemo(() => {
    const options = {
      roles: new Set<string>(),
      locations: new Set<string>(),
      deviceTypes: new Set<string>(),
      statuses: new Set<string>(),
    }

    devices.forEach(device => {
      if (device.role?.name) options.roles.add(device.role.name)
      if (device.location?.name) options.locations.add(device.location.name)
      if (device.device_type?.model) options.deviceTypes.add(device.device_type.model)
      if (device.status?.name) options.statuses.add(device.status.name)
    })

    return options
  }, [devices])

  const activeFiltersCount = Object.values(filters).filter(Boolean).length

  const handleShowHistory = (device: Device) => {
    setSelectedDevice(device)
    setIsHistoryModalOpen(true)
  }

  const handleBulkBackup = () => {
    const deviceIds = devices.map(d => d.id)
    triggerBulkBackup.mutate(deviceIds)
  }

  const handleResetFilters = () => {
    setFilters({})
    setCurrentPage(0)
  }

  if (isLoading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading devices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Save className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configuration Backup</h1>
            <p className="text-gray-600 mt-1">Manage device configuration backups</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            disabled={isLoading}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={handleBulkBackup}
            disabled={devices.length === 0 || triggerBulkBackup.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Backup All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <BackupFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
        activeFiltersCount={activeFiltersCount}
      />

      {/* Devices Table */}
      <BackupDevicesTable
        devices={devices}
        total={total}
        filters={filters}
        onFiltersChange={setFilters}
        filterOptions={filterOptions}
        onShowHistory={handleShowHistory}
        backupInProgress={backupInProgress}
      />

      {/* History Dialog */}
      <BackupHistoryDialog
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        device={selectedDevice}
      />
    </div>
  )
}
```

**Before:** 864 lines
**After:** ~140 lines
**Reduction:** -724 lines (-84%)

---

## Final Directory Structure

```
backend/
├── repositories/
│   └── backup_repository.py        # ~100 lines (data access)
├── services/
│   └── backup_service.py           # ~150 lines (business logic)
└── routers/network/configs/
    └── backup.py                   # ~120 lines (API endpoints)

frontend/src/components/features/network/configs/backup/
├── backup-page.tsx                 # ~140 lines (was 864, -84%)
├── components/
│   ├── backup-filters.tsx          # ~100 lines
│   ├── backup-devices-table.tsx    # ~150 lines
│   └── backup-history-dialog.tsx   # ~80 lines
├── hooks/
│   ├── use-backup-devices.ts       # ~70 lines (2 query hooks)
│   └── use-backup-mutations.ts     # ~100 lines (4 mutations)
├── types/
│   └── index.ts                    # ~60 lines
└── utils/
    └── constants.ts                # ~40 lines
```

**Backend Total:** ~370 lines (new implementation)
**Frontend Total:** ~740 lines across 8 files (vs 864 in 1 file)
**Net change:** +370 backend, -124 frontend

---

## Summary of Changes

| Layer | Before | After | Change |
|-------|--------|-------|--------|
| **Backend** | 0 | ~370 | **+370 lines (NEW)** |
| **Frontend Main** | 864 | ~140 | **-724 lines (-84%)** |
| **Frontend Components** | 0 | ~330 | **+330 lines** |
| **Frontend Hooks** | 0 | ~170 | **+170 lines** |
| **Frontend Types/Utils** | 0 | ~100 | **+100 lines** |
| **Total Frontend** | **864** | **~740** | **-124 lines (-14%)** |
| **Total Overall** | **864** | **~1,110** | **+246 lines (+28%)** |

**Net increase** of 246 lines, but with complete backend implementation and proper architecture:
- Full backend repository/service/router pattern
- TanStack Query compliance
- Component decomposition
- Real API integration (no mocks)
- Automatic caching and refetch
- Better error handling
- Improved maintainability

---

## Architecture Compliance (CLAUDE.md)

### Success Metrics

**Backend Architecture:**
- [ ] Repository layer for data access
- [ ] Service layer for business logic
- [ ] Router with auth dependencies
- [ ] Integration with job system
- [ ] Git repository integration
- [ ] Celery task integration

**Frontend Architecture:**
- [ ] Component size < 300 lines each (main ~140 lines)
- [ ] No manual `useState` for server data (TanStack Query only)
- [ ] All data fetching uses TanStack Query
- [ ] Query keys in centralized factory
- [ ] API calls via proxy pattern
- [ ] Feature-based folder structure
- [ ] All UI components from Shadcn

**User Experience:**
- [ ] Real backup functionality (not mocked)
- [ ] Backup history from Git repository
- [ ] Download/restore functionality
- [ ] Bulk backup operations
- [ ] Backend filtering/sorting/pagination
- [ ] Improved loading states
- [ ] Better error messages

**Developer Experience:**
- [ ] Easier to test (isolated components/hooks)
- [ ] Clear separation of concerns
- [ ] Reusable hooks
- [ ] Type safety throughout
- [ ] Consistent with other network pages

---

## Anti-Patterns to Avoid

### ❌ DO NOT Do These During Refactoring

**1. Don't Keep Mock Operations**
- ❌ `await new Promise(resolve => setTimeout(resolve, 2000))`
- ✅ **Instead:** Real backend API calls to job system

**2. Don't Keep Manual State for Server Data**
- ❌ `const [devices, setDevices] = useState<Device[]>([])`
- ✅ **Instead:** `const { data: devices } = useBackupDevices(filters)`

**3. Don't Keep Client-Side Filtering**
- ❌ 58-line `applyFilters` function
- ✅ **Instead:** Backend query params with filters

**4. Don't Keep Manual Pagination**
- ❌ `const paginatedDevices = devices.slice(start, end)`
- ✅ **Instead:** Backend pagination with offset/limit

**5. Don't Skip Backend Implementation**
- ❌ Frontend-only refactoring
- ✅ **Instead:** Full backend repository/service/router layers

**6. Don't Forget Job Integration**
- ❌ Custom backup implementation
- ✅ **Instead:** Use existing job template system

---

## Risk Assessment

### Breaking Changes
- ✅ **YES** - Complete rewrite with backend
- ✅ **YES** - API endpoints change
- ✅ **YES** - Requires database schema (already exists)

### Testing Required
- ✅ Backend: Repository queries with filters
- ✅ Backend: Service logic for backup jobs
- ✅ Backend: Router endpoints with auth
- ✅ Frontend: Device loading with filters
- ✅ Frontend: Backup trigger (single/bulk)
- ✅ Frontend: History loading
- ✅ Frontend: Download functionality
- ✅ Frontend: Restore functionality
- ✅ Integration: Job system integration
- ✅ Integration: Git repository storage

---

## Priority & Dependencies

**Priority:** HIGH (functional gap - no backup implementation)
**Complexity:** HIGH (requires full backend + frontend refactoring)
**Dependencies:**
- Job template system (already exists)
- Git repository management (already exists)
- Celery worker infrastructure (already exists)
- Device custom fields for backup timestamps (already exists)

**Phases:**
- Phase 1 (Backend): Repository/Service/Router implementation
- Phase 2 (TanStack Query): Query/mutation hooks
- Phase 3 (Components): Decompose main component
- Testing: Backend + Frontend + Integration

---

## Notes

- Backend infrastructure already exists (job system, git, Celery)
- Database schema already has backup-related fields
- Need to integrate with existing job template system
- Backend filtering will improve performance with many devices
- Consider adding backup scheduling via job scheduler
- History should read from Git commit history
- Download should serve files from Git repository
- Restore should trigger job to push config to device

---

**Document Version:** 1.0
**Created:** 2026-01-30
**Status:** PLANNED
**Priority:** HIGH
**Complexity:** HIGH (backend + frontend)
