#!/usr/bin/env python3
"""
CheckMK REST API Client

A comprehensive Python client for interacting with CheckMK REST API.
Based on the actual CheckMK API v1.0 OpenAPI specification.
"""

import json
import logging
from typing import Dict, List
import requests
from urllib.parse import urljoin


class CheckMKAPIError(Exception):
    """Custom exception for CheckMK API errors"""

    def __init__(
        self, message: str, status_code: int = None, response_data: dict = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.response_data = response_data


class CheckMKClient:
    """
    CheckMK REST API Client

    Provides comprehensive methods for interacting with CheckMK monitoring system
    via REST API based on the actual OpenAPI specification.
    """

    def __init__(
        self,
        host: str,
        site_name: str = "cmk",
        username: str = "automation",
        password: str = "automation",
        protocol: str = "http",
        verify_ssl: bool = True,
        timeout: int = 30,
    ):
        """
        Initialize CheckMK API client

        Args:
            host: CheckMK server hostname/IP with port (e.g., "192.168.178.101:8080")
            site_name: CheckMK site name (default: "cmk")
            username: API username (default: "automation")
            password: API password
            protocol: Protocol to use - http or https (default: "http")
            verify_ssl: Whether to verify SSL certificates (default: True)
            timeout: Request timeout in seconds (default: 30)
        """
        self.host = host
        self.site_name = site_name
        self.username = username
        self.password = password
        self.protocol = protocol
        self.verify_ssl = verify_ssl
        self.timeout = timeout

        # Build base API URL
        self.base_url = f"{protocol}://{host}/{site_name}/check_mk/api/1.0"

        # Setup session
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {username} {password}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        )
        self.session.verify = verify_ssl

        # Setup logging
        self.logger = logging.getLogger(__name__)

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Dict = None,
        json_data: Dict = None,
        headers: Dict = None,
        etag: str = None,
    ) -> requests.Response:
        """Make HTTP request to CheckMK API"""
        url = urljoin(self.base_url + "/", endpoint)

        request_headers = self.session.headers.copy()
        if headers:
            request_headers.update(headers)
        if etag:
            request_headers["If-Match"] = etag

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=request_headers,
                timeout=self.timeout,
            )

            self.logger.debug(f"{method} {url} - Status: {response.status_code}")
            return response

        except requests.exceptions.RequestException as e:
            raise CheckMKAPIError(f"Request failed: {str(e)}")

    def _handle_response(self, response: requests.Response) -> Dict:
        """Handle API response and check for errors"""
        try:
            if response.status_code in [200, 201, 204]:
                if response.content:
                    return response.json()
                return {}
            elif response.status_code == 303:
                return {
                    "redirected": True,
                    "location": response.headers.get("location"),
                }
            else:
                error_data = response.json() if response.content else {}
                raise CheckMKAPIError(
                    f"API request failed: {response.status_code}",
                    status_code=response.status_code,
                    response_data=error_data,
                )
        except json.JSONDecodeError:
            raise CheckMKAPIError(
                f"Invalid JSON response: {response.text}",
                status_code=response.status_code,
            )

    # Authentication and Connection Methods

    def test_connection(self) -> bool:
        """Test connection to CheckMK API"""
        try:
            response = self._make_request("GET", "version")
            return response.status_code == 200
        except CheckMKAPIError:
            return False

    def get_version(self) -> Dict:
        """Get CheckMK version information"""
        response = self._make_request("GET", "version")
        return self._handle_response(response)

    # Host Configuration Methods (Based on actual API spec)

    def get_all_hosts(
        self,
        effective_attributes: bool = False,
        include_links: bool = False,
        site: str = None,
        columns: List[str] = None,
    ) -> Dict:
        """
        Get all hosts from CheckMK

        Endpoint: GET /domain-types/host_config/collections/all
        """
        params = {
            "effective_attributes": effective_attributes,
            "include_links": include_links,
        }

        if site:
            params["site"] = site
        if columns:
            params["columns"] = columns

        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}

        response = self._make_request(
            "GET", "domain-types/host_config/collections/all", params=params
        )
        return self._handle_response(response)

    def get_host(self, hostname: str, effective_attributes: bool = False) -> Dict:
        """
        Get specific host configuration

        Endpoint: GET /objects/host_config/{host_name}
        """
        params = {"effective_attributes": effective_attributes}

        response = self._make_request(
            "GET", f"objects/host_config/{hostname}", params=params
        )
        return self._handle_response(response)

    def create_host(
        self,
        hostname: str,
        folder: str = "/",
        attributes: Dict = None,
        bake_agent: bool = False,
    ) -> Dict:
        """
        Create new host in CheckMK

        Endpoint: POST /domain-types/host_config/collections/all
        """
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
        return self._handle_response(response)

    def update_host(self, hostname: str, attributes: Dict, etag: str = None) -> Dict:
        """
        Update existing host configuration

        Endpoint: PUT /objects/host_config/{host_name}
        """
        if etag is None:
            etag = self.get_host_etag(hostname)

        json_data = {"attributes": attributes}

        response = self._make_request(
            "PUT", f"objects/host_config/{hostname}", json_data=json_data, etag=etag
        )
        return self._handle_response(response)

    def delete_host(self, hostname: str) -> bool:
        """
        Delete host from CheckMK

        Endpoint: DELETE /objects/host_config/{host_name}
        """
        response = self._make_request("DELETE", f"objects/host_config/{hostname}")
        self._handle_response(response)
        return True

    def move_host(self, hostname: str, target_folder: str) -> Dict:
        """
        Move host to different folder

        Endpoint: POST /objects/host_config/{host_name}/actions/move/invoke
        """
        json_data = {"target_folder": target_folder}

        response = self._make_request(
            "POST",
            f"objects/host_config/{hostname}/actions/move/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def rename_host(self, hostname: str, new_hostname: str) -> Dict:
        """
        Rename host

        Endpoint: POST /objects/host_config/{host_name}/actions/rename/invoke
        """
        json_data = {"new_name": new_hostname}

        response = self._make_request(
            "POST",
            f"objects/host_config/{hostname}/actions/rename/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    # Bulk Host Operations

    def bulk_create_hosts(self, hosts: List[Dict]) -> Dict:
        """
        Create multiple hosts in one request

        Endpoint: POST /domain-types/host_config/actions/bulk-create/invoke
        """
        json_data = {"entries": hosts}

        response = self._make_request(
            "POST",
            "domain-types/host_config/actions/bulk-create/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def bulk_update_hosts(self, hosts: Dict) -> Dict:
        """
        Update multiple hosts in one request

        Endpoint: POST /domain-types/host_config/actions/bulk-update/invoke
        """
        json_data = {"entries": hosts}

        response = self._make_request(
            "POST",
            "domain-types/host_config/actions/bulk-update/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def bulk_delete_hosts(self, hostnames: List[str]) -> Dict:
        """
        Delete multiple hosts in one request

        Endpoint: POST /domain-types/host_config/actions/bulk-delete/invoke
        """
        json_data = {"entries": hostnames}

        response = self._make_request(
            "POST",
            "domain-types/host_config/actions/bulk-delete/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    # Service and Monitoring Methods (Based on actual API spec)

    def get_all_monitored_hosts(
        self, columns: List[str] = None, query: str = None
    ) -> Dict:
        """
        Get all monitored hosts with status information

        Endpoint: GET /domain-types/host/collections/all
        """
        params = {}
        if columns:
            params["columns"] = columns
        if query:
            params["query"] = query

        response = self._make_request(
            "GET", "domain-types/host/collections/all", params=params
        )
        return self._handle_response(response)

    def get_monitored_host(self, hostname: str, columns: List[str] = None) -> Dict:
        """
        Get monitored host with status information

        Endpoint: GET /objects/host/{host_name}
        """
        params = {}
        if columns:
            params["columns"] = columns

        response = self._make_request("GET", f"objects/host/{hostname}", params=params)
        return self._handle_response(response)

    def get_host_services(
        self, hostname: str, columns: List[str] = None, query: str = None
    ) -> Dict:
        """
        Get services for a specific host

        Endpoint: GET /objects/host/{host_name}/collections/services
        """
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
        """
        Show specific service details

        Endpoint: POST /objects/host/{host_name}/actions/show_service/invoke
        """
        json_data = {"service_description": service_description}
        if columns:
            json_data["columns"] = columns

        response = self._make_request(
            "POST",
            f"objects/host/{hostname}/actions/show_service/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    # Service Discovery Methods

    def get_service_discovery(self, hostname: str) -> Dict:
        """
        Get service discovery status for a host

        Endpoint: GET /objects/service_discovery/{host_name}
        """
        response = self._make_request("GET", f"objects/service_discovery/{hostname}")
        return self._handle_response(response)

    def start_service_discovery(self, hostname: str, mode: str = "new") -> Dict:
        """
        Start service discovery for a host

        Endpoint: POST /objects/service_discovery_run/{host_name}
        """
        json_data = {"mode": mode}

        response = self._make_request(
            "POST", f"objects/service_discovery_run/{hostname}", json_data=json_data
        )
        return self._handle_response(response)

    def wait_for_service_discovery(self, hostname: str) -> Dict:
        """
        Wait for service discovery completion

        Endpoint: POST /objects/service_discovery_run/{host_name}/actions/wait-for-completion/invoke
        """
        response = self._make_request(
            "POST",
            f"objects/service_discovery_run/{hostname}/actions/wait-for-completion/invoke",
        )
        return self._handle_response(response)

    def update_discovery_phase(self, hostname: str, **kwargs) -> Dict:
        """
        Update discovery phase for a host

        Endpoint: POST /objects/host/{host_name}/actions/update_discovery_phase/invoke
        """
        response = self._make_request(
            "POST",
            f"objects/host/{hostname}/actions/update_discovery_phase/invoke",
            json_data=kwargs,
        )
        return self._handle_response(response)

    # Acknowledgment Methods

    def acknowledge_host_problem(
        self,
        hostname: str,
        comment: str,
        sticky: bool = False,
        persistent: bool = False,
        notify: bool = False,
    ) -> Dict:
        """
        Acknowledge host problem

        Endpoint: POST /domain-types/acknowledge/collections/host
        """
        json_data = {
            "host_name": hostname,
            "comment": comment,
            "sticky": sticky,
            "persistent": persistent,
            "notify": notify,
        }

        response = self._make_request(
            "POST", "domain-types/acknowledge/collections/host", json_data=json_data
        )
        return self._handle_response(response)

    def acknowledge_service_problem(
        self,
        hostname: str,
        service_description: str,
        comment: str,
        sticky: bool = False,
        persistent: bool = False,
        notify: bool = False,
    ) -> Dict:
        """
        Acknowledge service problem

        Endpoint: POST /domain-types/acknowledge/collections/service
        """
        json_data = {
            "host_name": hostname,
            "service_description": service_description,
            "comment": comment,
            "sticky": sticky,
            "persistent": persistent,
            "notify": notify,
        }

        response = self._make_request(
            "POST", "domain-types/acknowledge/collections/service", json_data=json_data
        )
        return self._handle_response(response)

    def delete_acknowledgment(self, ack_id: str) -> bool:
        """
        Delete acknowledgment

        Endpoint: POST /domain-types/acknowledge/actions/delete/invoke
        """
        json_data = {"delete_id": ack_id}

        response = self._make_request(
            "POST",
            "domain-types/acknowledge/actions/delete/invoke",
            json_data=json_data,
        )
        self._handle_response(response)
        return True

    # Downtime Methods

    def create_host_downtime(
        self,
        hostname: str,
        start_time: str,
        end_time: str,
        comment: str = "Scheduled downtime",
        downtime_type: str = "fixed",
    ) -> Dict:
        """
        Create downtime for host

        Endpoint: POST /domain-types/downtime/collections/host
        """
        json_data = {
            "host_name": hostname,
            "start_time": start_time,
            "end_time": end_time,
            "comment": comment,
            "downtime_type": downtime_type,
        }

        response = self._make_request(
            "POST", "domain-types/downtime/collections/host", json_data=json_data
        )
        return self._handle_response(response)

    # Comment Methods

    def add_host_comment(
        self, hostname: str, comment: str, persistent: bool = False
    ) -> Dict:
        """
        Add comment to host

        Endpoint: POST /domain-types/comment/collections/host
        """
        json_data = {
            "host_name": hostname,
            "comment": comment,
            "persistent": persistent,
        }

        response = self._make_request(
            "POST", "domain-types/comment/collections/host", json_data=json_data
        )
        return self._handle_response(response)

    def add_service_comment(
        self,
        hostname: str,
        service_description: str,
        comment: str,
        persistent: bool = False,
    ) -> Dict:
        """
        Add comment to service

        Endpoint: POST /domain-types/comment/collections/service
        """
        json_data = {
            "host_name": hostname,
            "service_description": service_description,
            "comment": comment,
            "persistent": persistent,
        }

        response = self._make_request(
            "POST", "domain-types/comment/collections/service", json_data=json_data
        )
        return self._handle_response(response)

    # Configuration and Changes Management

    def get_pending_changes(self) -> Dict:
        """
        Get pending configuration changes

        Endpoint: GET /domain-types/activation_run/collections/pending_changes
        """
        response = self._make_request(
            "GET", "domain-types/activation_run/collections/pending_changes"
        )
        return self._handle_response(response)

    def activate_changes(
        self,
        sites: List[str] = None,
        force_foreign_changes: bool = False,
        redirect: bool = False,
    ) -> Dict:
        """
        Activate pending configuration changes

        Endpoint: POST /domain-types/activation_run/actions/activate-changes/invoke
        """
        if sites is None:
            sites = [self.site_name]

        json_data = {
            "redirect": redirect,
            "sites": sites,
            "force_foreign_changes": force_foreign_changes,
        }

        response = self._make_request(
            "POST",
            "domain-types/activation_run/actions/activate-changes/invoke",
            json_data=json_data,
            etag="*",
        )
        return self._handle_response(response)

    def get_activation_status(self, activation_id: str) -> Dict:
        """
        Get activation status

        Endpoint: GET /objects/activation_run/{activation_id}
        """
        response = self._make_request("GET", f"objects/activation_run/{activation_id}")
        return self._handle_response(response)

    def wait_for_activation_completion(self, activation_id: str) -> Dict:
        """
        Wait for activation completion

        Endpoint: POST /objects/activation_run/{activation_id}/actions/wait-for-completion/invoke
        """
        response = self._make_request(
            "POST",
            f"objects/activation_run/{activation_id}/actions/wait-for-completion/invoke",
        )
        return self._handle_response(response)

    def get_running_activations(self) -> Dict:
        """
        Get currently running activations

        Endpoint: GET /domain-types/activation_run/collections/running
        """
        response = self._make_request(
            "GET", "domain-types/activation_run/collections/running"
        )
        return self._handle_response(response)

    # Folder Management Methods

    def get_hosts_in_folder(self, folder_path: str) -> Dict:
        """
        Get all hosts in a specific folder

        Endpoint: GET /objects/folder_config/{folder}/collections/hosts
        """
        response = self._make_request(
            "GET", f"objects/folder_config/{folder_path}/collections/hosts"
        )
        return self._handle_response(response)

    # Host Groups

    def get_host_groups(self) -> Dict:
        """
        Get all host groups

        Endpoint: GET /domain-types/host_group_config/collections/all
        """
        response = self._make_request(
            "GET", "domain-types/host_group_config/collections/all"
        )
        return self._handle_response(response)

    def get_host_group(self, group_name: str) -> Dict:
        """
        Get specific host group

        Endpoint: GET /objects/host_group_config/{name}
        """
        response = self._make_request("GET", f"objects/host_group_config/{group_name}")
        return self._handle_response(response)

    def create_host_group(self, name: str, alias: str = None) -> Dict:
        """
        Create host group

        Endpoint: POST /domain-types/host_group_config/collections/all
        """
        json_data = {"name": name}
        if alias:
            json_data["alias"] = alias

        response = self._make_request(
            "POST",
            "domain-types/host_group_config/collections/all",
            json_data=json_data,
        )
        return self._handle_response(response)

    # Utility Methods

    def get_host_etag(self, hostname: str) -> str:
        """Get ETag for a host (used for updates)"""
        response = self._make_request(
            "GET",
            f"objects/host_config/{hostname}",
            params={"effective_attributes": False},
        )

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for host {hostname}")

    def bulk_operation(self, operations: List[Dict]) -> List[Dict]:
        """
        Perform bulk operations (legacy method for compatibility)

        Args:
            operations: List of operation dictionaries

        Returns:
            List of operation results
        """
        results = []
        for operation in operations:
            try:
                op_type = operation.get("type")
                if op_type == "create_host":
                    result = self.create_host(**operation.get("params", {}))
                elif op_type == "update_host":
                    result = self.update_host(**operation.get("params", {}))
                elif op_type == "delete_host":
                    result = self.delete_host(
                        operation.get("params", {}).get("hostname")
                    )
                else:
                    result = {"error": f"Unknown operation type: {op_type}"}
                results.append(
                    {"operation": operation, "result": result, "success": True}
                )
            except CheckMKAPIError as e:
                results.append(
                    {"operation": operation, "error": str(e), "success": False}
                )
        return results
