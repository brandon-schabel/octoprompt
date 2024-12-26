export const isMacOS = () => {
    if (typeof window === 'undefined') return false
    return navigator.platform.toLowerCase().includes('mac')
}

export const getModKeySymbol = () => isMacOS() ? '⌘' : 'Ctrl'

export const shiftSymbol = '⇧'
export const modSymbol = getModKeySymbol()


export const formatModShortcut = (key: string) => {
    const modKey = getModKeySymbol()
    return `${modKey} + ${key.toUpperCase()}`
} 