import React, { useMemo } from 'react'

/**
 * Represents one "chunk" in a unified text diff.
 * - type: "common" means line unchanged
 * - type: "add" means line added
 * - type: "remove" means line removed
 * - content: the text content for that line
 */
export interface DiffChunk {
  type: 'common' | 'add' | 'remove'
  content: string
}

/**
 * Compute a simplistic line-based diff between two texts.
 *
 * Returns an array of DiffChunk items representing unchanged
 * ("common"), added ("add"), or removed ("remove") lines.
 *
 * Note: This uses a naive "Longest Common Subsequence" approach
 * to produce minimal sets of add/remove lines. It's good enough
 * for simpler diffs but not as feature-complete as big diff libs.
 */
export function computeLineDiff(oldText: string, newText: string): DiffChunk[] {
  // Ensure that empty texts result in an empty array of lines,
  // rather than an array with one empty string.
  const oldLines = oldText === '' ? [] : oldText.split('\n')
  const newLines = newText === '' ? [] : newText.split('\n')

  // Build LCS table
  const lcsTable: number[][] = Array(oldLines.length + 1)
    .fill(null)
    .map(() => Array(newLines.length + 1).fill(0))

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcsTable[i][j] = lcsTable[i - 1][j - 1] + 1
      } else {
        lcsTable[i][j] = Math.max(lcsTable[i - 1][j], lcsTable[i][j - 1])
      }
    }
  }

  // Reconstruct LCS diff
  const diffChunks: DiffChunk[] = []
  let i = oldLines.length
  let j = newLines.length

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      diffChunks.unshift({ type: 'common', content: oldLines[i - 1] })
      i--
      j--
    } else if (lcsTable[i - 1][j] > lcsTable[i][j - 1]) {
      diffChunks.unshift({ type: 'remove', content: oldLines[i - 1] })
      i--
    } else {
      diffChunks.unshift({ type: 'add', content: newLines[j - 1] })
      j--
    }
  }

  // Process any remaining lines
  while (i > 0) {
    diffChunks.unshift({ type: 'remove', content: oldLines[i - 1] })
    i--
  }
  while (j > 0) {
    diffChunks.unshift({ type: 'add', content: newLines[j - 1] })
    j--
  }

  return diffChunks
}
