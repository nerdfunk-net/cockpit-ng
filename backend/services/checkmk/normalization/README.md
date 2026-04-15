# CheckMK Device Normalization

This package converts Nautobot device data into the CheckMK format used during sync operations.

## Files

| File | Description |
|------|-------------|
| `__init__.py` | Package entry point. Exports `DeviceNormalizationService`. |
| `device_normalizer.py` | Orchestrates the full normalization pipeline. Calls all other normalizers in order and returns a `DeviceExtensions` object ready for CheckMK. |
| `field_normalizer.py` | Processes the `mapping` section of `checkmk.yaml`. Maps Nautobot field values (including nested dot-notation paths and `__location_type=` modifier syntax) to CheckMK host attributes. |
| `ip_normalizer.py` | Extracts the primary IPv4 address from a device and strips the CIDR prefix so CheckMK receives a plain IP string. |
| `snmp_normalizer.py` | Reads the SNMP community mapping config (`snmp_mapping.yaml`) and sets the correct SNMP credentials on the host attributes. |
| `tag_normalizer.py` | Handles `attr2htg`, `cf2htg`, `tags2htg`, and `additional_attributes` mappings from `checkmk.yaml`. Converts Nautobot status, custom fields, and tags to CheckMK host tag groups. |
| `common.py` | Shared type aliases (`DeviceData`) used across the normalizer modules. |
