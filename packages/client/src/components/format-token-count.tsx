import { estimateTokenCount } from '@octoprompt/shared/src/utils/file-tree-utils/file-node-tree-utils'
import { useMemo } from 'react'
import { clsx } from 'clsx'
import { formatTokenCount } from '@octoprompt/shared/src/utils/file-tree-utils/file-node-tree-utils'

/** Formats and displays the token count for given content, color-coding it based on thresholds. */
export const FormatTokenCount = ({ tokenContent }: { tokenContent: string | number }) => {
  const tokenCount = useMemo(() => {
    if (typeof tokenContent === 'string') {
      return estimateTokenCount(tokenContent)
    }
    return tokenContent
  }, [tokenContent])

  return (
    <span
      className={clsx('flex-shrink-0 text-xs text-muted-foreground', {
        'text-red-500': tokenCount > 3000,
        'text-yellow-500': tokenCount > 1500 && tokenCount < 3000,
        'text-green-500': tokenCount < 1500
      })}
    >
      {formatTokenCount(tokenCount)}
    </span>
  )
}
