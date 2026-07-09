#!/usr/bin/env python3
"""
Cockpit Get Data Agent — runs a fixed SSH/SFTP pipeline from config.yaml.

Listens for commands via Redis Pub/Sub. Only ``echo`` and ``get_data`` are
accepted; remote work is defined exclusively in config.yaml at startup.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import signal
import sys
import time
from collections import deque
from typing import Optional

import redis

from config import config
from command_config import load_command_pipeline
from executor import CommandExecutor
from heartbeat import HeartbeatThread

# Configure logging
logging.basicConfig(
    level=config.loglevel,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


class CockpitAgent:
    """Main agent class"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        self.executor: Optional[CommandExecutor] = None
        self.heartbeat_thread: Optional[HeartbeatThread] = None
        self.command_buffer = deque(maxlen=100)
        self.running = True
        self.redis_connected = False

        # Register signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

    def _ensure_executor(self) -> CommandExecutor:
        if self.executor is None:
            self.executor = CommandExecutor()
        return self.executor

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        logger.info(f"Received signal {signum}, initiating shutdown...")
        self.running = False

    def _connect_redis(self) -> bool:
        """
        Connect to Redis with retry logic
        Returns True if connected, False otherwise
        """
        try:
            self.redis_client = redis.Redis(
                host=config.redis_host,
                port=config.redis_port,
                password=config.redis_password,
                db=config.redis_db,
                ssl=config.redis_ssl,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                **config.redis_ssl_kwargs,
            )

            # Test connection
            self.redis_client.ping()
            logger.info(
                f"Connected to Redis at {config.redis_host}:{config.redis_port}"
            )
            self.redis_connected = True
            return True

        except redis.ConnectionError as e:
            logger.error(f"Redis connection failed: {e}")
            self.redis_connected = False
            return False

    def _register_agent(self):
        """Register agent in Redis registry"""
        if not self.redis_client or not self.executor:
            return

        try:
            agent_key = config.get_agent_key()
            now = int(time.time())

            status_data = {
                "status": "online",
                "last_heartbeat": now,
                "version": config.agent_version,
                "agent_id": config.agent_id,
                "capabilities": ",".join(self.executor.handlers.keys()),
                "started_at": now,
                "commands_executed": 0,
            }

            self.redis_client.hset(agent_key, mapping=status_data)
            self.redis_client.expire(agent_key, config.heartbeat_interval * 3)
            logger.info(f"Agent registered: {agent_key}")

        except Exception as e:
            logger.error(f"Failed to register agent: {e}")

    def _start_heartbeat(self):
        """Start the heartbeat thread"""
        if not self.redis_client or not self.executor:
            return

        try:
            capabilities = ",".join(self.executor.handlers.keys())
            self.heartbeat_thread = HeartbeatThread(self.redis_client, capabilities)
            self.heartbeat_thread.start()
            logger.info("Heartbeat thread started")
        except Exception as e:
            logger.error(f"Failed to start heartbeat: {e}")

    def _stop_heartbeat(self):
        """Stop the heartbeat thread"""
        if self.heartbeat_thread:
            self.heartbeat_thread.mark_offline()
            self.heartbeat_thread.stop()
            self.heartbeat_thread.join(timeout=5)
            logger.info("Heartbeat thread stopped")

    async def _flush_command_buffer(self):
        """Flush buffered commands when Redis reconnects"""
        if not self.command_buffer:
            return

        logger.info(f"Flushing {len(self.command_buffer)} buffered commands")

        while self.command_buffer:
            try:
                command_data = self.command_buffer.popleft()
                await self._execute_and_respond(command_data)
                logger.info(f"Executed buffered command: {command_data['command_id']}")
            except Exception as e:
                logger.error(f"Failed to execute buffered command: {e}")

    def _make_progress_publisher(self, command_id: str):
        """
        Return a callable that publishes a progress update to the response channel.
        The backend's wait_for_response recognises type='progress' messages and
        keeps waiting instead of treating them as the final result.
        """
        response_channel = config.get_response_channel()

        def publish_progress(data: dict) -> None:
            try:
                message = {"command_id": command_id, "type": "progress", **data}
                self.redis_client.publish(response_channel, json.dumps(message))
                logger.debug(f"Progress update sent for {command_id}: {data}")
            except Exception as e:
                logger.warning(f"Failed to send progress update: {e}")

        return publish_progress

    async def _execute_and_respond(self, command_data: dict):
        """Execute command and send response"""
        command_id = command_data.get("command_id")
        command = command_data.get("command")
        params = command_data.get("params", {})

        logger.info(f"Executing command: {command} (ID: {command_id})")

        publish_progress = self._make_progress_publisher(command_id)

        # Execute command
        result = await self._ensure_executor().execute(
            command, params, publish_progress=publish_progress
        )

        # Increment counter
        if self.heartbeat_thread:
            self.heartbeat_thread.increment_command_counter()

        # Prepare response
        response = {
            "command_id": command_id,
            "status": result["status"],
            "output": result.get("output"),
            "error": result.get("error"),
            "execution_time_ms": result.get("execution_time_ms", 0),
            "timestamp": int(time.time()),
        }

        # Send response
        try:
            response_channel = config.get_response_channel()
            self.redis_client.publish(response_channel, json.dumps(response))
            logger.info(
                f"Response sent: {command_id} - {result['status']} "
                f"({result.get('execution_time_ms', 0)}ms)"
            )
        except Exception as e:
            logger.error(f"Failed to send response: {e}")

    def _verify_message_auth(self, command_data: dict) -> bool:
        """Verify HMAC-SHA256 signature and replay-protection timestamp."""
        auth = command_data.get("auth")
        if not auth or not isinstance(auth, dict):
            logger.warning("Rejected message: missing auth field")
            return False

        signature = auth.get("signature", "")
        timestamp = command_data.get("timestamp")

        if not signature or timestamp is None:
            logger.warning("Rejected message: missing signature or timestamp")
            return False

        age = abs(time.time() - int(timestamp))
        if age > 300:
            logger.warning("Rejected message: timestamp too old (%ds)", age)
            return False

        payload = {k: v for k, v in command_data.items() if k != "auth"}
        canonical = json.dumps(payload, sort_keys=True)
        data_to_sign = f"{canonical}:{timestamp}".encode()

        expected = hmac.new(
            config.shared_secret.encode(),
            data_to_sign,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            logger.warning(
                "Rejected message: HMAC signature mismatch (command_id=%s)",
                command_data.get("command_id"),
            )
            return False

        return True

    async def _handle_message(self, message):
        """Handle incoming Pub/Sub message"""
        if message["type"] != "message":
            return

        try:
            command_data = json.loads(message["data"])

            # Validate command structure
            if not all(key in command_data for key in ["command_id", "command"]):
                logger.error(f"Invalid command structure: {command_data}")
                return

            # Verify HMAC signature
            if not self._verify_message_auth(command_data):
                return

            # Execute command
            await self._execute_and_respond(command_data)

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse command JSON: {e}")
        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)

    async def _listen_loop(self):
        """Main listening loop for commands"""
        command_channel = config.get_command_channel()

        try:
            self.pubsub = self.redis_client.pubsub()
            self.pubsub.subscribe(command_channel)
            logger.info(f"Subscribed to channel: {command_channel}")

            # Process messages with timeout to allow checking self.running
            while self.running:
                message = self.pubsub.get_message(timeout=1.0)

                if message:
                    await self._handle_message(message)
                else:
                    # No message, just sleep briefly and check again
                    await asyncio.sleep(0.1)

        except redis.ConnectionError as e:
            logger.error(f"Redis connection lost: {e}")
            self.redis_connected = False
            raise
        finally:
            if self.pubsub:
                self.pubsub.unsubscribe()
                self.pubsub.close()

    async def run(self):
        """Main agent run loop with reconnection logic"""
        logger.info(f"Starting Cockpit Agent v{config.agent_version}")
        logger.info(f"Agent ID: {config.agent_id}")

        # Validate configuration
        valid, error = config.validate()
        if not valid:
            logger.error(f"Configuration error: {error}")
            sys.exit(1)

        try:
            load_command_pipeline(config.config_path)
        except Exception as exc:
            logger.error("Pipeline config error: %s", exc)
            sys.exit(1)

        self._ensure_executor()

        while self.running:
            try:
                # Connect to Redis
                if not self._connect_redis():
                    logger.error("Buffering mode active (Redis unavailable)")
                    await asyncio.sleep(10)
                    continue

                # Register agent
                self._register_agent()

                # Start heartbeat
                self._start_heartbeat()

                # Flush any buffered commands
                await self._flush_command_buffer()

                # Listen for commands
                await self._listen_loop()

            except redis.ConnectionError:
                logger.error("Redis connection lost, will retry in 10s")
                self.redis_connected = False
                self._stop_heartbeat()
                await asyncio.sleep(10)

            except Exception as e:
                logger.error(f"Agent error: {e}", exc_info=True)
                await asyncio.sleep(5)

        # Cleanup on shutdown
        logger.info("Agent shutting down...")
        self._stop_heartbeat()

        if self.redis_client:
            self.redis_client.close()

        logger.info("Agent stopped")


def main():
    """Main entry point"""
    agent = CockpitAgent()

    try:
        asyncio.run(agent.run())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
