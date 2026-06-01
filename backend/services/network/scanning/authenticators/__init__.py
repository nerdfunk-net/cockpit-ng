from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


async def authenticate(
    discovery_mode: str,
    ip: str,
    username: str,
    password: str,
    parser_templates: Optional[List[Tuple[int, str]]] = None,
    debug_enabled: bool = False,
) -> Optional[Dict[str, Any]]:
    """Route authentication to the correct backend based on discovery_mode."""
    if discovery_mode == "napalm":
        from .napalm import NapalmAuthenticator
        from .ssh import SshAuthenticator

        cisco_result = await NapalmAuthenticator().authenticate(ip, username, password)
        if cisco_result:
            return {"device_type": "cisco", **cisco_result}

        linux_result = await SshAuthenticator().authenticate_linux(
            ip, username, password
        )
        if linux_result:
            return {"device_type": "linux", **linux_result}

    elif discovery_mode == "ssh-login":
        from .ssh import SshAuthenticator

        result = await SshAuthenticator().authenticate(
            ip, username, password, parser_templates
        )
        if result:
            return result

    elif discovery_mode == "netmiko":
        from .netmiko import NetmikoAuthenticator

        result = await NetmikoAuthenticator().authenticate(
            ip, username, password, parser_templates, debug_enabled
        )
        if result:
            return result
    else:
        logger.warning("Unknown discovery_mode '%s' for %s", discovery_mode, ip)

    return None
