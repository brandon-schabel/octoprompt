import React from 'react'
import { DocumentationGeneratorDialog } from './documentation-generator-dialog'
import { AssetGeneratorDialog } from './asset-generator-dialog'

interface AssetGeneratorWrapperProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetType: string | null
  projectContext?: {
    name?: string
    description?: string
  }
  onSuccess?: (generatedContent: string, name: string) => void
}

// Mapping from old asset types to new documentation types
const assetTypeMapping: Record<string, string> = {
  'architecture-doc': 'architecture-doc',
  'mermaid-diagram': 'mermaid-diagram',
  'project-documentation': 'project-readme',
  'api-doc': 'api-documentation',
  'database-doc': 'database-schema',
  'user-guide': 'user-guide',
  // SVG types still use old generator
  icon: 'svg',
  illustration: 'svg',
  logo: 'svg',
  pattern: 'svg',
  'ui-element': 'svg',
  chart: 'svg'
}

/**
 * Wrapper component that routes to either the new documentation generator
 * or the old asset generator based on the asset type
 */
export function AssetGeneratorWrapper({
  open,
  onOpenChange,
  assetType,
  projectContext,
  onSuccess
}: AssetGeneratorWrapperProps) {
  if (!assetType) return null

  const mappedType = assetTypeMapping[assetType]
  const isDocumentation = mappedType && mappedType !== 'svg'

  if (isDocumentation) {
    return (
      <DocumentationGeneratorDialog
        open={open}
        onOpenChange={onOpenChange}
        documentationType={mappedType}
        projectContext={{
          name: projectContext?.name || 'Project',
          description: projectContext?.description
        }}
        onSuccess={onSuccess}
      />
    )
  }

  // Fall back to old asset generator for SVG types
  return <AssetGeneratorDialog open={open} onOpenChange={onOpenChange} assetType={assetType} onSuccess={onSuccess} />
}
