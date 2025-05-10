export function isMacOS(): boolean {
    if (typeof window === 'undefined') return false
    return navigator.platform.toLowerCase().includes('mac')
}

const MODIFIER_KEY_MAP = {
    command: '⌘',
    cmd: '⌘',
    ctrl: '^',
    control: '^',
    alt: '⌥',
    option: '⌥',
    shift: '⇧',
    super: '⌘',
    meta: '⌘',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    backspace: '⌫',
    delete: '⌦',
} satisfies Record<string, string>

export type ModifierKey = keyof typeof MODIFIER_KEY_MAP

function toDisplayKey(rawKey: string): string {
    const lower = rawKey.toLowerCase().trim()

    if (lower === 'mod') {
        return isMacOS() ? '⌘' : '^'
    }

    if (MODIFIER_KEY_MAP[lower as ModifierKey]) {
        return MODIFIER_KEY_MAP[lower as ModifierKey]
    }

    // Otherwise just uppercase normal keys
    return rawKey.toUpperCase()
}

export function formatShortcut(
    shortcut: string | string[],
    delimiter = ' + ',
): string {
    const parts = Array.isArray(shortcut) ? shortcut : shortcut.split('+')
    const mapped = parts.map(toDisplayKey)
    return mapped.join(delimiter)
}

export const shortCutMap = {
    // Global Navigation
    'open-command-palette': ['mod', 'k'],
    'open-help': ['mod', '/'],
    'focus-file-search': ['mod', 'f'],
    'focus-file-tree': ['mod', 'g'],
    'focus-prompts': ['mod', 'p'],
    'focus-prompt-input': ['mod', 'i'],
    'toggle-voice-input': ['v'],

    // File Search & Autocomplete
    'close-suggestions': ['esc'],

    // File Tree
    'navigate-left': ['left'],
    'navigate-right': ['right'],
    'navigate-up': ['up'],
    'navigate-down': ['down'],
    'select-file': ['space'],
    'select-folder': ['enter'],

    // Tab Management
    'switch-next-project-tab': ['t', 'tab'],
    'switch-previous-project-tab': ['t', 'shift', 'tab'],
    'switch-next-chat-tab': ['c', 'tab'],
    'switch-previous-chat-tab': ['c', 'shift', 'tab'],

    // General Controls
    'undo': ['mod', 'z'],
    'redo': ['mod', 'shift', 'z'],
} satisfies Record<string, Array<ModifierKey | string>>
