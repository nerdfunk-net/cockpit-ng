"""
Service for snapshot command template management.
"""

from typing import List, Optional
from repositories.snapshots import SnapshotTemplateRepository
from models.snapshots import (
    SnapshotCommandTemplateCreate,
    SnapshotCommandTemplateUpdate,
    SnapshotCommandTemplateResponse,
)


class SnapshotTemplateService:
    """Service for snapshot template operations."""

    def __init__(self):
        self.repo = SnapshotTemplateRepository()

    def create_template(
        self, template_data: SnapshotCommandTemplateCreate, created_by: str
    ) -> SnapshotCommandTemplateResponse:
        """
        Create a new snapshot command template.

        Args:
            template_data: Template creation data
            created_by: Username of creator

        Returns:
            Created template

        Raises:
            ValueError: If template name already exists for this user
        """
        # Check for duplicate name
        existing = self.repo.get_by_name(template_data.name, created_by)
        if existing:
            if existing.scope == "global" or existing.created_by == created_by:
                raise ValueError(
                    f"Template with name '{template_data.name}' already exists"
                )

        # Create template
        commands = [cmd.dict() for cmd in template_data.commands]
        template = self.repo.create_template(
            name=template_data.name,
            description=template_data.description,
            scope=template_data.scope,
            created_by=created_by,
            commands=commands,
        )

        return SnapshotCommandTemplateResponse.from_orm(template)

    def get_template(self, template_id: int) -> Optional[SnapshotCommandTemplateResponse]:
        """
        Get a template by ID.

        Args:
            template_id: Template ID

        Returns:
            Template or None
        """
        template = self.repo.get_by_id(template_id)
        if template:
            return SnapshotCommandTemplateResponse.from_orm(template)
        return None

    def list_templates(
        self, username: Optional[str] = None
    ) -> List[SnapshotCommandTemplateResponse]:
        """
        List all templates accessible by user.

        Args:
            username: Username to filter by (shows global + user's private)

        Returns:
            List of templates
        """
        templates = self.repo.get_all(created_by=username)
        return [SnapshotCommandTemplateResponse.from_orm(t) for t in templates]

    def update_template(
        self, template_id: int, template_data: SnapshotCommandTemplateUpdate, username: str
    ) -> Optional[SnapshotCommandTemplateResponse]:
        """
        Update a template.

        Args:
            template_id: Template ID
            template_data: Update data
            username: Username (for permission check)

        Returns:
            Updated template or None

        Raises:
            ValueError: If user doesn't own template
        """
        # Check ownership
        existing = self.repo.get_by_id(template_id)
        if not existing:
            return None

        if existing.scope == "private" and existing.created_by != username:
            raise ValueError("You don't have permission to update this template")

        # Prepare update data
        update_dict = template_data.dict(exclude_unset=True)
        commands = None
        if "commands" in update_dict and update_dict["commands"] is not None:
            commands = [cmd.dict() for cmd in update_dict["commands"]]
            del update_dict["commands"]

        # Update template
        template = self.repo.update_template(
            template_id=template_id, commands=commands, **update_dict
        )

        if template:
            return SnapshotCommandTemplateResponse.from_orm(template)
        return None

    def delete_template(self, template_id: int, username: str) -> bool:
        """
        Delete a template (soft delete).

        Args:
            template_id: Template ID
            username: Username (for permission check)

        Returns:
            True if deleted, False if not found

        Raises:
            ValueError: If user doesn't own template
        """
        # Check ownership
        existing = self.repo.get_by_id(template_id)
        if not existing:
            return False

        if existing.scope == "private" and existing.created_by != username:
            raise ValueError("You don't have permission to delete this template")

        return self.repo.delete_template(template_id)
