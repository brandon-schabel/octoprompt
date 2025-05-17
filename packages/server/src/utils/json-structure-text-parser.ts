/**
 * Strips triple backticks and also removes JS/JSON-style comments & trailing commas.
 * Returns the cleaned text.
 */
export function stripTripleBackticks(text: string): string {
  // First remove triple backticks if present
  const tripleBacktickRegex = /```(?:json)?([\s\S]*?)```/
  const match = text.match(tripleBacktickRegex)
  const content = match ? match[1].trim() : text.trim()

  // Remove comments and trailing commas
  return content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replace(/,(\s*[}\]])/g, '$1')
}

/**
 * Extracts top-level (non-overlapping) JSON substrings from the text using a balanced-brackets approach.
 */
export function extractJsonObjects(text: string): string[] {
  const results: string[] = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (char === '{' || char === '[') {
      const start = i
      const stack = [char]
      let inString = false
      let escape = false
      let found = false
      let j = i + 1
      for (; j < text.length; j++) {
        const c = text[j]
        if (inString) {
          if (escape) {
            escape = false
          } else if (c === '\\') {
            escape = true
          } else if (c === '"') {
            inString = false
          }
        } else {
          if (c === '"') {
            inString = true
          } else if (c === '{' || c === '[') {
            stack.push(c)
          } else if (c === '}' || c === ']') {
            stack.pop()
            if (stack.length === 0) {
              const candidate = text.substring(start, j + 1)
              try {
                JSON.parse(candidate)
                results.push(candidate)
              } catch (e) {
                // Ignore invalid JSON substrings.
              }
              found = true
              break
            }
          }
        }
      }
      if (found) {
        i = j // Skip over the entire JSON block to avoid nested extraction.
      }
    }
    i++
  }
  return results
}

/**
 * Attempts to parse the structured JSON from the raw output.
 * First, it tries to parse the cleaned text.
 * If that fails or doesn't yield an object/array, it falls back to extracting
 * the last valid JSON substring from the raw output.
 */
export function parseStructuredJson(rawOutput: string): unknown {
  const cleaned = stripTripleBackticks(rawOutput)
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed
    }
  } catch (e) {
    // Fall through to extraction below.
  }
  const candidates = extractJsonObjects(rawOutput)
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const candidateParsed = JSON.parse(candidates[i])
      if (typeof candidateParsed === 'object' && candidateParsed !== null) {
        return candidateParsed
      }
    } catch (e) {
      // Ignore parse errors.
    }
  }
  return null
}
