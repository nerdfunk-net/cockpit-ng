"""Unit tests for services/compliance/compliance_service.py."""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.compliance.compliance_service import ComplianceService
from services.compliance.exceptions import ComplianceValidationError

_PATCH_REGEX = "services.compliance.compliance_service.RegexPatternRepository"
_PATCH_LOGIN = "services.compliance.compliance_service.LoginCredentialRepository"
_PATCH_SNMP = "services.compliance.compliance_service.SNMPMappingRepository"
_PATCH_ENCRYPT = "services.compliance.compliance_service.EncryptionService"


def _regex(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "pattern": "^version",
        "description": "desc",
        "pattern_type": "must_match",
        "is_active": True,
        "created_at": datetime(2024, 1, 1),
        "updated_at": datetime(2024, 1, 1),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _login(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 2,
        "name": "router",
        "username": "admin",
        "password_encrypted": b"enc:secret",
        "description": None,
        "is_active": True,
        "created_at": datetime(2024, 1, 1),
        "updated_at": datetime(2024, 1, 1),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _snmp(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 3,
        "name": "public-v2",
        "snmp_community": "public",
        "snmp_version": "v2c",
        "snmp_v3_user": None,
        "snmp_v3_auth_protocol": None,
        "snmp_v3_auth_password_encrypted": None,
        "snmp_v3_priv_protocol": None,
        "snmp_v3_priv_password_encrypted": None,
        "description": None,
        "is_active": True,
        "created_at": datetime(2024, 1, 1),
        "updated_at": datetime(2024, 1, 1),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _service(
    regex: MagicMock,
    login: MagicMock,
    snmp: MagicMock,
) -> ComplianceService:
    with patch(_PATCH_REGEX, return_value=regex):
        with patch(_PATCH_LOGIN, return_value=login):
            with patch(_PATCH_SNMP, return_value=snmp):
                with patch(_PATCH_ENCRYPT) as enc:
                    enc.return_value.encrypt.side_effect = lambda v: f"enc:{v}".encode()
                    enc.return_value.decrypt.side_effect = lambda v: v.decode().replace(
                        "enc:", ""
                    )
                    return ComplianceService()


@pytest.mark.unit
def test_create_regex_pattern_invalid_type_raises() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    with pytest.raises(ComplianceValidationError, match="pattern_type"):
        svc.create_regex_pattern("^x", "invalid")


@pytest.mark.unit
def test_create_regex_pattern_returns_id() -> None:
    mock_regex = MagicMock()
    mock_regex.create.return_value = _regex(id=10)
    svc = _service(mock_regex, MagicMock(), MagicMock())

    new_id = svc.create_regex_pattern("^ver", "must_match", description="d")

    assert new_id == 10
    mock_regex.create.assert_called_once()


@pytest.mark.unit
def test_update_regex_pattern_no_data_returns_false() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    assert svc.update_regex_pattern(1) is False


@pytest.mark.unit
def test_get_all_login_credentials_masks_password() -> None:
    mock_login = MagicMock()
    mock_login.get_all.return_value = [_login()]
    svc = _service(MagicMock(), mock_login, MagicMock())

    items = svc.get_all_login_credentials(decrypt_passwords=False)

    assert items[0]["password"] == "********"


@pytest.mark.unit
def test_create_login_credential_encrypts_password() -> None:
    mock_login = MagicMock()
    mock_login.create.return_value = _login(id=5)
    svc = _service(MagicMock(), mock_login, MagicMock())

    cred_id = svc.create_login_credential("lab", "root", "pw")

    assert cred_id == 5
    assert mock_login.create.call_args.kwargs["password_encrypted"] == b"enc:pw"


@pytest.mark.unit
def test_create_snmp_mapping_invalid_version_raises() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    with pytest.raises(ComplianceValidationError, match="snmp_version"):
        svc.create_snmp_mapping("x", "v4")


@pytest.mark.unit
def test_get_snmp_mapping_by_name_masks_passwords() -> None:
    mock_snmp = MagicMock()
    mock_snmp.get_by_name.return_value = _snmp(
        snmp_v3_auth_password_encrypted=b"enc:a",
        snmp_v3_priv_password_encrypted=b"enc:p",
    )
    svc = _service(MagicMock(), MagicMock(), mock_snmp)

    result = svc.get_snmp_mapping_by_name("public-v2")

    assert result is not None
    assert result["snmp_v3_auth_password"] == "********"


@pytest.mark.unit
def test_import_snmp_mappings_from_yaml_imports_new() -> None:
    mock_snmp = MagicMock()
    mock_snmp.get_by_name.return_value = None
    mock_snmp.create.return_value = _snmp()
    svc = _service(MagicMock(), MagicMock(), mock_snmp)

    yaml_content = """
public:
  version: v2c
  community: public
  description: test
"""
    result = svc.import_snmp_mappings_from_yaml(yaml_content)

    assert result["imported"] == 1
    assert result["skipped"] == 0


@pytest.mark.unit
def test_import_snmp_mappings_invalid_yaml_returns_error() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    result = svc.import_snmp_mappings_from_yaml("not: [valid: yaml")
    assert result["imported"] == 0
    assert result["errors"] == 1


@pytest.mark.unit
def test_get_regex_patterns_by_type_filters_active() -> None:
    mock_regex = MagicMock()
    mock_regex.get_by_type.return_value = [_regex(pattern_type="must_match")]
    svc = _service(mock_regex, MagicMock(), MagicMock())

    items = svc.get_regex_patterns_by_type("must_match")

    assert len(items) == 1
    mock_regex.get_by_type.assert_called_once_with("must_match", is_active=True)


@pytest.mark.unit
def test_get_login_credential_decrypts_password_when_requested() -> None:
    mock_login = MagicMock()
    mock_login.get_by_id.return_value = _login()
    svc = _service(MagicMock(), mock_login, MagicMock())

    item = svc.get_login_credential_by_id(2, decrypt_password=True)

    assert item is not None
    assert item["password"] == "secret"


@pytest.mark.unit
def test_import_snmp_mappings_skips_existing() -> None:
    mock_snmp = MagicMock()
    svc = _service(MagicMock(), MagicMock(), mock_snmp)

    with patch.object(svc, "get_snmp_mapping_by_name", return_value={"id": 1}):
        result = svc.import_snmp_mappings_from_yaml("existing:\n  version: v2c\n")

    assert result["imported"] == 0
    assert result["skipped"] == 1


@pytest.mark.unit
def test_update_login_credential_no_fields_returns_false() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    assert svc.update_login_credential(1) is False


@pytest.mark.unit
def test_update_login_credential_updates_fields() -> None:
    mock_login = MagicMock()
    mock_login.update.return_value = _login()
    svc = _service(MagicMock(), mock_login, MagicMock())

    assert svc.update_login_credential(2, name="new", password="pw") is True
    mock_login.update.assert_called_once()


@pytest.mark.unit
def test_delete_login_credential() -> None:
    mock_login = MagicMock()
    mock_login.delete.return_value = True
    svc = _service(MagicMock(), mock_login, MagicMock())
    assert svc.delete_login_credential(3) is True


@pytest.mark.unit
def test_get_all_snmp_mappings_masks_passwords() -> None:
    mock_snmp = MagicMock()
    mock_snmp.get_all.return_value = [
        _snmp(snmp_v3_auth_password_encrypted=b"enc:a"),
    ]
    svc = _service(MagicMock(), MagicMock(), mock_snmp)

    items = svc.get_all_snmp_mappings(decrypt_passwords=False)

    assert items[0]["snmp_v3_auth_password"] == "********"


@pytest.mark.unit
def test_update_snmp_mapping_invalid_version_raises() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    with pytest.raises(ComplianceValidationError, match="snmp_version"):
        svc.update_snmp_mapping(1, snmp_version="v9")


@pytest.mark.unit
def test_update_snmp_mapping_no_data_returns_false() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    assert svc.update_snmp_mapping(1) is False


@pytest.mark.unit
def test_delete_snmp_mapping() -> None:
    mock_snmp = MagicMock()
    mock_snmp.delete.return_value = True
    svc = _service(MagicMock(), MagicMock(), mock_snmp)
    assert svc.delete_snmp_mapping(5) is True


@pytest.mark.unit
def test_import_snmp_mappings_invalid_root_type() -> None:
    svc = _service(MagicMock(), MagicMock(), MagicMock())
    result = svc.import_snmp_mappings_from_yaml("- just a list")
    assert result["imported"] == 0
    assert "expected dictionary" in result["error_details"][0]


@pytest.mark.unit
def test_update_snmp_mapping_encrypts_passwords() -> None:
    mock_snmp = MagicMock()
    mock_snmp.update.return_value = _snmp()
    svc = _service(MagicMock(), MagicMock(), mock_snmp)

    assert (
        svc.update_snmp_mapping(
            1,
            snmp_v3_auth_password="auth",
            snmp_v3_priv_password="priv",
        )
        is True
    )
    kwargs = mock_snmp.update.call_args.kwargs
    assert kwargs["snmp_v3_auth_password_encrypted"] == b"enc:auth"
    assert kwargs["snmp_v3_priv_password_encrypted"] == b"enc:priv"


@pytest.mark.unit
def test_get_all_snmp_mappings_decrypts_when_requested() -> None:
    mock_snmp = MagicMock()
    mock_snmp.get_all.return_value = [
        _snmp(snmp_v3_auth_password_encrypted=b"enc:secret"),
    ]
    svc = _service(MagicMock(), MagicMock(), mock_snmp)

    items = svc.get_all_snmp_mappings(decrypt_passwords=True)

    assert items[0]["snmp_v3_auth_password"] == "secret"
