"""
Template Management for Cockpit
Handles template storage, retrieval, and management operations
"""

from __future__ import annotations
import sqlite3
import os
import logging
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import hashlib
from pathlib import Path

logger = logging.getLogger(__name__)


class TemplateManager:
    """Manages configuration templates in SQLite database and file system"""

    def __init__(self, db_path: str = None, storage_path: str = None):
        if db_path is None:
            # Use data/settings directory for persistence across containers
            settings_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'settings')
            os.makedirs(settings_dir, exist_ok=True)
            self.db_path = os.path.join(settings_dir, 'cockpit_templates.db')
        else:
            self.db_path = db_path

        if storage_path is None:
            # Use data/templates directory for file storage
            self.storage_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'templates')
            os.makedirs(self.storage_path, exist_ok=True)
        else:
            self.storage_path = storage_path

        # Initialize database
        self.init_database()

    def init_database(self) -> bool:
        """Initialize the templates database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Create templates table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS templates (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        source TEXT NOT NULL CHECK(source IN ('git', 'file', 'webeditor')),
                        template_type TEXT NOT NULL DEFAULT 'jinja2' CHECK(template_type IN ('jinja2', 'text', 'yaml', 'json', 'textfsm')),
                        category TEXT,
                        description TEXT,

                        -- Git-specific fields
                        git_repo_url TEXT,
                        git_branch TEXT DEFAULT 'main',
                        git_username TEXT,
                        git_token TEXT,
                        git_path TEXT,
                        git_verify_ssl BOOLEAN DEFAULT 1,

                        -- File/WebEditor-specific fields
                        content TEXT,
                        filename TEXT,
                        content_hash TEXT,

                        -- Metadata
                        variables TEXT DEFAULT '{}',  -- JSON string
                        tags TEXT DEFAULT '[]',       -- JSON string

                        -- Status
                        is_active BOOLEAN DEFAULT 1,
                        last_sync TIMESTAMP,
                        sync_status TEXT,

                        -- Timestamps
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Create template_versions table for history
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS template_versions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        template_id INTEGER NOT NULL,
                        version_number INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        content_hash TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        created_by TEXT,
                        change_notes TEXT,
                        FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE
                    )
                ''')

                # Create indexes for performance
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_templates_source ON templates(source)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id)')

                # Create unique index for active template names
                cursor.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_active_name ON templates(name) WHERE is_active = 1')

                conn.commit()
                logger.info(f"Templates database initialized at {self.db_path}")
                # Ensure schema upgrades (e.g., allow 'textfsm' in template_type)
                self._ensure_schema_upgrades(conn)
                return True

        except sqlite3.Error as e:
            logger.error(f"Template database initialization failed: {e}")
            return False

    def _ensure_schema_upgrades(self, conn: sqlite3.Connection) -> None:
        """Apply in-place schema upgrades if existing DB is missing new constraints."""
        try:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='templates'")
            row = cur.fetchone()
            if not row or not row['sql']:
                return
            create_sql = row['sql']
            if "'textfsm'" in create_sql:
                return  # already upgraded
            # Migrate templates table to include 'textfsm' in CHECK constraint
            logger.info("Upgrading 'templates' table to allow template_type 'textfsm'")
            cur.execute("PRAGMA foreign_keys=OFF;")
            cur.execute("BEGIN TRANSACTION;")
            # Create new table with updated CHECK
            cur.execute('''
                CREATE TABLE IF NOT EXISTS templates_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    source TEXT NOT NULL CHECK(source IN ('git', 'file', 'webeditor')),
                    template_type TEXT NOT NULL DEFAULT 'jinja2' CHECK(template_type IN ('jinja2', 'text', 'yaml', 'json', 'textfsm')),
                    category TEXT,
                    description TEXT,
                    git_repo_url TEXT,
                    git_branch TEXT DEFAULT 'main',
                    git_username TEXT,
                    git_token TEXT,
                    git_path TEXT,
                    git_verify_ssl BOOLEAN DEFAULT 1,
                    content TEXT,
                    filename TEXT,
                    content_hash TEXT,
                    variables TEXT DEFAULT '{}',
                    tags TEXT DEFAULT '[]',
                    is_active BOOLEAN DEFAULT 1,
                    last_sync TIMESTAMP,
                    sync_status TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Copy data
            cur.execute('''
                INSERT INTO templates_new (
                    id, name, source, template_type, category, description,
                    git_repo_url, git_branch, git_username, git_token, git_path, git_verify_ssl,
                    content, filename, content_hash,
                    variables, tags, is_active, last_sync, sync_status, created_at, updated_at
                )
                SELECT 
                    id, name, source, template_type, category, description,
                    git_repo_url, git_branch, git_username, git_token, git_path, git_verify_ssl,
                    content, filename, content_hash,
                    variables, tags, is_active, last_sync, sync_status, created_at, updated_at
                FROM templates
            ''')
            # Drop old indexes
            cur.execute("DROP INDEX IF EXISTS idx_templates_name")
            cur.execute("DROP INDEX IF EXISTS idx_templates_source")
            cur.execute("DROP INDEX IF EXISTS idx_templates_category")
            cur.execute("DROP INDEX IF EXISTS idx_templates_active")
            cur.execute("DROP INDEX IF EXISTS idx_templates_active_name")
            # Drop old table and rename
            cur.execute("DROP TABLE templates")
            cur.execute("ALTER TABLE templates_new RENAME TO templates")
            # Recreate indexes
            cur.execute('CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_templates_source ON templates(source)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active)')
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_active_name ON templates(name) WHERE is_active = 1")
            cur.execute("COMMIT;")
            cur.execute("PRAGMA foreign_keys=ON;")
            logger.info("Templates table upgrade complete")
        except Exception as e:
            logger.error(f"Schema upgrade failed: {e}")
            try:
                cur.execute("ROLLBACK;")
            except Exception:
                pass

    def create_template(self, template_data: Dict[str, Any]) -> Optional[int]:
        """Create a new template"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Validate required fields
                if not template_data.get('name'):
                    raise ValueError("Template name is required")

                if not template_data.get('source'):
                    raise ValueError("Template source is required")

                # Check for existing active template with same name
                cursor.execute('SELECT id FROM templates WHERE name = ? AND is_active = 1', (template_data['name'],))
                existing = cursor.fetchone()
                if existing:
                    raise ValueError(f"Template with name '{template_data['name']}' already exists")

                # Prepare data
                now = datetime.now(timezone.utc).isoformat()
                variables_json = json.dumps(template_data.get('variables', {}))
                tags_json = json.dumps(template_data.get('tags', []))

                # Handle content based on source
                content = template_data.get('content', '')
                content_hash = hashlib.sha256(content.encode()).hexdigest() if content else None

                # Insert template
                cursor.execute('''
                    INSERT INTO templates (
                        name, source, template_type, category, description,
                        git_repo_url, git_branch, git_username, git_token, git_path, git_verify_ssl,
                        content, filename, content_hash,
                        variables, tags, is_active, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    template_data['name'],
                    template_data['source'],
                    template_data.get('template_type', 'jinja2'),
                    template_data.get('category'),
                    template_data.get('description'),
                    template_data.get('git_repo_url'),
                    template_data.get('git_branch', 'main'),
                    template_data.get('git_username'),
                    template_data.get('git_token'),
                    template_data.get('git_path'),
                    template_data.get('git_verify_ssl', True),
                    content,
                    template_data.get('filename'),
                    content_hash,
                    variables_json,
                    tags_json,
                    True,
                    now
                ))

                template_id = cursor.lastrowid

                # Save content to file if it's a file or webeditor template
                if template_data['source'] in ['file', 'webeditor'] and content:
                    self._save_template_to_file(template_id, template_data['name'], content, template_data.get('filename'))

                # Create initial version
                if content:
                    self._create_template_version(cursor, template_id, content, content_hash, "Initial version")

                conn.commit()
                logger.info(f"Template '{template_data['name']}' created with ID {template_id}")
                return template_id

        except ValueError as e:
            raise e
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                raise ValueError(f"Template with name '{template_data['name']}' already exists")
            raise e
        except Exception as e:
            logger.error(f"Error creating template: {e}")
            raise e

    def get_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        """Get a template by ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('SELECT * FROM templates WHERE id = ?', (template_id,))
                row = cursor.fetchone()

                if row:
                    return self._row_to_dict(row)
                return None

        except Exception as e:
            logger.error(f"Error getting template {template_id}: {e}")
            return None

    def get_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a template by name"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('SELECT * FROM templates WHERE name = ? AND is_active = 1', (name,))
                row = cursor.fetchone()

                if row:
                    return self._row_to_dict(row)
                return None

        except Exception as e:
            logger.error(f"Error getting template by name '{name}': {e}")
            return None

    def list_templates(self, category: str = None, source: str = None, active_only: bool = True) -> List[Dict[str, Any]]:
        """List templates with optional filtering"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                query = "SELECT * FROM templates WHERE 1=1"
                params = []

                if active_only:
                    query += " AND is_active = 1"

                if category:
                    query += " AND category = ?"
                    params.append(category)

                if source:
                    query += " AND source = ?"
                    params.append(source)

                query += " ORDER BY name"

                cursor.execute(query, params)
                rows = cursor.fetchall()

                return [self._row_to_dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error listing templates: {e}")
            return []

    def update_template(self, template_id: int, template_data: Dict[str, Any]) -> bool:
        """Update an existing template"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Get current template
                current = self.get_template(template_id)
                if not current:
                    raise ValueError(f"Template with ID {template_id} not found")

                # Prepare update data
                now = datetime.now(timezone.utc).isoformat()
                variables_json = json.dumps(template_data.get('variables', {}))
                tags_json = json.dumps(template_data.get('tags', []))

                content = template_data.get('content', current.get('content', ''))
                content_hash = hashlib.sha256(content.encode()).hexdigest() if content else None

                # Check if content changed
                content_changed = content_hash != current.get('content_hash')

                # Update template
                cursor.execute('''
                    UPDATE templates SET
                        name = ?, template_type = ?, category = ?, description = ?,
                        git_repo_url = ?, git_branch = ?, git_username = ?, git_token = ?, 
                        git_path = ?, git_verify_ssl = ?,
                        content = ?, filename = ?, content_hash = ?,
                        variables = ?, tags = ?, updated_at = ?
                    WHERE id = ?
                ''', (
                    template_data.get('name', current['name']),
                    template_data.get('template_type', current['template_type']),
                    template_data.get('category', current['category']),
                    template_data.get('description', current['description']),
                    template_data.get('git_repo_url', current['git_repo_url']),
                    template_data.get('git_branch', current['git_branch']),
                    template_data.get('git_username', current['git_username']),
                    template_data.get('git_token', current['git_token']),
                    template_data.get('git_path', current['git_path']),
                    template_data.get('git_verify_ssl', current['git_verify_ssl']),
                    content,
                    template_data.get('filename', current['filename']),
                    content_hash,
                    variables_json,
                    tags_json,
                    now,
                    template_id
                ))

                # Save content to file if needed
                if current['source'] in ['file', 'webeditor'] and content:
                    self._save_template_to_file(template_id, template_data.get('name', current['name']), content, template_data.get('filename', current.get('filename')))

                # Create new version if content changed
                if content_changed and content:
                    self._create_template_version(cursor, template_id, content, content_hash, 
                                                template_data.get('change_notes', 'Template updated'))

                conn.commit()
                logger.info(f"Template {template_id} updated")
                return True

        except Exception as e:
            logger.error(f"Error updating template {template_id}: {e}")
            return False

    def delete_template(self, template_id: int, hard_delete: bool = False) -> bool:
        """Delete a template (soft delete by default)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                if hard_delete:
                    # Hard delete - remove from database and file system
                    template = self.get_template(template_id)
                    if template:
                        cursor.execute('DELETE FROM templates WHERE id = ?', (template_id,))
                        # Remove file if it exists
                        if template['source'] in ['file', 'webeditor']:
                            self._remove_template_file(template_id, template['name'])
                else:
                    # Soft delete - mark as inactive
                    cursor.execute('UPDATE templates SET is_active = 0 WHERE id = ?', (template_id,))

                conn.commit()
                logger.info(f"Template {template_id} {'deleted' if hard_delete else 'deactivated'}")
                return True

        except Exception as e:
            logger.error(f"Error deleting template {template_id}: {e}")
            return False

    def get_template_content(self, template_id: int) -> Optional[str]:
        """Get template content, loading from file if necessary"""
        try:
            template = self.get_template(template_id)
            if not template:
                return None

            # For Git templates, content might need to be fetched
            if template['source'] == 'git':
                # TODO: Implement Git content fetching
                return template.get('content')

            # For file/webeditor templates, try database first, then file
            content = template.get('content')
            if not content and template['source'] in ['file', 'webeditor']:
                content = self._load_template_from_file(template_id, template['name'], template.get('filename'))

            return content

        except Exception as e:
            logger.error(f"Error getting template content for {template_id}: {e}")
            return None

    def render_template(self, template_name: str, category: str, data: Dict[str, Any]) -> str:
        """Render a template using Jinja2 with provided data"""
        try:
            # Import Jinja2 here to avoid import errors if not installed
            from jinja2 import Template, Environment, BaseLoader

            # Find template by name and category
            template = self.get_template_by_name(template_name)
            if not template:
                # If no exact name match, try searching templates
                templates = self.list_templates(category=category if category else None)
                matching_templates = [t for t in templates if t['name'] == template_name]
                if matching_templates:
                    template = matching_templates[0]
                else:
                    raise ValueError(f"Template '{template_name}' not found in category '{category}'")

            # Get template content
            content = self.get_template_content(template['id'])
            if not content:
                raise ValueError(f"Template content not found for '{template_name}'")

            # Create Jinja2 template and render
            env = Environment(loader=BaseLoader())
            jinja_template = env.from_string(content)
            rendered = jinja_template.render(**data)

            logger.info(f"Successfully rendered template '{template_name}' from category '{category}'")
            return rendered

        except Exception as e:
            logger.error(f"Error rendering template '{template_name}' in category '{category}': {e}")
            raise e

    def get_template_versions(self, template_id: int) -> List[Dict[str, Any]]:
        """Get version history for a template"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT * FROM template_versions 
                    WHERE template_id = ? 
                    ORDER BY version_number DESC
                ''', (template_id,))

                rows = cursor.fetchall()
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting template versions for {template_id}: {e}")
            return []

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert SQLite row to dictionary with proper data types"""
        result = dict(row)

        # Parse JSON fields
        if result.get('variables'):
            try:
                result['variables'] = json.loads(result['variables'])
            except json.JSONDecodeError:
                result['variables'] = {}

        if result.get('tags'):
            try:
                result['tags'] = json.loads(result['tags'])
            except json.JSONDecodeError:
                result['tags'] = []

        # Convert boolean fields
        result['is_active'] = bool(result['is_active'])
        result['git_verify_ssl'] = bool(result.get('git_verify_ssl', True))

        return result

    def _save_template_to_file(self, template_id: int, name: str, content: str, filename: str = None) -> None:
        """Save template content to file system, preserving extension if possible"""
        try:
            # Use original extension if provided, else default to .txt
            ext = '.txt'
            if filename:
                ext = os.path.splitext(filename)[1] or '.txt'
            else:
                # Try to extract extension from name
                if '.' in name:
                    ext = os.path.splitext(name)[1] or '.txt'
            safe_name = name.replace(' ', '_').replace('/', '_')
            file_out = f"{template_id}_{safe_name}{ext}"
            filepath = os.path.join(self.storage_path, file_out)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            logger.debug(f"Template content saved to {filepath}")
        except Exception as e:
            logger.error(f"Error saving template to file: {e}")

    def _load_template_from_file(self, template_id: int, name: str, filename: str = None) -> Optional[str]:
        """Load template content from file system, trying multiple extensions"""
        try:
            safe_name = name.replace(' ', '_').replace('/', '_')
            exts = ['.txt', '.j2', '.textfsm']
            if filename:
                exts.insert(0, os.path.splitext(filename)[1])
            else:
                if '.' in name:
                    exts.insert(0, os.path.splitext(name)[1])
            for ext in exts:
                file_in = f"{template_id}_{safe_name}{ext}"
                filepath = os.path.join(self.storage_path, file_in)
                if os.path.exists(filepath):
                    with open(filepath, 'r', encoding='utf-8') as f:
                        return f.read()
            return None
        except Exception as e:
            logger.error(f"Error loading template from file: {e}")
            return None

    def _remove_template_file(self, template_id: int, name: str, filename: str = None) -> None:
        """Remove template file from file system, trying multiple extensions"""
        try:
            safe_name = name.replace(' ', '_').replace('/', '_')
            exts = ['.txt', '.j2', '.textfsm']
            if filename:
                exts.insert(0, os.path.splitext(filename)[1])
            else:
                if '.' in name:
                    exts.insert(0, os.path.splitext(name)[1])
            for ext in exts:
                file_rm = f"{template_id}_{safe_name}{ext}"
                filepath = os.path.join(self.storage_path, file_rm)
                if os.path.exists(filepath):
                    os.remove(filepath)
                    logger.debug(f"Template file removed: {filepath}")
        except Exception as e:
            logger.error(f"Error removing template file: {e}")

    def _create_template_version(self, cursor, template_id: int, content: str, content_hash: str, notes: str = "") -> None:
        """Create a new version entry for a template"""
        try:
            # Get current version number
            cursor.execute('SELECT MAX(version_number) FROM template_versions WHERE template_id = ?', (template_id,))
            result = cursor.fetchone()
            version_number = (result[0] or 0) + 1

            cursor.execute('''
                INSERT INTO template_versions (template_id, version_number, content, content_hash, change_notes)
                VALUES (?, ?, ?, ?, ?)
            ''', (template_id, version_number, content, content_hash, notes))

        except Exception as e:
            logger.error(f"Error creating template version: {e}")

    def search_templates(self, query: str, search_content: bool = False) -> List[Dict[str, Any]]:
        """Search templates by name, description, category, or content"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                search_pattern = f"%{query}%"

                if search_content:
                    cursor.execute('''
                        SELECT * FROM templates 
                        WHERE is_active = 1 AND (
                            name LIKE ? OR 
                            description LIKE ? OR 
                            category LIKE ? OR
                            content LIKE ?
                        )
                        ORDER BY name
                    ''', (search_pattern, search_pattern, search_pattern, search_pattern))
                else:
                    cursor.execute('''
                        SELECT * FROM templates 
                        WHERE is_active = 1 AND (
                            name LIKE ? OR 
                            description LIKE ? OR 
                            category LIKE ?
                        )
                        ORDER BY name
                    ''', (search_pattern, search_pattern, search_pattern))

                rows = cursor.fetchall()
                return [self._row_to_dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error searching templates: {e}")
            return []

    def get_categories(self) -> List[str]:
        """Get all unique template categories"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute('''
                    SELECT DISTINCT category FROM templates 
                    WHERE is_active = 1 AND category IS NOT NULL AND category != ''
                    ORDER BY category
                ''')

                return [row[0] for row in cursor.fetchall()]

        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return []

    def health_check(self) -> Dict[str, Any]:
        """Check template database health"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                cursor.execute('SELECT COUNT(*) FROM templates WHERE is_active = 1')
                active_count = cursor.fetchone()[0]

                cursor.execute('SELECT COUNT(*) FROM templates')
                total_count = cursor.fetchone()[0]

                cursor.execute('SELECT COUNT(DISTINCT category) FROM templates WHERE category IS NOT NULL')
                categories_count = cursor.fetchone()[0]

                return {
                    'status': 'healthy',
                    'database_path': self.db_path,
                    'storage_path': self.storage_path,
                    'active_templates': active_count,
                    'total_templates': total_count,
                    'categories': categories_count,
                    'database_size': os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0
                }

        except Exception as e:
            logger.error(f"Template database health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e)
            }


# Global template manager instance
template_manager = TemplateManager()
