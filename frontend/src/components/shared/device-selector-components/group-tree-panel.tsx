import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buildGroupTree, countInventoriesInGroup, GroupTreeNode } from './group-utils'

interface GroupTreePanelProps {
  inventories: Array<{ group_path?: string | null }>
  selectedGroup: string | null
  onSelectGroup: (path: string | null) => void
  allowCreate?: boolean
  allowContextCreate?: boolean
  onCreateGroup?: (parentPath: string | null, name: string) => void
  extraPaths?: string[]
}

const ROOT_KEY = '__root__'

const EMPTY_EXTRA: string[] = []

export function GroupTreePanel({
  inventories,
  selectedGroup,
  onSelectGroup,
  allowCreate = false,
  allowContextCreate = false,
  onCreateGroup,
  extraPaths = EMPTY_EXTRA,
}: GroupTreePanelProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([ROOT_KEY]))
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [creatingUnderPath, setCreatingUnderPath] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string | null } | null>(null)
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const allInventories = useMemo(() => {
    const extra = extraPaths.map(p => ({ group_path: p }))
    return [...inventories, ...extra]
  }, [inventories, extraPaths])

  const groupTree = useMemo(() => buildGroupTree(allInventories), [allInventories])

  useEffect(() => {
    if (isCreatingGroup && newGroupInputRef.current) {
      newGroupInputRef.current.focus()
    }
  }, [isCreatingGroup])

  // Auto-expand the tree down to the selected group
  useEffect(() => {
    if (!selectedGroup) return
    const parts = selectedGroup.split('/')
    const toExpand = new Set([ROOT_KEY])
    for (let i = 1; i <= parts.length; i++) {
      toExpand.add(parts.slice(0, i).join('/'))
    }
    setExpandedPaths(prev => new Set([...prev, ...toExpand]))
  }, [selectedGroup])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu])

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [contextMenu])

  const toggleExpanded = (key: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const startCreatingUnder = (parentPath: string | null) => {
    setCreatingUnderPath(parentPath)
    setIsCreatingGroup(true)
    setNewGroupName('')
    const key = parentPath ?? ROOT_KEY
    setExpandedPaths(prev => new Set([...prev, key]))
  }

  const handleNewGroupConfirm = () => {
    const trimmed = newGroupName.trim()
    if (!trimmed || trimmed.includes('/')) return

    onCreateGroup?.(creatingUnderPath, trimmed)
    setIsCreatingGroup(false)
    setNewGroupName('')
    setCreatingUnderPath(null)
    const key = creatingUnderPath ?? ROOT_KEY
    setExpandedPaths(prev => new Set([...prev, key]))
  }

  const handleNewGroupCancel = () => {
    setIsCreatingGroup(false)
    setNewGroupName('')
    setCreatingUnderPath(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleNewGroupConfirm()
    if (e.key === 'Escape') handleNewGroupCancel()
  }

  const renderNode = (node: GroupTreeNode, depth: number) => {
    const key = node.path ?? ROOT_KEY
    const isSelected = selectedGroup === node.path
    const isExpanded = expandedPaths.has(key)
    const hasChildren = node.children.length > 0
    const invCount = countInventoriesInGroup(inventories, node.path)
    const isCreatingUnder = isCreatingGroup && creatingUnderPath === node.path

    return (
      <div key={key}>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer text-sm transition-colors select-none',
            isSelected
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'hover:bg-gray-100 text-gray-700'
          )}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => onSelectGroup(node.path)}
          onContextMenu={allowContextCreate ? (e) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, path: node.path })
          } : undefined}
        >
          <button
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 rounded hover:bg-gray-200"
            onClick={e => {
              e.stopPropagation()
              if (hasChildren) toggleExpanded(key)
            }}
          >
            {hasChildren ? (
              isExpanded
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />
            ) : null}
          </button>
          {isExpanded && hasChildren
            ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            : <Folder className="h-3.5 w-3.5 flex-shrink-0" />
          }
          <span className="flex-1 truncate">{node.name}</span>
          {invCount > 0 && (
            <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{invCount}</span>
          )}
        </div>

        {isExpanded && (
          <>
            {node.children.map(child => renderNode(child, depth + 1))}

            {isCreatingUnder && (
              <div
                className="flex items-center gap-1 px-2 py-1"
                style={{ paddingLeft: `${(depth + 1) * 14 + 6}px` }}
              >
                <div className="w-4 h-4 flex-shrink-0" />
                <Folder className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <Input
                  ref={newGroupInputRef}
                  className="h-6 text-xs px-1 py-0 flex-1"
                  placeholder="Group name"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleNewGroupCancel}
                />
              </div>
            )}
          </>
        )}

        {!isExpanded && isCreatingUnder && (
          <div
            className="flex items-center gap-1 px-2 py-1"
            style={{ paddingLeft: `${(depth + 1) * 14 + 6}px` }}
          >
            <div className="w-4 h-4 flex-shrink-0" />
            <Folder className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
            <Input
              ref={newGroupInputRef}
              className="h-6 text-xs px-1 py-0 flex-1"
              placeholder="Group name"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleNewGroupCancel}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
        Groups
      </div>
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {renderNode(groupTree, 0)}
      </div>
      {allowCreate && (
        <div className="pt-2 mt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => startCreatingUnder(selectedGroup)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Group
          </Button>
        </div>
      )}

      {/* Right-click context menu — rendered via portal to escape Dialog's CSS transform */}
      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x, pointerEvents: 'auto' }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
            onMouseDown={e => {
              e.preventDefault()
              const parentPath = contextMenu.path
              setContextMenu(null)
              startCreatingUnder(parentPath)
            }}
          >
            <FolderPlus className="h-3.5 w-3.5 text-blue-500" />
            New subgroup here
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}
