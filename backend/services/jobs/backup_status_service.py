"""
Backup status aggregation service.

Queries job_runs for backup history and builds per-device status summaries
with Redis caching (5-minute TTL).
"""

import json
import logging

import redis

from config import settings
from models.celery import BackupCheckResponse
from repositories.jobs.job_run_repository import job_run_repository

logger = logging.getLogger(__name__)

_CACHE_KEY = "backup_check_devices"
_CACHE_TTL = 300  # 5 minutes


class BackupStatusService:
    def get_backup_status(self, force_refresh: bool = False) -> BackupCheckResponse:
        if not force_refresh:
            cached = self._read_cache()
            if cached is not None:
                return cached

        response = self._build_response()
        self._write_cache(response)
        return response

    def _build_response(self) -> BackupCheckResponse:
        runs = job_run_repository.get_all_by_type_and_statuses(
            job_type="backup",
            statuses=["completed", "failed"],
        )

        device_status: dict = {}

        for run in runs:
            completed_at = run.get("completed_at")
            result_json = run.get("result")
            if not result_json:
                continue

            try:
                result = json.loads(result_json)
            except (json.JSONDecodeError, TypeError) as exc:
                logger.warning("Failed to parse backup job result: %s", exc)
                continue

            completed_iso = completed_at.isoformat() if completed_at else None

            for device in result.get("backed_up_devices", []):
                device_id = device.get("device_id")
                device_name = device.get("device_name", device_id)

                if device_id not in device_status:
                    device_status[device_id] = {
                        "device_id": device_id,
                        "device_name": device_name,
                        "last_backup_success": True,
                        "last_backup_time": completed_iso,
                        "total_successful_backups": 1,
                        "total_failed_backups": 0,
                        "last_error": None,
                    }
                else:
                    existing = device_status[device_id]
                    if not existing["last_backup_time"] or (
                        completed_iso and completed_iso > existing["last_backup_time"]
                    ):
                        existing["last_backup_success"] = True
                        existing["last_backup_time"] = completed_iso
                        existing["last_error"] = None
                    existing["total_successful_backups"] += 1

            for device in result.get("failed_devices", []):
                device_id = device.get("device_id")
                device_name = device.get("device_name", device_id)
                error = device.get("error", "Unknown error")

                if device_id not in device_status:
                    device_status[device_id] = {
                        "device_id": device_id,
                        "device_name": device_name,
                        "last_backup_success": False,
                        "last_backup_time": completed_iso,
                        "total_successful_backups": 0,
                        "total_failed_backups": 1,
                        "last_error": error,
                    }
                else:
                    existing = device_status[device_id]
                    if not existing["last_backup_time"] or (
                        completed_iso and completed_iso > existing["last_backup_time"]
                    ):
                        existing["last_backup_success"] = False
                        existing["last_backup_time"] = completed_iso
                        existing["last_error"] = error
                    existing["total_failed_backups"] += 1

        devices_list = list(device_status.values())
        return BackupCheckResponse(
            total_devices=len(devices_list),
            devices_with_successful_backup=sum(
                1 for d in devices_list if d["last_backup_success"]
            ),
            devices_with_failed_backup=sum(
                1 for d in devices_list if not d["last_backup_success"]
            ),
            devices_never_backed_up=0,
            devices=devices_list,
        )

    def _read_cache(self) -> BackupCheckResponse | None:
        try:
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            cached = r.get(_CACHE_KEY)
            if cached:
                logger.info("Returning cached device backup status")
                return BackupCheckResponse(**json.loads(cached))
        except Exception as exc:
            logger.warning("Cache read failed, proceeding with fresh data: %s", exc)
        return None

    def _write_cache(self, response: BackupCheckResponse) -> None:
        try:
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            r.setex(_CACHE_KEY, _CACHE_TTL, response.model_dump_json())
            logger.info("Cached device backup status for %s seconds", _CACHE_TTL)
        except Exception as exc:
            logger.warning("Failed to cache device backup status: %s", exc)


_service = BackupStatusService()


def get_backup_status_service() -> BackupStatusService:
    return _service
