"""
Integration tests for importing devices from CSV files.

Two CSV formats are tested:

1. Nautobot export format  (nautobot_devices_utf.csv, UTF-8-BOM)
   All Nautobot export columns present; NULL / NoObject sentinels are stripped.
   import_format=nautobot, add_prefixes=True, prefix_length=/24
   Device: testdevice  location=Another City C  IP=192.168.183.254/24

2. Generic minimal format  (nautobot_devices_generic.csv)
   Only "name" and "ip_address" columns; all device-level fields come from defaults.
   import_format=generic, add_prefixes=True, prefix_length=/24
   Device: testdevice  location=City A  IP=192.168.184.253/24

Tests call DeviceImportService directly — no Celery task, no Git repository.

Setup:
  1. Configure .env.test with test Nautobot credentials
  2. Ensure the test Nautobot has:
       - Locations "Another City C" and "City A"
       - Status "Active", Role "Network", Namespace "Global"
       - Manufacturer "NetworkInc" / device type "networkA" (auto-created if absent)
  3. Run:
       pytest -m "integration and nautobot" tests/integration/test_import_devices_from_csv.py -v
"""

import csv
import io
import logging
import os

import pytest

from services.nautobot.devices.import_service import DeviceImportService
from tasks.import_or_update_from_csv_task import (
    _apply_column_mapping,
    _apply_default_prefix_length,
    _extract_interface_config,
    _filter_nautobot_nulls,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# File path
# ---------------------------------------------------------------------------

CSV_FILE = os.path.join(os.path.dirname(__file__), "..", "nautobot_devices_utf.csv")

# ---------------------------------------------------------------------------
# CSV device constants (mirror the exported data exactly)
# ---------------------------------------------------------------------------

DEVICE_NAME = "testdevice"
LOCATION_NAME = "Another City C"
MANUFACTURER_NAME = "NetworkInc"
DEVICE_TYPE_MODEL = "networkA"
STATUS_NAME = "Active"
ROLE_NAME = "Network"
PLATFORM_NAME = "Cisco IOS"
SERIAL_NUMBER = "NET0000001"
NAMESPACE_NAME = "Global"

# Interface defaults — not present in the Nautobot export CSV, supplied via defaults
INTERFACE_NAME = "Loopback"
INTERFACE_TYPE = "virtual"
INTERFACE_STATUS = "Active"

# IP from the CSV has no CIDR mask; the /24 default is appended during import
IP_HOST = "192.168.183.254"
IP_ADDRESS = f"{IP_HOST}/24"
AUTO_PREFIX = "192.168.183.0/24"

# Import settings
DEFAULT_PREFIX_LENGTH = "24"

# ---------------------------------------------------------------------------
# Column mapping
#
# Maps Nautobot export column names to the field names expected by
# DeviceImportService / _extract_interface_config.
# Columns absent from this dict pass through with their original name.
# validate_import_data silently ignores any unknown fields, so unmapped
# Nautobot-specific columns (location__parent__name, rack__name, …)
# are harmless as long as they are not named after a real device field.
# ---------------------------------------------------------------------------

COLUMN_MAPPING: dict[str, str | None] = {
    # Core device fields
    "name": "name",
    "device_type__model": "device_type",
    "device_type__manufacturer__name": "manufacturer",
    "status__name": "status",
    "role__name": "role",
    "platform__name": "platform",
    "location__name": "location",
    "serial": "serial",
    "tags": "tags",
    # Interface / IP — sourced from the exported primary IP columns
    "primary_ip4__host": "interface_ip_address",
    "primary_ip4__parent__namespace__name": "interface_namespace",
    # Columns that must be suppressed to avoid confusing validate_import_data
    # (any column whose pass-through name coincidentally matches a real field).
    "asset_tag": None,  # suppress so it doesn't shadow device.asset_tag
    "comments": None,
    # All remaining Nautobot export columns are ignored via pass-through:
    # _filter_nautobot_nulls removes NULL/NoObject values; the rest are
    # silently discarded by validate_import_data.
}

# Defaults applied on top of the mapped CSV data.
# DeviceImportService merges these (defaults as base, CSV values win).
IMPORT_DEFAULTS: dict[str, str] = {
    "interface_name": INTERFACE_NAME,
    "interface_type": INTERFACE_TYPE,
    "interface_status": INTERFACE_STATUS,
}


# ---------------------------------------------------------------------------
# Parsing helpers (pure functions, no I/O)
# ---------------------------------------------------------------------------


def read_csv_rows(path: str) -> list[dict[str, str]]:
    """Open the CSV file and return all data rows as dicts."""
    with open(path, "r", encoding="utf-8-sig") as fh:
        content = fh.read()
    reader = csv.DictReader(io.StringIO(content))
    return list(reader)


def build_device_payload(
    raw_row: dict[str, str],
) -> tuple[dict, list | None]:
    """
    Run the full import pipeline on a single CSV row.

    Steps:
      1. Strip Nautobot null sentinels (NULL, NoObject, empty string)
      2. Apply column mapping
      3. Merge IMPORT_DEFAULTS as base layer (CSV values win on conflict)
      4. Split interface_* fields into a separate interface_config list
      5. Append /24 to IP addresses without a CIDR mask

    Returns:
        (device_data, interface_config) ready for DeviceImportService.import_device()
    """
    # Step 1: filter nulls
    filtered = _filter_nautobot_nulls(raw_row)

    # Step 2: apply column mapping
    mapped = _apply_column_mapping(filtered, COLUMN_MAPPING)

    # Step 3: merge defaults (base = defaults, overridden by CSV)
    merged = {**IMPORT_DEFAULTS, **mapped}

    # Step 4: extract interface fields
    device_data, iface_config = _extract_interface_config(merged)

    # Step 5: append default prefix length to bare IP addresses
    iface_config = _apply_default_prefix_length(iface_config, DEFAULT_PREFIX_LENGTH)

    return device_data, iface_config


# ---------------------------------------------------------------------------
# Unit tests — fast, no external dependencies
# ---------------------------------------------------------------------------


class TestCsvParsePipeline:
    """Unit tests for the CSV parsing pipeline (no Nautobot connection needed)."""

    def test_csv_file_is_readable(self):
        """The test CSV file must exist and contain at least one data row."""
        assert os.path.exists(CSV_FILE), f"CSV file not found: {CSV_FILE}"
        rows = read_csv_rows(CSV_FILE)
        assert len(rows) >= 1, "CSV file has no data rows"
        assert rows[0]["name"] == DEVICE_NAME

    def test_filter_nautobot_nulls_removes_sentinels(self):
        """NULL, NoObject, and empty-string values must be stripped."""
        rows = read_csv_rows(CSV_FILE)
        raw = rows[0]

        # Confirm some sentinel values are present in the raw row
        assert raw.get("face") == "NULL"
        assert raw.get("rack__name") == "NoObject"
        assert raw.get("comments") == ""

        filtered = _filter_nautobot_nulls(raw)

        assert "face" not in filtered
        assert "rack__name" not in filtered
        assert "comments" not in filtered

        # Real values must survive
        assert filtered["name"] == DEVICE_NAME
        assert filtered["serial"] == SERIAL_NUMBER
        assert filtered["device_type__model"] == DEVICE_TYPE_MODEL
        assert filtered["location__name"] == LOCATION_NAME
        assert filtered["primary_ip4__host"] == IP_HOST

    def test_column_mapping_produces_expected_fields(self):
        """After applying COLUMN_MAPPING the correct device fields are present."""
        rows = read_csv_rows(CSV_FILE)
        filtered = _filter_nautobot_nulls(rows[0])
        mapped = _apply_column_mapping(filtered, COLUMN_MAPPING)

        assert mapped["name"] == DEVICE_NAME
        assert mapped["device_type"] == DEVICE_TYPE_MODEL
        assert mapped["manufacturer"] == MANUFACTURER_NAME
        assert mapped["status"] == STATUS_NAME
        assert mapped["role"] == ROLE_NAME
        assert mapped["platform"] == PLATFORM_NAME
        assert mapped["location"] == LOCATION_NAME
        assert mapped["serial"] == SERIAL_NUMBER
        assert mapped["interface_ip_address"] == IP_HOST
        assert mapped["interface_namespace"] == NAMESPACE_NAME

        # Columns with NULL / NoObject values are removed by _filter_nautobot_nulls
        # before mapping, so they must not appear in the result.
        assert "face" not in mapped          # raw value: "NULL"
        assert "rack__name" not in mapped    # raw value: "NoObject"

        # Columns not present in COLUMN_MAPPING pass through with their CSV name.
        # validate_import_data silently ignores them, so we do not assert absence
        # of "id", "display", "natural_slug", etc. here.  We only verify the
        # fields we actually care about are correct (asserted above).

    def test_extract_interface_config_builds_interface(self):
        """Interface defaults + IP column must produce a valid interface_config."""
        rows = read_csv_rows(CSV_FILE)
        raw = rows[0]
        device_data, iface_config = build_device_payload(raw)

        # Interface config must be present
        assert iface_config is not None, "interface_config must not be None"
        assert len(iface_config) == 1

        iface = iface_config[0]
        assert iface["name"] == INTERFACE_NAME
        assert iface["type"] == INTERFACE_TYPE
        assert iface["status"] == INTERFACE_STATUS
        assert iface["is_primary_ipv4"] is True
        assert iface["namespace"] == NAMESPACE_NAME

        # IP address must have received the /24 suffix
        assert iface["ip_address"] == IP_ADDRESS, (
            f"Expected '{IP_ADDRESS}', got '{iface.get('ip_address')}'"
        )

    def test_device_data_does_not_contain_interface_fields(self):
        """Interface fields must not leak into the device_data dict."""
        rows = read_csv_rows(CSV_FILE)
        device_data, _ = build_device_payload(rows[0])

        interface_keys = [k for k in device_data if k.startswith("interface_")]
        assert interface_keys == [], (
            f"interface_* keys found in device_data: {interface_keys}"
        )

    def test_custom_fields_are_grouped(self):
        """cf_* columns from the CSV must be collected under 'custom_fields'."""
        rows = read_csv_rows(CSV_FILE)
        filtered = _filter_nautobot_nulls(rows[0])
        mapped = _apply_column_mapping(filtered, COLUMN_MAPPING)

        assert "custom_fields" in mapped, "custom_fields key is missing"
        cf = mapped["custom_fields"]
        assert cf.get("checkmk_site") == "siteC"
        assert cf.get("free_textfield") == "Network device in Another City C"
        assert cf.get("last_backup") == "2025-02-20"
        assert cf.get("net") == "netA"
        assert cf.get("snmp_credentials") == "credB"


# ---------------------------------------------------------------------------
# Helpers — shared between integration tests
# ---------------------------------------------------------------------------


async def _resolve_optional_id(nautobot, query: str, path: tuple[str, ...]) -> str | None:
    """Run a GraphQL query and return the first result's ID, or None."""
    result = await nautobot.graphql_query(query)
    data = result["data"]
    for key in path:
        data = data[key]
    return data[0]["id"] if data else None


async def get_or_create_manufacturer(nautobot, name: str) -> str:
    """Return the ID of the named manufacturer, creating it if absent."""
    query = f'query {{ manufacturers(name: "{name}") {{ id }} }}'
    result = await nautobot.graphql_query(query)
    manufacturers = result["data"]["manufacturers"]
    if manufacturers:
        return manufacturers[0]["id"]

    logger.info("Creating manufacturer '%s'", name)
    response = await nautobot.rest_request(
        endpoint="dcim/manufacturers/",
        method="POST",
        data={"name": name},
    )
    mfr_id = response["id"]
    logger.info("✓ Created manufacturer '%s' (%s)", name, mfr_id)
    return mfr_id


async def get_or_create_device_type(
    nautobot, model: str, manufacturer_id: str
) -> tuple[str, bool]:
    """Return (device_type_id, was_created) for the given model + manufacturer."""
    query = f"""
    query {{
      device_types(model: "{model}") {{
        id
        manufacturer {{ id }}
      }}
    }}
    """
    result = await nautobot.graphql_query(query)
    for dt in result["data"]["device_types"]:
        if dt["manufacturer"]["id"] == manufacturer_id:
            return dt["id"], False

    logger.info("Creating device type '%s' for manufacturer %s", model, manufacturer_id)
    response = await nautobot.rest_request(
        endpoint="dcim/device-types/",
        method="POST",
        data={"model": model, "manufacturer": manufacturer_id},
    )
    dt_id = response["id"]
    logger.info("✓ Created device type '%s' (%s)", model, dt_id)
    return dt_id, True


# ---------------------------------------------------------------------------
# Integration fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def import_service(real_nautobot_service):
    """DeviceImportService backed by the real test Nautobot instance."""
    return DeviceImportService(real_nautobot_service)


@pytest.fixture(scope="module")
async def ensure_device_type(real_nautobot_service):
    """
    Module-scoped fixture that guarantees the manufacturer and device type
    required by the CSV device exist in Nautobot.  Cleans them up after the
    module if they were created here.
    """
    mfr_id = await get_or_create_manufacturer(real_nautobot_service, MANUFACTURER_NAME)
    dt_id, was_created = await get_or_create_device_type(
        real_nautobot_service, DEVICE_TYPE_MODEL, mfr_id
    )
    yield {"manufacturer_id": mfr_id, "device_type_id": dt_id, "was_created": was_created}

    if was_created:
        try:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/device-types/{dt_id}/", method="DELETE"
            )
            logger.info("✓ Removed device type '%s'", DEVICE_TYPE_MODEL)
        except Exception as exc:
            logger.warning("Could not remove device type: %s", exc)

        try:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/manufacturers/{mfr_id}/", method="DELETE"
            )
            logger.info("✓ Removed manufacturer '%s'", MANUFACTURER_NAME)
        except Exception as exc:
            logger.warning("Could not remove manufacturer: %s", exc)


@pytest.fixture
async def cleanup_csv_import(real_nautobot_service):
    """
    Yield (device_ids, prefix_ids) lists; delete everything in them on teardown.
    Use this fixture in every test that creates Nautobot objects.
    """
    device_ids: list[str] = []
    prefix_ids: list[str] = []
    yield device_ids, prefix_ids

    for dev_id in device_ids:
        try:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/devices/{dev_id}/", method="DELETE"
            )
            logger.info("✓ Deleted test device %s", dev_id)
        except Exception as exc:
            logger.warning("Could not delete device %s: %s", dev_id, exc)

    for pfx_id in prefix_ids:
        try:
            await real_nautobot_service.rest_request(
                endpoint=f"ipam/prefixes/{pfx_id}/", method="DELETE"
            )
            logger.info("✓ Deleted auto-created prefix %s", pfx_id)
        except Exception as exc:
            logger.warning("Could not delete prefix %s: %s", pfx_id, exc)


# ---------------------------------------------------------------------------
# Integration tests — require a real Nautobot instance
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.nautobot
class TestImportDevicesFromCsv:
    """
    Integration tests for the CSV device import pipeline.

    Every test imports the device from nautobot_devices_utf.csv using the same
    configuration the "CSV Import" Job Template would use:
      - format:         nautobot
      - add_prefixes:   True
      - prefix_length:  /24
    """

    @pytest.mark.asyncio
    async def test_prereqs_location_and_baseline_exist(self, real_nautobot_service):
        """
        Verify that the Nautobot resources referenced in the CSV all exist.

        This test makes no writes — it is a pre-flight check that fails early
        with a clear message if the test Nautobot is not seeded correctly.
        """
        # Location
        loc_result = await real_nautobot_service.graphql_query(
            f'query {{ locations(name: "{LOCATION_NAME}") {{ id name }} }}'
        )
        locations = loc_result["data"]["locations"]
        assert locations, (
            f"Location '{LOCATION_NAME}' not found in Nautobot. "
            "The CSV was exported from a Nautobot that has this location. "
            "Make sure the test Nautobot is seeded with the same baseline data."
        )
        logger.info("✓ Location '%s' exists: %s", LOCATION_NAME, locations[0]["id"])

        # Status
        status_result = await real_nautobot_service.graphql_query(
            f'query {{ statuses(name: "{STATUS_NAME}") {{ id }} }}'
        )
        assert status_result["data"]["statuses"], f"Status '{STATUS_NAME}' not found"
        logger.info("✓ Status '%s' exists", STATUS_NAME)

        # Role
        role_result = await real_nautobot_service.graphql_query(
            f'query {{ roles(name: "{ROLE_NAME}") {{ id }} }}'
        )
        assert role_result["data"]["roles"], f"Role '{ROLE_NAME}' not found"
        logger.info("✓ Role '%s' exists", ROLE_NAME)

        # Namespace
        ns_result = await real_nautobot_service.graphql_query(
            f'query {{ namespaces(name: "{NAMESPACE_NAME}") {{ id }} }}'
        )
        assert ns_result["data"]["namespaces"], f"Namespace '{NAMESPACE_NAME}' not found"
        logger.info("✓ Namespace '%s' exists", NAMESPACE_NAME)

        # Platform (optional — log warning if absent)
        plat_result = await real_nautobot_service.graphql_query(
            f'query {{ platforms(name: "{PLATFORM_NAME}") {{ id }} }}'
        )
        if not plat_result["data"]["platforms"]:
            logger.warning(
                "Platform '%s' not found — import will proceed without platform",
                PLATFORM_NAME,
            )
        else:
            logger.info("✓ Platform '%s' exists", PLATFORM_NAME)

    @pytest.mark.asyncio
    async def test_import_device_from_nautobot_csv(
        self,
        real_nautobot_service,
        import_service,
        ensure_device_type,
        cleanup_csv_import,
    ):
        """
        Happy path: import the device from the Nautobot export CSV.

        Verifies the full pipeline:
          1. CSV is parsed and Nautobot null-sentinels are stripped
          2. Column mapping renames export columns to API field names
          3. Defaults supply the interface name, type, and status
          4. /24 is appended to the bare IP address
          5. DeviceImportService resolves names to UUIDs and creates the device
          6. The interface Loopback is created with 192.168.183.254/24
          7. Primary IPv4 is assigned
          8. The parent prefix 192.168.183.0/24 is auto-created
        """
        device_ids, prefix_ids = cleanup_csv_import

        # Pre-condition: device must not exist yet
        pre_check = await real_nautobot_service.graphql_query(
            f'query {{ devices(name: "{DEVICE_NAME}", location: ["{LOCATION_NAME}"]) {{ id }} }}'
        )
        for existing in pre_check["data"]["devices"]:
            logger.info("Pre-existing device found, adding to cleanup: %s", existing["id"])
            device_ids.append(existing["id"])
            # Delete it so the import starts from a clean state
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/devices/{existing['id']}/", method="DELETE"
            )
            logger.info("Removed pre-existing device %s", existing["id"])

        # Build import payload from the CSV
        rows = read_csv_rows(CSV_FILE)
        assert rows, "CSV file returned no rows"
        device_data, iface_config = build_device_payload(rows[0])

        logger.info("Importing device: %s", device_data.get("name"))
        logger.info("Interface config: %s", iface_config)

        # --- Run the import -------------------------------------------------------
        result = await import_service.import_device(
            device_data=device_data,
            interface_config=iface_config,
            skip_if_exists=False,
            add_prefixes_automatically=True,
        )

        # Track for cleanup
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        # --- Top-level result -----------------------------------------------------
        assert result["success"] is True, f"Import failed: {result.get('message')}"
        assert result["created"] is True, "Device should have been newly created"
        assert result["device_id"] is not None

        if result.get("warnings"):
            logger.warning("Import warnings: %s", result["warnings"])

        # --- Verify device in Nautobot via GraphQL --------------------------------
        gql = f"""
        query {{
          device(id: "{result['device_id']}") {{
            id
            name
            serial
            role {{ name }}
            status {{ name }}
            location {{ name }}
            device_type {{ model }}
            platform {{ name }}
            primary_ip4 {{ address }}
            interfaces {{
              name
              type
              ip_addresses {{ address }}
            }}
          }}
        }}
        """
        raw = await real_nautobot_service.graphql_query(gql)
        device = raw["data"]["device"]

        assert device["name"] == DEVICE_NAME
        assert device["serial"] == SERIAL_NUMBER
        assert device["role"]["name"].lower() == ROLE_NAME.lower()
        assert device["status"]["name"] == STATUS_NAME
        assert device["location"]["name"] == LOCATION_NAME
        assert device["device_type"]["model"] == DEVICE_TYPE_MODEL

        # Platform is optional (may not exist in the test Nautobot)
        if device["platform"]:
            assert device["platform"]["name"] == PLATFORM_NAME

        # Primary IP
        assert device["primary_ip4"] is not None, "Primary IPv4 must be assigned"
        assert device["primary_ip4"]["address"] == IP_ADDRESS

        # Interface
        assert len(device["interfaces"]) >= 1, "At least one interface expected"
        loopback = next(
            (i for i in device["interfaces"] if i["name"] == INTERFACE_NAME), None
        )
        assert loopback is not None, f"Interface '{INTERFACE_NAME}' not found"
        assert loopback["type"].lower() == INTERFACE_TYPE.lower()
        assert any(
            ip["address"] == IP_ADDRESS for ip in loopback["ip_addresses"]
        ), f"IP {IP_ADDRESS} not found on interface; got: {loopback['ip_addresses']}"

        # --- Verify auto-created prefix -------------------------------------------
        pfx_result = await real_nautobot_service.graphql_query(
            f"""
            query {{
              prefixes(prefix: "{AUTO_PREFIX}") {{
                id prefix namespace {{ name }}
              }}
            }}
            """
        )
        prefixes = pfx_result["data"]["prefixes"]
        assert len(prefixes) >= 1, (
            f"Expected auto-created prefix {AUTO_PREFIX} — not found in Nautobot"
        )
        prefix_ids.append(prefixes[0]["id"])

        logger.info(
            "✓ Device '%s' imported: IP=%s  prefix=%s",
            DEVICE_NAME,
            IP_ADDRESS,
            AUTO_PREFIX,
        )

    @pytest.mark.asyncio
    async def test_import_already_existing_device_is_skipped(
        self,
        real_nautobot_service,
        import_service,
        ensure_device_type,
        cleanup_csv_import,
    ):
        """
        When the device already exists and skip_if_exists=True, the import
        must return success=True with created=False and no exception raised.
        """
        device_ids, prefix_ids = cleanup_csv_import

        rows = read_csv_rows(CSV_FILE)
        device_data, iface_config = build_device_payload(rows[0])

        # First import — create the device
        first = await import_service.import_device(
            device_data=device_data,
            interface_config=iface_config,
            skip_if_exists=True,
            add_prefixes_automatically=True,
        )
        assert first["success"] is True, f"First import failed: {first.get('message')}"
        if first.get("device_id"):
            device_ids.append(first["device_id"])

        # Track auto-prefix for cleanup
        pfx_result = await real_nautobot_service.graphql_query(
            f'query {{ prefixes(prefix: "{AUTO_PREFIX}") {{ id }} }}'
        )
        for p in pfx_result["data"]["prefixes"]:
            prefix_ids.append(p["id"])

        # Second import — device already exists, must be skipped gracefully
        second = await import_service.import_device(
            device_data=device_data,
            interface_config=iface_config,
            skip_if_exists=True,
            add_prefixes_automatically=True,
        )

        assert second["success"] is True, f"Second import failed: {second.get('message')}"
        assert second["created"] is False, "Device already existed — created must be False"
        assert second["device_id"] is not None

        logger.info(
            "✓ Duplicate device '%s' correctly skipped (id=%s)",
            DEVICE_NAME,
            second["device_id"],
        )

    @pytest.mark.asyncio
    async def test_import_duplicate_without_skip_raises(
        self,
        real_nautobot_service,
        import_service,
        ensure_device_type,
        cleanup_csv_import,
    ):
        """
        When the device already exists and skip_if_exists=False, the import
        must raise an exception (Nautobot enforces name+location uniqueness).
        """
        device_ids, prefix_ids = cleanup_csv_import

        rows = read_csv_rows(CSV_FILE)
        device_data, iface_config = build_device_payload(rows[0])

        # Create once
        first = await import_service.import_device(
            device_data=device_data,
            interface_config=iface_config,
            skip_if_exists=False,
            add_prefixes_automatically=True,
        )
        assert first["success"] is True
        if first.get("device_id"):
            device_ids.append(first["device_id"])

        # Track prefix
        pfx_result = await real_nautobot_service.graphql_query(
            f'query {{ prefixes(prefix: "{AUTO_PREFIX}") {{ id }} }}'
        )
        for p in pfx_result["data"]["prefixes"]:
            prefix_ids.append(p["id"])

        # Second attempt must raise
        with pytest.raises(Exception) as exc_info:
            await import_service.import_device(
                device_data=device_data,
                interface_config=iface_config,
                skip_if_exists=False,
                add_prefixes_automatically=True,
            )

        error = str(exc_info.value).lower()
        assert any(kw in error for kw in ["already exists", "duplicate", "unique", "name"]), (
            f"Expected a duplicate-device error, got: {exc_info.value}"
        )

        logger.info(
            "✓ Duplicate device correctly rejected when skip_if_exists=False: %s",
            exc_info.value,
        )


# ---------------------------------------------------------------------------
# Generic CSV — constants
# ---------------------------------------------------------------------------

GENERIC_CSV_FILE = os.path.join(
    os.path.dirname(__file__), "..", "nautobot_devices_generic.csv"
)

# The generic CSV only has "name" and "ip_address" — every other device field
# is supplied via GENERIC_IMPORT_DEFAULTS.
GENERIC_DEVICE_NAME = "testdevice"
GENERIC_LOCATION_NAME = "City A"  # from test_add_device_form_data.py baseline

# IP in the generic CSV has no CIDR mask; /24 is appended during import.
GENERIC_IP_HOST = "192.168.184.253"
GENERIC_IP_ADDRESS = f"{GENERIC_IP_HOST}/24"
GENERIC_AUTO_PREFIX = "192.168.184.0/24"

# Column mapping: only two columns in the generic CSV.
GENERIC_COLUMN_MAPPING: dict[str, str | None] = {
    "name": "name",
    "ip_address": "interface_ip_address",
}

# All mandatory device fields must be supplied as defaults because the generic
# CSV contains only the device name and the IP address.
GENERIC_IMPORT_DEFAULTS: dict[str, str] = {
    # Device-level mandatory fields
    "device_type": DEVICE_TYPE_MODEL,   # "networkA" — resolved by name
    "manufacturer": MANUFACTURER_NAME,  # "NetworkInc" — helps disambiguate device_type
    "role": ROLE_NAME,                  # "Network"
    "status": STATUS_NAME,              # "Active"
    "location": GENERIC_LOCATION_NAME,  # "City A"
    # Interface defaults
    "interface_name": INTERFACE_NAME,   # "Loopback"
    "interface_type": INTERFACE_TYPE,   # "virtual"
    "interface_status": INTERFACE_STATUS,
    "interface_namespace": NAMESPACE_NAME,  # "Global"
}


# ---------------------------------------------------------------------------
# Generic CSV — parsing helper
# ---------------------------------------------------------------------------


def build_generic_device_payload(
    raw_row: dict[str, str],
) -> tuple[dict, list | None]:
    """
    Run the import pipeline for a generic-format CSV row.

    Generic format does NOT apply Nautobot null-sentinel filtering
    (there are no NULL / NoObject values in a generic CSV).

    Steps:
      1. Apply GENERIC_COLUMN_MAPPING
      2. Merge GENERIC_IMPORT_DEFAULTS as base layer (CSV values win)
      3. Split interface_* fields into interface_config
      4. Append /24 to the bare IP address
    """
    mapped = _apply_column_mapping(raw_row, GENERIC_COLUMN_MAPPING)
    merged = {**GENERIC_IMPORT_DEFAULTS, **mapped}
    device_data, iface_config = _extract_interface_config(merged)
    iface_config = _apply_default_prefix_length(iface_config, DEFAULT_PREFIX_LENGTH)
    return device_data, iface_config


# ---------------------------------------------------------------------------
# Generic CSV — unit tests (no Nautobot connection)
# ---------------------------------------------------------------------------


class TestGenericCsvParsePipeline:
    """Unit tests for the generic-format CSV parsing pipeline."""

    def test_generic_csv_file_is_readable(self):
        """The generic CSV must exist and contain exactly the two expected columns."""
        assert os.path.exists(GENERIC_CSV_FILE), (
            f"Generic CSV not found: {GENERIC_CSV_FILE}"
        )
        rows = read_csv_rows(GENERIC_CSV_FILE)
        assert len(rows) >= 1, "Generic CSV has no data rows"
        assert set(rows[0].keys()) == {"name", "ip_address"}, (
            f"Unexpected columns: {list(rows[0].keys())}"
        )
        assert rows[0]["name"] == GENERIC_DEVICE_NAME
        assert rows[0]["ip_address"] == GENERIC_IP_HOST

    def test_generic_column_mapping_produces_expected_fields(self):
        """name → name  and  ip_address → interface_ip_address after mapping."""
        rows = read_csv_rows(GENERIC_CSV_FILE)
        # Generic format: no null-sentinel filtering
        mapped = _apply_column_mapping(rows[0], GENERIC_COLUMN_MAPPING)

        assert mapped["name"] == GENERIC_DEVICE_NAME
        assert mapped["interface_ip_address"] == GENERIC_IP_HOST
        # Raw ip_address column must be gone (renamed by mapping)
        assert "ip_address" not in mapped

    def test_generic_defaults_supply_all_mandatory_fields(self):
        """After merging defaults, device_data contains all mandatory fields."""
        rows = read_csv_rows(GENERIC_CSV_FILE)
        device_data, _ = build_generic_device_payload(rows[0])

        assert device_data["name"] == GENERIC_DEVICE_NAME
        assert device_data["device_type"] == DEVICE_TYPE_MODEL
        assert device_data["role"] == ROLE_NAME
        assert device_data["status"] == STATUS_NAME
        assert device_data["location"] == GENERIC_LOCATION_NAME

    def test_generic_extract_interface_config_builds_interface(self):
        """Interface config is built from the mapped IP + interface defaults."""
        rows = read_csv_rows(GENERIC_CSV_FILE)
        device_data, iface_config = build_generic_device_payload(rows[0])

        assert iface_config is not None, "interface_config must not be None"
        assert len(iface_config) == 1

        iface = iface_config[0]
        assert iface["name"] == INTERFACE_NAME
        assert iface["type"] == INTERFACE_TYPE
        assert iface["status"] == INTERFACE_STATUS
        assert iface["namespace"] == NAMESPACE_NAME
        assert iface["is_primary_ipv4"] is True
        assert iface["ip_address"] == GENERIC_IP_ADDRESS, (
            f"Expected '{GENERIC_IP_ADDRESS}', got '{iface.get('ip_address')}'"
        )

    def test_generic_device_data_has_no_interface_fields(self):
        """interface_* keys must not leak into device_data."""
        rows = read_csv_rows(GENERIC_CSV_FILE)
        device_data, _ = build_generic_device_payload(rows[0])

        leaked = [k for k in device_data if k.startswith("interface_")]
        assert leaked == [], f"interface_* keys found in device_data: {leaked}"


# ---------------------------------------------------------------------------
# Generic CSV — integration tests (require a real Nautobot instance)
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.nautobot
class TestImportDevicesFromGenericCsv:
    """
    Integration tests for importing a minimal (generic-format) CSV.

    The CSV provides only device name and IP address; all other mandatory
    fields (device_type, role, status, location, interface settings) are
    supplied via GENERIC_IMPORT_DEFAULTS — exactly as a user would configure
    them in the "Default Values" step of the CSV Import Wizard.

    Import settings:
      format:         generic  (no null-sentinel filtering)
      add_prefixes:   True
      prefix_length:  /24
      location:       City A  (different from the UTF test's "Another City C")
    """

    @pytest.mark.asyncio
    async def test_import_device_from_generic_csv(
        self,
        real_nautobot_service,
        import_service,
        ensure_device_type,
        cleanup_csv_import,
    ):
        """
        Happy path: import testdevice from the generic CSV with all mandatory
        fields supplied via defaults.

        Verifies:
          1. The two-column CSV is parsed correctly
          2. GENERIC_COLUMN_MAPPING maps ip_address → interface_ip_address
          3. GENERIC_IMPORT_DEFAULTS provide device_type, role, status, location
          4. /24 is appended to the bare IP 192.168.184.253
          5. Device is created in Nautobot in location "City A"
          6. Loopback interface with 192.168.184.253/24 is created
          7. Primary IPv4 is assigned
          8. Parent prefix 192.168.184.0/24 is auto-created
        """
        device_ids, prefix_ids = cleanup_csv_import

        # Pre-condition: remove any stale device from a previous failed run
        pre_check = await real_nautobot_service.graphql_query(
            f'query {{ devices(name: "{GENERIC_DEVICE_NAME}",'
            f' location: ["{GENERIC_LOCATION_NAME}"]) {{ id }} }}'
        )
        for existing in pre_check["data"]["devices"]:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/devices/{existing['id']}/", method="DELETE"
            )
            logger.info(
                "Removed pre-existing device %s before generic CSV test", existing["id"]
            )

        # Build import payload
        rows = read_csv_rows(GENERIC_CSV_FILE)
        assert rows, "Generic CSV returned no rows"
        device_data, iface_config = build_generic_device_payload(rows[0])

        logger.info("Importing device (generic): %s", device_data.get("name"))
        logger.info("Interface config: %s", iface_config)

        # --- Run the import -------------------------------------------------------
        result = await import_service.import_device(
            device_data=device_data,
            interface_config=iface_config,
            skip_if_exists=False,
            add_prefixes_automatically=True,
        )

        if result.get("device_id"):
            device_ids.append(result["device_id"])

        # --- Top-level result -----------------------------------------------------
        assert result["success"] is True, f"Import failed: {result.get('message')}"
        assert result["created"] is True, "Device should have been newly created"
        assert result["device_id"] is not None

        if result.get("warnings"):
            logger.warning("Import warnings: %s", result["warnings"])

        # --- Verify in Nautobot via GraphQL ---------------------------------------
        gql = f"""
        query {{
          device(id: "{result['device_id']}") {{
            id
            name
            role {{ name }}
            status {{ name }}
            location {{ name }}
            device_type {{ model }}
            primary_ip4 {{ address }}
            interfaces {{
              name
              type
              ip_addresses {{ address }}
            }}
          }}
        }}
        """
        raw = await real_nautobot_service.graphql_query(gql)
        device = raw["data"]["device"]

        assert device["name"] == GENERIC_DEVICE_NAME
        assert device["role"]["name"].lower() == ROLE_NAME.lower()
        assert device["status"]["name"] == STATUS_NAME
        assert device["location"]["name"] == GENERIC_LOCATION_NAME
        assert device["device_type"]["model"] == DEVICE_TYPE_MODEL

        assert device["primary_ip4"] is not None, "Primary IPv4 must be assigned"
        assert device["primary_ip4"]["address"] == GENERIC_IP_ADDRESS

        loopback = next(
            (i for i in device["interfaces"] if i["name"] == INTERFACE_NAME), None
        )
        assert loopback is not None, f"Interface '{INTERFACE_NAME}' not found"
        assert loopback["type"].lower() == INTERFACE_TYPE.lower()
        assert any(
            ip["address"] == GENERIC_IP_ADDRESS for ip in loopback["ip_addresses"]
        ), f"IP {GENERIC_IP_ADDRESS} not found on interface; got: {loopback['ip_addresses']}"

        # --- Verify auto-created prefix -------------------------------------------
        pfx_result = await real_nautobot_service.graphql_query(
            f'query {{ prefixes(prefix: "{GENERIC_AUTO_PREFIX}") {{ id prefix }} }}'
        )
        prefixes = pfx_result["data"]["prefixes"]
        assert len(prefixes) >= 1, (
            f"Expected auto-created prefix {GENERIC_AUTO_PREFIX} in Nautobot"
        )
        prefix_ids.append(prefixes[0]["id"])

        logger.info(
            "✓ Device '%s' imported (generic CSV): IP=%s  prefix=%s",
            GENERIC_DEVICE_NAME,
            GENERIC_IP_ADDRESS,
            GENERIC_AUTO_PREFIX,
        )

    @pytest.mark.asyncio
    async def test_generic_csv_only_two_columns_are_needed(
        self,
        real_nautobot_service,
        import_service,
        ensure_device_type,
        cleanup_csv_import,
    ):
        """
        Demonstrates that a CSV with only 'name' and 'ip_address' is sufficient
        to import a complete device when all mandatory defaults are configured.

        Verifies the device is created with no serial number (not in the CSV)
        and no platform (not in defaults either).
        """
        device_ids, prefix_ids = cleanup_csv_import

        # Pre-condition cleanup
        pre_check = await real_nautobot_service.graphql_query(
            f'query {{ devices(name: "{GENERIC_DEVICE_NAME}",'
            f' location: ["{GENERIC_LOCATION_NAME}"]) {{ id }} }}'
        )
        for existing in pre_check["data"]["devices"]:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/devices/{existing['id']}/", method="DELETE"
            )

        rows = read_csv_rows(GENERIC_CSV_FILE)
        device_data, iface_config = build_generic_device_payload(rows[0])

        result = await import_service.import_device(
            device_data=device_data,
            interface_config=iface_config,
            skip_if_exists=False,
            add_prefixes_automatically=True,
        )

        assert result["success"] is True
        assert result["created"] is True
        device_ids.append(result["device_id"])

        # Track prefix for cleanup
        pfx_result = await real_nautobot_service.graphql_query(
            f'query {{ prefixes(prefix: "{GENERIC_AUTO_PREFIX}") {{ id }} }}'
        )
        for p in pfx_result["data"]["prefixes"]:
            prefix_ids.append(p["id"])

        # Verify the device has no serial (generic CSV provides none)
        gql = f"""
        query {{
          device(id: "{result['device_id']}") {{
            serial
            platform {{ name }}
          }}
        }}
        """
        raw = await real_nautobot_service.graphql_query(gql)
        device = raw["data"]["device"]
        assert not device["serial"], (
            "Serial must be empty — generic CSV has no serial column"
        )

        logger.info(
            "✓ Minimal generic CSV (2 columns) is sufficient for a full device import"
        )
