# Interface Type Normalization - Export Task Enhancement

## Summary

Added automatic interface type normalization to the export task to handle vendor-specific interface type formats (like `A_1000BASE_T`) and convert them to Nautobot's standard format (`1000base-t`).

## Problem

When exporting devices with interfaces, interface types from some vendors/sources come with:
- **Prefixes**: `A_1000BASE_T`, `A_100BASE_TX`
- **Uppercase**: `VIRTUAL`, `LAG`, `1000BASE-T`
- **Underscores**: `A_1000BASE_T` instead of `1000base-t`

These non-standard formats cannot be imported back into Nautobot without errors.

## Solution

Implemented `normalize_interface_type()` function that:
1. Converts interface type to lowercase
2. Replaces underscores with dashes
3. Searches for matching Nautobot standard type as substring
4. Returns the standard type or `other` if no match

## Implementation

### File Modified
`/backend/tasks/export_devices_task.py`

### Changes Made

#### 1. Added Valid Interface Types List (lines 17-47)
```python
VALID_INTERFACE_TYPES = [
    "virtual", "bridge", "lag", "tunnel", "100base-fx", "100base-lfx", "100base-tx",
    "100base-t1", "1000base-t", "2.5gbase-t", "5gbase-t", "10gbase-t", ...
    # Full list of 100+ valid Nautobot interface types
    "other"
]
```

#### 2. Added Normalization Function (lines 50-79)
```python
def normalize_interface_type(interface_type: str) -> str:
    """
    Normalize interface type to match Nautobot's valid interface types.

    Handles cases like:
    - A_1000BASE_T -> 1000base-t
    - VIRTUAL -> virtual
    - A_100BASE_TX -> 100base-tx
    """
    if not interface_type:
        return "other"

    # Convert to lowercase and replace underscores with dashes
    normalized_input = str(interface_type).lower().replace("_", "-")

    # Check if any valid interface type is a substring of the normalized input
    for valid_type in VALID_INTERFACE_TYPES:
        if valid_type in normalized_input:
            logger.debug(f"Normalized interface type: {interface_type} -> {valid_type}")
            return valid_type

    # No match found, return "other"
    logger.warning(f"Unknown interface type '{interface_type}', defaulting to 'other'")
    return "other"
```

#### 3. Updated Interface Extraction (lines 881-884)
```python
# Interface type (required) - normalize to match Nautobot's valid types
if interface.get("type"):
    raw_type = str(interface["type"])
    fields["interface_type"] = normalize_interface_type(raw_type)
```

## Examples

### Before Normalization
```csv
interface_name,interface_type
GigabitEthernet0/0,A_1000BASE_T
Loopback0,VIRTUAL
Port-Channel1,A_LAG
```

### After Normalization
```csv
interface_name,interface_type
GigabitEthernet0/0,1000base-t
Loopback0,virtual
Port-Channel1,lag
```

## Test Results

All test cases pass:

| Input | Output | Status |
|-------|--------|--------|
| `A_1000BASE_T` | `1000base-t` | ✓ |
| `a_1000base_t` | `1000base-t` | ✓ |
| `VIRTUAL` | `virtual` | ✓ |
| `A_100BASE_TX` | `100base-tx` | ✓ |
| `100BASE-TX` | `100base-tx` | ✓ |
| `10GBASE-T` | `10gbase-t` | ✓ |
| `LAG` | `lag` | ✓ |
| `A_LAG` | `lag` | ✓ |
| `UNKNOWN_TYPE` | `other` | ✓ |
| `` (empty) | `other` | ✓ |

**Passed: 10/10 tests**

## Matching Logic

The normalization uses **substring matching** which is very flexible:

1. **Input**: `A_1000BASE_T`
2. **Normalized**: `a-1000base-t` (lowercase + underscores→dashes)
3. **Check**: Is `1000base-t` in `a-1000base-t`? → **Yes!**
4. **Result**: `1000base-t`

This handles:
- ✅ Prefixes (A_, B_, etc.)
- ✅ Case variations (uppercase, lowercase, mixed)
- ✅ Separator variations (underscores vs dashes)
- ✅ Unknown/invalid types → defaults to `other`

## Valid Interface Types

The normalization supports **all 100+ Nautobot interface types**, including:

### Physical Ethernet
- `100base-tx`, `1000base-t`, `2.5gbase-t`, `5gbase-t`, `10gbase-t`, etc.

### Fiber Optics
- `1000base-x-sfp`, `10gbase-x-sfpp`, `40gbase-x-qsfpp`, `100gbase-x-qsfp28`, etc.

### Wireless
- `ieee802.11a`, `ieee802.11ac`, `ieee802.11ax`, `other-wireless`

### Logical
- `virtual`, `bridge`, `lag`, `tunnel`

### Other
- SONET, Fiber Channel, InfiniBand, Cisco StackWise, etc.

**Full list**: 100+ types defined in `VALID_INTERFACE_TYPES` constant

## Logging

The function provides debug and warning logs:

**Debug** (when match found):
```
Normalized interface type: A_1000BASE_T -> 1000base-t
```

**Warning** (when no match):
```
Unknown interface type 'PROPRIETARY_TYPE', defaulting to 'other'
```

## Benefits

1. **Import Compatibility**: Exported CSV can be re-imported without errors
2. **Vendor Agnostic**: Handles various vendor-specific formats
3. **Safe Fallback**: Unknown types → `other` (valid Nautobot type)
4. **No Data Loss**: Original type logged before normalization
5. **Flexible Matching**: Substring matching handles prefixes/suffixes

## Deployment

**No restart required for task code**, but Celery workers should be restarted to pick up changes:

```bash
# Stop Celery workers
pkill -f start_celery.py

# Start Celery workers
cd /Users/mp/programming/cockpit-ng/backend
python start_celery.py
```

## Future Enhancements

Potential improvements:
- Cache normalized results for performance
- Configurable mapping table (YAML/JSON)
- Support custom vendor mappings
- Export mapping report (before/after)

## Related Files

- **Modified**: `/backend/tasks/export_devices_task.py`
- **Related**: Device import tasks that consume exported CSVs
- **Dependencies**: None (pure Python string manipulation)
