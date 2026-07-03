"""
Shared Ansible auth-mode resolution for facts/open-ports job scans.

Three auth modes are used by the get_server_facts / get_open_ports job
templates (and their ad-hoc single-server refresh counterparts):

  ssh_key            - agent's configured SSH key, no passphrase
                        (ansible_user required, no credential_id)
  ssh_key_passphrase - SSH key protected by a passphrase
                        (credential_id required; its password field holds the passphrase)
  credentials        - username/password auth (credential_id required)

See doc/refactoring/FACTS-PORTS-REFACTORING.md — Phase 1.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

AnsibleAuthType = Literal["ssh_key", "ssh_key_passphrase", "credentials"]

_VALID_AUTH_TYPES = ("ssh_key", "ssh_key_passphrase", "credentials")


class AnsibleAuthError(ValueError):
    """Raised when an auth_type/credential_id/ansible_user combination is invalid."""


@dataclass(frozen=True)
class ResolvedAnsibleAuth:
    """Auth mode resolved to the (use_sshkey, ansible_user, credential_id) triple
    consumed by CockpitAgentService.send_ansible_get_facts / send_open_ports_scan
    and (partially) persisted as AnsibleCredentials on the Server record.
    """

    use_sshkey: bool
    ansible_user: Optional[str]
    credential_id: Optional[int]


def resolve_ansible_auth(
    *,
    auth_type: str,
    credential_id: Optional[int],
    ansible_user: Optional[str],
    credentials_service=None,
) -> ResolvedAnsibleAuth:
    """Validate an auth_type + credential_id/ansible_user combination and resolve
    it to a ResolvedAnsibleAuth.

    For "ssh_key_passphrase" and "credentials" modes, the username is looked up
    from the credential (the caller's ansible_user, if any, is ignored).
    *credentials_service* may be injected for testing; defaults to
    ``service_factory.build_credentials_service()``.
    """
    if auth_type not in _VALID_AUTH_TYPES:
        raise AnsibleAuthError(f"Invalid auth_type: {auth_type}")

    use_sshkey = auth_type in ("ssh_key", "ssh_key_passphrase")

    if auth_type == "ssh_key":
        if not ansible_user:
            raise AnsibleAuthError(
                "SSH username is required for SSH key authentication"
            )
        return ResolvedAnsibleAuth(
            use_sshkey=True, ansible_user=ansible_user, credential_id=None
        )

    if not credential_id:
        raise AnsibleAuthError(
            "No credential_id specified. Please select credentials on the schedule."
        )

    if credentials_service is None:
        import service_factory

        credentials_service = service_factory.build_credentials_service()

    credential = credentials_service.get_credential_by_id(credential_id)
    if not credential:
        raise AnsibleAuthError(f"Credential {credential_id} not found")
    resolved_user = credential.get("username")
    if not resolved_user:
        raise AnsibleAuthError(f"Credential {credential_id} has no username")

    return ResolvedAnsibleAuth(
        use_sshkey=use_sshkey, ansible_user=resolved_user, credential_id=credential_id
    )
