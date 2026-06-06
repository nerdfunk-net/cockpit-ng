"""Unit tests for services/background_jobs/diff_viewer_jobs.py."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from services.background_jobs.diff_viewer_jobs import (
    _build_diff_device,
    get_diff_between_nb_checkmk_task,
)
from tests.helpers.asyncio_run import (
    mock_asyncio_run_raising,
    mock_asyncio_run_returning,
)


@pytest.mark.unit
def test_build_diff_device_both_sources() -> None:
    nb = {
        "id": "uuid-1",
        "name": "Router1",
        "primary_ip4": {"address": "10.0.0.1/24"},
        "role": {"name": "core"},
        "location": {"name": "DC1"},
        "status": {"name": "active"},
        "device_type": {"model": "ISR"},
    }
    cmk = {
        "extensions": {
            "folder": "~dc1",
            "attributes": {
                "alias": "Router1",
                "ipaddress": "10.0.0.1",
                "tag_location": "dc1",
            },
        }
    }

    device = _build_diff_device("Router1", "both", nb_device=nb, cmk_host=cmk)

    assert device["source"] == "both"
    assert device["nautobot_id"] == "uuid-1"
    assert device["role"] == "core"
    assert device["checkmk_folder"] == "~dc1"
    assert device["checkmk_ip"] == "10.0.0.1"


@pytest.mark.unit
def test_build_diff_device_checkmk_only_uses_tag_location() -> None:
    cmk = {
        "extensions": {
            "folder": "/",
            "attributes": {"tag_location": "edge"},
        }
    }

    device = _build_diff_device("host1", "checkmk", cmk_host=cmk)

    assert device["location"] == "edge"
    assert device["source"] == "checkmk"


@pytest.mark.unit
def test_get_diff_between_nb_checkmk_task_categorizes_devices() -> None:
    nb_devices = [
        {"id": "1", "name": "Shared"},
        {"id": "2", "name": "NbOnly"},
    ]
    cmk_hosts = [
        {"id": "Shared"},
        {"id": "CmkOnly"},
    ]

    with (
        patch(
            "services.background_jobs.diff_viewer_jobs.asyncio.run",
            side_effect=mock_asyncio_run_returning(nb_devices),
        ),
        patch(
            "services.background_jobs.diff_viewer_jobs._fetch_checkmk_hosts",
            return_value=cmk_hosts,
        ),
    ):
        with patch.object(get_diff_between_nb_checkmk_task, "update_state"):
            out = get_diff_between_nb_checkmk_task.run()

    assert out["success"] is True
    assert out["total_nautobot"] == 2
    assert out["total_checkmk"] == 2
    assert len(out["nautobot_only"]) == 1
    assert len(out["checkmk_only"]) == 1
    assert out["nautobot_only"][0]["name"] == "NbOnly"


@pytest.mark.unit
def test_get_diff_between_nb_checkmk_task_failure() -> None:
    with (
        patch(
            "services.background_jobs.diff_viewer_jobs.asyncio.run",
            side_effect=mock_asyncio_run_raising(RuntimeError("nautobot down")),
        ),
        patch.object(get_diff_between_nb_checkmk_task, "update_state"),
    ):
        out = get_diff_between_nb_checkmk_task.run()

    assert out["success"] is False
    assert "nautobot down" in out["error"]
