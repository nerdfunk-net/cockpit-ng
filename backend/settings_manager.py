"""
Settings Database Management for Cockpit
Handles SQLite database operations for application settings
"""

import sqlite3
import os
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
import json

# Import config to get environment variable defaults
try:
    from config import settings as env_settings
except ImportError:
    env_settings = None

logger = logging.getLogger(__name__)

@dataclass
class NautobotSettings:
    """Nautobot connection settings"""
    url: str = "http://localhost:8080"  # More common Nautobot port
    token: str = ""  # Must be configured by user
    timeout: int = 30
    verify_ssl: bool = True

@dataclass 
class GitSettings:
    """Git repository settings for configs"""
    repo_url: str = ""
    branch: str = "main"
    username: str = ""
    token: str = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True

@dataclass
class CacheSettings:
    """Cache configuration for Git data"""
    enabled: bool = True
    ttl_seconds: int = 600  # 10 minutes
    prefetch_on_startup: bool = True
    refresh_interval_minutes: int = 15  # background refresh cadence
    max_commits: int = 500  # limit per branch
    # Map of items to prefetch on startup, e.g., {"git": true, "locations": false}
    prefetch_items: Dict[str, bool] = None

class SettingsManager:
    """Manages application settings in SQLite database"""

    def __init__(self, db_path: str = None):
        if db_path is None:
            # Use data directory from configuration for persistence
            from config import settings as config_settings
            settings_dir = os.path.join(config_settings.data_directory, 'settings')
            os.makedirs(settings_dir, exist_ok=True)
            self.db_path = os.path.join(settings_dir, 'cockpit_settings.db')
        else:
            self.db_path = db_path

        # Use environment settings as defaults if available
        if env_settings:
            self.default_nautobot = NautobotSettings(
                url=env_settings.nautobot_url,
                token=env_settings.nautobot_token,
                timeout=env_settings.nautobot_timeout,
                verify_ssl=True
            )
        else:
            self.default_nautobot = NautobotSettings()

        self.default_git = GitSettings()
        self.default_cache = CacheSettings()

        # Initialize database
        self.init_database()

    def init_database(self) -> bool:
        """Initialize the settings database with default values"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Create nautobot_settings table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS nautobot_settings (
                        id INTEGER PRIMARY KEY,
                        url TEXT NOT NULL,
                        token TEXT NOT NULL,
                        timeout INTEGER NOT NULL DEFAULT 30,
                        verify_ssl BOOLEAN NOT NULL DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Create git_settings table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS git_settings (
                        id INTEGER PRIMARY KEY,
                        repo_url TEXT NOT NULL,
                        branch TEXT NOT NULL DEFAULT 'main',
                        username TEXT,
                        token TEXT,
                        config_path TEXT NOT NULL DEFAULT 'configs/',
                        sync_interval INTEGER NOT NULL DEFAULT 15,
                        verify_ssl BOOLEAN NOT NULL DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Create settings_metadata table for versioning and status
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS settings_metadata (
                        key TEXT PRIMARY KEY,
                        value TEXT,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

        # Create cache_settings table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cache_settings (
                        id INTEGER PRIMARY KEY,
                        enabled BOOLEAN NOT NULL DEFAULT 1,
                        ttl_seconds INTEGER NOT NULL DEFAULT 600,
                        prefetch_on_startup BOOLEAN NOT NULL DEFAULT 1,
                        refresh_interval_minutes INTEGER NOT NULL DEFAULT 15,
                        max_commits INTEGER NOT NULL DEFAULT 500,
            prefetch_items TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Run database migrations
                self._run_migrations(cursor)

                # Check if we need to insert default values
                cursor.execute('SELECT COUNT(*) FROM nautobot_settings')
                if cursor.fetchone()[0] == 0:
                    logger.info("Inserting default Nautobot settings")
                    self._insert_default_nautobot_settings(cursor)

                cursor.execute('SELECT COUNT(*) FROM git_settings')  
                if cursor.fetchone()[0] == 0:
                    logger.info("Inserting default Git settings")
                    self._insert_default_git_settings(cursor)

                cursor.execute('SELECT COUNT(*) FROM cache_settings')
                if cursor.fetchone()[0] == 0:
                    logger.info("Inserting default Cache settings")
                    self._insert_default_cache_settings(cursor)

                # Set database version
                cursor.execute('''
                    INSERT OR REPLACE INTO settings_metadata (key, value)
                    VALUES ('db_version', '1.0')
                ''')

                conn.commit()
                logger.info(f"Settings database initialized at {self.db_path}")
                return True

        except sqlite3.Error as e:
            logger.error(f"Database initialization failed: {e}")
            return False

    def _run_migrations(self, cursor):
        """Run database migrations for schema updates"""
        try:
            # Check if verify_ssl column exists in git_settings table
            cursor.execute("PRAGMA table_info(git_settings)")
            columns = [column[1] for column in cursor.fetchall()]

            if 'verify_ssl' not in columns:
                logger.info("Adding verify_ssl column to git_settings table")
                cursor.execute('ALTER TABLE git_settings ADD COLUMN verify_ssl BOOLEAN NOT NULL DEFAULT 1')

            # Ensure cache_settings table exists or has all columns
            cursor.execute("PRAGMA table_info(cache_settings)")
            cache_columns = [column[1] for column in cursor.fetchall()]
            if not cache_columns:
                logger.info("Creating cache_settings table via migration")
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cache_settings (
                        id INTEGER PRIMARY KEY,
                        enabled BOOLEAN NOT NULL DEFAULT 1,
                        ttl_seconds INTEGER NOT NULL DEFAULT 600,
                        prefetch_on_startup BOOLEAN NOT NULL DEFAULT 1,
                        refresh_interval_minutes INTEGER NOT NULL DEFAULT 15,
                        max_commits INTEGER NOT NULL DEFAULT 500,
                        prefetch_items TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
            # Add prefetch_items column if missing
            else:
                if 'prefetch_items' not in cache_columns:
                    logger.info("Adding prefetch_items column to cache_settings table")
                    cursor.execute('ALTER TABLE cache_settings ADD COLUMN prefetch_items TEXT')

        except sqlite3.Error as e:
            logger.error(f"Migration failed: {e}")

    def _insert_default_nautobot_settings(self, cursor):
        """Insert default Nautobot settings"""
        cursor.execute('''
            INSERT INTO nautobot_settings (url, token, timeout, verify_ssl)
            VALUES (?, ?, ?, ?)
        ''', (
            self.default_nautobot.url,
            self.default_nautobot.token,
            self.default_nautobot.timeout,
            self.default_nautobot.verify_ssl
        ))

    def _insert_default_git_settings(self, cursor):
        """Insert default Git settings"""
        cursor.execute('''
            INSERT INTO git_settings (repo_url, branch, username, token, config_path, sync_interval, verify_ssl)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            self.default_git.repo_url,
            self.default_git.branch,
            self.default_git.username,
            self.default_git.token,
            self.default_git.config_path,
            self.default_git.sync_interval,
            self.default_git.verify_ssl
        ))

    def _insert_default_cache_settings(self, cursor):
        """Insert default Cache settings"""
        cursor.execute('''
            INSERT INTO cache_settings (enabled, ttl_seconds, prefetch_on_startup, refresh_interval_minutes, max_commits, prefetch_items)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            int(self.default_cache.enabled),
            self.default_cache.ttl_seconds,
            int(self.default_cache.prefetch_on_startup),
            self.default_cache.refresh_interval_minutes,
            self.default_cache.max_commits,
            json.dumps({"git": True, "locations": False})
        ))

    def get_nautobot_settings(self) -> Optional[Dict[str, Any]]:
        """Get current Nautobot settings"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('SELECT * FROM nautobot_settings ORDER BY id DESC LIMIT 1')
                row = cursor.fetchone()

                if row:
                    return {
                        'url': row['url'],
                        'token': row['token'],
                        'timeout': row['timeout'],
                        'verify_ssl': bool(row['verify_ssl'])
                    }
                else:
                    # Fallback to defaults
                    return asdict(self.default_nautobot)

        except sqlite3.Error as e:
            logger.error(f"Error getting Nautobot settings: {e}")
            # Auto-recover by recreating database
            self._handle_database_corruption()
            return asdict(self.default_nautobot)

    def get_git_settings(self) -> Optional[Dict[str, Any]]:
        """Get current Git settings"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('SELECT * FROM git_settings ORDER BY id DESC LIMIT 1')
                row = cursor.fetchone()

                if row:
                    return {
                        'repo_url': row['repo_url'],
                        'branch': row['branch'],
                        'username': row['username'] or '',
                        'token': row['token'] or '',
                        'config_path': row['config_path'],
                        'sync_interval': row['sync_interval'],
                        'verify_ssl': bool(row['verify_ssl']) if 'verify_ssl' in row.keys() else True
                    }
                else:
                    # Fallback to defaults
                    return asdict(self.default_git)

        except sqlite3.Error as e:
            logger.error(f"Error getting Git settings: {e}")
            # Auto-recover by recreating database
            self._handle_database_corruption()
            return asdict(self.default_git)

    def get_all_settings(self) -> Dict[str, Any]:
        """Get all settings combined"""
        return {
            'nautobot': self.get_nautobot_settings(),
            'git': self.get_git_settings(),
            'cache': self.get_cache_settings(),
            'metadata': self._get_metadata()
        }

    def get_cache_settings(self) -> Dict[str, Any]:
        """Get current Cache settings"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM cache_settings ORDER BY id DESC LIMIT 1')
                row = cursor.fetchone()
                if row:
                    return {
                        'enabled': bool(row['enabled']),
                        'ttl_seconds': int(row['ttl_seconds']),
                        'prefetch_on_startup': bool(row['prefetch_on_startup']),
                        'refresh_interval_minutes': int(row['refresh_interval_minutes']),
                        'max_commits': int(row['max_commits']),
                        'prefetch_items': json.loads(row['prefetch_items']) if row['prefetch_items'] else {"git": True, "locations": False}
                    }
                return asdict(self.default_cache)
        except sqlite3.Error as e:
            logger.error(f"Error getting Cache settings: {e}")
            self._handle_database_corruption()
            return asdict(self.default_cache)

    def update_cache_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Cache settings"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT COUNT(*) FROM cache_settings')
                count = cursor.fetchone()[0]
                if count == 0:
                    cursor.execute('''
                        INSERT INTO cache_settings (enabled, ttl_seconds, prefetch_on_startup, refresh_interval_minutes, max_commits, prefetch_items)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (
                        int(settings.get('enabled', self.default_cache.enabled)),
                        int(settings.get('ttl_seconds', self.default_cache.ttl_seconds)),
                        int(settings.get('prefetch_on_startup', self.default_cache.prefetch_on_startup)),
                        int(settings.get('refresh_interval_minutes', self.default_cache.refresh_interval_minutes)),
                        int(settings.get('max_commits', self.default_cache.max_commits)),
                        json.dumps(settings.get('prefetch_items') or {"git": True, "locations": False})
                    ))
                else:
                    cursor.execute('''
                        UPDATE cache_settings SET 
                            enabled = ?,
                            ttl_seconds = ?,
                            prefetch_on_startup = ?,
                            refresh_interval_minutes = ?,
                            max_commits = ?,
                            prefetch_items = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = (SELECT id FROM cache_settings ORDER BY id DESC LIMIT 1)
                    ''', (
                        int(settings.get('enabled', self.default_cache.enabled)),
                        int(settings.get('ttl_seconds', self.default_cache.ttl_seconds)),
                        int(settings.get('prefetch_on_startup', self.default_cache.prefetch_on_startup)),
                        int(settings.get('refresh_interval_minutes', self.default_cache.refresh_interval_minutes)),
                        int(settings.get('max_commits', self.default_cache.max_commits)),
                        json.dumps(settings.get('prefetch_items') or {"git": True, "locations": False})
                    ))
                conn.commit()
                logger.info("Cache settings updated successfully")
                return True
        except sqlite3.Error as e:
            logger.error(f"Error updating Cache settings: {e}")
            return False

    def update_nautobot_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Nautobot settings"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # First, check if any settings exist
                cursor.execute('SELECT COUNT(*) FROM nautobot_settings')
                count = cursor.fetchone()[0]

                if count == 0:
                    # Insert new settings
                    cursor.execute('''
                        INSERT INTO nautobot_settings (url, token, timeout, verify_ssl)
                        VALUES (?, ?, ?, ?)
                    ''', (
                        settings.get('url', self.default_nautobot.url),
                        settings.get('token', self.default_nautobot.token),
                        settings.get('timeout', self.default_nautobot.timeout),
                        settings.get('verify_ssl', self.default_nautobot.verify_ssl)
                    ))
                else:
                    # Update existing settings (update the first/most recent record)
                    cursor.execute('''
                        UPDATE nautobot_settings SET 
                            url = ?, 
                            token = ?, 
                            timeout = ?, 
                            verify_ssl = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = (SELECT id FROM nautobot_settings ORDER BY id DESC LIMIT 1)
                    ''', (
                        settings.get('url', self.default_nautobot.url),
                        settings.get('token', self.default_nautobot.token),
                        settings.get('timeout', self.default_nautobot.timeout),
                        settings.get('verify_ssl', self.default_nautobot.verify_ssl)
                    ))

                conn.commit()
                logger.info("Nautobot settings updated successfully")
                return True

        except sqlite3.Error as e:
            logger.error(f"Error updating Nautobot settings: {e}")
            return False

    def update_git_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Git settings"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # First, check if any settings exist
                cursor.execute('SELECT COUNT(*) FROM git_settings')
                count = cursor.fetchone()[0]

                if count == 0:
                    # Insert new settings
                    cursor.execute('''
                        INSERT INTO git_settings (repo_url, branch, username, token, config_path, sync_interval, verify_ssl)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        settings.get('repo_url', self.default_git.repo_url),
                        settings.get('branch', self.default_git.branch),
                        settings.get('username', self.default_git.username),
                        settings.get('token', self.default_git.token),
                        settings.get('config_path', self.default_git.config_path),
                        settings.get('sync_interval', self.default_git.sync_interval),
                        settings.get('verify_ssl', self.default_git.verify_ssl)
                    ))
                else:
                    # Update existing settings (update the first/most recent record)
                    cursor.execute('''
                        UPDATE git_settings SET 
                            repo_url = ?, 
                            branch = ?, 
                            username = ?, 
                            token = ?, 
                            config_path = ?, 
                            sync_interval = ?, 
                            verify_ssl = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = (SELECT id FROM git_settings ORDER BY id DESC LIMIT 1)
                    ''', (
                        settings.get('repo_url', self.default_git.repo_url),
                        settings.get('branch', self.default_git.branch),
                        settings.get('username', self.default_git.username),
                        settings.get('token', self.default_git.token),
                        settings.get('config_path', self.default_git.config_path),
                        settings.get('sync_interval', self.default_git.sync_interval),
                        settings.get('verify_ssl', self.default_git.verify_ssl)
                    ))

                conn.commit()
                logger.info("Git settings updated successfully")
                return True

        except sqlite3.Error as e:
            logger.error(f"Error updating Git settings: {e}")
            return False

    def update_all_settings(self, settings: Dict[str, Any]) -> bool:
        """Update all settings"""
        success = True

        if 'nautobot' in settings:
            success &= self.update_nautobot_settings(settings['nautobot'])

        if 'git' in settings:
            success &= self.update_git_settings(settings['git'])

        if 'cache' in settings:
            success &= self.update_cache_settings(settings['cache'])

        return success

    def _get_metadata(self) -> Dict[str, Any]:
        """Get database metadata"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute('SELECT key, value FROM settings_metadata')
                rows = cursor.fetchall()

                metadata = {}
                for row in rows:
                    metadata[row['key']] = row['value']

                metadata['database_path'] = self.db_path
                metadata['database_exists'] = os.path.exists(self.db_path)

                return metadata

        except sqlite3.Error as e:
            logger.error(f"Error getting metadata: {e}")
            return {'error': str(e)}

    def _handle_database_corruption(self) -> Dict[str, str]:
        """Handle database corruption by recreating with defaults"""
        logger.warning("Database corruption detected, recreating with defaults")

        try:
            # Remove corrupted database
            if os.path.exists(self.db_path):
                os.remove(self.db_path)

            # Recreate database
            success = self.init_database()

            if success:
                message = "Database was corrupted and has been recreated with default settings. Please reconfigure your settings."
                logger.info(message)
                return {
                    'status': 'recovered',
                    'message': message
                }
            else:
                raise Exception("Failed to recreate database")

        except Exception as e:
            error_msg = f"Failed to recover from database corruption: {e}"
            logger.error(error_msg)
            return {
                'status': 'error',
                'message': error_msg
            }

    def reset_to_defaults(self) -> bool:
        """Reset all settings to defaults"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Clear existing settings
                cursor.execute('DELETE FROM nautobot_settings')
                cursor.execute('DELETE FROM git_settings')
                cursor.execute('DELETE FROM cache_settings')

                # Insert defaults
                self._insert_default_nautobot_settings(cursor)
                self._insert_default_git_settings(cursor)
                self._insert_default_cache_settings(cursor)

                conn.commit()
                logger.info("Settings reset to defaults")
                return True

        except sqlite3.Error as e:
            logger.error(f"Error resetting settings: {e}")
            return False

    def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Test basic operations
                cursor.execute('SELECT COUNT(*) FROM nautobot_settings')
                nautobot_count = cursor.fetchone()[0]

                cursor.execute('SELECT COUNT(*) FROM git_settings')
                git_count = cursor.fetchone()[0]

                return {
                    'status': 'healthy',
                    'database_path': self.db_path,
                    'nautobot_settings_count': nautobot_count,
                    'git_settings_count': git_count,
                    'database_size': os.path.getsize(self.db_path) if os.path.exists(self.db_path) else 0
                }

        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'recovery_needed': True
            }

    def get_selected_git_repository(self) -> Optional[int]:
        """Get the currently selected Git repository ID for configuration comparison."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Ensure table exists
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS selected_git_repository (
                        id INTEGER PRIMARY KEY,
                        repository_id INTEGER NOT NULL,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                cursor.execute('SELECT repository_id FROM selected_git_repository WHERE id = 1')
                result = cursor.fetchone()
                return result[0] if result else None

        except Exception as e:
            logger.error(f"Error getting selected Git repository: {e}")
            return None

    def set_selected_git_repository(self, repository_id: int) -> bool:
        """Set the selected Git repository ID for configuration comparison."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()

                # Ensure table exists
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS selected_git_repository (
                        id INTEGER PRIMARY KEY,
                        repository_id INTEGER NOT NULL,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')

                # Use INSERT OR REPLACE to handle both insert and update
                cursor.execute('''
                    INSERT OR REPLACE INTO selected_git_repository (id, repository_id, updated_at)
                    VALUES (1, ?, CURRENT_TIMESTAMP)
                ''', (repository_id,))

                conn.commit()
                logger.info(f"Selected Git repository set to ID: {repository_id}")
                return True

        except Exception as e:
            logger.error(f"Error setting selected Git repository: {e}")
            return False

# Global settings manager instance
settings_manager = SettingsManager()
