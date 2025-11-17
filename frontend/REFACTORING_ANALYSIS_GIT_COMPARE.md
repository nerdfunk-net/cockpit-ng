# Git Compare Components - Refactoring Analysis

## Executive Summary

The Git Compare module consists of 4 components totaling **2,523 lines of code** with significant duplication, complexity, and maintainability issues. This analysis identifies specific refactoring opportunities to improve code quality, reduce duplication, and enhance maintainability.

---

## Current State

### File Inventory
| File | Lines | Hooks | Complexity |
|------|-------|-------|------------|
| `file-history-compare.tsx` | 1,051 | 33 | Very High |
| `git-compare.tsx` | 683 | 26 | High |
| `file-compare.tsx` | 674 | ~20 | High |
| `config-compare.tsx` | 115 | ~5 | Low |
| **TOTAL** | **2,523** | **~84** | **Critical** |

### Key Issues Identified

#### 1. **Massive Component Sizes** 🔴
- `file-history-compare.tsx`: **1,051 lines** (should be < 300)
- `git-compare.tsx`: **683 lines** (should be < 300)
- `file-compare.tsx`: **674 lines** (should be < 300)

**Impact**: Hard to understand, test, and maintain

#### 2. **Excessive State Management** 🔴
- `file-history-compare.tsx`: **33 hooks** (useState, useCallback, useEffect)
- `git-compare.tsx`: **26 hooks**
- Too many useState calls indicate missing abstraction

**Impact**: Complex state dependencies, difficult to debug

#### 3. **Code Duplication** 🟡
Common patterns across all three components:
- Repository selection logic
- Branch selection logic
- Commit loading logic
- File search/filtering logic
- API error handling
- Click-outside handlers
- Diff display logic

**Estimated duplication**: 40-60%

#### 4. **Mixed Responsibilities** 🟡
Each component handles:
- Data fetching (API calls)
- State management
- UI rendering
- Business logic
- Event handling

**Impact**: Violates Single Responsibility Principle

#### 5. **No Shared Types** 🟡
Types defined inline in each file:
```typescript
// Duplicated in multiple files:
interface GitRepository { ... }
interface Branch { ... }
interface Commit { ... }
interface FileItem { ... }
interface DiffLine { ... }
```

#### 6. **Inline Styles and Magic Numbers** 🟡
```typescript
const [fontSize, setFontSize] = useState(12)
style={{ fontSize: `${fontSize}px` }}
```

#### 7. **No Custom Hooks** 🟡
Repeated patterns that should be hooks:
- Repository management
- Branch management
- Commit loading
- File searching
- Diff navigation

---

## Refactoring Recommendations

### Phase 1: Extract Shared Types (Low Risk, High Value)

**Create**: `src/types/git.ts`
```typescript
export interface GitRepository {
  id: number
  name: string
  category: string
  url: string
  branch: string
  is_active: boolean
  description?: string
}

export interface Branch {
  name: string
  current: boolean
}

export interface Commit {
  hash: string
  author: { name: string; email: string }
  date: string
  message: string
  short_hash: string
  files_changed: number
}

export interface FileItem {
  name: string
  path: string
  size: number
  type: 'file' | 'directory'
}

export interface DiffLine {
  type: 'equal' | 'delete' | 'insert' | 'replace' | 'empty'
  line_number: number | null
  content: string
}

export interface ComparisonResult {
  commit1: string
  commit2: string
  file_path: string
  diff_lines: string[]
  left_file: string
  right_file: string
  left_lines: DiffLine[]
  right_lines: DiffLine[]
  stats: {
    additions: number
    deletions: number
    changes: number
    total_lines: number
  }
}
```

**Impact**:
- Remove ~150 lines of duplicated type definitions
- Ensure type consistency
- Easier to update types globally

---

### Phase 2: Create Custom Hooks (Medium Risk, High Value)

#### 2.1 Repository Management Hook
**Create**: `src/hooks/use-git-repositories.ts`
```typescript
export function useGitRepositories() {
  const [repositories, setRepositories] = useState<GitRepository[]>([])
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null)
  const [loading, setLoading] = useState(false)
  const { apiCall } = useApi()

  const loadRepositories = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiCall<{repositories: GitRepository[]}>('git-repositories')
      setRepositories(response.repositories || [])

      // Auto-select first active
      const activeRepos = response.repositories?.filter(r => r.is_active) || []
      if (activeRepos.length > 0) {
        setSelectedRepo(activeRepos[0])
      }
    } catch (error) {
      console.error('Error loading repositories:', error)
    } finally {
      setLoading(false)
    }
  }, [apiCall])

  useEffect(() => {
    loadRepositories()
  }, [loadRepositories])

  return {
    repositories,
    selectedRepo,
    setSelectedRepo,
    loading,
    reload: loadRepositories
  }
}
```

**Replaces**: 50-60 lines in each component
**Savings**: ~180 lines total

#### 2.2 Branch Management Hook
**Create**: `src/hooks/use-git-branches.ts`
```typescript
export function useGitBranches(repoId: number | null) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const { apiCall } = useApi()

  const loadBranches = useCallback(async () => {
    if (!repoId) return

    setLoading(true)
    try {
      const response = await apiCall<Branch[]>(`git/${repoId}/branches`)
      setBranches(response)

      // Auto-select current branch
      const current = response.find(b => b.current)
      if (current) {
        setSelectedBranch(current.name)
      }
    } catch (error) {
      console.error('Error loading branches:', error)
    } finally {
      setLoading(false)
    }
  }, [repoId, apiCall])

  useEffect(() => {
    loadBranches()
  }, [loadBranches])

  return {
    branches,
    selectedBranch,
    setSelectedBranch,
    loading,
    reload: loadBranches
  }
}
```

**Replaces**: 40-50 lines in each component
**Savings**: ~150 lines total

#### 2.3 Commit Loading Hook
**Create**: `src/hooks/use-git-commits.ts`
```typescript
export function useGitCommits(repoId: number | null, branch: string) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(false)
  const { apiCall } = useApi()

  const loadCommits = useCallback(async () => {
    if (!repoId || !branch) return

    setLoading(true)
    try {
      const response = await apiCall<Commit[]>(
        `git/${repoId}/commits/${encodeURIComponent(branch)}`
      )
      setCommits(response)
    } catch (error) {
      console.error('Error loading commits:', error)
    } finally {
      setLoading(false)
    }
  }, [repoId, branch, apiCall])

  useEffect(() => {
    loadCommits()
  }, [loadCommits])

  return {
    commits,
    loading,
    reload: loadCommits
  }
}
```

**Replaces**: 30-40 lines in each component
**Savings**: ~120 lines total

#### 2.4 File Search Hook
**Create**: `src/hooks/use-file-search.ts`
```typescript
export function useFileSearch(files: FileItem[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files
    const query = searchQuery.toLowerCase()
    return files.filter(file =>
      file.name.toLowerCase().includes(query) ||
      file.path.toLowerCase().includes(query)
    )
  }, [files, searchQuery])

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    showResults,
    setShowResults,
    selectedFile,
    setSelectedFile,
    filteredFiles,
    searchRef
  }
}
```

**Replaces**: 60-70 lines in each component
**Savings**: ~210 lines total

#### 2.5 Diff Navigation Hook
**Create**: `src/hooks/use-diff-navigation.ts`
```typescript
export function useDiffNavigation(totalDiffs: number) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [fontSize, setFontSize] = useState(12)

  // Load font size from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('diff_font_size')
    if (stored) {
      setFontSize(parseInt(stored, 10))
    }
  }, [])

  // Save font size to localStorage
  useEffect(() => {
    localStorage.setItem('diff_font_size', fontSize.toString())
  }, [fontSize])

  const nextDiff = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, totalDiffs - 1))
  }, [totalDiffs])

  const prevDiff = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }, [])

  const increaseFontSize = useCallback(() => {
    setFontSize(prev => Math.min(prev + 1, 20))
  }, [])

  const decreaseFontSize = useCallback(() => {
    setFontSize(prev => Math.max(prev - 1, 8))
  }, [])

  return {
    currentIndex,
    setCurrentIndex,
    hideUnchanged,
    setHideUnchanged,
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    nextDiff,
    prevDiff
  }
}
```

**Replaces**: 40-50 lines in each component
**Savings**: ~150 lines total

---

### Phase 3: Extract Reusable Components (Medium Risk, High Value)

#### 3.1 Repository Selector Component
**Create**: `src/components/compare/shared/repository-selector.tsx`
```typescript
interface RepositorySelectorProps {
  repositories: GitRepository[]
  selectedRepo: GitRepository | null
  onSelectRepo: (repo: GitRepository | null) => void
  disabled?: boolean
}

export function RepositorySelector({
  repositories,
  selectedRepo,
  onSelectRepo,
  disabled = false
}: RepositorySelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Repository</Label>
      <Select
        value={selectedRepo?.id.toString() || '__none__'}
        onValueChange={(value) => {
          const repo = repositories.find(r => r.id.toString() === value)
          onSelectRepo(repo || null)
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full border-2 bg-white">
          <SelectValue placeholder="Select repository" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Select repository...</SelectItem>
          {repositories.filter(r => r.is_active).map(repo => (
            <SelectItem key={repo.id} value={repo.id.toString()}>
              {repo.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

**Replaces**: 30-40 lines in each component
**Savings**: ~120 lines total

#### 3.2 Branch Selector Component
**Create**: `src/components/compare/shared/branch-selector.tsx`

#### 3.3 Commit Selector Component
**Create**: `src/components/compare/shared/commit-selector.tsx`

#### 3.4 File Search Component
**Create**: `src/components/compare/shared/file-search.tsx`

#### 3.5 Diff Viewer Component
**Create**: `src/components/compare/shared/diff-viewer.tsx`
- Side-by-side diff view
- Unified diff view
- Syntax highlighting
- Line numbers
- Change indicators

#### 3.6 Diff Controls Component
**Create**: `src/components/compare/shared/diff-controls.tsx`
- Font size controls
- Hide unchanged toggle
- Navigation buttons
- Export button

---

### Phase 4: Create Shared Utilities (Low Risk, Medium Value)

**Create**: `src/lib/compare-utils.ts`
```typescript
export function searchFiles(query: string, files: FileItem[]): FileItem[] {
  if (!query) return files
  const lowerQuery = query.toLowerCase()
  return files.filter(file =>
    file.name.toLowerCase().includes(lowerQuery) ||
    file.path.toLowerCase().includes(lowerQuery)
  )
}

export function formatCommitMessage(message: string, maxLength: number = 50): string {
  return message.length > maxLength
    ? message.substring(0, maxLength) + '...'
    : message
}

export function getDiffStats(diffLines: DiffLine[]): {
  additions: number
  deletions: number
  changes: number
} {
  return diffLines.reduce((acc, line) => {
    if (line.type === 'insert') acc.additions++
    if (line.type === 'delete') acc.deletions++
    if (line.type === 'replace') acc.changes++
    return acc
  }, { additions: 0, deletions: 0, changes: 0 })
}

export function exportDiffAsText(result: ComparisonResult): string {
  // Export diff in unified format
  // ...
}
```

---

## Refactored Component Structure

### After Refactoring: `git-compare.tsx`
**From**: 683 lines
**To**: ~200 lines (70% reduction)

```typescript
'use client'

import { GitCompareLayout } from './shared/git-compare-layout'
import { useGitRepositories } from '@/hooks/use-git-repositories'
import { useGitBranches } from '@/hooks/use-git-branches'
import { useGitCommits } from '@/hooks/use-git-commits'
import { useFileSearch } from '@/hooks/use-file-search'
import { useDiffNavigation } from '@/hooks/use-diff-navigation'
import { useGitComparison } from '@/hooks/use-git-comparison'

export default function GitCompare() {
  const { repositories, selectedRepo, setSelectedRepo } = useGitRepositories()
  const { branches, selectedBranch, setSelectedBranch } = useGitBranches(selectedRepo?.id)
  const { commits } = useGitCommits(selectedRepo?.id, selectedBranch)
  const fileSearch = useFileSearch(gitFiles)
  const diffNav = useDiffNavigation(diffCount)
  const { compare, result, loading } = useGitComparison()

  return (
    <GitCompareLayout
      repositories={repositories}
      selectedRepo={selectedRepo}
      onSelectRepo={setSelectedRepo}
      branches={branches}
      selectedBranch={selectedBranch}
      onSelectBranch={setSelectedBranch}
      commits={commits}
      fileSearch={fileSearch}
      diffNav={diffNav}
      comparisonResult={result}
      loading={loading}
      onCompare={compare}
    />
  )
}
```

---

## Estimated Impact

### Lines of Code Reduction
| Phase | Lines Removed | Lines Added | Net Reduction |
|-------|---------------|-------------|---------------|
| Phase 1: Types | -150 | +100 | **-50** |
| Phase 2: Hooks | -810 | +400 | **-410** |
| Phase 3: Components | -400 | +300 | **-100** |
| Phase 4: Utils | -100 | +80 | **-20** |
| **TOTAL** | **-1,460** | **+880** | **-580 (23%)** |

### Maintainability Improvements
- ✅ Single source of truth for types
- ✅ Reusable hooks across all compare features
- ✅ Smaller, focused components (<300 lines)
- ✅ Easier to test individual pieces
- ✅ Reduced duplication by 60%
- ✅ Better separation of concerns

### Developer Experience
- ✅ Faster to add new compare features
- ✅ Easier to onboard new developers
- ✅ Clearer code structure
- ✅ Better TypeScript inference
- ✅ Reduced cognitive load

---

## Implementation Plan

### Week 1: Foundation
- [ ] Create `src/types/git.ts` with all shared types
- [ ] Update all components to use shared types
- [ ] Verify no regressions

### Week 2: Custom Hooks
- [ ] Create `use-git-repositories.ts`
- [ ] Create `use-git-branches.ts`
- [ ] Create `use-git-commits.ts`
- [ ] Update `git-compare.tsx` to use new hooks
- [ ] Test thoroughly

### Week 3: More Hooks
- [ ] Create `use-file-search.ts`
- [ ] Create `use-diff-navigation.ts`
- [ ] Create `use-git-comparison.ts`
- [ ] Update all components
- [ ] Test thoroughly

### Week 4: Shared Components
- [ ] Create shared selector components
- [ ] Create shared diff viewer
- [ ] Create shared controls
- [ ] Update all compare pages
- [ ] Final testing

### Week 5: Polish
- [ ] Create utility functions
- [ ] Add JSDoc comments
- [ ] Update documentation
- [ ] Performance optimization
- [ ] Final review

---

## Risks and Mitigation

### Risk 1: Breaking Changes
**Mitigation**:
- Refactor one component at a time
- Keep old code until new code is proven
- Comprehensive testing after each phase

### Risk 2: User Experience Disruption
**Mitigation**:
- Feature parity testing
- Beta testing with users
- Rollback plan ready

### Risk 3: Performance Regression
**Mitigation**:
- Performance benchmarks before/after
- React DevTools profiling
- Optimize render cycles

---

## Success Metrics

- [ ] Code coverage > 80%
- [ ] No regressions in functionality
- [ ] Build time reduced by 10%
- [ ] Component size < 300 lines
- [ ] Hooks count per component < 10
- [ ] Duplication < 10%

---

## Conclusion

The Git Compare module is **critically in need of refactoring**. With over 2,500 lines of complex, duplicated code, it's becoming a maintenance burden. The proposed refactoring will:

1. **Reduce complexity** by 60%
2. **Improve maintainability** significantly
3. **Enable faster feature development**
4. **Reduce bugs** through better separation
5. **Improve developer experience**

**Recommendation**: Proceed with refactoring in phases, starting with type extraction and custom hooks.
