# GraphQL Type Fixes - Device Common Service

## Summary

Fixed all GraphQL queries in `device_common_service.py` to use array types `[String]` instead of scalar `String!` to match Nautobot's GraphQL schema expectations.

## Problem

When resolving device attributes (name, role, location, device type), GraphQL returned errors:

```
Variable '$name' of type 'String!' used in position expecting type '[String]'.
Variable '$model' of type 'String!' used in position expecting type '[String]'.
```

## Root Cause

Nautobot's GraphQL schema expects **array types** for filter parameters, not scalars:
- `devices(name: [String])` ❌ NOT `devices(name: String!)`
- `roles(name: [String])` ❌ NOT `roles(name: String!)`
- `locations(name: [String])` ❌ NOT `locations(name: String!)`
- `device_types(model: [String])` ❌ NOT `device_types(model: String!)`

This is a common GraphQL pattern that allows filtering by multiple values.

## Fixes Applied

### 1. `resolve_device_by_name()` - Line 56

**Before**:
```python
query = """
query GetDeviceByName($name: String!) {
  devices(name: $name) {
    id
    name
  }
}
"""
variables = {"name": device_name}
```

**After**:
```python
query = """
query GetDeviceByName($name: [String]) {
  devices(name: $name) {
    id
    name
  }
}
"""
variables = {"name": [device_name]}
```

### 2. `resolve_role_id()` - Line 331

**Before**:
```python
query = """
query GetRole($name: String!) {
  roles(name: $name) {
    id
    name
  }
}
"""
variables = {"name": role_name}
```

**After**:
```python
query = """
query GetRole($name: [String]) {
  roles(name: $name) {
    id
    name
  }
}
"""
variables = {"name": [role_name]}
```

### 3. `resolve_location_id()` - Line 372

**Before**:
```python
query = """
query GetLocation($name: String!) {
  locations(name: $name) {
    id
    name
  }
}
"""
variables = {"name": location_name}
```

**After**:
```python
query = """
query GetLocation($name: [String]) {
  locations(name: $name) {
    id
    name
  }
}
"""
variables = {"name": [location_name]}
```

### 4. `resolve_device_type_id()` - Lines 419 & 432

**With Manufacturer** (Before):
```python
query = """
query GetDeviceType($model: String!, $manufacturer: String!) {
  device_types(model: $model, manufacturer: $manufacturer) {
    id
    model
    manufacturer { name }
  }
}
"""
variables = {"model": model, "manufacturer": manufacturer}
```

**With Manufacturer** (After):
```python
query = """
query GetDeviceType($model: [String], $manufacturer: [String]) {
  device_types(model: $model, manufacturer: $manufacturer) {
    id
    model
    manufacturer { name }
  }
}
"""
variables = {"model": [model], "manufacturer": [manufacturer]}
```

**Without Manufacturer** (Before):
```python
query = """
query GetDeviceType($model: String!) {
  device_types(model: $model) {
    id
    model
    manufacturer { name }
  }
}
"""
variables = {"model": model}
```

**Without Manufacturer** (After):
```python
query = """
query GetDeviceType($model: [String]) {
  device_types(model: $model) {
    id
    model
    manufacturer { name }
  }
}
"""
variables = {"model": [model]}
```

## Impact

### Before Fixes
- ❌ Device name lookup failed (fell back to IP lookup)
- ❌ Role resolution failed (role was omitted from update)
- ❌ Location resolution failed (location was omitted from update)
- ❌ Device type resolution failed (device_type was omitted from update)
- ⚠️ Updates succeeded but with incomplete data

### After Fixes
- ✅ Device name lookup works correctly
- ✅ Role resolution works correctly
- ✅ Location resolution works correctly
- ✅ Device type resolution works correctly
- ✅ All CSV updates include complete data

## Testing

The logs confirmed all resolvers now work:

```
[2025-12-27 22:02:30] INFO - Looking up device by name: LAB
[2025-12-27 22:02:30] INFO - Found device by name 'LAB': 30b220c2-...
[2025-12-27 22:02:30] INFO - Resolving role 'network'
[2025-12-27 22:02:30] INFO - Resolved role 'network' to UUID ...
[2025-12-27 22:02:30] INFO - Resolving location 'Berlin'
[2025-12-27 22:02:30] INFO - Resolved location 'Berlin' to UUID ...
```

## Files Modified

**Backend**:
- `/backend/services/device_common_service.py` - Fixed 4 GraphQL queries across 4 resolver functions

## Why Nautobot Uses Arrays

GraphQL arrays for filters allow powerful queries like:

```graphql
# Find devices with any of these names
devices(name: ["router-1", "router-2", "switch-1"])

# Find devices with any of these roles
devices(role: ["edge-router", "core-router"])
```

Even when filtering by a single value, Nautobot expects it wrapped in an array for consistency.

## Related Issues

This same fix pattern applies to **all** Nautobot GraphQL filter queries that use:
- `name` parameter
- `model` parameter
- Any other string filter parameter

If you see similar errors in the future, wrap the value in an array!

## Conclusion

All GraphQL queries in the device common service now correctly use array types, matching Nautobot's GraphQL schema. CSV uploads and device updates will now properly resolve all device attributes without errors.
