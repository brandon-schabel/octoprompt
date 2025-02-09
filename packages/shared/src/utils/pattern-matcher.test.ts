import { describe, it, expect } from 'bun:test'
import {  matchesAnyPattern } from './pattern-matcher'

describe('patternMatcher utility', () => {


    describe('matchesAnyPattern()', () => {
        it('should return false if no patterns', () => {
            expect(matchesAnyPattern('index.ts', [])).toBe(false)
        })

        it('should match a single pattern', () => {
            expect(matchesAnyPattern('app.ts', ['*.ts'])).toBe(true)
            expect(matchesAnyPattern('app.js', ['*.ts'])).toBe(false)
        })

        it('should match multiple patterns (OR logic)', () => {
            const patterns = ['*.js', '*.json']
            expect(matchesAnyPattern('app.js', patterns)).toBe(true)
            expect(matchesAnyPattern('app.json', patterns)).toBe(true)
            expect(matchesAnyPattern('app.ts', patterns)).toBe(false)
        })

        it('should match *.d.ts with patterns containing it', () => {
            const patterns = ['*.d.ts']
            expect(matchesAnyPattern('types.d.ts', patterns)).toBe(true)
            expect(matchesAnyPattern('types.ts', patterns)).toBe(false)
        })

        it('should match config patterns like "*.config.*"', () => {
            const patterns = ['*.config.*']
            expect(matchesAnyPattern('vite.config.ts', patterns)).toBe(true)
            expect(matchesAnyPattern('postcss.config.js', patterns)).toBe(true)
            expect(matchesAnyPattern('postcss.conf.js', patterns)).toBe(false)
        })
    })
})