import { formatShortcut, shortCutMap } from '@/lib/shortcuts'
import { Badge, BadgeProps } from '@ui'

export function AppShortcutDisplay({ shortcut }: { shortcut: keyof typeof shortCutMap }) {
  const display = formatShortcut(shortCutMap[shortcut])
  return <Badge>{display}</Badge>
}

export function ShortcutDisplay({
  shortcut,
  delimiter = ' + ',
  variant = 'default'
}: {
  shortcut: string | string[]
  delimiter?: string
  variant?: BadgeProps['variant']
}) {
  const display = formatShortcut(shortcut, delimiter)
  return <Badge variant={variant}>{display}</Badge>
}
