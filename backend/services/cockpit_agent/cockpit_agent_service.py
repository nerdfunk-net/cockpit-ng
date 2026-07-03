"""
Service for Grafana Agent management
Handles Redis Pub/Sub communication and command tracking
"""

import base64
import hashlib
import hmac
import json
import logging
import time
import uuid
from typing import Dict, List, Optional

import redis
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from config import settings
from repositories.cockpit_agent.cockpit_agent_repository import CockpitAgentRepository
from services.cockpit_agent.ansible_auth import ResolvedAnsibleAuth

logger = logging.getLogger(__name__)


class CockpitAgentService:
    """Service for managing Grafana Agents via Redis Pub/Sub"""

    def __init__(self, db: Session):
        self.db = db
        self.repository = CockpitAgentRepository(db)
        self.redis_client = self._get_redis_client()

    def _get_redis_client(self) -> redis.Redis:
        """Create Redis client from settings"""
        return redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
            **settings.redis_ssl_params,
        )

    def _get_agent_secret(self, agent_id: str) -> Optional[str]:
        """Look up the HMAC shared secret for a Cockpit agent from the settings table."""
        return self.repository.get_agent_shared_secret(agent_id)

    def _resolve_credential(self, credential_id: int) -> tuple[str, str]:
        """Fetch username and decrypted password from the credentials table."""
        import service_factory

        credentials_manager = service_factory.build_credentials_service()
        credential = credentials_manager.get_credential_by_id(credential_id)
        if not credential:
            raise ValueError(f"Credential {credential_id} not found")
        username = credential.get("username")
        if not username:
            raise ValueError(f"Credential {credential_id} has no username")
        password = credentials_manager.get_decrypted_password(credential_id)
        if not password:
            raise ValueError(f"Credential {credential_id} has no password")
        return username, password

    @staticmethod
    def _fernet_key(secret: str) -> bytes:
        """Derive a 32-byte Fernet key from an arbitrary shared secret string."""
        raw = hashlib.sha256(secret.encode()).digest()
        return base64.urlsafe_b64encode(raw)

    def _sign_and_encrypt_command(self, command_message: dict, secret: str) -> dict:
        """
        1. Fernet-encrypt any sensitive password/passphrase params in-place.
        2. Add HMAC-SHA256 signature over the entire message payload.

        Encrypted fields keep their original key names so agents look them up
        by the same name and decrypt before use. The signature covers the message
        after encryption so agents verify integrity before decrypting.
        """
        msg = {**command_message}
        params = dict(msg.get("params", {}))

        f = Fernet(self._fernet_key(secret))
        for field in ("password", "ansible_password", "ssh_passphrase"):
            if params.get(field):
                params[field] = f.encrypt(params[field].encode()).decode()

        msg = {**msg, "params": params}

        # Sign the message (without the auth field)
        timestamp = msg["timestamp"]
        canonical = json.dumps(msg, sort_keys=True)
        data_to_sign = f"{canonical}:{timestamp}".encode()
        signature = hmac.new(secret.encode(), data_to_sign, hashlib.sha256).hexdigest()

        return {**msg, "auth": {"signature": signature}}

    def send_command(
        self,
        agent_id: str,
        command: str,
        params: dict,
        sent_by: str,
    ) -> str:
        """
        Send command to agent via Redis Pub/Sub
        Returns command_id for tracking
        """
        # Generate unique command ID
        command_id = str(uuid.uuid4())

        # Build command message
        command_message = {
            "command_id": command_id,
            "command": command,
            "params": params,
            "timestamp": int(time.time()),
            "sender": "cockpit-backend",
        }

        # Shared secret is required — reject if not configured (Fix 1)
        secret = self._get_agent_secret(agent_id)
        if not secret:
            raise ValueError(
                f"No shared secret configured for agent '{agent_id}'. "
                "Configure the shared secret in Settings → Agents before sending credentials."
            )
        command_message = self._sign_and_encrypt_command(command_message, secret)

        # Save to database with sensitive fields redacted
        _SENSITIVE = {"password", "ansible_password", "ssh_passphrase"}
        params_for_db = {
            k: ("REDACTED" if k in _SENSITIVE else v) for k, v in params.items()
        }
        try:
            self.repository.save_command(
                agent_id=agent_id,
                command_id=command_id,
                command=command,
                params=json.dumps(params_for_db),
                sent_by=sent_by,
            )
        except Exception as e:
            logger.error("Failed to save command to database: %s", e)
            raise

        # Publish to Redis
        try:
            command_channel = f"cockpit-agent:{agent_id}"
            self.redis_client.publish(command_channel, json.dumps(command_message))
            logger.info(
                "Command sent to agent %s: %s (ID: %s)", agent_id, command, command_id
            )
        except redis.RedisError as e:
            logger.error("Failed to publish command to Redis: %s", e)
            # Update database status to error
            self.repository.update_command_result(
                command_id=command_id,
                status="error",
                error=f"Failed to send command: {str(e)}",
            )
            raise

        return command_id

    # Short per-read socket timeout.  Keeping this at 1 s means the blocking
    # recv loop wakes up frequently enough that Ctrl-C / graceful shutdown can
    # interrupt it, while still avoiding a busy-poll.
    _POLL_INTERVAL = 1

    def _open_subscription(self, agent_id: str) -> tuple:
        """
        Open a Redis pub/sub subscription for agent responses.

        Must be called BEFORE send_command to avoid a race where the agent
        responds before the caller has started listening.

        Returns (redis_client, pubsub) — caller is responsible for cleanup.
        """
        response_channel = f"cockpit-agent-response:{agent_id}"
        redis_sub = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_timeout=self._POLL_INTERVAL,
            **settings.redis_ssl_params,
        )
        pubsub = redis_sub.pubsub()
        pubsub.subscribe(response_channel)
        return redis_sub, pubsub

    def _drain_response(
        self,
        redis_sub,
        pubsub,
        command_id: str,
        timeout: int,
    ) -> dict:
        """
        Block until the agent publishes a response for *command_id*, then return it.
        Always closes *pubsub* and *redis_sub* before returning.
        """
        start_time = time.time()
        try:
            while time.time() - start_time < timeout:
                try:
                    message = pubsub.get_message(
                        ignore_subscribe_messages=True, timeout=self._POLL_INTERVAL
                    )
                except redis.exceptions.TimeoutError:
                    continue

                if message is None:
                    continue
                if message.get("type") != "message":
                    continue

                try:
                    response_data = json.loads(message["data"])
                except json.JSONDecodeError as e:
                    logger.error("Failed to parse response JSON: %s", e)
                    continue

                if response_data.get("command_id") != command_id:
                    continue

                # Progress updates: log and keep waiting for the final result.
                if response_data.get("type") == "progress":
                    logger.info(
                        "Agent progress for %s: %s/%s IPs completed",
                        command_id,
                        response_data.get("completed_ips", "?"),
                        response_data.get("total_ips", "?"),
                    )
                    continue

                # Serialize dict/list outputs to JSON string for DB storage
                raw_output = response_data.get("output")
                output_to_store = (
                    json.dumps(raw_output)
                    if isinstance(raw_output, (dict, list))
                    else raw_output
                )
                self.repository.update_command_result(
                    command_id=command_id,
                    status=response_data.get("status"),
                    output=output_to_store,
                    error=response_data.get("error"),
                    execution_time_ms=response_data.get("execution_time_ms"),
                )
                return response_data

            # Timeout
            self.repository.update_command_result(
                command_id=command_id,
                status="timeout",
                error=f"Response timeout after {timeout}s",
            )
            return {
                "command_id": command_id,
                "status": "timeout",
                "error": f"Response timeout after {timeout}s",
            }

        except redis.RedisError as e:
            logger.error("Redis error while waiting for response: %s", e)
            self.repository.update_command_result(
                command_id=command_id, status="error", error=str(e)
            )
            raise
        finally:
            pubsub.unsubscribe()
            pubsub.close()
            redis_sub.close()

    def send_command_and_wait(
        self,
        agent_id: str,
        command: str,
        params: dict,
        sent_by: str,
        timeout: int = 30,
    ) -> dict:
        """
        Subscribe to the response channel, send the command, then wait for the reply.

        Subscribing first prevents the race condition where an agent responds
        before the caller has started listening (common for fast error paths
        such as pre-flight checks that return in < 1 ms).
        """
        redis_sub, pubsub = self._open_subscription(agent_id)
        command_id = self.send_command(agent_id, command, params, sent_by)
        return self._drain_response(redis_sub, pubsub, command_id, timeout)

    def wait_for_response(
        self, agent_id: str, command_id: str, timeout: int = 30
    ) -> dict:
        """
        Wait for response from agent by command_id.

        Prefer send_command_and_wait for new call sites — it subscribes before
        sending and avoids the race condition described there.  This method is
        kept for callers that must separate send from wait.
        """
        redis_sub, pubsub = self._open_subscription(agent_id)
        return self._drain_response(redis_sub, pubsub, command_id, timeout)

    def get_agent_status(self, agent_id: str) -> Optional[Dict]:
        """
        Get agent health status from Redis registry
        Returns None if agent not found
        """
        try:
            agent_key = f"agents:{agent_id}"
            status_data = self.redis_client.hgetall(agent_key)

            if not status_data:
                return None

            # Convert string values to appropriate types
            # Support both agent_id (new) and hostname (legacy) fields
            return {
                "agent_id": agent_id,
                "status": status_data.get("status"),
                "last_heartbeat": int(status_data.get("last_heartbeat", 0)),
                "version": status_data.get("version"),
                "hostname": status_data.get(
                    "agent_id", status_data.get("hostname", agent_id)
                ),
                "capabilities": status_data.get("capabilities", ""),
                "started_at": int(status_data.get("started_at", 0)),
                "commands_executed": int(status_data.get("commands_executed", 0)),
            }

        except redis.RedisError as e:
            logger.error("Failed to get agent status from Redis: %s", e)
            raise

    def list_agents(self) -> List[Dict]:
        """
        List all registered agents from Redis
        Scans agents:* keys
        """
        try:
            agents = []
            agent_keys = self.redis_client.keys("agents:*")

            for agent_key in agent_keys:
                # Extract agent_id from key (remove "agents:" prefix)
                agent_id = agent_key.replace("agents:", "")
                status = self.get_agent_status(agent_id)
                if status:
                    agents.append(status)

            return agents

        except redis.RedisError as e:
            logger.error("Failed to list agents from Redis: %s", e)
            raise

    def check_agent_online(self, agent_id: str, max_age: int = 90) -> bool:
        """
        Check if agent is online based on heartbeat age
        Returns True if heartbeat is recent (< max_age seconds)
        """
        status = self.get_agent_status(agent_id)

        if not status:
            return False

        if status["status"] != "online":
            return False

        last_heartbeat = status["last_heartbeat"]
        age = int(time.time()) - last_heartbeat

        return age < max_age

    def get_command_history(self, agent_id: str, limit: int = 50):
        """Get command history for specific agent"""
        return self.repository.get_command_history(agent_id, limit)

    def get_all_command_history(self, limit: int = 100):
        """Get command history for all agents"""
        return self.repository.get_all_command_history(limit)

    def set_agent_shared_secret(self, agent_id: str, secret: str) -> None:
        """Upsert the HMAC shared secret for a Cockpit agent."""
        self.repository.set_agent_shared_secret(agent_id, secret)

    def send_git_pull(
        self,
        agent_id: str,
        repository_path: str,
        branch: str,
        sent_by: str,
        timeout: int = 30,
    ) -> dict:
        """
        Convenience method: Send git pull command and wait for response
        """
        if not self.check_agent_online(agent_id):
            return {"status": "error", "error": "Agent is offline or not responding"}

        return self.send_command_and_wait(
            agent_id=agent_id,
            command="git_pull",
            params={"repository_path": repository_path, "branch": branch},
            sent_by=sent_by,
            timeout=timeout,
        )

    def send_ping(
        self,
        agent_id: str,
        devices: List[dict],
        sent_by: str,
        timeout: int = 120,
    ) -> dict:
        """
        Convenience method: Send ping command and wait for response.
        *devices* is the list already built by the router (device_name, device_id, ip_addresses).
        """
        if not self.check_agent_online(agent_id):
            return {
                "status": "error",
                "error": "Agent is offline or not responding",
                "command_id": "",
                "execution_time_ms": 0,
            }

        return self.send_command_and_wait(
            agent_id=agent_id,
            command="ping",
            params={"devices": devices},
            sent_by=sent_by,
            timeout=timeout,
        )

    def send_docker_restart(
        self,
        agent_id: str,
        sent_by: str,
        timeout: int = 60,
    ) -> dict:
        """
        Convenience method: Send docker restart command and wait for response
        Container name is configured in agent's .env file
        """
        if not self.check_agent_online(agent_id):
            return {"status": "error", "error": "Agent is offline or not responding"}

        return self.send_command_and_wait(
            agent_id=agent_id,
            command="docker_restart",
            params={},
            sent_by=sent_by,
            timeout=timeout,
        )

    # ------------------------------------------------------------------
    # Ansible agent convenience methods
    # ------------------------------------------------------------------

    def _build_ansible_params(
        self,
        ip_address: str,
        auth: ResolvedAnsibleAuth,
        *,
        ansible_port: int = 22,
    ) -> Dict:
        """Resolve auth secrets server-side and build the agent command params.

        Three auth modes (see ResolvedAnsibleAuth):
          SSH key (no passphrase): use_sshkey=True, credential_id=None, ansible_user required
          SSH key with passphrase: use_sshkey=True, credential_id set (password = passphrase)
          Username/password:       use_sshkey=False, credential_id set
        """
        params: Dict = {
            "ip_address": ip_address,
            "use_sshkey": auth.use_sshkey,
            "ansible_port": ansible_port,
        }

        if auth.use_sshkey and auth.credential_id is None:
            if not auth.ansible_user:
                raise ValueError(
                    "ansible_user is required for SSH key auth without a credential"
                )
            params["ansible_user"] = auth.ansible_user
        elif auth.credential_id is not None:
            import service_factory

            creds_svc = service_factory.build_credentials_service()
            cred = creds_svc.get_credential_by_id(auth.credential_id)
            if not cred:
                raise ValueError(f"Credential {auth.credential_id} not found")
            params["ansible_user"] = cred.get("username") or auth.ansible_user
            if not params["ansible_user"]:
                raise ValueError(f"Credential {auth.credential_id} has no username")
            secret = creds_svc.get_decrypted_password(auth.credential_id)
            if auth.use_sshkey:
                # SSH key with passphrase — password field holds the passphrase
                if secret:
                    params["ssh_passphrase"] = secret
            else:
                # Username/password auth
                if not secret:
                    raise ValueError(f"Credential {auth.credential_id} has no password")
                params["ansible_password"] = secret
        else:
            raise ValueError("credential_id is required when use_sshkey is False")

        return params

    def _send_ansible_command(
        self,
        agent_id: str,
        command: str,
        ip_address: str,
        auth: ResolvedAnsibleAuth,
        sent_by: str,
        *,
        ansible_port: int = 22,
        timeout: int = 60,
    ) -> dict:
        if not self.check_agent_online(agent_id):
            return {"status": "error", "error": "Agent is offline or not responding"}

        params = self._build_ansible_params(ip_address, auth, ansible_port=ansible_port)

        return self.send_command_and_wait(
            agent_id=agent_id,
            command=command,
            params=params,
            sent_by=sent_by,
            timeout=timeout,
        )

    def send_ansible_get_facts(
        self,
        agent_id: str,
        ip_address: str,
        use_sshkey: bool,
        sent_by: str,
        *,
        ansible_user: Optional[str] = None,
        credential_id: Optional[int] = None,
        ansible_port: int = 22,
        timeout: int = 60,
    ) -> dict:
        """
        Resolve auth credentials server-side, then send get_facts to an Ansible agent.

        Three auth modes:
          SSH key (no passphrase): use_sshkey=True, credential_id=None, ansible_user required
          SSH key with passphrase: use_sshkey=True, credential_id set (password = passphrase)
          Username/password:       use_sshkey=False, credential_id set
        """
        auth = ResolvedAnsibleAuth(
            use_sshkey=use_sshkey,
            ansible_user=ansible_user,
            credential_id=credential_id,
        )
        return self._send_ansible_command(
            agent_id,
            "get_facts",
            ip_address,
            auth,
            sent_by,
            ansible_port=ansible_port,
            timeout=timeout,
        )

    def send_open_ports_scan(
        self,
        agent_id: str,
        ip_address: str,
        use_sshkey: bool,
        sent_by: str,
        *,
        ansible_user: Optional[str] = None,
        credential_id: Optional[int] = None,
        ansible_port: int = 22,
        timeout: int = 60,
    ) -> dict:
        """
        Resolve auth credentials server-side, then send get_open_ports to an Ansible agent.

        Same three auth modes as send_ansible_get_facts:
          SSH key (no passphrase): use_sshkey=True, credential_id=None, ansible_user required
          SSH key with passphrase: use_sshkey=True, credential_id set (password = passphrase)
          Username/password:       use_sshkey=False, credential_id set
        """
        auth = ResolvedAnsibleAuth(
            use_sshkey=use_sshkey,
            ansible_user=ansible_user,
            credential_id=credential_id,
        )
        return self._send_ansible_command(
            agent_id,
            "get_open_ports",
            ip_address,
            auth,
            sent_by,
            ansible_port=ansible_port,
            timeout=timeout,
        )

    def send_nmap_scan(
        self,
        agent_id: str,
        ip_address: str,
        sent_by: str,
        *,
        ports: Optional[str] = None,
        scan_type: Optional[str] = None,
        service_detection: Optional[bool] = None,
        timeout: int = 300,
    ) -> dict:
        """
        Send scan_ports to a Cockpit nmap agent and wait for the result.

        No credentials are required — the agent runs nmap from its own network
        position toward the target IP.
        """
        if not self.check_agent_online(agent_id):
            return {"status": "error", "error": "Agent is offline or not responding"}

        params: Dict = {"ip_address": ip_address}
        if ports is not None:
            params["ports"] = ports
        if scan_type is not None:
            params["scan_type"] = scan_type
        if service_detection is not None:
            params["service_detection"] = service_detection

        return self.send_command_and_wait(
            agent_id=agent_id,
            command="scan_ports",
            params=params,
            sent_by=sent_by,
            timeout=timeout,
        )

    # ------------------------------------------------------------------
    # Netmiko agent convenience methods
    # ------------------------------------------------------------------

    def _netmiko_online_check(self, agent_id: str) -> Optional[dict]:
        """Return an error dict if the agent is offline, else None."""
        if not self.check_agent_online(agent_id):
            return {"status": "error", "error": "Agent is offline or not responding"}
        return None

    def send_netmiko_execute_commands(
        self,
        agent_id: str,
        ip_address: str,
        device_type: str,
        credential_id: int,
        commands: List[str],
        sent_by: str,
        *,
        enable_mode: bool = False,
        write_config: bool = False,
        use_textfsm: bool = False,
        privileged: bool = False,
        timeout: int = 120,
    ) -> dict:
        """Execute arbitrary commands on a device via a Netmiko agent."""
        err = self._netmiko_online_check(agent_id)
        if err:
            return err

        username, password = self._resolve_credential(credential_id)
        return self.send_command_and_wait(
            agent_id=agent_id,
            command="execute_commands",
            params={
                "ip_address": ip_address,
                "device_type": device_type,
                "credential_id": credential_id,
                "username": username,
                "password": password,
                "commands": commands,
                "enable_mode": enable_mode,
                "write_config": write_config,
                "use_textfsm": use_textfsm,
                "privileged": privileged,
            },
            sent_by=sent_by,
            timeout=timeout,
        )

    def send_netmiko_get_running_config(
        self,
        agent_id: str,
        ip_address: str,
        device_type: str,
        credential_id: int,
        sent_by: str,
        *,
        privileged: bool = False,
        timeout: int = 120,
    ) -> dict:
        """Retrieve running configuration from a device via a Netmiko agent."""
        err = self._netmiko_online_check(agent_id)
        if err:
            return err

        username, password = self._resolve_credential(credential_id)
        return self.send_command_and_wait(
            agent_id=agent_id,
            command="get_running_config",
            params={
                "ip_address": ip_address,
                "device_type": device_type,
                "credential_id": credential_id,
                "username": username,
                "password": password,
                "privileged": privileged,
            },
            sent_by=sent_by,
            timeout=timeout,
        )

    def send_netmiko_get_startup_config(
        self,
        agent_id: str,
        ip_address: str,
        device_type: str,
        credential_id: int,
        sent_by: str,
        *,
        privileged: bool = False,
        timeout: int = 120,
    ) -> dict:
        """Retrieve startup configuration from a device via a Netmiko agent."""
        err = self._netmiko_online_check(agent_id)
        if err:
            return err

        username, password = self._resolve_credential(credential_id)
        return self.send_command_and_wait(
            agent_id=agent_id,
            command="get_startup_config",
            params={
                "ip_address": ip_address,
                "device_type": device_type,
                "credential_id": credential_id,
                "username": username,
                "password": password,
                "privileged": privileged,
            },
            sent_by=sent_by,
            timeout=timeout,
        )
