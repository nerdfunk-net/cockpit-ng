"""
Celery worker lifecycle signals for proper database connection handling.

This module ensures each worker process gets its own isolated database engine
and connection pool, preventing the "PGRES_TUPLES_OK" error that occurs when
multiple processes share PostgreSQL connections.

Background:
-----------
When Celery uses the prefork pool (default), it creates a parent process and then
forks multiple child worker processes. If the SQLAlchemy engine is created before
forking, all child processes inherit the same database connection file descriptors.

PostgreSQL connections have internal state that assumes single-process ownership.
When multiple processes try to use the same connection, it leads to:
  - "error with status PGRES_TUPLES_OK and no message from the libpq"
  - Connection pool corruption
  - Unpredictable transaction boundaries

Solution:
---------
Use Celery worker lifecycle signals to:
1. Dispose of parent's database engine before workers start using it
2. Create fresh engine + connection pool in each worker process after forking
3. Properly clean up connections on worker shutdown

Each worker process gets its own isolated engine with its own connection pool,
completely avoiding the connection sharing issue.

References:
-----------
- Celery Signals: https://docs.celeryq.dev/en/stable/userguide/signals.html
- SQLAlchemy Multi-processing: https://docs.sqlalchemy.org/en/20/core/pooling.html#using-connection-pools-with-multiprocessing
"""

import logging
from celery import signals
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)


@signals.worker_process_init.connect
def init_worker_process(**kwargs):
    """
    Initialize database engine for each worker process AFTER forking.

    This signal fires after a worker child process has been forked from the parent,
    ensuring each process gets its own isolated database connection pool.

    Called once per worker process on startup.

    Args:
        **kwargs: Signal metadata including 'sender' (worker instance)
    """
    import os
    from core import database
    from config import settings

    pid = os.getpid()
    logger.info(f"[Worker Init] Initializing database engine for worker PID={pid}")

    # CRITICAL: Dispose of any inherited connections from parent process
    # This prevents connection sharing across processes which causes SIGSEGV
    if hasattr(database, "engine") and database.engine is not None:
        logger.info("[Worker Init] Disposing parent's database engine")
        try:
            database.engine.dispose(close=False)
            # Set to None to ensure we don't accidentally reuse it
            database.engine = None
        except Exception as e:
            logger.warning(f"[Worker Init] Error disposing parent engine: {e}")

    # Also dispose SessionLocal if it exists
    if hasattr(database, "SessionLocal") and database.SessionLocal is not None:
        try:
            database.SessionLocal.close_all()
        except Exception as e:
            logger.warning(f"[Worker Init] Error closing sessions: {e}")

    # Create new engine with fresh connection pool for this worker process
    logger.info(
        f"[Worker Init] Creating new database engine: "
        f"postgresql://{settings.database_username}@{settings.database_host}:{settings.database_port}/{settings.database_name}"
    )

    try:
        database.engine = create_engine(
            settings.database_url,
            pool_size=5,  # Connections per worker process
            max_overflow=10,  # Additional connections when pool exhausted
            pool_pre_ping=True,  # Verify connections are alive before use
            pool_recycle=3600,  # Recycle connections after 1 hour
            echo=False,  # SQL logging disabled (use LOG_LEVEL for application logging)
            # Important for forking: create connections lazily
            pool_timeout=30,
            connect_args={"connect_timeout": 10},
        )

        # Recreate session factory with new engine
        database.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=database.engine
        )

        # Note: We don't test the connection here because:
        # 1. pool_pre_ping=True will verify connections before use
        # 2. Testing immediately after fork can cause SIGSEGV on some systems (macOS)
        # 3. The first task that uses the DB will validate the connection
        # 4. Lazy connection creation avoids immediate psycopg2 calls after fork

        logger.info(
            f"[Worker Init] Database engine initialized successfully for PID={pid}"
        )

    except Exception as e:
        logger.error(f"[Worker Init] Failed to initialize database engine: {e}")
        import traceback

        logger.error(traceback.format_exc())
        raise


@signals.worker_process_shutdown.connect
def shutdown_worker_process(**kwargs):
    """
    Clean up database connections when worker process shuts down.

    This ensures proper cleanup of connection pools when a worker is restarted
    or when max_tasks_per_child limit is reached.

    Called once per worker process on shutdown.

    Args:
        **kwargs: Signal metadata including 'sender' (worker instance)
    """
    from core import database

    logger.info(
        f"[Worker Shutdown] Cleaning up database connections for worker {kwargs.get('sender')}"
    )

    if hasattr(database, "engine") and database.engine:
        try:
            database.engine.dispose()
            logger.info("[Worker Shutdown] Database engine disposed")
        except Exception as e:
            logger.warning(f"[Worker Shutdown] Error disposing engine: {e}")


@signals.worker_init.connect
def init_worker(**kwargs):
    """
    Called when the worker main process is initialized.

    This runs BEFORE worker_process_init (which runs in child processes).
    We MUST dispose of any database connections here to ensure clean forking.

    Note: With prefork pool, this runs in the parent process before forking.

    Args:
        **kwargs: Signal metadata
    """
    import os
    from core import database

    pid = os.getpid()
    logger.info(f"[Worker Main] Celery worker initialized (parent process PID={pid})")

    # CRITICAL: Dispose of any database connections in parent process
    # before forking to avoid connection sharing
    if hasattr(database, "engine") and database.engine is not None:
        logger.info(
            "[Worker Main] Disposing database engine in parent process before forking"
        )
        try:
            database.engine.dispose(close=False)
            database.engine = None
        except Exception as e:
            logger.warning(f"[Worker Main] Error disposing engine: {e}")

    if hasattr(database, "SessionLocal") and database.SessionLocal is not None:
        try:
            database.SessionLocal.close_all()
        except Exception as e:
            logger.warning(f"[Worker Main] Error closing sessions: {e}")

    logger.info(
        "[Worker Main] Worker child processes will initialize their own database engines"
    )


@signals.worker_ready.connect
def worker_ready(**kwargs):
    """
    Called when worker is ready to accept tasks.

    All worker processes have been initialized at this point.

    Args:
        **kwargs: Signal metadata
    """
    logger.info("[Worker Ready] Celery worker is ready to accept tasks")
    logger.info("[Worker Ready] Using queue configuration from celery_app.py")
