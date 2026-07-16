"""Celery task for CSV prefix update — thin entry point."""

from typing import Any, Dict, Optional

from celery_app import celery_app
from services.nautobot.imports.prefix_update_service import PrefixUpdateService

_prefix_update_service = PrefixUpdateService()


@celery_app.task(name="tasks.update_ip_prefixes_from_csv", bind=True)
def update_ip_prefixes_from_csv_task(
    self,
    csv_content: str,
    csv_options: Optional[Dict[str, Any]] = None,
    dry_run: bool = False,
    ignore_uuid: bool = True,
    tags_mode: str = "replace",
    column_mapping: Optional[Dict[str, str]] = None,
    selected_columns: Optional[list] = None,
    primary_key_column: Optional[str] = None,
) -> dict:
    """Celery task wrapper — delegates to PrefixUpdateService."""
    return _prefix_update_service.run_update(
        task_context=self,
        csv_content=csv_content,
        csv_options=csv_options,
        dry_run=dry_run,
        ignore_uuid=ignore_uuid,
        tags_mode=tags_mode,
        column_mapping=column_mapping,
        selected_columns=selected_columns,
        primary_key_column=primary_key_column,
    )
