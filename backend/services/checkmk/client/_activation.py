import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class _ActivationMixin:
    def get_pending_changes(self) -> Dict:
        response = self._make_request(
            "GET", "domain-types/activation_run/collections/pending_changes"
        )
        return self._handle_response(response)

    def activate_changes(
        self,
        sites: List[str] = None,
        force_foreign_changes: bool = False,
        redirect: bool = False,
        etag: str = "*",
    ) -> Dict:
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
            etag=etag,
        )
        return self._handle_response(response)

    def get_activation_status(self, activation_id: str) -> Dict:
        response = self._make_request("GET", f"objects/activation_run/{activation_id}")
        return self._handle_response(response)

    def wait_for_activation_completion(self, activation_id: str) -> Dict:
        response = self._make_request(
            "POST",
            f"objects/activation_run/{activation_id}/actions/wait-for-completion/invoke",
        )
        return self._handle_response(response)

    def get_running_activations(self) -> Dict:
        response = self._make_request(
            "GET", "domain-types/activation_run/collections/running"
        )
        return self._handle_response(response)
