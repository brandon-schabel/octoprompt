import type { ProjectFile } from '@promptliano/schemas'

export interface SummarizationContext {
  fileType?: string
  projectContext?: string
  relatedFiles?: Array<{ name: string; summary?: string }>
  importsContext?: string
  exportsContext?: string
  wasTruncated?: boolean
}

export interface PromptConfig {
  depth: 'minimal' | 'standard' | 'detailed'
  format: 'structured' | 'narrative' | 'technical'
  includeExamples?: boolean
  useChainOfThought?: boolean
}

/**
 * Advanced prompt templates for file summarization optimized for GPT-OSS-20B
 */
export class SummarizationPrompts {
  /**
   * Generate a structured output format prompt
   */
  static getStructuredPrompt(file: ProjectFile, context: SummarizationContext): string {
    return `# Code File Analysis Task

You are analyzing source code to generate a comprehensive summary. Follow this exact structure:

## File Information
- Path: ${file.path}
- Type: ${file.extension || 'unknown'}
- Size: ${file.size} bytes
${context.wasTruncated ? '- Note: File was truncated for analysis' : ''}

## Analysis Requirements:
1. **Purpose**: One sentence describing the file's primary purpose
2. **Type**: [Component|Service|Utility|Config|Test|Interface|Model|Other]
3. **Dependencies**: List key imports (max 5 most important)
4. **Exports**: List all public exports with brief descriptions
5. **Key Functions**: Document main functions/methods with signatures
6. **Patterns**: Identify design patterns and architectural decisions
7. **Relationships**: How this file connects to the system

${
  context.relatedFiles && context.relatedFiles.length > 0
    ? `
## Related Files Context:
${context.relatedFiles.map((f) => `- ${f.name}: ${f.summary || 'No summary available'}`).join('\n')}
`
    : ''
}

## Output Format (use exactly this structure):
PURPOSE: <one line description>
TYPE: <file type>
DEPS: <comma-separated key dependencies>
EXPORTS:
- <export_name>: <brief description>
KEY_FUNCS:
- <function_signature>: <what it does>
PATTERNS: <patterns used>
RELATES: <system relationships>

## File Content:
\`\`\`${file.extension}
${file.content}
\`\`\`

Provide a concise, accurate summary following the exact structure above.`
  }

  /**
   * Generate a chain-of-thought reasoning prompt
   */
  static getChainOfThoughtPrompt(file: ProjectFile, context: SummarizationContext): string {
    return `Analyze this code file step by step to create a comprehensive summary.

File: ${file.path}
${context.projectContext ? `Project Context: ${context.projectContext}` : ''}

Step 1: Identify the file's domain and purpose
- Look at the file name, path, and top-level structure
- Determine if it's UI, API, database, utility, etc.
- What problem does this file solve?

Step 2: Analyze dependencies
${context.importsContext || 'Examine what this file imports to understand its dependencies'}
- Which external libraries are used?
- What internal modules does it depend on?
- Are there any circular dependencies to note?

Step 3: Examine exports and public API
${context.exportsContext || 'Identify what this file exports to other modules'}
- What functions, classes, or constants are exported?
- What is the intended public interface?
- Are there any default exports?

Step 4: Understand internal implementation
- What are the key algorithms or logic flows?
- Are there any performance considerations?
- What error handling is implemented?

Step 5: Determine system relationships
- How does this file fit into the larger architecture?
- Which other files or modules would use this?
- Is this a leaf node or a central component?

Now, synthesize your analysis into a clear, concise summary that captures:
1. The file's primary purpose and responsibility
2. Key dependencies and exports
3. Important implementation details
4. How it fits into the larger system

File Content:
${file.content}

Summary:`
  }

  /**
   * Generate few-shot examples for common file types
   */
  static getFewShotPrompt(file: ProjectFile, context: SummarizationContext): string {
    const examples = this.getFewShotExamples(file.extension || '')

    return `You are an expert code analyst. Here are examples of high-quality summaries for similar files:

${examples}

Now analyze the following file using the same approach:

File: ${file.path}
Type: ${file.extension || 'unknown'}
${context.importsContext ? `Imports: ${context.importsContext}` : ''}
${context.exportsContext ? `Exports: ${context.exportsContext}` : ''}

Content:
${file.content}

Generate a summary following the same pattern as the examples above:`
  }

  /**
   * Get few-shot examples based on file type
   */
  private static getFewShotExamples(extension: string): string {
    const examples: Record<string, string> = {
      '.ts': `Example 1 - Service File:
File: auth-service.ts
PURPOSE: Handles user authentication, session management, and token validation
TYPE: Service
DEPS: bcrypt, jsonwebtoken, user-repository, api-error
EXPORTS:
- AuthService class: Main authentication service with login/logout methods
- validateToken(): Middleware for JWT validation
- hashPassword(): Utility for password hashing
KEY_FUNCS:
- async login(email, password): Authenticates user and returns JWT
- async logout(userId): Invalidates user session
- async refreshToken(token): Generates new access token
PATTERNS: Service layer pattern, dependency injection, async/await
RELATES: Used by auth-routes.ts, consumed by auth middleware, integrates with user-repository

Example 2 - React Component:
File: UserProfile.tsx
PURPOSE: Displays and manages user profile information with edit capabilities
TYPE: Component
DEPS: react, @shadcn/ui, user-hooks, profile-service
EXPORTS:
- UserProfile: Main profile component (default export)
- UserProfileProps: Component prop types
KEY_FUNCS:
- handleEdit(): Toggles edit mode
- handleSave(): Validates and saves profile changes
- useUserData(): Custom hook for profile data
PATTERNS: Functional component, custom hooks, controlled inputs
RELATES: Used in dashboard layout, consumes user-api, emits profile-updated events`,

      '.tsx': `Example - React Component:
File: DataTable.tsx
PURPOSE: Reusable data table component with sorting, filtering, and pagination
TYPE: Component
DEPS: react, tanstack-table, @shadcn/ui, utils
EXPORTS:
- DataTable: Generic table component (default export)
- DataTableProps<T>: Generic prop types
- useTableState: Custom hook for table state
KEY_FUNCS:
- renderCell(): Handles custom cell rendering
- handleSort(): Manages column sorting
- handleFilter(): Applies column filters
PATTERNS: Generic component, compound components, render props
RELATES: Used throughout app for data display, integrates with API hooks`,

      '.js': `Example - Utility Module:
File: data-transformer.js
PURPOSE: Provides data transformation utilities for API responses
TYPE: Utility
DEPS: lodash, date-fns
EXPORTS:
- transformUser: Formats user data
- transformList: Converts arrays to normalized format
- parseApiDate: Handles date parsing
KEY_FUNCS:
- transformUser(rawUser): Normalizes user object
- transformList(items, keyField): Creates id-keyed object
- parseApiDate(dateString): Converts to Date object
PATTERNS: Pure functions, functional programming, data normalization
RELATES: Used by API services, data hooks, consumed before state updates`,

      default: `Example - Generic Module:
File: module-name.ext
PURPOSE: [Describe the primary function in one sentence]
TYPE: [Component|Service|Utility|Config|Test|Other]
DEPS: [List key dependencies]
EXPORTS:
- [Export name]: [What it provides]
KEY_FUNCS:
- [Function]: [What it does]
PATTERNS: [Design patterns used]
RELATES: [How it fits in the system]`
    }

    return examples[extension] ?? examples.default
  }

  /**
   * Generate an optimized prompt for batch processing
   */
  static getBatchPrompt(files: ProjectFile[], context: SummarizationContext): string {
    return `Analyze this group of related files together to understand their collective purpose and relationships.

## File Group Overview:
Total Files: ${files.length}
${context.projectContext ? `Project Context: ${context.projectContext}` : ''}

## Files to Analyze:
${files
  .map(
    (f, i) => `
### File ${i + 1}: ${f.path}
- Type: ${f.extension}
- Size: ${f.size} bytes
- Preview: ${f.content?.substring(0, 500)}...
`
  )
  .join('\n')}

## Analysis Tasks:
1. Identify the collective purpose of these files
2. Map the relationships and dependencies between them
3. Determine the architectural pattern they implement
4. Highlight key integration points

For each file, provide:
- PURPOSE: Main responsibility
- DEPENDENCIES: What it imports from other files in this group
- EXPORTS: What it provides to other files
- ROLE: Its role in the group's functionality

Then provide an overall summary of how these files work together.`
  }

  /**
   * Generate a context-aware prompt with token optimization
   */
  static getOptimizedPrompt(file: ProjectFile, context: SummarizationContext, config: PromptConfig): string {
    // Select prompt strategy based on configuration
    if (config.useChainOfThought) {
      return this.getChainOfThoughtPrompt(file, context)
    }

    if (config.includeExamples) {
      return this.getFewShotPrompt(file, context)
    }

    // Default to structured prompt
    return this.getStructuredPrompt(file, context)
  }

  /**
   * Generate a progressive summarization prompt for large files
   */
  static getProgressivePrompt(
    fileChunks: string[],
    previousSummary: string | null,
    chunkIndex: number,
    totalChunks: number
  ): string {
    if (chunkIndex === 0) {
      return `Begin analyzing this large file. This is chunk 1 of ${totalChunks}.

Content:
${fileChunks[0]}

Provide an initial summary focusing on:
1. File structure and organization
2. Main imports and setup
3. Primary purpose based on initial content`
    }

    return `Continue analyzing the file. This is chunk ${chunkIndex + 1} of ${totalChunks}.

Previous summary:
${previousSummary}

New content:
${fileChunks[chunkIndex]}

Update the summary to include:
1. New functions or classes found
2. Additional patterns identified
3. Refined understanding of the file's purpose

Provide an updated comprehensive summary.`
  }

  /**
   * Generate a specialized prompt for different file types
   */
  static getSpecializedPrompt(file: ProjectFile): string {
    const specializedPrompts: Record<string, string> = {
      '.test.ts': 'Focus on what is being tested, test coverage, and test patterns used.',
      '.spec.ts': 'Identify the specifications being tested and test organization.',
      '.config.ts': 'Explain configuration options, defaults, and environment-specific settings.',
      '.schema.ts': 'Document data structures, validation rules, and type definitions.',
      '.types.ts': 'List all type definitions, interfaces, and their purposes.',
      '.styles.ts': 'Describe styling approach, theme variables, and component styles.',
      '.mock.ts': 'Explain mock data structure and testing utilities provided.',
      '.stories.tsx': 'Document Storybook stories and component variations.',
      '.md': 'Summarize documentation content and key information provided.',
      '.json': 'Describe configuration structure and important settings.'
    }

    const suffix = Object.keys(specializedPrompts).find((ext) => file.path.endsWith(ext))
    const specialization = suffix ? specializedPrompts[suffix] : ''

    return `Analyze this ${file.extension} file with special attention:
${specialization}

File: ${file.path}
Content:
${file.content}

Provide a comprehensive summary that captures the file's specific purpose and characteristics.`
  }

  /**
   * Generate a prompt for incremental updates
   */
  static getIncrementalPrompt(file: ProjectFile, previousSummary: string, changes: string[]): string {
    return `Update the existing summary based on file changes.

File: ${file.path}
Previous Summary:
${previousSummary}

Changes Made:
${changes.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Current File Content:
${file.content}

Provide an updated summary that:
1. Reflects the changes made
2. Maintains accuracy for unchanged portions
3. Notes any significant architectural changes
4. Updates the list of exports/imports if affected

Updated Summary:`
  }

  /**
   * Generate a quality scoring prompt for summary validation
   */
  static getQualityPrompt(summary: string, file: ProjectFile): string {
    return `Evaluate the quality of this file summary.

Original File: ${file.path}
File Size: ${file.size} bytes

Generated Summary:
${summary}

Rate the summary on these criteria (1-5 scale):
1. Accuracy: Does it correctly describe the file's purpose?
2. Completeness: Are all major functions/exports covered?
3. Clarity: Is it easy to understand?
4. Conciseness: Is it appropriately brief?
5. Usefulness: Would this help someone understand the file?

Provide:
- Overall Score: (1-5)
- Strengths: What the summary does well
- Improvements: What could be better
- Missing Elements: Important details not mentioned`
  }
}

/**
 * Helper function to select the best prompt strategy
 */
export function selectPromptStrategy(file: ProjectFile, context: SummarizationContext): PromptConfig {
  const fileSize = file.size || 0
  const hasRelatedFiles = context.relatedFiles && context.relatedFiles.length > 0

  // Use chain-of-thought for complex files
  if (fileSize > 50000 || file.path.includes('service') || file.path.includes('controller')) {
    return {
      depth: 'detailed',
      format: 'technical',
      useChainOfThought: true
    }
  }

  // Use few-shot for common file types
  if (['.tsx', '.ts', '.js', '.jsx'].includes(file.extension || '')) {
    return {
      depth: 'standard',
      format: 'structured',
      includeExamples: true
    }
  }

  // Use structured for everything else
  return {
    depth: hasRelatedFiles ? 'standard' : 'minimal',
    format: 'structured',
    includeExamples: false,
    useChainOfThought: false
  }
}
