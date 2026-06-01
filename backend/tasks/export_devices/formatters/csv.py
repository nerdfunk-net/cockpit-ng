import csv
import io
from typing import Any, Dict, List

from services.nautobot.common.interface_types import normalize_interface_type


def export_to_csv(devices: List[Dict[str, Any]], csv_options: Dict[str, Any]) -> str:
    """
    Export devices to import-compatible CSV format.

    Format is compatible with the Nautobot Add Device CSV import feature:
    - Semicolon-delimited by default (configurable)
    - One row per interface (devices with multiple interfaces = multiple rows)
    - Device fields: name, serial, asset_tag, role, status, location, device_type, platform, software_version, tags
    - Custom fields: prefixed with cf_ (e.g., cf_net)
    - Interface fields: prefixed with interface_ (e.g., interface_name, interface_ip_address, interface_type)
    - Nested objects flattened to name-only values
    """
    if not devices:
        return ""

    delimiter = csv_options.get("delimiter", ";")
    quotechar = csv_options.get("quoteChar", '"')
    include_headers = csv_options.get("includeHeaders", True)

    flattened_rows = []

    for device in devices:
        device_fields = _extract_device_fields(device)
        interfaces = device.get("interfaces", [])

        if interfaces:
            for interface in interfaces:
                row = device_fields.copy()
                row.update(_extract_interface_fields(interface, device))
                flattened_rows.append(row)
        else:
            flattened_rows.append(device_fields)

    if not flattened_rows:
        return ""

    all_columns: set = set()
    for row in flattened_rows:
        all_columns.update(row.keys())

    device_cols = [
        "name",
        "device_type",
        "ip_address",
        "serial",
        "asset_tag",
        "role",
        "status",
        "location",
        "platform",
        "namespace",
        "software_version",
        "tags",
    ]
    interface_cols = [
        col for col in sorted(all_columns) if col.startswith("interface_")
    ]
    custom_cols = [col for col in sorted(all_columns) if col.startswith("cf_")]
    other_cols = [
        col
        for col in sorted(all_columns)
        if col not in device_cols
        and col not in interface_cols
        and col not in custom_cols
    ]

    ordered_columns = []
    for col in device_cols:
        if col in all_columns:
            ordered_columns.append(col)
    ordered_columns.extend(interface_cols)
    ordered_columns.extend(custom_cols)
    ordered_columns.extend(other_cols)

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=ordered_columns,
        delimiter=delimiter,
        quotechar=quotechar,
        quoting=csv.QUOTE_MINIMAL,
        extrasaction="ignore",
    )

    if include_headers:
        writer.writeheader()

    for row in flattened_rows:
        complete_row = {col: row.get(col, "") for col in ordered_columns}
        writer.writerow(complete_row)

    csv_content = output.getvalue()
    output.close()

    return csv_content


def _extract_device_fields(device: Dict[str, Any]) -> Dict[str, str]:
    """Extract and flatten device-level fields for CSV export."""
    fields: Dict[str, str] = {}

    if device.get("name"):
        fields["name"] = str(device["name"])

    if device.get("serial"):
        fields["serial"] = str(device["serial"])

    if device.get("asset_tag"):
        fields["asset_tag"] = str(device["asset_tag"])

    if device.get("software_version"):
        fields["software_version"] = str(device["software_version"])

    if device.get("role") and isinstance(device["role"], dict):
        fields["role"] = str(device["role"].get("name", ""))
    elif device.get("role"):
        fields["role"] = str(device["role"])

    if device.get("status") and isinstance(device["status"], dict):
        fields["status"] = str(device["status"].get("name", ""))
    elif device.get("status"):
        fields["status"] = str(device["status"])

    if device.get("location") and isinstance(device["location"], dict):
        fields["location"] = str(device["location"].get("name", ""))
    elif device.get("location"):
        fields["location"] = str(device["location"])

    if device.get("device_type") and isinstance(device["device_type"], dict):
        fields["device_type"] = str(device["device_type"].get("model", ""))
    elif device.get("device_type"):
        fields["device_type"] = str(device["device_type"])

    if device.get("platform") and isinstance(device["platform"], dict):
        fields["platform"] = str(device["platform"].get("name", ""))
    elif device.get("platform"):
        fields["platform"] = str(device["platform"])

    if device.get("tags") and isinstance(device["tags"], list):
        tag_names = [
            tag.get("name", str(tag)) if isinstance(tag, dict) else str(tag)
            for tag in device["tags"]
        ]
        if tag_names:
            fields["tags"] = ",".join(tag_names)

    if device.get("primary_ip4") and isinstance(device["primary_ip4"], dict):
        primary_addr = device["primary_ip4"].get("address")
        if primary_addr:
            fields["ip_address"] = str(primary_addr)

        if device["primary_ip4"].get("parent") and isinstance(
            device["primary_ip4"]["parent"], dict
        ):
            parent = device["primary_ip4"]["parent"]
            if parent.get("namespace") and isinstance(parent["namespace"], dict):
                namespace_name = parent["namespace"].get("name")
                if namespace_name:
                    fields["namespace"] = str(namespace_name)

    if device.get("_custom_field_data") and isinstance(
        device["_custom_field_data"], dict
    ):
        for cf_key, cf_value in device["_custom_field_data"].items():
            if cf_value is not None:
                fields[f"cf_{cf_key}"] = str(cf_value)

    return fields


def _extract_interface_fields(
    interface: Dict[str, Any], device: Dict[str, Any]
) -> Dict[str, str]:
    """
    Extract and flatten interface-level fields for CSV export.

    All interface fields are prefixed with 'interface_' for import compatibility.
    """
    fields: Dict[str, str] = {}

    if interface.get("name"):
        fields["interface_name"] = str(interface["name"])

    if interface.get("type"):
        fields["interface_type"] = normalize_interface_type(str(interface["type"]))

    if interface.get("status") and isinstance(interface["status"], dict):
        fields["interface_status"] = str(interface["status"].get("name", ""))
    elif interface.get("status"):
        fields["interface_status"] = str(interface["status"])

    if interface.get("description"):
        fields["interface_description"] = str(interface["description"])

    if interface.get("mac_address"):
        fields["interface_mac_address"] = str(interface["mac_address"])

    if interface.get("mtu"):
        fields["interface_mtu"] = str(interface["mtu"])

    if interface.get("mode"):
        fields["interface_mode"] = str(interface["mode"])

    if interface.get("enabled") is not None:
        fields["interface_enabled"] = str(interface["enabled"]).lower()

    if (
        interface.get("ip_addresses")
        and isinstance(interface["ip_addresses"], list)
        and len(interface["ip_addresses"]) > 0
    ):
        first_ip = interface["ip_addresses"][0]
        if first_ip.get("address"):
            fields["interface_ip_address"] = str(first_ip["address"])

            if device.get("primary_ip4") and isinstance(device["primary_ip4"], dict):
                primary_addr = device["primary_ip4"].get("address")
                if primary_addr == first_ip.get("address"):
                    fields["set_primary_ipv4"] = "true"
                else:
                    fields["set_primary_ipv4"] = "false"

    if interface.get("parent_interface") and isinstance(
        interface["parent_interface"], dict
    ):
        fields["interface_parent_interface"] = str(
            interface["parent_interface"].get("name", "")
        )

    if interface.get("lag") and isinstance(interface["lag"], dict):
        fields["interface_lag"] = str(interface["lag"].get("name", ""))

    if interface.get("untagged_vlan") and isinstance(interface["untagged_vlan"], dict):
        fields["interface_untagged_vlan"] = str(
            interface["untagged_vlan"].get("name", "")
        )

    if interface.get("tagged_vlans") and isinstance(interface["tagged_vlans"], list):
        vlan_names = [
            vlan.get("name", str(vlan)) if isinstance(vlan, dict) else str(vlan)
            for vlan in interface["tagged_vlans"]
        ]
        if vlan_names:
            fields["interface_tagged_vlans"] = ",".join(vlan_names)

    if interface.get("tags") and isinstance(interface["tags"], list):
        tag_names = [
            tag.get("name", str(tag)) if isinstance(tag, dict) else str(tag)
            for tag in interface["tags"]
        ]
        if tag_names:
            fields["interface_tags"] = ",".join(tag_names)

    return fields
