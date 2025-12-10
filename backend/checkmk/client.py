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

        # Enhanced debug logging for troubleshooting
        self.logger.debug("DEBUG: Making CheckMK API request:")
        self.logger.debug(f"DEBUG: Method: {method}")
        self.logger.debug(f"DEBUG: URL: {url}")
        self.logger.debug(f"DEBUG: Params: {params}")
        self.logger.debug(f"DEBUG: JSON Data: {json_data}")
        self.logger.debug(f"DEBUG: Headers: {dict(request_headers)}")

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=request_headers,
                timeout=self.timeout,
            )

            self.logger.debug(f"DEBUG: Response Status: {response.status_code}")
            self.logger.debug(f"DEBUG: Response Headers: {dict(response.headers)}")
            if response.content:
                try:
                    response_json = response.json()
                    self.logger.debug(f"DEBUG: Response Body: {response_json}")
                except (json.JSONDecodeError, ValueError):
                    self.logger.debug(f"DEBUG: Response Text: {response.text}")

            return response

        except requests.exceptions.RequestException as e:
            self.logger.error(f"DEBUG: Request exception: {str(e)}")
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

                # Enhanced error logging
                self.logger.error("DEBUG: API Error Details:")
                self.logger.error(f"DEBUG: Status Code: {response.status_code}")
                self.logger.error(f"DEBUG: Response Text: {response.text}")
                self.logger.error(f"DEBUG: Response Headers: {dict(response.headers)}")
                self.logger.error(f"DEBUG: Error Data: {error_data}")

                error_msg = f"API request failed: {response.status_code}"
                if error_data:
                    # Try to extract more meaningful error information
                    if "detail" in error_data:
                        error_msg += f" - {error_data['detail']}"
                    elif "message" in error_data:
                        error_msg += f" - {error_data['message']}"
                    elif "title" in error_data:
                        error_msg += f" - {error_data['title']}"
                    else:
                        error_msg += f" - {error_data}"

                raise CheckMKAPIError(
                    error_msg,
                    status_code=response.status_code,
                    response_data=error_data,
                )
        except json.JSONDecodeError as e:
            self.logger.error(f"DEBUG: JSON decode error: {str(e)}")
            self.logger.error(f"DEBUG: Raw response: {response.text}")
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
        Requires ETag in If-Match header to prevent concurrent modifications
        """
        # First get the current ETag for the host
        etag = self.get_host_etag(hostname)

        json_data = {"target_folder": target_folder}

        # Add If-Match header with the ETag
        headers = {"If-Match": etag}

        response = self._make_request(
            "POST",
            f"objects/host_config/{hostname}/actions/move/invoke",
            json_data=json_data,
            headers=headers,
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

        Endpoint: POST /domain-types/host/collections/all
        Note: This endpoint uses POST method for complex queries
        """
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
        """
        Get monitored host with status information

        Endpoint: POST /objects/host/{host_name}/actions/show_service/invoke
        Note: Based on actual API structure, monitoring data is accessed differently
        """
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

        Endpoint: POST /domain-types/service_discovery_run/actions/start/invoke
        
        Valid modes:
        - new: Only add new services
        - remove: Only remove vanished services
        - fix_all: Add new and remove vanished services
        - refresh: Refresh all services (tabula rasa)
        - only_host_labels: Only discover host labels
        """
        json_data = {"host_name": hostname, "mode": mode}

        response = self._make_request(
            "POST",
            "domain-types/service_discovery_run/actions/start/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def wait_for_service_discovery(self, hostname: str) -> Dict:
        """
        Wait for service discovery completion

        Endpoint: POST /domain-types/service_discovery_run/actions/wait-for-completion/invoke
        """
        response = self._make_request(
            "POST",
            "domain-types/service_discovery_run/actions/wait-for-completion/invoke",
            json_data={"host_name": hostname},
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

    def start_bulk_discovery(
        self,
        hostnames: list,
        options: Dict = None,
        do_full_scan: bool = True,
        bulk_size: int = 10,
        ignore_errors: bool = True,
    ) -> Dict:
        """
        Start a bulk discovery job.

        Only one bulk discovery job can run at a time. An active bulk discovery job
        will block other bulk discovery jobs from running until the active job is finished.

        Endpoint: POST /domain-types/discovery_run/actions/bulk-discovery-start/invoke
        
        Args:
            hostnames: List of host names to discover
            options: Discovery options (monitor_undecided_services, remove_vanished_services, etc.)
            do_full_scan: Whether to perform a full scan
            bulk_size: Number of hosts to be handled at once
            ignore_errors: Whether to ignore errors in single check plug-ins
        """
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
        
        # Handle 204 No Content (success with no body)
        if response.status_code == 204:
            return {"success": True, "message": "Bulk discovery started"}
        
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

    def get_all_folders(
        self, parent: str = None, recursive: bool = False, show_hosts: bool = False
    ) -> Dict:
        """
        Get all folders

        Endpoint: GET /domain-types/folder_config/collections/all
        """
        params = {"recursive": recursive, "show_hosts": show_hosts}
        if parent:
            params["parent"] = parent

        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}

        response = self._make_request(
            "GET", "domain-types/folder_config/collections/all", params=params
        )
        return self._handle_response(response)

    def get_folder(self, folder_path: str, show_hosts: bool = False) -> Dict:
        """
        Get specific folder

        Endpoint: GET /objects/folder_config/{folder}
        """
        # Convert path separators to tildes for URL
        folder_url = folder_path.replace("/", "~").replace("\\", "~")
        params = {"show_hosts": show_hosts}

        response = self._make_request(
            "GET", f"objects/folder_config/{folder_url}", params=params
        )
        return self._handle_response(response)

    def create_folder(
        self, name: str, title: str, parent: str = "/", attributes: Dict = None
    ) -> Dict:
        """
        Create new folder

        Endpoint: POST /domain-types/folder_config/collections/all
        """
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
        """
        Update existing folder

        Endpoint: PUT /objects/folder_config/{folder}
        """
        # Convert path separators to tildes for URL
        folder_url = folder_path.replace("/", "~").replace("\\", "~")

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
        """
        Delete folder

        Endpoint: DELETE /objects/folder_config/{folder}
        """
        # Convert path separators to tildes for URL
        folder_url = folder_path.replace("/", "~").replace("\\", "~")
        params = {"delete_mode": delete_mode}

        response = self._make_request(
            "DELETE", f"objects/folder_config/{folder_url}", params=params
        )
        self._handle_response(response)
        return True

    def move_folder(self, folder_path: str, destination: str, etag: str = None) -> Dict:
        """
        Move folder to different location

        Endpoint: POST /objects/folder_config/{folder}/actions/move/invoke
        """
        # Convert path separators to tildes for URL
        folder_url = folder_path.replace("/", "~").replace("\\", "~")

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
        """
        Update multiple folders in one request

        Endpoint: PUT /domain-types/folder_config/actions/bulk-update/invoke
        """
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
        """
        Get all hosts in a specific folder

        Endpoint: GET /objects/folder_config/{folder}/collections/hosts
        """
        # Convert path separators to tildes for URL
        folder_url = folder_path.replace("/", "~").replace("\\", "~")
        params = {"effective_attributes": effective_attributes}

        response = self._make_request(
            "GET",
            f"objects/folder_config/{folder_url}/collections/hosts",
            params=params,
        )
        return self._handle_response(response)

    def get_folder_etag(self, folder_path: str) -> str:
        """Get ETag for a folder (used for updates)"""
        # Convert path separators to tildes for URL
        folder_url = folder_path.replace("/", "~").replace("\\", "~")

        response = self._make_request("GET", f"objects/folder_config/{folder_url}")

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for folder {folder_path}")

    # Host Tag Groups Methods

    def get_all_host_tag_groups(self) -> Dict:
        """
        Get all host tag groups

        Endpoint: GET /domain-types/host_tag_group/collections/all
        """
        response = self._make_request(
            "GET", "domain-types/host_tag_group/collections/all"
        )
        return self._handle_response(response)

    def get_host_tag_group(self, name: str) -> Dict:
        """
        Get specific host tag group

        Endpoint: GET /objects/host_tag_group/{name}
        """
        response = self._make_request("GET", f"objects/host_tag_group/{name}")
        return self._handle_response(response)

    def create_host_tag_group(
        self, id: str, title: str, tags: List[Dict], topic: str = None, help: str = None
    ) -> Dict:
        """
        Create new host tag group

        Endpoint: POST /domain-types/host_tag_group/collections/all
        """
        json_data = {"id": id, "title": title, "tags": tags}
        if topic is not None:
            json_data["topic"] = topic
        if help is not None:
            json_data["help"] = help

        response = self._make_request(
            "POST", "domain-types/host_tag_group/collections/all", json_data=json_data
        )
        return self._handle_response(response)

    def update_host_tag_group(
        self,
        name: str,
        title: str = None,
        tags: List[Dict] = None,
        topic: str = None,
        help: str = None,
        repair: bool = False,
        etag: str = None,
    ) -> Dict:
        """
        Update existing host tag group

        Endpoint: PUT /objects/host_tag_group/{name}
        """
        if etag is None:
            etag = self.get_host_tag_group_etag(name)

        json_data = {"repair": repair}
        if title is not None:
            json_data["title"] = title
        if tags is not None:
            json_data["tags"] = tags
        if topic is not None:
            json_data["topic"] = topic
        if help is not None:
            json_data["help"] = help

        response = self._make_request(
            "PUT", f"objects/host_tag_group/{name}", json_data=json_data, etag=etag
        )
        return self._handle_response(response)

    def delete_host_tag_group(
        self, name: str, repair: bool = False, mode: str = None
    ) -> bool:
        """
        Delete host tag group

        Endpoint: DELETE /objects/host_tag_group/{name}
        """
        params = {"repair": repair}
        if mode is not None:
            params["mode"] = mode

        response = self._make_request(
            "DELETE", f"objects/host_tag_group/{name}", params=params
        )
        self._handle_response(response)
        return True

    def get_host_tag_group_etag(self, name: str) -> str:
        """Get ETag for a host tag group (used for updates)"""
        response = self._make_request("GET", f"objects/host_tag_group/{name}")

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for host tag group {name}")

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

    def update_host_group(self, name: str, alias: str = None, etag: str = None) -> Dict:
        """
        Update existing host group

        Endpoint: PUT /objects/host_group_config/{name}
        """
        if etag is None:
            etag = self.get_host_group_etag(name)

        json_data = {}
        if alias is not None:
            json_data["alias"] = alias

        response = self._make_request(
            "PUT", f"objects/host_group_config/{name}", json_data=json_data, etag=etag
        )
        return self._handle_response(response)

    def delete_host_group(self, name: str) -> bool:
        """
        Delete host group

        Endpoint: DELETE /objects/host_group_config/{name}
        """
        response = self._make_request("DELETE", f"objects/host_group_config/{name}")
        self._handle_response(response)
        return True

    def bulk_update_host_groups(self, entries: List[Dict]) -> Dict:
        """
        Update multiple host groups in one request

        Endpoint: PUT /domain-types/host_group_config/actions/bulk-update/invoke
        """
        json_data = {"entries": entries}

        response = self._make_request(
            "PUT",
            "domain-types/host_group_config/actions/bulk-update/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def bulk_delete_host_groups(self, entries: List[str]) -> Dict:
        """
        Delete multiple host groups in one request

        Endpoint: DELETE /domain-types/host_group_config/actions/bulk-delete/invoke
        """
        json_data = {"entries": entries}

        response = self._make_request(
            "DELETE",
            "domain-types/host_group_config/actions/bulk-delete/invoke",
            json_data=json_data,
        )
        return self._handle_response(response)

    def get_host_group_etag(self, name: str) -> str:
        """Get ETag for a host group (used for updates)"""
        response = self._make_request("GET", f"objects/host_group_config/{name}")

        if response.status_code == 200:
            return response.headers.get("ETag", "*")
        else:
            raise CheckMKAPIError(f"Failed to get ETag for host group {name}")

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
