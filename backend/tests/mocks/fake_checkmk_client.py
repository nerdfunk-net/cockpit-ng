"""Stateful in-memory CheckMK simulation for unit testing.

Drop-in replacement for CheckMKClient. Routes host, folder, tag group,
host group, discovery, activation, and monitoring calls to in-memory
dictionaries. Supports error simulation via the ``error_on`` constructor
argument.

Usage::

    fake = FakeCheckMKClient()
    fake.seed_host("router1", {"ipaddress": "10.0.0.1"}, folder="/dc1")

    # Simulate a 404 error on host get
    fake_err = FakeCheckMKClient(error_on={("get_host", "router1"): 404})
"""

from __future__ import annotations

import uuid
import logging
from typing import Any

from services.checkmk.exceptions import CheckMKAPIError

logger = logging.getLogger(__name__)

# ── Well-known seed IDs ────────────────────────────────────────────────────────
FOLDER_ROOT = "~"
FOLDER_DC1 = "~dc1"
FOLDER_DC2 = "~dc1~access"

TAG_GROUP_AGENT_ID = "tag_agent"
TAG_GROUP_SITE_ID = "tag_site"

HOST_GROUP_NETWORK = "network-devices"
HOST_GROUP_SERVERS = "servers"


def _new_id() -> str:
    return str(uuid.uuid4())


def _host_envelope(hostname: str, attributes: dict, folder: str = "/") -> dict:
    """Return a CheckMK REST API host response envelope."""
    return {
        "id": hostname,
        "title": hostname,
        "domainType": "host_config",
        "extensions": {
            "folder": folder,
            "attributes": dict(attributes),
            "effective_attributes": None,
            "is_cluster": False,
            "is_offline": False,
            "cluster_nodes": None,
        },
        "links": [],
    }


def _folder_envelope(name: str, title: str, parent: str = "~") -> dict:
    return {
        "id": parent.rstrip("~") + "~" + name if parent != "~" else "~" + name,
        "title": title,
        "extensions": {
            "parent": parent,
            "path": (parent + "~" + name).replace("~~", "~"),
            "attributes": {},
            "hosts": [],
        },
    }


class FakeCheckMKClient:
    """Stateful in-memory CheckMK client for unit testing.

    All service classes depend on CheckMKClientFactory to obtain a client
    instance. Patch that factory to return a FakeCheckMKClient::

        with patch(
            "services.checkmk.host_service.CheckMKClientFactory.build_client_from_settings",
            return_value=FakeCheckMKClient(),
        ):
            ...
    """

    def __init__(
        self,
        error_on: dict[tuple[str, Any], int] | None = None,
    ):
        # error_on: {("method_name", arg): http_status}
        self._error_on: dict[tuple[str, Any], int] = error_on or {}

        # ── In-memory stores ──────────────────────────────────────────────────
        self._hosts: dict[str, dict] = {}  # hostname → envelope
        self._folders: dict[str, dict] = {}  # folder_id → envelope
        self._host_groups: dict[str, dict] = {}  # group_name → {name, alias}
        self._tag_groups: dict[str, dict] = {}  # group_id → full tag group
        self._pending_changes: list[dict] = []
        self._activations: dict[str, dict] = {}  # activation_id → status
        self._discovery_state: dict[str, dict] = {}  # hostname → {state, mode}

        # Problem tracking
        self._acknowledgements: dict[str, dict] = {}  # key → ack data
        self._downtimes: dict[str, dict] = {}  # hostname → downtime
        self._comments: dict[str, list[dict]] = {}  # key → list of comments

        # Monitored hosts (live data, separate from config hosts)
        self._monitored_hosts: dict[str, dict] = {}
        self._host_services: dict[str, list[dict]] = {}

        # Seed default folders
        self._folders[FOLDER_ROOT] = {
            "id": "~",
            "title": "Main directory",
            "extensions": {"parent": "~", "path": "~", "attributes": {}, "hosts": []},
        }
        self._folders[FOLDER_DC1] = _folder_envelope("dc1", "DC1", "~")
        self._folders[FOLDER_DC2] = _folder_envelope("access", "Access", "~dc1")

        # Seed default tag groups
        self._tag_groups[TAG_GROUP_AGENT_ID] = {
            "id": TAG_GROUP_AGENT_ID,
            "title": "Agent type",
            "topic": "monitoring",
            "help": "",
            "tags": [
                {"id": "cmk-agent", "title": "Normal Checkmk agent", "aux_tags": []},
                {"id": "no-agent", "title": "No agent", "aux_tags": []},
                {"id": "snmp-v2", "title": "SNMP v2 or v3", "aux_tags": []},
            ],
        }

        # Seed default host groups
        self._host_groups[HOST_GROUP_NETWORK] = {
            "name": HOST_GROUP_NETWORK,
            "alias": "Network Devices",
        }
        self._host_groups[HOST_GROUP_SERVERS] = {
            "name": HOST_GROUP_SERVERS,
            "alias": "Servers",
        }

        # Track method call counts for assertions
        self.call_log: list[tuple[str, Any]] = []

    # ── Seeding helpers ────────────────────────────────────────────────────────

    def seed_host(
        self,
        hostname: str,
        attributes: dict | None = None,
        folder: str = "/",
    ) -> None:
        """Pre-populate a host into the in-memory store."""
        self._hosts[hostname] = _host_envelope(hostname, attributes or {}, folder)

    def seed_folder(self, folder_id: str, title: str, parent: str = "~") -> None:
        name = folder_id.split("~")[-1]
        self._folders[folder_id] = _folder_envelope(name, title, parent)

    def seed_monitored_host(
        self, hostname: str, attributes: dict | None = None
    ) -> None:
        """Pre-populate a monitored host (live monitoring, not config)."""
        self._monitored_hosts[hostname] = {
            "host_name": hostname,
            "attributes": dict(attributes or {}),
            "state": 0,
        }

    def seed_host_services(self, hostname: str, services: list[dict]) -> None:
        """Pre-populate a host's service list for monitoring tests."""
        self._host_services[hostname] = services

    # ── Acknowledgement/downtime/comment helpers ───────────────────────────────

    def get_acknowledgement(self, key: str) -> dict | None:
        """Return stored acknowledgement for key (hostname or 'host:service')."""
        return self._acknowledgements.get(key)

    def get_downtime(self, hostname: str) -> dict | None:
        """Return stored downtime for a hostname."""
        return self._downtimes.get(hostname)

    def get_comments(self, key: str) -> list[dict]:
        """Return stored comments for key (hostname or 'host:service')."""
        return self._comments.get(key, [])

    # ── Error simulation ───────────────────────────────────────────────────────

    def _check_error(self, method: str, key: Any = None) -> None:
        status = self._error_on.get((method, key)) or self._error_on.get((method, "*"))
        if status is not None:
            raise CheckMKAPIError(
                f"Simulated error on {method}({key})", status_code=status
            )

    def _log(self, method: str, *args: Any) -> None:
        self.call_log.append((method, args))

    # =========================================================================
    # Host management
    # =========================================================================

    def get_all_hosts(
        self,
        effective_attributes: bool = False,
        include_links: bool = False,
        site: str | None = None,
        columns: list[str] | None = None,
    ) -> dict:
        self._log("get_all_hosts")
        self._check_error("get_all_hosts")
        value = list(self._hosts.values())
        return {"value": value}

    def get_host(self, hostname: str, effective_attributes: bool = False) -> dict:
        self._log("get_host", hostname)
        self._check_error("get_host", hostname)
        if hostname not in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)
        return self._hosts[hostname]

    def get_host_etag(self, hostname: str) -> str:
        if hostname not in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)
        return '"fake-etag-0000"'

    def create_host(
        self,
        hostname: str,
        folder: str = "/",
        attributes: dict | None = None,
        bake_agent: bool = False,
    ) -> dict:
        self._log("create_host", hostname)
        self._check_error("create_host", hostname)
        if hostname in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' already exists", status_code=400)
        envelope = _host_envelope(hostname, attributes or {}, folder)
        self._hosts[hostname] = envelope
        self._pending_changes.append({"type": "create_host", "hostname": hostname})
        return envelope

    def update_host(
        self, hostname: str, attributes: dict, etag: str | None = None
    ) -> dict:
        self._log("update_host", hostname)
        self._check_error("update_host", hostname)
        if hostname not in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)
        self._hosts[hostname]["extensions"]["attributes"].update(attributes)
        self._pending_changes.append({"type": "update_host", "hostname": hostname})
        return self._hosts[hostname]

    def delete_host(self, hostname: str) -> bool:
        self._log("delete_host", hostname)
        self._check_error("delete_host", hostname)
        if hostname not in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)
        del self._hosts[hostname]
        self._pending_changes.append({"type": "delete_host", "hostname": hostname})
        return True

    def move_host(self, hostname: str, target_folder: str) -> dict:
        self._log("move_host", hostname)
        self._check_error("move_host", hostname)
        if hostname not in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)
        self._hosts[hostname]["extensions"]["folder"] = target_folder
        return self._hosts[hostname]

    def rename_host(self, hostname: str, new_hostname: str) -> dict:
        self._log("rename_host", hostname)
        self._check_error("rename_host", hostname)
        if hostname not in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)
        envelope = self._hosts.pop(hostname)
        envelope["id"] = new_hostname
        envelope["title"] = new_hostname
        self._hosts[new_hostname] = envelope
        return envelope

    def bulk_create_hosts(self, hosts: list[dict]) -> dict:
        self._log("bulk_create_hosts")
        self._check_error("bulk_create_hosts")
        results = []
        for h in hosts:
            hostname = h["host_name"]
            folder = h.get("folder", "/")
            attributes = h.get("attributes", {})
            if hostname not in self._hosts:
                envelope = _host_envelope(hostname, attributes, folder)
                self._hosts[hostname] = envelope
                self._pending_changes.append(
                    {"type": "create_host", "hostname": hostname}
                )
                results.append(envelope)
        return {"value": results}

    def bulk_update_hosts(self, hosts: list[dict]) -> dict:
        self._log("bulk_update_hosts")
        for h in hosts:
            hostname = h.get("host_name")
            if hostname and hostname in self._hosts:
                self._hosts[hostname]["extensions"]["attributes"].update(
                    h.get("attributes", {})
                )
        return {"value": []}

    def bulk_delete_hosts(self, hostnames: list[str]) -> dict:
        self._log("bulk_delete_hosts")
        self._check_error("bulk_delete_hosts")
        for hostname in hostnames:
            self._hosts.pop(hostname, None)
        return {"value": []}

    def start_service_discovery(self, hostname: str, mode: str = "new") -> dict:
        self._log("start_service_discovery", hostname)
        self._check_error("start_service_discovery", hostname)
        if hostname not in self._hosts:
            raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)
        self._discovery_state[hostname] = {"state": "running", "mode": mode}
        return {"started": True, "id": _new_id(), "host_name": hostname, "mode": mode}

    # =========================================================================
    # Folder management
    # =========================================================================

    def get_all_folders(
        self,
        parent: str | None = None,
        recursive: bool = False,
        show_hosts: bool = False,
    ) -> dict:
        self._log("get_all_folders")
        self._check_error("get_all_folders")
        folders = list(self._folders.values())
        if parent:
            folders = [f for f in folders if f["extensions"].get("parent") == parent]
        return {"value": folders}

    def get_folder(self, folder_path: str, show_hosts: bool = False) -> dict:
        self._log("get_folder", folder_path)
        self._check_error("get_folder", folder_path)
        if folder_path not in self._folders:
            raise CheckMKAPIError(f"Folder '{folder_path}' not found", status_code=404)
        return self._folders[folder_path]

    def get_folder_etag(self, folder_path: str) -> str:
        return '"fake-folder-etag"'

    def create_folder(
        self, name: str, title: str, parent: str = "~", attributes: dict | None = None
    ) -> dict:
        self._log("create_folder", name)
        self._check_error("create_folder", name)
        folder_id = (parent.rstrip("~") + "~" + name) if parent != "~" else ("~" + name)
        if folder_id in self._folders:
            raise CheckMKAPIError(
                f"Folder '{name}' already exists in '{parent}'", status_code=400
            )
        envelope = _folder_envelope(name, title, parent)
        envelope["id"] = folder_id
        self._folders[folder_id] = envelope
        return envelope

    def update_folder(
        self,
        folder_path: str,
        title: str | None = None,
        attributes: dict | None = None,
        remove_attributes: list[str] | None = None,
        etag: str | None = None,
    ) -> dict:
        self._log("update_folder", folder_path)
        self._check_error("update_folder", folder_path)
        if folder_path not in self._folders:
            raise CheckMKAPIError(f"Folder '{folder_path}' not found", status_code=404)
        folder = self._folders[folder_path]
        if title is not None:
            folder["title"] = title
        if attributes:
            folder["extensions"]["attributes"].update(attributes)
        if remove_attributes:
            for key in remove_attributes:
                folder["extensions"]["attributes"].pop(key, None)
        return folder

    def delete_folder(self, folder_path: str, delete_mode: str = "recursive") -> bool:
        self._log("delete_folder", folder_path)
        self._check_error("delete_folder", folder_path)
        if folder_path not in self._folders:
            raise CheckMKAPIError(f"Folder '{folder_path}' not found", status_code=404)
        del self._folders[folder_path]
        return True

    def move_folder(
        self, folder_path: str, destination: str, etag: str | None = None
    ) -> dict:
        self._log("move_folder", folder_path)
        self._check_error("move_folder", folder_path)
        if folder_path not in self._folders:
            raise CheckMKAPIError(f"Folder '{folder_path}' not found", status_code=404)
        self._folders[folder_path]["extensions"]["parent"] = destination
        return self._folders[folder_path]

    # =========================================================================
    # Host group management
    # =========================================================================

    def get_host_groups(self) -> dict:
        self._log("get_host_groups")
        self._check_error("get_host_groups")
        return {"value": list(self._host_groups.values())}

    def get_host_group(self, group_name: str) -> dict:
        self._log("get_host_group", group_name)
        self._check_error("get_host_group", group_name)
        if group_name not in self._host_groups:
            raise CheckMKAPIError(
                f"Host group '{group_name}' not found", status_code=404
            )
        return self._host_groups[group_name]

    def get_host_group_etag(self, name: str) -> str:
        return '"fake-hg-etag"'

    def create_host_group(self, name: str, alias: str | None = None) -> dict:
        self._log("create_host_group", name)
        self._check_error("create_host_group", name)
        if name in self._host_groups:
            raise CheckMKAPIError(
                f"Host group '{name}' already exists", status_code=400
            )
        group = {"name": name, "alias": alias or name}
        self._host_groups[name] = group
        return group

    def update_host_group(
        self, name: str, alias: str | None = None, etag: str | None = None
    ) -> dict:
        self._log("update_host_group", name)
        self._check_error("update_host_group", name)
        if name not in self._host_groups:
            raise CheckMKAPIError(f"Host group '{name}' not found", status_code=404)
        if alias is not None:
            self._host_groups[name]["alias"] = alias
        return self._host_groups[name]

    def delete_host_group(self, name: str) -> bool:
        self._log("delete_host_group", name)
        self._check_error("delete_host_group", name)
        if name not in self._host_groups:
            raise CheckMKAPIError(f"Host group '{name}' not found", status_code=404)
        del self._host_groups[name]
        return True

    def bulk_update_host_groups(self, entries: list[dict]) -> dict:
        self._log("bulk_update_host_groups")
        for entry in entries:
            name = entry.get("name")
            if name and name in self._host_groups:
                if "alias" in entry:
                    self._host_groups[name]["alias"] = entry["alias"]
        return {"value": []}

    def bulk_delete_host_groups(self, entries: list[str]) -> dict:
        self._log("bulk_delete_host_groups")
        for name in entries:
            self._host_groups.pop(name, None)
        return {"value": []}

    # =========================================================================
    # Tag group management
    # =========================================================================

    def get_all_host_tag_groups(self) -> dict:
        self._log("get_all_host_tag_groups")
        self._check_error("get_all_host_tag_groups")
        envelopes = [
            {
                "id": g["id"],
                "title": g["title"],
                "extensions": {
                    "topic": g.get("topic"),
                    "help": g.get("help", ""),
                    "tags": g.get("tags", []),
                },
            }
            for g in self._tag_groups.values()
        ]
        return {"value": envelopes}

    def get_host_tag_group(self, name: str) -> dict:
        self._log("get_host_tag_group", name)
        self._check_error("get_host_tag_group", name)
        if name not in self._tag_groups:
            raise CheckMKAPIError(f"Tag group '{name}' not found", status_code=404)
        return self._tag_groups[name]

    def get_host_tag_group_etag(self, name: str) -> str:
        return '"fake-tg-etag"'

    def create_host_tag_group(
        self,
        id: str,
        title: str,
        tags: list[dict],
        topic: str | None = None,
        help: str | None = None,
    ) -> dict:
        self._log("create_host_tag_group", id)
        self._check_error("create_host_tag_group", id)
        if id in self._tag_groups:
            raise CheckMKAPIError(f"Tag group '{id}' already exists", status_code=400)
        group = {"id": id, "title": title, "tags": tags, "topic": topic, "help": help}
        self._tag_groups[id] = group
        return group

    def update_host_tag_group(
        self,
        name: str,
        title: str | None = None,
        tags: list[dict] | None = None,
        topic: str | None = None,
        help: str | None = None,
        repair: bool = False,
        etag: str | None = None,
    ) -> dict:
        self._log("update_host_tag_group", name)
        self._check_error("update_host_tag_group", name)
        if name not in self._tag_groups:
            raise CheckMKAPIError(f"Tag group '{name}' not found", status_code=404)
        group = self._tag_groups[name]
        if title is not None:
            group["title"] = title
        if tags is not None:
            group["tags"] = tags
        if topic is not None:
            group["topic"] = topic
        if help is not None:
            group["help"] = help
        return group

    def delete_host_tag_group(
        self, name: str, repair: bool = False, mode: str | None = None
    ) -> bool:
        self._log("delete_host_tag_group", name)
        self._check_error("delete_host_tag_group", name)
        if name not in self._tag_groups:
            raise CheckMKAPIError(f"Tag group '{name}' not found", status_code=404)
        del self._tag_groups[name]
        return True

    # =========================================================================
    # Discovery management
    # =========================================================================

    def get_service_discovery(self, hostname: str) -> dict:
        self._log("get_service_discovery", hostname)
        self._check_error("get_service_discovery", hostname)
        state = self._discovery_state.get(hostname, {"state": "idle", "mode": "new"})
        return {"host_name": hostname, "mode": state["mode"], "status": state["state"]}

    def wait_for_service_discovery(self, hostname: str) -> dict:
        self._log("wait_for_service_discovery", hostname)
        return {"host_name": hostname, "status": "completed"}

    def update_discovery_phase(self, hostname: str, **kwargs: Any) -> dict:
        self._log("update_discovery_phase", hostname)
        self._check_error("update_discovery_phase", hostname)
        if hostname not in self._discovery_state:
            self._discovery_state[hostname] = {"state": "idle", "mode": "new"}
        if "phase" in kwargs:
            self._discovery_state[hostname]["mode"] = kwargs["phase"]
        return {"host_name": hostname, "status": "updated", **kwargs}

    def start_bulk_discovery(
        self,
        hostnames: list[str],
        options: dict | None = None,
        do_full_scan: bool = True,
        bulk_size: int = 10,
        ignore_errors: bool = True,
    ) -> dict:
        self._log("start_bulk_discovery")
        self._check_error("start_bulk_discovery")
        for hostname in hostnames:
            self._discovery_state[hostname] = "bulk"
        return {"success": True, "message": "Bulk discovery started"}

    # =========================================================================
    # Activation management
    # =========================================================================

    def get_pending_changes(self) -> dict:
        self._log("get_pending_changes")
        return {"value": self._pending_changes}

    def activate_changes(
        self,
        sites: list[str] | None = None,
        force_foreign_changes: bool = False,
        redirect: bool = False,
        etag: str = "*",
    ) -> dict:
        self._log("activate_changes")
        self._check_error("activate_changes")
        activation_id = _new_id()
        self._activations[activation_id] = {
            "id": activation_id,
            "status": "completed",
            "sites": sites or [],
        }
        self._pending_changes.clear()
        return {"id": activation_id, "status": "completed"}

    def get_activation_status(self, activation_id: str) -> dict:
        self._log("get_activation_status", activation_id)
        if activation_id not in self._activations:
            raise CheckMKAPIError(
                f"Activation '{activation_id}' not found", status_code=404
            )
        return self._activations[activation_id]

    def wait_for_activation_completion(self, activation_id: str) -> dict:
        self._log("wait_for_activation_completion", activation_id)
        return self._activations.get(
            activation_id, {"id": activation_id, "status": "completed"}
        )

    def get_running_activations(self) -> dict:
        self._log("get_running_activations")
        running = [a for a in self._activations.values() if a["status"] == "running"]
        return {"value": running}

    # =========================================================================
    # Monitoring (live data)
    # =========================================================================

    def get_all_monitored_hosts(
        self, columns: list[str] | None = None, query: str | None = None
    ) -> dict:
        self._log("get_all_monitored_hosts")
        self._check_error("get_all_monitored_hosts")
        # Merge seeded monitored hosts with config hosts
        monitored = {
            **{h: {"id": h, "extensions": {"state": 0}} for h in self._hosts},
            **{
                h: {
                    "id": h,
                    "title": h,
                    "extensions": {
                        **v.get("attributes", {}),
                        "state": v.get("state", 0),
                    },
                }
                for h, v in self._monitored_hosts.items()
            },
        }
        return {"value": list(monitored.values())}

    def get_monitored_host(
        self, hostname: str, columns: list[str] | None = None
    ) -> dict:
        self._log("get_monitored_host", hostname)
        self._check_error("get_monitored_host", hostname)
        if hostname in self._monitored_hosts:
            data = self._monitored_hosts[hostname]
            return {
                "id": hostname,
                "extensions": {
                    **data.get("attributes", {}),
                    "state": data.get("state", 0),
                },
            }
        if hostname in self._hosts:
            return {"id": hostname, "extensions": {"state": 0, "alias": hostname}}
        raise CheckMKAPIError(f"Host '{hostname}' not found", status_code=404)

    def get_host_services(
        self,
        hostname: str,
        columns: list[str] | None = None,
        query: str | None = None,
    ) -> dict:
        self._log("get_host_services", hostname)
        self._check_error("get_host_services", hostname)
        services = self._host_services.get(hostname, [])
        return {"value": services}

    def show_service(
        self,
        hostname: str,
        service_description: str,
        columns: list[str] | None = None,
    ) -> dict:
        self._log("show_service", hostname)
        return {"id": service_description, "extensions": {"state": 0}}

    # =========================================================================
    # Problems (acknowledgements, downtimes, comments)
    # =========================================================================

    def acknowledge_host_problem(
        self,
        hostname: str,
        comment: str = "",
        sticky: bool = True,
        persistent: bool = False,
        notify: bool = True,
    ) -> dict:
        self._log("acknowledge_host_problem", hostname)
        self._check_error("acknowledge_host_problem", hostname)
        ack_data = {
            "hostname": hostname,
            "comment": comment,
            "sticky": sticky,
            "notify": notify,
        }
        self._acknowledgements[hostname] = ack_data
        return {"success": True, "hostname": hostname}

    def acknowledge_service_problem(
        self,
        hostname: str,
        service_description: str,
        comment: str = "",
        sticky: bool = True,
        persistent: bool = False,
        notify: bool = True,
    ) -> dict:
        self._log("acknowledge_service_problem", hostname)
        key = f"{hostname}:{service_description}"
        ack_data = {
            "hostname": hostname,
            "service": service_description,
            "comment": comment,
        }
        self._acknowledgements[key] = ack_data
        return {"success": True, "hostname": hostname, "service": service_description}

    def delete_acknowledgment(self, ack_id: str) -> bool:
        self._log("delete_acknowledgment", ack_id)
        self._acknowledgements.pop(ack_id, None)
        return True

    def create_host_downtime(
        self,
        hostname: str,
        start_time: str,
        end_time: str,
        comment: str = "",
        downtime_type: str = "host",
    ) -> dict:
        self._log("create_host_downtime", hostname)
        self._check_error("create_host_downtime", hostname)
        downtime = {
            "hostname": hostname,
            "start_time": start_time,
            "end_time": end_time,
            "comment": comment,
        }
        self._downtimes[hostname] = downtime
        return {"success": True, "hostname": hostname}

    def add_host_comment(
        self, hostname: str, comment: str = "", persistent: bool = False
    ) -> dict:
        self._log("add_host_comment", hostname)
        self._check_error("add_host_comment", hostname)
        entry = {"hostname": hostname, "comment": comment, "persistent": persistent}
        self._comments.setdefault(hostname, []).append(entry)
        return {"success": True, "hostname": hostname}

    def add_service_comment(
        self,
        hostname: str,
        service_description: str,
        comment: str = "",
        persistent: bool = False,
    ) -> dict:
        self._log("add_service_comment", hostname)
        key = f"{hostname}:{service_description}"
        entry = {
            "hostname": hostname,
            "service": service_description,
            "comment": comment,
        }
        self._comments.setdefault(key, []).append(entry)
        return {"success": True, "hostname": hostname}

    # =========================================================================
    # Helpers used by service classes for ETag-based operations
    # =========================================================================

    def test_connection(self) -> bool:
        return True

    def get_version(self) -> dict:
        return {"versions": {"checkmk": "2.3.0"}}

    def _make_request(self, method: str, endpoint: str, **kwargs: Any) -> Any:
        """Stub for low-level HTTP calls made directly by some service methods."""
        self._log("_make_request", endpoint)
        # Simulate a successful response object for pending_changes
        if "pending_changes" in endpoint:

            class _FakeResponse:
                status_code = 200
                headers: dict = {"ETag": '"fake-etag-123"'}

                def json(self_) -> dict:
                    return {"value": FakeCheckMKClient._pending_changes_data(self)}

            return _FakeResponse()

        # Generic 200 response for other endpoints
        class _FakeResponse:
            status_code = 200
            headers: dict = {}

            def json(self_) -> dict:
                return {}

        return _FakeResponse()

    def _handle_response(self, response: Any) -> dict:
        """Stub for the response handling helper."""
        return response.json()

    @staticmethod
    def _pending_changes_data(client: "FakeCheckMKClient") -> list:
        return client._pending_changes
