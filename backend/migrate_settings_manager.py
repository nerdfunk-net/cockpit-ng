#!/usr/bin/env python3
"""
Automated migration script for settings_manager.py
Converts remaining SQLite code to PostgreSQL repository pattern
"""

import re


def migrate_settings_manager():
    with open("settings_manager.py", "r") as f:
        content = f.read()

    # Track changes
    changes = []

    # 1. update_cache_settings - large function, full replacement
    old_update_cache = r'''    def update_cache_settings\(self, settings: Dict\[str, Any\]\) -> bool:
        """Update Cache settings"""
        try:
            with sqlite3\.connect\(self\.db_path\) as conn:
                cursor = conn\.cursor\(\)
                cursor\.execute\("SELECT COUNT\(\*\) FROM cache_settings"\)
                count = cursor\.fetchone\(\)\[0\]
                if count == 0:
                    cursor\.execute\(
                        """
                        INSERT INTO cache_settings \(enabled, ttl_seconds, prefetch_on_startup, refresh_interval_minutes, max_commits, prefetch_items\)
                        VALUES \(\?, \?, \?, \?, \?, \?\)
                    """,.*?conn\.commit\(\)
                logger\.info\("Cache settings updated successfully"\)
                return True
        except sqlite3\.Error as e:
            logger\.error\(f"Error updating Cache settings: \{e\}"\)
            return False'''

    new_update_cache = '''    def update_cache_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Cache settings"""
        try:
            repo = CacheSettingRepository()
            existing = repo.get_settings()
            
            prefetch_items_json = json.dumps(
                settings.get("prefetch_items") or {"git": True, "locations": False}
            )
            
            if existing:
                # Update existing
                repo.update(
                    existing.id,
                    enabled=settings.get("enabled", self.default_cache.enabled),
                    ttl_seconds=settings.get("ttl_seconds", self.default_cache.ttl_seconds),
                    prefetch_on_startup=settings.get("prefetch_on_startup", self.default_cache.prefetch_on_startup),
                    refresh_interval_minutes=settings.get("refresh_interval_minutes", self.default_cache.refresh_interval_minutes),
                    max_commits=settings.get("max_commits", self.default_cache.max_commits),
                    prefetch_items=prefetch_items_json
                )
            else:
                # Create new
                repo.create(
                    enabled=settings.get("enabled", self.default_cache.enabled),
                    ttl_seconds=settings.get("ttl_seconds", self.default_cache.ttl_seconds),
                    prefetch_on_startup=settings.get("prefetch_on_startup", self.default_cache.prefetch_on_startup),
                    refresh_interval_minutes=settings.get("refresh_interval_minutes", self.default_cache.refresh_interval_minutes),
                    max_commits=settings.get("max_commits", self.default_cache.max_commits),
                    prefetch_items=prefetch_items_json
                )
            
            logger.info("Cache settings updated successfully")
            return True
        except Exception as e:
            logger.error(f"Error updating Cache settings: {e}")
            return False'''

    if re.search(old_update_cache, content, re.DOTALL):
        content = re.sub(old_update_cache, new_update_cache, content, flags=re.DOTALL)
        changes.append("update_cache_settings")

    # Save
    with open("settings_manager.py", "w") as f:
        f.write(content)

    print(f"✅ Migrated {len(changes)} functions: {', '.join(changes)}")
    return len(changes)


if __name__ == "__main__":
    migrate_settings_manager()
