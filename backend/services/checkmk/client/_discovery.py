import logging
from typing import Dict

logger = logging.getLogger(__name__)


class _DiscoveryMixin:
    def get_service_discovery(self, hostname: str) -> Dict:
        response = self._make_request("GET", f"objects/service_discovery/{hostname}")
        return self._handle_response(response)

    def start_service_discovery(self, hostname: str, mode: str = "new") -> Dict:
        json_data = {"host_name": hostname, "mode": mode}

        response = self._make_request(
            "POST",
            "domain-types/service_discovery_run/actions/start/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def wait_for_service_discovery(self, hostname: str) -> Dict:
        response = self._make_request(
            "POST",
            "domain-types/service_discovery_run/actions/wait-for-completion/invoke",
            json_data={"host_name": hostname},
        )
        return self._handle_response(response)

    def update_discovery_phase(self, hostname: str, **kwargs) -> Dict:
        response = self._make_request(
            "POST",
            f"objects/host/{hostname}/actions/update_discovery_phase/invoke",
            json_data=kwargs,
        )
        return self._handle_response(response)

    def start_bulk_discovery(
        self,
        hostnames: list,
        options: Dict = None,
        do_full_scan: bool = True,
        bulk_size: int = 10,
        ignore_errors: bool = True,
    ) -> Dict:
        if options is None:
            options = {
                "monitor_undecided_services": True,
                "remove_vanished_services": True,
                "update_service_labels": True,
                "update_service_parameters": True,
                "update_host_labels": True,
            }

        json_data = {
            "hostnames": hostnames,
            "options": options,
            "do_full_scan": do_full_scan,
            "bulk_size": bulk_size,
            "ignore_errors": ignore_errors,
        }

        response = self._make_request(
            "POST",
            "domain-types/discovery_run/actions/bulk-discovery-start/invoke",
            json_data=json_data,
        )

        if response.status_code == 204:
            return {"success": True, "message": "Bulk discovery started"}

        return self._handle_response(response)
