"""
Get Server Facts executor.

Thin Celery entrypoint: resolves job config from job_parameters/template, then
delegates the CIDR scan + facts-gather + upsert loop to
ServerAnsibleOperationsService.run_facts_prefix_scan.

See doc/refactoring/FACTS-PORTS-REFACTORING.md — Phase 3.
"""

import logging
from typing import Any, Dict, Optional

from tasks.execution._ansible_job_config import load_prefix_scan_config

logger = logging.getLogger(__name__)


def execute_get_server_facts(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute get_server_facts job.

    Reads from job_parameters (falling back to template):
      - agent_id : ID of the Ansible-type cockpit agent to gather facts through
      - prefixes : list of CIDR strings to scan

    The authentication method is supplied by the job schedule via job_parameters:
      - facts_auth_type   : "ssh_key" | "ssh_key_passphrase" | "credentials" (default "credentials")
      - facts_ansible_user: SSH username, required only for "ssh_key" mode
      - credential_id (schedule-level): required for "ssh_key_passphrase" and "credentials" modes

    Returns:
        dict with success, total/reachable_count/scanned_ip_count,
        success_count, failed_count, and a per-host results list.
    """
    config, error = load_prefix_scan_config(
        job_parameters,
        template,
        credential_id,
        agent_key="facts_agent_id",
        prefixes_key="facts_prefixes",
        auth_type_key="facts_auth_type",
        user_key="facts_ansible_user",
    )
    if error:
        return error

    import service_factory
    from core.database import SessionLocal

    db = SessionLocal()
    try:
        ops = service_factory.build_server_ansible_ops_service(db)
        return ops.run_facts_prefix_scan(
            config,
            progress=lambda current, total, status: task_context.update_state(
                state="PROGRESS",
                meta={"current": current, "total": total, "status": status},
            ),
        )
    except Exception as exc:
        logger.error("Get server facts executor failed: %s", exc, exc_info=True)
        return {"success": False, "error": str(exc)}
    finally:
        db.close()
