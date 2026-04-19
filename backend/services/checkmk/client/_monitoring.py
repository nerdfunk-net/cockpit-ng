import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class _MonitoringMixin:
    def get_all_monitored_hosts(
        self, columns: List[str] = None, query: str = None
    ) -> Dict:
        json_data = {}
        if columns:
            json_data["columns"] = columns
        if query:
            json_data["query"] = query

        response = self._make_request(
            "POST", "domain-types/host/collections/all", json_data=json_data
        )
        return self._handle_response(response)

    def get_monitored_host(self, hostname: str, columns: List[str] = None) -> Dict:
        json_data = {}
        if columns:
            json_data["columns"] = columns

        response = self._make_request(
            "POST",
            f"objects/host/{hostname}/actions/show_service/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def get_host_services(
        self, hostname: str, columns: List[str] = None, query: str = None
    ) -> Dict:
        params = {}
        if columns:
            params["columns"] = columns
        if query:
            params["query"] = query

        response = self._make_request(
            "GET", f"objects/host/{hostname}/collections/services", params=params
        )
        return self._handle_response(response)

    def show_service(
        self, hostname: str, service_description: str, columns: List[str] = None
    ) -> Dict:
        json_data = {"service_description": service_description}
        if columns:
            json_data["columns"] = columns

        response = self._make_request(
            "POST",
            f"objects/host/{hostname}/actions/show_service/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)
