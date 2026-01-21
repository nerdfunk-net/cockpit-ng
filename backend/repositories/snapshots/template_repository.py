"""
Repository for snapshot command templates.
"""

from typing import List, Optional
from sqlalchemy.orm import joinedload
from core.models import SnapshotCommandTemplate, SnapshotCommand
from core.database import get_db_session


class SnapshotTemplateRepository:
    """Repository for snapshot command template operations."""

    def create_template(
        self,
        name: str,
        description: Optional[str],
        scope: str,
        created_by: str,
        commands: List[dict],
    ) -> SnapshotCommandTemplate:
        """
        Create a new snapshot command template with commands.

        Args:
            name: Template name
            description: Template description
            scope: Template scope ('global' or 'private')
            created_by: Username of creator
            commands: List of command dicts with 'command', 'use_textfsm', 'order'

        Returns:
            Created template with commands
        """
        db = get_db_session()
        try:
            # Create template
            template = SnapshotCommandTemplate(
                name=name,
                description=description,
                scope=scope,
                created_by=created_by,
                is_active=True,
            )
            db.add(template)
            db.flush()  # Get template ID

            # Create commands
            for cmd_data in commands:
                command = SnapshotCommand(
                    template_id=template.id,
                    command=cmd_data["command"],
                    use_textfsm=cmd_data.get("use_textfsm", True),
                    order=cmd_data.get("order", 0),
                )
                db.add(command)

            db.commit()
            db.refresh(template)
            # Eagerly load commands relationship before closing session
            _ = template.commands
            return template
        finally:
            db.close()

    def get_by_id(self, template_id: int) -> Optional[SnapshotCommandTemplate]:
        """
        Get template by ID with commands.

        Args:
            template_id: Template ID

        Returns:
            Template with commands or None
        """
        db = get_db_session()
        try:
            return (
                db.query(SnapshotCommandTemplate)
                .options(joinedload(SnapshotCommandTemplate.commands))
                .filter(SnapshotCommandTemplate.id == template_id)
                .first()
            )
        finally:
            db.close()

    def get_all(
        self, created_by: Optional[str] = None, scope: Optional[str] = None
    ) -> List[SnapshotCommandTemplate]:
        """
        Get all templates with optional filtering.

        Args:
            created_by: Filter by creator username
            scope: Filter by scope ('global' or 'private')

        Returns:
            List of templates with commands
        """
        db = get_db_session()
        try:
            query = db.query(SnapshotCommandTemplate).options(
                joinedload(SnapshotCommandTemplate.commands)
            )

            if created_by:
                # Show global templates + user's private templates
                query = query.filter(
                    (SnapshotCommandTemplate.scope == "global")
                    | (
                        (SnapshotCommandTemplate.scope == "private")
                        & (SnapshotCommandTemplate.created_by == created_by)
                    )
                )
            elif scope:
                query = query.filter(SnapshotCommandTemplate.scope == scope)

            return query.filter(SnapshotCommandTemplate.is_active).all()
        finally:
            db.close()

    def update_template(
        self,
        template_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        scope: Optional[str] = None,
        commands: Optional[List[dict]] = None,
    ) -> Optional[SnapshotCommandTemplate]:
        """
        Update an existing template.

        Args:
            template_id: Template ID
            name: New name (optional)
            description: New description (optional)
            scope: New scope (optional)
            commands: New commands list (optional, replaces all existing)

        Returns:
            Updated template or None
        """
        db = get_db_session()
        try:
            template = (
                db.query(SnapshotCommandTemplate)
                .filter(SnapshotCommandTemplate.id == template_id)
                .first()
            )
            if not template:
                return None

            # Update template fields
            if name is not None:
                template.name = name
            if description is not None:
                template.description = description
            if scope is not None:
                template.scope = scope

            # Replace commands if provided
            if commands is not None:
                # Delete existing commands
                db.query(SnapshotCommand).filter(
                    SnapshotCommand.template_id == template_id
                ).delete()

                # Add new commands
                for cmd_data in commands:
                    command = SnapshotCommand(
                        template_id=template.id,
                        command=cmd_data["command"],
                        use_textfsm=cmd_data.get("use_textfsm", True),
                        order=cmd_data.get("order", 0),
                    )
                    db.add(command)

            db.commit()
            db.refresh(template)
            # Eagerly load commands relationship before closing session
            _ = template.commands
            return template
        finally:
            db.close()

    def delete_template(self, template_id: int) -> bool:
        """
        Soft delete a template (set is_active=False).

        Args:
            template_id: Template ID

        Returns:
            True if deleted, False if not found
        """
        db = get_db_session()
        try:
            template = (
                db.query(SnapshotCommandTemplate)
                .filter(SnapshotCommandTemplate.id == template_id)
                .first()
            )
            if template:
                template.is_active = False
                db.commit()
                return True
            return False
        finally:
            db.close()

    def get_by_name(
        self, name: str, created_by: Optional[str] = None
    ) -> Optional[SnapshotCommandTemplate]:
        """
        Get template by name.

        Args:
            name: Template name
            created_by: Filter by creator (for duplicate checking)

        Returns:
            Template or None
        """
        db = get_db_session()
        try:
            query = (
                db.query(SnapshotCommandTemplate)
                .options(joinedload(SnapshotCommandTemplate.commands))
                .filter(SnapshotCommandTemplate.name == name)
                .filter(SnapshotCommandTemplate.is_active)
            )

            if created_by:
                query = query.filter(
                    (SnapshotCommandTemplate.scope == "global")
                    | (
                        (SnapshotCommandTemplate.scope == "private")
                        & (SnapshotCommandTemplate.created_by == created_by)
                    )
                )

            return query.first()
        finally:
            db.close()
