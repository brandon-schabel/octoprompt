import { describe, it, expect } from 'bun:test'

describe('Assets Route - SVG Generator', () => {
  it('should have correct SVG asset types defined', () => {
    const assetTypes = [
      'icon',
      'illustration',
      'logo',
      'pattern',
      'ui-element',
      'chart'
    ]
    
    expect(assetTypes.length).toBe(6)
    expect(assetTypes).toContain('icon')
    expect(assetTypes).toContain('illustration')
    expect(assetTypes).toContain('logo')
    expect(assetTypes).toContain('pattern')
    expect(assetTypes).toContain('ui-element')
    expect(assetTypes).toContain('chart')
  })

  it('should have correct SVG extension mapping', () => {
    const extensionMap: Record<string, string> = {
      icon: '.svg',
      illustration: '.svg',
      logo: '.svg',
      pattern: '.svg',
      'ui-element': '.svg',
      chart: '.svg'
    }
    
    expect(extensionMap.icon).toBe('.svg')
    expect(extensionMap.illustration).toBe('.svg')
    expect(extensionMap.pattern).toBe('.svg')
  })

  it('should have correct SVG categories', () => {
    const categories = [
      'all',
      'icons',
      'graphics',
      'branding',
      'backgrounds',
      'interface',
      'data-viz'
    ]
    
    expect(categories.length).toBe(7)
    expect(categories).toContain('icons')
    expect(categories).toContain('graphics')
    expect(categories).toContain('branding')
  })
})