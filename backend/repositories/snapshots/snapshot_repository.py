"""
Repository for snapshot executions and results.
"""

from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from core.models import Snapshot, SnapshotResult
from core.database import get_db_session


class SnapshotRepository:
    """Repository for snapshot execution operations."""

    def create_snapshot(
        self,
        name: str,
        description: Optional[str],
        template_id: int,
        template_name: str,
        git_repository_id: int,
        snapshot_path: str,
        executed_by: str,
        device_count: int,
    ) -> Snapshot:
        """
        Create a new snapshot execution record.

        Args:
            name: Snapshot name
            description: Snapshot description
            template_id: Template ID used
            template_name: Template name (snapshot at execution time)
            git_repository_id: Git repository ID for storage
            snapshot_path: Path template for storing results
            executed_by: Username of executor
            device_count: Number of devices to snapshot

        Returns:
            Created snapshot
        """
        db = get_db_session()
        try:
            snapshot = Snapshot(
                name=name,
                description=description,
                template_id=template_id,
                template_name=template_name,
                git_repository_id=git_repository_id,
                snapshot_path=snapshot_path,
                executed_by=executed_by,
                status="pending",
                device_count=device_count,
                success_count=0,
                failed_count=0,
            )
            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)
            return snapshot
        finally:
            db.close()

    def create_result(
        self,
        snapshot_id: int,
        device_name: str,
        device_ip: Optional[str] = None,
    ) -> SnapshotResult:
        """
        Create a snapshot result for a device.

        Args:
            snapshot_id: Snapshot ID
            device_name: Device name
            device_ip: Device IP address

        Returns:
            Created result
        """
        db = get_db_session()
        try:
            result = SnapshotResult(
                snapshot_id=snapshot_id,
                device_name=device_name,
                device_ip=device_ip,
                status="pending",
            )
            db.add(result)
            db.commit()
            db.refresh(result)
            return result
        finally:
            db.close()

    def update_snapshot_status(
        self,
        snapshot_id: int,
        status: str,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
    ) -> Optional[Snapshot]:
        """
        Update snapshot status and timestamps.

        Args:
            snapshot_id: Snapshot ID
            status: New status
            started_at: Start timestamp
            completed_at: Completion timestamp

        Returns:
            Updated snapshot or None
        """
        db = get_db_session()
        try:
            snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).first()
            if snapshot:
                snapshot.status = status
                if started_at:
                    snapshot.started_at = started_at
                if completed_at:
                    snapshot.completed_at = completed_at
                db.commit()
                db.refresh(snapshot)
            return snapshot
        finally:
            db.close()

    def update_result(
        self,
        result_id: int,
        status: str,
        git_file_path: Optional[str] = None,
        git_commit_hash: Optional[str] = None,
        parsed_data: Optional[str] = None,
        error_message: Optional[str] = None,
        started_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
    ) -> Optional[SnapshotResult]:
        """
        Update a snapshot result.

        Args:
            result_id: Result ID
            status: New status
            git_file_path: Path to JSON file in Git
            git_commit_hash: Git commit hash
            parsed_data: JSON string of parsed data
            error_message: Error message if failed
            started_at: Start timestamp
            completed_at: Completion timestamp

        Returns:
            Updated result or None
        """
        db = get_db_session()
        try:
            result = (
                db.query(SnapshotResult).filter(SnapshotResult.id == result_id).first()
            )
            if result:
                result.status = status
                if git_file_path is not None:
                    result.git_file_path = git_file_path
                if git_commit_hash is not None:
                    result.git_commit_hash = git_commit_hash
                if parsed_data is not None:
                    result.parsed_data = parsed_data
                if error_message is not None:
                    result.error_message = error_message
                if started_at:
                    result.started_at = started_at
                if completed_at:
                    result.completed_at = completed_at
                db.commit()
                db.refresh(result)
            return result
        finally:
            db.close()

    def increment_success_count(self, snapshot_id: int) -> None:
        """Increment success count for a snapshot."""
        db = get_db_session()
        try:
            snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).first()
            if snapshot:
                snapshot.success_count += 1
                db.commit()
        finally:
            db.close()

    def increment_failed_count(self, snapshot_id: int) -> None:
        """Increment failed count for a snapshot."""
        db = get_db_session()
        try:
            snapshot = db.query(Snapshot).filter(Snapshot.id == snapshot_id).first()
            if snapshot:
                snapshot.failed_count += 1
                db.commit()
        finally:
            db.close()

    def get_by_id(self, snapshot_id: int) -> Optional[Snapshot]:
        """
        Get snapshot by ID with results.

        Args:
            snapshot_id: Snapshot ID

        Returns:
            Snapshot with results or None
        """
        db = get_db_session()
        try:
            return (
                db.query(Snapshot)
                .options(joinedload(Snapshot.results))
                .filter(Snapshot.id == snapshot_id)
                .first()
            )
        finally:
            db.close()

    def get_all(
        self, executed_by: Optional[str] = None, limit: Optional[int] = None
    ) -> List[Snapshot]:
        """
        Get all snapshots with optional filtering.

        Args:
            executed_by: Filter by executor username
            limit: Limit number of results

        Returns:
            List of snapshots (without results for performance)
        """
        db = get_db_session()
        try:
            query = db.query(Snapshot).order_by(Snapshot.created_at.desc())

            if executed_by:
                query = query.filter(Snapshot.executed_by == executed_by)

            if limit:
                query = query.limit(limit)

            return query.all()
        finally:
            db.close()

    def get_result_by_id(self, result_id: int) -> Optional[SnapshotResult]:
        """
        Get a specific result by ID.

        Args:
            result_id: Result ID

        Returns:
            Result or None
        """
        db = get_db_session()
        try:
            return (
                db.query(SnapshotResult)
                .filter(SnapshotResult.id == result_id)
                .first()
            )
        finally:
            db.close()

    def get_results_by_snapshot(self, snapshot_id: int) -> List[SnapshotResult]:
        """
        Get all results for a snapshot.

        Args:
            snapshot_id: Snapshot ID

        Returns:
            List of results
        """
        db = get_db_session()
        try:
            return (
                db.query(SnapshotResult)
                .filter(SnapshotResult.snapshot_id == snapshot_id)
                .all()
            )
        finally:
            db.close()

    def get_result_by_device(
        self, snapshot_id: int, device_name: str
    ) -> Optional[SnapshotResult]:
        """
        Get result for a specific device in a snapshot.

        Args:
            snapshot_id: Snapshot ID
            device_name: Device name

        Returns:
            Result or None
        """
        db = get_db_session()
        try:
            return (
                db.query(SnapshotResult)
                .filter(
                    SnapshotResult.snapshot_id == snapshot_id,
                    SnapshotResult.device_name == device_name,
                )
                .first()
            )
        finally:
            db.close()
