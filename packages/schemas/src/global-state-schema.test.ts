import { describe, it, expect, beforeEach } from 'bun:test'
import {
  createInitialGlobalState,
  createSafeGlobalState,
  validateAndRepairGlobalState,
  getDefaultAppSettings,
  getDefaultProjectTabState,
  globalStateSchema,
  projectTabStateSchema,
  appSettingsSchema
} from './global-state-schema'

describe('Global State Schema', () => {
  describe('createInitialGlobalState', () => {
    it('should create valid initial global state', () => {
      const state = createInitialGlobalState()

      expect(state).toBeDefined()
      expect(state.appSettings).toBeDefined()
      expect(state.projectTabs).toBeDefined()
      expect(state.projectActiveTabId).toBe(1)
      expect(state.activeChatId).toBe(-1)
      expect(state.chatLinkSettings).toEqual({})

      // Validate against schema
      expect(() => globalStateSchema.parse(state)).not.toThrow()
    })

    it('should create state with valid project tab', () => {
      const state = createInitialGlobalState()
      const defaultTab = state.projectTabs.defaultTab

      expect(defaultTab).toBeDefined()
      if (defaultTab) {
        expect(defaultTab.selectedProjectId).toBe(-1)
        expect(defaultTab.editProjectId).toBe(-1)
        expect(defaultTab.editPromptId).toBe(-1)
        expect(defaultTab.selectedFiles).toEqual([])
        expect(defaultTab.selectedPrompts).toEqual([])
        expect(defaultTab.displayName).toBe('Default Project Tab')

        // Validate against schema
        expect(() => projectTabStateSchema.parse(defaultTab)).not.toThrow()
      }
    })

    it('should create state with valid app settings', () => {
      const state = createInitialGlobalState()
      const appSettings = state.appSettings

      expect(appSettings).toBeDefined()
      expect(appSettings.theme).toBe('light')
      expect(appSettings.language).toBe('en')
      expect(appSettings.provider).toBeDefined()
      expect(appSettings.model).toBeDefined()

      // Validate against schema
      expect(() => appSettingsSchema.parse(appSettings)).not.toThrow()
    })
  })

  describe('createSafeGlobalState', () => {
    it('should create valid safe global state', () => {
      const state = createSafeGlobalState()

      expect(state).toBeDefined()
      expect(() => globalStateSchema.parse(state)).not.toThrow()
    })

    it('should have all required fields with safe defaults', () => {
      const state = createSafeGlobalState()

      // Check app settings
      expect(state.appSettings.language).toBe('en')
      expect(state.appSettings.theme).toBe('light')
      expect(state.appSettings.temperature).toBe(0.7)
      expect(state.appSettings.maxTokens).toBe(10000)

      // Check project tab
      const defaultTab = state.projectTabs.defaultTab
      expect(defaultTab).toBeDefined()
      if (defaultTab) {
        expect(defaultTab.selectedProjectId).toBe(-1)
        expect(defaultTab.selectedFiles).toEqual([])
        expect(defaultTab.selectedPrompts).toEqual([])
        expect(defaultTab.displayName).toBe('Default Project Tab')
      }
    })
  })

  describe('validateAndRepairGlobalState', () => {
    it('should return valid state unchanged', () => {
      const validState = createInitialGlobalState()
      const result = validateAndRepairGlobalState(validState)

      expect(result).toEqual(validState)
    })

    it('should repair partially invalid state', () => {
      const partialState = {
        appSettings: { theme: 'dark' },
        projectTabs: {},
        projectActiveTabId: 2
        // Missing activeChatId and chatLinkSettings
      }

      const result = validateAndRepairGlobalState(partialState)

      expect(result).toBeDefined()
      expect(result.activeChatId).toBe(-1)
      expect(result.chatLinkSettings).toEqual({})
      expect(result.appSettings.theme).toBe('dark')
      expect(result.projectActiveTabId).toBe(2)
      expect(() => globalStateSchema.parse(result)).not.toThrow()
    })

    it('should handle completely invalid state', () => {
      const invalidState = { invalid: 'data' }
      const result = validateAndRepairGlobalState(invalidState)

      expect(result).toBeDefined()
      expect(() => globalStateSchema.parse(result)).not.toThrow()
    })

    it('should handle null/undefined state', () => {
      expect(() => validateAndRepairGlobalState(null)).not.toThrow()
      expect(() => validateAndRepairGlobalState(undefined)).not.toThrow()

      const nullResult = validateAndRepairGlobalState(null)
      const undefinedResult = validateAndRepairGlobalState(undefined)

      expect(() => globalStateSchema.parse(nullResult)).not.toThrow()
      expect(() => globalStateSchema.parse(undefinedResult)).not.toThrow()
    })

    it('should handle state with invalid project tab', () => {
      const stateWithInvalidTab = {
        appSettings: createSafeGlobalState().appSettings,
        projectTabs: {
          invalidTab: {
            // Missing required fields
            displayName: 'Invalid Tab'
          }
        },
        projectActiveTabId: 1,
        activeChatId: -1,
        chatLinkSettings: {}
      }

      const result = validateAndRepairGlobalState(stateWithInvalidTab)
      expect(() => globalStateSchema.parse(result)).not.toThrow()
    })
  })

  describe('getDefaultAppSettings', () => {
    it('should return valid app settings', () => {
      const settings = getDefaultAppSettings()

      expect(settings).toBeDefined()
      expect(() => appSettingsSchema.parse(settings)).not.toThrow()
      expect(settings.theme).toBe('light')
      expect(settings.language).toBe('en')
    })
  })

  describe('getDefaultProjectTabState', () => {
    it('should return valid project tab state with default name', () => {
      const tabState = getDefaultProjectTabState()

      expect(tabState).toBeDefined()
      expect(() => projectTabStateSchema.parse(tabState)).not.toThrow()
      expect(tabState.displayName).toBe('Default Project Tab')
      expect(tabState.selectedProjectId).toBe(-1)
      expect(tabState.selectedFiles).toEqual([])
    })

    it('should return valid project tab state with custom name', () => {
      const customName = 'Custom Tab Name'
      const tabState = getDefaultProjectTabState(customName)

      expect(tabState.displayName).toBe(customName)
      expect(() => projectTabStateSchema.parse(tabState)).not.toThrow()
    })
  })

  describe('Schema validation edge cases', () => {
    it('should handle project tab with missing required fields', () => {
      const partialTab = {
        displayName: 'Test Tab'
        // Missing other fields - should use defaults
      }

      // Should not throw and should fill in defaults
      const result = projectTabStateSchema.parse(partialTab)
      expect(result.displayName).toBe('Test Tab')
      expect(result.selectedProjectId).toBe(-1)
      expect(result.selectedFiles).toEqual([])
      expect(result.editProjectId).toBe(-1)

      // Should also work when parsing empty object
      const validTab = projectTabStateSchema.parse({})
      expect(validTab.selectedProjectId).toBe(-1)
      expect(validTab.selectedFiles).toEqual([])
    })

    it('should handle app settings with missing fields', () => {
      const partialSettings = { theme: 'dark' }
      const validSettings = appSettingsSchema.parse(partialSettings)

      expect(validSettings.theme).toBe('dark')
      expect(validSettings.language).toBe('en') // Should use default
      expect(validSettings.temperature).toBe(0.7) // Should use default
      expect(validSettings.maxTokens).toBe(10000) // Should use default
    })

    it('should validate ID fields correctly', () => {
      const tabWithValidIds = {
        selectedProjectId: Date.now(),
        editProjectId: 1234567890000,
        editPromptId: -1, // -1 should be valid
        ticketId: -1 // -1 should be valid
      }

      expect(() => projectTabStateSchema.parse(tabWithValidIds)).not.toThrow()
    })

    it('should reject invalid ID values', () => {
      const tabWithInvalidId = {
        selectedProjectId: 'invalid-id'
      }

      expect(() => projectTabStateSchema.parse(tabWithInvalidId)).toThrow()

      // Should also reject invalid numbers (not -1 and not valid timestamp)
      const tabWithInvalidNumber = {
        selectedProjectId: -2 // Invalid: not -1 and not positive
      }

      expect(() => projectTabStateSchema.parse(tabWithInvalidNumber)).toThrow()
    })
  })

  describe('Error handling and recovery', () => {
    it('should not crash when schema parsing fails', () => {
      // Mock console.error to avoid noise in tests
      const originalError = console.error
      console.error = () => {}

      try {
        // This should not throw even if internal parsing fails
        const result = validateAndRepairGlobalState('completely-invalid')
        expect(result).toBeDefined()
        expect(() => globalStateSchema.parse(result)).not.toThrow()
      } finally {
        console.error = originalError
      }
    })

    it('should preserve valid data during repair', () => {
      const mixedState = {
        appSettings: {
          theme: 'dark',
          language: 'es',
          invalidField: 'should-be-ignored'
        },
        projectTabs: {
          validTab: {
            displayName: 'Valid Tab',
            selectedProjectId: 123,
            selectedFiles: [1, 2, 3]
          }
        },
        projectActiveTabId: 5,
        activeChatId: 10,
        invalidTopLevel: 'ignored'
      }

      const result = validateAndRepairGlobalState(mixedState)

      // Should preserve valid data
      expect(result.appSettings.theme).toBe('dark')
      expect(result.appSettings.language).toBe('es')
      expect(result.projectActiveTabId).toBe(5)
      expect(result.activeChatId).toBe(10)

      // Should be valid overall
      expect(() => globalStateSchema.parse(result)).not.toThrow()
    })
  })
})
