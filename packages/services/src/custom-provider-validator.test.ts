import { describe, test, expect } from 'bun:test'
import {
  isValidOpenAIUrl,
  normalizeHeaders,
  extractModelCapabilities
} from './custom-provider-validator'

describe('Custom Provider Validator - Pure Functions', () => {
  describe('isValidOpenAIUrl', () => {
    test('should accept valid HTTP URLs', () => {
      expect(isValidOpenAIUrl('http://localhost:1234/v1')).toBe(true)
      expect(isValidOpenAIUrl('http://api.example.com')).toBe(true)
    })
    
    test('should accept valid HTTPS URLs', () => {
      expect(isValidOpenAIUrl('https://api.openai.com/v1')).toBe(true)
      expect(isValidOpenAIUrl('https://custom.provider.io/api/v1')).toBe(true)
    })
    
    test('should reject invalid URLs', () => {
      expect(isValidOpenAIUrl('not-a-url')).toBe(false)
      expect(isValidOpenAIUrl('ftp://example.com')).toBe(false)
      expect(isValidOpenAIUrl('ws://example.com')).toBe(false)
      expect(isValidOpenAIUrl('')).toBe(false)
    })
    
    test('should handle URLs with paths and query strings', () => {
      expect(isValidOpenAIUrl('https://api.example.com/v1/models?limit=10')).toBe(true)
      expect(isValidOpenAIUrl('http://localhost:8080/api/v1#anchor')).toBe(true)
    })
  })
  
  describe('normalizeHeaders', () => {
    test('should normalize header names to proper case', () => {
      const headers = {
        'content-type': 'application/json',
        'x-api-key': 'secret',
        'AUTHORIZATION': 'Bearer token'
      }
      
      const normalized = normalizeHeaders(headers)
      
      expect(normalized).toEqual({
        'Content-Type': 'application/json',
        'X-Api-Key': 'secret',
        'Authorization': 'Bearer token'
      })
    })
    
    test('should handle empty headers', () => {
      expect(normalizeHeaders({})).toEqual({})
      expect(normalizeHeaders(undefined)).toEqual({})
    })
    
    test('should handle single-word headers', () => {
      const headers = {
        'host': 'example.com',
        'accept': '*/*'
      }
      
      const normalized = normalizeHeaders(headers)
      
      expect(normalized).toEqual({
        'Host': 'example.com',
        'Accept': '*/*'
      })
    })
  })
  
  describe('extractModelCapabilities', () => {
    test('should detect vision models', () => {
      expect(extractModelCapabilities('gpt-4-vision-preview').likelySupportsVision).toBe(true)
      expect(extractModelCapabilities('gpt-4-turbo-2024-04-09').likelySupportsVision).toBe(true)
      expect(extractModelCapabilities('claude-3-opus').likelySupportsVision).toBe(false)
      expect(extractModelCapabilities('gemini-pro-vision').likelySupportsVision).toBe(true)
    })
    
    test('should detect models with tool support', () => {
      expect(extractModelCapabilities('gpt-4-0613').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('gpt-3.5-turbo').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('claude-3-sonnet').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('gemini-pro').likelySupportsTools).toBe(true)
      expect(extractModelCapabilities('llama-2-7b').likelySupportsTools).toBe(false)
    })
    
    test('should detect JSON mode support', () => {
      expect(extractModelCapabilities('gpt-4-turbo').likelySupportsJson).toBe(true)
      expect(extractModelCapabilities('gpt-3.5-turbo').likelySupportsJson).toBe(true)
      expect(extractModelCapabilities('text-davinci-003').likelySupportsJson).toBe(false)
      expect(extractModelCapabilities('text-curie-001').likelySupportsJson).toBe(false)
      expect(extractModelCapabilities('text-babbage-001').likelySupportsJson).toBe(false)
    })
    
    test('should handle various model naming conventions', () => {
      const capabilities = extractModelCapabilities('Custom-Model-v2-Vision-Tools')
      expect(capabilities.likelySupportsVision).toBe(true)
      expect(capabilities.likelySupportsTools).toBe(false) // Doesn't match known patterns
      expect(capabilities.likelySupportsJson).toBe(true)
    })
  })
})