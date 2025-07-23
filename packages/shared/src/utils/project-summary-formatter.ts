import type { ProjectFile } from '@octoprompt/schemas'

/**
 * Helper function to escape characters unsafe for XML content.
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      case '"':
        return '&quot;'
      // Should not happen with the regex, but ensures function returns string
      default:
        return c
    }
  })
}

/**
 * Optional configuration interface to control XML output.
 */
export interface SummaryXmlOptions {
  /** Whether to include <file> elements for files with no summary text. */
  includeEmptySummaries?: boolean
  /** Placeholder text for empty summaries when includeEmptySummaries is true. */
  emptySummaryText?: string
}

// Define default options for the XML generation
const defaultXmlOptions: Required<SummaryXmlOptions> = {
  includeEmptySummaries: false,
  emptySummaryText: '(No summary provided)'
}

/**
 * Helper function to get a human-readable description of a file type based on its extension
 */
function getFileTypeDescription(extension: string): string {
  const fileTypeMap: Record<string, string> = {
    // Programming languages
    'ts': 'TypeScript',
    'tsx': 'TypeScript React',
    'js': 'JavaScript',
    'jsx': 'JavaScript React',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'cs': 'C#',
    'go': 'Go',
    'rs': 'Rust',
    'php': 'PHP',
    'rb': 'Ruby',
    'swift': 'Swift',
    'kt': 'Kotlin',
    
    // Web files
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'less': 'Less',
    'vue': 'Vue',
    'svelte': 'Svelte',
    
    // Data/Config files
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'xml': 'XML',
    'toml': 'TOML',
    'ini': 'INI config',
    'env': 'Environment config',
    
    // Documentation
    'md': 'Markdown',
    'mdx': 'MDX',
    'rst': 'reStructuredText',
    'txt': 'Text',
    
    // Other
    'sql': 'SQL',
    'sh': 'Shell script',
    'bash': 'Bash script',
    'ps1': 'PowerShell',
    'dockerfile': 'Dockerfile',
    'gitignore': 'Git ignore',
    'lock': 'Lock file',
    'log': 'Log',
    'test': 'Test',
    'spec': 'Test specification'
  }
  
  return fileTypeMap[extension] || 'Unknown type'
}

/**
 * Combines all file summaries into a single XML string.
 * Each file is represented by a <file> element containing <name> and <summary>.
 *
 * Example Output:
 * <summary_memory>
 * <file>
 * <name>src/utils.ts</name>
 * <summary>Contains utility functions for string manipulation.</summary>
 * </file>
 * <file>
 * <name>README.md</name>
 * <summary>Project documentation.</summary>
 * </file>
 * </summary_memory>
 */
export function buildCombinedFileSummariesXml(files: ProjectFile[], options: SummaryXmlOptions = {}): string {
  // Merge provided options with defaults
  const { includeEmptySummaries, emptySummaryText } = {
    ...defaultXmlOptions,
    ...options
  }

  // Handle the case where no files are provided
  if (!files.length) {
    // Return an empty root element, which is more idiomatic for XML
    return '<summary_memory>\n</summary_memory>'
  }

  // Start the root XML element
  let output = '<summary_memory>\n'

  for (const file of files) {
    const summaryContent = file.summary?.trim()

    // Skip files with empty summaries if not configured to include them
    if (!summaryContent && !includeEmptySummaries) {
      continue
    }

    // Start the <file> element for this file
    output += '  <file>\n' // Indentation for readability

    output += `    <file_id>${file.id}</file_id>\n`

    // Add the <name> element, escaping the file name
    output += `    <name>${escapeXml(file.name)}</name>\n`

    // Add the <summary> element, escaping the content
    // Use enhanced placeholder text if summary is empty but included
    let summaryTextToInclude = summaryContent
    if (!summaryContent) {
      // Provide more context for files without summaries
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'unknown'
      const fileTypeDesc = getFileTypeDescription(fileExt)
      summaryTextToInclude = `${fileTypeDesc} file (${file.size ? `${file.size} bytes` : 'size unknown'}). No AI summary available yet.`
    }
    output += `    <summary>${escapeXml(summaryTextToInclude || '')}</summary>\n`

    // Add imports if available
    if (file.imports && file.imports.length > 0) {
      output += '    <imports>\n'
      for (const imp of file.imports) {
        output += '      <import>\n'
        output += `        <source>${escapeXml(imp.source)}</source>\n`
        if (imp.specifiers.length > 0) {
          output += '        <specifiers>\n'
          for (const spec of imp.specifiers) {
            output += `          <specifier type="${spec.type}">`
            if (spec.imported) {
              output += `<imported>${escapeXml(spec.imported)}</imported>`
            }
            output += `<local>${escapeXml(spec.local)}</local>`
            output += '</specifier>\n'
          }
          output += '        </specifiers>\n'
        }
        output += '      </import>\n'
      }
      output += '    </imports>\n'
    }

    // Add exports if available
    if (file.exports && file.exports.length > 0) {
      output += '    <exports>\n'
      for (const exp of file.exports) {
        output += `      <export type="${exp.type}">`
        if (exp.source) {
          output += `<source>${escapeXml(exp.source)}</source>`
        }
        if (exp.specifiers && exp.specifiers.length > 0) {
          output += '<specifiers>'
          for (const spec of exp.specifiers) {
            output += '<specifier>'
            output += `<exported>${escapeXml(spec.exported)}</exported>`
            if (spec.local) {
              output += `<local>${escapeXml(spec.local)}</local>`
            }
            output += '</specifier>'
          }
          output += '</specifiers>'
        }
        output += '</export>\n'
      }
      output += '    </exports>\n'
    }

    // Close the <file> element
    output += '  </file>\n'
  }

  // Close the root XML element
  output += '</summary_memory>'

  return output
}

export const buildProjectSummary = (includedFiles: ProjectFile[]) => {
  // Build the combined summaries using your summary-formatter
  return buildCombinedFileSummariesXml(includedFiles, {
    includeEmptySummaries: true
  })
}
