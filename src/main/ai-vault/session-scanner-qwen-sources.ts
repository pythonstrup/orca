import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AiVaultScanIssue } from '../../shared/ai-vault-types'
import { discoverFiles } from './session-scanner-discovery'
import { SUBAGENT_DIR_NAME } from './session-scanner-subagent-transcripts'
import type { AiVaultScanOptions, SessionFileDiscovery } from './session-scanner-types'

const QWEN_PROJECTS_DIR = join(homedir(), '.qwen', 'projects')

export function qwenDiscoveries(
  options: AiVaultScanOptions,
  wslHomeDirs: readonly string[],
  limit: number,
  issues: AiVaultScanIssue[]
): Promise<SessionFileDiscovery>[] {
  return sessionRootDirs(options.qwenProjectsDir ?? QWEN_PROJECTS_DIR, wslHomeDirs, [
    '.qwen',
    'projects'
  ]).map((rootDir) =>
    discoverFiles({
      rootDir,
      limit,
      agent: 'qwen-code',
      issues,
      extensions: ['.jsonl'],
      // Why: resumable sessions live at <project>/chats/<id>.jsonl; prune the
      // subagent subtree and ignore anything outside a chats/ dir.
      directoryPredicate: (name) => name !== SUBAGENT_DIR_NAME,
      filePredicate: (path) => path.split(/[\\/]/).includes('chats')
    })
  )
}

function sessionRootDirs(
  hostRootDir: string,
  wslHomeDirs: readonly string[],
  segments: readonly string[]
): string[] {
  return [hostRootDir, ...wslHomeDirs.map((homeDir) => join(homeDir, ...segments))]
}
