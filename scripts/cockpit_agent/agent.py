#!/usr/bin/env python3
"""
Cockpit Agent - Remote command executor for Cockpit
Listens for commands via Redis Pub/Sub and executes them locally
"""
import asyncio
import json
import logging
import signal
import sys
import time
from collections import deque
from typing import Optional

import redis

from config import config
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
        self.executor = CommandExecutor()
        self.heartbeat_thread: Optional[HeartbeatThread] = None
        self.command_buffer = deque(maxlen=100)
        self.running = True
        self.redis_connected = False

        # Register signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

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
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
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
        if not self.redis_client:
            return

        try:
            agent_key = config.get_agent_key()
            now = int(time.time())

            status_data = {
                "status": "online",
                "last_heartbeat": now,
                "version": config.agent_version,
                "hostname": config.agent_hostname,
                "capabilities": "git_pull,docker_restart,echo",
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
        if not self.redis_client:
            return

        try:
            self.heartbeat_thread = HeartbeatThread(self.redis_client)
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

    async def _execute_and_respond(self, command_data: dict):
        """Execute command and send response"""
        command_id = command_data.get("command_id")
        command = command_data.get("command")
        params = command_data.get("params", {})

        logger.info(f"Executing command: {command} (ID: {command_id})")

        # Execute command
        result = await self.executor.execute(command, params)

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
        logger.info(f"Agent hostname: {config.agent_hostname}")

        # Validate configuration
        valid, error = config.validate()
        if not valid:
            logger.error(f"Configuration error: {error}")
            sys.exit(1)

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
