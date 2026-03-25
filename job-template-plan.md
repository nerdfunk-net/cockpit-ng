# Plan: CSV Export Job Template

## Context
Add a new "csv_export" job template type that exports Nautobot devices to a CSV file and commits it to a configured Git repository. The existing `export_devices_task` handles Nautobot data fetching and CSV generation; what's missing is the Git write-back flow and the job template configuration UI.

---

## Backend Changes

### 1. Database Migration (`/backend/migrations/versions/023_add_csv_export_template_fields.py`)
Mirror the pattern from `018_add_csv_import_template_fields.py`. Add columns to `job_templates` table:
- `csv_export_repo_id` INTEGER
- `csv_export_file_path` VARCHAR(500)
- `csv_export_properties` TEXT (JSON list)
- `csv_export_delimiter` VARCHAR(10)
- `csv_export_quote_char` VARCHAR(10)
- `csv_export_include_headers` BOOLEAN DEFAULT TRUE

### 2. `/backend/core/models.py`
Add columns to `JobTemplate` SQLAlchemy model (after csv_import block, before `is_global`):
```python
# CSV Export (csv_export type)
csv_export_repo_id = Column(Integer, nullable=True)
csv_export_file_path = Column(String(500), nullable=True)
csv_export_properties = Column(Text, nullable=True)   # JSON list of property names
csv_export_delimiter = Column(String(10), nullable=True)
csv_export_quote_char = Column(String(10), nullable=True)
csv_export_include_headers = Column(Boolean, nullable=True, default=True)
```

### 3. `/backend/models/job_templates.py`
- Add `"csv_export"` to `JobTemplateType` Literal
- Add to `JobTemplateBase`:
```python
csv_export_repo_id: Optional[int] = Field(None, ...)
csv_export_file_path: Optional[str] = Field(None, max_length=500, ...)
csv_export_properties: Optional[List[str]] = Field(None, ...)
csv_export_delimiter: Optional[str] = Field(None, max_length=10, ...)
csv_export_quote_char: Optional[str] = Field(None, max_length=10, ...)
csv_export_include_headers: bool = Field(True, ...)
```
- Add same optional fields to `JobTemplateUpdate`

### 4. `/backend/job_template_manager.py`
Handle JSON serialization of `csv_export_properties` (a list) — same pattern as `deploy_templates` and `csv_import_column_mapping`. When reading from DB: `json.loads()`, when writing: `json.dumps()`.

### 5. `/backend/tasks/csv_export_task.py` (new file)
New Celery task `tasks.csv_export`:

```python
@celery_app.task(name="tasks.csv_export", bind=True)
def csv_export_task(self, device_ids, properties, csv_options, repo_id, file_path, job_run_id=None)
```

Steps:
1. Update task state: "Fetching devices from Nautobot"
2. Fetch + generate CSV by reusing helpers extracted from `export_devices_task.py` (see note below)
3. Update task state: "Syncing git repository"
4. Load repo: `git_repo_manager.get_repository(repo_id)`
5. Sync: `git_service = service_factory.build_git_service()` → `git_service.pull(repository)`
6. Resolve repo path: `repo_dir = service_factory.build_git_service().get_repo_path(repository)` (or `repo_path(repository)` from `services.settings.git.paths`)
7. Write CSV: `os.makedirs(os.path.dirname(full_path), exist_ok=True)` then write file
8. Open repo: `from git import Repo; git_repo = Repo(repo_dir)`
9. Commit & push: `git_service.commit_and_push(repository=dict(repository), message=f"CSV Export {date}", repo=git_repo, add_all=True, branch=repository.get("branch") or "main")`
10. Update job run via `job_run_manager.mark_completed(job_run_id, result=...)`
11. Return: `{success, devices_exported, file_path, commit_sha, pushed}`

**Pattern reference** (proven in `backend/tasks/backup_tasks.py`):
```python
import service_factory
git_service = service_factory.build_git_service()
result = git_service.commit_and_push(
    repository=dict(repository),
    message=commit_message,
    repo=git_repo,
    add_all=True,
    branch=repository.get("branch") or "main",
)
```

**Note on CSV generation reuse:** Extract the core CSV generation logic from `export_devices_task.py` into a private helper `_build_csv_content(devices, properties, csv_options) -> str` and call it from both tasks. This avoids duplicating ~300 lines.

### 6. `/backend/routers/jobs/device_tasks.py`
Add endpoint (mirror pattern of `trigger_import_or_update_from_csv` at line ~991):
```
POST /api/celery/tasks/csv-export
```
- Accept: Pydantic model `CsvExportRequest` with `{ device_ids, properties, delimiter, quote_char, include_headers, repo_id, file_path, template_id }`
- Create `JobRun` via `job_run_manager.create_job_run(job_type="csv_export", ...)`
- Enqueue `csv_export_task.delay(...)`
- Mark started: `job_run_manager.mark_started(job_run["id"], task.id)`
- Return `TaskWithJobResponse`
- Permission: `nautobot.export:execute`

---

## Frontend Changes

### 7. `/frontend/src/components/features/jobs/templates/types/index.ts`
Add `'csv_export'` to the `JobType` union and add csv_export fields to `JobTemplate` interface.

### 8. `/frontend/src/components/features/jobs/templates/utils/constants.ts`
Add `csv_export` to job type constants with label "CSV Export" and appropriate color/icon.

### 9. `/frontend/src/components/features/jobs/templates/schemas/template-schema.ts`
Add `csv_export` discriminated union branch to the Zod schema with required fields: `csv_export_repo_id`, `csv_export_file_path`, `csv_export_properties`.

### 10. New: `/frontend/src/components/features/jobs/templates/components/template-types/CsvExportJobTemplate.tsx`
Configuration UI modeled after `CsvImportJobTemplate.tsx`:
- **Git Repository selector**: filtered by `category=csv_exports` — reuse `useCsvExportRepos()` hook
- **Filename input**: text field (e.g., `exports/devices.csv`)
- **Properties selector**: Reuse the property list from the export app (`/components/features/nautobot/export/tabs/properties-tab.tsx`). Use a multi-select or checkbox list with the same property constants.
- **Delimiter input**: single char input, default `,`
- **Quote character input**: single char input, default `"`
- **Include headers toggle**: boolean switch, default on

### 11. `/frontend/src/components/features/jobs/templates/hooks/use-template-queries.ts`
Add `useCsvExportRepos()` hook — fetches git repos filtered by `category=csv_exports` (same pattern as `useCsvImportRepos()` which filters `category=csv_imports`).

### 12. `/frontend/src/components/features/jobs/templates/components/template-form-dialog.tsx`
- Import and render `CsvExportJobTemplate` when `formJobType === 'csv_export'`
- Include csv_export fields in the form state and submission payload

---

## Available Utilities to Reuse

| Utility | Location | Used for |
|---|---|---|
| `service_factory.build_git_service()` | `backend/service_factory.py` | Get git service in Celery task |
| `git_service.pull(repository)` | `backend/services/settings/git/service.py:269` | Sync before write |
| `git_service.commit_and_push(...)` | `backend/services/settings/git/service.py` | Commit after write |
| `git_repo_manager.get_repository(id)` | `backend/git_repositories_manager.py` | Load repo config |
| `repo_path(repository)` | `backend/services/settings/git/paths.py` | Resolve filesystem path |
| Export CSV logic | `backend/tasks/export_devices_task.py` | Extract as shared helper |
| Properties list | `frontend/.../nautobot/export/tabs/properties-tab.tsx` | Reuse in UI |
| CSV import repo hook pattern | `frontend/.../hooks/use-template-queries.ts:useCsvImportRepos` | Model csv_export repos hook |

---

## Verification

1. **Backend unit test**: Create a job template of type `csv_export`, verify all fields are saved/loaded correctly
2. **Integration test**: Trigger the `csv_export_task` with a test repo and verify:
   - CSV file is written to the repo path
   - Git shows the new commit
   - `JobRun` is marked completed
3. **Frontend smoke test**: Open "Job Templates", create a new CSV Export template, verify all fields render correctly and are submitted in the API request
4. **End-to-end**: Create template → run it from scheduler or manual trigger → check Jobs/View shows completed → verify file in git repo

---

## Files to Modify/Create

**Backend (modify):**
- `backend/core/models.py` — add db columns
- `backend/models/job_templates.py` — add pydantic fields and type
- `backend/job_template_manager.py` — handle list serialization
- `backend/tasks/export_devices_task.py` — extract CSV generation helper
- `backend/routers/jobs/device_tasks.py` — add trigger endpoint

**Backend (create):**
- `backend/tasks/csv_export_task.py` — new Celery task
- Migration file for new db columns

**Frontend (modify):**
- `frontend/src/components/features/jobs/templates/types/index.ts`
- `frontend/src/components/features/jobs/templates/utils/constants.ts`
- `frontend/src/components/features/jobs/templates/schemas/template-schema.ts`
- `frontend/src/components/features/jobs/templates/hooks/use-template-queries.ts`
- `frontend/src/components/features/jobs/templates/components/template-form-dialog.tsx`

**Frontend (create):**
- `frontend/src/components/features/jobs/templates/components/template-types/CsvExportJobTemplate.tsx`
