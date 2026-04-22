from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

JOB_TTL_SECONDS = 24 * 3600
SSH_LOGIN_TIMEOUT = 5
MAX_CONCURRENCY = 10
RETRY_ATTEMPTS = 3


@dataclass
class ScanResult:
    ip: str
    credential_id: int
    device_type: str  # 'cisco' | 'linux' | 'unknown'
    hostname: Optional[str] = None
    platform: Optional[str] = None
    debug_info: Optional[Dict[str, Any]] = None


@dataclass
class ScanJob:
    job_id: str
    created: float
    cidrs: List[str]
    credential_ids: List[int]
    discovery_mode: str
    ping_mode: str  # 'ping' | 'fping'
    total_targets: int
    debug_enabled: bool = False
    scanned: int = 0
    alive: int = 0
    authenticated: int = 0
    unreachable: int = 0
    auth_failed: int = 0
    driver_not_supported: int = 0
    state: str = "running"  # running | finished
    results: List[ScanResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
