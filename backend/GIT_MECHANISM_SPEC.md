# Git Mechanism Specification

## Overview

The Cockpit-NG application uses a **multi-repository architecture** where all Git operations require explicit repository identification through `repo_id` parameters. This replaces the previous global repository selection mechanism.

## Architecture

### Repository Management
- Each Git repository is stored in the database with a unique `repo_id`
- Repositories are categorized (e.g., 'configs', 'onboarding', 'templates')
- Only active repositories (`is_active=True`) can be used for operations
- Repository metadata includes: name, URL, branch, category, credentials, etc.

### API Structure

#### Repository Selection
```
GET /api/git-repositories                   # List all repositories
GET /api/git-repositories?category=configs  # Filter by category
GET /api/git-repositories/{repo_id}         # Get specific repository
```

#### Git Operations (Repository-Aware)
All Git operations require `{repo_id}` in the URL path:

```
GET /api/git/{repo_id}/status              # Repository status
GET /api/git/{repo_id}/branches            # List branches
GET /api/git/{repo_id}/commits/{branch}    # List commits
GET /api/git/{repo_id}/files/{commit_hash} # List/get files
POST /api/git/{repo_id}/commit             # Create commit
POST /api/git/{repo_id}/branch             # Create/switch branch
```

#### File Operations (Repository-Aware)
File operations require `repo_id` as query parameter or in request body:

```
GET /api/file-compare/list?repo_id={repo_id}      # List files
POST /api/file-compare/compare                    # Compare files (repo_id in body)
GET /api/file-compare/config?repo_id={repo_id}    # Get file config
```

## Implementation Guide

### Backend Development

#### 1. Repository Access Function
Use the centralized repository access function:

```python
from routers.git import get_git_repo_by_id

def your_function(repo_id: int):
    repo = get_git_repo_by_id(repo_id)  # Returns GitPython Repo object
    # repo.working_dir contains the local repository path
```

#### 2. API Endpoint Pattern
All Git-related endpoints should follow this pattern:

```python
@router.get("/{repo_id}/your-endpoint")
async def your_endpoint(
    repo_id: int,
    current_user: str = Depends(verify_token)
):
    try:
        repo = get_git_repo_by_id(repo_id)
        # Your logic here
        return {"result": "success"}
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Operation failed: {str(e)}"
        )
```

#### 3. Error Handling
The `get_git_repo_by_id()` function handles:
- Repository not found (404)
- Repository inactive (400)
- Git repository access errors (500)

### Frontend Development

#### 1. Repository Selection Pattern
Components must implement repository selection:

```typescript
const [repositories, setRepositories] = useState<GitRepository[]>([])
const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null)

// Load repositories
useEffect(() => {
  const loadRepositories = async () => {
    const response = await apiCall<{repositories: GitRepository[]}>('git/repositories')
    setRepositories(response.repositories)
  }
  loadRepositories()
}, [])
```

#### 2. API Call Pattern
All Git operations must include repository ID:

```typescript
// Correct: Repository-aware API calls
const branches = await apiCall<Branch[]>(`git/${selectedRepo.id}/branches`)
const files = await apiCall<{files: FileItem[]}>(`files/list?repo_id=${selectedRepo.id}`)

// Incorrect: Global API calls (deprecated)
// const branches = await apiCall<Branch[]>('git/branches')  // ❌ Don't use
```

#### 3. Component Structure
Follow this pattern for Git-related components:

```typescript
export function YourGitComponent() {
  const [repositories, setRepositories] = useState<GitRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null)
  
  // 1. Load repositories first
  useEffect(() => {
    loadRepositories()
  }, [])
  
  // 2. Repository selection UI
  const renderRepositorySelector = () => (
    <Select value={selectedRepo?.id} onValueChange={handleRepoChange}>
      {repositories.map(repo => (
        <SelectItem key={repo.id} value={repo.id}>
          {repo.name}
        </SelectItem>
      ))}
    </Select>
  )
  
  // 3. Repository-aware operations
  const performGitOperation = async () => {
    if (!selectedRepo) return
    const result = await apiCall(`git/${selectedRepo.id}/your-operation`)
  }
}
```

## Migration Guide

### From Global to Repository-Aware

#### Old Pattern (Deprecated)
```python
# Backend - DON'T USE
from settings_manager import settings_manager

def old_function():
    repo = get_git_repo()  # ❌ Global repository
    
@router.get("/git/status")  # ❌ No repo_id
async def old_status():
    pass
```

```typescript
// Frontend - DON'T USE
const status = await apiCall('git/status')  // ❌ No repository context
```

#### New Pattern (Required)
```python
# Backend - USE THIS
@router.get("/{repo_id}/status")
async def new_status(repo_id: int):
    repo = get_git_repo_by_id(repo_id)  # ✅ Explicit repository
```

```typescript
// Frontend - USE THIS
const status = await apiCall(`git/${selectedRepo.id}/status`)  // ✅ Repository-aware
```

## Repository Categories

### Standard Categories
- **configs**: Configuration file repositories
- **onboarding**: Device onboarding templates
- **templates**: Jinja2 templates for configuration generation
- **backup**: Configuration backup storage

### Category-Specific Endpoints
Some endpoints filter by category:
```
GET /api/git-repositories?category=configs&active_only=true
```

## Best Practices

### Backend
1. Always validate `repo_id` exists and is active
2. Use `get_git_repo_by_id()` for repository access
3. Handle Git repository errors gracefully
4. Log repository-specific operations with `repo_id`

### Frontend
1. Always show repository selection UI
2. Disable Git operations when no repository is selected
3. Cache repository list to avoid repeated API calls
4. Show repository name in operation feedback

### Security
1. Repository access is controlled by user authentication
2. Repository credentials are encrypted in database
3. File operations are sandboxed to repository working directory
4. All API endpoints require valid authentication tokens

## Error Handling

### Common Error Scenarios
1. **Repository Not Found (404)**: Repository ID doesn't exist
2. **Repository Inactive (400)**: Repository exists but `is_active=False`
3. **Git Repository Error (500)**: Local repository is corrupted or inaccessible
4. **Authentication Error (401)**: Invalid or expired token

### Frontend Error Handling
```typescript
try {
  const result = await apiCall(`git/${selectedRepo.id}/operation`)
} catch (error) {
  if (error.status === 404) {
    // Repository not found - refresh repository list
  } else if (error.status === 400) {
    // Repository inactive - show activation option
  }
}
```

## Testing

### Backend Tests
Test repository-aware endpoints with multiple repositories:
```python
def test_git_operation_with_multiple_repos():
    repo1 = create_test_repo(name="test1")
    repo2 = create_test_repo(name="test2")
    
    # Test operation on repo1
    response1 = client.get(f"/api/git/{repo1.id}/status")
    assert response1.status_code == 200
    
    # Test operation on repo2
    response2 = client.get(f"/api/git/{repo2.id}/status")
    assert response2.status_code == 200
```

### Frontend Tests
Test repository selection and operations:
```typescript
it('should perform operations on selected repository', () => {
  // Select repository
  selectRepository(mockRepo1)
  
  // Verify API calls include repo_id
  expect(mockApiCall).toHaveBeenCalledWith(`git/${mockRepo1.id}/status`)
})
```

## Conclusion

The new Git mechanism provides:
- **Multi-repository support**: Work with multiple Git repositories simultaneously
- **Explicit context**: All operations clearly specify which repository to use
- **Better scalability**: No global state dependencies
- **Improved security**: Repository-specific access control
- **Enhanced UX**: Users can see and select repositories explicitly

All new development must follow the repository-aware patterns outlined in this specification.
