# Custom Fields Update Support

## Summary

Added proper handling for custom fields updates in the device update service. Custom fields in Nautobot use a simple key-value dictionary format.

## Nautobot Custom Fields Format

According to Nautobot's REST API schema, custom fields are sent as a simple dictionary:

```json
{
  "custom_fields": {
    "field_name_1": "value1",
    "field_name_2": "value2",
    "field_name_3": "value3"
  }
}
```

## Implementation

### File Modified

**Backend**: `/backend/services/device_update_service.py`

### Changes Made

#### 1. Custom Fields Validation (lines 365-370)

Added special handling in `validate_update_data()` to ensure custom_fields is a dictionary:

```python
elif field == "custom_fields":
    # Ensure custom_fields is a simple dict (Nautobot expects {"field_name": "value"})
    if isinstance(value, dict):
        validated[field] = value
    else:
        logger.warning(f"Invalid custom_fields format: {type(value)}, expected dict")
```

#### 2. Custom Fields Verification (lines 522-538)

Added proper verification logic in `_verify_updates()` to compare custom fields individually:

```python
# Handle custom_fields specially
if field == "custom_fields":
    # Compare each custom field individually
    if isinstance(expected_value, dict) and isinstance(actual_value, dict):
        for cf_name, cf_expected in expected_value.items():
            cf_actual = actual_value.get(cf_name)
            if cf_actual != cf_expected:
                mismatches.append({
                    "field": f"custom_fields.{cf_name}",
                    "expected": cf_expected,
                    "actual": cf_actual,
                })
                logger.warning(
                    f"Custom field '{cf_name}' mismatch: expected '{cf_expected}', "
                    f"got '{cf_actual}'"
                )
    continue
```

## Usage Examples

### Via CSV Upload

CSV file with custom fields:

```csv
id,name,serial,custom_field_1,custom_field_2
device-uuid-1,ROUTER-01,SN12345,value1,value2
device-uuid-2,SWITCH-01,SN67890,value3,value4
```

The CSV import task converts these to:

```json
{
  "id": "device-uuid-1",
  "name": "ROUTER-01",
  "serial": "SN12345",
  "custom_fields": {
    "custom_field_1": "value1",
    "custom_field_2": "value2"
  }
}
```

### Via JSON API

Direct JSON request to `/api/celery/tasks/update-devices`:

```json
{
  "devices": [
    {
      "id": "device-uuid-1",
      "serial": "SN12345",
      "custom_fields": {
        "site_code": "NYC-01",
        "cost_center": "IT-NETWORKING",
        "maintenance_contract": "CONTRACT-2025"
      }
    }
  ],
  "dry_run": false
}
```

### Via Bulk Edit UI

When using the bulk edit interface, custom fields are automatically converted to the correct format by the JSON converter.

## Custom Field Types

Nautobot supports various custom field types. The value format depends on the field type:

| Field Type | Value Format | Example |
|------------|-------------|---------|
| Text | String | `"NYC-DC1"` |
| Integer | Number | `42` |
| Boolean | Boolean | `true` or `false` |
| Date | String (ISO 8601) | `"2025-12-27"` |
| URL | String (URL) | `"https://example.com"` |
| Select | String (option value) | `"option1"` |
| Multi-Select | Array of strings | `["opt1", "opt2"]` |
| JSON | Object or Array | `{"key": "value"}` |

**Important**: All values are passed as-is to Nautobot. The API will validate the type and format.

## Verification

The service now properly verifies custom fields by:

1. Checking each custom field individually
2. Logging any mismatches with field name
3. Reporting verification status in task results

**Example verification log**:
```
Custom field 'site_code' mismatch: expected 'NYC-01', got 'NYC-02'
```

## Error Handling

**Invalid format**:
```python
# Wrong: custom_fields as string
"custom_fields": "field1=value1,field2=value2"  # ❌ Will be rejected

# Correct: custom_fields as dict
"custom_fields": {
  "field1": "value1",
  "field2": "value2"
}  # ✅ Accepted
```

**Warning in logs**:
```
Invalid custom_fields format: <class 'str'>, expected dict
```

## Testing

### Test Case 1: Single Custom Field
```json
{
  "id": "device-uuid",
  "custom_fields": {
    "site_code": "NYC-01"
  }
}
```

### Test Case 2: Multiple Custom Fields
```json
{
  "id": "device-uuid",
  "custom_fields": {
    "site_code": "NYC-01",
    "cost_center": "IT-NETWORKING",
    "maintenance_window": "Saturday 02:00-06:00"
  }
}
```

### Test Case 3: Mixed Update
```json
{
  "id": "device-uuid",
  "serial": "SN12345",
  "location": "location-uuid",
  "custom_fields": {
    "rack_position": "U42",
    "power_draw": "850W"
  }
}
```

## Expected Behavior

1. **Valid custom_fields dict**: Passed directly to Nautobot API
2. **Invalid custom_fields format**: Warning logged, field omitted from update
3. **Verification**: Each custom field compared individually
4. **Mismatches**: Logged as warnings with field name and expected/actual values

## Related Files

- **Service**: `/backend/services/device_update_service.py` - Validation and verification
- **Task**: `/backend/tasks/update_devices_task.py` - Celery task wrapper
- **Router**: `/backend/routers/celery_api.py` - API endpoint

## Nautobot API Reference

**Full device PATCH schema** (showing custom_fields):
```json
{
  "name": "string",
  "serial": "string",
  "status": { "id": "uuid" },
  "role": { "id": "uuid" },
  "location": { "id": "uuid" },
  "custom_fields": {
    "field_1": "value",
    "field_2": "value"
  }
}
```

## Next Steps

To test the custom fields update:

1. **Identify custom fields**: Check Nautobot UI for available custom fields on devices
2. **Prepare test CSV**: Include custom field columns
3. **Upload via Bulk Edit**: Use "Upload and Update" button
4. **Monitor logs**: Check for validation and verification messages
5. **Verify in Nautobot**: Confirm custom fields were updated

## Troubleshooting

**Issue**: Custom fields not updating

**Check**:
1. Custom field exists in Nautobot (check admin panel)
2. Custom field is enabled for devices object type
3. Value matches custom field type (text, integer, boolean, etc.)
4. Field name matches exactly (case-sensitive)
5. Backend logs for validation warnings

**Issue**: Verification fails

**Check**:
1. Nautobot API response includes custom_fields in device object
2. Custom field value format matches expected type
3. Logs for specific mismatch details
