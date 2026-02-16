"""
Migration 012: Expand deploy_templates column from VARCHAR(255) to TEXT.

The deploy_templates column stores JSON arrays with multiple template entries.
When deploying 4+ templates, the JSON exceeds 255 characters, causing:
  psycopg2.errors.StringDataRightTruncation: value too long for type character varying(255)

This migration alters the column type to TEXT to support unlimited length.
"""

from migrations.base import BaseMigration
from sqlalchemy import text


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "012_expand_deploy_templates_column"

    @property
    def description(self) -> str:
        return "Change deploy_templates column from VARCHAR(255) to TEXT for larger JSON arrays"

    def upgrade(self) -> dict:
        """Alter the deploy_templates column type to TEXT."""
        self.log_info("Expanding deploy_templates column from VARCHAR(255) to TEXT")
        
        try:
            with self.engine.connect() as conn:
                # Check if the column exists first
                check_sql = text("""
                    SELECT column_name, data_type, character_maximum_length
                    FROM information_schema.columns
                    WHERE table_name = 'job_templates'
                      AND column_name = 'deploy_templates'
                """)
                result = conn.execute(check_sql)
                row = result.fetchone()
                
                if row:
                    current_type = row[1]
                    current_length = row[2]
                    self.log_info(f"Current type: {current_type}({current_length})")
                    
                    if current_type == 'text':
                        self.log_info("Column is already TEXT type, no change needed")
                        return {
                            "columns_modified": 0,
                            "message": "deploy_templates already TEXT type"
                        }
                    
                    # Alter the column type
                    alter_sql = text("""
                        ALTER TABLE job_templates
                        ALTER COLUMN deploy_templates TYPE TEXT
                    """)
                    conn.execute(alter_sql)
                    conn.commit()
                    
                    self.log_info("✓ Successfully changed deploy_templates to TEXT")
                    return {
                        "columns_modified": 1,
                        "message": "deploy_templates changed from VARCHAR(255) to TEXT"
                    }
                else:
                    self.log_warning("deploy_templates column not found in job_templates table")
                    return {
                        "columns_modified": 0,
                        "message": "deploy_templates column not found"
                    }
                    
        except Exception as e:
            self.log_error(f"Failed to alter deploy_templates column: {e}")
            raise
