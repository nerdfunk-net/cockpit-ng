"""
Celery task for updating Nautobot devices from CSV data.
This is the reverse operation of export_devices_task - it reads a CSV
and updates devices in Nautobot based on the data.
"""

from celery_app import celery_app
import logging
from typing import Optional, List, Dict, Any
import csv
import io
from datetime import datetime

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.update_devices_from_csv", bind=True)
def update_devices_from_csv_task(
    self,
    csv_content: str,
    csv_options: Optional[Dict[str, Any]] = None,
    dry_run: bool = False,
) -> dict:
    """
    Task: Update Nautobot devices from CSV data.

    This task:
    1. Parses the CSV content
    2. For each device row, updates the device in Nautobot
    3. Tracks successes and failures
    4. Returns summary of operations

    Args:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
        dry_run: If True, validate without making changes (default: False)

    Returns:
        dict: Update results including success/failure counts and details
    """
    import asyncio
    from services.nautobot import NautobotService

    try:
        logger.info("=" * 80)
        logger.info("UPDATE DEVICES FROM CSV TASK STARTED")
        logger.info("=" * 80)
        logger.info(f"Dry run: {dry_run}")
        logger.info(f"CSV Options: {csv_options}")

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 0,
                "total": 100,
                "status": "Parsing CSV...",
            },
        )

        # Parse CSV options
        csv_opts = csv_options or {}
        delimiter = csv_opts.get("delimiter", ",")
        quotechar = csv_opts.get("quoteChar", '"')

        # STEP 1: Parse CSV
        logger.info("-" * 80)
        logger.info("STEP 1: PARSING CSV")
        logger.info("-" * 80)

        try:
            csv_reader = csv.DictReader(
                io.StringIO(csv_content),
                delimiter=delimiter,
                quotechar=quotechar,
            )
            rows = list(csv_reader)
            logger.info(f"Parsed {len(rows)} rows from CSV")
        except Exception as e:
            logger.error(f"CSV parsing failed: {e}")
            return {
                "success": False,
                "error": f"Failed to parse CSV: {str(e)}",
            }

        if not rows:
            return {
                "success": False,
                "error": "CSV file is empty or invalid",
            }

        total_devices = len(rows)
        logger.info(f"Total devices to process: {total_devices}")

        # Get CSV headers (available properties)
        headers = rows[0].keys()
        logger.info(f"CSV columns: {list(headers)}")

        # STEP 2: Validate and prepare updates
        logger.info("-" * 80)
        logger.info("STEP 2: VALIDATING DEVICE DATA")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": "Validating device data...",
            },
        )

        # Check for at least one identifier field
        identifier_fields = ["id", "name", "ip_address"]
        has_identifier = any(f in headers for f in identifier_fields)
        
        if not has_identifier:
            return {
                "success": False,
                "error": f"CSV is missing identifier columns. At least one of {identifier_fields} is required.",
            }
        
        logger.info(f"Identifier fields found in CSV: {[f for f in identifier_fields if f in headers]}")

        # STEP 3: Update devices in Nautobot
        logger.info("-" * 80)
        logger.info(f"STEP 3: UPDATING {total_devices} DEVICES IN NAUTOBOT")
        logger.info(f"Dry run mode: {dry_run}")
        logger.info("-" * 80)

        nautobot_service = NautobotService()
        
        successes = []
        failures = []
        skipped = []

        for idx, row in enumerate(rows, 1):
            device_id = row.get("id")
            device_name = row.get("name")
            ip_address = row.get("ip_address")
            
            # Determine identifier for logging
            identifier = device_id or device_name or ip_address or f"row-{idx}"

            try:
                logger.info(f"Processing device {idx}/{total_devices}: {identifier}")
                
                # RESOLVE DEVICE UUID
                # If we don't have the UUID, we need to look it up by name or IP
                if not device_id:
                    logger.info(f"Device ID not provided, resolving from name or IP...")
                    device_id = asyncio.run(_resolve_device_id(
                        nautobot_service,
                        device_name=device_name,
                        ip_address=ip_address
                    ))
                    
                    if not device_id:
                        raise Exception(f"Could not resolve device UUID from name='{device_name}' or ip_address='{ip_address}'")
                    
                    logger.info(f"Resolved device UUID: {device_id}")
                
                # Get final device name for logging (if not already available)
                if not device_name:
                    device_name = device_id

                # Update progress
                progress = 10 + int((idx / total_devices) * 80)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "current": progress,
                        "total": 100,
                        "status": f"Updating device {idx}/{total_devices}: {device_name}",
                        "successes": len(successes),
                        "failures": len(failures),
                        "skipped": len(skipped),
                    },
                )

                # Prepare update data from CSV row
                update_data = _prepare_update_data(row, headers)

                if not update_data:
                    logger.info(f"No update data for device {device_name}, skipping")
                    skipped.append({
                        "device_id": device_id,
                        "device_name": device_name,
                        "reason": "No fields to update",
                    })
                    continue

                if dry_run:
                    logger.info(f"[DRY RUN] Would update device {device_name} with: {update_data}")
                    successes.append({
                        "device_id": device_id,
                        "device_name": device_name,
                        "updates": update_data,
                        "dry_run": True,
                    })
                else:
                    # Actually update the device
                    logger.info(f"Updating device {device_name} with: {update_data}")
                    result = asyncio.run(_update_device_in_nautobot(
                        nautobot_service,
                        device_id,
                        update_data
                    ))

                    successes.append({
                        "device_id": device_id,
                        "device_name": device_name,
                        "updates": update_data,
                        "result": result,
                    })
                    logger.info(f"Successfully updated device {device_name}")

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to update device {device_name}: {error_msg}")
                failures.append({
                    "device_id": device_id,
                    "device_name": device_name,
                    "error": error_msg,
                })

        # STEP 4: Prepare results
        logger.info("-" * 80)
        logger.info("STEP 4: PREPARING RESULTS")
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 95,
                "total": 100,
                "status": "Finalizing results...",
            },
        )

        success_count = len(successes)
        failure_count = len(failures)
        skipped_count = len(skipped)

        logger.info(f"Update complete:")
        logger.info(f"  - Successful: {success_count}")
        logger.info(f"  - Failed: {failure_count}")
        logger.info(f"  - Skipped: {skipped_count}")
        logger.info("=" * 80)

        result = {
            "success": True,
            "dry_run": dry_run,
            "summary": {
                "total": total_devices,
                "successful": success_count,
                "failed": failure_count,
                "skipped": skipped_count,
            },
            "successes": successes,
            "failures": failures,
            "skipped": skipped,
            "timestamp": datetime.utcnow().isoformat(),
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
        error_msg = f"Update devices task failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        error_result = {
            "success": False,
            "error": error_msg,
        }

        # Update job run status to failed if tracked
        try:
            import job_run_manager

            job_run = job_run_manager.get_job_run_by_celery_id(self.request.id)
            if job_run:
                job_run_manager.mark_failed(job_run["id"], error_msg)
                logger.info(f"✓ Updated job run {job_run['id']} status to failed")
        except Exception as job_error:
            logger.warning(f"Failed to update job run status: {job_error}")

        return error_result


async def _resolve_device_id(
    nautobot_service,
    device_name: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Optional[str]:
    """
    Resolve device UUID from device name or primary IPv4 address.
    
    If ip_address is provided, it looks up the IP address object first,
    then finds the device assigned to that IP.
    
    Args:
        nautobot_service: NautobotService instance
        device_name: Device name to search for
        ip_address: Primary IPv4 address to search for
    
    Returns:
        Device UUID if found, None otherwise
    """
    try:
        # Case 1: Look up by device name
        if device_name:
            logger.info(f"Looking up device by name: {device_name}")
            query = """
            query GetDeviceByName($name: String!) {
              devices(name: $name) {
                id
                name
              }
            }
            """
            variables = {"name": device_name}
            result = await nautobot_service.graphql_query(query, variables)
            
            if "errors" in result:
                logger.error(f"GraphQL error looking up device by name: {result['errors']}")
                return None
            
            devices = result.get("data", {}).get("devices", [])
            if devices and len(devices) > 0:
                device_id = devices[0].get("id")
                logger.info(f"Found device by name '{device_name}': {device_id}")
                return device_id
            
            logger.warning(f"No device found with name: {device_name}")
        
        # Case 2: Look up by primary IPv4 address
        if ip_address:
            logger.info(f"Looking up device by primary IPv4: {ip_address}")
            
            # Query for IP address and get the device it's assigned to as primary IP
            query = """
            query GetIPAddress($address: [String]) {
              ip_addresses(address: $address) {
                id
                address
                primary_ip4_for {
                  id
                  name
                }
              }
            }
            """
            variables = {"address": [ip_address]}
            result = await nautobot_service.graphql_query(query, variables)
            
            if "errors" in result:
                logger.error(f"GraphQL error looking up IP address: {result['errors']}")
                return None
            
            ip_addresses = result.get("data", {}).get("ip_addresses", [])
            if not ip_addresses or len(ip_addresses) == 0:
                logger.warning(f"No IP address found: {ip_address}")
                return None
            
            # Get the device from primary_ip4_for
            ip_obj = ip_addresses[0]
            devices = ip_obj.get("primary_ip4_for")
            
            if not devices:
                logger.warning(f"IP address {ip_address} is not set as primary IP for any device")
                return None
            
            # primary_ip4_for can be a list or a single device
            if isinstance(devices, list):
                if len(devices) == 0:
                    logger.warning(f"IP address {ip_address} is not set as primary IP for any device")
                    return None
                device = devices[0]
            else:
                device = devices
            
            device_id = device.get("id")
            device_name_found = device.get("name")
            logger.info(f"Found device by IP '{ip_address}': {device_name_found} ({device_id})")
            return device_id
        
        logger.error("No device name or primary IP provided for lookup")
        return None
        
    except Exception as e:
        logger.error(f"Error resolving device ID: {e}", exc_info=True)
        return None


def _prepare_update_data(row: Dict[str, str], headers: List[str]) -> Dict[str, Any]:
    """
    Prepare update data from CSV row.
    
    Filters out empty values and identifier fields (id, name, ip_address).
    Handles special fields like tags (converts to list).
    Handles nested fields like 'platform.name' by extracting just the nested value.
    
    Args:
        row: CSV row as dictionary
        headers: List of column headers
    
    Returns:
        Dictionary of fields to update
    """
    update_data = {}
    
    # Fields to exclude from updates (identifiers that are used to locate the device)
    excluded_fields = {"id", "name", "ip_address"}
    
    for field in headers:
        if field in excluded_fields:
            continue
            
        value = row.get(field, "").strip()
        
        # Skip empty values
        if not value:
            continue
        
        # Handle special fields
        if field == "tags":
            # Tags should be a list - split by comma if it's a comma-separated string
            if "," in value:
                update_data[field] = [tag.strip() for tag in value.split(",") if tag.strip()]
            else:
                update_data[field] = [value]
        # Handle nested fields (e.g., "platform.name" -> extract just the name)
        elif "." in field:
            # For nested fields like "platform.name", we need to send just the name
            # The REST API will handle looking up the object by name
            base_field, nested_field = field.rsplit(".", 1)
            update_data[base_field] = value
        else:
            update_data[field] = value
    
    return update_data


async def _update_device_in_nautobot(
    nautobot_service,
    device_id: str,
    update_data: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Update a device in Nautobot using REST API.
    
    Args:
        nautobot_service: NautobotService instance
        device_id: Device UUID
        update_data: Dictionary of fields to update
    
    Returns:
        Result of the update operation
    """
    logger.debug(f"Updating device {device_id} via REST API")
    logger.debug(f"Update data: {update_data}")
    
    # Use REST API to update the device (PATCH request with JSON format)
    endpoint = f"dcim/devices/{device_id}/?format=json"
    
    result = await nautobot_service.rest_request(
        endpoint=endpoint,
        method="PATCH",
        data=update_data
    )
    
    return result


def _build_update_mutation(update_data: Dict[str, Any]) -> str:
    """
    Deprecated: This function is no longer used as we now use REST API instead of GraphQL mutations.
    
    Args:
        update_data: Dictionary of fields to update
    
    Returns:
        GraphQL mutation string
    """
    # This function is kept for backward compatibility but is no longer used
    pass
