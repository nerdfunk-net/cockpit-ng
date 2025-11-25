"""
Job Schedule Database Manager
Handles CRUD operations for scheduled jobs
"""
import sqlite3
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path
import os

logger = logging.getLogger(__name__)

# Database path
DATA_DIR = Path(__file__).parent / "../data/settings"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "jobs.db"


def get_connection():
    """Get database connection"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the jobs database"""
    conn = get_connection()
    cursor = conn.cursor()

    # Create job_schedules table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS job_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_identifier TEXT NOT NULL,
            job_name TEXT NOT NULL,
            schedule_type TEXT NOT NULL,
            cron_expression TEXT,
            interval_minutes INTEGER,
            start_time TEXT,
            start_date TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            is_global BOOLEAN NOT NULL DEFAULT 1,
            user_id INTEGER,
            credential_id INTEGER,
            job_parameters TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_run TIMESTAMP,
            next_run TIMESTAMP
        )
    """)

    # Create index for faster queries
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_job_identifier
        ON job_schedules(job_identifier)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_id
        ON job_schedules(user_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_is_global
        ON job_schedules(is_global)
    """)

    conn.commit()
    conn.close()
    logger.info("Jobs database initialized")


def create_job_schedule(
    job_identifier: str,
    job_name: str,
    schedule_type: str,
    is_active: bool = True,
    is_global: bool = True,
    user_id: Optional[int] = None,
    cron_expression: Optional[str] = None,
    interval_minutes: Optional[int] = None,
    start_time: Optional[str] = None,
    start_date: Optional[str] = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a new job schedule"""
    import json

    conn = get_connection()
    cursor = conn.cursor()

    # Convert job_parameters to JSON string
    params_json = json.dumps(job_parameters) if job_parameters else None

    cursor.execute("""
        INSERT INTO job_schedules
        (job_identifier, job_name, schedule_type, cron_expression, interval_minutes,
         start_time, start_date, is_active, is_global, user_id, credential_id, job_parameters)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (job_identifier, job_name, schedule_type, cron_expression, interval_minutes,
          start_time, start_date, is_active, is_global, user_id, credential_id, params_json))

    job_id = cursor.lastrowid
    conn.commit()
    conn.close()

    logger.info(f"Created job schedule: {job_name} (ID: {job_id})")
    return get_job_schedule(job_id)


def get_job_schedule(job_id: int) -> Optional[Dict[str, Any]]:
    """Get a job schedule by ID"""
    import json

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM job_schedules WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        result = dict(row)
        # Parse job_parameters JSON
        if result.get('job_parameters'):
            result['job_parameters'] = json.loads(result['job_parameters'])
        return result
    return None


def list_job_schedules(
    user_id: Optional[int] = None,
    is_global: Optional[bool] = None,
    is_active: Optional[bool] = None
) -> List[Dict[str, Any]]:
    """List job schedules with optional filters"""
    import json

    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM job_schedules WHERE 1=1"
    params = []

    if user_id is not None:
        query += " AND (user_id = ? OR is_global = 1)"
        params.append(user_id)

    if is_global is not None:
        query += " AND is_global = ?"
        params.append(is_global)

    if is_active is not None:
        query += " AND is_active = ?"
        params.append(is_active)

    query += " ORDER BY created_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        result = dict(row)
        # Parse job_parameters JSON
        if result.get('job_parameters'):
            result['job_parameters'] = json.loads(result['job_parameters'])
        results.append(result)

    return results


def update_job_schedule(
    job_id: int,
    job_name: Optional[str] = None,
    schedule_type: Optional[str] = None,
    cron_expression: Optional[str] = None,
    interval_minutes: Optional[int] = None,
    start_time: Optional[str] = None,
    start_date: Optional[str] = None,
    is_active: Optional[bool] = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Update a job schedule"""
    import json

    conn = get_connection()
    cursor = conn.cursor()

    # Build update query dynamically
    updates = []
    params = []

    if job_name is not None:
        updates.append("job_name = ?")
        params.append(job_name)

    if schedule_type is not None:
        updates.append("schedule_type = ?")
        params.append(schedule_type)

    if cron_expression is not None:
        updates.append("cron_expression = ?")
        params.append(cron_expression)

    if interval_minutes is not None:
        updates.append("interval_minutes = ?")
        params.append(interval_minutes)

    if start_time is not None:
        updates.append("start_time = ?")
        params.append(start_time)

    if start_date is not None:
        updates.append("start_date = ?")
        params.append(start_date)

    if is_active is not None:
        updates.append("is_active = ?")
        params.append(is_active)

    if credential_id is not None:
        updates.append("credential_id = ?")
        params.append(credential_id)

    if job_parameters is not None:
        updates.append("job_parameters = ?")
        params.append(json.dumps(job_parameters))

    if not updates:
        conn.close()
        return get_job_schedule(job_id)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(job_id)

    query = f"UPDATE job_schedules SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()

    logger.info(f"Updated job schedule ID: {job_id}")
    return get_job_schedule(job_id)


def delete_job_schedule(job_id: int) -> bool:
    """Delete a job schedule"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM job_schedules WHERE id = ?", (job_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()

    if deleted:
        logger.info(f"Deleted job schedule ID: {job_id}")
    return deleted


def update_job_run_times(
    job_id: int,
    last_run: Optional[datetime] = None,
    next_run: Optional[datetime] = None
) -> bool:
    """Update last_run and next_run times for a job"""
    conn = get_connection()
    cursor = conn.cursor()

    updates = []
    params = []

    if last_run is not None:
        updates.append("last_run = ?")
        params.append(last_run.isoformat())

    if next_run is not None:
        updates.append("next_run = ?")
        params.append(next_run.isoformat())

    if not updates:
        conn.close()
        return False

    params.append(job_id)
    query = f"UPDATE job_schedules SET {', '.join(updates)} WHERE id = ?"

    cursor.execute(query, params)
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return updated


def get_user_job_schedules(user_id: int) -> List[Dict[str, Any]]:
    """Get all job schedules accessible by a user (global + their private jobs)"""
    return list_job_schedules(user_id=user_id)


def get_global_job_schedules() -> List[Dict[str, Any]]:
    """Get all global job schedules"""
    return list_job_schedules(is_global=True)


# Initialize database on module import
init_db()
