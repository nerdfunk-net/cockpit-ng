"""
Heartbeat thread for agent health monitoring
"""

import logging
import threading
import time

import redis

from config import config

logger = logging.getLogger(__name__)


class HeartbeatThread(threading.Thread):
    """Background thread that updates agent status in Redis"""

    def __init__(self, redis_client: redis.Redis):
        super().__init__(daemon=True)
        self.redis_client = redis_client
        self._stop_event = threading.Event()
        self.commands_executed = 0
        self.started_at = int(time.time())

    def run(self):
        """Main heartbeat loop"""
        logger.info(
            f"Heartbeat thread started (interval: {config.heartbeat_interval}s)"
        )

        while not self._stop_event.is_set():
            try:
                self._update_heartbeat()
            except Exception as e:
                logger.error(f"Heartbeat update failed: {e}", exc_info=True)

            # Wait for next interval or stop event
            self._stop_event.wait(config.heartbeat_interval)

        logger.info("Heartbeat thread stopped")

    def _update_heartbeat(self):
        """Update agent status in Redis hash"""
        agent_key = config.get_agent_key()
        now = int(time.time())

        status_data = {
            "status": "online",
            "last_heartbeat": now,
            "version": config.agent_version,
            "hostname": config.agent_hostname,
            "capabilities": "git_pull,docker_restart,echo",
            "started_at": self.started_at,
            "commands_executed": self.commands_executed,
        }

        try:
            self.redis_client.hset(agent_key, mapping=status_data)
            # Set TTL to 3x heartbeat interval
            self.redis_client.expire(agent_key, config.heartbeat_interval * 3)
            logger.debug(f"Heartbeat updated: {agent_key}")
        except redis.ConnectionError:
            logger.error("Failed to update heartbeat: Redis connection error")
            raise

    def increment_command_counter(self):
        """Increment the commands executed counter"""
        self.commands_executed += 1

    def stop(self):
        """Stop the heartbeat thread gracefully"""
        logger.info("Stopping heartbeat thread...")
        self._stop_event.set()

    def mark_offline(self):
        """Mark agent as offline in Redis before shutdown"""
        try:
            agent_key = config.get_agent_key()
            self.redis_client.hset(agent_key, "status", "offline")
            logger.info("Agent marked as offline")
        except Exception as e:
            logger.error(f"Failed to mark agent offline: {e}")
