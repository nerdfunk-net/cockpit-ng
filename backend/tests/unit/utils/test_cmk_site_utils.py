"""Unit tests for utils/cmk_site_utils.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from utils.cmk_site_utils import (
    _extract_device_ip,
    _match_ip_to_folder,
    _match_ip_to_site,
    get_device_folder,
    get_device_site_from_normalized_data,
    get_monitored_site,
)

_PATCH_CONFIG = "service_factory.build_checkmk_config_service"


def _device(**kwargs: object) -> dict:
    base = {
        "name": "router1",
        "location": {"name": "NYC"},
        "role": {"name": "router"},
        "primary_ip4": {"address": "10.0.0.5/24"},
        "_custom_field_data": {"checkmk_site": "site-b"},
    }
    base.update(kwargs)
    return base


@pytest.mark.unit
def test_extract_device_ip_strips_cidr() -> None:
    assert (
        _extract_device_ip({"primary_ip4": {"address": "192.168.1.1/24"}})
        == "192.168.1.1"
    )
    assert _extract_device_ip({}) == ""


@pytest.mark.unit
def test_match_ip_to_site_finds_cidr() -> None:
    site = _match_ip_to_site("10.0.0.5", {"10.0.0.0/24": "lab-site"})
    assert site == "lab-site"


@pytest.mark.unit
def test_match_ip_to_folder_finds_cidr() -> None:
    folder = _match_ip_to_folder("10.0.0.5", {"10.0.0.0/24": "/lab/{{ name }}"})
    assert folder == "/lab/{{ name }}"


@pytest.mark.unit
def test_get_monitored_site_by_nautobot_custom_field() -> None:
    config = {
        "monitored_site": {
            "by_nautobot": "checkmk_site",
            "default": "cmk",
        }
    }
    mock_cfg = MagicMock()
    mock_cfg.load_checkmk_config.return_value = config
    with patch(_PATCH_CONFIG, return_value=mock_cfg):
        site = get_monitored_site(_device(), checkmk_config=config)

    assert site == "site-b"


@pytest.mark.unit
def test_get_monitored_site_by_name() -> None:
    mock_cfg = MagicMock()
    mock_cfg.load_checkmk_config.return_value = {
        "monitored_site": {
            "by_name": {"router1": "named-site"},
            "default": "cmk",
        }
    }
    with patch(_PATCH_CONFIG, return_value=mock_cfg):
        site = get_monitored_site(_device(), checkmk_config=None)

    assert site == "named-site"


@pytest.mark.unit
def test_get_monitored_site_by_ip() -> None:
    config = {
        "monitored_site": {
            "by_name": {},
            "by_ip": {"10.0.0.0/24": "ip-site"},
            "default": "cmk",
        }
    }
    mock_cfg = MagicMock()
    mock_cfg.load_checkmk_config.return_value = config
    with patch(_PATCH_CONFIG, return_value=mock_cfg):
        site = get_monitored_site(_device(), checkmk_config=config)

    assert site == "ip-site"


@pytest.mark.unit
def test_get_monitored_site_returns_default() -> None:
    config = {"monitored_site": {"default": "default-site"}}
    mock_cfg = MagicMock()
    mock_cfg.load_checkmk_config.return_value = config
    with patch(_PATCH_CONFIG, return_value=mock_cfg):
        site = get_monitored_site({"name": "unknown"}, checkmk_config=config)

    assert site == "default-site"


@pytest.mark.unit
def test_get_device_site_from_normalized_data_uses_attribute() -> None:
    mock_cfg = MagicMock()
    mock_cfg.get_default_site.return_value = "cmk"
    with patch(_PATCH_CONFIG, return_value=mock_cfg):
        site = get_device_site_from_normalized_data({"attributes": {"site": "edge"}})

    assert site == "edge"


@pytest.mark.unit
def test_get_device_folder_by_location() -> None:
    config = {
        "folders": {
            "router": {
                "by_location": {"NYC": "/nyc/{{ name }}"},
                "default": "/",
            }
        }
    }
    with patch(_PATCH_CONFIG, return_value=MagicMock()):
        with patch(
            "utils.cmk_site_utils.parse_folder_value",
            side_effect=lambda template, _data: template.replace(
                "{{ name }}", "router1"
            ),
        ):
            folder = get_device_folder(_device(), checkmk_config=config)

    assert folder == "/nyc/router1"
