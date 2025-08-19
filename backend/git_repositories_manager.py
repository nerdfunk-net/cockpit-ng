"""
Git repository management system.
"""

import sqlite3
import logging
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class GitRepositoryManager:
    """Manages Git repositories in SQLite database."""

    def __init__(self, db_path: str = None):
        if db_path is None:
            # Use data directory from configuration
            from config import settings as config_settings
            data_dir = Path(config_settings.data_directory) / "settings"
            data_dir.mkdir(parents=True, exist_ok=True)
            db_path = data_dir / "git_repositories.db"

        self.db_path = str(db_path)
        self.init_database()

    def init_database(self):
        """Initialize the database with required tables."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS git_repositories (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT UNIQUE NOT NULL,
                        category TEXT NOT NULL CHECK (category IN ('configs', 'templates', 'onboarding')),
                        url TEXT NOT NULL,
                        branch TEXT NOT NULL DEFAULT 'main',
                        username TEXT,
                        token TEXT,
                        credential_name TEXT,
                        path TEXT,
                        verify_ssl BOOLEAN NOT NULL DEFAULT 1,
                        description TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_sync TIMESTAMP,
                        sync_status TEXT
                    )
                """)

                # Ensure CHECK constraint includes 'onboarding' for existing DBs by recreating table if needed
                try:
                    row = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='git_repositories'").fetchone()
                    create_sql = row[0] if row else ''
                    if "category IN ('configs', 'templates')" in create_sql and 'onboarding' not in create_sql:
                        logger.info("Migrating git_repositories table to include 'onboarding' category in CHECK constraint")
                        conn.execute('BEGIN')
                        # Create new table with updated constraint
                        conn.execute("""
                            CREATE TABLE git_repositories_new (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                name TEXT UNIQUE NOT NULL,
                                category TEXT NOT NULL CHECK (category IN ('configs', 'templates', 'onboarding')),
                                url TEXT NOT NULL,
                                branch TEXT NOT NULL DEFAULT 'main',
                                username TEXT,
                                token TEXT,
                                credential_name TEXT,
                                path TEXT,
                                verify_ssl BOOLEAN NOT NULL DEFAULT 1,
                                description TEXT,
                                is_active BOOLEAN NOT NULL DEFAULT 1,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                last_sync TIMESTAMP,
                                sync_status TEXT
                            )
                        """)
                        # Copy data
                        conn.execute("""
                            INSERT INTO git_repositories_new
                            (id, name, category, url, branch, username, token, credential_name, path, verify_ssl, description, is_active, created_at, updated_at, last_sync, sync_status)
                            SELECT id, name, category, url, branch, username, token, NULL as credential_name, path, verify_ssl, description, is_active, created_at, updated_at, last_sync, sync_status
                            FROM git_repositories
                        """)
                        # Replace old table
                        conn.execute("DROP TABLE git_repositories")
                        conn.execute("ALTER TABLE git_repositories_new RENAME TO git_repositories")
                        # Recreate indexes
                        conn.execute("CREATE INDEX IF NOT EXISTS idx_git_repos_category ON git_repositories (category)")
                        conn.execute("CREATE INDEX IF NOT EXISTS idx_git_repos_active ON git_repositories (is_active)")
                        conn.execute('COMMIT')
                        logger.info("Migration of git_repositories table completed successfully")
                except Exception as m_e:
                    logger.warning(f"Could not verify or migrate git_repositories CHECK constraint: {m_e}")

                # For existing DBs that weren't recreated, ensure 'credential_name' column exists
                try:
                    cols = [r[1] for r in conn.execute("PRAGMA table_info(git_repositories)").fetchall()]
                    if 'credential_name' not in cols:
                        conn.execute("ALTER TABLE git_repositories ADD COLUMN credential_name TEXT")
                        conn.commit()
                except Exception as e:
                    logger.warning(f"Could not add credential_name column if missing: {e}")

                # Create indexes for better performance
                conn.execute("CREATE INDEX IF NOT EXISTS idx_git_repos_category ON git_repositories (category)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_git_repos_active ON git_repositories (is_active)")

                conn.commit()
                logger.info(f"Git repositories database initialized at {self.db_path}")
        except Exception as e:
            logger.error(f"Error initializing git repositories database: {e}")
            raise

    def create_repository(self, repo_data: Dict[str, Any]) -> int:
        """Create a new git repository."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    INSERT INTO git_repositories 
                    (name, category, url, branch, username, token, credential_name, path, verify_ssl, description, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    repo_data["name"],
                    repo_data["category"],
                    repo_data["url"],
                    repo_data.get("branch", "main"),
                    repo_data.get("username"),
                    repo_data.get("token"),
                    repo_data.get("credential_name"),
                    repo_data.get("path"),
                    repo_data.get("verify_ssl", True),
                    repo_data.get("description"),
                    repo_data.get("is_active", True)
                ))
                repo_id = cursor.lastrowid
                conn.commit()

                logger.info(f"Created git repository: {repo_data['name']} (ID: {repo_id})")
                return repo_id
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                raise ValueError(f"Repository with name '{repo_data['name']}' already exists")
            raise
        except Exception as e:
            logger.error(f"Error creating git repository: {e}")
            raise

    def get_repository(self, repo_id: int) -> Optional[Dict[str, Any]]:
        """Get a git repository by ID."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT * FROM git_repositories WHERE id = ?
                """, (repo_id,))
                row = cursor.fetchone()

                if row:
                    return dict(row)
                return None
        except Exception as e:
            logger.error(f"Error getting git repository {repo_id}: {e}")
            raise

    def get_repositories(self, category: Optional[str] = None, active_only: bool = False) -> List[Dict[str, Any]]:
        """Get all git repositories, optionally filtered by category and active status."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row

                query = "SELECT * FROM git_repositories WHERE 1=1"
                params = []

                if category:
                    query += " AND category = ?"
                    params.append(category)

                if active_only:
                    query += " AND is_active = 1"

                query += " ORDER BY name"

                cursor = conn.execute(query, params)
                rows = cursor.fetchall()

                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting git repositories: {e}")
            raise

    def update_repository(self, repo_id: int, repo_data: Dict[str, Any]) -> bool:
        """Update a git repository."""
        try:
            # Build dynamic update query
            set_clauses = []
            params = []

            for field in ["name", "category", "url", "branch", "username", "token", "credential_name", "path", "verify_ssl", "description", "is_active"]:
                if field in repo_data:
                    set_clauses.append(f"{field} = ?")
                    params.append(repo_data[field])

            if not set_clauses:
                return False

            set_clauses.append("updated_at = CURRENT_TIMESTAMP")
            params.append(repo_id)

            with sqlite3.connect(self.db_path) as conn:
                query = f"UPDATE git_repositories SET {', '.join(set_clauses)} WHERE id = ?"
                cursor = conn.execute(query, params)
                updated = cursor.rowcount > 0
                conn.commit()

                if updated:
                    logger.info(f"Updated git repository ID: {repo_id}")
                return updated
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                raise ValueError(f"Repository with name '{repo_data.get('name')}' already exists")
            raise
        except Exception as e:
            logger.error(f"Error updating git repository {repo_id}: {e}")
            raise

    def delete_repository(self, repo_id: int, hard_delete: bool = True) -> bool:
        """Delete a git repository."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                if hard_delete:
                    cursor = conn.execute("DELETE FROM git_repositories WHERE id = ?", (repo_id,))
                else:
                    cursor = conn.execute("""
                        UPDATE git_repositories 
                        SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    """, (repo_id,))

                deleted = cursor.rowcount > 0
                conn.commit()

                if deleted:
                    action = "Deleted" if hard_delete else "Deactivated"
                    logger.info(f"{action} git repository ID: {repo_id}")
                return deleted
        except Exception as e:
            logger.error(f"Error deleting git repository {repo_id}: {e}")
            raise

    def update_sync_status(self, repo_id: int, status: str, last_sync: Optional[datetime] = None) -> bool:
        """Update the sync status of a repository."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                if last_sync is None:
                    last_sync = datetime.now()

                cursor = conn.execute("""
                    UPDATE git_repositories 
                    SET sync_status = ?, last_sync = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                """, (status, last_sync.isoformat(), repo_id))

                updated = cursor.rowcount > 0
                conn.commit()
                return updated
        except Exception as e:
            logger.error(f"Error updating sync status for repository {repo_id}: {e}")
            raise

    def get_repositories_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get all active repositories for a specific category."""
        return self.get_repositories(category=category, active_only=True)

    def health_check(self) -> Dict[str, Any]:
        """Check the health of the git repository management system."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) as total, category FROM git_repositories GROUP BY category")
                category_counts = {row[1]: row[0] for row in cursor.fetchall()}

                cursor = conn.execute("SELECT COUNT(*) FROM git_repositories WHERE is_active = 1")
                active_count = cursor.fetchone()[0]

                cursor = conn.execute("SELECT COUNT(*) FROM git_repositories")
                total_count = cursor.fetchone()[0]

                return {
                    "status": "healthy",
                    "total_repositories": total_count,
                    "active_repositories": active_count,
                    "categories": category_counts,
                    "database_path": self.db_path
                }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "database_path": self.db_path
            }
