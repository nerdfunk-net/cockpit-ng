"""
Pytest configuration and shared fixtures for backup tests.
"""

import pytest
from unittest.mock import Mock, MagicMock
from typing import Dict, Any
from git import Repo


@pytest.fixture
def mock_nautobot_service():
    """Mock NautobotService for testing."""
    service = Mock()
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
