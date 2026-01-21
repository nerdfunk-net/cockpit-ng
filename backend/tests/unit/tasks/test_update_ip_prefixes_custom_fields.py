"""
Unit tests for IP prefix update task - custom fields handling.
"""

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


class TestTagsHandling:
    """Test tags handling in IP prefix updates."""

    def test_tags_comma_separated_converted_to_list(self):
        """Test that comma-separated tags are converted to a list."""
        row = {
            "prefix": "192.168.1.0/24",
            "description": "Test",
            "tags": "production,core,monitored",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert result["description"] == "Test"
        assert "tags" in result
        assert result["tags"] == ["production", "core", "monitored"]
        assert isinstance(result["tags"], list)

    def test_tags_with_whitespace_are_trimmed(self):
        """Test that whitespace around tag names is trimmed."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "production , core  ,  monitored  ",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert result["tags"] == ["production", "core", "monitored"]

    def test_single_tag_converted_to_list(self):
        """Test that a single tag is converted to a list."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "production",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert result["tags"] == ["production"]
        assert isinstance(result["tags"], list)

    def test_empty_tags_default_replace_mode_clears_tags(self):
        """Test that empty tags in default replace mode clears all tags."""
        row = {
            "prefix": "192.168.1.0/24",
            "description": "Test",
            "tags": "",
        }
        headers = list(row.keys())
        existing_prefix = {}

        # Default mode is replace, so empty tags should send empty array
        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert "tags" in result
        assert result["tags"] == []
        assert result["description"] == "Test"

    def test_tags_with_empty_elements_filtered(self):
        """Test that empty elements in comma-separated tags are filtered out."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "production,,core,  ,monitored",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        # Empty elements should be filtered out
        assert result["tags"] == ["production", "core", "monitored"]
        assert len(result["tags"]) == 3

    def test_tags_with_special_characters(self):
        """Test that tags with hyphens and underscores work correctly."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "network-core,high_priority,prod-env",
        }
        headers = list(row.keys())
        existing_prefix = {}

        result = _prepare_prefix_update_data(row, headers, existing_prefix)

        assert result["tags"] == ["network-core", "high_priority", "prod-env"]

    def test_tags_merge_mode_combines_with_existing(self):
        """Test that tags merge mode combines CSV tags with existing tags."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "new-tag,another-tag",
        }
        headers = list(row.keys())
        existing_prefix = {
            "tags": [
                {"name": "existing-tag"},
                {"name": "old-tag"},
            ]
        }

        result = _prepare_prefix_update_data(
            row, headers, existing_prefix, tags_mode="merge"
        )

        # Should contain both existing and new tags
        assert set(result["tags"]) == {
            "existing-tag",
            "old-tag",
            "new-tag",
            "another-tag",
        }

    def test_tags_merge_mode_no_duplicates(self):
        """Test that tags merge mode doesn't create duplicates."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "production,core",
        }
        headers = list(row.keys())
        existing_prefix = {
            "tags": [
                {"name": "production"},  # Duplicate
                {"name": "monitoring"},
            ]
        }

        result = _prepare_prefix_update_data(
            row, headers, existing_prefix, tags_mode="merge"
        )

        # Should deduplicate
        assert set(result["tags"]) == {"production", "core", "monitoring"}
        assert len(result["tags"]) == 3

    def test_tags_replace_mode_ignores_existing(self):
        """Test that tags replace mode ignores existing tags."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "new-tag,another-tag",
        }
        headers = list(row.keys())
        existing_prefix = {
            "tags": [
                {"name": "existing-tag"},
                {"name": "old-tag"},
            ]
        }

        result = _prepare_prefix_update_data(
            row, headers, existing_prefix, tags_mode="replace"
        )

        # Should only have CSV tags
        assert set(result["tags"]) == {"new-tag", "another-tag"}
        assert len(result["tags"]) == 2

    def test_tags_replace_mode_with_empty_value_clears_all(self):
        """Test that replace mode with empty tags value clears all tags."""
        row = {
            "prefix": "192.168.1.0/24",
            "description": "Test",
            "tags": "",  # Empty tags
        }
        headers = list(row.keys())
        existing_prefix = {
            "tags": [
                {"name": "existing-tag"},
                {"name": "old-tag"},
            ]
        }

        result = _prepare_prefix_update_data(
            row, headers, existing_prefix, tags_mode="replace"
        )

        # Should have empty tags array to clear existing tags
        assert "tags" in result
        assert result["tags"] == []
        assert result["description"] == "Test"

    def test_tags_merge_mode_with_empty_value_keeps_existing(self):
        """Test that merge mode with empty tags value keeps existing tags unchanged."""
        row = {
            "prefix": "192.168.1.0/24",
            "description": "Test",
            "tags": "",  # Empty tags
        }
        headers = list(row.keys())
        existing_prefix = {
            "tags": [
                {"name": "existing-tag"},
                {"name": "old-tag"},
            ]
        }

        result = _prepare_prefix_update_data(
            row, headers, existing_prefix, tags_mode="merge"
        )

        # Should NOT have tags field (skip empty value in merge mode)
        assert "tags" not in result
        assert result["description"] == "Test"

    def test_tags_replace_mode_with_whitespace_only_clears_all(self):
        """Test that replace mode with whitespace-only tags value clears all tags."""
        row = {
            "prefix": "192.168.1.0/24",
            "tags": "   ",  # Whitespace only
        }
        headers = list(row.keys())
        existing_prefix = {"tags": [{"name": "existing-tag"}]}

        result = _prepare_prefix_update_data(
            row, headers, existing_prefix, tags_mode="replace"
        )

        # Should have empty tags array
        assert result["tags"] == []
