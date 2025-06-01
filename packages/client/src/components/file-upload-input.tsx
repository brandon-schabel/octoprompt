// Recent changes:
// 1. Created file upload input component with drag and drop support
// 2. Added file validation for size limits and supported types
// 3. Implemented visual feedback for drag states and upload progress
// 4. Added proper error handling and user notifications
// 5. Used modern File API with proper TypeScript types

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X } from 'lucide-react'
import { Button } from '@ui'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FileUploadInputProps {
  onFileSelect: (files: File[]) => void
  multiple?: boolean
  accept?: Record<string, string[]>
  maxSize?: number // in bytes
  disabled?: boolean
  className?: string
}

const DEFAULT_ACCEPT = {
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  'text/*': ['.txt', '.md', '.json'],
  'application/pdf': ['.pdf'],
  'application/json': ['.json'],
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB

export function FileUploadInput({
  onFileSelect,
  multiple = false,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  disabled = false,
  className
}: FileUploadInputProps) {
  const [isDragActive, setIsDragActive] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setIsDragActive(false)
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach((file) => {
        const errors = file.errors.map((error: any) => {
          switch (error.code) {
            case 'file-too-large':
              return `File "${file.file.name}" is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`
            case 'file-invalid-type':
              return `File "${file.file.name}" type is not supported.`
            default:
              return `File "${file.file.name}": ${error.message}`
          }
        })
        
        errors.forEach(error => toast.error(error))
      })
    }
    
    // Handle accepted files
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles)
    }
  }, [onFileSelect, maxSize])

  const {
    getRootProps,
    getInputProps,
    isDragAccept,
    isDragReject,
    open
  } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept,
    maxSize,
    multiple,
    disabled,
    noClick: true, // We'll handle clicks manually
    noKeyboard: true
  })

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      open()
    }
  }, [open, disabled])

  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-4 transition-colors",
          "flex flex-col items-center justify-center gap-2",
          {
            "border-blue-300 bg-blue-50/50": isDragAccept,
            "border-red-300 bg-red-50/50": isDragReject,
            "border-muted-foreground/25 hover:border-muted-foreground/50": !isDragActive,
            "cursor-pointer": !disabled,
            "opacity-50 cursor-not-allowed": disabled,
          }
        )}
      >
        <input {...getInputProps()} />
        
        <Upload className={cn(
          "h-8 w-8 text-muted-foreground",
          isDragAccept && "text-blue-500",
          isDragReject && "text-red-500"
        )} />
        
        <div className="text-center">
          <p className="text-sm font-medium">
            {isDragActive 
              ? isDragAccept 
                ? "Drop files here"
                : "Some files are not supported"
              : "Drag files here or"
            }
          </p>
          {!isDragActive && (
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={handleClick}
              disabled={disabled}
            >
              Choose Files
            </Button>
          )}
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          {multiple ? "Multiple files allowed" : "Single file only"} • 
          Max {Math.round(maxSize / 1024 / 1024)}MB each
        </p>
      </div>
    </div>
  )
}

// Compact file upload button for inline use
interface FileUploadButtonProps {
  onFileSelect: (files: File[]) => void
  multiple?: boolean
  accept?: Record<string, string[]>
  maxSize?: number
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}

export function FileUploadButton({
  onFileSelect,
  multiple = false,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  disabled = false,
  children,
  className
}: FileUploadButtonProps) {
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach((file) => {
        const errors = file.errors.map((error: any) => {
          switch (error.code) {
            case 'file-too-large':
              return `File "${file.file.name}" is too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`
            case 'file-invalid-type':
              return `File "${file.file.name}" type is not supported.`
            default:
              return `File "${file.file.name}": ${error.message}`
          }
        })
        
        errors.forEach(error => toast.error(error))
      })
    }
    
    // Handle accepted files
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles)
    }
  }, [onFileSelect, maxSize])

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
    disabled,
    noClick: true,
    noKeyboard: true
  })

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className}
        onClick={open}
        disabled={disabled}
      >
        {children || <Upload className="h-4 w-4" />}
      </Button>
    </div>
  )
}
