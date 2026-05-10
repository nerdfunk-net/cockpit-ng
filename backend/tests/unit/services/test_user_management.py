"""Unit tests for services.auth.user_management module.

Module-level functions are tested by patching _user_service to return a
UserService backed by FakeUserRepository. All tests run offline — no database
required.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from models.user_management import UserRole
from services.auth import user_management as um
from services.auth.user_service import (
    UserService,
    PERMISSIONS_ADMIN,
    PERMISSIONS_USER,
    PERMISSIONS_VIEWER,
)
from tests.mocks.fake_auth_repositories import FakeUserRepository


# ---------------------------------------------------------------------------
# Patch target and helper
# ---------------------------------------------------------------------------

_PATCH_TARGET = "services.auth.user_management._user_service"


def _make_svc() -> UserService:
    """Return a fresh UserService backed by an in-memory repository."""
    svc = UserService.__new__(UserService)
    svc._repo = FakeUserRepository()
    return svc


# ===========================================================================
# create_user
# ===========================================================================


@pytest.mark.unit
class TestCreateUser:
    def test_result_includes_role_key(self) -> None:
        """create_user result always contains a string 'role' field."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.create_user("alice", "Alice Smith", "pw1234")

        assert "role" in result
        assert isinstance(result["role"], str)

    def test_default_role_sets_user_permissions(self) -> None:
        """Default role=UserRole.user assigns PERMISSIONS_USER."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.create_user("alice", "Alice", "pw1234")

        assert result["permissions"] == PERMISSIONS_USER

    def test_viewer_role_sets_viewer_permissions(self) -> None:
        """role=UserRole.viewer assigns PERMISSIONS_VIEWER."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.create_user("bob", "Bob", "pw1234", role=UserRole.viewer)

        assert result["permissions"] == PERMISSIONS_VIEWER

    def test_admin_role_sets_admin_permissions(self) -> None:
        """role=UserRole.admin assigns PERMISSIONS_ADMIN."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.create_user("charlie", "Charlie", "pw1234", role=UserRole.admin)

        assert result["permissions"] == PERMISSIONS_ADMIN

    def test_is_active_false_creates_inactive_user(self) -> None:
        """is_active=False creates a user with is_active=False."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.create_user("dana", "Dana", "pw1234", is_active=False)

        assert result["is_active"] is False

    def test_email_stored_in_result(self) -> None:
        """Provided email is present in the returned dict."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.create_user("evan", "Evan", "pw1234", email="evan@example.com")

        assert result["email"] == "evan@example.com"

    def test_duplicate_username_raises(self) -> None:
        """Creating a second user with the same username raises Exception."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            um.create_user("dupe", "First", "pw1234")
            with pytest.raises(Exception):
                um.create_user("dupe", "Second", "pw5678")


# ===========================================================================
# get_all_users
# ===========================================================================


@pytest.mark.unit
class TestGetAllUsers:
    def test_all_users_include_role_key(self) -> None:
        """Every user dict returned by get_all_users has a 'role' key."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            um.create_user("u1", "User One", "pw1234")
            um.create_user("u2", "User Two", "pw1234")
            results = um.get_all_users()

        assert len(results) == 2
        for user in results:
            assert "role" in user
            assert isinstance(user["role"], str)

    def test_include_inactive_false_excludes_inactive_users(self) -> None:
        """include_inactive=False omits soft-deleted users."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            um.create_user("active", "Active User", "pw1234", is_active=True)
            um.create_user("inactive", "Inactive User", "pw1234", is_active=False)
            results = um.get_all_users(include_inactive=False)

        usernames = {u["username"] for u in results}
        assert "active" in usernames
        assert "inactive" not in usernames

    def test_include_inactive_true_includes_all(self) -> None:
        """include_inactive=True returns both active and inactive users."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            um.create_user("active", "Active User", "pw1234", is_active=True)
            um.create_user("inactive", "Inactive User", "pw1234", is_active=False)
            results = um.get_all_users(include_inactive=True)

        assert len(results) == 2

    def test_empty_store_returns_empty_list(self) -> None:
        """get_all_users on an empty store returns an empty list."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            results = um.get_all_users()

        assert results == []


# ===========================================================================
# get_user_by_id
# ===========================================================================


@pytest.mark.unit
class TestGetUserById:
    def test_found_user_includes_role(self) -> None:
        """get_user_by_id returns a dict with 'role' for an existing user."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("alice", "Alice", "pw1234")
            result = um.get_user_by_id(created["id"])

        assert result is not None
        assert result["username"] == "alice"
        assert "role" in result

    def test_unknown_id_returns_none(self) -> None:
        """get_user_by_id returns None for a nonexistent ID."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.get_user_by_id(9999)

        assert result is None

    def test_inactive_user_excluded_by_default(self) -> None:
        """Inactive users are not returned when include_inactive is False."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("ghost", "Ghost", "pw1234", is_active=False)
            result = um.get_user_by_id(created["id"], include_inactive=False)

        assert result is None

    def test_inactive_user_returned_when_include_inactive_true(self) -> None:
        """Inactive users are returned when include_inactive=True."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("ghost", "Ghost", "pw1234", is_active=False)
            result = um.get_user_by_id(created["id"], include_inactive=True)

        assert result is not None
        assert result["is_active"] is False


# ===========================================================================
# get_user_by_username
# ===========================================================================


@pytest.mark.unit
class TestGetUserByUsername:
    def test_found_user_includes_role(self) -> None:
        """get_user_by_username returns dict with 'role' for an existing username."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            um.create_user("alice", "Alice", "pw1234")
            result = um.get_user_by_username("alice")

        assert result is not None
        assert result["username"] == "alice"
        assert "role" in result

    def test_unknown_username_returns_none(self) -> None:
        """get_user_by_username returns None for a username that does not exist."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.get_user_by_username("nobody")

        assert result is None


# ===========================================================================
# authenticate_user
# ===========================================================================


@pytest.mark.unit
class TestAuthenticateUser:
    def test_correct_credentials_return_user_with_role(self) -> None:
        """Correct username and password return user dict including 'role'."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            um.create_user("alice", "Alice", "correct-pw")
            result = um.authenticate_user("alice", "correct-pw")

        assert result is not None
        assert result["username"] == "alice"
        assert "role" in result

    def test_wrong_password_returns_none(self) -> None:
        """Wrong password returns None instead of a user dict."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            um.create_user("alice", "Alice", "correct-pw")
            result = um.authenticate_user("alice", "wrong-pw")

        assert result is None

    def test_nonexistent_user_returns_none(self) -> None:
        """Authentication against a username that does not exist returns None."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.authenticate_user("nobody", "pw")

        assert result is None


# ===========================================================================
# update_user
# ===========================================================================


@pytest.mark.unit
class TestUpdateUser:
    def test_update_realname_adds_role(self) -> None:
        """Updating realname returns a dict that still includes 'role'."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("alice", "Alice Old", "pw1234")
            result = um.update_user(created["id"], realname="Alice New")

        assert result is not None
        assert result["realname"] == "Alice New"
        assert "role" in result

    def test_update_role_converts_to_permissions(self) -> None:
        """Passing role=UserRole.admin updates permissions to PERMISSIONS_ADMIN."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("alice", "Alice", "pw1234", role=UserRole.viewer)
            result = um.update_user(created["id"], role=UserRole.admin)

        assert result is not None
        assert result["permissions"] == PERMISSIONS_ADMIN

    def test_update_nonexistent_user_returns_none(self) -> None:
        """Updating a nonexistent user_id returns None."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.update_user(9999, realname="Ghost")

        assert result is None


# ===========================================================================
# delete_user / hard_delete_user
# ===========================================================================


@pytest.mark.unit
class TestDeleteUser:
    def test_soft_delete_returns_true(self) -> None:
        """delete_user on an existing user returns True."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("alice", "Alice", "pw1234")
            result = um.delete_user(created["id"])

        assert result is True

    def test_soft_delete_nonexistent_returns_false(self) -> None:
        """delete_user on a nonexistent ID returns False."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.delete_user(9999)

        assert result is False

    def test_hard_delete_removes_user(self) -> None:
        """hard_delete_user returns True and permanently removes the user."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("alice", "Alice", "pw1234")
            result = um.hard_delete_user(created["id"])
            after = um.get_user_by_id(created["id"], include_inactive=True)

        assert result is True
        assert after is None

    def test_hard_delete_nonexistent_returns_false(self) -> None:
        """hard_delete_user on a nonexistent ID returns False."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.hard_delete_user(9999)

        assert result is False


# ===========================================================================
# bulk operations
# ===========================================================================


@pytest.mark.unit
class TestBulkOperations:
    def test_bulk_delete_returns_success_count(self) -> None:
        """bulk_delete_users returns (count, []) for a valid list of IDs."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            u1 = um.create_user("u1", "User 1", "pw1234")
            u2 = um.create_user("u2", "User 2", "pw1234")
            count, errors = um.bulk_delete_users([u1["id"], u2["id"]])

        assert count == 2
        assert errors == []

    def test_bulk_hard_delete_returns_success_count(self) -> None:
        """bulk_hard_delete_users returns (count, []) for a valid list of IDs."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            u1 = um.create_user("u1", "User 1", "pw1234")
            u2 = um.create_user("u2", "User 2", "pw1234")
            count, errors = um.bulk_hard_delete_users([u1["id"], u2["id"]])

        assert count == 2
        assert errors == []

    def test_bulk_update_permissions_returns_success_count(self) -> None:
        """bulk_update_permissions returns (count, []) for valid IDs."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            u1 = um.create_user("u1", "User 1", "pw1234")
            u2 = um.create_user("u2", "User 2", "pw1234")
            count, errors = um.bulk_update_permissions(
                [u1["id"], u2["id"]], PERMISSIONS_ADMIN
            )

        assert count == 2
        assert errors == []


# ===========================================================================
# toggle_user_status
# ===========================================================================


@pytest.mark.unit
class TestToggleUserStatus:
    def test_active_user_becomes_inactive(self) -> None:
        """toggle_user_status flips an active user to inactive."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("alice", "Alice", "pw1234", is_active=True)
            result = um.toggle_user_status(created["id"])

        assert result is not None
        assert result["is_active"] is False

    def test_inactive_user_becomes_active(self) -> None:
        """toggle_user_status flips an inactive user to active."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            created = um.create_user("ghost", "Ghost", "pw1234", is_active=False)
            result = um.toggle_user_status(created["id"])

        assert result is not None
        assert result["is_active"] is True

    def test_nonexistent_user_returns_none(self) -> None:
        """toggle_user_status returns None when the user ID does not exist."""
        svc = _make_svc()
        with patch(_PATCH_TARGET, return_value=svc):
            result = um.toggle_user_status(9999)

        assert result is None
