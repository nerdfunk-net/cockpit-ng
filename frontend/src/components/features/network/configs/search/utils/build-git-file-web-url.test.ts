import { describe, expect, it } from 'vitest'
import { buildGitFileWebUrl } from './build-git-file-web-url'
import type { ConfigContentSearchMatch } from '../types'

const repository = {
  url: 'https://github.com/nerdfunk-net/test-repo.git',
  branch: 'main',
  path: 'configs',
}

const match: ConfigContentSearchMatch = {
  file_path: 'lab-1.running-config.cfg',
  line_number: 18,
  line_content: 'hostname lab-1',
  match_source: 'current',
}

describe('buildGitFileWebUrl', () => {
  it('uses the search file path as-is and does not prepend repository.path', () => {
    const url = buildGitFileWebUrl({ repository, match })

    expect(url).toBe(
      'https://github.com/nerdfunk-net/test-repo/blob/main/lab-1.running-config.cfg#L18'
    )
  })

  it('preserves nested paths from search results', () => {
    const url = buildGitFileWebUrl({
      repository,
      match: {
        ...match,
        file_path: 'backups/lab-1.2025-01-01.running-config',
      },
    })

    expect(url).toBe(
      'https://github.com/nerdfunk-net/test-repo/blob/main/backups/lab-1.2025-01-01.running-config#L18'
    )
  })

  it('uses historical commit refs', () => {
    const url = buildGitFileWebUrl({
      repository,
      match: {
        ...match,
        match_source: 'history',
        commit: 'abc12345',
      },
    })

    expect(url).toBe(
      'https://github.com/nerdfunk-net/test-repo/blob/abc12345/lab-1.running-config.cfg#L18'
    )
  })
})
