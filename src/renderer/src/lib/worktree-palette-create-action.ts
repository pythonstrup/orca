import { isWorktreePaletteQueryTooLarge } from './worktree-palette-query-bounds'

export const CREATE_WORKTREE_ITEM_ID = '__create_worktree__'

export type WorktreePaletteCreateActionState = {
  createWorktreeName: string
  showCreateAction: boolean
}

export function getWorktreePaletteCreateActionState({
  query
}: {
  canCreateWorktree: boolean
  query: string
}): WorktreePaletteCreateActionState {
  const createWorktreeName = query.trim()
  if (isWorktreePaletteQueryTooLarge(createWorktreeName)) {
    return {
      createWorktreeName: '',
      showCreateAction: false
    }
  }
  const showCreateAction = createWorktreeName.length > 0
  return {
    createWorktreeName,
    showCreateAction
  }
}

type WorktreePaletteSelectionCandidateEntry = {
  id: string
  type: string
}

// Why: every rendered row is a CommandItem except section headers and hint rows,
// so exclude those two instead of allowlisting item types — an allowlist drifted
// once already (workspace/simulator tabs were unreachable by arrow keys).
export function isSelectableWorktreePaletteEntry(
  entry: WorktreePaletteSelectionCandidateEntry
): boolean {
  return entry.type !== 'section-header' && entry.type !== 'hint'
}

export function getWorktreePaletteSelectionItemIds<
  T extends WorktreePaletteSelectionCandidateEntry
>(entries: readonly T[]): string[] {
  // Why: keyboard focus should mirror rendered order, including synthetic
  // action rows, while skipping headers and explanatory hint rows.
  return entries.filter(isSelectableWorktreePaletteEntry).map((entry) => entry.id)
}

export function getNextWorktreePaletteSelection({
  currentSelectedItemId,
  queryChanged,
  selectableItemIds,
  showCreateAction
}: {
  currentSelectedItemId: string
  queryChanged: boolean
  selectableItemIds: readonly string[]
  showCreateAction: boolean
}): string {
  const firstSelectableId = selectableItemIds[0] ?? null

  if (queryChanged) {
    return firstSelectableId ?? (showCreateAction ? CREATE_WORKTREE_ITEM_ID : '')
  }

  if (currentSelectedItemId === CREATE_WORKTREE_ITEM_ID && showCreateAction) {
    return currentSelectedItemId
  }

  if (selectableItemIds.includes(currentSelectedItemId)) {
    return currentSelectedItemId
  }

  return firstSelectableId ?? (showCreateAction ? CREATE_WORKTREE_ITEM_ID : '')
}

export type WorktreePaletteRequestGuard = {
  start: () => number
  invalidate: () => void
  isCurrent: (token: number) => boolean
}

export function createWorktreePaletteRequestGuard(): WorktreePaletteRequestGuard {
  let currentToken = 0

  return {
    start: () => {
      currentToken += 1
      return currentToken
    },
    invalidate: () => {
      currentToken += 1
    },
    isCurrent: (token: number) => token === currentToken
  }
}
