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

        logger.info(
            f"Identifier fields found in CSV: {[f for f in identifier_fields if f in headers]}"
        )

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
                    logger.info("Device ID not provided, resolving from name or IP...")
                    device_id = asyncio.run(
                        _resolve_device_id(
                            nautobot_service,
                            device_name=device_name,
                            ip_address=ip_address,
                        )
                    )

                    if not device_id:
                        raise Exception(
                            f"Could not resolve device UUID from name='{device_name}' or ip_address='{ip_address}'"
                        )

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
                update_data, interface_config, ip_namespace = _prepare_update_data(row, headers)

                if not update_data:
                    logger.info(f"No update data for device {device_name}, skipping")
                    skipped.append(
                        {
                            "device_id": device_id,
                            "device_name": device_name,
                            "reason": "No fields to update",
                        }
                    )
                    continue

                if dry_run:
                    logger.info(
                        f"[DRY RUN] Would update device {device_name} with: {update_data}"
                    )
                    if interface_config:
                        logger.info(f"[DRY RUN] Interface config: {interface_config}")
                    successes.append(
                        {
                            "device_id": device_id,
                            "device_name": device_name,
                            "updates": update_data,
                            "dry_run": True,
                        }
                    )
                else:
                    # Actually update the device
                    logger.info(f"Updating device {device_name} with: {update_data}")
                    if interface_config:
                        logger.info(f"Using interface config: {interface_config}")
                    if ip_namespace:
                        logger.info(f"Using IP namespace: {ip_namespace}")
                    result = asyncio.run(
                        _update_device_in_nautobot(
                            nautobot_service, device_id, update_data, interface_config, ip_namespace
                        )
                    )

                    successes.append(
                        {
                            "device_id": device_id,
                            "device_name": device_name,
                            "updates": update_data,
                            "result": result,
                        }
                    )
                    logger.info(f"Successfully updated device {device_name}")

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to update device {device_name}: {error_msg}")
                failures.append(
                    {
                        "device_id": device_id,
                        "device_name": device_name,
                        "error": error_msg,
                    }
                )

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

        logger.info("Update complete:")
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
                logger.error(
                    f"GraphQL error looking up device by name: {result['errors']}"
                )
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
                logger.warning(
                    f"IP address {ip_address} is not set as primary IP for any device"
                )
                return None

            # primary_ip4_for can be a list or a single device
            if isinstance(devices, list):
                if len(devices) == 0:
                    logger.warning(
                        f"IP address {ip_address} is not set as primary IP for any device"
                    )
                    return None
                device = devices[0]
            else:
                device = devices

            device_id = device.get("id")
            device_name_found = device.get("name")
            logger.info(
                f"Found device by IP '{ip_address}': {device_name_found} ({device_id})"
            )
            return device_id

        logger.error("No device name or primary IP provided for lookup")
        return None

    except Exception as e:
        logger.error(f"Error resolving device ID: {e}", exc_info=True)
        return None


def _prepare_update_data(row: Dict[str, str], headers: List[str]) -> tuple[Dict[str, Any], Dict[str, str] | None, str | None]:
    """
    Prepare update data from CSV row.

    Filters out empty values and identifier fields (id, name, ip_address).
    Handles special fields like tags (converts to list).
    Handles nested fields like 'platform.name' by extracting just the nested value.
    Extracts interface configuration if present.

    Args:
        row: CSV row as dictionary
        headers: List of column headers

    Returns:
        Tuple of (update_data dict, interface_config dict or None, ip_namespace str or None)
    """
    update_data = {}
    interface_config = None
    ip_namespace = None

    # Fields to exclude from updates (identifiers that are used to locate the device)
    excluded_fields = {"id", "name", "ip_address"}

    # Interface configuration fields
    interface_fields = {"interface_name", "interface_type", "interface_status", "ip_namespace"}

    # Extract interface configuration if present
    if "interface_name" in headers or "interface_type" in headers or "interface_status" in headers:
        interface_config = {
            "name": row.get("interface_name", "").strip() or "Loopback",
            "type": row.get("interface_type", "").strip() or "virtual",
            "status": row.get("interface_status", "").strip() or "active",
        }

    # Extract IP namespace if present
    if "ip_namespace" in headers:
        ip_namespace = row.get("ip_namespace", "").strip() or "Global"

    for field in headers:
        if field in excluded_fields or field in interface_fields:
            continue

        value = row.get(field, "").strip()

        # Skip empty values
        if not value:
            continue

        # Handle special fields
        if field == "tags":
            # Tags should be a list - split by comma if it's a comma-separated string
            if "," in value:
                update_data[field] = [
                    tag.strip() for tag in value.split(",") if tag.strip()
                ]
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

    return update_data, interface_config, ip_namespace


async def _resolve_status_id(
    nautobot_service,
    status_name: str,
    content_type: str = "dcim.interface"
) -> str:
    """
    Resolve a status name to its UUID.

    Args:
        nautobot_service: NautobotService instance
        status_name: Name of the status (e.g., "active")
        content_type: Content type for the status (e.g., "dcim.interface", "ipam.ipaddress")

    Returns:
        Status UUID

    Raises:
        ValueError: If status not found
    """
    logger.info(f"Resolving status '{status_name}' for content type '{content_type}'")

    # Query for statuses filtered by content type
    endpoint = f"extras/statuses/?content_types={content_type}&format=json"
    result = await nautobot_service.rest_request(endpoint=endpoint, method="GET")

    if result and result.get("count", 0) > 0:
        for status in result.get("results", []):
            if status.get("name", "").lower() == status_name.lower():
                logger.info(f"Resolved status '{status_name}' to UUID {status['id']}")
                return status["id"]

    raise ValueError(f"Status '{status_name}' not found for content type '{content_type}'")


async def _resolve_namespace_id(
    nautobot_service,
    namespace_name: str
) -> str:
    """
    Resolve a namespace name to its UUID.

    Args:
        nautobot_service: NautobotService instance
        namespace_name: Name of the namespace (e.g., "Global")

    Returns:
        Namespace UUID

    Raises:
        ValueError: If namespace not found
    """
    logger.info(f"Resolving namespace '{namespace_name}'")

    # Query for namespaces
    query = f"""
    query {{
        namespaces(name: "{namespace_name}") {{
            id
            name
        }}
    }}
    """
    result = await nautobot_service.graphql_query(query)

    if "errors" in result:
        raise ValueError(f"GraphQL errors while resolving namespace: {result['errors']}")

    namespaces = result.get("data", {}).get("namespaces", [])
    if namespaces:
        namespace_id = namespaces[0]["id"]
        logger.info(f"Resolved namespace '{namespace_name}' to UUID {namespace_id}")
        return namespace_id

    raise ValueError(f"Namespace '{namespace_name}' not found")


async def _ensure_interface_with_ip(
    nautobot_service,
    device_id: str,
    ip_address: str,
    interface_name: str = "Loopback",
    interface_type: str = "virtual",
    interface_status: str = "active",
    ip_namespace: str = "Global",
) -> str:
    """
    Ensure an interface exists with the specified IP address.
    If no interface has this IP, create a new interface and assign the IP to it.

    Args:
        nautobot_service: NautobotService instance
        device_id: Device UUID
        ip_address: IP address in CIDR format (e.g., "192.168.1.1/24")
        interface_name: Name for the new interface if created
        interface_type: Type for the new interface if created
        interface_status: Status name for the new interface if created (e.g., "active")
        ip_namespace: IP namespace name for IP address creation (e.g., "Global")

    Returns:
        IP address UUID
    """
    logger.info(f"Ensuring interface with IP {ip_address} for device {device_id}")
    logger.debug(f"Parameters: interface_name={interface_name}, interface_type={interface_type}, interface_status={interface_status}, ip_namespace={ip_namespace}")

    # Step 1: Check if an IP address object exists with this address
    ip_search_endpoint = f"ipam/ip-addresses/?address={ip_address}&format=json"
    logger.debug(f"Step 1: Searching for existing IP at endpoint: {ip_search_endpoint}")
    ip_result = await nautobot_service.rest_request(
        endpoint=ip_search_endpoint, method="GET"
    )
    logger.debug(f"IP search result: count={ip_result.get('count', 0) if ip_result else 0}")

    ip_obj = None
    if ip_result and ip_result.get("count", 0) > 0:
        logger.debug(f"Found {ip_result.get('count')} existing IP address(es)")
        # IP exists, check if it's assigned to an interface of this device
        for ip in ip_result.get("results", []):
            logger.debug(f"Checking IP {ip.get('id')}: assigned_object={ip.get('assigned_object')}")
            if ip.get("assigned_object") and ip["assigned_object"].get("device"):
                if ip["assigned_object"]["device"]["id"] == device_id:
                    logger.info(f"IP {ip_address} already assigned to device interface")
                    return ip["id"]
        ip_obj = ip_result["results"][0]
        logger.info(f"Found existing IP {ip_obj['id']} but not assigned to this device")
    else:
        logger.debug("No existing IP address found")

    # Step 2: Get device interfaces
    interfaces_endpoint = f"dcim/interfaces/?device_id={device_id}&format=json"
    logger.debug(f"Step 2: Fetching device interfaces at endpoint: {interfaces_endpoint}")
    interfaces_result = await nautobot_service.rest_request(
        endpoint=interfaces_endpoint, method="GET"
    )
    logger.debug(f"Interfaces result: count={interfaces_result.get('count', 0) if interfaces_result else 0}")

    # Step 3: Check if any interface already has this IP, or if target interface name exists
    existing_interface_id = None
    if interfaces_result and interfaces_result.get("count", 0) > 0:
        logger.debug(f"Checking {interfaces_result.get('count')} existing interface(s) for IP {ip_address}")
        for interface in interfaces_result.get("results", []):
            # Check if this is the target interface by name
            if interface.get("name") == interface_name:
                logger.info(f"Found existing interface '{interface_name}' (ID: {interface.get('id')})")
                existing_interface_id = interface.get("id")
            
            # Check interface IP addresses
            logger.debug(f"Interface {interface.get('name')}: has {len(interface.get('ip_addresses', []))} IP address(es)")
            if interface.get("ip_addresses"):
                for ip in interface["ip_addresses"]:
                    logger.debug(f"  - IP: {ip.get('address')}")
                    if ip.get("address") == ip_address:
                        logger.info(
                            f"Interface {interface['name']} already has IP {ip_address}"
                        )
                        return ip["id"]
    else:
        logger.debug("No existing interfaces found on device")

    # Step 4: Create interface if needed (or use existing one by name)
    if existing_interface_id:
        logger.info(f"Step 4: Using existing interface '{interface_name}' (ID: {existing_interface_id})")
        interface_id = existing_interface_id
    else:
        logger.info(f"Step 4: Creating new interface '{interface_name}' for IP {ip_address}")

    # Step 4: Create interface if needed (or use existing one by name)
    if existing_interface_id:
        logger.info(f"Step 4: Using existing interface '{interface_name}' (ID: {existing_interface_id})")
        interface_id = existing_interface_id
    else:
        logger.info(f"Step 4: Creating new interface '{interface_name}' for IP {ip_address}")

        # Resolve status name to UUID - Nautobot requires UUIDs
        logger.debug(f"Resolving interface status '{interface_status}' to UUID")
        status_id = await _resolve_status_id(
            nautobot_service, interface_status, content_type="dcim.interface"
        )
        logger.debug(f"Interface status UUID: {status_id}")

        interface_data = {
            "device": device_id,
            "name": interface_name,
            "type": interface_type,
            "status": status_id,  # Use UUID
        }
        logger.debug(f"Interface creation data: {interface_data}")

        interface_endpoint = "dcim/interfaces/?format=json"
        interface_result = await nautobot_service.rest_request(
            endpoint=interface_endpoint, method="POST", data=interface_data
        )

        interface_id = interface_result["id"]
        logger.info(f"Created interface {interface_id}")
        logger.debug(f"Full interface result: {interface_result}")

    # Step 5: Create or update IP address and assign to interface
    if ip_obj:
        # IP exists, create IP-to-Interface association
        logger.info(f"Step 5: Assigning existing IP {ip_obj['id']} to interface {interface_id}")
        
        # Check if association already exists
        check_endpoint = f"ipam/ip-address-to-interface/?ip_address={ip_obj['id']}&interface={interface_id}&format=json"
        logger.debug(f"Checking for existing IP-to-Interface association: {check_endpoint}")
        existing_associations = await nautobot_service.rest_request(
            endpoint=check_endpoint, method="GET"
        )
        
        if existing_associations.get("count", 0) > 0:
            logger.info(f"IP-to-Interface association already exists")
            association_id = existing_associations["results"][0]["id"]
            logger.debug(f"Existing association ID: {association_id}")
        else:
            # Create new IP-to-Interface association
            logger.info(f"Creating new IP-to-Interface association")
            association_endpoint = "ipam/ip-address-to-interface/?format=json"
            association_data = {
                "ip_address": ip_obj["id"],
                "interface": interface_id,
                "is_primary": True,  # Mark as primary for the device
            }
            logger.debug(f"Association data: {association_data}")
            
            association_result = await nautobot_service.rest_request(
                endpoint=association_endpoint, method="POST", data=association_data
            )
            association_id = association_result["id"]
            logger.info(f"✓ Created IP-to-Interface association {association_id}")
            logger.debug(f"Association result: {association_result}")
        
        # Verify the association exists
        verify_endpoint = f"ipam/ip-address-to-interface/{association_id}/?format=json"
        verify_result = await nautobot_service.rest_request(
            endpoint=verify_endpoint, method="GET"
        )
        
        if verify_result["ip_address"]["id"] != ip_obj["id"] or verify_result["interface"]["id"] != interface_id:
            error_msg = f"Association verification failed: IP {verify_result['ip_address']['id']} != {ip_obj['id']} or Interface {verify_result['interface']['id']} != {interface_id}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        logger.info(f"✓ Successfully verified IP {ip_obj['id']} is associated with interface {interface_id}")
        return ip_obj["id"]
    else:
        # Create new IP address and then assign to interface
        logger.info(f"Step 5: Creating new IP {ip_address} and assigning to interface {interface_id}")

        # Resolve IP address status to UUID
        logger.debug(f"Resolving IP status 'active' to UUID")
        ip_status_id = await _resolve_status_id(
            nautobot_service, "active", content_type="ipam.ipaddress"
        )
        logger.debug(f"IP status UUID: {ip_status_id}")

        # Resolve namespace to UUID
        logger.debug(f"Resolving namespace '{ip_namespace}' to UUID")
        namespace_id = await _resolve_namespace_id(nautobot_service, ip_namespace)
        logger.debug(f"Namespace UUID: {namespace_id}")

        # Create IP address without assignment first
        ip_create_data = {
            "address": ip_address,
            "status": ip_status_id,  # Use UUID
            "namespace": namespace_id,  # Use UUID
        }
        logger.debug(f"IP creation data: {ip_create_data}")

        ip_create_endpoint = "ipam/ip-addresses/?format=json"
        logger.debug(f"Creating IP at endpoint: {ip_create_endpoint}")
        ip_create_result = await nautobot_service.rest_request(
            endpoint=ip_create_endpoint, method="POST", data=ip_create_data
        )
        ip_id = ip_create_result["id"]
        logger.info(f"✓ Created IP address {ip_id}")
        logger.debug(f"IP creation result: {ip_create_result}")
        
        # Now create IP-to-Interface association
        logger.info(f"Creating IP-to-Interface association for new IP {ip_id}")
        association_endpoint = "ipam/ip-address-to-interface/?format=json"
        association_data = {
            "ip_address": ip_id,
            "interface": interface_id,
            "is_primary": True,  # Mark as primary for the device
        }
        logger.debug(f"Association data: {association_data}")
        
        association_result = await nautobot_service.rest_request(
            endpoint=association_endpoint, method="POST", data=association_data
        )
        logger.info(f"✓ Created IP-to-Interface association {association_result['id']}")
        logger.debug(f"Association result: {association_result}")
        
        return ip_id


async def _update_device_in_nautobot(
    nautobot_service,
    device_id: str,
    update_data: Dict[str, Any],
    interface_config: Dict[str, str] = None,
    ip_namespace: str = None,
) -> Dict[str, Any]:
    """
    Update a device in Nautobot using REST API.
    Handles primary_ip4 updates with automatic interface creation if needed.

    Args:
        nautobot_service: NautobotService instance
        device_id: Device UUID
        update_data: Dictionary of fields to update
        interface_config: Optional interface configuration for primary_ip4
                         {name, type, status}
        ip_namespace: Optional IP namespace for IP address creation (defaults to "Global")

    Returns:
        Result of the update operation
    """
    logger.debug(f"Updating device {device_id} via REST API")
    logger.debug(f"Update data: {update_data}")

    # Handle primary_ip4 specially - ensure interface exists
    if "primary_ip4" in update_data:
        primary_ip4 = update_data["primary_ip4"]
        logger.info(f"Processing primary_ip4 update: {primary_ip4}")

        # Use interface config if provided, otherwise use defaults
        if not interface_config:
            interface_config = {
                "name": "Loopback",
                "type": "virtual",
                "status": "active",
            }

        # Use namespace if provided, otherwise default to "Global"
        namespace = ip_namespace or "Global"

        # Ensure interface with IP exists
        ip_id = await _ensure_interface_with_ip(
            nautobot_service,
            device_id,
            primary_ip4,
            interface_name=interface_config.get("name", "Loopback"),
            interface_type=interface_config.get("type", "virtual"),
            interface_status=interface_config.get("status", "active"),
            ip_namespace=namespace,
        )

        # Update the update_data to use the IP address UUID instead of the address string
        update_data["primary_ip4"] = ip_id
        logger.info(f"Updated primary_ip4 to use IP UUID: {ip_id}")

    # Use REST API to update the device (PATCH request with JSON format)
    endpoint = f"dcim/devices/{device_id}/?format=json"

    result = await nautobot_service.rest_request(
        endpoint=endpoint, method="PATCH", data=update_data
    )

    # Verify primary_ip4 was set if it was in the update
    if "primary_ip4" in update_data:
        expected_ip_id = update_data["primary_ip4"]
        actual_ip_id = result.get("primary_ip4", {}).get("id") if isinstance(result.get("primary_ip4"), dict) else result.get("primary_ip4")
        
        if actual_ip_id != expected_ip_id:
            error_msg = f"Device update verification failed: primary_ip4 mismatch (expected {expected_ip_id}, got {actual_ip_id})"
            logger.error(error_msg)
            logger.error(f"Full update result: {result}")
            raise ValueError(error_msg)
        
        logger.info(f"✓ Successfully verified device {device_id} primary_ip4 is set to {expected_ip_id}")

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
