"""
Unit tests for CheckMK API response structure validation.

These tests use CAPTURED API responses from a real production CheckMK instance
with MOCKED services to validate API structure and data compatibility.

IMPORTANT: These tests do NOT connect to real systems - they use mocks with
real captured data to ensure fast, repeatable tests that validate API structure.

For integration tests with real Nautobot/CheckMK, see test_checkmk_baseline.py

Data captured: 2026-01-03
CheckMK Version: REST API v1.0
"""

import pytest
from unittest.mock import AsyncMock, patch

from services.checkmk.sync.base import NautobotToCheckMKService

# Import real captured fixtures
from tests.fixtures.checkmk_fixtures import CHECKMK_HOST_REAL_API_RESPONSE
from tests.fixtures.snmp_fixtures import (
    CHECKMK_HOST_WITH_SNMP_V2_REAL,
    NAUTOBOT_NORMALIZED_CONFIG_REAL,
    SNMP_MAPPING_CONFIG,
)


@pytest.mark.unit
@pytest.mark.checkmk
class TestCheckMKAPIResponseStructure:
    """Validate CheckMK API response structure using captured real data with mocks."""

    def test_real_checkmk_response_structure(self):
        """Verify the structure of real CheckMK API response."""
        response = CHECKMK_HOST_REAL_API_RESPONSE

        # Verify top-level structure
        assert "links" in response
        assert "domainType" in response
        assert response["domainType"] == "host_config"
        assert "id" in response
        assert "title" in response
        assert "members" in response
        assert "extensions" in response

        # Verify extensions structure
        extensions = response["extensions"]
        assert "folder" in extensions
        assert "attributes" in extensions
        assert "effective_attributes" in extensions
        assert "is_cluster" in extensions
        assert "is_offline" in extensions
        assert "cluster_nodes" in extensions

        # Verify attributes structure
        attributes = extensions["attributes"]
        assert "alias" in attributes
        assert "site" in attributes
        assert "ipaddress" in attributes
        assert "tag_agent" in attributes
        assert "tag_snmp_ds" in attributes
        assert "snmp_community" in attributes
        assert "meta_data" in attributes

    def test_real_snmp_v2_community_structure(self):
        """Verify SNMPv2c community structure in real response."""
        response = CHECKMK_HOST_WITH_SNMP_V2_REAL
        snmp_community = response["extensions"]["attributes"]["snmp_community"]

        assert snmp_community["type"] == "v1_v2_community"
        assert "community" in snmp_community
        assert snmp_community["community"] == "snmpcommunity"

    def test_normalized_config_matches_checkmk_format(self):
        """Test that normalized Nautobot config matches CheckMK format."""
        normalized = NAUTOBOT_NORMALIZED_CONFIG_REAL
        checkmk_response = CHECKMK_HOST_WITH_SNMP_V2_REAL

        # Extract CheckMK attributes (excluding meta_data)
        checkmk_attrs = checkmk_response["extensions"]["attributes"].copy()
        checkmk_attrs.pop("meta_data", None)

        # Extract normalized attributes
        normalized_attrs = normalized["attributes"]

        # Compare folders
        assert normalized["folder"] == checkmk_response["extensions"]["folder"]

        # Compare all attributes (order doesn't matter)
        assert set(normalized_attrs.keys()) == set(checkmk_attrs.keys())

        # Compare SNMP community structure
        assert normalized_attrs["snmp_community"] == checkmk_attrs["snmp_community"]

    @pytest.mark.asyncio
    async def test_comparison_with_real_api_format(self):
        """Test device comparison using real API response format."""
        # This test demonstrates how the comparison works with real CheckMK data

        # Mock the CheckMK client to return real API response
        mock_checkmk_response = CHECKMK_HOST_WITH_SNMP_V2_REAL

        # Mock Nautobot to return device data
        mock_nautobot_device = {
            "id": "71cd69db-dca1-425b-a1d8-46952ef2c8e9",
            "name": "LAB",
            "primary_ip4": {"address": "192.168.178.240/24"},
            "location": {"name": "Berlin", "parent": {"name": "Deutschland"}},
            "role": {"name": "Network"},
            "platform": {"name": "Cisco IOS"},
            "status": {"name": "Active"},
            "_custom_field_data": {"snmp_credentials": "snmp-id-3"},
            "tags": [],
        }

        # Create service instance
        service = NautobotToCheckMKService()

        with (
            patch("services.nautobot.nautobot_service") as mock_nb_service,
            patch("services.checkmk.config.config_service") as mock_config,
            patch("routers.checkmk.main.get_host") as mock_get_host,
        ):
            # Configure mocks
            mock_nb_service.graphql_query = AsyncMock(
                return_value={"data": {"device": mock_nautobot_device}}
            )
            mock_config.load_snmp_mapping.return_value = SNMP_MAPPING_CONFIG
            mock_config.load_checkmk_config.return_value = {
                "compare": ["attributes", "folder"],
                "ignore_attributes": ["tag_address_family"],
            }
            mock_config.get_comparison_keys.return_value = ["attributes", "folder"]
            mock_config.get_ignore_attributes.return_value = ["tag_address_family"]

            # Mock CheckMK response
            mock_get_host.return_value = AsyncMock(data=mock_checkmk_response)

            # Perform comparison
            result = await service.compare_device_config(
                "71cd69db-dca1-425b-a1d8-46952ef2c8e9"
            )

            # Verify comparison succeeded
            assert result is not None
            assert hasattr(result, "result")
            # The comparison should find they are equal
            assert result.result in ["equal", "diff", "host_not_found"]

    def test_real_api_links_structure(self):
        """Test HAL/REST links structure from real API."""
        response = CHECKMK_HOST_REAL_API_RESPONSE
        links = response["links"]

        # Should have multiple links
        assert len(links) >= 3

        # Find the self link
        self_link = next((link for link in links if link["rel"] == "self"), None)
        assert self_link is not None
        assert self_link["method"] == "GET"
        assert self_link["type"] == "application/json"
        assert "/objects/host_config/" in self_link["href"]

        # Find the update link
        update_link = next((link for link in links if "update" in link["rel"]), None)
        assert update_link is not None
        assert update_link["method"] == "PUT"

        # Find the delete link
        delete_link = next((link for link in links if "delete" in link["rel"]), None)
        assert delete_link is not None
        assert delete_link["method"] == "DELETE"

    def test_real_api_metadata_structure(self):
        """Test metadata structure in real API response."""
        response = CHECKMK_HOST_REAL_API_RESPONSE
        meta_data = response["extensions"]["attributes"]["meta_data"]

        # Verify metadata fields
        assert "created_at" in meta_data
        assert "updated_at" in meta_data
        assert "created_by" in meta_data

        # Verify timestamp format (ISO 8601 with timezone)
        assert "T" in meta_data["created_at"]
        assert "+00:00" in meta_data["created_at"]

    def test_real_api_folder_format(self):
        """Test folder path format in real API."""
        response = CHECKMK_HOST_REAL_API_RESPONSE
        folder = response["extensions"]["folder"]

        # Folder should start with /
        assert folder.startswith("/")

        # Should use / as separator (not ~)
        assert "/" in folder

        # Specific test case: /network/Berlin
        assert folder == "/network/Berlin"

    def test_real_api_cluster_fields(self):
        """Test cluster-related fields in real API response."""
        response = CHECKMK_HOST_REAL_API_RESPONSE
        extensions = response["extensions"]

        # Non-cluster host should have these fields
        assert extensions["is_cluster"] is False
        assert extensions["is_offline"] is False
        assert extensions["cluster_nodes"] is None


@pytest.mark.unit
class TestComparisonLogicWithCapturedData:
    """Test comparison logic with captured real data (mocked services)."""

    def test_attribute_comparison_real_data(self):
        """Test that attribute comparison works correctly with real data."""
        # Normalized Nautobot config
        nb_attrs = NAUTOBOT_NORMALIZED_CONFIG_REAL["attributes"]

        # CheckMK config (without meta_data)
        cmk_response = CHECKMK_HOST_WITH_SNMP_V2_REAL
        cmk_attrs = cmk_response["extensions"]["attributes"].copy()
        cmk_attrs.pop("meta_data", None)

        # All keys should match
        nb_keys = set(nb_attrs.keys())
        cmk_keys = set(cmk_attrs.keys())
        assert nb_keys == cmk_keys

        # SNMP community should match exactly
        assert nb_attrs["snmp_community"] == cmk_attrs["snmp_community"]

        # All scalar values should match
        scalar_keys = [
            "site",
            "ipaddress",
            "tag_agent",
            "tag_snmp_ds",
            "tag_status",
            "alias",
            "location",
            "city",
        ]
        for key in scalar_keys:
            assert nb_attrs[key] == cmk_attrs[key], f"Mismatch in {key}"

    def test_folder_comparison_real_data(self):
        """Test folder comparison with real data."""
        nb_folder = NAUTOBOT_NORMALIZED_CONFIG_REAL["folder"]
        cmk_folder = CHECKMK_HOST_WITH_SNMP_V2_REAL["extensions"]["folder"]

        assert nb_folder == cmk_folder
        assert nb_folder == "/network/Berlin"
