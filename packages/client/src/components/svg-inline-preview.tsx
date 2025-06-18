import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SvgInlinePreviewProps {
  svgContent: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showHoverPreview?: boolean
  background?: 'checkerboard' | 'white' | 'dark' | 'transparent'
}

export function SvgInlinePreview({
  svgContent,
  className,
  size = 'md',
  showHoverPreview = true,
  background = 'checkerboard'
}: SvgInlinePreviewProps) {
  const [isHovered, setIsHovered] = useState(false)
  
  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32'
  }

  const backgroundStyles = {
    checkerboard: {
      backgroundImage: `
        linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
        linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
      `,
      backgroundSize: '10px 10px',
      backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
    },
    white: { backgroundColor: '#ffffff' },
    dark: { backgroundColor: '#1a1a1a' },
    transparent: { backgroundColor: 'transparent' }
  }

  const preview = (
    <div
      className={cn(
        'relative rounded-md border flex items-center justify-center overflow-hidden',
        sizeClasses[size],
        className
      )}
      style={backgroundStyles[background]}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className='w-full h-full flex items-center justify-center p-2'
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  )

  if (!showHoverPreview) {
    return preview
  }

  return (
    <TooltipProvider>
      <Tooltip open={isHovered}>
        <TooltipTrigger asChild>
          {preview}
        </TooltipTrigger>
        <TooltipContent side='right' className='p-0 w-64 h-64'>
          <div
            className='w-full h-full flex items-center justify-center p-4'
            style={{
              ...backgroundStyles.checkerboard,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: svgContent }} />
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface SvgGridPreviewProps {
  svgContents: Array<{
    id: string
    content: string
    name?: string
  }>
  onSelect?: (id: string) => void
  className?: string
  columns?: number
}

export function SvgGridPreview({
  svgContents,
  onSelect,
  className,
  columns = 4
}: SvgGridPreviewProps) {
  return (
    <div 
      className={cn(
        'grid gap-4',
        `grid-cols-${columns}`,
        className
      )}
    >
      {svgContents.map((item) => (
        <div
          key={item.id}
          className='group cursor-pointer'
          onClick={() => onSelect?.(item.id)}
        >
          <SvgInlinePreview
            svgContent={item.content}
            size='md'
            className='group-hover:ring-2 group-hover:ring-primary transition-all'
          />
          {item.name && (
            <p className='text-xs text-center mt-1 text-muted-foreground truncate'>
              {item.name}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}