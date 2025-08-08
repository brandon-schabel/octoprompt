import { Button } from '@promptliano/ui'
import { FileCode } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@promptliano/ui'
import { getEditorUrl } from '@/utils/editor-urls'
import { GlobalStateEditorType as EditorType } from '@promptliano/schemas'

interface MCPConfigLinkProps {
  configPath: string
  preferredEditor?: EditorType | null
  platformName?: string
  variant?: 'default' | 'ghost' | 'outline' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showLabel?: boolean
  className?: string
}

export function MCPConfigLink({
  configPath,
  preferredEditor,
  platformName,
  variant = 'ghost',
  size = 'sm',
  showLabel = true,
  className
}: MCPConfigLinkProps) {
  const editorName = preferredEditor || 'editor'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant={variant} size={size} className={className} asChild>
            <a href={getEditorUrl(preferredEditor || 'vscode', configPath)} target='_blank' rel='noopener noreferrer'>
              <FileCode className={showLabel ? 'h-4 w-4 mr-2' : 'h-4 w-4'} />
              {showLabel && 'Open Config'}
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Open {platformName ? `${platformName} config` : 'configuration'} in {editorName}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
