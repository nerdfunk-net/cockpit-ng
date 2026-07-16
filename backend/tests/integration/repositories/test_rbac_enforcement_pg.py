"""PostgreSQL-backed integration tests for RBAC endpoint enforcement.

Scope: Verifies that FastAPI router endpoints correctly enforce
       ``require_permission()`` dependencies end-to-end, from HTTP request
       through the auth layer, RBACService, RBACRepository, and PostgreSQL.

Requires: TEST_DATABASE_URL pointing at a dedicated test PostgreSQL instance.
          Skipped automatically when TEST_DATABASE_URL is not set.

Probe endpoints: GET /api/settings/profiles and PUT /api/settings/profiles/{id}
  The write probe targets a non-existent profile id: ProfileUpdateRequest has
  all-optional fields, so the empty body always passes validation, and a miss
  (404) still lets the permission check be asserted independently of DB state.

Scenarios covered:
  * Missing Authorization header                → 401
  * Malformed / expired bearer token            → 401
  * Valid token, permission not assigned        → 403
  * Reader role can call read endpoint          → 200
  * Reader role cannot call write endpoint      → 403
  * Writer role can call write endpoint         → 200
  * Explicit user-level deny trumps role grant  → 403
  * Direct user-level grant (no role needed)    → 200
  * Permissions aggregate across multiple roles → 200 on both
  * Unrelated permission does not grant access  → 403
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from core.auth import create_access_token, get_password_hash
from core.database import Base
from core.models import Permission, Role, RolePermission, User, UserPermission, UserRole

# ---------------------------------------------------------------------------
# Probe URLs — profiles endpoints gated by settings.defaults; the write probe
# targets a non-existent id so status-code assertions are deterministic
# regardless of settings DB state (a permission pass 404s, not 200).
# ---------------------------------------------------------------------------

_READ_URL = "/api/settings/profiles"
_WRITE_URL = "/api/settings/profiles/999999999"
_WRITE_BODY: dict = {}  # ProfileUpdateRequest has all-optional fields

_RBAC_TABLES = [
    User.__table__,
    Role.__table__,
    Permission.__table__,
    RolePermission.__table__,
    UserRole.__table__,
    UserPermission.__table__,
]

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def rbac_engine(postgres_engine_integration):
    """Create all RBAC tables in the test DB (once per module)."""
    Base.metadata.create_all(postgres_engine_integration, tables=_RBAC_TABLES)
    return postgres_engine_integration


@pytest.fixture(autouse=True)
def _clean_rbac_tables(rbac_engine):
    """Wipe RBAC data before every test so state never leaks between cases.

    Also clears the ``rbac-perm`` permission cache: table IDs restart at 1
    each test (RESTART IDENTITY), and RBACService.has_permission() caches
    results keyed by user_id — without this, a cached result computed for
    user_id=1 in one test would leak into the next test that reuses id=1.
    """
    with rbac_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE user_permissions, user_roles, role_permissions, "
                "permissions, roles, users RESTART IDENTITY CASCADE"
            )
        )
    import service_factory

    service_factory.build_cache_service().clear_namespace("rbac-perm")
    yield


@pytest.fixture
def db(rbac_engine) -> Session:
    """SQLAlchemy session for seeding test data."""
    factory = sessionmaker(bind=rbac_engine, autocommit=False, autoflush=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def app_client(rbac_engine, monkeypatch) -> TestClient:
    """TestClient with RBAC repository sessions redirected to the test DB.

    Only rbac_repository and user_repository are patched — the two modules
    that ``require_permission`` relies on.  Other services (e.g. SettingsManager)
    may connect to the real DB or fail gracefully; the probe endpoints catch
    all such exceptions before surfacing a status code.
    """
    factory = sessionmaker(bind=rbac_engine, autocommit=False, autoflush=False)

    def _test_session() -> Session:
        return factory()

    monkeypatch.setattr(
        "repositories.auth.rbac_repository.get_db_session", _test_session
    )
    monkeypatch.setattr(
        "repositories.auth.user_repository.get_db_session", _test_session
    )

    from main import app  # deferred — avoids import-time DB connection in core.database

    # Replace dependency_overrides with a clean dict for the duration of this
    # test.  Other test modules (e.g. test_servers_router, test_checkmk_*) set
    # app.dependency_overrides[verify_token] without a try/finally guard, so a
    # leaked override would bypass HTTPBearer and change the expected status
    # codes.  monkeypatch restores the original dict on teardown.
    monkeypatch.setattr(app, "dependency_overrides", {})

    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------


def _seed_user(db: Session, username: str) -> User:
    user = User(
        username=username,
        realname=username,
        email=f"{username}@test.local",
        password=get_password_hash("x"),
        permissions=1,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _seed_role(db: Session, name: str) -> Role:
    role = Role(name=name)
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def _seed_permission(db: Session, resource: str, action: str) -> Permission:
    perm = Permission(resource=resource, action=action)
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return perm


def _grant_to_role(db: Session, role: Role, perm: Permission) -> None:
    db.add(RolePermission(role_id=role.id, permission_id=perm.id))
    db.commit()


def _assign_role(db: Session, user: User, role: Role) -> None:
    db.add(UserRole(user_id=user.id, role_id=role.id))
    db.commit()


def _override(db: Session, user: User, perm: Permission, *, granted: bool) -> None:
    db.add(UserPermission(user_id=user.id, permission_id=perm.id, granted=granted))
    db.commit()


def _bearer(user: User) -> dict:
    token = create_access_token(
        {"sub": user.username, "user_id": user.id, "permissions": user.permissions}
    )
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Token-level enforcement (401 before any permission check)
# ---------------------------------------------------------------------------


@pytest.mark.postgres
class TestTokenEnforcement:
    def test_missing_authorization_header_returns_401(self, app_client):
        resp = app_client.get(_READ_URL)
        assert resp.status_code == 401
        assert resp.headers.get("WWW-Authenticate") == "Bearer"

    def test_malformed_bearer_token_returns_401(self, app_client):
        resp = app_client.get(
            _READ_URL, headers={"Authorization": "Bearer not.a.valid.token"}
        )
        assert resp.status_code == 401

    def test_expired_token_returns_401(self, app_client, db):
        user = _seed_user(db, "expireduser")
        token = create_access_token(
            {"sub": user.username, "user_id": user.id, "permissions": 1},
            expires_delta=timedelta(seconds=-1),
        )
        resp = app_client.get(_READ_URL, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Permission-level enforcement (403 vs 200)
# ---------------------------------------------------------------------------


@pytest.mark.postgres
class TestPermissionEnforcement:
    def test_user_with_no_roles_is_denied(self, app_client, db):
        user = _seed_user(db, "noroles")
        _seed_permission(db, "settings.defaults", "read")  # exists but never assigned

        resp = app_client.get(_READ_URL, headers=_bearer(user))
        assert resp.status_code == 403

    def test_reader_role_allows_read_endpoint(self, app_client, db):
        user = _seed_user(db, "reader")
        role = _seed_role(db, "viewer")
        perm = _seed_permission(db, "settings.defaults", "read")
        _grant_to_role(db, role, perm)
        _assign_role(db, user, role)

        resp = app_client.get(_READ_URL, headers=_bearer(user))
        assert resp.status_code not in {401, 403}

    def test_reader_role_blocks_write_endpoint(self, app_client, db):
        user = _seed_user(db, "reader")
        role = _seed_role(db, "viewer")
        perm_read = _seed_permission(db, "settings.defaults", "read")
        _seed_permission(db, "settings.defaults", "write")  # exists but unassigned
        _grant_to_role(db, role, perm_read)
        _assign_role(db, user, role)

        resp = app_client.put(_WRITE_URL, json=_WRITE_BODY, headers=_bearer(user))
        assert resp.status_code == 403

    def test_writer_role_allows_write_endpoint(self, app_client, db):
        user = _seed_user(db, "writer")
        role = _seed_role(db, "editor")
        perm = _seed_permission(db, "settings.defaults", "write")
        _grant_to_role(db, role, perm)
        _assign_role(db, user, role)

        resp = app_client.put(_WRITE_URL, json=_WRITE_BODY, headers=_bearer(user))
        assert resp.status_code not in {401, 403}

    def test_explicit_deny_override_trumps_role_grant(self, app_client, db):
        user = _seed_user(db, "denied")
        role = _seed_role(db, "viewer")
        perm = _seed_permission(db, "settings.defaults", "read")
        _grant_to_role(db, role, perm)  # role grants read
        _assign_role(db, user, role)
        _override(db, user, perm, granted=False)  # user-level deny wins

        resp = app_client.get(_READ_URL, headers=_bearer(user))
        assert resp.status_code == 403

    def test_direct_user_grant_without_role_allows_access(self, app_client, db):
        user = _seed_user(db, "directgrant")
        perm = _seed_permission(db, "settings.defaults", "read")
        _override(db, user, perm, granted=True)  # no role assigned at all

        resp = app_client.get(_READ_URL, headers=_bearer(user))
        assert resp.status_code not in {401, 403}

    def test_permissions_aggregate_across_roles(self, app_client, db):
        user = _seed_user(db, "multirole")
        role_r = _seed_role(db, "reader")
        role_w = _seed_role(db, "writer")
        perm_r = _seed_permission(db, "settings.defaults", "read")
        perm_w = _seed_permission(db, "settings.defaults", "write")
        _grant_to_role(db, role_r, perm_r)
        _grant_to_role(db, role_w, perm_w)
        _assign_role(db, user, role_r)
        _assign_role(db, user, role_w)

        assert app_client.get(_READ_URL, headers=_bearer(user)).status_code not in {
            401,
            403,
        }
        assert app_client.put(
            _WRITE_URL, json=_WRITE_BODY, headers=_bearer(user)
        ).status_code not in {401, 403}

    def test_unrelated_permission_does_not_grant_access(self, app_client, db):
        user = _seed_user(db, "wrongresource")
        role = _seed_role(db, "client-reader")
        perm = _seed_permission(db, "network.clients", "read")  # different resource
        _grant_to_role(db, role, perm)
        _assign_role(db, user, role)

        resp = app_client.get(
            _READ_URL, headers=_bearer(user)
        )  # needs settings.defaults:read
        assert resp.status_code == 403
