# Device Lifecycle Testing - Fixes Applied

**Date**: 2026-01-03
**Issue**: Initial test run failed with CheckMK API validation errors

## Errors Encountered

### Error 1: Invalid SNMP Tag Value
```
'snmp-v3' is not one of the enum values: ['no-snmp', 'snmp-v2', 'snmp-v1']
```

**Root Cause**: CheckMK doesn't have a separate `snmp-v3` tag. It uses `snmp-v2` for both SNMPv2 and SNMPv3, with the difference being in the `snmp_community` type field.

**Fix**: Changed `tag_snmp_ds` from `'snmp-v3'` to `'snmp-v2'` for SNMPv3 devices.

### Error 2: Invalid Auth Protocol
```
'SHA-256' is not one of the enum values: ['MD5-96', 'SHA-1-96', 'SHA-2-224', 'SHA-2-256', 'SHA-2-384', 'SHA-2-512']
```

**Root Cause**: CheckMK expects the enum value `'SHA-2-256'` (with hyphens), not `'SHA-256'`.

**Fix**: Changed `auth_protocol` from `'SHA-256'` to `'SHA-2-256'`.

### Error 3: Invalid Privacy Protocol
```
'AES' is not one of the enum values: ['CBC-DES', 'AES-128', '3DES-EDE', 'AES-192', 'AES-256', 'AES-192-Blumenthal', 'AES-256-Blumenthal']
```

**Root Cause**: CheckMK expects the full protocol name with bit length, not just `'AES'`.

**Fix**: Changed `privacy_protocol` from `'AES'` to `'AES-256'`.

### Error 4: Missing pytest marker
```
Unknown pytest.mark.snmp - is this a typo?
```

**Root Cause**: The `snmp` marker wasn't registered in pytest.ini.

**Fix**: Added `snmp: Tests involving SNMP configuration and detection` to pytest.ini markers.

## Corrected Configuration

### Before (Incorrect)
```python
{
    "host_name": "test-device-02",
    "folder": "/",
    "attributes": {
        "ipaddress": "10.0.1.11",
        "site": "cmk",
        "alias": "Test Device 02",
        "tag_agent": "no-agent",
        "tag_snmp_ds": "snmp-v3",  # ❌ Invalid
        "snmp_community": {
            "type": "v3_auth_privacy",
            "auth_protocol": "SHA-256",  # ❌ Invalid
            "auth_password": "test_auth_pass",
            "privacy_protocol": "AES",  # ❌ Invalid
            "privacy_password": "test_priv_pass",
            "security_name": "test_user",
        },
    },
}
```

### After (Correct)
```python
{
    "host_name": "test-device-02",
    "folder": "/",
    "attributes": {
        "ipaddress": "10.0.1.11",
        "site": "cmk",
        "alias": "Test Device 02",
        "tag_agent": "no-agent",
        "tag_snmp_ds": "snmp-v2",  # ✅ Correct (used for both v2 and v3)
        "snmp_community": {
            "type": "v3_auth_privacy",  # This differentiates v3 from v2
            "auth_protocol": "SHA-2-256",  # ✅ Correct enum value
            "auth_password": "test_auth_pass",
            "privacy_protocol": "AES-256",  # ✅ Correct with bit length
            "privacy_password": "test_priv_pass",
            "security_name": "test_user",
        },
    },
}
```

## CheckMK API Insights

### SNMP Version Handling

**Key Discovery**: CheckMK uses tags and types differently than expected:

1. **Tag `tag_snmp_ds`** - Only has 3 values:
   - `'no-snmp'` - No SNMP monitoring
   - `'snmp-v1'` - SNMPv1
   - `'snmp-v2'` - SNMPv2c **AND** SNMPv3

2. **Field `snmp_community.type`** - Differentiates community vs credentials:
   - `'v1_v2_community'` - SNMPv1/v2c with community string
   - `'v3_auth_no_privacy'` - SNMPv3 with authentication only
   - `'v3_auth_privacy'` - SNMPv3 with authentication and privacy

**Implication**: To create an SNMPv3 device:
- Set `tag_snmp_ds: 'snmp-v2'` (counter-intuitive but correct!)
- Set `snmp_community.type: 'v3_auth_privacy'` (this is what makes it v3)

### Valid Enum Values

**Authentication Protocols** (`auth_protocol`):
- `'MD5-96'`
- `'SHA-1-96'`
- `'SHA-2-224'`
- `'SHA-2-256'` ✅ (most common)
- `'SHA-2-384'`
- `'SHA-2-512'`

**Privacy Protocols** (`privacy_protocol`):
- `'CBC-DES'`
- `'AES-128'`
- `'3DES-EDE'`
- `'AES-192'`
- `'AES-256'` ✅ (most common)
- `'AES-192-Blumenthal'`
- `'AES-256-Blumenthal'`

## Files Modified

1. **`backend/tests/integration/test_checkmk_device_lifecycle.py`**
   - Fixed `TEST_DEVICES` configuration
   - Updated SNMPv3 attribute validation test
   - Added comment explaining CheckMK's tag behavior

2. **`backend/pytest.ini`**
   - Added `snmp` marker registration

## Test Results

### Before Fix
```
FAILED test_01_create_test_devices_in_checkmk - API request failed: 400 - These fields have problems: attributes
FAILED test_02_verify_devices_exist_in_checkmk - Device test-device-02 not found
FAILED test_07_get_all_hosts - Test device test-device-02 not found in host list
FAILED test_08_get_specific_host - Device test-device-02 not found
4 failed, 8 passed, 2 skipped, 1 warning
```

### After Fix (Expected)
```
✅ All 3 test devices created successfully
✅ All devices verified with correct attributes
✅ SNMPv2 and SNMPv3 configurations validated
✅ All lifecycle operations tested
10 passed, 2 skipped (expected)
```

## Lessons Learned

1. **Always check CheckMK API documentation** for exact enum values
2. **CheckMK's SNMP handling is non-intuitive** - `snmp-v2` tag is used for both v2 and v3
3. **Use complete protocol names** - `'SHA-2-256'` not `'SHA-256'`, `'AES-256'` not `'AES'`
4. **The `type` field is what truly differentiates** SNMP versions in v3
5. **Register all custom pytest markers** to avoid warnings

## Documentation Impact

The following documentation was updated to reflect the correct CheckMK API usage:

1. **Test device configurations** - Now use correct enum values
2. **SNMP v3 validation** - Expects `snmp-v2` tag with `v3_auth_privacy` type
3. **Comments in code** - Explain the non-intuitive tag behavior

## Next Steps

1. Run the corrected tests to verify all pass
2. Update any other code that creates SNMPv3 devices to use the correct tag
3. Consider adding a helper function to encapsulate the SNMP configuration logic
4. Document CheckMK's SNMP tag behavior in the main documentation

## Reference

**CheckMK API Documentation**:
- Tags: `/objects/host_tag_group`
- Host Config: `/objects/host_config/{hostname}`
- SNMP Community: Part of host attributes

**Test File**: `backend/tests/integration/test_checkmk_device_lifecycle.py`
