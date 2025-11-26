#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script
Migrates all data from SQLite databases to PostgreSQL.
"""

import os
import sys
import sqlite3
import logging
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from core.database import engine, Base, get_db_session
from core.models import (
    User, Role, Permission, RolePermission, UserRole, UserPermission,
    Setting, Credential, Template, GitRepository, Job,
    NB2CMKSync, ComplianceRule, ComplianceCheck
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# SQLite database paths
DATA_DIR = Path(settings.data_directory)
SETTINGS_DIR = DATA_DIR / "settings"

SQLITE_DBS = {
    "users": SETTINGS_DIR / "users.db",
    "rbac": SETTINGS_DIR / "rbac.db",
    "settings": SETTINGS_DIR / "cockpit_settings.db",
    "credentials": SETTINGS_DIR / "credentials.db",
    "templates": SETTINGS_DIR / "cockpit_templates.db",
    "git_repositories": DATA_DIR / "git_repositories.db",
    "jobs": DATA_DIR / "jobs.db",
    "nb2cmk": SETTINGS_DIR / "nb2cmk.db",
    "compliance": SETTINGS_DIR / "compliance.db",
}


def check_sqlite_databases():
    """Check which SQLite databases exist."""
    logger.info("Checking for existing SQLite databases...")
    found = {}
    for name, path in SQLITE_DBS.items():
        if path.exists():
            logger.info(f"  ✓ Found: {name} at {path}")
            found[name] = path
        else:
            logger.info(f"  ✗ Not found: {name} at {path}")
    return found


def migrate_users(db_path, session):
    """Migrate users from SQLite to PostgreSQL."""
    logger.info("Migrating users...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        rows = cursor.execute("SELECT * FROM users").fetchall()
        for row in rows:
            user = User(
                id=row['id'],
                username=row['username'],
                realname=row['realname'],
                email=row['email'] if row['email'] else None,
                password=row['password'],
                permissions=row['permissions'],
                debug=bool(row['debug']),
                is_active=bool(row['is_active']),
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(),
                updated_at=datetime.fromisoformat(row['updated_at']) if row['updated_at'] else datetime.now(),
            )
            session.add(user)
        session.commit()
        logger.info(f"  Migrated {len(rows)} users")
    except Exception as e:
        logger.error(f"  Error migrating users: {e}")
        session.rollback()
    finally:
        conn.close()


def migrate_rbac(db_path, session):
    """Migrate RBAC data from SQLite to PostgreSQL."""
    logger.info("Migrating RBAC data...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Migrate roles
        rows = cursor.execute("SELECT * FROM roles").fetchall()
        for row in rows:
            role = Role(
                id=row['id'],
                name=row['name'],
                description=row['description'],
                is_system=bool(row['is_system']),
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(),
                updated_at=datetime.fromisoformat(row['updated_at']) if row['updated_at'] else datetime.now(),
            )
            session.add(role)
        session.commit()
        logger.info(f"  Migrated {len(rows)} roles")
        
        # Migrate permissions
        rows = cursor.execute("SELECT * FROM permissions").fetchall()
        for row in rows:
            permission = Permission(
                id=row['id'],
                resource=row['resource'],
                action=row['action'],
                description=row['description'],
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(),
            )
            session.add(permission)
        session.commit()
        logger.info(f"  Migrated {len(rows)} permissions")
        
        # Migrate role_permissions
        rows = cursor.execute("SELECT * FROM role_permissions").fetchall()
        for row in rows:
            role_perm = RolePermission(
                role_id=row['role_id'],
                permission_id=row['permission_id'],
                granted=bool(row['granted']),
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(),
            )
            session.add(role_perm)
        session.commit()
        logger.info(f"  Migrated {len(rows)} role permissions")
        
        # Migrate user_roles
        rows = cursor.execute("SELECT * FROM user_roles").fetchall()
        for row in rows:
            user_role = UserRole(
                user_id=row['user_id'],
                role_id=row['role_id'],
                created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(),
            )
            session.add(user_role)
        session.commit()
        logger.info(f"  Migrated {len(rows)} user roles")
        
        # Migrate user_permissions if table exists
        try:
            rows = cursor.execute("SELECT * FROM user_permissions").fetchall()
            for row in rows:
                user_perm = UserPermission(
                    user_id=row['user_id'],
                    permission_id=row['permission_id'],
                    granted=bool(row['granted']),
                    created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else datetime.now(),
                )
                session.add(user_perm)
            session.commit()
            logger.info(f"  Migrated {len(rows)} user permissions")
        except sqlite3.OperationalError:
            logger.info("  user_permissions table not found, skipping")
            
    except Exception as e:
        logger.error(f"  Error migrating RBAC: {e}")
        session.rollback()
    finally:
        conn.close()


def migrate_settings(db_path, session):
    """Migrate settings from SQLite to PostgreSQL."""
    logger.info("Migrating settings...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get all tables
        tables = cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        logger.info(f"  Found {len(tables)} settings tables")
        
        # For now, we'll store all settings in a key-value format
        # You may want to customize this based on your actual settings structure
        for table in tables:
            table_name = table['name']
            if table_name == 'sqlite_sequence':
                continue
                
            try:
                rows = cursor.execute(f"SELECT * FROM {table_name}").fetchall()
                for row in rows:
                    # Convert row to dict
                    row_dict = dict(row)
                    # Store as JSON in settings table
                    for key, value in row_dict.items():
                        if key != 'id':
                            setting = Setting(
                                category=table_name,
                                key=f"{row_dict.get('id', 'default')}_{key}",
                                value=str(value) if value is not None else None,
                                value_type='string',
                            )
                            session.add(setting)
                session.commit()
                logger.info(f"  Migrated {len(rows)} records from {table_name}")
            except Exception as e:
                logger.warning(f"  Could not migrate table {table_name}: {e}")
                session.rollback()
                
    except Exception as e:
        logger.error(f"  Error migrating settings: {e}")
        session.rollback()
    finally:
        conn.close()


def migrate_credentials(db_path, session):
    """Migrate credentials from SQLite to PostgreSQL."""
    logger.info("Migrating credentials...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        rows = cursor.execute("SELECT * FROM credentials").fetchall()
        for row in rows:
            credential = Credential(
                id=row['id'],
                name=row['name'],
                username=row['username'],
                password_encrypted=row['password_encrypted'],
                description=row['description'] if 'description' in row.keys() else None,
                source=row['source'] if 'source' in row.keys() else 'general',
                owner=row['owner'] if 'owner' in row.keys() and row['owner'] else 'admin',  # Default to 'admin' if NULL
                created_at=datetime.fromisoformat(row['created_at']) if 'created_at' in row.keys() and row['created_at'] else datetime.now(),
                updated_at=datetime.fromisoformat(row['updated_at']) if 'updated_at' in row.keys() and row['updated_at'] else datetime.now(),
                expires_at=datetime.fromisoformat(row['expires_at']) if 'expires_at' in row.keys() and row['expires_at'] else None,
            )
            session.add(credential)
        session.commit()
        logger.info(f"  Migrated {len(rows)} credentials")
    except Exception as e:
        logger.error(f"  Error migrating credentials: {e}")
        session.rollback()
    finally:
        conn.close()


def migrate_templates(db_path, session):
    """Migrate templates from SQLite to PostgreSQL."""
    logger.info("Migrating templates...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        rows = cursor.execute("SELECT * FROM templates").fetchall()
        for row in rows:
            template = Template(
                id=row['id'],
                name=row['name'],
                content=row['content'],
                description=row['description'] if 'description' in row.keys() else None,
                category=row['category'] if 'category' in row.keys() else 'general',
                tags=row['tags'] if 'tags' in row.keys() else None,
                variables=row['variables'] if 'variables' in row.keys() else None,
                owner=row['owner'] if 'owner' in row.keys() else 'admin',
                is_active=bool(row['is_active']) if 'is_active' in row.keys() else True,
                created_at=datetime.fromisoformat(row['created_at']) if 'created_at' in row.keys() and row['created_at'] else datetime.now(),
                updated_at=datetime.fromisoformat(row['updated_at']) if 'updated_at' in row.keys() and row['updated_at'] else datetime.now(),
            )
            session.add(template)
        session.commit()
        logger.info(f"  Migrated {len(rows)} templates")
    except Exception as e:
        logger.error(f"  Error migrating templates: {e}")
        session.rollback()
    finally:
        conn.close()


def migrate_git_repositories(db_path, session):
    """Migrate git repositories from SQLite to PostgreSQL."""
    logger.info("Migrating git repositories...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        rows = cursor.execute("SELECT * FROM git_repositories").fetchall()
        for row in rows:
            repo = GitRepository(
                id=row['id'],
                name=row['name'],
                url=row['url'],
                branch=row['branch'] if 'branch' in row.keys() else 'main',
                credential_id=row['credential_id'] if 'credential_id' in row.keys() else None,
                local_path=row['local_path'] if 'local_path' in row.keys() else None,
                is_active=bool(row['is_active']) if 'is_active' in row.keys() else True,
                last_sync=datetime.fromisoformat(row['last_sync']) if 'last_sync' in row.keys() and row['last_sync'] else None,
                description=row['description'] if 'description' in row.keys() else None,
                created_at=datetime.fromisoformat(row['created_at']) if 'created_at' in row.keys() and row['created_at'] else datetime.now(),
                updated_at=datetime.fromisoformat(row['updated_at']) if 'updated_at' in row.keys() and row['updated_at'] else datetime.now(),
            )
            session.add(repo)
        session.commit()
        logger.info(f"  Migrated {len(rows)} git repositories")
    except Exception as e:
        logger.error(f"  Error migrating git repositories: {e}")
        session.rollback()
    finally:
        conn.close()


def migrate_jobs(db_path, session):
    """Migrate jobs from SQLite to PostgreSQL."""
    logger.info("Migrating jobs...")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        rows = cursor.execute("SELECT * FROM jobs").fetchall()
        for row in rows:
            job = Job(
                id=row['id'],
                name=row['name'] if 'name' in row.keys() else 'Unnamed Job',
                job_type=row['type'] if 'type' in row.keys() else 'unknown',
                status=row['status'] if 'status' in row.keys() else 'pending',
                progress=row['progress'] if 'progress' in row.keys() else 0,
                message=row['message'] if 'message' in row.keys() else None,
                result=row['result'] if 'result' in row.keys() else None,
                created_by=row['created_by'] if 'created_by' in row.keys() else None,
                created_at=datetime.fromisoformat(row['created_at']) if 'created_at' in row.keys() and row['created_at'] else datetime.now(),
                started_at=datetime.fromisoformat(row['started_at']) if 'started_at' in row.keys() and row['started_at'] else None,
                completed_at=datetime.fromisoformat(row['completed_at']) if 'completed_at' in row.keys() and row['completed_at'] else None,
            )
            session.add(job)
        session.commit()
        logger.info(f"  Migrated {len(rows)} jobs")
    except Exception as e:
        logger.error(f"  Error migrating jobs: {e}")
        session.rollback()
    finally:
        conn.close()


def main():
    """Main migration function."""
    logger.info("=" * 70)
    logger.info("SQLite to PostgreSQL Migration Script")
    logger.info("=" * 70)
    
    # Check PostgreSQL connection
    logger.info("\nChecking PostgreSQL connection...")
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()")).fetchone()
            logger.info(f"✓ PostgreSQL connection successful")
            logger.info(f"  Version: {result[0]}")
    except Exception as e:
        logger.error(f"✗ PostgreSQL connection failed: {e}")
        logger.error("Please check your database settings in .env file")
        return 1
    
    # Check SQLite databases
    sqlite_dbs = check_sqlite_databases()
    if not sqlite_dbs:
        logger.warning("\nNo SQLite databases found. Nothing to migrate.")
        return 0
    
    # Create PostgreSQL tables
    logger.info("\nCreating PostgreSQL tables...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Tables created successfully")
    except Exception as e:
        logger.error(f"✗ Failed to create tables: {e}")
        return 1
    
    # Start migration
    logger.info("\nStarting data migration...")
    session = get_db_session()
    
    try:
        if "users" in sqlite_dbs:
            migrate_users(sqlite_dbs["users"], session)
        
        if "rbac" in sqlite_dbs:
            migrate_rbac(sqlite_dbs["rbac"], session)
        
        if "settings" in sqlite_dbs:
            migrate_settings(sqlite_dbs["settings"], session)
        
        if "credentials" in sqlite_dbs:
            migrate_credentials(sqlite_dbs["credentials"], session)
        
        if "templates" in sqlite_dbs:
            migrate_templates(sqlite_dbs["templates"], session)
        
        if "git_repositories" in sqlite_dbs:
            migrate_git_repositories(sqlite_dbs["git_repositories"], session)
        
        if "jobs" in sqlite_dbs:
            migrate_jobs(sqlite_dbs["jobs"], session)
        
        logger.info("\n" + "=" * 70)
        logger.info("Migration completed successfully!")
        logger.info("=" * 70)
        logger.info("\nNext steps:")
        logger.info("1. Verify the migrated data in PostgreSQL")
        logger.info("2. Backup your SQLite databases")
        logger.info("3. Update application code to use PostgreSQL")
        logger.info("4. Test thoroughly before deleting SQLite databases")
        
        return 0
        
    except Exception as e:
        logger.error(f"\n✗ Migration failed: {e}")
        return 1
    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
