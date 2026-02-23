"""
Service for Grafana Agent management
Handles Redis Pub/Sub communication and command tracking
"""

import json
import logging
import time
import uuid
from typing import Dict, List, Optional

import redis
from sqlalchemy.orm import Session

from config import settings
from repositories.cockpit_agent_repository import CockpitAgentRepository

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
        )

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

        # Save to database
        try:
            self.repository.save_command(
                agent_id=agent_id,
                command_id=command_id,
                command=command,
                params=json.dumps(params),
                sent_by=sent_by,
            )
        except Exception as e:
            logger.error(f"Failed to save command to database: {e}")
            raise

        # Publish to Redis
        try:
            command_channel = f"cockpit-agent:{agent_id}"
            self.redis_client.publish(command_channel, json.dumps(command_message))
            logger.info(
                f"Command sent to agent {agent_id}: {command} (ID: {command_id})"
            )
        except redis.RedisError as e:
            logger.error(f"Failed to publish command to Redis: {e}")
            # Update database status to error
            self.repository.update_command_result(
                command_id=command_id,
                status="error",
                error=f"Failed to send command: {str(e)}",
            )
            raise

        return command_id

    def wait_for_response(
        self, agent_id: str, command_id: str, timeout: int = 30
    ) -> dict:
        """
        Wait for response from agent
        Subscribes to response channel and blocks until response or timeout
        """
        response_channel = f"cockpit-agent-response:{agent_id}"

        try:
            # Create separate Redis client for subscription (can't use same client for pub/sub)
            redis_sub = redis.from_url(
                settings.redis_url, decode_responses=True, socket_timeout=timeout
            )
            pubsub = redis_sub.pubsub()
            pubsub.subscribe(response_channel)

            # Wait for response
            start_time = time.time()
            for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    response_data = json.loads(message["data"])

                    # Check if this is the response we're waiting for
                    if response_data.get("command_id") == command_id:
                        # Update database with result
                        self.repository.update_command_result(
                            command_id=command_id,
                            status=response_data.get("status"),
                            output=response_data.get("output"),
                            error=response_data.get("error"),
                            execution_time_ms=response_data.get("execution_time_ms"),
                        )

                        pubsub.unsubscribe()
                        pubsub.close()
                        redis_sub.close()
                        return response_data

                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse response JSON: {e}")
                    continue

                # Check timeout
                if time.time() - start_time > timeout:
                    break

            # Timeout occurred
            pubsub.unsubscribe()
            pubsub.close()
            redis_sub.close()

            # Update database status to timeout
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
            logger.error(f"Redis error while waiting for response: {e}")
            self.repository.update_command_result(
                command_id=command_id, status="error", error=str(e)
            )
            raise

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
            logger.error(f"Failed to get agent status from Redis: {e}")
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
            logger.error(f"Failed to list agents from Redis: {e}")
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
        # Check agent is online
        if not self.check_agent_online(agent_id):
            return {
                "status": "error",
                "error": "Agent is offline or not responding",
            }

        # Send command
        command_id = self.send_command(
            agent_id=agent_id,
            command="git_pull",
            params={"repository_path": repository_path, "branch": branch},
            sent_by=sent_by,
        )

        # Wait for response
        return self.wait_for_response(agent_id, command_id, timeout)

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
        # Check agent is online
        if not self.check_agent_online(agent_id):
            return {
                "status": "error",
                "error": "Agent is offline or not responding",
            }

        # Send command (container_name from agent's .env)
        command_id = self.send_command(
            agent_id=agent_id,
            command="docker_restart",
            params={},
            sent_by=sent_by,
        )

        # Wait for response
        return self.wait_for_response(agent_id, command_id, timeout)
