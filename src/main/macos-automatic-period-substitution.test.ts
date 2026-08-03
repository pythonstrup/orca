import { systemPreferences } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { disableMacAutomaticPeriodSubstitution } from './macos-automatic-period-substitution'

vi.mock('electron', () => ({
  systemPreferences: { setUserDefault: vi.fn() }
}))

describe('disableMacAutomaticPeriodSubstitution', () => {
  beforeEach(() => {
    vi.mocked(systemPreferences.setUserDefault).mockClear()
  })

  // Why: startup calls this with no options, so the Electron delegation is the path that ships.
  it('writes through systemPreferences when no writer is injected', () => {
    expect(disableMacAutomaticPeriodSubstitution({ platform: 'darwin' })).toBe(true)
    expect(systemPreferences.setUserDefault).toHaveBeenCalledWith(
      'NSAutomaticPeriodSubstitutionEnabled',
      'boolean',
      false
    )
  })

  it('writes the app-domain override on macOS', () => {
    const setUserDefault = vi.fn()

    expect(disableMacAutomaticPeriodSubstitution({ platform: 'darwin', setUserDefault })).toBe(true)
    expect(setUserDefault).toHaveBeenCalledWith(
      'NSAutomaticPeriodSubstitutionEnabled',
      'boolean',
      false
    )
  })

  it.each(['win32', 'linux'] as const)('does not touch defaults on %s', (platform) => {
    const setUserDefault = vi.fn()

    expect(disableMacAutomaticPeriodSubstitution({ platform, setUserDefault })).toBe(false)
    expect(setUserDefault).not.toHaveBeenCalled()
  })

  it('survives a failing preferences write', () => {
    const warn = vi.fn()
    const setUserDefault = vi.fn(() => {
      throw new Error('defaults unavailable')
    })

    expect(
      disableMacAutomaticPeriodSubstitution({
        platform: 'darwin',
        setUserDefault,
        logger: { warn }
      })
    ).toBe(false)
    expect(warn).toHaveBeenCalled()
  })
})
