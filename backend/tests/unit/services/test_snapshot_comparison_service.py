"""Unit tests for services/network/snapshots/comparison_service.py."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

_PATCH_REPO = "services.network.snapshots.comparison_service.SnapshotRepository"


def _mk_snapshot(id: int, name: str = "snap") -> SimpleNamespace:
    from datetime import datetime

    return SimpleNamespace(
        id=id,
        name=name,
        description=None,
        template_id=None,
        template_name=None,
        git_repository_id=1,
        snapshot_path="snaps/{device_name}.json",
        executed_by="alice",
        status="completed",
        device_count=1,
        success_count=1,
        failed_count=0,
        started_at=None,
        completed_at=None,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )


def _mk_result(
    device_name: str,
    status: str = "success",
    parsed_data: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        device_name=device_name,
        status=status,
        parsed_data=parsed_data,
    )


@pytest.fixture
def svc():
    with patch(_PATCH_REPO):
        from services.network.snapshots.comparison_service import (
            SnapshotComparisonService,
        )

        return SnapshotComparisonService()


@pytest.mark.unit
class TestDeepDiff:
    def test_identical_primitives_returns_none(self, svc):
        assert svc._deep_diff(1, 1) is None
        assert svc._deep_diff("foo", "foo") is None

    def test_different_primitives_returns_value_change(self, svc):
        diff = svc._deep_diff("a", "b")
        assert diff is not None
        assert diff["type"] == "value_change"
        assert diff["old_value"] == "a"
        assert diff["new_value"] == "b"

    def test_type_change_detected(self, svc):
        diff = svc._deep_diff(1, "1")
        assert diff is not None
        assert diff["type"] == "type_change"

    def test_identical_dicts_returns_none(self, svc):
        assert svc._deep_diff({"a": 1}, {"a": 1}) is None

    def test_dict_added_key(self, svc):
        diff = svc._deep_diff({}, {"new_key": "val"})
        assert diff is not None
        assert diff["type"] == "dict_diff"
        changes = diff["changes"]
        assert any(c["type"] == "added" and c["path"] == "new_key" for c in changes)

    def test_dict_removed_key(self, svc):
        diff = svc._deep_diff({"old_key": "val"}, {})
        assert diff is not None
        changes = diff["changes"]
        assert any(c["type"] == "removed" for c in changes)

    def test_dict_value_changed(self, svc):
        diff = svc._deep_diff({"a": 1}, {"a": 2})
        assert diff is not None
        assert diff["changes"][0]["type"] == "value_change"

    def test_identical_lists_returns_none(self, svc):
        assert svc._deep_diff([1, 2, 3], [1, 2, 3]) is None

    def test_different_lists_returns_list_diff(self, svc):
        diff = svc._deep_diff([1, 2], [1, 2, 3])
        assert diff is not None
        assert diff["type"] == "list_diff"
        assert diff["old_length"] == 2
        assert diff["new_length"] == 3

    def test_nested_dict_diff(self, svc):
        d1 = {"outer": {"inner": "old"}}
        d2 = {"outer": {"inner": "new"}}
        diff = svc._deep_diff(d1, d2)
        assert diff is not None
        assert diff["type"] == "dict_diff"
        outer_change = diff["changes"][0]
        assert outer_change["type"] == "dict_diff"
        assert outer_change["changes"][0]["type"] == "value_change"
        assert outer_change["changes"][0]["path"] == "outer.inner"

    def test_path_propagated(self, svc):
        diff = svc._deep_diff({"a": 1}, {"a": 2}, path="root")
        assert diff["changes"][0]["path"] == "root.a"


@pytest.mark.unit
class TestCompareDeviceResults:
    def test_both_missing_returns_unknown(self, svc):
        result = svc._compare_device_results(None, None)
        assert result.device_name == "unknown"

    def test_missing_in_snapshot1(self, svc):
        r2 = _mk_result("router-01")
        result = svc._compare_device_results(None, r2)
        assert result.status == "missing_in_snapshot1"
        assert result.device_name == "router-01"

    def test_missing_in_snapshot2(self, svc):
        r1 = _mk_result("router-01")
        result = svc._compare_device_results(r1, None)
        assert result.status == "missing_in_snapshot2"
        assert result.device_name == "router-01"

    def test_identical_results_status_same(self, svc):
        data = json.dumps({"show version": "Cisco IOS"})
        r1 = _mk_result("router-01", parsed_data=data)
        r2 = _mk_result("router-01", parsed_data=data)
        result = svc._compare_device_results(r1, r2)
        assert result.status == "same"

    def test_different_results_status_different(self, svc):
        r1 = _mk_result("router-01", parsed_data=json.dumps({"cmd": "old"}))
        r2 = _mk_result("router-01", parsed_data=json.dumps({"cmd": "new"}))
        result = svc._compare_device_results(r1, r2)
        assert result.status == "different"

    def test_command_added_in_snapshot2(self, svc):
        r1 = _mk_result("r", parsed_data=json.dumps({}))
        r2 = _mk_result("r", parsed_data=json.dumps({"new_cmd": "output"}))
        result = svc._compare_device_results(r1, r2)
        cmd = result.commands[0]
        assert cmd.status == "added"

    def test_command_removed_from_snapshot1(self, svc):
        r1 = _mk_result("r", parsed_data=json.dumps({"old_cmd": "out"}))
        r2 = _mk_result("r", parsed_data=json.dumps({}))
        result = svc._compare_device_results(r1, r2)
        cmd = result.commands[0]
        assert cmd.status == "removed"

    def test_invalid_json_returns_error(self, svc):
        r1 = _mk_result("router-01", parsed_data="not-json")
        r2 = _mk_result("router-01", parsed_data="{}")
        result = svc._compare_device_results(r1, r2)
        assert result.status == "error"

    def test_null_parsed_data_treated_as_empty(self, svc):
        r1 = _mk_result("router-01", parsed_data=None)
        r2 = _mk_result("router-01", parsed_data=None)
        result = svc._compare_device_results(r1, r2)
        assert result.status == "same"


@pytest.mark.unit
class TestCompareSnapshots:
    def _patch_repo(self, svc, snap1_results, snap2_results):
        svc.snapshot_repo.get_by_id.side_effect = [
            _mk_snapshot(1, "snap-a"),
            _mk_snapshot(2, "snap-b"),
        ]
        svc.snapshot_repo.get_results_by_snapshot.side_effect = [
            snap1_results,
            snap2_results,
        ]

    def _request(self, snap1_id=1, snap2_id=2, device_filter=None):
        from models.snapshots import SnapshotCompareRequest

        return SnapshotCompareRequest(
            snapshot_id_1=snap1_id,
            snapshot_id_2=snap2_id,
            device_filter=device_filter,
        )

    def test_raises_if_snapshot1_not_found(self, svc):
        svc.snapshot_repo.get_by_id.side_effect = [None, _mk_snapshot(2)]
        from models.snapshots import SnapshotCompareRequest

        req = SnapshotCompareRequest(snapshot_id_1=999, snapshot_id_2=2)
        with pytest.raises(ValueError, match="999"):
            svc.compare_snapshots(req)

    def test_raises_if_snapshot2_not_found(self, svc):
        svc.snapshot_repo.get_by_id.side_effect = [_mk_snapshot(1), None]
        from models.snapshots import SnapshotCompareRequest

        req = SnapshotCompareRequest(snapshot_id_1=1, snapshot_id_2=999)
        with pytest.raises(ValueError, match="999"):
            svc.compare_snapshots(req)

    def test_compare_two_identical_snapshots(self, svc):
        data = json.dumps({"show ver": "Cisco"})
        r = _mk_result("router-01", parsed_data=data)

        svc.snapshot_repo.get_by_id.side_effect = [
            _mk_snapshot(1),
            _mk_snapshot(2),
        ]
        svc.snapshot_repo.get_results_by_snapshot.side_effect = [[r], [r]]

        from models.snapshots import SnapshotCompareRequest

        req = SnapshotCompareRequest(snapshot_id_1=1, snapshot_id_2=2)
        response = svc.compare_snapshots(req)

        assert response.summary["same_count"] == 1
        assert response.summary["different_count"] == 0

    def test_device_filter_applied(self, svc):
        data = json.dumps({})
        r1 = _mk_result("router-01", parsed_data=data)
        r2 = _mk_result("router-02", parsed_data=data)

        svc.snapshot_repo.get_by_id.side_effect = [
            _mk_snapshot(1),
            _mk_snapshot(2),
        ]
        svc.snapshot_repo.get_results_by_snapshot.side_effect = [
            [r1, r2],
            [r1, r2],
        ]

        from models.snapshots import SnapshotCompareRequest

        req = SnapshotCompareRequest(
            snapshot_id_1=1, snapshot_id_2=2, device_filter=["router-01"]
        )
        response = svc.compare_snapshots(req)

        assert response.summary["total_devices"] == 1
        assert response.devices[0].device_name == "router-01"

    def test_missing_device_counted_in_summary(self, svc):
        data = json.dumps({})
        r1 = _mk_result("only-in-1", parsed_data=data)
        r2 = _mk_result("only-in-2", parsed_data=data)

        svc.snapshot_repo.get_by_id.side_effect = [
            _mk_snapshot(1),
            _mk_snapshot(2),
        ]
        svc.snapshot_repo.get_results_by_snapshot.side_effect = [[r1], [r2]]

        from models.snapshots import SnapshotCompareRequest

        req = SnapshotCompareRequest(snapshot_id_1=1, snapshot_id_2=2)
        response = svc.compare_snapshots(req)

        assert response.summary["missing_in_snapshot1"] == 1
        assert response.summary["missing_in_snapshot2"] == 1
