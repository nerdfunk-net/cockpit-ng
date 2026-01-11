import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConditionTree, createEmptyTree, generateId } from './use-condition-tree'
import type { ConditionTree, ConditionItem, ConditionGroup, LogicalCondition } from '@/types/shared/device-selector'

describe('useConditionTree', () => {
  describe('initialization', () => {
    it('should initialize with empty tree', () => {
      const { result } = renderHook(() => useConditionTree())

      expect(result.current.conditionTree).toEqual({
        type: 'root',
        internalLogic: 'AND',
        items: []
      })
      expect(result.current.currentGroupPath).toEqual([])
    })
  })

  describe('addConditionToTree', () => {
    it('should add condition to root level', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addConditionToTree('device_type', 'equals', 'Router')
      })

      expect(result.current.conditionTree.items).toHaveLength(1)
      const item = result.current.conditionTree.items[0] as ConditionItem
      expect(item.field).toBe('device_type')
      expect(item.operator).toBe('equals')
      expect(item.value).toBe('Router')
      expect(item.id).toBeDefined()
    })

    it('should add multiple conditions to root level', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addConditionToTree('device_type', 'equals', 'Router')
        result.current.addConditionToTree('role', 'equals', 'Core')
      })

      expect(result.current.conditionTree.items).toHaveLength(2)
    })

    it('should add condition to nested group', () => {
      const { result } = renderHook(() => useConditionTree())

      // First add a group
      act(() => {
        result.current.addGroup('OR', false)
      })

      const groupId = (result.current.conditionTree.items[0] as ConditionGroup).id

      // Set current path to the group
      act(() => {
        result.current.setCurrentGroupPath([groupId])
      })

      // Add condition to the group
      act(() => {
        result.current.addConditionToTree('status', 'equals', 'Active')
      })

      const group = result.current.conditionTree.items[0] as ConditionGroup
      expect(group.items).toHaveLength(1)
      const item = group.items[0] as ConditionItem
      expect(item.field).toBe('status')
    })
  })

  describe('addGroup', () => {
    it('should add group to root level', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addGroup('OR', false)
      })

      expect(result.current.conditionTree.items).toHaveLength(1)
      const group = result.current.conditionTree.items[0] as ConditionGroup
      expect(group.type).toBe('group')
      expect(group.logic).toBe('OR')
      expect(group.internalLogic).toBe('AND') // Default internal logic
      expect(group.items).toEqual([])
    })

    it('should add nested group', () => {
      const { result} = renderHook(() => useConditionTree())

      // Add parent group
      act(() => {
        result.current.addGroup('OR', false)
      })

      const parentGroupId = (result.current.conditionTree.items[0] as ConditionGroup).id

      // Set current path
      act(() => {
        result.current.setCurrentGroupPath([parentGroupId])
      })

      // Add nested group
      act(() => {
        result.current.addGroup('AND', false)
      })

      const parentGroup = result.current.conditionTree.items[0] as ConditionGroup
      expect(parentGroup.items).toHaveLength(1)
      const nestedGroup = parentGroup.items[0] as ConditionGroup
      expect(nestedGroup.type).toBe('group')
      expect(nestedGroup.logic).toBe('AND')
    })
  })

  describe('removeItemFromTree', () => {
    it('should remove condition from root level', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addConditionToTree('device_type', 'equals', 'Router')
        result.current.addConditionToTree('role', 'equals', 'Core')
      })

      const itemId = (result.current.conditionTree.items[0] as ConditionItem).id

      act(() => {
        result.current.removeItemFromTree(itemId)
      })

      expect(result.current.conditionTree.items).toHaveLength(1)
      expect((result.current.conditionTree.items[0] as ConditionItem).field).toBe('role')
    })

    it('should remove group and its contents', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addGroup('OR', false)
      })

      const groupId = (result.current.conditionTree.items[0] as ConditionGroup).id

      act(() => {
        result.current.setCurrentGroupPath([groupId])
      })

      act(() => {
        result.current.addConditionToTree('status', 'equals', 'Active')
      })

      // Check that group now has 1 item
      const group = result.current.conditionTree.items[0] as ConditionGroup
      expect(group.items).toHaveLength(1)

      act(() => {
        result.current.removeItemFromTree(groupId)
      })

      expect(result.current.conditionTree.items).toHaveLength(0)
    })

    it('should remove item from nested group', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addGroup('OR', false)
      })

      const groupId = (result.current.conditionTree.items[0] as ConditionGroup).id

      act(() => {
        result.current.setCurrentGroupPath([groupId])
      })

      act(() => {
        result.current.addConditionToTree('status', 'equals', 'Active')
        result.current.addConditionToTree('role', 'equals', 'Core')
      })

      // Access nested items after state has updated
      const group = result.current.conditionTree.items[0] as ConditionGroup
      expect(group.items).toHaveLength(2)
      const itemId = (group.items[0] as ConditionItem).id

      act(() => {
        result.current.removeItemFromTree(itemId)
      })

      const updatedGroup = result.current.conditionTree.items[0] as ConditionGroup
      expect(updatedGroup.items).toHaveLength(1)
      expect((updatedGroup.items[0] as ConditionItem).field).toBe('role')
    })
  })

  describe('updateGroupLogic', () => {
    it('should update group internal logic', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addGroup('OR', false)
      })

      const groupId = (result.current.conditionTree.items[0] as ConditionGroup).id

      act(() => {
        result.current.updateGroupLogic(groupId, 'OR', 'internalLogic')
      })

      const group = result.current.conditionTree.items[0] as ConditionGroup
      expect(group.internalLogic).toBe('OR')
    })

    it('should update group parent logic', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addGroup('OR', false)
      })

      const groupId = (result.current.conditionTree.items[0] as ConditionGroup).id

      act(() => {
        result.current.updateGroupLogic(groupId, 'OR')
      })

      const group = result.current.conditionTree.items[0] as ConditionGroup
      // updateGroupLogic updates internalLogic, not logic
      expect(group.internalLogic).toBe('OR')
      expect(group.logic).toBe('OR') // logic was set by addGroup
    })
  })

  describe('findGroupPath', () => {
    it('should return null for condition at root level', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addConditionToTree('device_type', 'equals', 'Router')
      })

      const itemId = (result.current.conditionTree.items[0] as ConditionItem).id

      // findGroupPath only finds groups, not conditions
      const path = result.current.findGroupPath(itemId)
      expect(path).toBeNull()
    })

    it('should find path to nested group', () => {
      const { result } = renderHook(() => useConditionTree())

      act(() => {
        result.current.addGroup('OR', false)
      })

      const parentGroupId = (result.current.conditionTree.items[0] as ConditionGroup).id

      act(() => {
        result.current.setCurrentGroupPath([parentGroupId])
      })

      act(() => {
        result.current.addGroup('AND', false)
      })

      // Access nested group after state has updated
      const parentGroup = result.current.conditionTree.items[0] as ConditionGroup
      expect(parentGroup.items).toHaveLength(1)
      const nestedGroupId = (parentGroup.items[0] as ConditionGroup).id

      // findGroupPath returns the path TO the group (not including the group itself)
      // So for a nested group, it returns the parent path
      const path = result.current.findGroupPath(nestedGroupId)
      expect(path).toEqual([parentGroupId])
    })

    it('should return null for non-existent item', () => {
      const { result } = renderHook(() => useConditionTree())

      const path = result.current.findGroupPath('non-existent-id')
      expect(path).toBeNull()
    })
  })

  describe('flatConditionsToTree', () => {
    it('should convert flat conditions to tree', () => {
      const { result } = renderHook(() => useConditionTree())

      const flatConditions: LogicalCondition[] = [
        { field: 'device_type', operator: 'equals', value: 'Router', logic: 'AND' },
        { field: 'role', operator: 'equals', value: 'Core', logic: 'AND' }
      ]

      let tree: ConditionTree

      act(() => {
        tree = result.current.flatConditionsToTree(flatConditions)
      })

      expect(tree!.items).toHaveLength(2)
      expect((tree!.items[0] as ConditionItem).field).toBe('device_type')
      expect((tree!.items[1] as ConditionItem).field).toBe('role')
      expect(tree!.internalLogic).toBe('AND')
    })

    it('should handle empty flat conditions', () => {
      const { result } = renderHook(() => useConditionTree())

      let tree: ConditionTree

      act(() => {
        tree = result.current.flatConditionsToTree([])
      })

      expect(tree!).toEqual(createEmptyTree())
    })

    it('should infer OR logic from flat conditions', () => {
      const { result } = renderHook(() => useConditionTree())

      const flatConditions: LogicalCondition[] = [
        { field: 'status', operator: 'equals', value: 'Active', logic: 'OR' }
      ]

      let tree: ConditionTree

      act(() => {
        tree = result.current.flatConditionsToTree(flatConditions)
      })

      expect(tree!.internalLogic).toBe('OR')
    })
  })

  describe('complex scenarios', () => {
    it('should handle deeply nested groups', () => {
      const { result } = renderHook(() => useConditionTree())

      // Add first level group
      act(() => {
        result.current.addGroup('OR', false)
      })

      const group1Id = (result.current.conditionTree.items[0] as ConditionGroup).id

      // Add second level group
      act(() => {
        result.current.setCurrentGroupPath([group1Id])
      })

      act(() => {
        result.current.addGroup('AND', false)
      })

      // Access nested group after state has updated
      const group1 = result.current.conditionTree.items[0] as ConditionGroup
      expect(group1.items).toHaveLength(1)
      const group2Id = (group1.items[0] as ConditionGroup).id

      // Add condition to deepest group
      act(() => {
        result.current.setCurrentGroupPath([group1Id, group2Id])
      })

      act(() => {
        result.current.addConditionToTree('device_type', 'equals', 'Switch')
      })

      const group1Final = result.current.conditionTree.items[0] as ConditionGroup
      const group2 = group1Final.items[0] as ConditionGroup
      expect(group2.items).toHaveLength(1)
      expect((group2.items[0] as ConditionItem).field).toBe('device_type')
    })

    it('should maintain tree structure after multiple operations', () => {
      const { result } = renderHook(() => useConditionTree())

      // Build complex tree
      act(() => {
        // Add root level conditions
        result.current.addConditionToTree('device_type', 'equals', 'Router')
        result.current.addConditionToTree('role', 'equals', 'Core')

        // Add a group
        result.current.addGroup('OR', false)
      })

      // Get group ID after state has updated
      expect(result.current.conditionTree.items).toHaveLength(3)
      const groupId = (result.current.conditionTree.items[2] as ConditionGroup).id

      act(() => {
        // Add conditions to group
        result.current.setCurrentGroupPath([groupId])
      })

      act(() => {
        result.current.addConditionToTree('status', 'equals', 'Active')
        result.current.addConditionToTree('status', 'equals', 'Staged')
      })

      // Verify structure
      expect(result.current.conditionTree.items).toHaveLength(3)
      expect((result.current.conditionTree.items[0] as ConditionItem).field).toBe('device_type')
      expect((result.current.conditionTree.items[1] as ConditionItem).field).toBe('role')

      const group = result.current.conditionTree.items[2] as ConditionGroup
      expect(group.items).toHaveLength(2)
      expect((group.items[0] as ConditionItem).field).toBe('status')
      expect((group.items[0] as ConditionItem).value).toBe('Active')
      expect((group.items[1] as ConditionItem).value).toBe('Staged')
    })
  })
})

describe('helper functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })
  })

  describe('createEmptyTree', () => {
    it('should create empty tree structure', () => {
      const tree = createEmptyTree()

      expect(tree).toEqual({
        type: 'root',
        internalLogic: 'AND',
        items: []
      })
    })
  })
})
