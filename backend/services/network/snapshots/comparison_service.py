"""
Service for comparing snapshots.
"""

import json
import logging
from typing import Dict, Any, Optional
from repositories.snapshots import SnapshotRepository
from models.snapshots import (
    SnapshotCompareRequest,
    SnapshotCompareResponse,
    DeviceComparisonResult,
    CommandDiff,
    SnapshotListResponse,
)

logger = logging.getLogger(__name__)


class SnapshotComparisonService:
    """Service for comparing two snapshots."""

    def __init__(self):
        self.snapshot_repo = SnapshotRepository()

    def _deep_diff(
        self, data1: Any, data2: Any, path: str = ""
    ) -> Optional[Dict[str, Any]]:
        """
        Perform deep comparison of two data structures.

        Args:
            data1: First data structure
            data2: Second data structure
            path: Current path in structure (for nested diffs)

        Returns:
            Diff dictionary or None if identical
        """
        if not isinstance(data1, type(data2)):
            return {
                "type": "type_change",
                "path": path,
                "old_type": type(data1).__name__,
                "new_type": type(data2).__name__,
                "old_value": str(data1),
                "new_value": str(data2),
            }

        if isinstance(data1, dict):
            diff = {"type": "dict_diff", "path": path, "changes": []}

            all_keys = set(data1.keys()) | set(data2.keys())
            for key in all_keys:
                key_path = f"{path}.{key}" if path else key

                if key not in data1:
                    diff["changes"].append(
                        {
                            "type": "added",
                            "path": key_path,
                            "value": data2[key],
                        }
                    )
                elif key not in data2:
                    diff["changes"].append(
                        {
                            "type": "removed",
                            "path": key_path,
                            "value": data1[key],
                        }
                    )
                else:
                    nested_diff = self._deep_diff(data1[key], data2[key], key_path)
                    if nested_diff:
                        diff["changes"].append(nested_diff)

            return diff if diff["changes"] else None

        elif isinstance(data1, list):
            if data1 != data2:
                return {
                    "type": "list_diff",
                    "path": path,
                    "old_length": len(data1),
                    "new_length": len(data2),
                    "old_value": data1,
                    "new_value": data2,
                }
            return None

        else:
            # Primitive types
            if data1 != data2:
                return {
                    "type": "value_change",
                    "path": path,
                    "old_value": data1,
                    "new_value": data2,
                }
            return None

    def _compare_device_results(
        self, result1: Optional[Any], result2: Optional[Any]
    ) -> DeviceComparisonResult:
        """
        Compare snapshot results for a single device.

        Args:
            result1: Result from first snapshot
            result2: Result from second snapshot

        Returns:
            Device comparison result
        """
        device_name = (
            result1.device_name
            if result1
            else result2.device_name
            if result2
            else "unknown"
        )

        # Handle missing results
        if not result1:
            return DeviceComparisonResult(
                device_name=device_name,
                status="missing_in_snapshot1",
                snapshot1_status=None,
                snapshot2_status=result2.status if result2 else None,
                commands=[],
            )

        if not result2:
            return DeviceComparisonResult(
                device_name=device_name,
                status="missing_in_snapshot2",
                snapshot1_status=result1.status if result1 else None,
                snapshot2_status=None,
                commands=[],
            )

        # Both results exist - compare parsed data
        try:
            data1 = json.loads(result1.parsed_data) if result1.parsed_data else {}
            data2 = json.loads(result2.parsed_data) if result2.parsed_data else {}
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON for {device_name}: {e}")
            return DeviceComparisonResult(
                device_name=device_name,
                status="error",
                snapshot1_status=result1.status,
                snapshot2_status=result2.status,
                commands=[],
            )

        # Get all commands from both snapshots
        all_commands = set(data1.keys()) | set(data2.keys())
        command_diffs = []

        for command in all_commands:
            if command not in data1:
                command_diffs.append(
                    CommandDiff(
                        command=command,
                        status="added",
                        diff={"added_in_snapshot2": data2[command]},
                    )
                )
            elif command not in data2:
                command_diffs.append(
                    CommandDiff(
                        command=command,
                        status="removed",
                        diff={"removed_from_snapshot1": data1[command]},
                    )
                )
            else:
                # Compare command outputs
                diff = self._deep_diff(data1[command], data2[command], command)
                if diff:
                    command_diffs.append(
                        CommandDiff(
                            command=command,
                            status="modified",
                            diff=diff,
                        )
                    )
                else:
                    command_diffs.append(
                        CommandDiff(
                            command=command,
                            status="unchanged",
                            diff=None,
                        )
                    )

        # Determine overall device status
        if all(cmd.status == "unchanged" for cmd in command_diffs):
            overall_status = "same"
        else:
            overall_status = "different"

        return DeviceComparisonResult(
            device_name=device_name,
            status=overall_status,
            snapshot1_status=result1.status,
            snapshot2_status=result2.status,
            commands=command_diffs,
        )

    def compare_snapshots(
        self, request: SnapshotCompareRequest
    ) -> SnapshotCompareResponse:
        """
        Compare two snapshots.

        Args:
            request: Comparison request

        Returns:
            Comparison response with diffs

        Raises:
            ValueError: If snapshots not found
        """
        # Get both snapshots
        snapshot1 = self.snapshot_repo.get_by_id(request.snapshot_id_1)
        snapshot2 = self.snapshot_repo.get_by_id(request.snapshot_id_2)

        if not snapshot1:
            raise ValueError(f"Snapshot {request.snapshot_id_1} not found")
        if not snapshot2:
            raise ValueError(f"Snapshot {request.snapshot_id_2} not found")

        # Get all results for both snapshots
        results1 = {
            r.device_name: r
            for r in self.snapshot_repo.get_results_by_snapshot(snapshot1.id)
        }
        results2 = {
            r.device_name: r
            for r in self.snapshot_repo.get_results_by_snapshot(snapshot2.id)
        }

        # Apply device filter if provided
        if request.device_filter:
            filtered_results1 = {
                name: results1[name]
                for name in request.device_filter
                if name in results1
            }
            filtered_results2 = {
                name: results2[name]
                for name in request.device_filter
                if name in results2
            }
            results1 = filtered_results1
            results2 = filtered_results2

        # Get all device names from both snapshots
        all_devices = set(results1.keys()) | set(results2.keys())

        # Compare each device
        device_comparisons = []
        for device_name in sorted(all_devices):
            result1 = results1.get(device_name)
            result2 = results2.get(device_name)

            comparison = self._compare_device_results(result1, result2)
            device_comparisons.append(comparison)

        # Calculate summary stats
        summary = {
            "total_devices": len(device_comparisons),
            "same_count": sum(1 for d in device_comparisons if d.status == "same"),
            "different_count": sum(
                1 for d in device_comparisons if d.status == "different"
            ),
            "missing_in_snapshot1": sum(
                1 for d in device_comparisons if d.status == "missing_in_snapshot1"
            ),
            "missing_in_snapshot2": sum(
                1 for d in device_comparisons if d.status == "missing_in_snapshot2"
            ),
        }

        return SnapshotCompareResponse(
            snapshot1=SnapshotListResponse.from_orm(snapshot1),
            snapshot2=SnapshotListResponse.from_orm(snapshot2),
            devices=device_comparisons,
            summary=summary,
        )
