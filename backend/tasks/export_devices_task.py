"""
Celery task for exporting Nautobot devices to YAML or CSV format.
Results are stored as files and can be downloaded from the Jobs/View interface.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from celery_app import celery_app

from tasks.export_devices.filters import filter_device_properties
from tasks.export_devices.formatters.csv import export_to_csv
from tasks.export_devices.formatters.yaml import export_to_yaml
from tasks.export_devices.graphql import build_graphql_query

# Backward-compatible aliases (csv_export_task imports these names)
_build_graphql_query = build_graphql_query
_filter_device_properties = filter_device_properties
_export_to_csv = export_to_csv
_export_to_yaml = export_to_yaml

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.export_devices", bind=True)
def export_devices_task(
    self,
    device_ids: List[str],
    properties: List[str],
    export_format: str = "yaml",
    csv_options: Optional[Dict[str, Any]] = None,
) -> dict:
    """
    Export Nautobot device data to YAML or CSV format.

    1. Fetches device data from Nautobot using GraphQL
    2. Filters to selected properties
    3. Exports to specified format (YAML or CSV)
    4. Stores the exported file
    5. Returns file path for download
    """
    try:
        logger.info("=" * 80)
        logger.info("EXPORT DEVICES TASK STARTED")
        logger.info("=" * 80)
        logger.info("Device IDs: %s devices", len(device_ids))
        logger.info("Properties: %s", properties)
        logger.info("Format: %s", export_format)
        logger.info("CSV Options: %s", csv_options)

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing export..."},
        )

        if not device_ids:
            return {"success": False, "error": "No devices specified for export"}

        if not properties:
            return {"success": False, "error": "No properties specified for export"}

        # STEP 1: Fetch device data from Nautobot
        logger.info("-" * 80)
        logger.info("STEP 1: FETCHING %s DEVICES FROM NAUTOBOT", len(device_ids))
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": f"Fetching {len(device_ids)} devices from Nautobot...",
            },
        )

        query = build_graphql_query(properties)
        logger.info("GraphQL query built with %s properties", len(properties))

        import service_factory

        nautobot_client = service_factory.build_nautobot_service()

        all_devices: List[Dict[str, Any]] = []
        batch_size = 100
        total_batches = (len(device_ids) + batch_size - 1) // batch_size

        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(device_ids))
            batch_device_ids = device_ids[start_idx:end_idx]

            logger.info(
                "Fetching batch %s/%s (%s devices)...",
                batch_idx + 1,
                total_batches,
                len(batch_device_ids),
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

            variables = {"id_filter": batch_device_ids}
            result = asyncio.run(nautobot_client.graphql_query(query, variables))

            if not result or "data" not in result:
                logger.error("Failed to fetch batch %s", batch_idx + 1)
                continue

            devices = result.get("data", {}).get("devices", [])
            all_devices.extend(devices)
            logger.info(
                "✓ Fetched %s devices from batch %s", len(devices), batch_idx + 1
            )

        if not all_devices:
            return {
                "success": False,
                "error": "No devices found in Nautobot",
                "requested_count": len(device_ids),
            }

        logger.info("✓ Total devices fetched: %s", len(all_devices))

        # STEP 2: Filter devices by required properties
        logger.info("-" * 80)
        logger.info("STEP 2: FILTERING DEVICES BY REQUIREMENTS")
        logger.info("-" * 80)

        if "primary_ip4" in properties:
            devices_before = len(all_devices)
            all_devices = [
                device
                for device in all_devices
                if device.get("primary_ip4") and device["primary_ip4"].get("address")
            ]
            devices_excluded = devices_before - len(all_devices)
            if devices_excluded > 0:
                logger.info(
                    "✓ Excluded %s devices without primary_ip4", devices_excluded
                )
            logger.info("✓ %s devices remaining after filtering", len(all_devices))

        # STEP 3: Filter properties
        logger.info("-" * 80)
        logger.info("STEP 3: FILTERING PROPERTIES")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 60,
                "total": 100,
                "status": "Filtering device properties...",
            },
        )

        filtered_devices = filter_device_properties(all_devices, properties)
        logger.info(
            "✓ Filtered %s devices to %s properties",
            len(filtered_devices),
            len(properties),
        )

        # STEP 4: Export to format
        logger.info("-" * 80)
        logger.info("STEP 4: EXPORTING TO %s", export_format.upper())
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 75,
                "total": 100,
                "status": f"Exporting to {export_format.upper()}...",
            },
        )

        export_format = export_format.strip().rstrip("_")

        if export_format == "yaml":
            export_content = export_to_yaml(filtered_devices)
            file_extension = "yaml"
        elif export_format == "csv":
            export_content = export_to_csv(filtered_devices, csv_options or {})
            file_extension = "csv"
        else:
            return {
                "success": False,
                "error": f"Unsupported export format: {export_format}",
            }

        logger.info(
            "✓ Generated %s content (%s bytes)",
            export_format.upper(),
            len(export_content),
        )

        # STEP 5: Save file
        logger.info("-" * 80)
        logger.info("STEP 5: SAVING EXPORT FILE")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={"current": 90, "total": 100, "status": "Saving export file..."},
        )

        from config import settings

        export_dir = os.path.join(settings.data_directory, "exports")
        os.makedirs(export_dir, exist_ok=True)

        logger.info(
            "Export directory: %s (absolute: %s)",
            export_dir,
            os.path.abspath(export_dir),
        )

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"nautobot_devices_{timestamp}.{file_extension}"
        file_path = os.path.join(export_dir, filename)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(export_content)

        logger.info("✓ File saved: %s", file_path)

        self.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "Export completed"},
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

        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_completed(job_run["id"], result=result)
                logger.info("✓ Updated job run %s status to completed", job_run["id"])
        except Exception as job_error:
            logger.warning("Failed to update job run status: %s", job_error)

        return result

    except Exception as e:
        logger.error("=" * 80)
        logger.error("EXPORT DEVICES TASK FAILED")
        logger.error("=" * 80)
        logger.error("Exception: %s", e, exc_info=True)

        error_result = {"success": False, "error": str(e)}

        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_failed(job_run["id"], str(e))
                logger.info("✓ Updated job run %s status to failed", job_run["id"])
        except Exception as job_error:
            logger.warning("Failed to update job run status: %s", job_error)

        return error_result
