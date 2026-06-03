"""Unit tests for services/checkmk/normalization/common.py."""

from __future__ import annotations

import pytest

from services.checkmk.normalization.common import DeviceData


@pytest.mark.unit
def test_device_data_type_alias_accepts_device_dict() -> None:
    device: DeviceData = {
        "name": "router1",
        "role": {"name": "Router"},
        "custom_fields": {},
    }

    assert device["name"] == "router1"
