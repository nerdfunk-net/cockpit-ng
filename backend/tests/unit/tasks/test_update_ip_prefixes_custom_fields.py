"""
Unit tests for IP prefix update task - custom fields handling.
"""

import pytest
from tasks.update_ip_prefixes_from_csv_task import _prepare_prefix_update_data


class TestCustomFieldsHandling:
    """Test custom fields handling in IP prefix updates."""

    def test_custom_fields_are_grouped_correctly(self):
        """Test that cf_ prefixed fields are grouped under custom_fields."""
        row = {
            "prefix": "192.168.1.0/24",
            "namespace__name": "Global",
            "description": "Test prefix",
            "cf_vlan_id": "100",
            "cf_network_type": "production",
            "cf_cost_center": "IT-001",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        # Regular field should be in root
        assert result["description"] == "Test prefix"

        # Custom fields should be grouped under custom_fields
        assert "custom_fields" in result
        assert result["custom_fields"]["vlan_id"] == "100"
        assert result["custom_fields"]["network_type"] == "production"
        assert result["custom_fields"]["cost_center"] == "IT-001"

        # cf_ prefixed fields should not be in root
        assert "cf_vlan_id" not in result
        assert "cf_network_type" not in result
        assert "cf_cost_center" not in result

    def test_custom_fields_with_boolean_values(self):
        """Test that boolean values in custom fields are converted correctly."""
        row = {
            "prefix": "192.168.1.0/24",
            "cf_is_critical": "true",
            "cf_is_monitored": "false",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert "custom_fields" in result
        assert result["custom_fields"]["is_critical"] is True
        assert result["custom_fields"]["is_monitored"] is False

    def test_custom_fields_with_null_values(self):
        """Test that NULL values in custom fields are handled correctly."""
        row = {
            "prefix": "192.168.1.0/24",
            "cf_optional_field": "NULL",
            "cf_another_field": "NOOBJECT",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert "custom_fields" in result
        assert result["custom_fields"]["optional_field"] is None
        assert result["custom_fields"]["another_field"] is None

    def test_empty_custom_fields_are_skipped(self):
        """Test that empty custom field values are skipped."""
        row = {
            "prefix": "192.168.1.0/24",
            "description": "Test",
            "cf_empty_field": "",
            "cf_populated_field": "value",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert "custom_fields" in result
        # Empty field should not be included
        assert "empty_field" not in result["custom_fields"]
        # Populated field should be included
        assert result["custom_fields"]["populated_field"] == "value"

    def test_no_custom_fields_in_result_when_none_present(self):
        """Test that custom_fields key is not added when no custom fields are present."""
        row = {
            "prefix": "192.168.1.0/24",
            "description": "Test prefix",
            "status__name": "Active",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        # Should have regular fields
        assert result["description"] == "Test prefix"
        assert result["status"] == "Active"

        # Should not have custom_fields key at all
        assert "custom_fields" not in result

    def test_mixed_fields_and_custom_fields(self):
        """Test that regular fields and custom fields coexist correctly."""
        row = {
            "prefix": "192.168.1.0/24",
            "namespace__name": "Global",
            "description": "Test prefix",
            "status__name": "Active",
            "cf_vlan_id": "100",
            "type": "network",
            "cf_network_type": "production",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        # Regular fields
        assert result["description"] == "Test prefix"
        assert result["status"] == "Active"
        assert result["type"] == "network"

        # Custom fields grouped separately
        assert "custom_fields" in result
        assert result["custom_fields"]["vlan_id"] == "100"
        assert result["custom_fields"]["network_type"] == "production"

        # Should have exactly 2 custom fields
        assert len(result["custom_fields"]) == 2

    def test_excluded_fields_are_not_included(self):
        """Test that excluded fields are properly filtered out."""
        row = {
            "id": "uuid-123",
            "prefix": "192.168.1.0/24",
            "namespace__name": "Global",
            "namespace": "global-id",
            "description": "Test",
            "object_type": "ipam.prefix",
            "created": "2024-01-01",
            "cf_vlan_id": "100",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        # Excluded fields should not be present
        assert "id" not in result
        assert "prefix" not in result
        assert "namespace__name" not in result
        assert "namespace" not in result
        assert "object_type" not in result
        assert "created" not in result

        # Valid fields should be present
        assert result["description"] == "Test"
        assert "custom_fields" in result
        assert result["custom_fields"]["vlan_id"] == "100"
