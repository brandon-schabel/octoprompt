import { describe, it, expect } from 'bun:test'
import {
    KVKeyEnum,
    KVDefaultValues,
    KvSchemas,
    kvKeyEnumSchema,
    type KVKey,
    type KVValue
} from './kv-store.schemas'
import { globalStateSchema } from './global-state-schema'

describe('KV Store Schemas', () => {
    describe('KVKeyEnum', () => {
        it('should have all expected keys', () => {
            expect(KVKeyEnum.appSettings).toBe('appSettings')
            expect(KVKeyEnum.projectTabs).toBe('projectTabs')
            expect(KVKeyEnum.activeProjectTabId).toBe('activeProjectTabId')
            expect(KVKeyEnum.activeChatId).toBe('activeChatId')
        })

        it('should validate key enum schema', () => {
            Object.values(KVKeyEnum).forEach(key => {
                expect(() => kvKeyEnumSchema.parse(key)).not.toThrow()
            })
        })

        it('should reject invalid keys', () => {
            expect(() => kvKeyEnumSchema.parse('invalidKey')).toThrow()
            expect(() => kvKeyEnumSchema.parse('')).toThrow()
            expect(() => kvKeyEnumSchema.parse(null)).toThrow()
        })
    })

    describe('KVDefaultValues', () => {
        it('should have default values for all keys', () => {
            Object.values(KVKeyEnum).forEach(key => {
                expect(KVDefaultValues[key as KVKey]).toBeDefined()
            })
        })

        it('should have valid default values that pass schema validation', () => {
            // Test appSettings
            expect(() => KvSchemas.appSettings.parse(KVDefaultValues.appSettings)).not.toThrow()

            // Test projectTabs
            expect(() => KvSchemas.projectTabs.parse(KVDefaultValues.projectTabs)).not.toThrow()

            // Test activeProjectTabId
            expect(() => KvSchemas.activeProjectTabId.parse(KVDefaultValues.activeProjectTabId)).not.toThrow()

            // Test activeChatId
            expect(() => KvSchemas.activeChatId.parse(KVDefaultValues.activeChatId)).not.toThrow()
        })

        it('should have sensible default values', () => {
            expect(KVDefaultValues.activeChatId).toBe(-1)
            expect(KVDefaultValues.activeProjectTabId).toBe(1)
            expect(KVDefaultValues.appSettings).toBeDefined()
            expect(KVDefaultValues.appSettings.theme).toBe('light')
            expect(KVDefaultValues.projectTabs).toBeDefined()
            expect(KVDefaultValues.projectTabs.defaultTab).toBeDefined()
        })

        it('should create valid global state from default values', () => {
            const globalState = {
                appSettings: KVDefaultValues.appSettings,
                projectTabs: KVDefaultValues.projectTabs,
                projectActiveTabId: KVDefaultValues.activeProjectTabId,
                activeChatId: KVDefaultValues.activeChatId,
                chatLinkSettings: {}
            }

            expect(() => globalStateSchema.parse(globalState)).not.toThrow()
        })
    })

    describe('KvSchemas', () => {
        it('should validate appSettings schema', () => {
            const validAppSettings = {
                theme: 'dark',
                language: 'en',
                temperature: 0.8,
                maxTokens: 2048
            }

            expect(() => KvSchemas.appSettings.parse(validAppSettings)).not.toThrow()

            // Should work with partial data (defaults should fill in)
            expect(() => KvSchemas.appSettings.parse({ theme: 'dark' })).not.toThrow()
        })

        it('should validate projectTabs schema', () => {
            const validProjectTabs = {
                tab1: {
                    selectedProjectId: 123,
                    editProjectId: -1,
                    editPromptId: -1,
                    selectedFiles: [1, 2, 3],
                    selectedPrompts: [4, 5],
                    ticketId: -1,
                    displayName: 'Test Tab'
                }
            }

            expect(() => KvSchemas.projectTabs.parse(validProjectTabs)).not.toThrow()

            // Should work with empty object
            expect(() => KvSchemas.projectTabs.parse({})).not.toThrow()
        })

        it('should validate activeProjectTabId schema', () => {
            expect(() => KvSchemas.activeProjectTabId.parse(1)).not.toThrow()
            expect(() => KvSchemas.activeProjectTabId.parse(999)).not.toThrow()
            expect(() => KvSchemas.activeProjectTabId.parse(-1)).not.toThrow()

            // Should use default for undefined
            const result = KvSchemas.activeProjectTabId.parse(undefined)
            expect(result).toBe(1)
        })

        it('should validate activeChatId schema', () => {
            expect(() => KvSchemas.activeChatId.parse(1)).not.toThrow()
            expect(() => KvSchemas.activeChatId.parse(999)).not.toThrow()
            expect(() => KvSchemas.activeChatId.parse(-1)).not.toThrow()

            // Should use default for undefined
            const result = KvSchemas.activeChatId.parse(undefined)
            expect(result).toBe(-1)
        })

        it('should reject invalid data types', () => {
            expect(() => KvSchemas.activeProjectTabId.parse('not-a-number')).toThrow()
            expect(() => KvSchemas.activeChatId.parse('not-a-number')).toThrow()
            expect(() => KvSchemas.appSettings.parse('not-an-object')).toThrow()
            expect(() => KvSchemas.projectTabs.parse('not-an-object')).toThrow()
        })
    })

    describe('Type safety', () => {
        it('should have correct type inference for KVValue', () => {
            // These should compile without type errors
            const appSettings: KVValue<'appSettings'> = KVDefaultValues.appSettings
            const projectTabs: KVValue<'projectTabs'> = KVDefaultValues.projectTabs
            const activeTabId: KVValue<'activeProjectTabId'> = KVDefaultValues.activeProjectTabId
            const activeChatId: KVValue<'activeChatId'> = KVDefaultValues.activeChatId

            expect(appSettings).toBeDefined()
            expect(projectTabs).toBeDefined()
            expect(activeTabId).toBeDefined()
            expect(activeChatId).toBeDefined()
        })
    })

    describe('Error handling', () => {
        it('should not crash when creating default values', () => {
            // This test ensures that the initialization doesn't throw
            expect(() => {
                const values = KVDefaultValues
                expect(values).toBeDefined()
            }).not.toThrow()
        })

        it('should handle schema validation errors gracefully', () => {
            // Test that invalid data throws expected errors
            expect(() => KvSchemas.appSettings.parse(null)).toThrow()
            expect(() => KvSchemas.projectTabs.parse(null)).toThrow()
            expect(() => KvSchemas.activeProjectTabId.parse(null)).toThrow()
            expect(() => KvSchemas.activeChatId.parse(null)).toThrow()
        })
    })

    describe('Integration with global state', () => {
        it('should be compatible with global state schema', () => {
            // Create a global state using KV default values
            const globalState = {
                appSettings: KVDefaultValues.appSettings,
                projectTabs: KVDefaultValues.projectTabs,
                projectActiveTabId: KVDefaultValues.activeProjectTabId,
                activeChatId: KVDefaultValues.activeChatId,
                chatLinkSettings: {}
            }

            // Should validate against global state schema
            expect(() => globalStateSchema.parse(globalState)).not.toThrow()
        })

        it('should handle partial updates correctly', () => {
            // Test that partial updates work with the schemas
            const partialAppSettings = { theme: 'dark' as const }
            const result = KvSchemas.appSettings.parse(partialAppSettings)

            expect(result.theme).toBe('dark')
            expect(result.language).toBe('en') // Should have default
        })
    })
}) 