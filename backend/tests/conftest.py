"""
Pytest configuration and shared fixtures for Cockpit-NG tests.

This module provides centralized test fixtures for:
- Mock services (Nautobot, CheckMK, Netmiko, Git)
- Sample test data
- Database fixtures
- Authentication fixtures
"""

import pytest
from unittest.mock import Mock, MagicMock, AsyncMock
from typing import Dict, Any
from git import Repo

# Import centralized fixtures
from tests.fixtures import (
    NAUTOBOT_DEVICE_STANDARD,
    NAUTOBOT_DEVICES_LIST,
    CHECKMK_HOST_STANDARD,
    CHECKMK_HOSTS_LIST,
    create_device_response,
    create_host_response,
)


# =============================================================================
# Pytest Markers
# =============================================================================


def pytest_configure(config):
    """Register custom pytest markers."""
    config.addinivalue_line(
        "markers", "unit: Unit tests (fast, no external dependencies)"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests (mocked externals)"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests (real systems, manual only)"
    )
    config.addinivalue_line("markers", "nautobot: Tests involving Nautobot integration")
    config.addinivalue_line("markers", "checkmk: Tests involving CheckMK integration")
    config.addinivalue_line("markers", "slow: Tests that take >5 seconds")


@pytest.fixture
def mock_nautobot_service():
    """
    Mock NautobotService for testing.

    Provides mock methods for GraphQL queries and REST API requests.
    Use AsyncMock for async methods.
    """
    service = MagicMock()
    # For async methods
    service.graphql_query = AsyncMock()
    service.rest_request = AsyncMock()
    # For sync methods (legacy)
    service.execute_graphql_query = Mock()
    service._sync_rest_request = Mock()
    return service


@pytest.fixture
def mock_netmiko_service():
    """Mock NetmikoService for testing."""
    service = Mock()
    service.connect_to_device = Mock()
    return service


@pytest.fixture
def mock_git_service():
    """Mock GitService for testing."""
    service = Mock()
    service.setup_repository = Mock()
    service.commit_and_push = Mock()
    return service


@pytest.fixture
def sample_device_data() -> Dict[str, Any]:
    """Sample device data from Nautobot GraphQL query."""
    return {
        "data": {
            "device": {
                "id": "device-uuid-123",
                "name": "switch01",
                "primary_ip4": {"address": "192.168.1.1/24"},
                "platform": {"name": "Cisco IOS"},
                "location": {"name": "DC1", "parent": {"name": "Region1"}},
                "device_role": {"name": "Access Switch"},
                "custom_fields": {},
            }
        }
    }


@pytest.fixture
def sample_credential() -> Dict[str, Any]:
    """Sample credential data."""
    return {
        "id": 1,
        "name": "default-creds",
        "username": "admin",
        "password": "password123",
        "enable_password": None,
    }


@pytest.fixture
def sample_repository() -> Dict[str, Any]:
    """Sample Git repository configuration."""
    return {
        "id": 1,
        "name": "test-backup-repo",
        "url": "https://github.com/test/repo.git",
        "branch": "main",
        "local_path": "/tmp/test-repo",
        "auth_type": "token",
        "token": "test-token",
    }


@pytest.fixture
def sample_netmiko_connection():
    """Mock Netmiko connection object."""
    conn = MagicMock()
    conn.send_command = Mock(
        return_value="hostname switch01\n!\ninterface GigabitEthernet0/1"
    )
    conn.disconnect = Mock()
    return conn


@pytest.fixture
def sample_git_repo(tmp_path):
    """Create a temporary Git repository for testing."""
    repo_path = tmp_path / "test-repo"
    repo_path.mkdir()
    repo = Repo.init(repo_path)

    # Create initial commit
    test_file = repo_path / "README.md"
    test_file.write_text("Test repository")
    repo.index.add(["README.md"])
    repo.index.commit("Initial commit")

    return repo


@pytest.fixture
def sample_device_backup_info():
    """Sample DeviceBackupInfo model."""
    from models.backup_models import DeviceBackupInfo

    return DeviceBackupInfo(
        device_id="device-uuid-123",
        device_name="switch01",
        device_ip="192.168.1.1",
        platform="cisco_ios",
        location_hierarchy=["Region1", "DC1"],
        device_role="Access Switch",
    )


@pytest.fixture
def sample_git_status():
    """Sample GitStatus model."""
    from models.backup_models import GitStatus

    return GitStatus(
        repository_name="test-backup-repo",
        initialized=True,
        branch="main",
        local_path="/tmp/test-repo",
    )


@pytest.fixture
def sample_backup_configs() -> Dict[str, str]:
    """Sample device configurations."""
    return {
        "running-config": """
hostname switch01
!
interface GigabitEthernet0/1
 description Uplink
 switchport mode trunk
!
interface GigabitEthernet0/2
 description Access Port
 switchport mode access
!
end
""",
        "startup-config": """
hostname switch01
!
interface GigabitEthernet0/1
 description Uplink
 switchport mode trunk
!
end
""",
    }


# =============================================================================
# Enhanced Mock Services
# =============================================================================


@pytest.fixture
def mock_checkmk_client():
    """
    Mock CheckMK API client for testing.

    Provides mock methods for all CheckMK operations.
    """
    client = MagicMock()
    client.get_all_hosts = Mock(return_value=CHECKMK_HOSTS_LIST.copy())
    client.get_host = Mock(return_value=CHECKMK_HOST_STANDARD.copy())
    client.add_host = Mock(return_value={"result": "success"})
    client.edit_host = Mock(return_value={"result": "success"})
    client.delete_host = Mock(return_value={"result": "success"})
    client.discover_services = Mock(return_value={"result": "success"})
    client.activate_changes = Mock(return_value={"result": "success"})
    client.get_folders = Mock(return_value=[])
    client.create_folder = Mock(return_value={"result": "success"})
    return client


@pytest.fixture
def mock_device_creation_service():
    """Mock DeviceCreationService for testing."""
    service = MagicMock()
    service.create_device_with_interfaces = AsyncMock()
    service.create_device = AsyncMock()
    service.create_interface = AsyncMock()
    service.assign_ip_to_interface = AsyncMock()
    return service


@pytest.fixture
def mock_nb2cmk_service():
    """Mock NautobotToCheckMKService for testing."""
    service = MagicMock()
    service.get_devices_for_sync = AsyncMock()
    service.compare_devices = AsyncMock()
    service.sync_devices = AsyncMock()
    service.sync_single_device = AsyncMock()
    return service


@pytest.fixture
def mock_ansible_inventory_service():
    """Mock InventoryService for testing."""
    service = MagicMock()
    service.generate_inventory = AsyncMock()
    service.save_inventory = AsyncMock()
    service.get_inventory = Mock()
    return service


# =============================================================================
# Database Fixtures
# =============================================================================


@pytest.fixture
def db_session():
    """
    Create in-memory SQLite session for testing.

    Use this for repository layer tests that need database operations.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from core.models import Base

    # Create in-memory SQLite database
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    engine.dispose()


# =============================================================================
# Authentication Fixtures
# =============================================================================


@pytest.fixture
def mock_user():
    """Mock authenticated user for testing."""
    return {
        "user_id": 1,
        "username": "testuser",
        "permissions": 15,  # All permissions bitmask
        "role": "admin",
    }


@pytest.fixture
def mock_auth_token():
    """Mock JWT authentication token."""
    return "mock-jwt-token-123456"


# =============================================================================
# FastAPI Test Client Fixture
# =============================================================================


@pytest.fixture
def api_client():
    """
    FastAPI TestClient for API integration tests.

    Use this to test API endpoints with mocked dependencies.
    """
    # Import will be done in actual test files to avoid circular imports
    # from main import app
    # return TestClient(app)
    pass


# =============================================================================
# Nautobot Data Fixtures
# =============================================================================


@pytest.fixture
def nautobot_device():
    """Standard Nautobot device data."""
    return NAUTOBOT_DEVICE_STANDARD.copy()


@pytest.fixture
def nautobot_devices_list():
    """List of Nautobot devices."""
    return NAUTOBOT_DEVICES_LIST.copy()


@pytest.fixture
def nautobot_device_factory():
    """
    Factory fixture for creating custom Nautobot device data.

    Usage:
        device = nautobot_device_factory(name="custom-switch", ip="10.0.0.5")
    """

    def _create_device(**kwargs):
        return create_device_response(**kwargs)

    return _create_device


# =============================================================================
# CheckMK Data Fixtures
# =============================================================================


@pytest.fixture
def checkmk_host():
    """Standard CheckMK host data."""
    return CHECKMK_HOST_STANDARD.copy()


@pytest.fixture
def checkmk_hosts_list():
    """List of CheckMK hosts."""
    return CHECKMK_HOSTS_LIST.copy()


@pytest.fixture
def checkmk_host_factory():
    """
    Factory fixture for creating custom CheckMK host data.

    Usage:
        host = checkmk_host_factory(hostname="custom-device", ip="10.0.0.5")
    """

    def _create_host(**kwargs):
        return create_host_response(**kwargs)

    return _create_host


# =============================================================================
# Real Integration Test Fixtures
# =============================================================================


@pytest.fixture(scope="session")
def test_nautobot_configured():
    """
    Check if test Nautobot instance is configured.

    Returns True if .env.test has valid Nautobot configuration.
    Use with pytest.mark.skipif to skip tests when Nautobot is not configured.
    """
    import os
    from dotenv import load_dotenv

    # Load test environment
    test_env_path = os.path.join(os.path.dirname(__file__), "..", ".env.test")
    if os.path.exists(test_env_path):
        load_dotenv(test_env_path, override=True)

    nautobot_url = os.getenv("NAUTOBOT_HOST")
    nautobot_token = os.getenv("NAUTOBOT_TOKEN")

    # Check if configuration is present and not placeholder
    is_configured = (
        nautobot_url
        and nautobot_token
        and nautobot_token != "your-test-nautobot-token-here"
    )

    return is_configured


@pytest.fixture(scope="module")
def real_nautobot_service(test_nautobot_configured):
    """
    Real NautobotService for integration tests.

    This fixture provides a REAL connection to a test Nautobot instance.
    Configuration is loaded from .env.test file.

    Usage:
        @pytest.mark.integration
        @pytest.mark.nautobot
        async def test_my_integration(real_nautobot_service):
            # Make real API calls to Nautobot
            result = await real_nautobot_service.graphql_query(query)

    Skipping:
        Tests using this fixture will be automatically skipped if .env.test
        is not configured with valid Nautobot credentials.
    """
    import os
    from dotenv import load_dotenv

    # Skip if not configured
    if not test_nautobot_configured:
        pytest.skip("Test Nautobot instance not configured. Set up .env.test file.")

    # Load test environment
    test_env_path = os.path.join(os.path.dirname(__file__), "..", ".env.test")
    load_dotenv(test_env_path, override=True)

    from services.nautobot import NautobotService

    service = NautobotService()

    # Override config to use test environment
    service.config = {
        "url": os.getenv("NAUTOBOT_HOST"),
        "token": os.getenv("NAUTOBOT_TOKEN"),
        "timeout": int(os.getenv("NAUTOBOT_TIMEOUT", "30")),
        "verify_ssl": True,
        "_source": "test_environment",
    }

    # Validate configuration
    assert service.config["url"], "NAUTOBOT_HOST must be set in .env.test"
    assert service.config["token"], "NAUTOBOT_TOKEN must be set in .env.test"
    assert service.config["token"] != "your-test-nautobot-token-here", (
        "Update NAUTOBOT_TOKEN in .env.test with real token"
    )

    return service


@pytest.fixture(scope="module")
def real_ansible_inventory_service(real_nautobot_service):
    """
    Real InventoryService configured with real Nautobot connection.

    This fixture provides the inventory service that will make
    real API calls to the test Nautobot instance.

    Usage:
        @pytest.mark.integration
        @pytest.mark.nautobot
        async def test_inventory_generation(real_ansible_inventory_service):
            devices, count = await real_ansible_inventory_service.preview_inventory(ops)
    """
    from services.inventory.inventory import InventoryService
    from unittest.mock import patch

    # Patch the global nautobot_service instance that inventory service imports
    # The inventory service does: from services.nautobot import nautobot_service
    with patch("services.nautobot.nautobot_service", real_nautobot_service):
        service = InventoryService()
        yield service
