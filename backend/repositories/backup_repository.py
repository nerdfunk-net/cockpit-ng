"""
Backup repository for device backup operations.
"""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime


class BackupRepository:
    """Repository for backup-related database operations."""

    def get_devices_for_backup(
        self,
        db: Session,
        name: Optional[str] = None,
        role: Optional[str] = None,
        location: Optional[str] = None,
        device_type: Optional[str] = None,
        status: Optional[str] = None,
        last_backup_before: Optional[str] = None,
        last_backup_comparison: Optional[str] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[dict], int]:
        """
        Get devices with backup filtering, sorting, and pagination.
        Returns (devices, total_count).

        This queries Nautobot API via the existing nautobot helper,
        then filters and paginates the results.
        """
        # Import here to avoid circular dependency
        from services.nautobot_helpers.device_service import get_devices_with_filters

        # Build filters dict for Nautobot query
        filters = {}
        if name:
            filters["name"] = name
        if role:
            filters["role"] = role
        if location:
            filters["location"] = location
        if device_type:
            filters["device_type"] = device_type
        if status:
            filters["status"] = status

        # Get devices from Nautobot
        try:
            devices = get_devices_with_filters(filters)
        except Exception:
            # Fallback to empty list if Nautobot unavailable
            devices = []

        # Apply backup date filtering if specified
        if last_backup_before and last_backup_comparison:
            filtered_devices = []
            filter_date = datetime.fromisoformat(last_backup_before)

            for device in devices:
                last_backup = device.get("cf_last_backup")
                if not last_backup or last_backup == "Never":
                    # Include devices never backed up when filtering for old backups
                    if last_backup_comparison in ["lte", "lt"]:
                        filtered_devices.append(device)
                    continue

                try:
                    device_date = datetime.fromisoformat(last_backup)
                    if last_backup_comparison == "lte" and device_date <= filter_date:
                        filtered_devices.append(device)
                    elif last_backup_comparison == "lt" and device_date < filter_date:
                        filtered_devices.append(device)
                except Exception:
                    # If date parsing fails, skip
                    continue

            devices = filtered_devices

        # Apply sorting
        if sort_by:
            reverse = sort_order == "desc"
            if sort_by == "last_backup":
                # Sort by backup date, putting 'Never' at the end
                def backup_sort_key(device):
                    last_backup = device.get("cf_last_backup")
                    if not last_backup or last_backup == "Never":
                        return datetime.min if not reverse else datetime.max
                    try:
                        return datetime.fromisoformat(last_backup)
                    except Exception:
                        return datetime.min if not reverse else datetime.max

                devices = sorted(devices, key=backup_sort_key, reverse=reverse)
            elif sort_by == "name":
                devices = sorted(
                    devices, key=lambda d: d.get("name", "").lower(), reverse=reverse
                )

        # Get total count before pagination
        total_count = len(devices)

        # Apply pagination
        paginated_devices = devices[offset : offset + limit]

        return paginated_devices, total_count

    def get_backup_history(
        self, db: Session, device_id: str, limit: int = 50
    ) -> List[dict]:
        """
        Get backup history for a device from Git repository.

        This queries the Git repository for commit history
        related to the device's configuration files.
        """
        # Import here to avoid circular dependency
        from services.settings.git.shared_utils import get_git_repositories_by_category

        try:
            # Get device config repositories
            repos = get_git_repositories_by_category("device_configs")

            if not repos:
                return []

            # For now, use the first device_configs repository
            repo = repos[0]

            # Get commits that modified files for this device
            history = []

            # Try to find commits in the repo
            try:
                import git

                git_repo = git.Repo(repo.working_dir)

                # Look for files related to this device
                # Common patterns: device_id.txt, device_id/*, etc.
                commits = list(git_repo.iter_commits(max_count=limit))

                for commit in commits:
                    # Check if this commit touched files for this device
                    for item in commit.stats.files:
                        if device_id in item:
                            # Calculate size of changes
                            size_kb = sum(commit.stats.files.values()) / 1024

                            history.append(
                                {
                                    "id": commit.hexsha,
                                    "date": commit.committed_datetime.isoformat(),
                                    "size": f"{size_kb:.1f} KB",
                                    "status": "success",
                                    "commit_hash": commit.hexsha[:8],
                                    "message": commit.message.strip(),
                                }
                            )
                            break

            except Exception:
                # If Git operations fail, return empty list
                pass

            return history[:limit]

        except Exception:
            return []
