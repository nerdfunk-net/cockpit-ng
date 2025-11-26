# PostgreSQL Migration - Code Refactoring Strategy

## Current Status

✅ **Completed**:
- PostgreSQL configuration added
- SQLAlchemy models created for all tables
- Data successfully migrated from SQLite to PostgreSQL
- 1 user, 4 roles, 49 permissions, 2 credentials, and all settings migrated

## Files Requiring Refactoring

### 1. user_db_manager.py (~527 lines)
**Current**: Direct sqlite3 queries
**Target**: Use `core.models.User` with SQLAlchemy
**Key Functions**:
- `get_connection()` → `get_db_session()`
- `create_user()` → `db.add(User(...))`
- `get_user_by_username()` → `db.query(User).filter_by(username=...)`
- `list_users()` → `db.query(User).all()`
- `update_user()` → Update model attributes, `db.commit()`
- `delete_user()` → `db.delete(user)`

### 2. rbac_manager.py (~835 lines)
**Current**: Direct sqlite3 queries
**Target**: Use `core.models.{Role, Permission, RolePermission, UserRole}`
**Key Functions**:
- Role CRUD operations
- Permission CRUD operations
- Role-Permission assignments
- User-Role assignments
- Permission checking logic

### 3. settings_manager.py (~1286 lines)
**Current**: Multiple SQLite tables for different settings
**Target**: Use `core.models.Setting` with category-key pattern
**Key Functions**:
- `get_setting(category, key)`
- `set_setting(category, key, value)`
- Multiple specialized getters (nautobot_settings, git_settings, etc.)

### 4. credentials_manager.py
**Current**: SQLite with encryption
**Target**: Use `core.models.Credential` (maintain encryption)
**Key Functions**:
- `add_credential()` → `db.add(Credential(...))`
- `get_credentials()` → `db.query(Credential).all()`
- `delete_credential()` → `db.delete(credential)`

### 5. template_manager.py (~857 lines)
**Current**: SQLite storage
**Target**: Use `core.models.Template`
**Key Functions**:
- `create_template()`
- `get_template()`
- `list_templates()`
- `update_template()`
- `delete_template()`

### 6. git_repositories_manager.py
**Current**: SQLite storage
**Target**: Use `core.models.GitRepository`
**Note**: Database file not found during migration, may need initialization

### 7. jobs_manager.py
**Current**: SQLite storage
**Target**: Use `core.models.Job`
**Note**: Database file not found during migration, may need initialization

### 8. profile_manager.py
**Current**: Uses settings_manager internally
**Target**: May not need changes if settings_manager is properly refactored

### 9. compliance_manager.py
**Current**: SQLite storage
**Target**: Use `core.models.{ComplianceRule, ComplianceCheck}`
**Key Functions**:
- Rule management
- Compliance checking
- Report generation

### 10. services/nb2cmk_database_service.py
**Current**: SQLite storage
**Target**: Use `core.models.NB2CMKSync`
**Key Functions**:
- Sync state tracking
- Device mapping storage

### 11. services/apscheduler_job_service.py
**Current**: SQLite for APScheduler job store
**Target**: PostgreSQL URL for APScheduler
**Key Change**: Update jobstore configuration to use PostgreSQL URL

## Recommended Approach

### Phase 1: Create Repository Pattern (RECOMMENDED)

Create a clean separation between database access and business logic:

```
backend/repositories/
├── __init__.py
├── base.py              # Base repository with common CRUD
├── user_repository.py   # User operations
├── rbac_repository.py   # RBAC operations
├── settings_repository.py
├── credentials_repository.py
├── template_repository.py
├── git_repository_ops.py
├── job_repository.py
├── compliance_repository.py
└── nb2cmk_repository.py
```

**Benefits**:
- Clean separation of concerns
- Easy to test (mock repositories)
- Gradual migration possible
- Consistent patterns across codebase

**Example base.py**:
```python
from typing import Generic, TypeVar, Type, List, Optional
from sqlalchemy.orm import Session
from core.database import get_db_session

T = TypeVar('T')

class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T]):
        self.model = model
    
    def get_by_id(self, id: int) -> Optional[T]:
        db = get_db_session()
        try:
            return db.query(self.model).filter(self.model.id == id).first()
        finally:
            db.close()
    
    def get_all(self) -> List[T]:
        db = get_db_session()
        try:
            return db.query(self.model).all()
        finally:
            db.close()
    
    def create(self, **kwargs) -> T:
        db = get_db_session()
        try:
            obj = self.model(**kwargs)
            db.add(obj)
            db.commit()
            db.refresh(obj)
            return obj
        finally:
            db.close()
    
    def update(self, id: int, **kwargs) -> Optional[T]:
        db = get_db_session()
        try:
            obj = db.query(self.model).filter(self.model.id == id).first()
            if obj:
                for key, value in kwargs.items():
                    setattr(obj, key, value)
                db.commit()
                db.refresh(obj)
            return obj
        finally:
            db.close()
    
    def delete(self, id: int) -> bool:
        db = get_db_session()
        try:
            obj = db.query(self.model).filter(self.model.id == id).first()
            if obj:
                db.delete(obj)
                db.commit()
                return True
            return False
        finally:
            db.close()
```

**Example user_repository.py**:
```python
from typing import Optional
from repositories.base import BaseRepository
from core.models import User

class UserRepository(BaseRepository[User]):
    def __init__(self):
        super().__init__(User)
    
    def get_by_username(self, username: str) -> Optional[User]:
        db = get_db_session()
        try:
            return db.query(User).filter(User.username == username).first()
        finally:
            db.close()
    
    def get_by_email(self, email: str) -> Optional[User]:
        db = get_db_session()
        try:
            return db.query(User).filter(User.email == email).first()
        finally:
            db.close()
```

### Phase 2: Update Manager Files

Instead of completely rewriting managers, update them to use repositories:

**Before** (user_db_manager.py):
```python
import sqlite3

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    row = cursor.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None
```

**After**:
```python
from repositories.user_repository import UserRepository

user_repo = UserRepository()

def get_user(username):
    user = user_repo.get_by_username(username)
    if user:
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            # ... other fields
        }
    return None
```

### Phase 3: Gradual Migration Strategy

1. **Start with smallest file** (credentials_manager or profile_manager)
2. **Create repository for that module**
3. **Update manager to use repository**
4. **Test thoroughly**
5. **Move to next file**

### Phase 4: Special Cases

#### APScheduler Job Service

**Current**:
```python
jobstores = {
    'default': SQLAlchemyJobStore(url='sqlite:///jobs.db')
}
```

**After**:
```python
from config import settings

jobstores = {
    'default': SQLAlchemyJobStore(url=settings.database_url)
}
```

#### Settings Manager (Complex)

Settings manager is the most complex file (1286 lines) with many specialized methods.

**Strategy**:
1. Create settings_repository with category/key pattern
2. Keep high-level methods in settings_manager
3. Replace SQL queries with repository calls
4. Maintain backward compatibility

## Testing Strategy

### Unit Tests
Create tests for each repository:
```python
# tests/test_user_repository.py
def test_create_user():
    repo = UserRepository()
    user = repo.create(
        username="test",
        email="test@example.com",
        password="hashed",
        is_active=True
    )
    assert user.id is not None
    assert user.username == "test"
```

### Integration Tests
Test manager functions with PostgreSQL:
```python
def test_user_manager_get_user():
    from user_db_manager import get_user
    user = get_user("admin")
    assert user is not None
    assert user['username'] == 'admin'
```

## Migration Checklist

- [ ] Create repositories directory structure
- [ ] Implement BaseRepository
- [ ] Create UserRepository
- [ ] Update user_db_manager.py
- [ ] Test user management
- [ ] Create RBACRepository
- [ ] Update rbac_manager.py
- [ ] Test RBAC functionality
- [ ] Create SettingsRepository
- [ ] Update settings_manager.py (gradual approach)
- [ ] Test settings management
- [ ] Create CredentialsRepository
- [ ] Update credentials_manager.py
- [ ] Test credentials
- [ ] Create TemplateRepository
- [ ] Update template_manager.py
- [ ] Test templates
- [ ] Update other managers
- [ ] Update APScheduler configuration
- [ ] Remove all sqlite3 imports
- [ ] Full integration testing
- [ ] Performance testing
- [ ] Backup and deploy

## Rollback Plan

If issues occur:
1. SQLite databases are not deleted
2. Revert manager files to sqlite3 versions
3. Remove PostgreSQL from .env
4. Restart application

## Performance Considerations

1. **Connection Pooling**: Already configured in database.py
2. **Indexes**: Already added in models.py
3. **Batch Operations**: Use SQLAlchemy's bulk operations for large datasets
4. **Query Optimization**: Use eager loading for relationships

## Timeline Estimate

- Repository pattern setup: 2-4 hours
- Small managers (credentials, profile): 1-2 hours each
- Medium managers (user, template, git): 3-5 hours each
- Large managers (rbac, settings): 6-10 hours each
- Special cases (nb2cmk, compliance, apscheduler): 2-4 hours each
- Testing and debugging: 8-12 hours
- **Total**: 30-50 hours

## Priority Order

1. **user_db_manager.py** - Critical for authentication
2. **rbac_manager.py** - Critical for authorization
3. **settings_manager.py** - Widely used
4. **credentials_manager.py** - Security critical
5. **template_manager.py** - User-facing
6. **git_repositories_manager.py** - User-facing
7. **jobs_manager.py** - Background functionality
8. **compliance_manager.py** - Feature-specific
9. **nb2cmk_database_service.py** - Feature-specific
10. **apscheduler_job_service.py** - Background jobs
11. **profile_manager.py** - Depends on settings

## Next Immediate Steps

1. Start with creating the repository pattern structure
2. Implement UserRepository as proof of concept
3. Update a single function in user_db_manager as test
4. Verify it works end-to-end
5. Proceed with full migration of user_db_manager
6. Repeat for other managers

Would you like me to:
A) Create the repository pattern structure and start with UserRepository?
B) Directly refactor one of the smaller managers first?
C) Something else?
