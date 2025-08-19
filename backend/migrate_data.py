#!/usr/bin/env python3
"""
Data migration script to move data from project directory to user data directory.
"""

import os
import shutil
from config import settings

def migrate_data():
    """Migrate data from old location to new location"""
    old_data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    new_data_dir = settings.data_directory

    print(f"Migrating data from: {old_data_dir}")
    print(f"                 to: {new_data_dir}")

    if not os.path.exists(old_data_dir):
        print("No old data directory found, nothing to migrate.")
        return

    if os.path.exists(new_data_dir):
        print("New data directory already exists. Skipping migration.")
        print("If you want to force migration, delete the new directory first:")
        print(f"  rm -rf {new_data_dir}")
        return

    try:
        # Create parent directory
        os.makedirs(os.path.dirname(new_data_dir), exist_ok=True)

        # Copy the entire data directory
        shutil.copytree(old_data_dir, new_data_dir)
        print("Migration completed successfully!")
        print("You can now safely delete the old data directory:")
        print(f"  rm -rf {old_data_dir}")

    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate_data()
