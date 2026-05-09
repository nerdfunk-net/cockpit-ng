"""Celery task for CSV import — thin entry point."""

from celery_app import celery_app
from services.nautobot.import.csv_import_service import CsvImportService

_csv_import_service = CsvImportService()


@celery_app.task(name="tasks.import_or_update_from_csv", bind=True)
def import_or_update_from_csv_task(
    self,
    repo_id: int,
    file_path: str,
    import_type: str,
    primary_key: str,
    update_existing: bool = True,
    delimiter: str = ",",
    quote_char: str = '"',
    column_mapping: dict | None = None,
    dry_run: bool = False,
    template_id: int | None = None,
    file_filter: str | None = None,
    defaults: dict | None = None,
    import_format: str = "generic",
    add_prefixes: bool = False,
    default_prefix_length: str | None = None,
) -> dict:
    """Celery task wrapper — delegates to CsvImportService."""
    return _csv_import_service.run_import(
        task_context=self,
        repo_id=repo_id,
        file_path=file_path,
        import_type=import_type,
        primary_key=primary_key,
        update_existing=update_existing,
        delimiter=delimiter,
        quote_char=quote_char,
        column_mapping=column_mapping,
        dry_run=dry_run,
        template_id=template_id,
        file_filter=file_filter,
        defaults=defaults,
        import_format=import_format,
        add_prefixes=add_prefixes,
        default_prefix_length=default_prefix_length,
    )
