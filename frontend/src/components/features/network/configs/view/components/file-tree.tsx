'use client'

import { useState, useCallback, useEffect } from 'react'
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { GitTreeNode } from '../types'

interface FileTreeProps {
  tree: GitTreeNode | null
  selectedPath: string
  onDirectorySelect: (path: string) => void
  highlightedDirectories?: Set<string>
}

export function FileTree({ tree, selectedPath, onDirectorySelect, highlightedDirectories }: FileTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']))

  // Auto-expand highlighted directories when search is active
  // Using requestAnimationFrame to defer setState and avoid React Compiler cascade warning
  useEffect(() => {
    if (!highlightedDirectories || highlightedDirectories.size === 0) {
      return
    }
    const frameId = requestAnimationFrame(() => {
      setExpandedPaths(prev => {
        // Check if the sets are actually different before updating
        if (prev.size !== highlightedDirectories.size) {
          return new Set(highlightedDirectories)
        }
        for (const dir of highlightedDirectories) {
          if (!prev.has(dir)) return new Set(highlightedDirectories)
        }
        return prev // No change needed
      })
    })
    return () => cancelAnimationFrame(frameId)
  }, [highlightedDirectories])

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleDirectoryClick = useCallback((path: string) => {
    onDirectorySelect(path)
  }, [onDirectorySelect])

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No directory structure available
      </div>
    )
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4">
        <TreeNode
          node={tree}
          level={0}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          highlightedDirectories={highlightedDirectories}
          onToggleExpand={toggleExpand}
          onDirectoryClick={handleDirectoryClick}
        />
      </div>
    </ScrollArea>
  )
}

interface TreeNodeProps {
  node: GitTreeNode
  level: number
  expandedPaths: Set<string>
  selectedPath: string
  highlightedDirectories?: Set<string>
  onToggleExpand: (path: string) => void
  onDirectoryClick: (path: string) => void
}

const TreeNode = ({
  node,
  level,
  expandedPaths,
  selectedPath,
  highlightedDirectories,
  onToggleExpand,
  onDirectoryClick,
}: TreeNodeProps) => {
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  const isHighlighted = highlightedDirectories?.has(node.path)
  const hasChildren = node.children && node.children.length > 0

  const handleToggle = useCallback(() => {
    if (hasChildren) {
      onToggleExpand(node.path)
    }
  }, [hasChildren, node.path, onToggleExpand])

  const handleClick = useCallback(() => {
    onDirectoryClick(node.path)
  }, [node.path, onDirectoryClick])

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 transition-colors ${
          isSelected ? 'bg-gray-200' : isHighlighted ? 'bg-yellow-100' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              handleToggle()
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <div className="w-4" />
        )}

        {/* Folder icon */}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
        )}

        {/* Directory name */}
        <span className="text-sm truncate flex-1">{node.name}</span>

        {/* File count badge */}
        {node.file_count !== undefined && node.file_count > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {node.file_count}
          </Badge>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              highlightedDirectories={highlightedDirectories}
              onToggleExpand={onToggleExpand}
              onDirectoryClick={onDirectoryClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}
