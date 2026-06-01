import logging
from typing import Dict, List

from services.checkmk.base import slash_to_tilde
from services.checkmk.exceptions import CheckMKAPIError

logger = logging.getLogger(__name__)


class _FoldersMixin:
    def get_all_folders(
        self, parent: str = None, recursive: bool = False, show_hosts: bool = False
    ) -> Dict:
        params = {"recursive": recursive, "show_hosts": show_hosts}
        if parent:
            params["parent"] = parent

        params = {k: v for k, v in params.items() if v is not None}

        response = self._make_request(
            "GET", "domain-types/folder_config/collections/all", params=params
        )
        return self._handle_response(response)

    def get_folder(self, folder_path: str, show_hosts: bool = False) -> Dict:
        folder_url = slash_to_tilde(folder_path)
        params = {"show_hosts": show_hosts}

        response = self._make_request(
            "GET", f"objects/folder_config/{folder_url}", params=params
        )
        return self._handle_response(response)

    def create_folder(
        self, name: str, title: str, parent: str = "/", attributes: Dict = None
    ) -> Dict:
        if attributes is None:
            attributes = {}

        json_data = {
            "name": name,
            "title": title,
            "parent": parent,
            "attributes": attributes,
        }

        response = self._make_request(
            "POST", "domain-types/folder_config/collections/all", json_data=json_data
        )
        return self._handle_response(response)

    def update_folder(
        self,
        folder_path: str,
        title: str = None,
        attributes: Dict = None,
        remove_attributes: List[str] = None,
        etag: str = None,
    ) -> Dict:
        folder_url = slash_to_tilde(folder_path)

        if etag is None:
            etag = self.get_folder_etag(folder_path)

        json_data = {}
        if title is not None:
            json_data["title"] = title
        if attributes is not None:
            json_data["attributes"] = attributes
        if remove_attributes is not None:
            json_data["remove_attributes"] = remove_attributes

        response = self._make_request(
            "PUT", f"objects/folder_config/{folder_url}", json_data=json_data, etag=etag
        )
        return self._handle_response(response)

    def delete_folder(self, folder_path: str, delete_mode: str = "recursive") -> bool:
        folder_url = slash_to_tilde(folder_path)
        params = {"delete_mode": delete_mode}

        response = self._make_request(
            "DELETE", f"objects/folder_config/{folder_url}", params=params
        )
        self._handle_response(response)
        return True

    def move_folder(self, folder_path: str, destination: str, etag: str = None) -> Dict:
        folder_url = slash_to_tilde(folder_path)

        if etag is None:
            etag = self.get_folder_etag(folder_path)

        json_data = {"destination": destination}

        response = self._make_request(
            "POST",
            f"objects/folder_config/{folder_url}/actions/move/invoke",
            json_data=json_data,
            etag=etag,
        )
        return self._handle_response(response)

    def bulk_update_folders(self, entries: List[Dict]) -> Dict:
        json_data = {"entries": entries}

        response = self._make_request(
            "PUT",
            "domain-types/folder_config/actions/bulk-update/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def get_hosts_in_folder(
        self, folder_path: str, effective_attributes: bool = False
    ) -> Dict:
        folder_url = slash_to_tilde(folder_path)
        params = {"effective_attributes": effective_attributes}

        response = self._make_request(
            "GET",
            f"objects/folder_config/{folder_url}/collections/hosts",
            params=params,
        )
        return self._handle_response(response)

    def get_folder_etag(self, folder_path: str) -> str:
        folder_url = slash_to_tilde(folder_path)

        response = self._make_request("GET", f"objects/folder_config/{folder_url}")

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for folder {folder_path}")
