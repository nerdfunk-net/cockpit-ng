# Nautobot Device Onboarding Architecture

## Overview

The Nautobot Device Onboarding system provides a comprehensive framework for automatically discovering and adding network devices to Nautobot. It connects to devices via SSH, retrieves their configuration, and creates device records along with interfaces, IP addresses, tags, custom fields, and network data. The system supports three onboarding methods:

1. **Single/Multiple Device Onboarding** - Manual form-based onboarding with real-time progress tracking
2. **CSV Bulk Upload** - Batch onboarding from CSV files with configurable parallelism
3. **Network Scanning** - Discovery of reachable hosts before onboarding

The system uses a **Celery-based asynchronous architecture** where onboarding jobs are queued, dispatched to workers, and tracked with real-time progress updates visible to users.

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js/React)                          │
│                                                                            │
│  ┌──────────────────────────┐  ┌──────────────────────────────────────┐    │
│  │  Onboard Device Page     │  │  Sub-Components & Modals             │    │
│  │                          │  │                                      │    │
│  │  onboard-device-page.tsx │  │  - OnboardingFormFields              │    │
│  │                          │  │  - OnboardingProgressModal           │    │
│  │  - Form inputs           │  │  - NetworkScanModal                  │    │
│  │  - IP validation         │  │  - CSVUploadModal                    │    │
│  │  - Tags & custom fields  │  │  - TagsModal                         │    │
│  │  - Sync options          │  │  - CustomFieldsModal                 │    │
│  │                          │  │  - DeviceSearchResults               │    │
│  └────────────┬─────────────┘  └──────────────────────────────────────┘    │
│               │                                                            │
│               ├──────── Custom Hooks ────────────────────┐                 │
│               │                                          │                 │
│  ┌────────────▼──────────┐  ┌─────────────────────┐      │                 │
│  │ use-onboarding-data   │  │ use-onboarding-form │      │                 │
│  │ - Load dropdowns      │  │ - Form state        │      │                 │
│  │ - Locations, roles,   │  │ - IP validation     │      │                 │
│  │   platforms, statuses │  │ - Device search     │      │                 │
│  │ - Defaults from DB    │  │ - Form validation   │      │                 │
│  └───────────────────────┘  └─────────────────────┘      │                 │
│                                                          │                 │
│  ┌────────────────────────┐  ┌──────────────────────┐    │                 │
│  │ use-csv-upload         │  │ use-job-tracking     │    │                 │
│  │ - Parse CSV            │  │ - Poll Nautobot job  │    │                 │
│  │ - Validate headers     │  │ - Check job status   │    │                 │
│  │ - Bulk onboarding      │  │ - Track job runs     │    │                 │
│  └────────────────────────┘  └──────────────────────┘    │                 │
│                                                          │                 │
└──────────────────────────────────────────────────────────┼─────────────────┘
                                                           │
                    ┌──────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (FastAPI)                                 │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  REST API Routers                                                    │  │
│  │                                                                      │  │
│  │  ┌────────────────────────┐  ┌──────────────────────────────────┐    │  │
│  │  │ routers/nautobot/      │  │ routers/jobs/celery_api.py       │    │  │
│  │  │ devices.py             │  │                                  │    │  │
│  │  │                        │  │ POST /tasks/onboard-device       │    │  │
│  │  │ POST /devices/onboard  │  │   → trigger_onboard_device()     │    │  │
│  │  │   → onboard_device()   │  │   → onboard_device_task.delay()  │    │  │
│  │  │   (Direct job trigger) │  │                                  │    │  │
│  │  │                        │  │ POST /tasks/bulk-onboard-devices │    │  │
│  │  └────────────────────────┘  │   → trigger_bulk_onboard()       │    │  │
│  │                              │   → bulk_onboard_task.delay()    │    │  │
│  │  ┌────────────────────────┐  │                                  │    │  │
│  │  │ routers/nautobot/      │  │ GET /tasks/{task_id}             │    │  │
│  │  │ tools/scan_and_add.py  │  │   → get_task_status()            │    │  │
│  │  │                        │  │   (Poll task progress)           │    │  │
│  │  │ POST /scan             │  └──────────────────────────────────┘    │  │
│  │  │   → start_scan()       │                                          │  │
│  │  │   (Network discovery)  │                                          │  │
│  │  │                        │                                          │  │
│  │  │ GET /scan/{job_id}     │                                          │  │
│  │  │   → get_scan_status()  │                                          │  │
│  │  └────────────────────────┘                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Data Models (Pydantic)                                              │  │
│  │                                                                      │  │
│  │  models/nautobot.py                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ DeviceOnboardRequest:                                          │  │  │
│  │  │   - ip_address: str                                            │  │  │
│  │  │   - location_id, namespace_id, role_id, status_id              │  │  │
│  │  │   - platform_id, secret_groups_id                              │  │  │
│  │  │   - interface_status_id, ip_address_status_id                  │  │  │
│  │  │   - prefix_status_id (optional)                                │  │  │
│  │  │   - port: int = 22                                             │  │  │
│  │  │   - timeout: int = 30                                          │  │  │
│  │  │   - tags: Optional[List[str]]                                  │  │  │
│  │  │   - custom_fields: Optional[Dict[str, str]]                    │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                      │  │
│  │  routers/jobs/celery_api.py (Request Models)                         │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │ OnboardDeviceRequest: DeviceOnboardRequest +                   │  │  │
│  │  │   - onboarding_timeout: int = 120                              │  │  │
│  │  │   - sync_options: List[str] (cables, software, vlans, vrfs)    │  │  │
│  │  │                                                                │  │  │
│  │  │ BulkOnboardDevicesRequest:                                     │  │  │
│  │  │   - devices: List[DeviceConfig]                                │  │  │
│  │  │   - default_config: Dict                                       │  │  │
│  │  │   - parallel_jobs: int = 1                                     │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────┬───────────────────────────────┘
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    │                                                 │
                    ▼                                                 ▼
┌──────────────────────────────────────┐    ┌───────────────────────────────┐
│    CELERY WORKERS (Task Executors)   │    │   NAUTOBOT (External System)  │
│                                      │    │                               │
│  ┌────────────────────────────────┐  │    │  ┌─────────────────────────┐  │
│  │  Single Device Task            │  │    │  │  Job: "Sync Devices     │  │
│  │                                │  │    │  │   From Network"         │  │
│  │  tasks/onboard_device_task.py  │  │    │  │                         │  │
│  │  @shared_task                  │  │    │  │  - SSH to device        │  │
│  │  onboard_device_task()         │  │    │  │  - Auto-detect platform │  │
│  │                                │  │    │  │  - Parse config         │  │
│  │  Workflow:                     │  │    │  │  - Create device        │  │
│  │  1. Trigger Nautobot job       │──┼────▶  │  - Create interfaces    │  │
│  │  2. Wait for completion        │  │    │  │  - Assign IP addresses  │  │
│  │  3. Process each IP:           │◀─┼────│  │                         │  │
│  │     a. Get device UUID         │  │    │  │  Returns: job_id        │  │
│  │     b. Apply tags              │  │    │  └─────────────────────────┘  │
│  │     c. Apply custom fields     │  │    │                               │
│  │     d. Sync network data       │  │    │  ┌─────────────────────────┐  │
│  │  4. Return aggregated results  │  │    │  │  Job Result API         │  │
│  │                                │  │    │  │                         │  │
│  │  Progress tracking:            │  │    │  │  /api/extras/           │  │
│  │  - 5%: Initiating              │  │    │  │  job-results/{id}/      │  │
│  │  - 10%: Job started            │  │    │  │                         │  │
│  │  - 30-59%: Waiting             │  │    │  │  Status values:         │  │
│  │  - 50-95%: Processing devices  │  │    │  │  - pending              │  │
│  │  - 100%: Complete              │  │    │  │  - running              │  │
│  └────────────────────────────────┘  │    │  │  - completed/success    │  │
│                                      │    │  │  - failed/errored       │  │
│  ┌────────────────────────────────┐  │    │  └─────────────────────────┘  │
│  │  Bulk Device Task              │  │    │                               │
│  │                                │  │    │  ┌─────────────────────────┐  │
│  │  tasks/bulk_onboard_task.py    │  │    │  │  REST API               │  │
│  │  @shared_task                  │  │    │  │                         │  │
│  │  bulk_onboard_devices_task()   │  │    │  │  PATCH /api/dcim/       │  │
│  │                                │  │    │  │  devices/{id}/          │  │
│  │  Workflow:                     │  │    │  │                         │  │
│  │  1. Process each device:       │  │    │  │  Update device with:    │  │
│  │     - Trigger onboarding       │──┼────▶  │  - tags: [ids]          │  │
│  │     - Wait for completion      │◀─┼────│  │  - custom_fields: {}    │  │
│  │     - Apply tags & fields      │──┼────▶  │                         │  │
│  │     - Sync network data        │  │    │  └─────────────────────────┘  │
│  │  2. Track progress per device  │  │    │                               │
│  │  3. Return bulk results        │  │    │  ┌─────────────────────────┐  │
│  │                                │  │    │  │  Job: "Sync Network Data│  │
│  │  Parallel mode:                │  │    │  │   From Device"          │  │
│  │  - Split devices into batches  │  │    │  │                         │  │
│  │  - Multiple Celery tasks       │  │    │  │  - Fetch VLANs          │  │
│  │  - Concurrent processing       │  │    │  │  - Fetch VRFs           │  │
│  └────────────────────────────────┘  │    │  │  - Cable connections    │  │
│                                      │    │  │  - Software versions    │  │
│  ┌────────────────────────────────┐  │    │  └─────────────────────────┘  │
│  │  Helper Functions              │  │    │                               │
│  │                                │  │    └───────────────────────────────┘
│  │  _trigger_nautobot_onboarding()│  │
│  │  _wait_for_job_completion()    │  │
│  │  _get_device_id_from_ip()      │  │
│  │  _update_device_tags()         │  │
│  │  _update_device_custom_fields()│  │
│  │  _sync_network_data()          │  │
│  │  _process_single_device()      │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

---

## 1. Single/Multiple Device Onboarding

### What is Device Onboarding?

**Device Onboarding** is the automated process of discovering network devices and adding them to Nautobot. The system:
- Connects via SSH to network devices
- Auto-detects device platform (Cisco IOS, Junos, etc.)
- Creates device records in Nautobot
- Discovers and creates interfaces with IP addresses
- Applies user-specified tags and custom fields
- Optionally syncs additional network data (VLANs, VRFs, cables, software versions)

### Frontend Implementation

**Main Component:** [frontend/src/components/features/nautobot/onboard/onboard-device-page.tsx](frontend/src/components/features/nautobot/onboard/onboard-device-page.tsx)

**Key Features:**
- **Form-based input** with validation
- **IP address validation** (check if device already exists)
- **Device search** by name
- **Location hierarchy** with searchable dropdown
- **Tags modal** for selecting Nautobot tags
- **Custom fields modal** for setting field values
- **Sync options** (cables, software, VLANs, VRFs)
- **Real-time progress modal** with polling
- **Multiple IPs** - comma-separated for batch onboarding
- **Help documentation** built into UI

**Custom Hooks:**

1. **use-onboarding-data.ts** - Data loading hook
   - Loads all dropdown options (locations, namespaces, roles, platforms, statuses, secret groups)
   - Fetches default values from Nautobot settings
   - Builds location hierarchy for nested display
   - Provides helper functions for default selection

2. **use-onboarding-form.ts** - Form state management hook
   - Manages form data state
   - IP address validation (check if exists in Nautobot)
   - Device search functionality
   - Form validation before submission

3. **use-csv-upload.ts** - CSV bulk upload hook
   - Parse CSV files with configurable delimiter
   - Validate CSV headers
   - Convert device names to IDs (locations, roles, platforms, tags)
   - Submit bulk onboarding request

4. **use-job-tracking.ts** - Job status tracking hook
   - Poll Nautobot job status
   - Track job completion
   - Display job results

**Sub-Components:**

- **OnboardingFormFields** - Reusable form fields
- **OnboardingProgressModal** - Real-time progress tracking with Celery task polling
- **NetworkScanModal** - Network discovery before onboarding
- **CSVUploadModal** - Bulk CSV upload interface
- **TagsModal** - Tag selection interface
- **CustomFieldsModal** - Custom field value input
- **DeviceSearchResults** - Display search results
- **ValidationMessage** - Display validation errors/success

### Backend Implementation

#### REST API Endpoints

**1. Direct Nautobot Job Trigger**

**Endpoint:** `POST /api/nautobot/devices/onboard`

**File:** [backend/routers/nautobot/devices.py](backend/routers/nautobot/devices.py)

**Purpose:** Directly trigger Nautobot's "Sync Devices From Network" job without Celery (returns job ID immediately)

**Request Model:**
```python
class DeviceOnboardRequest(BaseModel):
    ip_address: str
    location_id: str
    namespace_id: str
    role_id: str
    status_id: str
    platform_id: str  # or "detect"
    secret_groups_id: str
    interface_status_id: str
    ip_address_status_id: str
    prefix_status_id: Optional[str] = None
    port: int = 22
    timeout: int = 30
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, str]] = None
```

**Workflow:**
1. Get Nautobot configuration (URL, token)
2. Prepare job data with device parameters
3. Call Nautobot job API: `/api/extras/jobs/Sync%20Devices%20From%20Network/run/`
4. Return job ID and status immediately
5. **No** tags/custom fields application (basic onboarding only)

**Use Case:** Quick onboarding when user doesn't need tags/custom fields and wants immediate job ID

---

**2. Celery Task-Based Onboarding (Recommended)**

**Endpoint:** `POST /api/celery/tasks/onboard-device`

**File:** [backend/routers/jobs/celery_api.py](backend/routers/jobs/celery_api.py)

**Purpose:** Queue device onboarding as Celery task with full workflow (tags, custom fields, network sync)

**Request Model:**
```python
class OnboardDeviceRequest(DeviceOnboardRequest):
    onboarding_timeout: int = 120  # Max wait time for Nautobot job
    sync_options: Optional[List[str]] = None  # ["cables", "software", "vlans", "vrfs"]
```

**Workflow:**
1. Queue Celery task `onboard_device_task`
2. Return task ID for progress tracking
3. Task handles full workflow asynchronously

**Response:**
```python
{
    "task_id": "abc-123-def-456",
    "status": "queued",
    "message": "Device onboarding task queued for 192.168.1.1: abc-123-def-456"
}
```

**Progress Tracking:** `GET /api/celery/tasks/{task_id}`

---

#### Celery Task: onboard_device_task

**File:** [backend/tasks/onboard_device_task.py](backend/tasks/onboard_device_task.py)

**Task Name:** `tasks.onboard_device_task`

**Parameters:**
```python
@shared_task(bind=True, name="tasks.onboard_device_task")
def onboard_device_task(
    self,
    ip_address: str,
    location_id: str,
    role_id: str,
    namespace_id: str,
    status_id: str,
    interface_status_id: str,
    ip_address_status_id: str,
    prefix_status_id: str,
    secret_groups_id: str,
    platform_id: str,
    port: int,
    timeout: int,
    onboarding_timeout: int = 120,
    sync_options: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    custom_fields: Optional[Dict[str, str]] = None,
) -> dict:
```

**Workflow Steps:**

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: Initialize and Parse IPs (Progress: 5%)                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
Parse comma-separated IPs: "192.168.1.1, 192.168.1.2"
  → ip_list = ["192.168.1.1", "192.168.1.2"]
  → device_count = 2
  → is_multi_device = True

┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: Trigger Nautobot Onboarding Job (Progress: 10%)          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
_trigger_nautobot_onboarding(ip_address="192.168.1.1, 192.168.1.2", ...)
  ↓
POST /api/extras/jobs/Sync%20Devices%20From%20Network/run/
  Data: {
    "data": {
      "location": location_id,
      "ip_addresses": "192.168.1.1, 192.168.1.2",  # All IPs at once
      "secrets_group": secret_groups_id,
      "device_role": role_id,
      "namespace": namespace_id,
      "device_status": status_id,
      "interface_status": interface_status_id,
      "ip_address_status": ip_address_status_id,
      "platform": None if platform_id == "detect" else platform_id,
      "port": port,
      "timeout": timeout,
      "update_devices_without_primary_ip": False
    }
  }
  ↓
Returns: job_id, job_url
  ↓
Update progress: "Waiting for onboarding job to complete (2 devices)"

┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: Wait for Job Completion (Progress: 30-59%)               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
_wait_for_job_completion(task_instance=self, job_id, max_wait=onboarding_timeout)
  ↓
Poll: GET /api/extras/job-results/{job_id}/
  Every 2 seconds, check status:
  - "pending" / "running" → Keep polling
  - "completed" / "success" → Success, proceed
  - "failed" / "errored" → Failure, abort
  ↓
Update progress every poll:
  "Waiting for onboarding job (check #3, 6s elapsed, status: running)"
  Progress: 30% + (elapsed / max_wait * 30)  → Range 30-59%
  ↓
If timeout (> onboarding_timeout):
  Return error: "Job timeout - exceeded 120 seconds"

┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: Process Each Device (Progress: 50-95%)                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
For each IP in ip_list:
  ↓
  _process_single_device(
    task_instance=self,
    ip_address="192.168.1.1",
    namespace_id, prefix_status_id, interface_status_id,
    ip_address_status_id, sync_options, tags, custom_fields,
    device_num=1, device_count=2
  )
  ↓
  Progress: 50 + (index / device_count * 45) = 50-95%
  Status: "Processing device 1/2: 192.168.1.1"

  ┌────────────────────────────────────────────────────────┐
  │ STEP 4a: Get Device UUID from IP (Device Lookup)       │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  _get_device_id_from_ip("192.168.1.1")
    ↓
  GraphQL Query:
    query IPaddresses {
      ip_addresses(address: ["192.168.1.1"]) {
        id
        address
        primary_ip4_for {
          id
          name
        }
      }
    }
    ↓
  Extract device_id and device_name
    ↓
  If not found: Return error "IP 192.168.1.1 is not a primary IP"

  ┌────────────────────────────────────────────────────────┐
  │ STEP 4b: Update Device Tags (if provided)              │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  if tags:
    _update_device_tags(device_id, tag_ids)
      ↓
    PATCH /api/dcim/devices/{device_id}/
      Data: {"tags": ["tag-uuid-1", "tag-uuid-2"]}
      ↓
    Return: {success: True, type: "tags", count: 2}

  ┌────────────────────────────────────────────────────────┐
  │ STEP 4c: Update Custom Fields (if provided)            │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  if custom_fields:
    _update_device_custom_fields(device_id, custom_fields)
      ↓
    PATCH /api/dcim/devices/{device_id}/
      Data: {"custom_fields": {"environment": "production", "owner": "network-team"}}
      ↓
    Return: {success: True, type: "custom_fields", count: 2}

  ┌────────────────────────────────────────────────────────┐
  │ STEP 4d: Sync Network Data (if sync_options provided)  │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  _sync_network_data(
    device_id, namespace_id, prefix_status_id,
    interface_status_id, ip_address_status_id, sync_options
  )
    ↓
  Prepare job data:
    {
      "data": {
        "devices": [device_id],
        "namespace": namespace_id,
        "default_prefix_status": prefix_status_id,
        "interface_status": interface_status_id,
        "ip_address_status": ip_address_status_id,
        "sync_cables": "cables" in sync_options,
        "sync_software_version": "software" in sync_options,
        "sync_vlans": "vlans" in sync_options,
        "sync_vrfs": "vrfs" in sync_options
      }
    }
    ↓
  POST /api/extras/jobs/Sync%20Network%20Data%20From%20Device/run/
    ↓
  Returns: job_id, job_url
    ↓
  Return: {success: True, job_url: "https://nautobot/..."}

  ↓
  Aggregate device result:
    {
      "success": True,
      "ip_address": "192.168.1.1",
      "device_id": "device-uuid-123",
      "device_name": "router-01",
      "update_results": [tags_result, custom_fields_result],
      "sync_result": sync_result,
      "stage": "completed"
    }

┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: Build Final Result (Progress: 100%)                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
Aggregate all device results:
  successful_devices = 2
  failed_devices = 0
  ↓
Build message:
  - All success: "All 2 devices successfully onboarded, configured, and synced"
  - Partial success: "1/2 devices onboarded successfully, 1 failed"
  - All failed: "All 2 devices failed to complete post-onboarding steps"
  ↓
Return:
  {
    "success": True,
    "partial_success": False,
    "message": "All 2 devices successfully onboarded...",
    "device_count": 2,
    "successful_devices": 2,
    "failed_devices": 0,
    "devices": [device_result_1, device_result_2],
    "stage": "completed"
  }
```

**Progress Stages:**

| Stage | Progress % | Description |
|-------|-----------|-------------|
| `onboarding` | 5% | Initiating device onboarding |
| `waiting` | 10-59% | Waiting for Nautobot onboarding job |
| `processing_devices` | 50-95% | Processing individual devices (tags, custom fields, sync) |
| `completed` | 100% | All devices successfully onboarded |
| `partial_success` | 100% | Some devices completed, others failed |
| `all_failed` | 100% | All devices failed post-onboarding steps |
| `onboarding_failed` | - | Nautobot onboarding job failed |
| `exception` | - | Unexpected error occurred |

**Progress Tracking Structure:**

```python
task.update_state(
    state="PROGRESS",
    meta={
        "stage": "processing_devices",
        "status": "Processing device 1/2: 192.168.1.1",
        "progress": 50,
        "job_id": "nautobot-job-id",
        "job_url": "https://nautobot/extras/job-results/job-id/",
        "device_count": 2,
        "current_device": 1,
        "current_ip": "192.168.1.1",
        "ip_addresses": ["192.168.1.1", "192.168.1.2"]
    }
)
```

---

### Frontend Progress Tracking

**Component:** [frontend/src/components/features/nautobot/onboard/components/onboarding-progress-modal.tsx](frontend/src/components/features/nautobot/onboard/components/onboarding-progress-modal.tsx)

**Workflow:**
1. Modal opens when task is submitted
2. Poll task status every 2 seconds: `GET /api/celery/tasks/{task_id}`
3. Display progress bar based on `progress` percentage
4. Show current stage description
5. For multi-device: show current device being processed
6. Stop polling when status is `SUCCESS`, `FAILURE`, or `REVOKED`
7. Display final results with per-device breakdown

**Task Status Response:**
```typescript
interface TaskStatus {
  task_id: string
  status: 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED'
  result?: {
    success: boolean
    partial_success?: boolean
    message: string
    device_count?: number
    successful_devices?: number
    failed_devices?: number
    devices?: DeviceResult[]
  }
  error?: string
  progress?: {
    stage?: string
    status?: string
    progress?: number
    device_count?: number
    current_device?: number
    current_ip?: string
  }
}
```

---

## 2. CSV Bulk Upload

### What is CSV Bulk Upload?

CSV Bulk Upload allows onboarding multiple devices from a CSV file with:
- **Configurable parallelism** - split devices into concurrent Celery tasks
- **Name-to-ID conversion** - resolve location/role/platform names to UUIDs
- **Default values** - apply form defaults when CSV cells are empty
- **Tag support** - specify tags by name in CSV
- **Custom fields** - columns prefixed with `cf_` are treated as custom fields

### CSV Format

**Required Column:** `ip_address`

**Optional Columns:**
- `location` (name or hierarchical path)
- `namespace` (name)
- `device_role` (name)
- `device_status` (name)
- `platform` (name or "detect")
- `secret_group` (name)
- `interface_status` (name)
- `ip_address_status` (name)
- `ip_prefix_status` (name)
- `port` (integer, default 22)
- `timeout` (integer, default 30)
- `tags` (comma-separated tag names)
- `cf_*` (custom field columns, e.g., `cf_environment`, `cf_owner`)

**Example CSV:**
```csv
ip_address,location,device_role,platform,tags,cf_environment,cf_owner
192.168.1.1,DC1/Floor1/Rack1,Router,Cisco IOS,"production,core",production,network-team
192.168.1.2,DC1/Floor1/Rack2,Switch,Cisco IOS,access,production,network-team
192.168.1.3,DC2/Floor1/Rack1,Firewall,detect,"security,dmz",production,security-team
```

### Frontend Implementation

**Hook:** [frontend/src/components/features/nautobot/onboard/hooks/use-csv-upload.ts](frontend/src/components/features/nautobot/onboard/hooks/use-csv-upload.ts)

**Key Functions:**

1. **parseCSV** - Parse CSV file with configurable delimiter and quote character
   ```typescript
   parseCSV(file: File, delimiter: string, quoteChar: string)
   ```

2. **validateCSVHeaders** - Validate required columns
   ```typescript
   validateCSVHeaders(headers: string[], required: string[])
   ```

3. **performBulkOnboarding** - Convert CSV data and submit
   ```typescript
   async performBulkOnboarding(
     data: ParsedCSVRow[],
     lookupData: CSVLookupData
   ): Promise<string | null>
   ```

**Name-to-ID Conversion:**
```typescript
// Convert location name "DC1/Floor1/Rack1" → UUID
const locationId = resolveLocationNameToId(row.location, lookupData.locations)

// Convert role name "Router" → UUID
const roleId = resolveNameToId(row.device_role, lookupData.deviceRoles)

// Convert tag names "production,core" → ["tag-uuid-1", "tag-uuid-2"]
const tagIds = row.tags?.split(',').map(name =>
  lookupData.availableTags.find(t => t.name === name.trim())?.id
).filter(Boolean)
```

**CSV Lookup Data Structure:**
```typescript
interface CSVLookupData {
  locations: LocationItem[]
  namespaces: DropdownOption[]
  deviceRoles: DropdownOption[]
  platforms: DropdownOption[]
  deviceStatuses: DropdownOption[]
  interfaceStatuses: DropdownOption[]
  ipAddressStatuses: DropdownOption[]
  prefixStatuses: DropdownOption[]
  secretGroups: DropdownOption[]
  availableTags: Array<{ id: string; name: string }>
  defaults: {
    location?: string
    namespace?: string
    device_role?: string
    device_status?: string
    platform?: string
    secret_group?: string
    interface_status?: string
    ip_address_status?: string
    ip_prefix_status?: string
    csv_delimiter?: string
  }
}
```

### Backend Implementation

**Endpoint:** `POST /api/celery/tasks/bulk-onboard-devices`

**File:** [backend/routers/jobs/celery_api.py](backend/routers/jobs/celery_api.py)

**Request Model:**
```python
class BulkOnboardDevicesRequest(BaseModel):
    devices: List[DeviceConfig]  # List of device configurations from CSV
    default_config: Dict  # Default values for missing fields
    parallel_jobs: int = 1  # Number of parallel Celery tasks
```

**Parallelism Modes:**

**Mode 1: Single Job (parallel_jobs = 1)**
- Creates one Celery task
- Processes all devices sequentially
- Single job run record in Jobs/View

**Mode 2: Parallel Jobs (parallel_jobs > 1)**
- Splits devices into batches
- Creates multiple Celery tasks
- Concurrent processing
- Multiple job run records

**Example:**
```python
# 100 devices, parallel_jobs = 4
# → 4 Celery tasks, each processing 25 devices
# → Tasks run concurrently on available workers
```

#### Celery Task: bulk_onboard_devices_task

**File:** [backend/tasks/bulk_onboard_task.py](backend/tasks/bulk_onboard_task.py)

**Task Name:** `tasks.bulk_onboard_devices_task`

**Workflow:**
1. **Validate** - Check device count > 0
2. **Process each device:**
   - Merge device config with default_config
   - Trigger `_trigger_nautobot_onboarding` for this device only
   - Wait for completion with `_wait_for_job_completion`
   - Process device with `_process_single_device` (tags, custom fields, sync)
   - Track per-device result
3. **Update progress** - Show current device being processed
4. **Return aggregated results** - Success/failure counts, per-device details

**Progress Updates:**
```python
# Progress: (current_device / total_devices) * 100
self.update_state(
    state="PROGRESS",
    meta={
        "stage": "processing_devices",
        "status": f"Processing device {device_num}/{device_count}: {ip_address}",
        "progress": int((device_num / device_count) * 100),
        "device_count": device_count,
        "processed": device_num,
        "successful": successful_count,
        "failed": failed_count,
        "devices": device_results
    }
)
```

**Result Structure:**
```python
{
    "success": True,  # Overall success
    "partial_success": False,  # Some succeeded, some failed
    "message": "Successfully onboarded 98/100 devices (2 failed)",
    "device_count": 100,
    "successful_devices": 98,
    "failed_devices": 2,
    "devices": [
        {
            "success": True,
            "ip_address": "192.168.1.1",
            "device_id": "uuid-1",
            "device_name": "router-01",
            "update_results": [...],
            "sync_result": {...},
            "stage": "completed"
        },
        {
            "success": False,
            "ip_address": "192.168.1.2",
            "error": "IP 192.168.1.2 is not a primary IP for any device",
            "stage": "device_lookup_failed"
        },
        // ... 98 more device results
    ],
    "stage": "partial_success"
}
```

---

## 3. Network Scanning

### What is Network Scanning?

Network Scanning discovers reachable hosts on specified networks before onboarding. It:
- Uses `fping` for fast ICMP ping scanning
- Supports CIDR notation (e.g., `192.168.1.0/24`)
- Returns list of alive hosts
- Allows selecting IPs to onboard

### Frontend Implementation

**Component:** [frontend/src/components/features/nautobot/onboard/components/network-scan-modal.tsx](frontend/src/components/features/nautobot/onboard/components/network-scan-modal.tsx)

**Key Features:**
- **Multiple CIDR inputs** - scan multiple networks at once
- **CIDR validation** - ensures valid format and /22-/32 range
- **Real-time progress** - shows scan progress with counts
- **Result selection** - checkboxes to select IPs for onboarding
- **Add to form** - populates main form's IP address field

**Workflow:**
1. User enters CIDR(s): `192.168.1.0/24, 10.0.0.0/24`
2. Click "Start Scan"
3. POST to `/api/nautobot/scan` with networks list
4. Poll `/api/scan/{job_id}/status` every 2 seconds
5. Display progress: `Scanned: 50/512, Alive: 12`
6. Show results table with reachable IPs
7. User selects IPs and clicks "Add to Onboarding"
8. Selected IPs populate main form's IP address field

### Backend Implementation

**Router:** [backend/routers/nautobot/tools/scan_and_add.py](backend/routers/nautobot/tools/scan_and_add.py)

**Endpoints:**

**1. Start Scan**

`POST /api/nautobot/scan`

**Request:**
```python
class ScanRequest(BaseModel):
    networks: List[str] = Field(
        ..., max_items=10, description="List of CIDR networks to scan"
    )
```

**Response:**
```python
{
    "job_id": "scan-job-uuid-123",
    "status": "started",
    "message": "Network scan started for 2 networks"
}
```

**2. Get Scan Status**

`GET /api/nautobot/scan/{job_id}/status`

**Response:**
```python
{
    "job_id": "scan-job-uuid-123",
    "state": "PROGRESS",
    "progress": {
        "total": 512,
        "scanned": 256,
        "alive": 48,
        "authenticated": 0,
        "unreachable": 208,
        "auth_failed": 0,
        "driver_not_supported": 0
    },
    "results": [
        {
            "ip": "192.168.1.1",
            "credential_id": null,
            "device_type": "unknown",
            "hostname": null,
            "platform": null
        },
        // ... more results
    ]
}
```

**Scan Service:** [backend/services/network/scanning/scan.py](backend/services/network/scanning/scan.py)

**Implementation:**
1. Parse CIDR networks to IP ranges
2. Execute `fping -a -g 192.168.1.0 192.168.1.255`
3. Collect alive hosts from stdout
4. Update progress with counts
5. Return results with IP addresses

**Note:** Current implementation only checks reachability (ping). It does **not** attempt SSH authentication or device detection (those fields remain null).

---

## 4. Configuration and Settings

### Nautobot Defaults

**Endpoint:** `GET /api/settings/nautobot/defaults`

**Purpose:** Retrieve default values for onboarding form fields from Nautobot settings

**Response Structure:**
```python
{
    "success": True,
    "data": {
        "location": "location-uuid-123",  # Default location
        "namespace": "namespace-uuid-456",  # Default namespace
        "device_role": "role-uuid-789",  # Default device role
        "device_status": "status-uuid-abc",  # Default device status
        "platform": "detect",  # Default platform (or platform UUID)
        "secret_group": "secret-group-uuid-def",  # Default SSH credentials
        "interface_status": "interface-status-uuid-ghi",
        "ip_address_status": "ip-status-uuid-jkl",
        "ip_prefix_status": "prefix-status-uuid-mno",
        "csv_delimiter": ",",  # CSV parsing delimiter
        "csv_quote_char": "\""  # CSV quote character
    }
}
```

**Usage:**
- Frontend loads these on page mount
- Populates form fields with defaults
- CSV upload uses these as fallbacks for empty cells
- User can override any default

### Metadata Endpoints

All metadata is loaded from Nautobot to populate dropdowns:

- `GET /api/nautobot/locations` - Locations with hierarchy
- `GET /api/nautobot/namespaces` - IP namespaces
- `GET /api/nautobot/roles/devices` - Device roles
- `GET /api/nautobot/platforms` - Device platforms
- `GET /api/nautobot/statuses/device` - Device statuses
- `GET /api/nautobot/statuses/interface` - Interface statuses
- `GET /api/nautobot/statuses/ipaddress` - IP address statuses
- `GET /api/nautobot/statuses/prefix` - Prefix statuses
- `GET /api/nautobot/secret-groups` - SSH credential groups
- `GET /api/nautobot/tags/devices` - Nautobot tags for devices
- `GET /api/nautobot/custom-fields?content_type=dcim.device` - Custom fields for devices

---

## 5. Error Handling and Validation

### Frontend Validation

**IP Address Validation:**
```typescript
// Basic format check
const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/

// Check if exists in Nautobot
POST /api/nautobot/check-ip
{
  "ip_address": "192.168.1.1"
}
→ Returns device info if exists, null if not
```

**Form Validation:**
- All required fields must be filled
- IP address must be valid format
- Location must be selected from hierarchy
- Port must be 1-65535
- Timeout must be > 0

**CSV Validation:**
- Required column `ip_address` must exist
- CIDR format validation for network scanning
- Tag names must match existing tags
- Location names must resolve to existing locations

### Backend Error Handling

**Common Error Scenarios:**

**1. Nautobot Job Timeout**
```python
# After onboarding_timeout seconds (default 120)
return {
    "success": False,
    "error": "Job timeout - exceeded 120 seconds after 60 status checks",
    "stage": "onboarding_failed"
}
```

**2. Device Lookup Failure**
```python
# IP is not a primary IP for any device
return {
    "success": False,
    "error": "IP 192.168.1.1 is not a primary IP for any device",
    "stage": "device_lookup_failed"
}
```

**3. Tags Update Failure**
```python
return {
    "success": True,  # Onboarding succeeded
    "update_results": [
        {"success": False, "type": "tags", "error": "Device not found"}
    ],
    "stage": "update_partial_success"
}
```

**4. Platform Auto-Detection**
- If `platform_id = "detect"`, Nautobot auto-detects device platform via SSH
- Requires proper SSH credentials and reachable device
- Falls back to generic platform if detection fails

---

## 6. Integration with Jobs Management

### Job Run Tracking

Bulk CSV uploads create job run records in the Jobs/View interface:

**Job Creation:**
```python
job_run = job_run_manager.create_job_run(
    job_name=f"Bulk Onboard {device_count} Devices (CSV)",
    job_type="bulk_onboard",
    triggered_by="manual",
    target_devices=ip_addresses,  # List of IPs
    executed_by=username
)
```

**Job Status Updates:**
```python
# When task starts
job_run_manager.mark_started(job_run_id, celery_task_id)

# When task completes
job_run_manager.mark_completed(job_run_id, result)

# When task fails
job_run_manager.mark_failed(job_run_id, error_message)
```

**Viewing Results:**
- Navigate to Jobs/View page
- Filter by job type: `bulk_onboard`
- See device counts, success rate, duration
- View per-device results in job details

---

## 7. Performance Considerations

### Single Device Onboarding

**Typical Timeline:**
- Trigger job: 1-2 seconds
- SSH connection & detection: 5-30 seconds (depends on network latency, auto-detection)
- Nautobot processing: 5-15 seconds
- Tags/custom fields update: 1-2 seconds
- Network data sync: 10-60 seconds (depends on sync options)
- **Total:** ~20-110 seconds per device

### Bulk CSV Upload

**Sequential (parallel_jobs = 1):**
- 100 devices × 60 seconds = 100 minutes
- **Pros:** Single job record, easier tracking
- **Cons:** Slow for large batches

**Parallel (parallel_jobs = 4):**
- 100 devices ÷ 4 workers × 60 seconds = 25 minutes
- **Pros:** 4x faster, utilizes multiple workers
- **Cons:** Multiple job records, harder to aggregate

**Recommendations:**
- Use parallel mode for > 20 devices
- Set `parallel_jobs` based on available Celery workers
- Monitor Redis queue depth
- Consider Nautobot API rate limits

### Onboarding Timeout

**Default:** 120 seconds (configurable)

**Recommendations:**
- **Auto-detection:** 120 seconds (slow SSH handshake)
- **Known platform:** 60 seconds
- **Fast network:** 30 seconds
- **Slow network:** 180 seconds

---

## 8. Troubleshooting

### Common Issues

**Issue 1: Nautobot Job Times Out**

**Symptoms:** "Job timeout - exceeded 120 seconds"

**Causes:**
- Slow SSH connection
- Platform auto-detection taking too long
- Network latency
- Device not responding

**Solutions:**
- Increase `onboarding_timeout` to 180 or 240 seconds
- Specify platform explicitly (don't use "detect")
- Check device SSH access
- Verify secret group credentials

---

**Issue 2: Device Lookup Fails**

**Symptoms:** "IP is not a primary IP for any device"

**Causes:**
- Nautobot job completed but didn't create device
- Device created but IP not set as primary
- IP address format mismatch

**Solutions:**
- Check Nautobot job logs for errors
- Verify device was created in Nautobot UI
- Ensure IP is set as primary IPv4 on device
- Wait a few seconds and retry (Nautobot may be processing)

---

**Issue 3: Tags/Custom Fields Not Applied**

**Symptoms:** Task succeeds but tags missing in Nautobot

**Causes:**
- Tag IDs invalid (deleted tags)
- Custom field keys misspelled
- Permissions issue updating device

**Solutions:**
- Verify tag IDs exist in Nautobot
- Check custom field key names (case-sensitive)
- Check Nautobot API token permissions

---

**Issue 4: CSV Parse Errors**

**Symptoms:** "Invalid CSV headers"

**Causes:**
- Missing `ip_address` column
- Wrong delimiter used
- BOM characters in file

**Solutions:**
- Ensure first column is `ip_address`
- Try different delimiter (comma, semicolon, tab)
- Save CSV as UTF-8 without BOM
- Use built-in CSV settings from defaults

---

**Issue 5: Network Scan Finds No Hosts**

**Symptoms:** Scan completes but 0 alive hosts

**Causes:**
- ICMP blocked by firewall
- Wrong network range
- Devices not responding to ping

**Solutions:**
- Check firewall rules allow ICMP
- Verify CIDR range is correct
- Try scanning smaller subnet
- Manually ping devices to verify reachability

---

## 9. Best Practices

### For Single Device Onboarding

1. **Use IP validation** - Check if device exists before onboarding
2. **Specify platform** - Faster than auto-detection
3. **Enable sync options** - Get complete device data upfront
4. **Apply tags** - Categorize devices during onboarding
5. **Set custom fields** - Add metadata for tracking

### For CSV Bulk Upload

1. **Start small** - Test with 5-10 devices first
2. **Use templates** - Create CSV template with all columns
3. **Validate data** - Check names match Nautobot (locations, roles, platforms)
4. **Use parallel mode** - Set `parallel_jobs` for faster processing (e.g., 4-8)
5. **Monitor progress** - Watch Celery worker logs for errors
6. **Handle failures** - Review failed devices and retry individually

### For Network Scanning

1. **Limit scope** - Use /24 or smaller subnets
2. **Scan before onboarding** - Verify devices are reachable
3. **Multiple scans** - Don't try to scan entire /16 at once
4. **Check firewall** - Ensure ICMP is allowed

### General Recommendations

1. **Use defaults** - Configure Nautobot defaults for consistent onboarding
2. **Test credentials** - Verify secret groups work before bulk operations
3. **Monitor Celery** - Ensure workers are running and healthy
4. **Check Nautobot logs** - Review job logs for SSH/API errors
5. **Incremental approach** - Onboard devices in batches, not all at once

---

## 10. Summary

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Onboard Device Page** | Main UI for device onboarding | `frontend/src/components/features/nautobot/onboard/onboard-device-page.tsx` |
| **Progress Modal** | Real-time task progress tracking | `frontend/src/components/features/nautobot/onboard/components/onboarding-progress-modal.tsx` |
| **CSV Upload Hook** | Parse and submit CSV files | `frontend/src/components/features/nautobot/onboard/hooks/use-csv-upload.ts` |
| **Onboarding Data Hook** | Load metadata and defaults | `frontend/src/components/features/nautobot/onboard/hooks/use-onboarding-data.ts` |
| **Onboard Device Endpoint** | Direct Nautobot job trigger | `backend/routers/nautobot/devices.py` |
| **Celery Task Endpoint** | Queue onboarding with full workflow | `backend/routers/jobs/celery_api.py` |
| **Single Device Task** | Process one/multiple IPs with tags/fields/sync | `backend/tasks/onboard_device_task.py` |
| **Bulk Device Task** | Process CSV devices in batch | `backend/tasks/bulk_onboard_task.py` |
| **Network Scan Router** | Discover reachable hosts | `backend/routers/nautobot/tools/scan_and_add.py` |

### Workflow Summary

```
User fills form → Submit → Queue Celery task
    ↓
Task triggers Nautobot job
    ↓
Wait for job completion (poll every 2s)
    ↓
For each device:
    Get device UUID from IP
    Apply tags (if provided)
    Apply custom fields (if provided)
    Sync network data (if enabled)
    ↓
Return aggregated results
    ↓
Frontend displays success/failure breakdown
```

### Design Principles

1. **Asynchronous Processing** - All onboarding is queued via Celery for non-blocking execution
2. **Real-time Progress** - Users see live updates during long-running operations
3. **Flexible Input** - Single device, multiple IPs, or CSV bulk upload
4. **Network Discovery** - Scan networks before onboarding
5. **Extensible Metadata** - Tags and custom fields for categorization
6. **Error Resilience** - Per-device error handling, partial success tracking
7. **Integration** - Works with Nautobot's native jobs and APIs

### Key Features

- ✅ **Single device onboarding** with real-time progress
- ✅ **Multiple device onboarding** via comma-separated IPs
- ✅ **CSV bulk upload** with parallel processing
- ✅ **Network scanning** to discover reachable hosts
- ✅ **Tags and custom fields** application during onboarding
- ✅ **Network data sync** (VLANs, VRFs, cables, software versions)
- ✅ **Platform auto-detection** or manual specification
- ✅ **Configurable defaults** from Nautobot settings
- ✅ **Progress tracking** with stage-based updates
- ✅ **Job run tracking** in Jobs/View interface
- ✅ **Name-to-ID resolution** for CSV data
- ✅ **Validation** at multiple levels (IP, form, CSV)

---

## Conclusion

The Nautobot Device Onboarding system provides a **powerful, flexible, and user-friendly** framework for automated device discovery and registration. Its architecture enables:

- **Ease of Use** - Form-based UI with validation and real-time feedback
- **Scalability** - Bulk CSV upload with parallel processing for large deployments
- **Flexibility** - Single device, multiple IPs, or CSV batch modes
- **Completeness** - Tags, custom fields, and network data sync in one workflow
- **Observability** - Real-time progress tracking and job run history
- **Resilience** - Per-device error handling and partial success reporting

The **Celery-based asynchronous architecture** ensures responsive UI while handling long-running SSH operations, while **integration with Nautobot's native jobs** leverages proven device discovery and configuration parsing capabilities.
