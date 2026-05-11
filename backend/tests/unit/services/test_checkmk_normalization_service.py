"""Unit tests for CheckMK normalization services.

All tests run offline — no real CheckMK or Nautobot instance required.
A minimal FakeConfigService provides controllable YAML configuration so that
each normalizer's logic can be exercised in full isolation.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch, MagicMock

from services.checkmk.normalization.ip_normalizer import IPNormalizer
from services.checkmk.normalization.snmp_normalizer import SNMPNormalizer
from services.checkmk.normalization.field_normalizer import FieldNormalizer
from services.checkmk.normalization.tag_normalizer import TagNormalizer
from services.checkmk.normalization.device_normalizer import DeviceNormalizationService
from models.nb2cmk import DeviceExtensions


# ── Helpers ────────────────────────────────────────────────────────────────────

_PATCH_CONFIG = "service_factory.build_checkmk_config_service"
_PATCH_SITE = "services.checkmk.normalization.device_normalizer.get_monitored_site"
_PATCH_FOLDER = "services.checkmk.normalization.device_normalizer.get_device_folder"


class _FakeConfig:
    """Minimal in-memory config service for normalization tests."""

    def __init__(self, cfg: dict | None = None, snmp_mapping: dict | None = None):
        self._cfg = cfg or {}
        self._snmp = snmp_mapping or {}

    def load_checkmk_config(self, force_reload: bool = False) -> dict:
        return self._cfg

    def load_snmp_mapping(self, force_reload: bool = False) -> dict:
        return self._snmp

    def get_ignore_attributes(self) -> list:
        return self._cfg.get("ignore_attributes", [])

    def get_comparison_keys(self) -> list:
        return self._cfg.get("comparison_keys", ["attributes", "folder"])

    def reload_config(self) -> None:
        pass


def _ext() -> DeviceExtensions:
    """Return a blank DeviceExtensions for use in tests."""
    return DeviceExtensions(folder="", attributes={}, internal={})


# ══════════════════════════════════════════════════════════════════════════════
# IPNormalizer
# ══════════════════════════════════════════════════════════════════════════════


class TestIPNormalizer:
    """IPNormalizer has no external dependencies — no patching required."""

    def setup_method(self) -> None:
        self.norm = IPNormalizer()

    # ── process_ip_address ────────────────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_process_ip_strips_cidr_notation(self) -> None:
        """IP with CIDR suffix is stripped to the bare host address."""
        ext = _ext()
        self.norm.process_ip_address(
            {"primary_ip4": {"address": "192.168.1.1/24"}}, ext
        )
        assert ext.attributes["ipaddress"] == "192.168.1.1"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_process_ip_without_cidr_stored_unchanged(self) -> None:
        """IP without CIDR notation is stored exactly as provided."""
        ext = _ext()
        self.norm.process_ip_address({"primary_ip4": {"address": "10.0.0.1"}}, ext)
        assert ext.attributes["ipaddress"] == "10.0.0.1"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_process_ip_missing_primary_ip4_gives_empty_string(self) -> None:
        """Device without primary_ip4 → ipaddress attribute set to empty string."""
        ext = _ext()
        self.norm.process_ip_address({}, ext)
        assert ext.attributes["ipaddress"] == ""

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_process_ip_null_address_gives_empty_string(self) -> None:
        """primary_ip4 present but address is None → ipaddress set to empty string."""
        ext = _ext()
        self.norm.process_ip_address({"primary_ip4": {"address": None}}, ext)
        assert ext.attributes["ipaddress"] == ""

    # ── extract_device_ip ─────────────────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_extract_device_ip_strips_cidr(self) -> None:
        """extract_device_ip removes the CIDR suffix."""
        device = {"primary_ip4": {"address": "10.1.2.3/32"}}
        assert self.norm.extract_device_ip(device) == "10.1.2.3"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_extract_device_ip_no_ip_returns_empty_string(self) -> None:
        """No IP configured → extract_device_ip returns empty string."""
        assert self.norm.extract_device_ip({}) == ""

    # ── process_ip_based_attributes ───────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_process_ip_based_attributes_cidr_match_merges_attrs(self) -> None:
        """Device IP inside a configured CIDR range → mapped attributes are merged."""
        ext = _ext()
        by_ip = {"10.0.0.0/8": {"tag_location": "dc1"}}
        self.norm.process_ip_based_attributes("10.0.0.5", by_ip, ext)
        assert ext.attributes.get("tag_location") == "dc1"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_process_ip_based_attributes_no_cidr_match_leaves_attrs_empty(self) -> None:
        """Device IP outside every configured CIDR → no attributes added."""
        ext = _ext()
        by_ip = {"192.168.0.0/24": {"tag_location": "dc2"}}
        self.norm.process_ip_based_attributes("10.0.0.5", by_ip, ext)
        assert "tag_location" not in ext.attributes

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_process_ip_based_attributes_exact_ip_match_merges_attrs(self) -> None:
        """Device IP matches a single-IP entry → attributes merged."""
        ext = _ext()
        by_ip = {"10.0.0.5": {"special": "yes"}}
        self.norm.process_ip_based_attributes("10.0.0.5", by_ip, ext)
        assert ext.attributes.get("special") == "yes"


# ══════════════════════════════════════════════════════════════════════════════
# SNMPNormalizer
# ══════════════════════════════════════════════════════════════════════════════


class TestSNMPNormalizer:
    def _make(self, snmp_mapping: dict | None = None) -> SNMPNormalizer:
        fake = _FakeConfig(snmp_mapping=snmp_mapping or {})
        with patch(_PATCH_CONFIG, return_value=fake):
            return SNMPNormalizer()

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_no_snmp_credentials_returns_early(self) -> None:
        """Device without snmp_credentials in custom fields → no SNMP attributes added."""
        norm = self._make()
        ext = _ext()
        norm.process_snmp_config({"name": "router1"}, ext)
        assert "snmp_community" not in ext.attributes
        assert "tag_agent" not in ext.attributes

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_snmp_v2_community_sets_community_and_tags(self) -> None:
        """SNMPv2 credentials → snmp_community dict with v1_v2_community type and tags."""
        norm = self._make({"my-v2": {"version": "v2", "community": "public"}})
        ext = _ext()
        norm.process_snmp_config(
            {"_custom_field_data": {"snmp_credentials": "my-v2"}}, ext
        )
        assert ext.attributes["snmp_community"] == {
            "type": "v1_v2_community",
            "community": "public",
        }
        assert ext.attributes["tag_snmp_ds"] == "snmp-v2"
        assert ext.attributes["tag_agent"] == "no-agent"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_snmp_v3_auth_privacy_sets_full_community_dict(self) -> None:
        """SNMPv3 with auth+privacy → full v3 snmp_community dict."""
        mapping = {
            "v3-cred": {
                "version": "v3",
                "type": "v3_auth_privacy",
                "auth_protocol_long": "md5",
                "username": "admin",
                "auth_password": "secret",
                "privacy_protocol_long": "des",
                "privacy_password": "priv-secret",
            }
        }
        norm = self._make(mapping)
        ext = _ext()
        norm.process_snmp_config(
            {"_custom_field_data": {"snmp_credentials": "v3-cred"}}, ext
        )
        community = ext.attributes["snmp_community"]
        assert community["type"] == "v3_auth_privacy"
        assert community["auth_protocol"] == "md5"
        assert community["security_name"] == "admin"
        assert community["auth_password"] == "secret"
        assert community["privacy_protocol"] == "des"
        assert community["privacy_password"] == "priv-secret"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_snmp_v3_auth_no_privacy_removes_privacy_keys(self) -> None:
        """SNMPv3 auth-no-privacy type → privacy_protocol and privacy_password absent."""
        mapping = {
            "v3-no-priv": {
                "version": "v3",
                "type": "v3_auth_no_privacy",
                "auth_protocol_long": "sha",
                "username": "user1",
                "auth_password": "authpw",
                "privacy_protocol_long": "aes",
                "privacy_password": "privpw",
            }
        }
        norm = self._make(mapping)
        ext = _ext()
        norm.process_snmp_config(
            {"_custom_field_data": {"snmp_credentials": "v3-no-priv"}}, ext
        )
        community = ext.attributes["snmp_community"]
        assert "privacy_protocol" not in community
        assert "privacy_password" not in community
        assert community["auth_protocol"] == "sha"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_unknown_credentials_key_sets_no_agent_tag(self) -> None:
        """Credentials key absent from mapping → tag_agent=no-agent, no snmp_community."""
        norm = self._make({"known-cred": {"version": "v2", "community": "public"}})
        ext = _ext()
        norm.process_snmp_config(
            {"_custom_field_data": {"snmp_credentials": "unknown-cred"}}, ext
        )
        assert "snmp_community" not in ext.attributes
        assert ext.attributes["tag_agent"] == "no-agent"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_integer_version_treated_as_v2(self) -> None:
        """YAML may parse unquoted version numbers as int — 2 should be treated as v2."""
        norm = self._make({"int-cred": {"version": 2, "community": "secret"}})
        ext = _ext()
        norm.process_snmp_config(
            {"_custom_field_data": {"snmp_credentials": "int-cred"}}, ext
        )
        assert ext.attributes["snmp_community"]["type"] == "v1_v2_community"


# ══════════════════════════════════════════════════════════════════════════════
# FieldNormalizer
# ══════════════════════════════════════════════════════════════════════════════


class TestFieldNormalizer:
    def _make(self, mapping: dict | None = None) -> FieldNormalizer:
        fake = _FakeConfig(cfg={"mapping": mapping or {}})
        with patch(_PATCH_CONFIG, return_value=fake):
            return FieldNormalizer()

    # ── process_field_mappings ────────────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_simple_field_mapped_to_checkmk_attribute(self) -> None:
        """Top-level field 'name' mapped to CheckMK attribute 'alias'."""
        norm = self._make({"name": "alias"})
        ext = _ext()
        norm.process_field_mappings({"name": "router1"}, ext)
        assert ext.attributes["alias"] == "router1"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_dot_notation_extracts_nested_value(self) -> None:
        """Dot-notation path 'location.name' extracts nested string."""
        norm = self._make({"location.name": "alias"})
        ext = _ext()
        norm.process_field_mappings({"location": {"name": "DC1"}}, ext)
        assert ext.attributes["alias"] == "DC1"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_missing_field_is_silently_skipped(self) -> None:
        """Field not present in device data → attribute not added."""
        norm = self._make({"nonexistent_field": "alias"})
        ext = _ext()
        norm.process_field_mappings({"name": "router1"}, ext)
        assert "alias" not in ext.attributes

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_nested_object_with_name_key_extracts_name(self) -> None:
        """Dict value containing a 'name' key → the name string is used."""
        norm = self._make({"role": "checkmk_role"})
        ext = _ext()
        norm.process_field_mappings({"role": {"name": "Router", "id": "abc"}}, ext)
        assert ext.attributes["checkmk_role"] == "Router"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_empty_mapping_config_adds_no_attributes(self) -> None:
        """No mapping configured → attributes dict stays empty."""
        norm = self._make({})
        ext = _ext()
        norm.process_field_mappings({"name": "router1"}, ext)
        assert ext.attributes == {}

    # ── extract_field_value ───────────────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_extract_field_value_top_level_field(self) -> None:
        """Simple top-level field is returned directly."""
        norm = self._make()
        assert norm.extract_field_value({"name": "mydevice"}, "name") == "mydevice"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_extract_field_value_nested_dot_notation(self) -> None:
        """Dot-notation resolves through nested dicts."""
        norm = self._make()
        assert (
            norm.extract_field_value({"role": {"name": "Switch"}}, "role.name")
            == "Switch"
        )

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_extract_field_value_missing_path_returns_none(self) -> None:
        """Path that cannot be resolved returns None."""
        norm = self._make()
        assert norm.extract_field_value({"role": {}}, "role.name") is None


# ══════════════════════════════════════════════════════════════════════════════
# TagNormalizer
# ══════════════════════════════════════════════════════════════════════════════


class TestTagNormalizer:
    def _make(self, cfg: dict | None = None) -> TagNormalizer:
        fake = _FakeConfig(cfg=cfg or {})
        with patch(_PATCH_CONFIG, return_value=fake):
            field_norm = FieldNormalizer()
            ip_norm = IPNormalizer()
            return TagNormalizer(field_norm, ip_norm)

    # ── process_cf2htg_mappings ───────────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_cf2htg_maps_custom_field_to_tag(self) -> None:
        """Custom field value → tag_<htg_name> attribute set."""
        norm = self._make({"cf2htg": {"snmp_credentials": "snmp_group"}})
        ext = _ext()
        norm.process_cf2htg_mappings(
            {"name": "sw1", "_custom_field_data": {"snmp_credentials": "v2-public"}},
            ext,
        )
        assert ext.attributes["tag_snmp_group"] == "v2-public"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_cf2htg_empty_value_is_not_added(self) -> None:
        """Empty custom field value → tag not added."""
        norm = self._make({"cf2htg": {"env": "environment"}})
        ext = _ext()
        norm.process_cf2htg_mappings(
            {"name": "sw1", "_custom_field_data": {"env": ""}}, ext
        )
        assert "tag_environment" not in ext.attributes

    # ── process_tags2htg_mappings ─────────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_tags2htg_present_tag_sets_true(self) -> None:
        """Device has the mapped tag → tag_<htg_name> = 'true'."""
        norm = self._make({"tags2htg": {"monitored": "monitoring_group"}})
        ext = _ext()
        norm.process_tags2htg_mappings(
            {"name": "sw1", "tags": [{"name": "monitored"}]}, ext
        )
        assert ext.attributes["tag_monitoring_group"] == "true"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_tags2htg_absent_tag_leaves_attr_unset(self) -> None:
        """Device lacks the mapped tag → attribute not added."""
        norm = self._make({"tags2htg": {"monitored": "monitoring_group"}})
        ext = _ext()
        norm.process_tags2htg_mappings(
            {"name": "sw1", "tags": [{"name": "other-tag"}]}, ext
        )
        assert "tag_monitoring_group" not in ext.attributes

    # ── process_additional_attributes ─────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_additional_attributes_by_name_merged(self) -> None:
        """Device name matches a by_name entry → extra attributes merged in."""
        norm = self._make(
            {"additional_attributes": {"by_name": {"router1": {"tag_special": "yes"}}}}
        )
        ext = _ext()
        norm.process_additional_attributes({"name": "router1"}, ext)
        assert ext.attributes["tag_special"] == "yes"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_additional_attributes_by_ip_cidr_match_merged(self) -> None:
        """Device IP inside a configured CIDR → mapped attributes merged."""
        norm = self._make(
            {
                "additional_attributes": {
                    "by_ip": {"10.0.0.0/8": {"tag_datacenter": "dc1"}}
                }
            }
        )
        ext = _ext()
        device = {"name": "sw1", "primary_ip4": {"address": "10.1.2.3/24"}}
        norm.process_additional_attributes(device, ext)
        assert ext.attributes["tag_datacenter"] == "dc1"

    # ── process_attr2htg_mappings ─────────────────────────────────────────────

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_attr2htg_maps_nautobot_attribute_to_tag(self) -> None:
        """Nautobot attribute value via dot notation → tag_<htg_name> set."""
        norm = self._make({"attr2htg": {"role.name": "device_role"}})
        ext = _ext()
        norm.process_attr2htg_mappings({"name": "sw1", "role": {"name": "Switch"}}, ext)
        assert ext.attributes["tag_device_role"] == "Switch"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_attr2htg_missing_attribute_skipped(self) -> None:
        """Attribute not found in device data → tag not added."""
        norm = self._make({"attr2htg": {"nonexistent": "some_group"}})
        ext = _ext()
        norm.process_attr2htg_mappings({"name": "sw1"}, ext)
        assert "tag_some_group" not in ext.attributes


# ══════════════════════════════════════════════════════════════════════════════
# DeviceNormalizationService
# ══════════════════════════════════════════════════════════════════════════════


class TestDeviceNormalizationService:
    """Tests for the main normalization orchestrator.

    DeviceNormalizationService creates all sub-normalizers in __init__. We patch
    service_factory once during construction so all four service_factory calls
    (SNMPNormalizer, FieldNormalizer, TagNormalizer, self) receive the same fake
    config. Utility functions (get_monitored_site, get_device_folder) are patched
    per normalize_device call because they are only invoked then.
    """

    def _make_service(
        self, cfg: dict | None = None, snmp_mapping: dict | None = None
    ) -> DeviceNormalizationService:
        fake = _FakeConfig(cfg=cfg or {}, snmp_mapping=snmp_mapping or {})
        with patch(_PATCH_CONFIG, return_value=fake):
            return DeviceNormalizationService()

    def _normalize(
        self,
        svc: DeviceNormalizationService,
        device_data: dict,
        site: str = "prod",
        folder: str = "/dc1",
    ) -> "DeviceExtensions":
        with (
            patch(_PATCH_SITE, return_value=site),
            patch(_PATCH_FOLDER, return_value=folder),
        ):
            return svc.normalize_device(device_data)

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_raises_value_error_on_empty_data(self) -> None:
        """normalize_device with empty dict raises ValueError with 'empty' in message."""
        svc = self._make_service()
        with (
            patch(_PATCH_SITE, return_value="prod"),
            patch(_PATCH_FOLDER, return_value="/dc1"),
        ):
            with pytest.raises(ValueError, match="empty"):
                svc.normalize_device({})

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_sets_hostname_in_internal(self) -> None:
        """Device name is stored as 'hostname' in the internal dict."""
        svc = self._make_service()
        result = self._normalize(
            svc, {"name": "router1", "primary_ip4": {"address": "10.0.0.1/24"}}
        )
        assert result.internal["hostname"] == "router1"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_strips_cidr_from_primary_ip(self) -> None:
        """primary_ip4 address has CIDR suffix removed before storing in attributes."""
        svc = self._make_service()
        result = self._normalize(
            svc, {"name": "router1", "primary_ip4": {"address": "192.168.1.100/28"}}
        )
        assert result.attributes["ipaddress"] == "192.168.1.100"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_extracts_metadata_into_internal(self) -> None:
        """Role, status, and location names are stored in the internal section."""
        svc = self._make_service()
        result = self._normalize(
            svc,
            {
                "name": "sw1",
                "role": {"name": "Switch"},
                "status": {"name": "Active"},
                "location": {"name": "DC1"},
            },
        )
        assert result.internal["role"] == "Switch"
        assert result.internal["status"] == "Active"
        assert result.internal["location"] == "DC1"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_uses_folder_from_utility(self) -> None:
        """Folder is determined by get_device_folder utility and stored on extensions."""
        svc = self._make_service()
        result = self._normalize(svc, {"name": "sw1"}, folder="/custom/folder")
        assert result.folder == "/custom/folder"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_applies_cf2htg_config(self) -> None:
        """cf2htg configuration from YAML is applied during normalization."""
        svc = self._make_service(cfg={"cf2htg": {"env": "environment"}})
        result = self._normalize(
            svc,
            {
                "name": "router1",
                "primary_ip4": {"address": "10.0.0.1/24"},
                "_custom_field_data": {"env": "production"},
            },
        )
        assert result.attributes["tag_environment"] == "production"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_applies_snmp_v2_config(self) -> None:
        """SNMP v2 credentials resolved through snmp_mapping config."""
        snmp_mapping = {"v2-cred": {"version": "v2", "community": "public"}}
        svc = self._make_service(snmp_mapping=snmp_mapping)
        result = self._normalize(
            svc,
            {
                "name": "router1",
                "primary_ip4": {"address": "10.0.0.1/24"},
                "_custom_field_data": {"snmp_credentials": "v2-cred"},
            },
        )
        assert result.attributes["tag_agent"] == "no-agent"
        assert result.attributes["tag_snmp_ds"] == "snmp-v2"

    @pytest.mark.unit
    @pytest.mark.checkmk
    def test_normalize_device_config_load_failure_raises_value_error(self) -> None:
        """Failure in load_checkmk_config propagates as ValueError."""
        failing_cfg = _FakeConfig()
        failing_cfg.load_checkmk_config = MagicMock(
            side_effect=FileNotFoundError("checkmk.yaml not found")
        )
        with patch(_PATCH_CONFIG, return_value=failing_cfg):
            svc = DeviceNormalizationService()
        # Inject failing config so normalize_device hits it on first call
        svc._config = failing_cfg

        with (
            patch(_PATCH_SITE, return_value="prod"),
            patch(_PATCH_FOLDER, return_value="/dc1"),
        ):
            with pytest.raises(
                ValueError, match="Failed to load CheckMK configuration"
            ):
                svc.normalize_device({"name": "router1"})
