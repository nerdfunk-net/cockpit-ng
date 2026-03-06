"""
Executor for the 'CSV Import' (csv_import) job type.
Reads CSV import settings from the job template and delegates to the
import_or_update_from_csv_task Celery task (runs synchronously inside
the same worker process via direct function call).
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def execute_csv_import(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute csv_import job.

    Reads all CSV import settings from the job template and calls
    import_or_update_from_csv_task to process the CSV file(s).
    """
    from tasks.import_or_update_from_csv_task import _run_csv_import

    if not template:
        return {"success": False, "error": "No job template provided for csv_import job"}

    repo_id = template.get("csv_import_repo_id")
    file_path = template.get("csv_import_file_path") or ""
    import_type = template.get("csv_import_type") or ""
    primary_key = template.get("csv_import_primary_key") or ""
    update_existing = template.get("csv_import_update_existing", True)
    delimiter = template.get("csv_import_delimiter") or ","
    quote_char = template.get("csv_import_quote_char") or '"'
    column_mapping = template.get("csv_import_column_mapping") or {}
    file_filter = template.get("csv_import_file_filter") or None
    csv_import_defaults = template.get("csv_import_defaults") or None
    template_id = template.get("id")

    if not repo_id:
        return {"success": False, "error": "csv_import_repo_id is not configured in the job template"}
    if not import_type:
        return {"success": False, "error": "csv_import_type is not configured in the job template"}
    if not primary_key:
        return {"success": False, "error": "csv_import_primary_key is not configured in the job template"}
    if not file_path and not file_filter:
        return {"success": False, "error": "csv_import_file_path or csv_import_file_filter must be configured"}

    logger.info(
        "Executing csv_import job: repo_id=%s, file_path=%s, file_filter=%s, "
        "import_type=%s, primary_key=%s, update_existing=%s, delimiter=%r, quote_char=%r, "
        "defaults=%s",
        repo_id, file_path, file_filter, import_type, primary_key,
        update_existing, delimiter, quote_char, csv_import_defaults,
    )

    # Call the extracted implementation function directly, passing task_context as
    # the first arg so update_state() and request.id work against the dispatch_job task.
    return _run_csv_import(
        task_context,
        repo_id=repo_id,
        file_path=file_path,
        import_type=import_type,
        primary_key=primary_key,
        update_existing=update_existing,
        delimiter=delimiter,
        quote_char=quote_char,
        column_mapping=column_mapping,
        dry_run=False,
        template_id=template_id,
        file_filter=file_filter,
        defaults=csv_import_defaults,
    )
