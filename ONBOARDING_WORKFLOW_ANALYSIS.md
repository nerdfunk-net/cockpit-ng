# Onboarding Workflow Analysis: Manual vs Bulk CSV Upload

## Executive Summary

**The manual onboarding and CSV bulk upload workflows use THE SAME codebase.** Both workflows call identical backend functions to:
1. Trigger Nautobot onboarding job
2. Wait for completion
3. Apply tags and custom fields
4. Sync network data

**There is NO difference in the workflow logic between manual and bulk uploads.**

---

## Detailed Analysis

### Frontend Layer

#### Manual Onboarding Flow
**File**: `frontend/src/components/onboard-device/onboard-device-page.tsx`

```typescript
// Line 167-221: handleSubmit function
const handleSubmit = async () => {
  const requestBody = {
    ...formData,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined
  }

  // Submits to: /api/celery/tasks/onboard-device
  const response = await apiCall('celery/tasks/onboard-device', {
    method: 'POST',
    body: requestBody
  })
}
```

**Key Points**:
- Sends tags and custom_fields in request body
- Calls `celery/tasks/onboard-device` endpoint
- Triggers `onboard_device_task` Celery task

---

#### CSV Bulk Upload Flow
**File**: `frontend/src/components/onboard-device/hooks/use-csv-upload.ts`

```typescript
// Line 251-342: performBulkOnboarding function
const performBulkOnboarding = async (data: ParsedCSVRow[], lookupData: CSVLookupData) => {
  // Transform CSV rows into device configs
  const devices = data.map(row => ({
    ip_address: ipAddress,
    // ... other fields
    tags: tagIds,  // Converted tag names to IDs
    custom_fields: row.custom_fields,  // Custom fields from CSV
  }))

  // Submits to: /api/celery/tasks/bulk-onboard-devices
  const response = await callApi.apiCall('celery/tasks/bulk-onboard-devices', {
    method: 'POST',
    body: {
      devices,
      default_config: defaultConfig,
    }
  })
}
```

**Key Points**:
- Sends tags and custom_fields per device in the `devices` array
- Calls `celery/tasks/bulk-onboard-devices` endpoint
- Triggers `bulk_onboard_devices_task` Celery task

---

### Backend API Layer

#### Manual Onboarding Endpoint
**File**: `backend/routers/celery_api.py`

```python
# Line 162-224
@router.post("/tasks/onboard-device", response_model=TaskResponse)
async def trigger_onboard_device(request: OnboardDeviceRequest):
    """
    Triggers onboard_device_task with:
    - ip_address, location_id, role_id, etc.
    - tags (List[str])
    - custom_fields (Dict[str, str])
    """
    task = onboard_device_task.delay(
        ip_address=request.ip_address,
        # ... other params
        tags=request.tags,
        custom_fields=request.custom_fields,
    )
```

**Request Model** (Line 34-51):
```python
class OnboardDeviceRequest(BaseModel):
    ip_address: str
    location_id: str
    # ... other fields
    tags: Optional[List[str]] = None          # ✅ Tags included
    custom_fields: Optional[Dict[str, str]] = None  # ✅ Custom fields included
```

---

#### Bulk Upload Endpoint
**File**: `backend/routers/celery_api.py`

```python
# Line 227-299
@router.post("/tasks/bulk-onboard-devices", response_model=TaskResponse)
async def trigger_bulk_onboard_devices(request: BulkOnboardDevicesRequest):
    """
    Triggers bulk_onboard_devices_task with:
    - devices: List of device configs
    - default_config: Default values
    """
    task = bulk_onboard_devices_task.delay(
        devices=devices_data,
        default_config=request.default_config,
    )
```

**Request Models** (Line 53-76):
```python
class BulkOnboardDeviceConfig(BaseModel):
    ip_address: str
    location_id: Optional[str] = None
    # ... other fields
    tags: Optional[List[str]] = None          # ✅ Tags included
    custom_fields: Optional[Dict[str, str]] = None  # ✅ Custom fields included

class BulkOnboardDevicesRequest(BaseModel):
    devices: List[BulkOnboardDeviceConfig]
    default_config: Dict
```

---

### Celery Task Layer

#### Manual Onboarding Task
**File**: `backend/tasks/onboard_device_task.py`

```python
# Line 14-228
@shared_task(bind=True, name="tasks.onboard_device_task")
def onboard_device_task(
    self,
    ip_address: str,
    # ... other params
    tags: Optional[List[str]] = None,           # ✅ Tags parameter
    custom_fields: Optional[Dict[str, str]] = None,  # ✅ Custom fields parameter
) -> dict:
    # Process each IP address
    for single_ip in ip_list:
        device_result = _process_single_device(
            task_instance=self,
            ip_address=single_ip,
            # ... other params
            tags=tags,                            # ✅ Passes tags
            custom_fields=custom_fields,          # ✅ Passes custom fields
            # ...
        )
```

---

#### Bulk Onboarding Task
**File**: `backend/tasks/bulk_onboard_task.py`

```python
# Line 15-344
@shared_task(bind=True, name="tasks.bulk_onboard_devices_task")
def bulk_onboard_devices_task(
    self,
    devices: List[Dict],
    default_config: Dict,
) -> dict:
    for device in devices:
        # Extract tags and custom fields from device config
        merged_config = {
            # ... other fields
            "tags": device.get("tags"),           # ✅ Extracts tags
            "custom_fields": device.get("custom_fields"),  # ✅ Extracts custom fields
        }

        # Call SAME function as manual workflow
        device_result = _process_single_device(
            task_instance=self,
            ip_address=merged_config["ip_address"],
            # ... other params
            tags=merged_config.get("tags"),       # ✅ Passes tags
            custom_fields=merged_config.get("custom_fields"),  # ✅ Passes custom fields
            # ...
        )
```

---

### Core Processing Function (SHARED)

**File**: `backend/tasks/onboard_device_task.py`

```python
# Line 230-337
def _process_single_device(
    task_instance,
    ip_address: str,
    # ... other params
    tags: Optional[List[str]],
    custom_fields: Optional[Dict[str, str]],
    # ...
) -> dict:
    """
    Process a single device after onboarding: lookup, update tags/custom fields, sync.

    THIS FUNCTION IS CALLED BY BOTH MANUAL AND BULK WORKFLOWS.
    """
    # Step 1: Get device UUID from IP address
    device_id, device_name = _get_device_id_from_ip(ip_address)

    # Step 2: Update tags (if provided)
    if tags and len(tags) > 0:
        logger.info(f"Updating device {device_name} with {len(tags)} tags")
        tag_result = _update_device_tags(device_id, tags)      # ✅ Updates tags
        update_results.append(tag_result)

    # Step 3: Update custom fields (if provided)
    if custom_fields and len(custom_fields) > 0:
        logger.info(f"Updating device {device_name} with {len(custom_fields)} custom fields")
        cf_result = _update_device_custom_fields(device_id, custom_fields)  # ✅ Updates custom fields
        update_results.append(cf_result)

    # Step 4: Sync network data
    sync_result = _sync_network_data(
        device_id=device_id,
        # ... other params
    )

    return {
        "success": True,
        "update_results": update_results,  # Contains tag and custom field results
        "sync_result": sync_result,
    }
```

---

### Tag Update Function (SHARED)

**File**: `backend/tasks/onboard_device_task.py`

```python
# Line 580-621
def _update_device_tags(device_id: str, tag_ids: List[str]) -> dict:
    """Update device tags in Nautobot via REST API."""
    # PATCH /api/dcim/devices/{device_id}/
    data = {"tags": tag_ids}
    response = requests.patch(url, json=data, headers=headers, timeout=30)

    return {
        "success": True,
        "type": "tags",
        "count": len(tag_ids),
        "message": f"Applied {len(tag_ids)} tags",
    }
```

---

### Custom Fields Update Function (SHARED)

**File**: `backend/tasks/onboard_device_task.py`

```python
# Line 624-665
def _update_device_custom_fields(device_id: str, custom_fields: Dict[str, str]) -> dict:
    """Update device custom fields in Nautobot via REST API."""
    # PATCH /api/dcim/devices/{device_id}/
    data = {"custom_fields": custom_fields}
    response = requests.patch(url, json=data, headers=headers, timeout=30)

    return {
        "success": True,
        "type": "custom_fields",
        "count": len(custom_fields),
        "message": f"Applied {len(custom_fields)} custom fields",
    }
```

---

## Workflow Comparison Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MANUAL ONBOARDING                           │
└─────────────────────────────────────────────────────────────────────┘

Frontend (onboard-device-page.tsx)
    │
    ├─ Collects: formData, selectedTags, customFieldValues
    │
    └─> POST /api/celery/tasks/onboard-device
            │
            ├─ Body: { ip_address, location_id, ..., tags, custom_fields }
            │
Backend (celery_api.py:trigger_onboard_device)
    │
    └─> onboard_device_task.delay(tags=..., custom_fields=...)
            │
Celery Task (onboard_device_task.py)
    │
    └─> FOR EACH IP:
            │
            ├─ _trigger_nautobot_onboarding()  # Start onboarding job
            ├─ _wait_for_job_completion()       # Wait for job
            └─> _process_single_device(tags, custom_fields)  ✅
                    │
                    ├─ _get_device_id_from_ip()
                    ├─ _update_device_tags()          ✅ APPLIES TAGS
                    ├─ _update_device_custom_fields() ✅ APPLIES CUSTOM FIELDS
                    └─ _sync_network_data()

┌─────────────────────────────────────────────────────────────────────┐
│                      CSV BULK ONBOARDING                            │
└─────────────────────────────────────────────────────────────────────┘

Frontend (use-csv-upload.ts)
    │
    ├─ Parses CSV: devices[] with tags & custom_fields per device
    │
    └─> POST /api/celery/tasks/bulk-onboard-devices
            │
            ├─ Body: { devices: [{tags, custom_fields}, ...], default_config }
            │
Backend (celery_api.py:trigger_bulk_onboard_devices)
    │
    └─> bulk_onboard_devices_task.delay(devices, default_config)
            │
Celery Task (bulk_onboard_task.py)
    │
    └─> FOR EACH DEVICE:
            │
            ├─ merged_config = { tags: device.get("tags"), custom_fields: device.get("custom_fields") }
            ├─ _trigger_nautobot_onboarding()  # Start onboarding job
            ├─ _wait_for_job_completion()       # Wait for job
            └─> _process_single_device(tags, custom_fields)  ✅ SAME FUNCTION!
                    │
                    ├─ _get_device_id_from_ip()
                    ├─ _update_device_tags()          ✅ APPLIES TAGS
                    ├─ _update_device_custom_fields() ✅ APPLIES CUSTOM FIELDS
                    └─ _sync_network_data()
```

---

## Key Findings

### ✅ Both Workflows Use Identical Code

1. **Same Processing Function**:
   - Both call `_process_single_device()` from `onboard_device_task.py`
   - Function is imported and used in `bulk_onboard_task.py` (line 56)

2. **Same Tag Update**:
   - Both use `_update_device_tags(device_id, tag_ids)`
   - REST API: `PATCH /api/dcim/devices/{device_id}/` with `{"tags": tag_ids}`

3. **Same Custom Fields Update**:
   - Both use `_update_device_custom_fields(device_id, custom_fields)`
   - REST API: `PATCH /api/dcim/devices/{device_id}/` with `{"custom_fields": custom_fields}`

4. **Same Sync Process**:
   - Both use `_sync_network_data()` with identical parameters
   - Triggers Nautobot "Sync Network Data From Network" job

### ✅ Both Workflows Receive Tags and Custom Fields

- **Manual**: `OnboardDeviceRequest` includes `tags` and `custom_fields` (celery_api.py:34-51)
- **Bulk**: `BulkOnboardDeviceConfig` includes `tags` and `custom_fields` (celery_api.py:53-70)
- **Both are passed through** to `_process_single_device()`

---

## Conclusion

**There is NO difference between the manual and CSV bulk workflows.**

Both workflows:
1. ✅ Send tags and custom fields in the request
2. ✅ Pass them to the same Celery task processing function
3. ✅ Use the same helper functions to update Nautobot
4. ✅ Make identical REST API calls to apply tags and custom fields

### If Tags/Custom Fields Are Not Being Applied in Bulk Upload

The issue is NOT in the workflow difference. Possible causes:

1. **Frontend Data Parsing**:
   - CSV parsing may not correctly extract tags/custom fields
   - Check `use-csv-upload.ts` lines 196-227 for CSV column parsing

2. **Tag/Custom Field Format**:
   - Tags must be tag IDs (not names) - conversion happens in frontend
   - Custom field keys must match Nautobot field keys exactly

3. **Nautobot API Errors**:
   - Check backend logs for REST API errors during `_update_device_tags()` or `_update_device_custom_fields()`
   - Failed updates are logged but don't stop the workflow

4. **Empty Values**:
   - If CSV row has empty tags/custom_fields, they're passed as `undefined`
   - Function checks `if tags and len(tags) > 0:` before updating

### Recommended Debugging Steps

1. **Check CSV Parsing**:
   ```typescript
   // In use-csv-upload.ts, add logging after line 227
   console.log('Parsed tags:', tags)
   console.log('Parsed custom_fields:', customFields)
   ```

2. **Check Backend Logs**:
   ```bash
   # Look for these log messages in Celery worker
   "Updating device {device_name} with {len(tags)} tags"
   "Updating device {device_name} with {len(custom_fields)} custom fields"
   "Failed to update device tags: {error}"
   "Failed to update device custom_fields: {error}"
   ```

3. **Check Nautobot API Response**:
   - Add logging in `_update_device_tags()` and `_update_device_custom_fields()`
   - Verify Nautobot accepts the PATCH request and returns success

4. **Verify Tag IDs**:
   - Ensure tag names in CSV are correctly resolved to tag IDs
   - Check `resolveNameToId()` in `helpers.ts`
