"""Unit tests for RBACService using FakeRBACRepository and FakeUserRepository.

All tests run offline — no database required.
"""

import pytest

from core.auth import get_password_hash
from services.auth.user_service import UserService, PERMISSIONS_USER
from services.auth.rbac_service import RBACService
from tests.mocks.fake_auth_repositories import FakeUserRepository, FakeRBACRepository


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user_repo() -> FakeUserRepository:
    return FakeUserRepository()


@pytest.fixture
def rbac_repo() -> FakeRBACRepository:
    return FakeRBACRepository()


@pytest.fixture
def user_svc(user_repo: FakeUserRepository) -> UserService:
    svc = UserService.__new__(UserService)
    svc._repo = user_repo
    return svc


@pytest.fixture
def rbac_svc(rbac_repo: FakeRBACRepository, user_svc: UserService) -> RBACService:
    svc = RBACService.__new__(RBACService)
    svc._rbac_repo = rbac_repo
    svc._user_service = user_svc
    return svc


@pytest.fixture
def alice_id(user_repo: FakeUserRepository) -> int:
    u = user_repo.create(
        username="alice",
        realname="Alice",
        email="alice@example.com",
        password=get_password_hash("password"),
        permissions=PERMISSIONS_USER,
    )
    return u.id


@pytest.fixture
def seeded(
    rbac_svc: RBACService,
    rbac_repo: FakeRBACRepository,
    alice_id: int,
) -> dict:
    """Returns a dict with pre-seeded role, permission, and alice's user_id."""
    role = rbac_svc.create_role("editor", description="Can edit resources")
    perm = rbac_svc.create_permission("devices", "write")
    return {"role": role, "perm": perm, "alice_id": alice_id}


# ===========================================================================
# Permission CRUD
# ===========================================================================


@pytest.mark.unit
class TestPermissionCRUD:
    def test_create_permission(self, rbac_svc: RBACService) -> None:
        perm = rbac_svc.create_permission("devices", "read", "Read devices")
        assert perm["resource"] == "devices"
        assert perm["action"] == "read"
        assert perm["id"] is not None

    def test_create_duplicate_permission_raises(self, rbac_svc: RBACService) -> None:
        rbac_svc.create_permission("devices", "read")
        with pytest.raises(ValueError, match="already exists"):
            rbac_svc.create_permission("devices", "read")

    def test_get_permission_found(self, rbac_svc: RBACService) -> None:
        rbac_svc.create_permission("devices", "delete")
        result = rbac_svc.get_permission("devices", "delete")
        assert result is not None
        assert result["action"] == "delete"

    def test_get_permission_not_found(self, rbac_svc: RBACService) -> None:
        assert rbac_svc.get_permission("devices", "nonexistent") is None

    def test_get_permission_by_id(self, rbac_svc: RBACService) -> None:
        created = rbac_svc.create_permission("users", "read")
        found = rbac_svc.get_permission_by_id(created["id"])
        assert found is not None
        assert found["resource"] == "users"

    def test_list_permissions_sorted(self, rbac_svc: RBACService) -> None:
        rbac_svc.create_permission("users", "write")
        rbac_svc.create_permission("devices", "read")
        rbac_svc.create_permission("devices", "write")

        perms = rbac_svc.list_permissions()
        resources = [(p["resource"], p["action"]) for p in perms]
        assert resources == sorted(resources)

    def test_delete_permission(self, rbac_svc: RBACService) -> None:
        perm = rbac_svc.create_permission("jobs", "run")
        rbac_svc.delete_permission(perm["id"])
        assert rbac_svc.get_permission("jobs", "run") is None


# ===========================================================================
# Role CRUD
# ===========================================================================


@pytest.mark.unit
class TestRoleCRUD:
    def test_create_role(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("viewer", description="Read-only")
        assert role["name"] == "viewer"
        assert role["id"] is not None

    def test_create_duplicate_role_raises(self, rbac_svc: RBACService) -> None:
        rbac_svc.create_role("viewer")
        with pytest.raises(ValueError, match="already exists"):
            rbac_svc.create_role("viewer")

    def test_get_role_by_id(self, rbac_svc: RBACService) -> None:
        created = rbac_svc.create_role("operator")
        found = rbac_svc.get_role(created["id"])
        assert found is not None
        assert found["name"] == "operator"

    def test_get_role_by_id_not_found(self, rbac_svc: RBACService) -> None:
        assert rbac_svc.get_role(999) is None

    def test_get_role_by_name(self, rbac_svc: RBACService) -> None:
        rbac_svc.create_role("superuser")
        result = rbac_svc.get_role_by_name("superuser")
        assert result is not None

    def test_get_role_by_name_not_found(self, rbac_svc: RBACService) -> None:
        assert rbac_svc.get_role_by_name("ghost") is None

    def test_list_roles_sorted(self, rbac_svc: RBACService) -> None:
        rbac_svc.create_role("zebra")
        rbac_svc.create_role("alpha")
        roles = rbac_svc.list_roles()
        names = [r["name"] for r in roles]
        assert names == sorted(names)

    def test_update_role_name(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("old-name")
        rbac_svc.update_role(role["id"], name="new-name")
        updated = rbac_svc.get_role(role["id"])
        assert updated is not None
        assert updated["name"] == "new-name"

    def test_update_nonexistent_role_raises(self, rbac_svc: RBACService) -> None:
        with pytest.raises(ValueError, match="not found"):
            rbac_svc.update_role(999, name="whatever")

    def test_delete_non_system_role(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("temporary")
        rbac_svc.delete_role(role["id"])
        assert rbac_svc.get_role(role["id"]) is None

    def test_delete_system_role_raises(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("system-role", is_system=True)
        with pytest.raises(ValueError, match="Cannot delete system role"):
            rbac_svc.delete_role(role["id"])

    def test_delete_nonexistent_role_raises(self, rbac_svc: RBACService) -> None:
        with pytest.raises(ValueError, match="not found"):
            rbac_svc.delete_role(999)


# ===========================================================================
# Role-Permission assignment
# ===========================================================================


@pytest.mark.unit
class TestRolePermissionAssignment:
    def test_assign_permission_to_role(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("editor")
        perm = rbac_svc.create_permission("devices", "write")

        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        perms = rbac_svc.get_role_permissions(role["id"])
        assert any(p["id"] == perm["id"] for p in perms)

    def test_remove_permission_from_role(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("editor")
        perm = rbac_svc.create_permission("devices", "write")
        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        rbac_svc.remove_permission_from_role(role["id"], perm["id"])
        assert rbac_svc.get_role_permissions(role["id"]) == []

    def test_get_role_permissions_empty_by_default(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("empty-role")
        assert rbac_svc.get_role_permissions(role["id"]) == []


# ===========================================================================
# User-Role assignment
# ===========================================================================


@pytest.mark.unit
class TestUserRoleAssignment:
    def test_assign_role_to_user(self, rbac_svc: RBACService, alice_id: int) -> None:
        role = rbac_svc.create_role("editor")
        rbac_svc.assign_role_to_user(alice_id, role["id"])
        roles = rbac_svc.get_user_roles(alice_id)
        assert any(r["id"] == role["id"] for r in roles)

    def test_remove_role_from_user(self, rbac_svc: RBACService, alice_id: int) -> None:
        role = rbac_svc.create_role("editor")
        rbac_svc.assign_role_to_user(alice_id, role["id"])
        rbac_svc.remove_role_from_user(alice_id, role["id"])
        assert rbac_svc.get_user_roles(alice_id) == []

    def test_get_user_roles_empty_initially(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        assert rbac_svc.get_user_roles(alice_id) == []

    def test_get_users_with_role(self, rbac_svc: RBACService, alice_id: int) -> None:
        role = rbac_svc.create_role("contributor")
        rbac_svc.assign_role_to_user(alice_id, role["id"])
        users = rbac_svc.get_users_with_role(role["id"])
        assert alice_id in users

    def test_multiple_roles_per_user(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        r1 = rbac_svc.create_role("reader")
        r2 = rbac_svc.create_role("writer")
        rbac_svc.assign_role_to_user(alice_id, r1["id"])
        rbac_svc.assign_role_to_user(alice_id, r2["id"])
        role_ids = {r["id"] for r in rbac_svc.get_user_roles(alice_id)}
        assert role_ids == {r1["id"], r2["id"]}


# ===========================================================================
# User-Permission overrides
# ===========================================================================


@pytest.mark.unit
class TestUserPermissionOverrides:
    def test_assign_permission_to_user(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        perm = rbac_svc.create_permission("settings", "read")
        rbac_svc.assign_permission_to_user(alice_id, perm["id"], granted=True)
        overrides = rbac_svc.get_user_permission_overrides(alice_id)
        assert any(o["id"] == perm["id"] and o["granted"] for o in overrides)

    def test_deny_permission_to_user(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        perm = rbac_svc.create_permission("settings", "write")
        rbac_svc.assign_permission_to_user(alice_id, perm["id"], granted=False)
        overrides = rbac_svc.get_user_permission_overrides(alice_id)
        assert any(o["id"] == perm["id"] and not o["granted"] for o in overrides)

    def test_remove_permission_from_user(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        perm = rbac_svc.create_permission("settings", "delete")
        rbac_svc.assign_permission_to_user(alice_id, perm["id"])
        rbac_svc.remove_permission_from_user(alice_id, perm["id"])
        assert rbac_svc.get_user_permission_overrides(alice_id) == []


# ===========================================================================
# has_permission — override precedence / role cascade
# ===========================================================================


@pytest.mark.unit
class TestHasPermission:
    def test_permission_granted_via_role(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("editor")
        perm = rbac_svc.create_permission("devices", "write")
        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        assert rbac_svc.has_permission(alice_id, "devices", "write") is True

    def test_permission_denied_no_role_no_override(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        rbac_svc.create_permission("devices", "delete")
        assert rbac_svc.has_permission(alice_id, "devices", "delete") is False

    def test_override_grant_takes_precedence_over_no_role(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        perm = rbac_svc.create_permission("jobs", "run")
        rbac_svc.assign_permission_to_user(alice_id, perm["id"], granted=True)

        assert rbac_svc.has_permission(alice_id, "jobs", "run") is True

    def test_override_deny_takes_precedence_over_role(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("operator")
        perm = rbac_svc.create_permission("jobs", "cancel")
        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])
        # Explicitly deny via user override
        rbac_svc.assign_permission_to_user(alice_id, perm["id"], granted=False)

        assert rbac_svc.has_permission(alice_id, "jobs", "cancel") is False

    def test_nonexistent_permission_returns_false(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        assert rbac_svc.has_permission(alice_id, "ghost", "read") is False

    def test_check_any_permission_one_matches(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("reader")
        perm = rbac_svc.create_permission("devices", "read")
        rbac_svc.create_permission("devices", "write")
        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        assert (
            rbac_svc.check_any_permission(alice_id, "devices", ["read", "write"])
            is True
        )

    def test_check_any_permission_none_match(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        rbac_svc.create_permission("devices", "read")
        rbac_svc.create_permission("devices", "write")
        assert (
            rbac_svc.check_any_permission(alice_id, "devices", ["read", "write"])
            is False
        )

    def test_check_all_permissions_all_granted(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("full-editor")
        p_read = rbac_svc.create_permission("devices", "read")
        p_write = rbac_svc.create_permission("devices", "write")
        rbac_svc.assign_permission_to_role(role["id"], p_read["id"])
        rbac_svc.assign_permission_to_role(role["id"], p_write["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        assert (
            rbac_svc.check_all_permissions(alice_id, "devices", ["read", "write"])
            is True
        )

    def test_check_all_permissions_one_missing(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("partial")
        p_read = rbac_svc.create_permission("devices", "read")
        rbac_svc.create_permission("devices", "write")
        rbac_svc.assign_permission_to_role(role["id"], p_read["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        assert (
            rbac_svc.check_all_permissions(alice_id, "devices", ["read", "write"])
            is False
        )


# ===========================================================================
# get_user_permissions — aggregation logic
# ===========================================================================


@pytest.mark.unit
class TestGetUserPermissions:
    def test_permissions_from_role_returned(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("reader")
        perm = rbac_svc.create_permission("inventory", "read")
        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        perms = rbac_svc.get_user_permissions(alice_id)
        assert any(
            p["resource"] == "inventory" and p["action"] == "read" for p in perms
        )
        assert any(p["source"] == "role" for p in perms)

    def test_override_permission_overwrites_role_source(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("editor")
        perm = rbac_svc.create_permission("inventory", "write")
        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])
        # User override for same perm
        rbac_svc.assign_permission_to_user(alice_id, perm["id"], granted=True)

        perms = rbac_svc.get_user_permissions(alice_id)
        matching = [p for p in perms if p["resource"] == "inventory"]
        assert len(matching) == 1
        assert matching[0]["source"] == "override"

    def test_result_sorted_by_resource_and_action(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("multi-perm")
        p1 = rbac_svc.create_permission("users", "read")
        p2 = rbac_svc.create_permission("devices", "write")
        rbac_svc.assign_permission_to_role(role["id"], p1["id"])
        rbac_svc.assign_permission_to_role(role["id"], p2["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        perms = rbac_svc.get_user_permissions(alice_id)
        keys = [(p["resource"], p["action"]) for p in perms]
        assert keys == sorted(keys)


# ===========================================================================
# Cross-entity: create_user_with_roles
# ===========================================================================


@pytest.mark.unit
class TestCreateUserWithRoles:
    def test_creates_user_and_assigns_roles(self, rbac_svc: RBACService) -> None:
        role = rbac_svc.create_role("contributor")
        user = rbac_svc.create_user_with_roles(
            username="newuser",
            realname="New User",
            password="secure1234",
            role_ids=[role["id"]],
        )
        assert user["username"] == "newuser"
        roles = rbac_svc.get_user_roles(user["id"])
        assert any(r["id"] == role["id"] for r in roles)

    def test_invalid_role_id_rolls_back_user(self, rbac_svc: RBACService) -> None:
        with pytest.raises(ValueError, match="not found"):
            rbac_svc.create_user_with_roles(
                username="rollback",
                realname="Rollback",
                password="secure1234",
                role_ids=[9999],
            )
        # User must not exist
        assert rbac_svc._user_service.get_user_by_username("rollback") is None

    def test_creates_user_without_roles(self, rbac_svc: RBACService) -> None:
        user = rbac_svc.create_user_with_roles(
            username="noroles",
            realname="No Roles",
            password="secure1234",
        )
        assert rbac_svc.get_user_roles(user["id"]) == []


# ===========================================================================
# get_user_with_rbac / list_users_with_rbac
# ===========================================================================


@pytest.mark.unit
class TestGetUserWithRBAC:
    def test_get_user_with_rbac_includes_roles_and_permissions(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("admin")
        perm = rbac_svc.create_permission("system", "manage")
        rbac_svc.assign_permission_to_role(role["id"], perm["id"])
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        result = rbac_svc.get_user_with_rbac(alice_id)
        assert result is not None
        assert "roles" in result
        assert "permissions" in result
        assert any(r["name"] == "admin" for r in result["roles"])

    def test_get_user_with_rbac_not_found_returns_none(
        self, rbac_svc: RBACService
    ) -> None:
        assert rbac_svc.get_user_with_rbac(9999) is None

    def test_list_users_with_rbac(self, rbac_svc: RBACService, alice_id: int) -> None:
        users = rbac_svc.list_users_with_rbac()
        assert len(users) == 1
        assert "roles" in users[0]
        assert "permissions" in users[0]


# ===========================================================================
# delete_user_with_rbac
# ===========================================================================


@pytest.mark.unit
class TestDeleteUserWithRBAC:
    def test_delete_removes_user_and_cleans_roles(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("editor")
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        result = rbac_svc.delete_user_with_rbac(alice_id)
        assert result is True
        assert rbac_svc.get_user_with_rbac(alice_id, include_inactive=True) is None
        # Role still exists; only the assignment should be gone
        assert rbac_svc.get_role(role["id"]) is not None

    def test_delete_nonexistent_user_returns_false(self, rbac_svc: RBACService) -> None:
        assert rbac_svc.delete_user_with_rbac(9999) is False

    def test_bulk_delete_users_with_rbac(
        self, rbac_svc: RBACService, alice_id: int
    ) -> None:
        role = rbac_svc.create_role("viewer")
        rbac_svc.assign_role_to_user(alice_id, role["id"])

        count, errors = rbac_svc.bulk_delete_users_with_rbac([alice_id])
        assert count == 1
        assert errors == []
