import { useCallback, useEffect, useEffectEvent, useMemo } from 'react'
import { detectLanguage } from '@/lib/language-detect'
import { openUncommittedEntry } from './open-uncommitted-entry'
import { useAppStore } from '@/store'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../../../shared/git-diff-compare-types'
import type { GitStatusEntry } from '../../../../../../shared/git-status-types'
import { buildActiveOpenFileSignature, buildActiveOpenRowKeys } from './active-open-file-keys'
import type { FlatEntry } from './use-selection'
import {
  isSourceControlSplitOpenModifier,
  shouldOpenSourceControlRowAsPreview,
  type SourceControlRowOpenEvent
} from './split-open'

export function useSourceControlRowOpening({
  isMac,
  activeWorktreeId,
  worktreePath,
  visibleSelectionEntries,
  branchSummary
}: {
  isMac: boolean
  activeWorktreeId: string | null
  worktreePath: string | null
  visibleSelectionEntries: FlatEntry[]
  branchSummary: GitBranchCompareSummary | null
}) {
  const activeGroupIdByWorktree = useAppStore((s) => s.activeGroupIdByWorktree)
  const groupsByWorktree = useAppStore((s) => s.groupsByWorktree)
  const createEmptySplitGroup = useAppStore((s) => s.createEmptySplitGroup)
  const trackConflictPath = useAppStore((s) => s.trackConflictPath)
  const openConflictFile = useAppStore((s) => s.openConflictFile)
  const openDiff = useAppStore((s) => s.openDiff)
  const openFile = useAppStore((s) => s.openFile)
  const openBranchDiff = useAppStore((s) => s.openBranchDiff)

  // Modifier-click opens a right split to preserve the current pane.
  const resolveSplitTargetGroupId = useCallback(
    (event?: SourceControlRowOpenEvent): string | undefined => {
      if (!event || !activeWorktreeId || !isSourceControlSplitOpenModifier(event, isMac)) {
        return undefined
      }
      const sourceGroupId =
        activeGroupIdByWorktree[activeWorktreeId] ?? groupsByWorktree[activeWorktreeId]?.[0]?.id
      if (!sourceGroupId) {
        return undefined
      }
      return createEmptySplitGroup(activeWorktreeId, sourceGroupId, 'right') ?? undefined
    },
    [activeGroupIdByWorktree, activeWorktreeId, createEmptySplitGroup, groupsByWorktree, isMac]
  )

  // Use a primitive signature so unrelated store writes do not rerender; return null for non-editor tabs.
  const activeOpenFileSignature = useAppStore((s) => {
    if (!activeWorktreeId || s.activeTabTypeByWorktree?.[activeWorktreeId] !== 'editor') {
      return null
    }
    const activeFileId = s.activeFileIdByWorktree?.[activeWorktreeId]
    if (!activeFileId) {
      return null
    }
    const activeFile = s.openFiles?.find(
      (file) => file.id === activeFileId && file.worktreeId === activeWorktreeId
    )
    return activeFile
      ? buildActiveOpenFileSignature(activeFile.diffSource, activeFile.relativePath)
      : null
  })
  const activeOpenAvailableRowKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const entry of visibleSelectionEntries) {
      keys.add(entry.key)
    }
    return keys
  }, [visibleSelectionEntries])
  const activeOpenRowKeys = useMemo(
    () => buildActiveOpenRowKeys(activeOpenFileSignature, activeOpenAvailableRowKeys),
    [activeOpenAvailableRowKeys, activeOpenFileSignature]
  )

  const handleOpenDiff = useCallback(
    (entry: GitStatusEntry, event?: SourceControlRowOpenEvent) => {
      if (!activeWorktreeId || !worktreePath) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      const openAsPreview = shouldOpenSourceControlRowAsPreview(event, targetGroupId)
      openUncommittedEntry(
        { trackConflictPath, openConflictFile, openFile, openDiff },
        activeWorktreeId,
        worktreePath,
        entry,
        { targetGroupId, preview: openAsPreview }
      )
    },
    [
      activeWorktreeId,
      worktreePath,
      resolveSplitTargetGroupId,
      trackConflictPath,
      openConflictFile,
      openDiff,
      openFile
    ]
  )

  const openCommittedDiff = useCallback(
    (entry: GitBranchChangeEntry, event?: SourceControlRowOpenEvent) => {
      if (
        !activeWorktreeId ||
        !worktreePath ||
        !branchSummary ||
        branchSummary.status !== 'ready'
      ) {
        return
      }
      const targetGroupId = resolveSplitTargetGroupId(event)
      openBranchDiff(
        activeWorktreeId,
        worktreePath,
        entry,
        branchSummary,
        detectLanguage(entry.path),
        { targetGroupId, preview: shouldOpenSourceControlRowAsPreview(event, targetGroupId) }
      )
    },
    [activeWorktreeId, branchSummary, openBranchDiff, resolveSplitTargetGroupId, worktreePath]
  )

  // Bridge the editor's F7/Shift+F7 diff-change nav across file edges: when the
  // cursor is at the file's last/first change, advance to the adjacent changed
  // file honoring exactly the order/filtering shown in this panel. useEffectEvent
  // keeps the registered function stable while reading only committed values.
  const setChangedFileDiffNavigator = useAppStore((s) => s.setChangedFileDiffNavigator)
  const navigateToAdjacentChangedFile = useEffectEvent(
    (direction: 'next' | 'previous'): boolean => {
      // Why: activeOpenRowKeys may hold both unstaged:: and untracked:: keys for
      // one path, but git makes those row kinds mutually exclusive per path, so
      // first match is the only match.
      const currentIndex = visibleSelectionEntries.findIndex((entry) =>
        activeOpenRowKeys.has(entry.key)
      )
      if (currentIndex === -1) {
        return false
      }
      const adjacent =
        visibleSelectionEntries[direction === 'next' ? currentIndex + 1 : currentIndex - 1]
      if (!adjacent) {
        return false
      }
      handleOpenDiff(adjacent.entry)
      return true
    }
  )
  useEffect(() => {
    setChangedFileDiffNavigator(navigateToAdjacentChangedFile)
    return () => {
      // Identity guard: a late unmount must not wipe a newer panel's registration.
      if (useAppStore.getState().changedFileDiffNavigator === navigateToAdjacentChangedFile) {
        setChangedFileDiffNavigator(null)
      }
    }
  }, [setChangedFileDiffNavigator])

  return { resolveSplitTargetGroupId, activeOpenRowKeys, handleOpenDiff, openCommittedDiff }
}
