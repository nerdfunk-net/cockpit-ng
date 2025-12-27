# CSV Upload Feature - Moved to Bulk Edit App

## Summary

Successfully moved the "Bulk Update" CSV upload feature from the "Nautobot / Add Device" app to the "Nautobot / Tools / Bulk Edit" app, renamed to "Upload and Update".

## Changes Made

### 1. Copied CSV Upload Modal

**Source**: `/frontend/src/components/nautobot-add-device/components/bulk-update-modal.tsx`
**Destination**: `/frontend/src/components/bulk-edit/dialogs/csv-upload-dialog.tsx`

The BulkUpdateModal component handles:
- CSV file upload and parsing
- Validation (requires id, name, or ip_address column)
- Calls `/api/celery/tasks/update-devices-from-csv` endpoint
- Shows progress and results

### 2. Enhanced Device Selection Tab

**File**: `/frontend/src/components/bulk-edit/tabs/device-selection-tab.tsx`

**Added**:
- New "CSV Bulk Update" card below the device filter
- Informational alert explaining CSV upload option
- "Upload and Update" button
- Proper TypeScript props for `onOpenCSVUpload` callback

**UI Structure**:
```
┌─────────────────────────────────┐
│ Device Filter Panel             │
│ (existing functionality)        │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ CSV Bulk Update Card            │
│ ┌─────────────────────────────┐ │
│ │ ℹ Info Alert                │ │
│ │ "You can also upload a CSV  │ │
│ │  file with device data..."  │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │  Upload and Update Button   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 3. Updated Bulk Edit Main Page

**File**: `/frontend/src/components/bulk-edit/bulk-edit-page.tsx`

**Changes**:
1. **Import**: Added `BulkUpdateModal` from dialogs
2. **State**: Added `showCSVUploadDialog` state
3. **Devices Tab**: Passed `onOpenCSVUpload` callback to DeviceSelectionTab
4. **Dialog**: Added BulkUpdateModal at bottom with state control

## User Experience

### Before
- User goes to "Nautobot / Add Device"
- Clicks "Bulk Update" button
- Modal appears for CSV upload

### After
- User goes to "Nautobot / Tools / Bulk Edit"
- Goes to "Devices" tab
- Sees informational text about CSV upload below device filter
- Clicks "Upload and Update" button
- Same modal appears for CSV upload

## Feature Details

### CSV Upload Dialog Features

**Parsing**:
- Configurable delimiter and quote character
- Loads defaults from backend settings
- Validates CSV structure

**Requirements**:
- Must have at least one identifier column: `id`, `name`, or `ip_address`
- Header row required
- At least one data row

**Endpoint**:
- Uses `/api/celery/tasks/update-devices-from-csv`
- This is the **old CSV endpoint** (still functional!)
- Sends CSV string in request body

**Process**:
1. Upload CSV file
2. Parse and validate
3. Preview parsed data
4. Submit to backend
5. Track progress via job/task ID
6. Show results

### Informational Text

**Alert Content**:
> "You can also upload a CSV file with device data to perform bulk updates.
> The CSV must include an identifier column (id, name, or ip_address) and the fields you want to update."

This guides users to understand:
- Alternative method to filter-based bulk edit
- CSV requirements (identifier + update fields)
- Use case for CSV upload

## Files Modified

### Frontend
1. `/frontend/src/components/bulk-edit/dialogs/csv-upload-dialog.tsx` - NEW (copied from add-device)
2. `/frontend/src/components/bulk-edit/tabs/device-selection-tab.tsx` - Enhanced with CSV card
3. `/frontend/src/components/bulk-edit/bulk-edit-page.tsx` - Added dialog state and rendering

### No Backend Changes
- Reuses existing `/api/celery/tasks/update-devices-from-csv` endpoint
- No new endpoints or tasks needed

## Integration Points

### Two Update Methods Now Available

**Method 1: Filter-Based Bulk Edit** (existing)
1. Use device filter to select devices
2. Go to "Bulk Edit" tab
3. Modify properties in UI
4. Save changes → converts to JSON → `/api/celery/tasks/update-devices`

**Method 2: CSV Upload** (newly added)
1. Go to "Devices" tab
2. Click "Upload and Update"
3. Upload CSV file
4. Submit → sends CSV string → `/api/celery/tasks/update-devices-from-csv`

Both methods:
- Show progress dialog
- Track job status
- Display results
- Support dry run (CSV dialog)

## Build Status

✅ TypeScript compilation: Success
✅ Next.js build: Success
✅ ESLint: No errors
✅ Bundle size: 15.3 kB for bulk-edit page

## Testing Checklist

- [ ] Navigate to "Nautobot / Tools / Bulk Edit"
- [ ] Verify "CSV Bulk Update" card appears on Devices tab
- [ ] Click "Upload and Update" button
- [ ] Verify CSV upload modal appears
- [ ] Upload a test CSV file
- [ ] Verify CSV parsing works
- [ ] Submit update
- [ ] Verify progress tracking works
- [ ] Verify job completes successfully

## Future Considerations

### Potential Unification
The app now has **two CSV endpoints** for updates:
- `/api/celery/tasks/update-devices-from-csv` (old, used by CSV upload)
- `/api/celery/tasks/update-devices` (new, used by filter-based edit)

**Future option**: Update the CSV upload dialog to use the new JSON endpoint:
1. Parse CSV in frontend
2. Convert rows to JSON objects
3. Send to `/api/celery/tasks/update-devices`
4. Retire the CSV endpoint

Benefits:
- Single update endpoint
- Consistent data format
- Simpler backend

**Current approach** (keeping both):
- No breaking changes
- CSV endpoint still available for external tools
- Gradual migration possible

## User Documentation

### How to Use CSV Upload in Bulk Edit

1. **Prepare your CSV file**:
   - Include an identifier column: `id`, `name`, or `ip_address`
   - Include columns for fields you want to update
   - Example:
     ```csv
     id,serial,location,status
     device-uuid-1,SN123,DC1,active
     device-uuid-2,SN124,DC2,active
     ```

2. **Upload the file**:
   - Go to "Nautobot / Tools / Bulk Edit"
   - Stay on "Devices" tab
   - Scroll down to "CSV Bulk Update" card
   - Click "Upload and Update"

3. **Review and submit**:
   - Modal shows parsed CSV data
   - Review for errors
   - Click "Update Devices"

4. **Track progress**:
   - Progress dialog appears
   - Shows real-time status
   - Displays results when complete

## Comparison with Add Device App

### What Remains in Add Device App

The Add Device app still has:
- **Manual device entry form**: For adding single devices
- **CSV import for new devices**: Different from update! This creates new devices
- **Import from CSV modal**: Different component (CSVUploadModal)

### CSV Import vs CSV Update

| Feature | Import (Add Device) | Update (Bulk Edit) |
|---------|--------------------|--------------------|
| **Purpose** | Create new devices | Update existing devices |
| **Identifier** | Optional (creates new) | Required (finds existing) |
| **Modal** | CSVUploadModal | BulkUpdateModal |
| **Endpoint** | Device creation endpoint | `/update-devices-from-csv` |
| **Result** | New devices in Nautobot | Updated fields on existing |

## Conclusion

The CSV bulk update feature is now conveniently accessible from the Bulk Edit app, providing users with a streamlined workflow for both filter-based and CSV-based bulk updates in a single location.
