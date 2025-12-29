"""
Template Repository - handles database operations for templates.
"""

from typing import List, Optional
from sqlalchemy import func, or_, and_
from core.models import Template, TemplateVersion
from core.database import get_db_session
from repositories.base import BaseRepository
import logging

logger = logging.getLogger(__name__)


class TemplateRepository(BaseRepository[Template]):
    """Repository for template CRUD operations."""

    def __init__(self):
        super().__init__(Template)

    def get_by_name(self, name: str, active_only: bool = True) -> Optional[Template]:
        """Get template by name."""
        session = get_db_session()
        try:
            query = session.query(Template).filter(Template.name == name)
            if active_only:
                query = query.filter(Template.is_active)
            return query.first()
        finally:
            session.close()

    def list_templates(
        self,
        category: Optional[str] = None,
        source: Optional[str] = None,
        active_only: bool = True,
        username: Optional[str] = None,
    ) -> List[Template]:
        """
        List templates with optional filtering.
        Returns:
        - Global templates (scope='global')
        - Private templates owned by the user (scope='private' AND created_by=username)
        """
        session = get_db_session()
        try:
            query = session.query(Template)

            # Active filter
            if active_only:
                query = query.filter(Template.is_active)

            # Scope and ownership filter
            if username:
                query = query.filter(
                    or_(
                        Template.scope == "global",
                        and_(
                            Template.scope == "private", Template.created_by == username
                        ),
                    )
                )
            else:
                # No username provided, only show global templates
                query = query.filter(Template.scope == "global")

            # Category filter
            if category:
                query = query.filter(Template.category == category)

            # Source filter
            if source:
                query = query.filter(Template.source == source)

            # Order by name
            query = query.order_by(Template.name)

            return query.all()
        finally:
            session.close()

    def search_templates(
        self,
        query_text: str,
        search_content: bool = False,
        username: Optional[str] = None,
    ) -> List[Template]:
        """
        Search templates by name, description, category, or optionally content.
        Respects scope and ownership.
        """
        session = get_db_session()
        try:
            search_pattern = f"%{query_text}%"

            query = session.query(Template).filter(Template.is_active)

            # Scope and ownership
            if username:
                query = query.filter(
                    or_(
                        Template.scope == "global",
                        and_(
                            Template.scope == "private", Template.created_by == username
                        ),
                    )
                )
            else:
                query = query.filter(Template.scope == "global")

            # Search conditions
            search_conditions = [
                Template.name.ilike(search_pattern),
                Template.description.ilike(search_pattern),
                Template.category.ilike(search_pattern),
            ]

            if search_content:
                search_conditions.append(Template.content.ilike(search_pattern))

            query = query.filter(or_(*search_conditions)).order_by(Template.name)

            return query.all()
        finally:
            session.close()

    def get_categories(self) -> List[str]:
        """Get all unique template categories (active templates only)."""
        session = get_db_session()
        try:
            result = (
                session.query(Template.category)
                .filter(
                    and_(
                        Template.is_active,
                        Template.category.isnot(None),
                        Template.category != "",
                    )
                )
                .distinct()
                .order_by(Template.category)
                .all()
            )
            return [row[0] for row in result]
        finally:
            session.close()

    def get_active_count(self) -> int:
        """Count active templates."""
        session = get_db_session()
        try:
            return (
                session.query(func.count(Template.id))
                .filter(Template.is_active)
                .scalar()
            )
        finally:
            session.close()

    def get_total_count(self) -> int:
        """Count all templates."""
        session = get_db_session()
        try:
            return session.query(func.count(Template.id)).scalar()
        finally:
            session.close()

    def get_categories_count(self) -> int:
        """Count distinct categories."""
        session = get_db_session()
        try:
            return (
                session.query(func.count(func.distinct(Template.category)))
                .filter(Template.category.isnot(None))
                .scalar()
            )
        finally:
            session.close()


class TemplateVersionRepository(BaseRepository[TemplateVersion]):
    """Repository for template version history."""

    def __init__(self):
        super().__init__(TemplateVersion)

    def get_versions_by_template_id(self, template_id: int) -> List[TemplateVersion]:
        """Get all versions for a template, ordered by version number descending."""
        session = get_db_session()
        try:
            return (
                session.query(TemplateVersion)
                .filter(TemplateVersion.template_id == template_id)
                .order_by(TemplateVersion.version_number.desc())
                .all()
            )
        finally:
            session.close()

    def get_max_version_number(self, template_id: int) -> int:
        """Get the maximum version number for a template."""
        session = get_db_session()
        try:
            max_version = (
                session.query(func.max(TemplateVersion.version_number))
                .filter(TemplateVersion.template_id == template_id)
                .scalar()
            )
            return max_version or 0
        finally:
            session.close()
