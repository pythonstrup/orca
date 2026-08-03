import { systemPreferences } from 'electron'

/**
 * macOS "Add period with double-space" (`NSAutomaticPeriodSubstitutionEnabled`, on by
 * default) is applied by the text input system, which Chromium text fields opt into.
 * Native terminals never see it, but Orca's xterm helper does: with a Hangul input
 * source even a single word-separating space is re-processed on the IME commit path and
 * comes back as `". "` straight into the PTY, corrupting the typed command.
 * Writing the key into Orca's own defaults domain overrides the global value for this
 * app only — the user's system-wide setting is left untouched.
 *
 * The substitution is enforced outside the renderer and never reproduces in dev builds,
 * so changes here must be verified against a packaged app (#11504).
 */
const AUTOMATIC_PERIOD_SUBSTITUTION_KEY = 'NSAutomaticPeriodSubstitutionEnabled'

type SetUserDefault = (key: string, type: 'boolean', value: boolean) => void

export type DisableMacAutomaticPeriodSubstitutionOptions = {
  logger?: Pick<Console, 'warn'>
  platform?: NodeJS.Platform
  setUserDefault?: SetUserDefault
}

/** Returns true when the app-domain override was written. No-op off macOS. */
export function disableMacAutomaticPeriodSubstitution(
  options: DisableMacAutomaticPeriodSubstitutionOptions = {}
): boolean {
  const platform = options.platform ?? process.platform
  if (platform !== 'darwin') {
    return false
  }

  const setUserDefault =
    options.setUserDefault ??
    ((key, type, value) => systemPreferences.setUserDefault(key, type, value))

  try {
    setUserDefault(AUTOMATIC_PERIOD_SUBSTITUTION_KEY, 'boolean', false)
    return true
  } catch (error) {
    // Why: a preferences write is never worth failing startup over.
    ;(options.logger ?? console).warn(
      'Failed to disable macOS automatic period substitution',
      error
    )
    return false
  }
}
