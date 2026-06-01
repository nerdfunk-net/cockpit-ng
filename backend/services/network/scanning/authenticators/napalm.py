from __future__ import annotations

import asyncio
import logging
from typing import Dict, Optional

from napalm import get_network_driver  # type: ignore

from ..models import SSH_LOGIN_TIMEOUT

logger = logging.getLogger(__name__)

_CISCO_DRIVERS = ["ios", "nxos_ssh", "iosxr"]


class NapalmAuthenticator:
    """Authenticates against Cisco devices via NAPALM drivers."""

    async def authenticate(
        self, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
        for driver_name in _CISCO_DRIVERS:
            try:
                result = await asyncio.to_thread(
                    self._connect_get_facts, driver_name, ip, username, password
                )
                if result:
                    return result
            except Exception as e:
                logger.debug("Napalm %s failed for %s: %s", driver_name, ip, e)
        return None

    def _connect_get_facts(
        self, driver_name: str, ip: str, username: str, password: str
    ) -> Optional[Dict[str, str]]:
        try:
            driver_class = get_network_driver(driver_name)
            device = driver_class(
                hostname=ip,
                username=username,
                password=password,
                optional_args={"timeout": SSH_LOGIN_TIMEOUT},
            )
            device.open()
            try:
                facts = device.get_facts()
                return {"hostname": facts.get("hostname", ip), "platform": driver_name}
            finally:
                device.close()
        except Exception as e:
            logger.debug("Napalm %s connection failed for %s: %s", driver_name, ip, e)
            return None
