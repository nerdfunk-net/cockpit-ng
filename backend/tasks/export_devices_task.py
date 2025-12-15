"""
Celery task for exporting Nautobot devices to YAML or CSV format.
Results are stored as files and can be downloaded from the Jobs/View interface.
"""

from celery_app import celery_app
import logging
from typing import Optional, List, Dict, Any
import yaml
import csv
import io
from datetime import datetime, timezone
import os

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.export_devices", bind=True)
def export_devices_task(
    self,
    device_ids: List[str],
    properties: List[str],
    export_format: str = "yaml",  # "yaml" or "csv"
    csv_options: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Task: Export Nautobot device data to YAML or CSV format.

    This task:
    1. Fetches device data from Nautobot using GraphQL
    2. Filters to selected properties
    3. Exports to specified format (YAML or CSV)
    4. Stores the exported file
    5. Returns file path for download

    Args:
        device_ids: List of Nautobot device IDs to export
        properties: List of properties to include in export
        export_format: Export format ("yaml" or "csv")
        csv_options: Optional CSV formatting options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
            - includeHeaders: Include header row (default: True)

    Returns:
        dict: Export results including file path
    """
    import asyncio
    from services.nautobot import NautobotService

    try:
        logger.info("=" * 80)
        logger.info("EXPORT DEVICES TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Device IDs: {len(device_ids)} devices")
        logger.info(f"Properties: {properties}")
        logger.info(f"Format: {export_format}")
        logger.info(f"CSV Options: {csv_options}")

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Initializing export...",
            },
        )

        if not device_ids:
            return {
                "success": False,
                "error": "No devices specified for export",
            }

        if not properties:
            return {
                "success": False,
                "error": "No properties specified for export",
            }

        # STEP 1: Fetch device data from Nautobot
        logger.info("-" * 80)
        logger.info(f"STEP 1: FETCHING {len(device_ids)} DEVICES FROM NAUTOBOT")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": f"Fetching {len(device_ids)} devices from Nautobot...",
            },
        )

        # Create GraphQL query with requested properties
        query = _build_graphql_query(properties)
        logger.info(f"GraphQL query built with {len(properties)} properties")

        nautobot_service = NautobotService()

        # Create event loop for async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        all_devices = []

        try:
            # Fetch devices in batches (GraphQL can handle large queries, but we'll batch for safety)
            batch_size = 100
            total_batches = (len(device_ids) + batch_size - 1) // batch_size

            for batch_idx in range(total_batches):
                start_idx = batch_idx * batch_size
                end_idx = min(start_idx + batch_size, len(device_ids))
                batch_device_ids = device_ids[start_idx:end_idx]

                logger.info(
                    f"Fetching batch {batch_idx + 1}/{total_batches} ({len(batch_device_ids)} devices)..."
                )

                progress = 10 + int((batch_idx / total_batches) * 40)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Fetching devices batch {batch_idx + 1}/{total_batches}...",
                    },
                )

                # Execute GraphQL query for this batch
                # Note: device_ids are UUIDs, so we filter by id, not name
                variables = {"id_filter": batch_device_ids}
                result = nautobot_service._sync_graphql_query(query, variables)

                if not result or "data" not in result:
                    logger.error(f"Failed to fetch batch {batch_idx + 1}")
                    continue

                devices = result.get("data", {}).get("devices", [])
                all_devices.extend(devices)
                logger.info(
                    f"✓ Fetched {len(devices)} devices from batch {batch_idx + 1}"
                )

        finally:
            loop.close()

        if not all_devices:
            return {
                "success": False,
                "error": "No devices found in Nautobot",
                "requested_count": len(device_ids),
            }

        logger.info(f"✓ Total devices fetched: {len(all_devices)}")

        # STEP 2: Filter properties
        logger.info("-" * 80)
        logger.info("STEP 2: FILTERING PROPERTIES")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 60,
                "total": 100,
                "status": "Filtering device properties...",
            },
        )

        filtered_devices = _filter_device_properties(all_devices, properties)
        logger.info(
            f"✓ Filtered {len(filtered_devices)} devices to {len(properties)} properties"
        )

        # STEP 3: Export to format
        logger.info("-" * 80)
        logger.info(f"STEP 3: EXPORTING TO {export_format.upper()}")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 75,
                "total": 100,
                "status": f"Exporting to {export_format.upper()}...",
            },
        )

        # Normalize export_format by stripping whitespace and underscores
        export_format = export_format.strip().rstrip("_")

        if export_format == "yaml":
            export_content = _export_to_yaml(filtered_devices)
            file_extension = "yaml"
        elif export_format == "csv":
            export_content = _export_to_csv(filtered_devices, csv_options or {})
            file_extension = "csv"
        else:
            return {
                "success": False,
                "error": f"Unsupported export format: {export_format}",
            }

        logger.info(
            f"✓ Generated {export_format.upper()} content ({len(export_content)} bytes)"
        )

        # STEP 4: Save file
        logger.info("-" * 80)
        logger.info("STEP 4: SAVING EXPORT FILE")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 90,
                "total": 100,
                "status": "Saving export file...",
            },
        )

        # Create exports directory if it doesn't exist
        export_dir = os.path.join(os.path.dirname(__file__), "..", "data", "exports")
        os.makedirs(export_dir, exist_ok=True)

        # Generate filename with timestamp
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"nautobot_devices_{timestamp}.{file_extension}"
        file_path = os.path.join(export_dir, filename)

        # Write file
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(export_content)

        logger.info(f"✓ File saved: {file_path}")

        # STEP 5: Complete
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 100,
                "total": 100,
                "status": "Export completed",
            },
        )

        logger.info("=" * 80)
        logger.info("EXPORT DEVICES TASK COMPLETED")
        logger.info("=" * 80)

        result = {
            "success": True,
            "message": f"Exported {len(filtered_devices)} devices to {export_format.upper()}",
            "exported_devices": len(filtered_devices),
            "requested_devices": len(device_ids),
            "properties_count": len(properties),
            "export_format": export_format,
            "file_path": file_path,
            "filename": filename,
            "file_size_bytes": len(export_content),
        }

        # Update job run status if this task is tracked
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_completed(job_run["id"], result=result)
                logger.info(f"✓ Updated job run {job_run['id']} status to completed")
        except Exception as job_error:
            logger.warning(f"Failed to update job run status: {job_error}")

        return result

    except Exception as e:
        logger.error("=" * 80)
        logger.error("EXPORT DEVICES TASK FAILED")
        logger.error("=" * 80)
        logger.error(f"Exception: {e}", exc_info=True)

        error_result = {
            "success": False,
            "error": str(e),
        }

        # Update job run status to failed if tracked
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_failed(job_run["id"], str(e))
                logger.info(f"✓ Updated job run {job_run['id']} status to failed")
        except Exception as job_error:
            logger.warning(f"Failed to update job run status: {job_error}")

        return error_result


def _build_graphql_query(properties: List[str]) -> str:
    """
    Build GraphQL query based on requested properties.

    This query fetches all device data but EXCLUDES UUIDs (id fields) since they are
    instance-specific and not portable between Nautobot instances.
    """
    # Comprehensive query WITHOUT UUIDs - only portable/meaningful data
    query = """
    query Devices($id_filter: [String])
    {
      devices(id: $id_filter)
      {
        name
        asset_tag
        config_context
        _custom_field_data
        position
        face
        serial
        local_config_context_data
        primary_ip4
        {
          description
          ip_version
          address
          host
          mask_length
          dns_name
          parent {
            prefix
          }
          status {
            name
          }
          interfaces {
            name
          }
        }
        role {
          name
        }
        device_type
        {
          model
          manufacturer
          {
            name
          }
        }
        platform
        {
          name
          manufacturer {
            name
          }
        }
        tags
        {
          name
          content_types {
            app_label
            model
          }
        }
        tenant
        {
            name
            tenant_group {
              name
            }
        }
        rack
        {
          name
          rack_group
          {
            name
          }
        }
        location
        {
          name
          description
          location_type
          {
            name
          }
          parent
          {
            name
            description
            location_type
            {
              name
            }
          }
        }
        status
        {
          name
        }
        vrfs
        {
          name
          namespace
          {
            name
          }
          rd
          description
        }
        interfaces
        {
          name
          description
          enabled
          mac_address
          type
          mode
          mtu
          parent_interface
          {
            name
          }
          bridged_interfaces
          {
            name
          }
          status {
            name
          }
          lag {
            name
            enabled
          }
          member_interfaces {
            name
          }
          vrf
          {
            name
            namespace
            {
              name
            }
          }
          ip_addresses {
            address
            status {
              name
            }
            role
            {
              name
            }
            tags {
              name
            }
            parent {
              network
              prefix
              prefix_length
              namespace {
                name
              }
            }
          }
          connected_circuit_termination
          {
            circuit
            {
              cid
              commit_rate
              provider
              {
                name
              }
            }
          }
          tagged_vlans
          {
            name
            vid
          }
          untagged_vlan
          {
            name
            vid
          }
          cable
          {
            termination_a_type
            status
            {
              name
            }
            color
          }
          tags
          {
            name
            content_types
            {
              app_label
              model
            }
          }
        }
        parent_bay
        {
          name
        }
        device_bays
        {
          name
        }
      }
    }
    """
    return query


def _filter_device_properties(
    devices: List[Dict[str, Any]], properties: List[str]
) -> List[Dict[str, Any]]:
    """
    Filter devices to only include specified properties.

    Args:
        devices: Full device data from GraphQL
        properties: List of property names to include

    Returns:
        List of devices with only requested properties
    """
    filtered_devices = []

    for device in devices:
        filtered_device = {}
        for prop in properties:
            if prop in device:
                filtered_device[prop] = device[prop]
            else:
                # Property might be nested or missing
                filtered_device[prop] = None

        filtered_devices.append(filtered_device)

    return filtered_devices


def _export_to_yaml(devices: List[Dict[str, Any]]) -> str:
    """
    Export devices to YAML format.

    Args:
        devices: List of device dictionaries

    Returns:
        YAML string
    """
    return yaml.dump(
        devices, default_flow_style=False, allow_unicode=True, sort_keys=False
    )


def _export_to_csv(devices: List[Dict[str, Any]], csv_options: Dict[str, Any]) -> str:
    """
    Export devices to import-compatible CSV format.

    This format is compatible with the Nautobot Add Device CSV import feature:
    - Semicolon-delimited by default (configurable)
    - One row per interface (devices with multiple interfaces = multiple rows)
    - Device fields: name, serial, asset_tag, role, status, location, device_type, platform, software_version, tags
    - Custom fields: prefixed with cf_ (e.g., cf_net)
    - Interface fields: prefixed with interface_ (e.g., interface_name, interface_ip_address, interface_type)
    - Nested objects flattened to name-only values

    Args:
        devices: List of device dictionaries from GraphQL
        csv_options: CSV formatting options
            - delimiter: Field delimiter (default: ";")
            - quoteChar: Quote character (default: '"')
            - includeHeaders: Include header row (default: True)

    Returns:
        Import-compatible CSV string
    """
    if not devices:
        return ""

    delimiter = csv_options.get(
        "delimiter", ";"
    )  # Default to semicolon for import compatibility
    quotechar = csv_options.get("quoteChar", '"')
    include_headers = csv_options.get("includeHeaders", True)

    # Build flattened rows (one per interface)
    flattened_rows = []

    for device in devices:
        # Extract device-level fields
        device_fields = _extract_device_fields(device)

        # Get interfaces
        interfaces = device.get("interfaces", [])

        if interfaces:
            # One row per interface
            for interface in interfaces:
                row = device_fields.copy()
                row.update(_extract_interface_fields(interface, device))
                flattened_rows.append(row)
        else:
            # No interfaces - single row with device data only
            flattened_rows.append(device_fields)

    if not flattened_rows:
        return ""

    # Determine all unique column names across all rows
    all_columns = set()
    for row in flattened_rows:
        all_columns.update(row.keys())

    # Order columns: device fields first, then interface fields, then custom fields
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

    # Final column order
    ordered_columns = []
    for col in device_cols:
        if col in all_columns:
            ordered_columns.append(col)
    ordered_columns.extend(interface_cols)
    ordered_columns.extend(custom_cols)
    ordered_columns.extend(other_cols)

    # Create CSV in memory
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

    # Write rows
    for row in flattened_rows:
        # Fill in missing columns with empty strings
        complete_row = {col: row.get(col, "") for col in ordered_columns}
        writer.writerow(complete_row)

    csv_content = output.getvalue()
    output.close()

    return csv_content


def _extract_device_fields(device: Dict[str, Any]) -> Dict[str, str]:
    """
    Extract and flatten device-level fields for CSV export.

    Returns a dict with import-compatible field names and string values.
    """
    fields = {}

    # Direct string/number fields
    if device.get("name"):
        fields["name"] = str(device["name"])

    if device.get("serial"):
        fields["serial"] = str(device["serial"])

    if device.get("asset_tag"):
        fields["asset_tag"] = str(device["asset_tag"])

    if device.get("software_version"):
        fields["software_version"] = str(device["software_version"])

    # Nested object fields - extract name only
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

    # Tags - comma-separated list of tag names
    if device.get("tags") and isinstance(device["tags"], list):
        tag_names = [
            tag.get("name", str(tag)) if isinstance(tag, dict) else str(tag)
            for tag in device["tags"]
        ]
        if tag_names:
            fields["tags"] = ",".join(tag_names)

    # Primary IPv4 address - extract address from primary_ip4 object
    if device.get("primary_ip4") and isinstance(device["primary_ip4"], dict):
        primary_addr = device["primary_ip4"].get("address")
        if primary_addr:
            fields["ip_address"] = str(primary_addr)

        # Extract namespace from primary IP's parent prefix
        if device["primary_ip4"].get("parent") and isinstance(
            device["primary_ip4"]["parent"], dict
        ):
            parent = device["primary_ip4"]["parent"]
            if parent.get("namespace") and isinstance(parent["namespace"], dict):
                namespace_name = parent["namespace"].get("name")
                if namespace_name:
                    fields["namespace"] = str(namespace_name)

    # Custom fields - prefix with cf_
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
    Returns a dict with import-compatible field names and string values.
    """
    fields = {}

    # Interface name (required)
    if interface.get("name"):
        fields["interface_name"] = str(interface["name"])

    # Interface type (required)
    if interface.get("type"):
        fields["interface_type"] = str(interface["type"])

    # Interface status
    if interface.get("status") and isinstance(interface["status"], dict):
        fields["interface_status"] = str(interface["status"].get("name", ""))
    elif interface.get("status"):
        fields["interface_status"] = str(interface["status"])

    # Interface description
    if interface.get("description"):
        fields["interface_description"] = str(interface["description"])

    # MAC address
    if interface.get("mac_address"):
        fields["interface_mac_address"] = str(interface["mac_address"])

    # MTU
    if interface.get("mtu"):
        fields["interface_mtu"] = str(interface["mtu"])

    # Mode
    if interface.get("mode"):
        fields["interface_mode"] = str(interface["mode"])

    # Enabled
    if interface.get("enabled") is not None:
        fields["interface_enabled"] = str(interface["enabled"]).lower()

    # IP addresses - find the first one and check if it's primary
    if (
        interface.get("ip_addresses")
        and isinstance(interface["ip_addresses"], list)
        and len(interface["ip_addresses"]) > 0
    ):
        first_ip = interface["ip_addresses"][0]
        if first_ip.get("address"):
            fields["interface_ip_address"] = str(first_ip["address"])

            # Check if this IP matches the device's primary_ip4
            if device.get("primary_ip4") and isinstance(device["primary_ip4"], dict):
                primary_addr = device["primary_ip4"].get("address")
                if primary_addr == first_ip.get("address"):
                    fields["set_primary_ipv4"] = "true"
                else:
                    fields["set_primary_ipv4"] = "false"

    # Parent interface
    if interface.get("parent_interface") and isinstance(
        interface["parent_interface"], dict
    ):
        fields["interface_parent_interface"] = str(
            interface["parent_interface"].get("name", "")
        )

    # LAG
    if interface.get("lag") and isinstance(interface["lag"], dict):
        fields["interface_lag"] = str(interface["lag"].get("name", ""))

    # VLANs
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

    # Interface tags
    if interface.get("tags") and isinstance(interface["tags"], list):
        tag_names = [
            tag.get("name", str(tag)) if isinstance(tag, dict) else str(tag)
            for tag in interface["tags"]
        ]
        if tag_names:
            fields["interface_tags"] = ",".join(tag_names)

    return fields
