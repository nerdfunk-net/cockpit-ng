import type { GitRepository } from '@/hooks/queries/use-git-repositories-query'
import type { ConfigContentSearchMatch } from '../types'

interface BuildGitFileWebUrlOptions {
  repository: Pick<GitRepository, 'url' | 'branch' | 'path'>
  match: ConfigContentSearchMatch
  diffCommit1?: string | null
  diffCommit2?: string | null
}

function parseRepoWebBase(url: string): { origin: string; pathname: string } | null {
  const trimmed = url.trim()

  if (trimmed.startsWith('git@')) {
    const sshMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
    if (!sshMatch) {
      return null
    }
    const [, host, repoPath] = sshMatch
    if (!host || !repoPath) {
      return null
    }
    return {
      origin: `https://${host}`,
      pathname: `/${repoPath.replace(/\.git$/, '')}`,
    }
  }

  try {
    const parsed = new URL(trimmed.replace(/\.git$/, ''))
    return {
      origin: parsed.origin,
      pathname: parsed.pathname.replace(/\/$/, ''),
    }
  } catch {
    return null
  }
}

function buildRemoteFilePath(filePath: string): string {
  return filePath.replace(/^\/+/, '')
}

function resolveRef(
  branch: string,
  match: ConfigContentSearchMatch,
  diffCommit1?: string | null,
  diffCommit2?: string | null
): string {
  if (match.match_source === 'history' && match.commit) {
    return match.commit
  }

  if (match.match_source === 'diff') {
    if (match.commit?.includes('..')) {
      const [older, newer] = match.commit.split('..')
      if (match.change_type === 'remove' && older) {
        return older
      }
      if (newer) {
        return newer
      }
    }
    if (match.change_type === 'remove' && diffCommit1) {
      return diffCommit1
    }
    if (diffCommit2) {
      return diffCommit2
    }
  }

  return branch || 'main'
}

function encodeFilePath(filePath: string): string {
  return filePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

function buildUrlForHost(
  repoBase: { origin: string; pathname: string },
  host: string,
  ref: string,
  filePath: string,
  lineNumber: number
): string {
  const encodedRef = encodeURIComponent(ref)
  const encodedPath = encodeFilePath(filePath)
  const base = `${repoBase.origin}${repoBase.pathname}`

  if (host === 'github.com' || host.endsWith('.github.com')) {
    return `${base}/blob/${encodedRef}/${encodedPath}#L${lineNumber}`
  }

  if (host.includes('gitlab')) {
    return `${base}/-/blob/${encodedRef}/${encodedPath}#L${lineNumber}`
  }

  if (host.includes('bitbucket.org')) {
    return `${base}/src/${encodedRef}/${encodedPath}#lines-${lineNumber}`
  }

  if (
    host.includes('gitea') ||
    host.includes('forgejo') ||
    host.includes('codeberg')
  ) {
    return `${base}/src/branch/${encodedRef}/${encodedPath}#L${lineNumber}`
  }

  return `${base}/blob/${encodedRef}/${encodedPath}#L${lineNumber}`
}

export function buildGitFileWebUrl({
  repository,
  match,
  diffCommit1,
  diffCommit2,
}: BuildGitFileWebUrlOptions): string | null {
  if (!repository.url?.trim()) {
    return null
  }

  const repoBase = parseRepoWebBase(repository.url)
  if (!repoBase) {
    return null
  }

  try {
    const host = new URL(repoBase.origin).hostname.toLowerCase()
    const remotePath = buildRemoteFilePath(match.file_path)
    const ref = resolveRef(repository.branch, match, diffCommit1, diffCommit2)
    return buildUrlForHost(repoBase, host, ref, remotePath, match.line_number)
  } catch {
    return null
  }
}
