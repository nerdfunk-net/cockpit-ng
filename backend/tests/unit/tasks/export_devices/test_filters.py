"""Unit tests for tasks/export_devices/filters.py."""

from __future__ import annotations

import pytest

from tasks.export_devices.filters import filter_device_properties


@pytest.mark.unit
class TestFilterDeviceProperties:
    def _device(self, **kwargs):
        base = {
            "name": "router-01",
            "status": "active",
            "platform": "cisco_ios",
            "primary_ip4": {
                "address": "10.0.0.1/24",
                "parent": {"namespace": {"name": "global"}},
            },
            "custom_fields": {"owner": "team-a"},
        }
        base.update(kwargs)
        return base

    def test_returns_empty_list_for_empty_input(self):
        assert filter_device_properties([], ["name"]) == []

    def test_single_property_present(self):
        devices = [self._device()]
        result = filter_device_properties(devices, ["name"])
        assert result == [{"name": "router-01"}]

    def test_multiple_properties(self):
        devices = [self._device()]
        result = filter_device_properties(devices, ["name", "status"])
        assert result == [{"name": "router-01", "status": "active"}]

    def test_missing_property_returns_none(self):
        devices = [self._device()]
        result = filter_device_properties(devices, ["nonexistent"])
        assert result == [{"nonexistent": None}]

    def test_namespace_extraction_full_path(self):
        devices = [self._device()]
        result = filter_device_properties(devices, ["namespace"])
        assert result == [{"namespace": "global"}]

    def test_namespace_missing_primary_ip4(self):
        device = self._device()
        device["primary_ip4"] = None
        result = filter_device_properties([device], ["namespace"])
        assert result == [{"namespace": None}]

    def test_namespace_missing_parent(self):
        device = self._device()
        device["primary_ip4"] = {"address": "10.0.0.1/24"}
        result = filter_device_properties([device], ["namespace"])
        assert result == [{"namespace": None}]

    def test_namespace_missing_ns_key(self):
        device = self._device()
        device["primary_ip4"] = {"address": "10.0.0.1/24", "parent": {}}
        result = filter_device_properties([device], ["namespace"])
        assert result == [{"namespace": None}]

    def test_namespace_primary_ip4_not_dict(self):
        device = self._device()
        device["primary_ip4"] = "10.0.0.1/24"
        result = filter_device_properties([device], ["namespace"])
        assert result == [{"namespace": None}]

    def test_mixed_properties_and_namespace(self):
        devices = [self._device()]
        result = filter_device_properties(devices, ["name", "namespace", "status"])
        assert result == [
            {"name": "router-01", "namespace": "global", "status": "active"}
        ]

    def test_multiple_devices(self):
        d1 = self._device(name="r1")
        d2 = self._device(name="r2", status="planned")
        result = filter_device_properties([d1, d2], ["name", "status"])
        assert result == [
            {"name": "r1", "status": "active"},
            {"name": "r2", "status": "planned"},
        ]

    def test_empty_properties_list(self):
        devices = [self._device()]
        result = filter_device_properties(devices, [])
        assert result == [{}]
