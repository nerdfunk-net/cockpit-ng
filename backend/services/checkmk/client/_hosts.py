import logging
from typing import Dict, List

from services.checkmk.exceptions import CheckMKAPIError

logger = logging.getLogger(__name__)


class _HostsMixin:
    def get_all_hosts(
        self,
        effective_attributes: bool = False,
        include_links: bool = False,
        site: str = None,
        columns: List[str] = None,
    ) -> Dict:
        params = {
            "effective_attributes": effective_attributes,
            "include_links": include_links,
        }

        if site:
            params["site"] = site
        if columns:
            params["columns"] = columns

        params = {k: v for k, v in params.items() if v is not None}

        response = self._make_request(
            "GET", "domain-types/host_config/collections/all", params=params
        )
        return self._handle_response(response)

    def get_host(self, hostname: str, effective_attributes: bool = False) -> Dict:
        params = {"effective_attributes": effective_attributes}

        response = self._make_request(
            "GET", f"objects/host_config/{hostname}", params=params
        )
        result = self._handle_response(response)

        logger.debug("[CHECKMK API] get_host(%s) full response:", hostname)
        logger.debug("[CHECKMK API] Response type: %s", type(result))
        logger.debug(
            "[CHECKMK API] Response keys: %s",
            list(result.keys()) if isinstance(result, dict) else "N/A",
        )
        logger.debug("[CHECKMK API] Full response data: %s", result)

        return result

    def create_host(
        self,
        hostname: str,
        folder: str = "/",
        attributes: Dict = None,
        bake_agent: bool = False,
    ) -> Dict:
        if attributes is None:
            attributes = {}

        json_data = {"host_name": hostname, "folder": folder, "attributes": attributes}
        params = {"bake_agent": bake_agent}

        response = self._make_request(
            "POST",
            "domain-types/host_config/collections/all",
            params=params,
            json_data=json_data,
        )
        return self._handle_response(response, request_body=json_data)

    def update_host(self, hostname: str, attributes: Dict, etag: str = None) -> Dict:
        if etag is None:
            etag = self.get_host_etag(hostname)

        json_data = {"attributes": attributes}

        response = self._make_request(
            "PUT", f"objects/host_config/{hostname}", json_data=json_data, etag=etag
        )
        return self._handle_response(response, request_body=json_data)

    def delete_host(self, hostname: str) -> bool:
        response = self._make_request("DELETE", f"objects/host_config/{hostname}")
        self._handle_response(response)
        return True

    def move_host(self, hostname: str, target_folder: str) -> Dict:
        etag = self.get_host_etag(hostname)
        json_data = {"target_folder": target_folder}
        headers = {"If-Match": etag}

        response = self._make_request(
            "POST",
            f"objects/host_config/{hostname}/actions/move/invoke",
            json_data=json_data,
            headers=headers,
        )
        return self._handle_response(response)

    def rename_host(self, hostname: str, new_hostname: str) -> Dict:
        json_data = {"new_name": new_hostname}

        response = self._make_request(
            "POST",
            f"objects/host_config/{hostname}/actions/rename/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def bulk_create_hosts(self, hosts: List[Dict]) -> Dict:
        json_data = {"entries": hosts}

        response = self._make_request(
            "POST",
            "domain-types/host_config/actions/bulk-create/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def bulk_update_hosts(self, hosts: Dict) -> Dict:
        json_data = {"entries": hosts}

        response = self._make_request(
            "POST",
            "domain-types/host_config/actions/bulk-update/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def bulk_delete_hosts(self, hostnames: List[str]) -> Dict:
        json_data = {"entries": hostnames}

        response = self._make_request(
            "POST",
            "domain-types/host_config/actions/bulk-delete/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def get_host_etag(self, hostname: str) -> str:
        response = self._make_request(
            "GET",
            f"objects/host_config/{hostname}",
            params={"effective_attributes": False},
        )

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for host {hostname}")
