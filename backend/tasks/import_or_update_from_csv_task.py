"""Celery task for CSV import — thin entry point."""

from celery_app import celery_app
from services.nautobot.imports.csv_import_service import CsvImportService

_csv_import_service = CsvImportService()


def _run_csv_import(task_context, **kwargs) -> dict:
    """Synchronous entry point used by csv_import_executor (dispatch_job)."""
    return _csv_import_service.run_import(task_context=task_context, **kwargs)


@celery_app.task(name="tasks.import_or_update_from_csv", bind=True)
def import_or_update_from_csv_task(
    self,
    import_type: str,
    primary_key: str,
    source: str = "git",
    repo_id: int | None = None,
    file_path: str = "",
    agent_id: str | None = None,
    agent_flows: list | None = None,
    update_existing: bool = True,
    import_unknown: bool = True,
    delimiter: str = ",",
    quote_char: str = '"',
    column_mapping: dict | None = None,
    dry_run: bool = False,
    template_id: int | None = None,
    file_filter: str | None = None,
    profile_id: int | None = None,
    import_format: str = "generic",
    add_prefixes: bool = False,
    default_prefix_length: str | None = None,
) -> dict:
    """Celery task wrapper — delegates to CsvImportService."""
    return _csv_import_service.run_import(
        task_context=self,
        import_type=import_type,
        primary_key=primary_key,
        source=source,
        repo_id=repo_id,
        file_path=file_path,
        agent_id=agent_id,
        agent_flows=agent_flows,
        update_existing=update_existing,
        import_unknown=import_unknown,
        delimiter=delimiter,
        quote_char=quote_char,
        column_mapping=column_mapping,
        dry_run=dry_run,
        template_id=template_id,
        file_filter=file_filter,
        profile_id=profile_id,
        import_format=import_format,
        add_prefixes=add_prefixes,
        default_prefix_length=default_prefix_length,
    )
