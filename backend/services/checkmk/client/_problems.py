import logging
from typing import Dict

logger = logging.getLogger(__name__)


class _ProblemsMixin:
    def acknowledge_host_problem(
        self,
        hostname: str,
        comment: str,
        sticky: bool = False,
        persistent: bool = False,
        notify: bool = False,
    ) -> Dict:
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
        json_data = {"delete_id": ack_id}

        response = self._make_request(
            "POST",
            "domain-types/acknowledge/actions/delete/invoke",
            json_data=json_data,
        )
        self._handle_response(response)
        return True

    def create_host_downtime(
        self,
        hostname: str,
        start_time: str,
        end_time: str,
        comment: str = "Scheduled downtime",
        downtime_type: str = "fixed",
    ) -> Dict:
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

    def add_host_comment(
        self, hostname: str, comment: str, persistent: bool = False
    ) -> Dict:
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
