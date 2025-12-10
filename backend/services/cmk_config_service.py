"""
Configuration management service for Nautobot to CheckMK integration.
Handles loading and caching of YAML configuration files.
"""

from __future__ import annotations
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import yaml

logger = logging.getLogger(__name__)


class ConfigService:
    """Service for managing configuration files that are used to compare devices in nautobot
    with devices in checkmk."""

    def __init__(self):
        self._checkmk_config: Optional[Dict[str, Any]] = None
        self._snmp_mapping: Optional[Dict[str, Any]] = None
        self._queries: Optional[Dict[str, Any]] = None
        self._config_dir = Path(__file__).parent.parent.parent / "config"

    def load_checkmk_config(self, force_reload: bool = False) -> Dict[str, Any]:
        """Load CheckMK configuration from YAML file.

        Args:
            force_reload: If True, forces reading from file even if cached

        Returns:
            Dictionary containing CheckMK configuration

        Raises:
            FileNotFoundError: If configuration file is not found
            yaml.YAMLError: If YAML parsing fails
        """
        if self._checkmk_config is None or force_reload:
            config_path = self._config_dir / "checkmk.yaml"

            try:
                with open(config_path, "r") as f:
                    self._checkmk_config = yaml.safe_load(f) or {}
                logger.info(f"Loaded CheckMK configuration from {config_path}")
            except FileNotFoundError:
                logger.error(f"CheckMK configuration file not found: {config_path}")
                raise
            except yaml.YAMLError as e:
                logger.error(f"Error parsing CheckMK configuration YAML: {e}")
                raise

        return self._checkmk_config

    def load_snmp_mapping(self, force_reload: bool = False) -> Dict[str, Any]:
        """Load SNMP mapping configuration from YAML file.

        Args:
            force_reload: If True, forces reading from file even if cached

        Returns:
            Dictionary containing SNMP mapping configuration

        Raises:
            FileNotFoundError: If configuration file is not found
            yaml.YAMLError: If YAML parsing fails
        """
        if self._snmp_mapping is None or force_reload:
            config_path = self._config_dir / "snmp_mapping.yaml"

            try:
                with open(config_path, "r") as f:
                    self._snmp_mapping = yaml.safe_load(f) or {}
                logger.info(f"Loaded SNMP mapping configuration from {config_path}")
            except FileNotFoundError:
                logger.error(
                    f"SNMP mapping configuration file not found: {config_path}"
                )
                raise
            except yaml.YAMLError as e:
                logger.error(f"Error parsing SNMP mapping configuration YAML: {e}")
                raise

        return self._snmp_mapping

    def load_queries(self, force_reload: bool = False) -> Dict[str, Any]:
        """Load GraphQL queries from checkmk_queries.yaml file.

        Args:
            force_reload: If True, forces reading from file even if cached

        Returns:
            Dictionary containing GraphQL queries

        Raises:
            FileNotFoundError: If configuration file is not found
            yaml.YAMLError: If YAML parsing fails
        """
        if self._queries is None or force_reload:
            config_path = self._config_dir / "checkmk_queries.yaml"

            try:
                with open(config_path, "r") as f:
                    self._queries = yaml.safe_load(f) or {}
                logger.info(f"Loaded queries configuration from {config_path}")
            except FileNotFoundError:
                logger.error(f"Queries configuration file not found: {config_path}")
                raise
            except yaml.YAMLError as e:
                logger.error(f"Error parsing queries configuration YAML: {e}")
                raise

        return self._queries

    def get_query(self, query_name: str) -> Optional[str]:
        """Get a specific GraphQL query by name.

        Args:
            query_name: Name of the query to retrieve

        Returns:
            Query string or None if not found
        """
        try:
            queries_config = self.load_queries()
            queries = queries_config.get("queries", {})
            query = queries.get(query_name)
            if query:
                # Strip extra whitespace and normalize the query
                return query.strip()
            logger.warning(f"Query '{query_name}' not found in queries configuration")
            return None
        except Exception as e:
            logger.error(f"Error getting query '{query_name}': {e}")
            return None

    def get_default_site(self) -> str:
        """Get the default CheckMK site from configuration.

        Returns:
            Default site name, defaults to 'cmk' if not configured
        """
        try:
            config = self.load_checkmk_config()
            site_config = config.get("monitored_site", {})
            return site_config.get("default", "cmk")
        except Exception as e:
            logger.error(f"Error getting default site: {e}")
            return "cmk"

    def get_comparison_keys(self) -> list[str]:
        """Get list of keys to compare between Nautobot and CheckMK.

        Returns:
            List of comparison keys, defaults to ['attributes', 'folder']
        """
        try:
            config = self.load_checkmk_config()
            return config.get("compare", ["attributes", "folder"])
        except Exception as e:
            logger.error(f"Error getting comparison keys: {e}")
            return ["attributes", "folder"]

    def get_ignore_attributes(self) -> list[str]:
        """Get list of attributes to ignore during comparison.

        Returns:
            List of attributes to ignore
        """
        try:
            config = self.load_checkmk_config()
            return config.get("ignore_attributes", [])
        except Exception as e:
            logger.error(f"Error getting ignore attributes: {e}")
            return []

    def reload_config(self) -> None:
        """Reload all cached configuration files."""
        self._checkmk_config = None
        self._snmp_mapping = None
        self._queries = None
        logger.info("Configuration cache cleared, will reload on next access")


# Global instance for dependency injection
config_service = ConfigService()
