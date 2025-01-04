import picomatch from 'picomatch'

/**
 * Normalize file path separators to forward slashes.
 * On Windows, file paths might have backslashes. picomatch generally
 * expects forward slashes. You can optionally allow backslashes via options.
 */
function normalizePath(filePath: string): string {
    return filePath.replaceAll('\\', '/')
}

/**
 * Checks if filePath matches any of the given glob patterns using picomatch.
 */
export function matchesAnyPattern(
    filePath: string,
    patterns: string[],
    options?: picomatch.PicomatchOptions
): boolean {
    if (!patterns || patterns.length === 0) {
        return false
    }

    const normalized = normalizePath(filePath)
    // Picomatch also provides .isMatch() convenience
    // patterns can be single string or array.
    return picomatch.isMatch(normalized, patterns, options)
}

/**
 * Filters an array of file paths to only those matching the given patterns.
 */
export function filterByPatterns(
    filePaths: string[],
    patterns: string[],
    options?: picomatch.PicomatchOptions
): string[] {
    if (!patterns || patterns.length === 0) {
        return []
    }

    // Normalize all paths
    const normalizedList = filePaths.map(normalizePath)
    // If you want all matches (union) do:
    //   picomatch.list(files, patterns, options) 
    //   isn't built-in, so we do something like:
    return normalizedList.filter((file) => picomatch.isMatch(file, patterns, options))
}