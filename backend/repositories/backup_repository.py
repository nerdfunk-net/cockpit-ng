"""
Backup repository for device backup operations.
"""

from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime


class BackupRepository:
    """Repository for backup-related database operations."""

    async def get_devices_for_backup(
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

        This queries Nautobot API via GraphQL,
        then filters and paginates the results.
        """
        # Import here to avoid circular dependency
        from services.nautobot import nautobot_service

        # Build GraphQL query with filters
        filter_parts = []
        if name:
            filter_parts.append(f'name__ic: "{name}"')
        if role:
            filter_parts.append(f'role: "{role}"')
        if location:
            filter_parts.append(f'location: "{location}"')
        if device_type:
            filter_parts.append(f'device_type: "{device_type}"')
        if status:
            filter_parts.append(f'status: "{status}"')

        filter_string = ", ".join(filter_parts) if filter_parts else ""

        # Build GraphQL query - only include parentheses if there are filters
        devices_query = f"devices({filter_string})" if filter_string else "devices"
        
        query = f"""
        query {{
            {devices_query} {{
                id
                name
                role {{
                    name
                }}
                location {{
                    name
                }}
                device_type {{
                    model
                }}
                status {{
                    name
                }}
                primary_ip4 {{
                    address
                }}
                cf_last_backup
            }}
        }}
        """

        # Get devices from Nautobot
        try:
            result = await nautobot_service.graphql_query(query)
            devices = result.get("data", {}).get("devices", [])
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
