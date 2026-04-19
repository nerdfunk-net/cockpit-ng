import json
import logging
from typing import Dict, List

import requests
from urllib.parse import urljoin

from services.checkmk.exceptions import CheckMKAPIError

logger = logging.getLogger(__name__)


class _CheckMKBase:
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
        self.host = host
        self.site_name = site_name
        self.username = username
        self.password = password
        self.protocol = protocol
        self.verify_ssl = verify_ssl
        self.timeout = timeout

        self.base_url = f"{protocol}://{host}/{site_name}/check_mk/api/1.0"

        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {username} {password}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        )
        self.session.verify = verify_ssl

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
        url = urljoin(self.base_url + "/", endpoint)

        request_headers = self.session.headers.copy()
        if headers:
            request_headers.update(headers)
        if etag:
            request_headers["If-Match"] = etag

        self.logger.debug("Making CheckMK API request: %s %s", method, url)
        if params:
            self.logger.debug("Params: %s", params)
        if json_data:
            self.logger.debug("JSON Data: %s", json_data)

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=request_headers,
                timeout=self.timeout,
            )

            self.logger.debug("Response Status: %s", response.status_code)
            if response.content:
                try:
                    response_json = response.json()
                    self.logger.debug(
                        "Response Body (first 500 chars): %s", str(response_json)[:500]
                    )
                except (json.JSONDecodeError, ValueError):
                    self.logger.debug(
                        "Response Text (first 500 chars): %s", response.text[:500]
                    )

            return response

        except requests.exceptions.RequestException as e:
            self.logger.error("Request exception: %s", str(e))
            raise CheckMKAPIError(f"Request failed: {str(e)}")

    def _handle_response(self, response: requests.Response) -> Dict:
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

                self.logger.error("API Error Details:")
                self.logger.error("Status Code: %s", response.status_code)
                self.logger.error("Response Text: %s", response.text[:500])
                self.logger.error("Error Data: %s", error_data)

                error_msg = f"API request failed: {response.status_code}"
                if error_data:
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
            self.logger.error("JSON decode error: %s", str(e))
            self.logger.error("Raw response (first 500 chars): %s", response.text[:500])
            raise CheckMKAPIError(
                f"Invalid JSON response: {response.text[:500]}",
                status_code=response.status_code,
            )

    def test_connection(self) -> bool:
        try:
            response = self._make_request("GET", "version")
            return response.status_code == 200
        except CheckMKAPIError:
            return False

    def get_version(self) -> Dict:
        response = self._make_request("GET", "version")
        return self._handle_response(response)

    def bulk_operation(self, operations: List[Dict]) -> List[Dict]:
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
