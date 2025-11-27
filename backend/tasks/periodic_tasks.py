"""
Periodic tasks executed by Celery Beat.
These tasks run on a schedule defined in beat_schedule.py
"""
from celery_app import celery_app
import logging
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Track last run times for cache tasks (in-memory, reset on worker restart)
_last_cache_runs: Dict[str, datetime] = {}


@celery_app.task(name='tasks.worker_health_check')
def worker_health_check() -> dict:
    """
    Periodic task: Health check for Celery workers.

    Runs every 5 minutes (configured in beat_schedule.py)
    Monitors worker health and logs status.

    Returns:
        dict: Health check results
    """
    try:
        inspect = celery_app.control.inspect()

        # Get active workers
        active = inspect.active()
        stats = inspect.stats()

        active_workers = len(stats) if stats else 0

        logger.info(f"Health check: {active_workers} workers active")

        return {
            'success': True,
            'active_workers': active_workers,
            'message': f'{active_workers} workers active'
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@celery_app.task(name='tasks.load_cache_schedules')
def load_cache_schedules_task() -> dict:
    """
    Periodic task: Check cache settings and dispatch cache tasks when due.
    
    Runs every minute. Checks the configured intervals for:
    - devices_cache_interval_minutes
    - locations_cache_interval_minutes
    - git_commits_cache_interval_minutes
    
    Dispatches the appropriate cache task with job tracking when due.
    """
    global _last_cache_runs
    
    try:
        from settings_manager import settings_manager
        import job_run_manager
        
        cache_settings = settings_manager.get_cache_settings()
        
        if not cache_settings.get('enabled', True):
            return {'success': True, 'message': 'Cache disabled', 'dispatched': []}
        
        now = datetime.now(timezone.utc)
        dispatched = []
        
        # Check devices cache
        devices_interval = cache_settings.get('devices_cache_interval_minutes', 60)
        if devices_interval > 0:
            last_run = _last_cache_runs.get('devices')
            if last_run is None or (now - last_run).total_seconds() >= devices_interval * 60:
                # Dispatch devices cache task with tracking
                dispatch_cache_task.delay(
                    cache_type='devices',
                    task_name='cache_all_devices'
                )
                _last_cache_runs['devices'] = now
                dispatched.append('devices')
                logger.info(f"Dispatched devices cache task (interval: {devices_interval}m)")
        
        # Check locations cache
        locations_interval = cache_settings.get('locations_cache_interval_minutes', 10)
        if locations_interval > 0:
            last_run = _last_cache_runs.get('locations')
            if last_run is None or (now - last_run).total_seconds() >= locations_interval * 60:
                # Dispatch locations cache task with tracking
                dispatch_cache_task.delay(
                    cache_type='locations',
                    task_name='cache_all_locations'
                )
                _last_cache_runs['locations'] = now
                dispatched.append('locations')
                logger.info(f"Dispatched locations cache task (interval: {locations_interval}m)")
        
        # Check git commits cache (placeholder for future implementation)
        git_interval = cache_settings.get('git_commits_cache_interval_minutes', 15)
        if git_interval > 0:
            last_run = _last_cache_runs.get('git_commits')
            if last_run is None or (now - last_run).total_seconds() >= git_interval * 60:
                # TODO: Dispatch git commits cache task when implemented
                # dispatch_cache_task.delay(
                #     cache_type='git_commits',
                #     task_name='cache_git_commits'
                # )
                _last_cache_runs['git_commits'] = now
                # dispatched.append('git_commits')
                logger.debug(f"Git commits cache task not yet implemented (interval: {git_interval}m)")
        
        return {
            'success': True,
            'checked_at': now.isoformat(),
            'dispatched': dispatched,
            'intervals': {
                'devices': devices_interval,
                'locations': locations_interval,
                'git_commits': git_interval
            }
        }
        
    except Exception as e:
        logger.error(f"Error in load_cache_schedules: {e}", exc_info=True)
        return {'success': False, 'error': str(e)}


@celery_app.task(name='tasks.dispatch_cache_task', bind=True)
def dispatch_cache_task(self, cache_type: str, task_name: str) -> dict:
    """
    Dispatch a cache task and track it in job_runs.
    
    Args:
        cache_type: Type of cache (devices, locations, git_commits)
        task_name: Celery task name to execute
    """
    try:
        import job_run_manager
        
        # Create job run record
        job_run = job_run_manager.create_job_run(
            job_name=f"Cache {cache_type.replace('_', ' ').title()}",
            job_type=f"cache_{cache_type}",
            triggered_by='system'
        )
        job_run_id = job_run['id']
        
        # Mark as started
        job_run_manager.mark_started(job_run_id, self.request.id)
        
        try:
            # Execute the actual cache task using .apply() to get a proper task context
            # This runs synchronously but gives the task access to self.request.id
            if task_name == 'cache_all_devices':
                from services.background_jobs import cache_all_devices_task
                async_result = cache_all_devices_task.apply()
                result = async_result.result if async_result.successful() else {'status': 'failed', 'error': str(async_result.result)}
            elif task_name == 'cache_all_locations':
                from services.background_jobs import cache_all_locations_task
                async_result = cache_all_locations_task.apply()
                result = async_result.result if async_result.successful() else {'status': 'failed', 'error': str(async_result.result)}
            elif task_name == 'cache_git_commits':
                # Placeholder for git commits cache
                result = {'status': 'not_implemented', 'message': 'Git commits cache not yet implemented'}
            else:
                result = {'status': 'error', 'message': f'Unknown task: {task_name}'}
            
            # Check result status
            status = result.get('status', 'completed')
            if status in ['completed', 'success']:
                job_run_manager.mark_completed(job_run_id, result=result)
                return {'success': True, 'job_run_id': job_run_id, 'result': result}
            else:
                error_msg = result.get('error') or result.get('message') or 'Unknown error'
                job_run_manager.mark_failed(job_run_id, error_msg)
                return {'success': False, 'job_run_id': job_run_id, 'error': error_msg}
                
        except Exception as e:
            job_run_manager.mark_failed(job_run_id, str(e))
            raise
            
    except Exception as e:
        logger.error(f"Error dispatching cache task {cache_type}: {e}", exc_info=True)
        return {'success': False, 'error': str(e)}
