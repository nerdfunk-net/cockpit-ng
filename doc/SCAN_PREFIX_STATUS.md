# Network Scan Prefix Status - Analysis and Bug Documentation

## Overview

The "Network Scan Status" card on the Dashboard displays a summary of the most recent `scan_prefixes` job execution. It shows:
- Total number of prefixes scanned
- Total IPs scanned
- Number of reachable IPs
- Number of unreachable IPs
- Reachability percentage

## Architecture Flow

### Frontend Component
**Location**: `frontend/src/components/layout/dashboard-scan-prefix-stats.tsx`

The component:
1. Calls the API endpoint: `GET /api/job-runs/dashboard/scan-prefix`
2. Displays the returned statistics
3. Shows visual indicators including progress bars and formatted numbers

**Expected Response Schema**:
```typescript
interface ScanPrefixResult {
  has_data: boolean
  message?: string
  job_id?: number
  job_name?: string
  completed_at?: string
  total_prefixes?: number          // Number of network prefixes scanned
  total_ips_scanned?: number       // Total IPs checked
  total_reachable?: number         // Reachable IPs
  total_unreachable?: number       // Unreachable IPs
  reachability_percent?: number    // Percentage of reachable IPs
  resolve_dns?: boolean
  success?: boolean
  was_split?: boolean              // Indicates if job was split into sub-tasks
}
```

### Backend Endpoint
**Location**: `backend/routers/jobs/runs.py` - Line 197
**Route**: `GET /dashboard/scan-prefix`

**Logic Flow**:
1. Fetches the **20 most recent** completed `scan_prefixes` jobs
2. Builds a set of all sub-task celery IDs from these 20 jobs
3. Finds the most recent job that is NOT a sub-task (i.e., parent or standalone job)
4. Determines if the job was split:
   - **Case 1 (Split Job)**: Job has `sub_task_ids` in result
     - Aggregates `total_ips_scanned`, `total_reachable`, `total_unreachable` from sub-tasks
     - Gets `total_prefixes` from parent's `result["prefixes"]` list
   - **Case 2 (Regular Job)**: No splitting occurred
     - Uses values directly from the job result

### Task Execution
**Location**: `backend/tasks/scan_prefixes_task.py`

The scan_prefixes task can operate in two modes:

#### Mode 1: Regular Execution
When the total IPs to scan is below `scan_max_ips` (default: 10,000):
- Fetches all prefixes matching the custom field filter from Nautobot
- Expands each prefix to individual IPs
- Pings all IPs using fping
- Stores result with structure:
```python
{
    "success": True,
    "prefixes": prefix_results,        # Detailed per-prefix results
    "total_prefixes": len(cidrs),      # Count of prefixes
    "total_ips_scanned": len(all_ips),
    "total_reachable": len(alive_ips),
    "total_unreachable": len(all_ips) - len(alive_ips),
    "resolve_dns": resolve_dns,
}
```

#### Mode 2: Split Execution (Line 520-580)
When total IPs exceeds `scan_max_ips`:
- Splits prefixes into multiple batches
- Spawns sub-tasks for each batch
- Parent job stores:
```python
{
    "success": True,
    "message": f"Job split into {len(batches)} sub-tasks due to IP limit",
    "total_prefixes": len(original_cidrs),  # Original prefix count
    "prefixes": original_cidrs,              # ORIGINAL prefixes list
    "total_ips_to_scan": total_ips_count,
    "split_into_batches": len(batches),
    "sub_task_ids": sub_task_ids,           # List of celery task IDs
}
```

Each sub-task executes independently and stores its own result with the regular structure.

## THE BUG: Incomplete Sub-Task Aggregation

### Problem Description

In production environments scanning dozens of IP prefixes with long-running jobs (e.g., 1 hour), the dashboard incorrectly shows "1 prefix" was scanned instead of the actual number (e.g., dozens).

### Root Cause

**Location**: `backend/routers/jobs/runs.py` - Lines 213-215, 260-268

The bug has two related issues:

#### Issue 1: Limited Query Scope
```python
runs = job_run_manager.get_recent_runs(
    limit=20, status="completed", job_type="scan_prefixes"
)
```

The endpoint only fetches the **20 most recent** completed `scan_prefixes` jobs. When a parent job is split into more than 20 sub-tasks:
- Only the first 20 jobs (by completion time) are retrieved
- Sub-tasks that completed earlier or later are **missing** from the `runs` list
- The aggregation loop (lines 260-268) cannot find these missing sub-tasks
- Their statistics are **not included** in the totals

#### Issue 2: Prefix Count Logic
```python
# Line 272-274
# Use actual prefixes list from parent for accurate count
prefixes_list = result.get("prefixes", [])
total_prefixes = len(prefixes_list) if prefixes_list else result.get("total_prefixes", 0)
```

When the parent job is split:
- The parent's `result["prefixes"]` contains the **original list** of CIDR strings (e.g., `["10.0.0.0/24", "10.0.1.0/24", ...]`)
- The code correctly tries to use `len(prefixes_list)` to count them
- **However**, this count is correct, so this is not actually the issue

#### The Real Issue: Incomplete Sub-Task Discovery

Looking more carefully at the logic:
1. Parent job stores: `prefixes = ["10.0.0.0/24", "10.0.1.0/24", ...]` (e.g., 50 prefixes)
2. Parent creates sub-tasks with IDs: `sub_task_ids = [task1, task2, ..., task50]`
3. Dashboard endpoint fetches only 20 most recent completed scan_prefixes jobs
4. If there are 50 sub-tasks, only ~19-20 are in the retrieved list (minus the parent = ~19)
5. The remaining 30-31 sub-tasks are not in `runs` and cannot be aggregated

### Reproduction Scenario

**Lab Environment (Working)**:
- Scans 5-10 prefixes
- Job completes quickly
- Creates < 20 sub-tasks (or no splitting)
- All jobs fit within the `limit=20` query
- ✅ Dashboard shows correct count

**Production Environment (Broken)**:
- Scans dozens of prefixes (e.g., 50)
- Job runs for ~1 hour
- Creates 50+ sub-tasks
- Query retrieves only 20 most recent jobs
- 30+ sub-tasks are missing from aggregation
- ❌ Dashboard shows only statistics from ~19 sub-tasks
- ❌ IP counts are incomplete
- ✅ Prefix count is still correct (from parent)

### Why Prefix Count is Correct But IPs Are Wrong

The code at line 272-274 reads the prefix list directly from the parent job's result, which is always complete:
```python
prefixes_list = result.get("prefixes", [])  # Gets full list from parent
total_prefixes = len(prefixes_list)         # Correct count
```

However, the IP statistics come from aggregating sub-tasks (lines 256-268):
```python
# Only aggregates from sub-tasks found in `runs` (limited to 20 jobs)
for run in runs:
    if run.get("celery_task_id") in sub_task_ids:
        sub_result = run.get("result", {})
        total_ips_scanned += sub_result.get("total_ips_scanned", 0)  # INCOMPLETE!
        total_reachable += sub_result.get("total_reachable", 0)      # INCOMPLETE!
        total_unreachable += sub_result.get("total_unreachable", 0)  # INCOMPLETE!
```

If 31 sub-tasks are missing, their IP statistics are not included.

## Solutions

### Solution 1: Increase Query Limit (Quick Fix)
Change line 214 to fetch more jobs:
```python
runs = job_run_manager.get_recent_runs(
    limit=200,  # Increased from 20 to accommodate large split jobs
    status="completed", 
    job_type="scan_prefixes"
)
```

**Pros**:
- Minimal code change
- Fixes issue for most scenarios

**Cons**:
- Still has a limit (fails if > 200 sub-tasks)
- Fetches unnecessary data
- Doesn't scale infinitely

### Solution 2: Query Sub-Tasks Directly (Recommended)
After identifying the parent job, query for its specific sub-tasks:

```python
# Case 1: Parent job that was split into sub-tasks
if "sub_task_ids" in result:
    sub_task_ids = result.get("sub_task_ids", [])
    
    # Fetch ALL sub-tasks by their celery_task_ids
    sub_task_runs = job_run_manager.get_runs_by_celery_ids(sub_task_ids)
    
    # Aggregate results from all sub-tasks
    total_ips_scanned = 0
    total_reachable = 0
    total_unreachable = 0
    resolve_dns = False
    
    for sub_run in sub_task_runs:
        sub_result = sub_run.get("result", {})
        total_ips_scanned += sub_result.get("total_ips_scanned", 0)
        total_reachable += sub_result.get("total_reachable", 0)
        total_unreachable += sub_result.get("total_unreachable", 0)
        if sub_result.get("resolve_dns"):
            resolve_dns = True
    
    # Use actual prefixes list from parent for accurate count
    prefixes_list = result.get("prefixes", [])
    total_prefixes = len(prefixes_list) if prefixes_list else result.get("total_prefixes", 0)
```

**Requires new method in `job_run_manager`**:
```python
def get_runs_by_celery_ids(self, celery_ids: List[str]) -> List[dict]:
    """Get job runs by their celery task IDs."""
    return self.repository.get_runs_by_celery_ids(celery_ids)
```

**Requires new repository method**:
```python
def get_runs_by_celery_ids(self, celery_ids: List[str]) -> List[dict]:
    """Fetch job runs matching the given celery task IDs."""
    query = """
        SELECT * FROM job_runs 
        WHERE celery_task_id = ANY($1)
        ORDER BY completed_at DESC
    """
    results = self.db.fetch_all(query, [celery_ids])
    return [dict(row) for row in results]
```

**Pros**:
- Fetches exactly the needed sub-tasks
- No arbitrary limits
- Scales to any number of sub-tasks
- More efficient

**Cons**:
- Requires new database methods
- More code changes

### Solution 3: Store Aggregated Stats in Parent (Alternative)
Modify the parent job to store pre-aggregated statistics after all sub-tasks complete. This would require a callback mechanism or periodic checking.

**Pros**:
- Dashboard endpoint becomes simpler
- No need to aggregate on every request

**Cons**:
- Requires significant architectural changes
- Adds complexity to task execution
- Stats would not be real-time during execution

## Recommendation

**Implement Solution 2** (Query Sub-Tasks Directly) as it:
1. Completely fixes the bug without artificial limits
2. Is more efficient (targeted queries)
3. Provides accurate results regardless of scale
4. Maintains clean separation of concerns

As an **immediate hotfix**, implement Solution 1 (increase limit to 200) to quickly resolve production issues while Solution 2 is being developed.

## Testing Checklist

After implementing the fix, verify:
- [ ] Lab environment still shows correct stats
- [ ] Production with 50+ prefixes shows correct total_prefixes count
- [ ] Production shows correct total_ips_scanned (sum of all sub-tasks)
- [ ] Production shows correct total_reachable (sum of all sub-tasks)
- [ ] Production shows correct total_unreachable (sum of all sub-tasks)
- [ ] Reachability percentage is calculated correctly
- [ ] Single (non-split) jobs still work correctly
- [ ] Dashboard loads without performance degradation

## Related Files

### Frontend
- `frontend/src/components/layout/dashboard-scan-prefix-stats.tsx` - Dashboard card component
- `frontend/src/components/features/jobs/results/scan-prefix-result.tsx` - Job result detail view

### Backend
- `backend/routers/jobs/runs.py` - API endpoint (lines 197-310)
- `backend/tasks/scan_prefixes_task.py` - Task execution and splitting logic
- `backend/job_run_manager.py` - Job run management
- `backend/repositories/jobs/job_run_repository.py` - Database queries

## Additional Notes

### Why Jobs Are Split
The `scan_max_ips` parameter (default: 10,000) limits how many IPs a single task can scan. This prevents:
- Memory exhaustion
- Timeout issues
- Celery worker overload
- Network congestion

When total IPs exceed this limit, the job is split into smaller batches that each stay under the limit.

### Parent vs Sub-Task Identification
The code identifies parent jobs by checking if their `celery_task_id` is NOT in any other job's `sub_task_ids` list. This works because:
- Parent jobs have `sub_task_ids` in their result
- Sub-tasks do NOT have `sub_task_ids` (they're leaf tasks)
- Sub-tasks have a `celery_task_id` that appears in their parent's `sub_task_ids` list

### Database Considerations
Job runs are stored in the `job_runs` table with:
- `id`: Primary key
- `celery_task_id`: Celery's task ID (UUID)
- `result`: JSONB column containing the result dictionary
- `status`: Job status (pending, running, completed, failed)
- `job_type`: Type of job (e.g., "scan_prefixes")
- `completed_at`: Timestamp when job completed

The current query uses:
```sql
SELECT * FROM job_runs 
WHERE status = 'completed' 
  AND job_type = 'scan_prefixes'
ORDER BY completed_at DESC 
LIMIT 20
```

The recommended fix would add:
```sql
SELECT * FROM job_runs 
WHERE celery_task_id = ANY($1)
ORDER BY completed_at DESC
```
