#!/usr/bin/env python3
"""
Migration Script: Move Template Content from File System to Database

This script ensures all template content stored in the file system is
migrated to the PostgreSQL database.

Run this BEFORE removing file system operations from template_manager.py
"""

import os
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repositories.template_repository import TemplateRepository
import hashlib

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def migrate_templates_to_database():
    """
    Migrate all template content from files to database.

    For each template in database:
    1. Check if content is already in database
    2. If not, try to load from file system
    3. Update database with file content
    4. Report results
    """
    logger.info("=" * 80)
    logger.info("Starting Template Migration to Database")
    logger.info("=" * 80)

    repo = TemplateRepository()
    templates = repo.list_templates(active_only=False)

    templates_path = Path(__file__).parent.parent / "data" / "templates"

    if not templates_path.exists():
        logger.warning(f"Template directory not found: {templates_path}")
        logger.info("No file-based templates to migrate.")
        return

    stats = {
        "total": len(templates),
        "already_in_db": 0,
        "migrated_from_file": 0,
        "no_content": 0,
        "errors": 0,
    }

    for template in templates:
        logger.info(f"\n--- Processing Template ID {template.id}: {template.name} ---")

        # Skip Git templates (they don't use file storage)
        if template.source == "git":
            logger.info("  Skipping Git template")
            stats["already_in_db"] += 1
            continue

        # Check if content already in database
        if template.content and len(template.content.strip()) > 0:
            logger.info(
                f"  ✓ Content already in database ({len(template.content)} chars)"
            )
            stats["already_in_db"] += 1
            continue

        # Try to load from file system
        logger.info(f"  Searching for file in: {templates_path}")
        content = _find_and_load_template_file(templates_path, template)

        if content:
            try:
                # Update database with file content
                content_hash = hashlib.sha256(content.encode()).hexdigest()
                repo.update(template.id, content=content, content_hash=content_hash)
                logger.info(f"  ✓ Migrated from file ({len(content)} chars)")
                stats["migrated_from_file"] += 1
            except Exception as e:
                logger.error(f"  ✗ Error updating database: {e}")
                stats["errors"] += 1
        else:
            logger.warning("  ! No content found (neither in DB nor file)")
            stats["no_content"] += 1

    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("Migration Summary")
    logger.info("=" * 80)
    logger.info(f"Total templates processed:        {stats['total']}")
    logger.info(f"Already in database:              {stats['already_in_db']}")
    logger.info(f"Migrated from file system:        {stats['migrated_from_file']}")
    logger.info(f"No content found (warning):       {stats['no_content']}")
    logger.info(f"Errors:                           {stats['errors']}")
    logger.info("=" * 80)

    if stats["migrated_from_file"] > 0:
        logger.info(
            f"\n✓ Successfully migrated {stats['migrated_from_file']} templates to database"
        )

    if stats["errors"] > 0:
        logger.warning(f"\n! {stats['errors']} errors occurred during migration")
        return False

    logger.info("\n✓ Migration completed successfully!")
    logger.info("\nNext steps:")
    logger.info("1. Verify templates are accessible in the application")
    logger.info("2. Test template rendering functionality")
    logger.info("3. Once verified, you can safely delete files from ./data/templates/")
    logger.info("4. Update template_manager.py to remove file system operations")

    return True


def _find_and_load_template_file(templates_path: Path, template) -> str:
    """
    Find and load template file from file system.

    Tries multiple file extensions and naming patterns.
    """
    safe_name = template.name.replace(" ", "_").replace("/", "_")
    template_id = template.id

    # Determine possible extensions
    extensions = [".txt", ".j2", ".textfsm"]
    if template.filename:
        ext = os.path.splitext(template.filename)[1]
        if ext:
            extensions.insert(0, ext)
    elif "." in template.name:
        ext = os.path.splitext(template.name)[1]
        if ext:
            extensions.insert(0, ext)

    # Try all combinations
    for ext in extensions:
        filename = f"{template_id}_{safe_name}{ext}"
        filepath = templates_path / filename

        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                logger.info(f"  Found file: {filename}")
                return content
            except Exception as e:
                logger.error(f"  Error reading file {filename}: {e}")

    return None


if __name__ == "__main__":
    try:
        success = migrate_templates_to_database()
        sys.exit(0 if success else 1)
    except Exception as e:
        logger.error(f"Migration failed with error: {e}", exc_info=True)
        sys.exit(1)
