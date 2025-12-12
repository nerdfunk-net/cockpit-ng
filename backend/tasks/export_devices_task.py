"""
Celery task for exporting Nautobot devices to YAML or CSV format.
Results are stored as files and can be downloaded from the Jobs/View interface.
"""

from celery_app import celery_app
import logging
from typing import Optional, List, Dict, Any
import json
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

    The query uses the comprehensive device query structure provided by the user.
    """
    # This is the comprehensive query structure from the user's requirements
    query = """
    query Devices($id_filter: [String])
    {
      devices(id: $id_filter)
      {
        id
        name
        hostname: name
        asset_tag
        config_context
        _custom_field_data
        custom_field_data : _custom_field_data
        position
        face
        serial
        local_config_context_data
        primary_ip4
        {
          id
          description
          ip_version
          address
          host
          mask_length
          dns_name
          parent {
            id
            prefix
          }
          status {
            id
            name
          }
          interfaces {
            id
            name
          }
        }
        role {
          id
          name
        }
        device_type
        {
          id
          model
          manufacturer
          {
            id
            name
          }
        }
        platform
        {
          id
          name
          manufacturer {
            id
            name
          }
        }
        tags
        {
          id
          name
          content_types {
            id
            app_label
            model
          }
        }
        tenant
        {
            id
            name
            tenant_group {
              name
            }
        }
        rack
        {
          id
          name
          rack_group
          {
            id
            name
          }
        }
        location
        {
          id
          name
          description
          location_type
          {
            id
            name
          }
          parent
          {
            id
            name
            description
            location_type
            {
              id
              name
            }
          }
        }
        status
        {
          id
          name
        }
        vrfs
        {
          id
          name
          namespace
          {
            id
            name
          }
          rd
          description
        }
        interfaces
        {
          id
          name
          description
          enabled
          mac_address
          type
          mode
          mtu
          parent_interface
          {
            id
            name
          }
          bridged_interfaces
          {
            id
            name
          }
          status {
            id
            name
          }
          lag {
            id
            name
            enabled
          }
          member_interfaces {
            id
            name
          }
          vrf
          {
            id
            name
            namespace
            {
              id
              name
            }
          }
          ip_addresses {
            address
            status {
              id
              name
            }
            role
            {
              id
              name
            }
            tags {
              id
              name
            }
            parent {
              id
              network
              prefix
              prefix_length
              namespace {
                id
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
                id
                name
              }
            }
          }
          tagged_vlans
          {
            id
            name
            vid
          }
          untagged_vlan
          {
            id
            name
            vid
          }
          cable
          {
            id
            termination_a_type
            status
            {
              id
              name
            }
            color
          }
          tags
          {
            id
            name
            content_types
            {
              id
              app_label
              model
            }
          }
        }
        parent_bay
        {
          id
          name
        }
        device_bays
        {
          id
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
    Export devices to CSV format.

    Args:
        devices: List of device dictionaries
        csv_options: CSV formatting options
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
            - includeHeaders: Include header row (default: True)

    Returns:
        CSV string
    """
    if not devices:
        return ""

    delimiter = csv_options.get("delimiter", ",")
    quotechar = csv_options.get("quoteChar", '"')
    include_headers = csv_options.get("includeHeaders", True)

    # Get all property names from first device
    headers = list(devices[0].keys())

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=headers,
        delimiter=delimiter,
        quotechar=quotechar,
        quoting=csv.QUOTE_MINIMAL,
    )

    if include_headers:
        writer.writeheader()

    # Write rows, converting complex objects to JSON strings
    for device in devices:
        row = {}
        for key, value in device.items():
            if value is None:
                row[key] = ""
            elif isinstance(value, (dict, list)):
                # Convert complex objects to JSON
                row[key] = json.dumps(value)
            else:
                row[key] = str(value)
        writer.writerow(row)

    csv_content = output.getvalue()
    output.close()

    return csv_content
