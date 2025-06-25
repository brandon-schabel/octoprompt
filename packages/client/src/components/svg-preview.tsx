import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { ZoomIn, ZoomOut, Maximize2, Move, RotateCcw, Grid, Square, Download } from 'lucide-react'
import { toast } from 'sonner'

interface SvgPreviewProps {
  svgContent: string
  className?: string
  showControls?: boolean
  initialZoom?: number
  minZoom?: number
  maxZoom?: number
}

type BackgroundType = 'checkerboard' | 'white' | 'black' | 'transparent'

export function SvgPreview({
  svgContent,
  className,
  showControls = true,
  initialZoom = 1,
  minZoom = 0.1,
  maxZoom = 5
}: SvgPreviewProps) {
  const [zoom, setZoom] = useState(initialZoom)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [background, setBackground] = useState<BackgroundType>('checkerboard')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<HTMLDivElement>(null)

  // Extract dimensions from SVG
  useEffect(() => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svg = doc.querySelector('svg')

    if (svg) {
      const width = svg.getAttribute('width') || svg.viewBox?.baseVal?.width || 100
      const height = svg.getAttribute('height') || svg.viewBox?.baseVal?.height || 100
      setDimensions({
        width: typeof width === 'string' ? parseInt(width) : width,
        height: typeof height === 'string' ? parseInt(height) : height
      })
    }
  }, [svgContent])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * delta))
      setZoom(newZoom)
    },
    [zoom, minZoom, maxZoom]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        // Left click only
        setIsDragging(true)
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
      }
    },
    [position]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        })
      }
    },
    [isDragging, dragStart]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const resetView = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  const zoomIn = () => setZoom(Math.min(maxZoom, zoom * 1.2))
  const zoomOut = () => setZoom(Math.max(minZoom, zoom * 0.8))

  const fitToView = () => {
    if (!containerRef.current) return

    const containerWidth = containerRef.current.clientWidth - 40 // padding
    const containerHeight = containerRef.current.clientHeight - 40

    const scaleX = containerWidth / dimensions.width
    const scaleY = containerHeight / dimensions.height
    const scale = Math.min(scaleX, scaleY, 1)

    setZoom(scale)
    setPosition({ x: 0, y: 0 })
  }

  const exportAsPng = async () => {
    try {
      const svg = new Blob([svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(svg)
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = dimensions.width
        canvas.height = dimensions.height
        const ctx = canvas.getContext('2d')

        if (ctx) {
          // Set background based on current background type
          if (background !== 'transparent') {
            ctx.fillStyle = background === 'white' ? '#ffffff' : background === 'black' ? '#000000' : '#f0f0f0'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }

          ctx.drawImage(img, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              const pngUrl = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = pngUrl
              a.download = 'exported.png'
              a.click()
              URL.revokeObjectURL(pngUrl)
              toast.success('Exported as PNG')
            }
          }, 'image/png')
        }
        URL.revokeObjectURL(url)
      }

      img.src = url
    } catch (error) {
      toast.error('Failed to export as PNG')
      console.error(error)
    }
  }

  const backgroundStyles = {
    checkerboard: {
      backgroundImage: `
        linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
        linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
      `,
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
    },
    white: { backgroundColor: '#ffffff' },
    black: { backgroundColor: '#000000' },
    transparent: { backgroundColor: 'transparent' }
  }

  return (
    <div className={cn('relative overflow-hidden rounded-lg border', className)}>
      {showControls && (
        <div className='absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-2 p-2 bg-background/90 backdrop-blur rounded-md border'>
          <div className='flex items-center gap-2'>
            <Button size='icon' variant='ghost' onClick={zoomOut} title='Zoom out'>
              <ZoomOut className='h-4 w-4' />
            </Button>

            <Slider
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
              min={minZoom}
              max={maxZoom}
              step={0.1}
              className='w-32'
            />

            <Button size='icon' variant='ghost' onClick={zoomIn} title='Zoom in'>
              <ZoomIn className='h-4 w-4' />
            </Button>

            <span className='text-xs text-muted-foreground w-12'>{Math.round(zoom * 100)}%</span>

            <div className='h-4 w-px bg-border' />

            <Button size='icon' variant='ghost' onClick={fitToView} title='Fit to view'>
              <Maximize2 className='h-4 w-4' />
            </Button>

            <Button size='icon' variant='ghost' onClick={resetView} title='Reset view'>
              <RotateCcw className='h-4 w-4' />
            </Button>
          </div>

          <div className='flex items-center gap-2'>
            <ToggleGroup
              type='single'
              value={background}
              onValueChange={(value) => value && setBackground(value as BackgroundType)}
              size='sm'
            >
              <ToggleGroupItem value='checkerboard' title='Checkerboard'>
                <Grid className='h-4 w-4' />
              </ToggleGroupItem>
              <ToggleGroupItem value='white' title='White'>
                <Square className='h-4 w-4 fill-white stroke-gray-400' />
              </ToggleGroupItem>
              <ToggleGroupItem value='black' title='Black'>
                <Square className='h-4 w-4 fill-black' />
              </ToggleGroupItem>
              <ToggleGroupItem value='transparent' title='Transparent'>
                <Square className='h-4 w-4 stroke-gray-400' />
              </ToggleGroupItem>
            </ToggleGroup>

            <div className='h-4 w-px bg-border' />

            <Button size='icon' variant='ghost' onClick={exportAsPng} title='Export as PNG'>
              <Download className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}

      <div className='absolute bottom-2 left-2 z-10 px-2 py-1 bg-background/90 backdrop-blur rounded text-xs text-muted-foreground'>
        {dimensions.width} × {dimensions.height}px
      </div>

      <div
        ref={containerRef}
        className='relative w-full h-full flex items-center justify-center'
        style={{
          ...backgroundStyles[background],
          cursor: isDragging ? 'grabbing' : 'grab',
          minHeight: '400px'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={svgRef}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>
    </div>
  )
}
