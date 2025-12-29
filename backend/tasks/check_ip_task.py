"""
Check IP Celery Task

This task compares devices from a CSV file with devices in Nautobot.
It efficiently loads all Nautobot devices using pagination and then
compares them with the CSV data.
"""

import csv
import io
import logging
import asyncio
from typing import Dict, Any
from celery_app import celery_app
from services.nautobot.devices.query import device_query_service
from settings_manager import settings_manager
import job_run_manager

logger = logging.getLogger(__name__)


@celery_app.task(bind=True)
def check_ip_task(
    self, csv_content: str, delimiter: str = None, quote_char: str = None
) -> Dict[str, Any]:
    """
    Compare CSV device list with Nautobot devices.

    Args:
        csv_content: CSV file content as string
        delimiter: CSV delimiter to use (optional, defaults to settings)
        quote_char: CSV quote character to use (optional, defaults to settings)

    Returns:
        Dictionary with comparison results
    """
    logger.info(
        f"check_ip_task called with delimiter='{delimiter}', quote_char='{quote_char}'"
    )
    try:
        # Use provided settings if they are valid (not None, not 'None', not empty)
        use_provided = (
            delimiter is not None
            and delimiter != "None"
            and delimiter != ""
            and quote_char is not None
            and quote_char != "None"
            and quote_char != ""
        )

        if use_provided:
            # Use provided parameters
            logger.info(
                f"Using provided CSV settings - delimiter: '{delimiter}', quote_char: '{quote_char}'"
            )
        else:
            # Get CSV settings from application settings
            logger.info("No valid parameters provided, checking database settings...")
            settings = settings_manager.get_nautobot_settings()
            delimiter = settings.get("csv_delimiter") if settings else None
            quote_char = settings.get("csv_quote_char") if settings else None

            # If not found in main settings, try defaults
            if not delimiter or not quote_char:
                logger.info(
                    "CSV settings not found in main settings, checking defaults..."
                )
                defaults = settings_manager.get_nautobot_defaults()
                delimiter = delimiter or (
                    defaults.get("csv_delimiter", ",") if defaults else ","
                )
                quote_char = quote_char or (
                    defaults.get("csv_quote_char", '"') if defaults else '"'
                )
                logger.info(
                    f"Using defaults - delimiter: '{delimiter}', quote_char: '{quote_char}'"
                )

            logger.info(f"Raw settings from database: {settings}")
            logger.info(
                f"Using final CSV settings - delimiter: '{delimiter}', quote_char: '{quote_char}'"
            )

        logger.info(f"CSV content preview (first 200 chars): {csv_content[:200]}")

        # Parse CSV content with configured settings
        csv_reader = csv.DictReader(
            io.StringIO(csv_content), delimiter=delimiter, quotechar=quote_char
        )
        csv_devices = []

        # Log detected CSV columns for debugging
        first_row_processed = False

        for row in csv_reader:
            if not first_row_processed:
                logger.info(f"Detected CSV columns: {list(row.keys())}")
                logger.info("Looking for required columns: 'ip_address' and 'name'")
                first_row_processed = True

            if "ip_address" in row and "name" in row:
                csv_devices.append(
                    {
                        "ip_address": row["ip_address"].strip(),
                        "name": row["name"].strip(),
                    }
                )
            else:
                logger.warning(f"Row missing required columns: {row}")

        if not csv_devices:
            return {
                "success": False,
                "error": "No valid devices found in CSV file. Required columns: ip_address, name",
            }

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": len(csv_devices),
                "message": "Loading Nautobot devices...",
            },
        )

        # Load all Nautobot devices efficiently using device query service with pagination
        nautobot_devices = []
        limit = 100
        offset = 0
        total_loaded = 0

        while True:
            try:
                # Call the service directly (same as the /api/nautobot/devices endpoint)
                # Handle async call in sync Celery task
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                response_data = loop.run_until_complete(
                    device_query_service.get_devices(
                        limit=limit, offset=offset, filter_type=None, filter_value=None
                    )
                )
                loop.close()

                devices_batch = response_data.get("devices", [])

                if not devices_batch:
                    break

                # Process batch
                for device in devices_batch:
                    if device.get("name") and device.get("primary_ip4"):
                        # Extract IP address from primary_ip4 field
                        primary_ip = device["primary_ip4"]

                        # Handle both string and dict formats
                        if isinstance(primary_ip, dict):
                            # If it's a dict, get the 'address' field
                            primary_ip = primary_ip.get("address", "")
                        elif not isinstance(primary_ip, str):
                            primary_ip = str(primary_ip)

                        # Strip CIDR notation to get just the IP
                        if "/" in primary_ip:
                            ip_address = primary_ip.split("/")[0]
                        else:
                            ip_address = primary_ip

                        if ip_address:  # Only add if we have a valid IP
                            nautobot_devices.append(
                                {"name": device["name"], "ip_address": ip_address}
                            )

                total_loaded += len(devices_batch)
                logger.info(f"Loaded {total_loaded} devices from device_query_service")

                # Update progress
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": 0,
                        "total": len(csv_devices),
                        "message": f"Loaded {total_loaded} devices from Nautobot...",
                    },
                )

                offset += limit

                # Break if we got less than the limit (last page)
                if len(devices_batch) < limit:
                    break

            except Exception as e:
                logger.error(
                    f"Error loading devices from device_query_service at offset {offset}: {str(e)}"
                )
                return {
                    "success": False,
                    "error": f"Failed to load devices from device service: {str(e)}",
                }

        logger.info(
            f"Total devices loaded from device_query_service: {len(nautobot_devices)}"
        )

        # Log first few Nautobot devices for debugging
        if nautobot_devices:
            logger.info(f"Sample Nautobot devices: {nautobot_devices[:3]}")

        # Create lookup dictionary for efficient comparison
        # Key: IP address, Value: device name
        nautobot_lookup = {}
        for device in nautobot_devices:
            ip = device["ip_address"]
            if ip:
                nautobot_lookup[ip] = device["name"]

        logger.info(
            f"Nautobot IP lookup keys: {list(nautobot_lookup.keys())[:10]}"
        )  # First 10 IPs

        # Compare CSV devices with Nautobot devices
        results = []

        for i, csv_device in enumerate(csv_devices):
            self.update_state(
                state="PROGRESS",
                meta={
                    "current": i + 1,
                    "total": len(csv_devices),
                    "message": f"Comparing device {i + 1} of {len(csv_devices)}",
                },
            )

            csv_ip = csv_device["ip_address"]
            csv_name = csv_device["name"]

            # Strip CIDR notation from CSV IP for comparison
            if "/" in csv_ip:
                csv_ip_clean = csv_ip.split("/")[0]
            else:
                csv_ip_clean = csv_ip

            logger.info(
                f"Comparing CSV device: {csv_name} with IP {csv_ip} (cleaned: {csv_ip_clean})"
            )

            try:
                if csv_ip_clean in nautobot_lookup:
                    nautobot_name = nautobot_lookup[csv_ip_clean]

                    if csv_name.lower() == nautobot_name.lower():
                        # Perfect match
                        results.append(
                            {
                                "ip_address": csv_ip_clean,  # Use cleaned IP in results
                                "device_name": csv_name,
                                "status": "match",
                                "nautobot_device_name": nautobot_name,
                            }
                        )
                    else:
                        # IP found but name mismatch
                        results.append(
                            {
                                "ip_address": csv_ip_clean,  # Use cleaned IP in results
                                "device_name": csv_name,
                                "status": "name_mismatch",
                                "nautobot_device_name": nautobot_name,
                            }
                        )
                else:
                    # IP not found in Nautobot
                    logger.info(f"IP {csv_ip_clean} not found in Nautobot lookup")
                    results.append(
                        {
                            "ip_address": csv_ip_clean,  # Use cleaned IP in results
                            "device_name": csv_name,
                            "status": "ip_not_found",
                        }
                    )

            except Exception as e:
                logger.error(f"Error comparing device {csv_name} ({csv_ip}): {str(e)}")
                results.append(
                    {
                        "ip_address": csv_ip,
                        "device_name": csv_name,
                        "status": "error",
                        "error": str(e),
                    }
                )

        # Calculate statistics
        match_count = sum(1 for r in results if r["status"] == "match")
        mismatch_count = sum(1 for r in results if r["status"] == "name_mismatch")
        not_found_count = sum(1 for r in results if r["status"] == "ip_not_found")
        error_count = sum(1 for r in results if r["status"] == "error")

        result_data = {
            "success": True,
            "message": f"Compared {len(csv_devices)} devices. Matches: {match_count}, Mismatches: {mismatch_count}, Not found: {not_found_count}, Errors: {error_count}",
            "total_devices": len(csv_devices),
            "processed_devices": len(results),
            "statistics": {
                "matches": match_count,
                "name_mismatches": mismatch_count,
                "ip_not_found": not_found_count,
                "errors": error_count,
            },
            "results": results,
        }

        # Update job run with completion status and results
        try:
            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_completed(job_run["id"], result=result_data)
                logger.info(f"Job run {job_run['id']} marked as completed")
        except Exception as e:
            logger.error(f"Error updating job run: {str(e)}")

        return result_data

    except Exception as e:
        logger.error(f"Error in check_ip_task: {str(e)}")
        error_result = {"success": False, "error": f"Task failed: {str(e)}"}

        # Update job run with failure status
        try:
            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_failed(job_run["id"], error_message=str(e))
        except Exception as update_error:
            logger.error(f"Error updating job run on failure: {str(update_error)}")

        return error_result
