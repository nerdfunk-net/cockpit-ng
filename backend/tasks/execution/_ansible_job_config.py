"""
Shared config-loading for the get_server_facts / get_open_ports Celery
executors: reads agent_id/prefixes/auth fields from job_parameters (falling
back to the template) and resolves them to a PrefixScanConfig.

See doc/refactoring/FACTS-PORTS-REFACTORING.md — Phase 3.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple

from services.cockpit_agent.ansible_auth import AnsibleAuthError, resolve_ansible_auth
from services.servers.ansible_ops import PrefixScanConfig

_VALID_AUTH_TYPES = ("ssh_key", "ssh_key_passphrase", "credentials")


def load_prefix_scan_config(
    job_parameters: Optional[dict],
    template: Optional[dict],
    credential_id: Optional[int],
    *,
    agent_key: str,
    prefixes_key: str,
    auth_type_key: str,
    user_key: str,
) -> Tuple[Optional[PrefixScanConfig], Optional[Dict[str, Any]]]:
    """Resolve a PrefixScanConfig from job_parameters/template.

    Returns (config, error). Exactly one is non-None: on failure, *error* is
    the ``{"success": False, "error": ...}`` dict the calling executor should
    return directly (matching the executors' pre-refactor error contract).
    """
    params = job_parameters or {}
    tmpl = template or {}

    agent_id = params.get("agent_id") or tmpl.get(agent_key)
    if not agent_id:
        return None, {
            "success": False,
            "error": "No agent_id configured for this template",
        }

    raw_prefixes = params.get("prefixes") or tmpl.get(prefixes_key)
    if isinstance(raw_prefixes, str):
        try:
            raw_prefixes = json.loads(raw_prefixes)
        except json.JSONDecodeError:
            raw_prefixes = None
    if not raw_prefixes:
        return None, {
            "success": False,
            "error": "No CIDR prefixes configured for this template",
        }

    auth_type = params.get(auth_type_key) or tmpl.get(auth_type_key) or "credentials"
    if auth_type not in _VALID_AUTH_TYPES:
        return None, {
            "success": False,
            "error": f"Invalid {auth_type_key}: {auth_type}",
        }

    ansible_user = None
    if auth_type == "ssh_key":
        ansible_user = params.get(user_key) or tmpl.get(user_key)

    try:
        auth = resolve_ansible_auth(
            auth_type=auth_type,
            credential_id=credential_id,
            ansible_user=ansible_user,
        )
    except AnsibleAuthError as exc:
        return None, {"success": False, "error": str(exc)}

    sent_by = params.get("sent_by", "celery_scheduler")

    config = PrefixScanConfig(
        agent_id=agent_id,
        prefixes=raw_prefixes,
        auth=auth,
        sent_by=sent_by,
        timeout=90,
    )
    return config, None
