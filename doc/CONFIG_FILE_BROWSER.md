# Config File Browser Implementation Plan

## Overview
Complete rewrite of "Network / Configs / View" app to implement a Git-style file browser with directory tree, file listing, commit history, and diff comparison capabilities.

## User Requirements
- **Layout**: Tree view on left, file list on right
- **File Display**: All files in repository (no filtering)
- **Commit History**: Modal showing all commits for a file
- **Comparison**: Select any two commits to compare
- **Repository**: Single repository selector at top (existing behavior)
- **File List**: Show only files in selected directory (no subdirectories)

## Architecture Analysis

### Existing Backend Endpoints (Can Reuse)
1. ✅ `GET /api/git-repositories/` - List repositories
2. ✅ `GET /api/git/{repo_id}/files/{file_path:path}/complete-history` - Get all commits for file
3. ✅ `POST /api/git/{repo_id}/diff` - Compare two commits for a file (line-by-line diff)
4. ✅ `GET /api/git/{repo_id}/commits/{branch_name}` - Get commits for branch
5. ✅ `GET /api/git/{repo_id}/files/{commit_hash}/commit?file_path=...` - Get file content from commit

### Missing Backend Endpoints (Need to Create)
1. ❌ `GET /api/git/{repo_id}/tree` - Get directory tree structure
2. ❌ `GET /api/git/{repo_id}/directory/{path}` - Get files in directory with last commit info

## Implementation Plan

---

## Phase 1: Backend - New Directory Endpoints

### 1.1 Add Tree Endpoint
**File**: `/backend/routers/settings/git/files.py`

**Endpoint**: `GET /api/git/{repo_id}/tree?path={path}`

**Purpose**: Return hierarchical directory structure

**Response Structure**:
```python
{
  "name": "root" | "dirname",
  "path": "" | "path/to/dir",
  "type": "directory",
  "children": [
    {
      "name": "subdir",
      "path": "path/to/subdir",
      "type": "directory",
      "file_count": 5  # Number of files in directory (not recursive)
    },
    # ... more directories
  ],
  "repository_name": "config-repo"
}
```

**Implementation Details**:
- Walk repository directory using `os.walk()`
- Build hierarchical structure (nested directories)
- Exclude `.git` directory
- Optional `path` parameter to get subtree (default: root)
- Count files per directory (non-recursive)
- Sort: directories first (alphabetically), then by name

**Authentication**: `require_permission("git.repositories", "read")`

---

### 1.2 Add Directory Files Endpoint
**File**: `/backend/routers/settings/git/files.py`

**Endpoint**: `GET /api/git/{repo_id}/directory?path={path}`

**Purpose**: List files in specific directory with last commit metadata

**Response Structure**:
```python
{
  "path": "path/to/directory",
  "files": [
    {
      "name": "config.txt",
      "path": "path/to/directory/config.txt",
      "size": 1024,
      "last_commit": {
        "hash": "abc123de",
        "short_hash": "abc123de",
        "message": "Update config",
        "author": {"name": "John Doe", "email": "john@example.com"},
        "date": "2024-01-15T10:30:00Z",
        "timestamp": 1705315800
      }
    }
  ],
  "directory_exists": true
}
```

**Implementation Details**:
- Get repository via `get_git_repo_by_id(repo_id)`
- Resolve full path: `os.path.join(repo_path, path or '')`
- List files in directory (exclude subdirectories, exclude dotfiles)
- For each file:
  - Get file stats (name, size)
  - Use GitPython `repo.iter_commits(paths=file_path, max_count=1)` to get last commit
  - Extract commit metadata
- Handle cases: empty directory, non-existent directory, file instead of directory
- Sort files alphabetically

**Authentication**: `require_permission("git.repositories", "read")`

---

## Phase 2: Frontend - Component Structure

### 2.1 Directory Structure
```
/frontend/src/components/features/network/configs/view/
├── configs-view-page.tsx          # Main page (complete rewrite)
├── components/
│   ├── file-tree.tsx              # Left panel: recursive directory tree
│   ├── file-list.tsx              # Right panel: file list with commit info
│   ├── file-tree-node.tsx         # Individual tree node (directory/file)
│   └── resizable-panels.tsx       # Resizable split layout
├── dialogs/
│   ├── file-history-dialog.tsx    # Modal: show all commits for file
│   └── file-diff-dialog.tsx       # Modal: side-by-side diff view
├── hooks/
│   ├── use-git-tree-query.ts      # TanStack Query: fetch tree
│   ├── use-directory-files-query.ts # TanStack Query: fetch directory files
│   └── use-file-diff-query.ts     # TanStack Query: fetch diff
└── types.ts                        # TypeScript interfaces
```

---

### 2.2 TypeScript Types
**File**: `/frontend/src/components/features/network/configs/view/types.ts`

```typescript
export interface GitTreeNode {
  name: string
  path: string
  type: 'directory'
  file_count?: number
  children?: GitTreeNode[]
}

export interface FileWithCommit {
  name: string
  path: string
  size: number
  last_commit: {
    hash: string
    short_hash: string
    message: string
    author: { name: string; email: string }
    date: string
    timestamp: number
  }
}

export interface DirectoryFilesResponse {
  path: string
  files: FileWithCommit[]
  directory_exists: boolean
}

export interface GitCommitInfo {
  hash: string
  short_hash: string
  message: string
  author: { name: string; email: string }
  date: string
  change_type: 'A' | 'M' | 'D' | 'N'
}

export interface FileHistoryResponse {
  file_path: string
  from_commit: string
  total_commits: number
  commits: GitCommitInfo[]
}

export interface FileDiffResponse {
  commit1: string
  commit2: string
  file_path: string
  left_file: string
  right_file: string
  left_lines: Array<{
    line_number: number
    content: string
    type: 'equal' | 'delete' | 'replace'
  }>
  right_lines: Array<{
    line_number: number
    content: string
    type: 'equal' | 'insert' | 'replace'
  }>
  stats: {
    additions: number
    deletions: number
    changes: number
  }
}
```

---

### 2.3 TanStack Query Hooks

#### 2.3.1 Git Tree Query
**File**: `/frontend/src/hooks/queries/use-git-tree-query.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { GitTreeNode } from '@/components/features/network/configs/view/types'

const DEFAULT_OPTIONS = { enabled: true }

export function useGitTreeQuery(
  repoId: number | null,
  options = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.tree(repoId),
    queryFn: async () => {
      if (!repoId) throw new Error('Repository ID required')
      return apiCall<GitTreeNode>(`git/${repoId}/tree`)
    },
    enabled: enabled && !!repoId,
    staleTime: 5 * 60 * 1000, // 5 minutes (tree structure changes rarely)
  })
}
```

#### 2.3.2 Directory Files Query
**File**: `/frontend/src/hooks/queries/use-directory-files-query.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { DirectoryFilesResponse } from '@/components/features/network/configs/view/types'

const DEFAULT_OPTIONS = { path: '', enabled: true }

export function useDirectoryFilesQuery(
  repoId: number | null,
  options = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { path, enabled } = options

  return useQuery({
    queryKey: queryKeys.git.directoryFiles(repoId, path),
    queryFn: async () => {
      if (!repoId) throw new Error('Repository ID required')
      const url = path
        ? `git/${repoId}/directory?path=${encodeURIComponent(path)}`
        : `git/${repoId}/directory`
      return apiCall<DirectoryFilesResponse>(url)
    },
    enabled: enabled && !!repoId,
    staleTime: 30 * 1000, // 30 seconds (files may change frequently)
  })
}
```

#### 2.3.3 File Diff Query
**File**: `/frontend/src/hooks/queries/use-file-diff-query.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import type { FileDiffResponse } from '@/components/features/network/configs/view/types'

const DEFAULT_OPTIONS = { enabled: false }

export function useFileDiffQuery(
  repoId: number | null,
  commit1: string | null,
  commit2: string | null,
  filePath: string | null,
  options = DEFAULT_OPTIONS
) {
  const { apiCall } = useApi()
  const { enabled } = options

  return useQuery({
    queryKey: queryKeys.git.fileDiff(repoId, commit1, commit2, filePath),
    queryFn: async () => {
      if (!repoId || !commit1 || !commit2 || !filePath) {
        throw new Error('Missing required parameters')
      }
      return apiCall<FileDiffResponse>(`git/${repoId}/diff`, {
        method: 'POST',
        body: JSON.stringify({ commit1, commit2, file_path: filePath })
      })
    },
    enabled: enabled && !!repoId && !!commit1 && !!commit2 && !!filePath,
    staleTime: 5 * 60 * 1000, // 5 minutes (diffs don't change)
  })
}
```

---

### 2.4 Update Query Keys
**File**: `/frontend/src/lib/query-keys.ts`

Add to existing `queryKeys` object:

```typescript
git: {
  all: ['git'] as const,
  repositories: () => [...queryKeys.git.all, 'repositories'] as const,
  tree: (repoId: number | null) =>
    [...queryKeys.git.all, 'tree', repoId] as const,
  directoryFiles: (repoId: number | null, path: string) =>
    [...queryKeys.git.all, 'directoryFiles', repoId, path] as const,
  fileHistory: (repoId: number | null, filePath: string | null) =>
    [...queryKeys.git.all, 'fileHistory', repoId, filePath] as const,
  fileDiff: (repoId: number | null, commit1: string | null, commit2: string | null, filePath: string | null) =>
    [...queryKeys.git.all, 'fileDiff', repoId, commit1, commit2, filePath] as const,
}
```

---

## Phase 3: Frontend - UI Components

### 3.1 File Tree Component
**File**: `/frontend/src/components/features/network/configs/view/components/file-tree.tsx`

**Key Features**:
- Recursive tree rendering
- Expand/collapse directories
- Click to select directory → updates file list
- Show file count badge per directory
- Use Collapsible from Shadcn UI
- Icons: Folder, FolderOpen from lucide-react

**State**:
- `expandedPaths`: Set<string> (tracks which directories are expanded)
- `selectedPath`: string | null (currently selected directory)

**Event Handlers**:
- `onDirectoryClick(path)` - Select directory, fetch files for right panel
- `onToggleExpand(path)` - Toggle expansion state

---

### 3.2 File List Component
**File**: `/frontend/src/components/features/network/configs/view/components/file-list.tsx`

**Key Features**:
- Table layout with columns:
  - File Name (with FileText icon)
  - Size (formatted KB/MB)
  - Last Commit (short hash + message truncated)
  - Commit Date (relative time: "2 hours ago")
  - Actions (History icon button)
- Click "History" → opens File History Dialog
- Loading state while fetching
- Empty state when no files in directory

**Props**:
- `repoId: number`
- `directoryPath: string`
- `onShowHistory: (file: FileWithCommit) => void`

---

### 3.3 File History Dialog
**File**: `/frontend/src/components/features/network/configs/view/dialogs/file-history-dialog.tsx`

**Key Features**:
- Modal (Dialog from Shadcn UI)
- Shows file path in header
- Table of all commits:
  - Checkbox column (select two commits)
  - Commit hash
  - Message
  - Author
  - Date
- Footer: "Compare Selected" button (enabled when 2 commits selected)
- Click "Compare" → opens File Diff Dialog with selected commits

**State**:
- `selectedCommits: string[]` (max 2)

**Props**:
- `isOpen: boolean`
- `onClose: () => void`
- `repoId: number`
- `filePath: string`

**Data Fetching**:
- Use existing endpoint: `GET /api/git/{repo_id}/files/{file_path:path}/complete-history`
- Hook: `useFileHistoryQuery(repoId, filePath)`

---

### 3.4 File Diff Dialog
**File**: `/frontend/src/components/features/network/configs/view/dialogs/file-diff-dialog.tsx`

**Key Features**:
- Large modal (90vw x 90vh)
- Side-by-side diff view
- Header: commit info (hash, message, author, date) for both commits
- Color coding:
  - Green background: added lines
  - Red background: deleted lines
  - Yellow background: modified lines
  - No background: unchanged lines
- Line numbers on both sides
- Stats footer: +X lines, -Y lines

**Props**:
- `isOpen: boolean`
- `onClose: () => void`
- `repoId: number`
- `commit1: string`
- `commit2: string`
- `filePath: string`

**Data Fetching**:
- Use existing endpoint: `POST /api/git/{repo_id}/diff`
- Hook: `useFileDiffQuery(repoId, commit1, commit2, filePath, { enabled: isOpen })`

---

### 3.5 Main Page (Complete Rewrite)
**File**: `/frontend/src/components/features/network/configs/view/configs-view-page.tsx`

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────┐
│ Header: View Config Browser                             │
│ Repository Selector: [Dropdown]          [Refresh]     │
├──────────────────┬──────────────────────────────────────┤
│  File Tree       │  File List                           │
│  (Left Panel)    │  (Right Panel)                       │
│                  │                                       │
│  📁 root         │  Name    Size   Last Commit   Actions│
│    📁 configs    │  file1   10KB   abc123 ...    [👁]   │
│      📄 device1  │  file2   5KB    def456 ...    [👁]   │
│    📁 backups    │                                       │
│                  │                                       │
│  (resizable)     │                                       │
└──────────────────┴──────────────────────────────────────┘
```

**State Management**:
- `selectedRepository: number | null`
- `selectedDirectoryPath: string` (default: '')
- `fileHistoryDialogState: { isOpen, file }`
- `fileDiffDialogState: { isOpen, repoId, commit1, commit2, filePath }`

**Key Interactions**:
1. User selects repository → fetch tree + root directory files
2. User clicks directory in tree → fetch files for that directory
3. User clicks "History" icon → open File History Dialog
4. User selects 2 commits + clicks "Compare" → open File Diff Dialog

---

## Phase 4: Styling & UX

### 4.1 Shadcn UI Components to Use
- Dialog, DialogContent, DialogHeader, DialogTitle
- Button (variants: outline, ghost, default)
- ScrollArea (for tree and file list)
- Badge (for file count, commit hash)
- Table (for file list and commit history)
- Collapsible, CollapsibleTrigger, CollapsibleContent (for tree nodes)
- ResizablePanelGroup, ResizablePanel, ResizableHandle (for split layout)

### 4.2 Icons (Lucide React)
- Folder, FolderOpen (tree directories)
- FileText (files)
- History (show history button)
- GitCommit (commits)
- GitCompare (diff view)
- Eye (view icon in header)
- RotateCcw (refresh button)
- ChevronRight, ChevronDown (tree expand/collapse)

### 4.3 Responsive Design
- Minimum width: 1024px (desktop-first for this feature)
- Left panel: 25% width (resizable 20-40%)
- Right panel: 75% width
- Mobile: Stack vertically (tree on top, file list below)

---

## Phase 5: Verification & Testing

### 5.1 Backend Testing
1. Test tree endpoint with empty repository
2. Test tree endpoint with nested directories (3+ levels)
3. Test directory files endpoint with:
   - Root directory
   - Nested directory
   - Empty directory
   - Non-existent directory
4. Verify last commit fetching for multiple files
5. Test with repository containing 100+ files
6. Verify authentication/permission checks

### 5.2 Frontend Testing
1. **Tree Navigation**:
   - Expand/collapse directories
   - Click directory → verify file list updates
   - Verify file count badges
   - Test with deeply nested structure

2. **File List**:
   - Verify commit metadata displays correctly
   - Test relative time formatting ("2 hours ago")
   - Test file size formatting (KB/MB/GB)
   - Test empty directory state

3. **File History Dialog**:
   - Open dialog → verify commit list loads
   - Select 2 commits → verify "Compare" button enables
   - Verify commit details (hash, message, author, date)
   - Test with file having 50+ commits

4. **File Diff Dialog**:
   - Compare commits → verify diff displays
   - Verify color coding (green/red/yellow)
   - Verify line numbers align correctly
   - Test with large file (1000+ lines)
   - Test with file containing no changes

5. **Integration**:
   - Full workflow: select repo → expand tree → select dir → show history → compare commits
   - Test repository switch → verify state resets
   - Test with multiple config repositories

### 5.3 Error Handling
- Repository not found
- Directory not found
- File not found
- Git repository not initialized
- No commits in repository
- Network errors
- Permission errors

---

## Phase 6: Migration & Cleanup

### 6.1 Route Update
**File**: `/frontend/src/app/(dashboard)/configs/page.tsx`

Ensure it imports the new rewritten component.

### 6.2 Sidebar Menu
Verify link in `/frontend/src/components/layout/app-sidebar.tsx`:
- Path: `/configs`
- Label: "View"
- Icon: Eye
- Parent: "Configs" section

### 6.3 Remove Old Code (if applicable)
- Archive old `configs-view-page.tsx` or remove after testing
- Clean up unused imports/types

---

## Critical Files to Modify

### Backend
1. `/backend/routers/settings/git/files.py` - Add 2 new endpoints

### Frontend
1. `/frontend/src/components/features/network/configs/view/configs-view-page.tsx` - Complete rewrite
2. `/frontend/src/components/features/network/configs/view/components/file-tree.tsx` - NEW
3. `/frontend/src/components/features/network/configs/view/components/file-list.tsx` - NEW
4. `/frontend/src/components/features/network/configs/view/dialogs/file-history-dialog.tsx` - NEW
5. `/frontend/src/components/features/network/configs/view/dialogs/file-diff-dialog.tsx` - NEW
6. `/frontend/src/components/features/network/configs/view/types.ts` - NEW
7. `/frontend/src/hooks/queries/use-git-tree-query.ts` - NEW
8. `/frontend/src/hooks/queries/use-directory-files-query.ts` - NEW
9. `/frontend/src/hooks/queries/use-file-diff-query.ts` - NEW
10. `/frontend/src/lib/query-keys.ts` - Add git query keys

---

## Implementation Order

1. **Backend First**: Create tree + directory files endpoints
2. **Test Backend**: Use Postman/curl to verify endpoints
3. **Query Keys**: Update query-keys.ts
4. **TanStack Hooks**: Create query hooks
5. **Types**: Define TypeScript interfaces
6. **File Tree Component**: Build tree rendering
7. **File List Component**: Build file listing
8. **Main Page**: Wire up tree + file list
9. **File History Dialog**: Add history viewing
10. **File Diff Dialog**: Add comparison feature
11. **Integration Testing**: End-to-end workflow
12. **Polish**: Loading states, error handling, responsive design

---

## Estimated Complexity
- **Backend**: Medium (2 new endpoints, file system + git operations)
- **Frontend**: High (complete UI rewrite, multiple new components, state management)
- **Total**: ~6-8 hours for full implementation + testing

---

## Success Criteria
✅ User can browse repository as tree structure
✅ User can view files in any directory with commit metadata
✅ User can view complete commit history for any file
✅ User can select any 2 commits and compare differences
✅ UI is responsive and follows Shadcn design patterns
✅ All TanStack Query hooks follow best practices
✅ Loading/error states handled gracefully
✅ Works with multiple repositories (via selector)
