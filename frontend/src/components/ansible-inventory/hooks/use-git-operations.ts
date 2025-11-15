/**
 * Hook for managing Git repository operations
 */

import { useState } from 'react'
import type { GitRepository, GitPushResult } from '../types'

export function useGitOperations() {
  // Git repositories
  const [gitRepositories, setGitRepositories] = useState<GitRepository[]>([])
  const [selectedGitRepo, setSelectedGitRepo] = useState<number | null>(null)

  // Git push
  const [isPushingToGit, setIsPushingToGit] = useState(false)
  const [showGitSuccessModal, setShowGitSuccessModal] = useState(false)
  const [gitPushResult, setGitPushResult] = useState<GitPushResult | null>(null)

  const resetGitPush = () => {
    setShowGitSuccessModal(false)
    setGitPushResult(null)
  }

  const updateGitPushResult = (result: GitPushResult) => {
    setGitPushResult(result)
    setShowGitSuccessModal(true)
  }

  return {
    // State
    gitRepositories,
    selectedGitRepo,
    isPushingToGit,
    showGitSuccessModal,
    gitPushResult,

    // Setters
    setGitRepositories,
    setSelectedGitRepo,
    setIsPushingToGit,
    setShowGitSuccessModal,
    setGitPushResult,

    // Actions
    resetGitPush,
    updateGitPushResult,
  }
}
