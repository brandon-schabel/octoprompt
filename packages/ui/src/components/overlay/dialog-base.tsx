import React from 'react'
import { cn } from '../../utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../core/dialog'
import { Button } from '../core/button'
import { type LucideIcon, Loader2, X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'

export interface DialogAction {
  label: string
  onClick: () => void | Promise<void>
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  icon?: LucideIcon | React.ComponentType<{ className?: string }>
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  className?: string
}

export interface DialogBaseProps {
  title: string
  description?: string
  icon?: LucideIcon | React.ComponentType<{ className?: string }>
  iconClassName?: string
  isOpen: boolean
  onClose: () => void
  preventOutsideClick?: boolean
  preventEscapeClose?: boolean
  isSubmitting?: boolean
  actions?: DialogAction[] | React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  headerClassName?: string
  contentClassName?: string
  footerClassName?: string
  showCloseButton?: boolean
  children: React.ReactNode
}

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  full: 'sm:max-w-[90vw]'
}

export function DialogBase({
  title,
  description,
  icon: Icon,
  iconClassName,
  isOpen,
  onClose,
  preventOutsideClick = false,
  preventEscapeClose = false,
  isSubmitting = false,
  actions,
  size = 'md',
  className,
  headerClassName,
  contentClassName,
  footerClassName,
  showCloseButton = true,
  children
}: DialogBaseProps) {
  const handleInteractOutside = (e: Event) => {
    if (preventOutsideClick || isSubmitting) {
      e.preventDefault()
    }
  }

  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    if (preventEscapeClose || isSubmitting) {
      e.preventDefault()
    }
  }

  const renderActions = () => {
    if (!actions) return null

    if (React.isValidElement(actions)) {
      return actions
    }

    if (Array.isArray(actions)) {
      return (
        <div className='flex gap-2 justify-end'>
          {actions.map((action, index) => {
            const ActionIcon = action.icon
            const isLoading = action.loading || (index === 0 && isSubmitting)
            
            return (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? 'default' : 'outline')}
                onClick={action.onClick}
                disabled={action.disabled || isLoading || isSubmitting}
                className={action.className}
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {action.loadingText || 'Loading...'}
                  </>
                ) : (
                  <>
                    {ActionIcon && <ActionIcon className='mr-2 h-4 w-4' />}
                    {action.label}
                  </>
                )}
              </Button>
            )
          })}
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(sizeClasses[size], className)}
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={handleEscapeKeyDown}
      >
        {showCloseButton && !isSubmitting && (
          <button
            onClick={onClose}
            className='absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground'
            disabled={isSubmitting}
          >
            <X className='h-4 w-4' />
            <span className='sr-only'>Close</span>
          </button>
        )}
        
        <DialogHeader className={headerClassName}>
          <div className='flex items-start gap-3'>
            {Icon && (
              <div className={cn('mt-0.5', iconClassName)}>
                <Icon className='h-5 w-5' />
              </div>
            )}
            <div className='flex-1'>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className='mt-1.5'>
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className={cn('py-4', contentClassName)}>
          {children}
        </div>

        {actions && (
          <DialogFooter className={footerClassName}>
            {renderActions()}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Specialized variant for form dialogs
export interface FormDialogProps extends Omit<DialogBaseProps, 'actions' | 'children'> {
  onSubmit: (e: React.FormEvent) => void | Promise<void>
  submitLabel?: string
  cancelLabel?: string
  children: React.ReactNode
}

export function FormDialog({
  onSubmit,
  onClose,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  isSubmitting,
  ...props
}: FormDialogProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(e)
  }

  return (
    <DialogBase
      {...props}
      onClose={onClose}
      isSubmitting={isSubmitting}
      preventOutsideClick={isSubmitting}
      preventEscapeClose={isSubmitting}
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        {props.children}
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={onClose}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
          <Button type='submit' disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Loading...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogBase>
  )
}

// Specialized variant for confirmation dialogs
export interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info' | 'success'
  isConfirming?: boolean
}

const variantIcons = {
  danger: { icon: AlertTriangle, className: 'text-destructive' },
  warning: { icon: AlertCircle, className: 'text-yellow-600' },
  info: { icon: Info, className: 'text-blue-600' },
  success: { icon: CheckCircle, className: 'text-green-600' }
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'info',
  isConfirming = false
}: ConfirmationDialogProps) {
  const { icon, className } = variantIcons[variant]
  
  const confirmVariant = variant === 'danger' ? 'destructive' : 'default'

  return (
    <DialogBase
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={message}
      icon={icon}
      iconClassName={className}
      isSubmitting={isConfirming}
      actions={[
        {
          label: cancelLabel,
          onClick: onClose,
          variant: 'outline',
          disabled: isConfirming
        },
        {
          label: confirmLabel,
          onClick: onConfirm,
          variant: confirmVariant,
          loading: isConfirming,
          loadingText: 'Processing...'
        }
      ]}
      size='sm'
    >
      {/* Empty children as content is in description */}
      <div />
    </DialogBase>
  )
}