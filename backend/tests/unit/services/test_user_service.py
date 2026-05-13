"""Unit tests for UserService using FakeUserRepository.

All tests run offline — no database required.
"""

import pytest

from core.auth import get_password_hash, verify_password
from services.auth.user_service import (
    PERMISSION_ADMIN,
    PERMISSION_DELETE,
    PERMISSION_READ,
    PERMISSION_USER_MANAGE,
    PERMISSION_WRITE,
    PERMISSIONS_ADMIN,
    PERMISSIONS_USER,
    PERMISSIONS_VIEWER,
    UserService,
)
from tests.mocks.fake_auth_repositories import FakeUserRepository

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def user_repo() -> FakeUserRepository:
    return FakeUserRepository()


@pytest.fixture
def svc(user_repo: FakeUserRepository) -> UserService:
    """UserService wired to an in-memory repository."""
    service = UserService.__new__(UserService)
    service._repo = user_repo
    return service


@pytest.fixture
def populated_svc(svc: UserService, user_repo: FakeUserRepository) -> UserService:
    """UserService pre-populated with two users (one active, one inactive)."""
    user_repo.create(
        username="alice",
        realname="Alice Smith",
        email="alice@example.com",
        password=get_password_hash("correct-password"),
        permissions=PERMISSIONS_USER,
        is_active=True,
    )
    user_repo.create(
        username="bob",
        realname="Bob Jones",
        email="bob@example.com",
        password=get_password_hash("password2"),
        permissions=PERMISSIONS_VIEWER,
        is_active=False,
    )
    return svc


# ===========================================================================
# create_user
# ===========================================================================


@pytest.mark.unit
class TestCreateUser:
    def test_creates_user_with_hashed_password(self, svc: UserService) -> None:
        result = svc.create_user(
            username="alice", realname="Alice Smith", password="secret123"
        )

        assert result["username"] == "alice"
        assert result["realname"] == "Alice Smith"
        assert "id" in result
        # Password must not be stored in plain text
        stored = svc._repo.get_by_username("alice")
        assert stored is not None
        assert stored.password != "secret123"
        assert verify_password("secret123", stored.password)

    def test_default_permissions_are_user_level(self, svc: UserService) -> None:
        result = svc.create_user(
            username="carol", realname="Carol", password="pass1234"
        )
        assert result["permissions"] == PERMISSIONS_USER

    def test_custom_permissions_stored(self, svc: UserService) -> None:
        result = svc.create_user(
            username="viewer",
            realname="View Only",
            password="pass1234",
            permissions=PERMISSIONS_VIEWER,
        )
        assert result["permissions"] == PERMISSIONS_VIEWER

    def test_duplicate_username_raises(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="alice",
            realname="Alice",
            email="",
            password="hash",
            permissions=PERMISSIONS_USER,
        )

        with pytest.raises(ValueError, match="already exists"):
            svc.create_user(
                username="alice", realname="Other Alice", password="pass1234"
            )

    def test_missing_required_fields_raises(self, svc: UserService) -> None:
        with pytest.raises(ValueError):
            svc.create_user(username="", realname="No Name", password="pass1234")

        with pytest.raises(ValueError):
            svc.create_user(username="dave", realname="", password="pass1234")

        with pytest.raises(ValueError):
            svc.create_user(username="eve", realname="Eve", password="")

    def test_email_stored_when_provided(self, svc: UserService) -> None:
        svc.create_user(
            username="frank",
            realname="Frank",
            password="pass1234",
            email="frank@example.com",
        )
        stored = svc._repo.get_by_username("frank")
        assert stored is not None
        assert stored.email == "frank@example.com"

    def test_user_active_by_default(self, svc: UserService) -> None:
        result = svc.create_user(
            username="grace", realname="Grace", password="pass1234"
        )
        assert result["is_active"] is True


# ===========================================================================
# get_all_users / get_active_users
# ===========================================================================


@pytest.mark.unit
class TestGetUsers:
    def test_get_all_returns_active_and_inactive(
        self, populated_svc: UserService
    ) -> None:
        users = populated_svc.get_all_users(include_inactive=True)
        assert len(users) == 2

    def test_get_all_excludes_inactive_when_requested(
        self, populated_svc: UserService
    ) -> None:
        users = populated_svc.get_all_users(include_inactive=False)
        assert len(users) == 1
        assert users[0]["username"] == "alice"

    def test_get_user_by_id_found(self, populated_svc: UserService) -> None:
        alice = populated_svc._repo.get_by_username("alice")
        assert alice is not None
        result = populated_svc.get_user_by_id(alice.id, include_inactive=False)
        assert result is not None
        assert result["username"] == "alice"

    def test_get_user_by_id_inactive_excluded_by_default(
        self, populated_svc: UserService
    ) -> None:
        bob = populated_svc._repo.get_by_username("bob")
        assert bob is not None
        result = populated_svc.get_user_by_id(bob.id)
        assert result is None

    def test_get_user_by_id_inactive_included_when_requested(
        self, populated_svc: UserService
    ) -> None:
        bob = populated_svc._repo.get_by_username("bob")
        assert bob is not None
        result = populated_svc.get_user_by_id(bob.id, include_inactive=True)
        assert result is not None

    def test_get_user_by_id_nonexistent_returns_none(self, svc: UserService) -> None:
        assert svc.get_user_by_id(999) is None

    def test_get_user_by_username_returns_active_user(
        self, populated_svc: UserService
    ) -> None:
        result = populated_svc.get_user_by_username("alice")
        assert result is not None
        assert result["username"] == "alice"

    def test_get_user_by_username_inactive_returns_none(
        self, populated_svc: UserService
    ) -> None:
        assert populated_svc.get_user_by_username("bob") is None

    def test_get_user_by_username_nonexistent_returns_none(
        self, svc: UserService
    ) -> None:
        assert svc.get_user_by_username("nobody") is None


# ===========================================================================
# authenticate_user
# ===========================================================================


@pytest.mark.unit
class TestAuthenticateUser:
    def test_correct_credentials_returns_user(self, populated_svc: UserService) -> None:
        result = populated_svc.authenticate_user("alice", "correct-password")
        assert result is not None
        assert result["username"] == "alice"

    def test_wrong_password_returns_none(self, populated_svc: UserService) -> None:
        assert populated_svc.authenticate_user("alice", "wrong-password") is None

    def test_nonexistent_user_returns_none(self, populated_svc: UserService) -> None:
        assert populated_svc.authenticate_user("nobody", "password") is None

    def test_inactive_user_cannot_authenticate(
        self, populated_svc: UserService
    ) -> None:
        assert populated_svc.authenticate_user("bob", "password2") is None


# ===========================================================================
# update_user
# ===========================================================================


@pytest.mark.unit
class TestUpdateUser:
    def test_update_realname(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="charlie",
            realname="Charlie",
            email="",
            password="hash",
            permissions=PERMISSIONS_USER,
        )
        charlie = user_repo.get_by_username("charlie")
        assert charlie is not None

        result = svc.update_user(charlie.id, realname="Charles")
        assert result is not None
        assert result["realname"] == "Charles"

    def test_update_password_hashes_new_value(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="diana",
            realname="Diana",
            email="",
            password=get_password_hash("old-password"),
            permissions=PERMISSIONS_USER,
        )
        diana = user_repo.get_by_username("diana")
        assert diana is not None

        svc.update_user(diana.id, password="new-password-long")
        stored = user_repo.get_by_id(diana.id)
        assert stored is not None
        assert verify_password("new-password-long", stored.password)

    def test_short_password_raises(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="edgar",
            realname="Edgar",
            email="",
            password="hash",
            permissions=PERMISSIONS_USER,
        )
        edgar = user_repo.get_by_username("edgar")
        assert edgar is not None

        with pytest.raises(ValueError, match="at least 8 characters"):
            svc.update_user(edgar.id, password="short")

    def test_update_nonexistent_user_returns_none(self, svc: UserService) -> None:
        assert svc.update_user(999, realname="Ghost") is None

    def test_no_changes_returns_current_user(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="faye",
            realname="Faye",
            email="faye@example.com",
            password="hash",
            permissions=PERMISSIONS_USER,
        )
        faye = user_repo.get_by_username("faye")
        assert faye is not None

        result = svc.update_user(faye.id)
        assert result is not None
        assert result["username"] == "faye"


# ===========================================================================
# delete_user / hard_delete_user
# ===========================================================================


@pytest.mark.unit
class TestDeleteUser:
    def test_soft_delete_sets_inactive(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="henry",
            realname="Henry",
            email="",
            password="hash",
            permissions=PERMISSIONS_USER,
        )
        henry = user_repo.get_by_username("henry")
        assert henry is not None

        result = svc.delete_user(henry.id)
        assert result is True
        assert user_repo.get_by_id(henry.id) is not None
        assert user_repo.get_by_id(henry.id).is_active is False  # type: ignore[union-attr]

    def test_hard_delete_removes_user(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="ivy",
            realname="Ivy",
            email="",
            password="hash",
            permissions=PERMISSIONS_USER,
        )
        ivy = user_repo.get_by_username("ivy")
        assert ivy is not None

        result = svc.hard_delete_user(ivy.id)
        assert result is True
        assert user_repo.get_by_id(ivy.id) is None

    def test_hard_delete_nonexistent_returns_false(self, svc: UserService) -> None:
        assert svc.hard_delete_user(999) is False


# ===========================================================================
# bulk operations
# ===========================================================================


@pytest.mark.unit
class TestBulkOperations:
    def _seed_users(self, user_repo: FakeUserRepository) -> list[int]:
        ids = []
        for i in range(3):
            u = user_repo.create(
                username=f"bulk-user-{i}",
                realname=f"Bulk {i}",
                email="",
                password="hash",
                permissions=PERMISSIONS_USER,
            )
            ids.append(u.id)
        return ids

    def test_bulk_delete_all_succeed(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        ids = self._seed_users(user_repo)
        count, errors = svc.bulk_delete_users(ids)
        assert count == 3
        assert errors == []

    def test_bulk_delete_partial_failure(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        ids = self._seed_users(user_repo)
        count, errors = svc.bulk_delete_users([ids[0], 99999])
        assert count == 1
        assert len(errors) == 1
        assert "99999" in errors[0]

    def test_bulk_hard_delete_succeeds(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        ids = self._seed_users(user_repo)
        count, errors = svc.bulk_hard_delete_users(ids)
        assert count == 3
        assert errors == []
        assert user_repo.count() == 0

    def test_bulk_update_permissions(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        ids = self._seed_users(user_repo)
        count, errors = svc.bulk_update_permissions(ids, PERMISSIONS_VIEWER)
        assert count == 3
        assert errors == []
        for uid in ids:
            assert user_repo.get_by_id(uid).permissions == PERMISSIONS_VIEWER  # type: ignore[union-attr]


# ===========================================================================
# Permission flag helpers (static methods)
# ===========================================================================


@pytest.mark.unit
class TestPermissionHelpers:
    def test_has_permission_flag_true(self) -> None:
        user = {"permissions": PERMISSIONS_ADMIN}
        assert UserService.has_permission_flag(user, PERMISSION_READ) is True
        assert UserService.has_permission_flag(user, PERMISSION_WRITE) is True
        assert UserService.has_permission_flag(user, PERMISSION_ADMIN) is True
        assert UserService.has_permission_flag(user, PERMISSION_DELETE) is True
        assert UserService.has_permission_flag(user, PERMISSION_USER_MANAGE) is True

    def test_has_permission_flag_viewer_only_read(self) -> None:
        user = {"permissions": PERMISSIONS_VIEWER}
        assert UserService.has_permission_flag(user, PERMISSION_READ) is True
        assert UserService.has_permission_flag(user, PERMISSION_WRITE) is False
        assert UserService.has_permission_flag(user, PERMISSION_ADMIN) is False

    def test_get_role_name_known_roles(self) -> None:
        assert UserService.get_role_name(PERMISSIONS_ADMIN) == "admin"
        assert UserService.get_role_name(PERMISSIONS_USER) == "user"
        assert UserService.get_role_name(PERMISSIONS_VIEWER) == "viewer"

    def test_get_role_name_unknown_returns_custom(self) -> None:
        assert UserService.get_role_name(0) == "custom"

    def test_get_permissions_for_role_roundtrip(self) -> None:
        for role in ("admin", "user", "viewer"):
            perms = UserService.get_permissions_for_role(role)
            assert UserService.get_role_name(perms) == role

    def test_get_permission_name_combined(self) -> None:
        name = UserService.get_permission_name(PERMISSION_READ | PERMISSION_WRITE)
        assert "Read" in name
        assert "Write" in name

    def test_get_permission_name_none(self) -> None:
        assert UserService.get_permission_name(0) == "None"


# ===========================================================================
# ensure_admin_user_permissions
# ===========================================================================


@pytest.mark.unit
class TestEnsureAdminPermissions:
    def test_corrects_admin_permissions_if_wrong(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="admin",
            realname="Admin",
            email="",
            password="hash",
            permissions=PERMISSIONS_VIEWER,  # wrong
        )

        svc.ensure_admin_user_permissions()
        admin = user_repo.get_by_username("admin")
        assert admin is not None
        assert admin.permissions == PERMISSIONS_ADMIN

    def test_leaves_correct_admin_permissions_unchanged(
        self, svc: UserService, user_repo: FakeUserRepository
    ) -> None:
        user_repo.create(
            username="admin",
            realname="Admin",
            email="",
            password="hash",
            permissions=PERMISSIONS_ADMIN,
        )

        svc.ensure_admin_user_permissions()
        admin = user_repo.get_by_username("admin")
        assert admin is not None
        assert admin.permissions == PERMISSIONS_ADMIN
