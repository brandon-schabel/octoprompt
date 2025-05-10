import { formatShortcut, shortCutMap } from "@/lib/shortcuts"
import { Badge } from '@ui'


export function AppShortcutDisplay({
    shortcut,
}: {
    shortcut: keyof typeof shortCutMap
}) {
    const display = formatShortcut(shortCutMap[shortcut])
    return <Badge>{display}</Badge>
}

export function ShortcutDisplay({
    shortcut,
    delimiter = ' + ',
}: {
    shortcut: string | string[]
    delimiter?: string
}) {
    const display = formatShortcut(shortcut, delimiter)
    return <Badge>{display}</Badge>
}

