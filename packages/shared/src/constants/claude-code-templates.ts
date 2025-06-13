export interface ClaudeCodeTemplate {
  id: string
  name: string
  description: string
  category: 'refactoring' | 'documentation' | 'testing' | 'debugging' | 'feature' | 'optimization' | 'security'
  prompt: string
  variables?: {
    name: string
    description: string
    defaultValue?: string
  }[]
}

export const CLAUDE_CODE_TEMPLATES: ClaudeCodeTemplate[] = [
  // Refactoring Templates
  {
    id: 'refactor-to-typescript',
    name: 'Convert to TypeScript',
    description: 'Convert JavaScript files to TypeScript with proper types',
    category: 'refactoring',
    prompt:
      'Convert the selected JavaScript files to TypeScript. Add proper type annotations, interfaces, and ensure the code remains functionally equivalent. Use TypeScript best practices.'
  },
  {
    id: 'extract-function',
    name: 'Extract Function',
    description: 'Extract repeated code into reusable functions',
    category: 'refactoring',
    prompt:
      'Analyze the code for repeated patterns and extract them into well-named, reusable functions. Ensure the refactored code is cleaner and more maintainable.'
  },
  {
    id: 'improve-naming',
    name: 'Improve Variable & Function Names',
    description: 'Rename variables and functions to be more descriptive',
    category: 'refactoring',
    prompt:
      'Review the code and improve all variable and function names to be more descriptive and follow naming conventions. Ensure names clearly communicate their purpose.'
  },

  // Documentation Templates
  {
    id: 'add-jsdoc',
    name: 'Add JSDoc Comments',
    description: 'Add comprehensive JSDoc comments to functions',
    category: 'documentation',
    prompt:
      'Add detailed JSDoc comments to all functions including descriptions, @param, @returns, and @example tags where appropriate. Ensure comments explain the "why" not just the "what".'
  },
  {
    id: 'create-readme',
    name: 'Create README',
    description: 'Generate a comprehensive README file',
    category: 'documentation',
    prompt:
      'Create a comprehensive README.md file that includes: project description, installation instructions, usage examples, API documentation, contributing guidelines, and license information.',
    variables: [
      {
        name: 'projectName',
        description: 'Name of the project',
        defaultValue: 'My Project'
      }
    ]
  },
  {
    id: 'api-documentation',
    name: 'Document API Endpoints',
    description: 'Generate API documentation for REST endpoints',
    category: 'documentation',
    prompt:
      'Generate comprehensive API documentation for all REST endpoints including: method, path, description, request/response schemas, example requests/responses, and error codes.'
  },

  // Testing Templates
  {
    id: 'unit-tests',
    name: 'Generate Unit Tests',
    description: 'Create unit tests for functions',
    category: 'testing',
    prompt:
      "Generate comprehensive unit tests for the selected functions. Include edge cases, error scenarios, and ensure good test coverage. Use the project's existing test framework.",
    variables: [
      {
        name: 'testFramework',
        description: 'Testing framework to use',
        defaultValue: 'jest'
      }
    ]
  },
  {
    id: 'integration-tests',
    name: 'Generate Integration Tests',
    description: 'Create integration tests for API endpoints',
    category: 'testing',
    prompt:
      'Generate integration tests for API endpoints. Test successful responses, error cases, authentication, and data validation. Ensure tests are isolated and repeatable.'
  },
  {
    id: 'test-coverage',
    name: 'Improve Test Coverage',
    description: 'Add tests to improve code coverage',
    category: 'testing',
    prompt:
      'Analyze the existing tests and add new test cases to improve coverage. Focus on untested branches, edge cases, and error conditions.'
  },

  // Debugging Templates
  {
    id: 'fix-errors',
    name: 'Fix Errors',
    description: 'Identify and fix errors in the code',
    category: 'debugging',
    prompt:
      'Analyze the code for potential errors, bugs, or issues. Fix any problems found and explain what was wrong and how it was fixed.',
    variables: [
      {
        name: 'errorDescription',
        description: 'Description of the error or issue',
        defaultValue: ''
      }
    ]
  },
  {
    id: 'add-error-handling',
    name: 'Add Error Handling',
    description: 'Add proper error handling and validation',
    category: 'debugging',
    prompt:
      'Add comprehensive error handling including try-catch blocks, input validation, and meaningful error messages. Ensure errors are properly logged and handled gracefully.'
  },
  {
    id: 'debug-performance',
    name: 'Debug Performance Issues',
    description: 'Identify and fix performance bottlenecks',
    category: 'debugging',
    prompt:
      'Analyze the code for performance issues such as unnecessary loops, inefficient algorithms, or resource leaks. Provide optimized solutions with explanations.'
  },

  // Feature Templates
  {
    id: 'crud-operations',
    name: 'Implement CRUD Operations',
    description: 'Create complete CRUD functionality',
    category: 'feature',
    prompt:
      'Implement complete CRUD (Create, Read, Update, Delete) operations for {{entityName}}. Include validation, error handling, and follow RESTful conventions.',
    variables: [
      {
        name: 'entityName',
        description: 'Name of the entity (e.g., User, Product)',
        defaultValue: 'Entity'
      }
    ]
  },
  {
    id: 'authentication',
    name: 'Add Authentication',
    description: 'Implement user authentication',
    category: 'feature',
    prompt:
      'Implement user authentication including registration, login, logout, and session management. Use secure practices for password handling and token generation.'
  },
  {
    id: 'api-endpoint',
    name: 'Create API Endpoint',
    description: 'Create a new REST API endpoint',
    category: 'feature',
    prompt:
      'Create a new {{method}} endpoint at {{path}} that {{description}}. Include proper validation, error handling, and follow RESTful conventions.',
    variables: [
      {
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE)',
        defaultValue: 'GET'
      },
      {
        name: 'path',
        description: 'API path (e.g., /api/users)',
        defaultValue: '/api/resource'
      },
      {
        name: 'description',
        description: 'What the endpoint does',
        defaultValue: 'returns data'
      }
    ]
  },

  // Optimization Templates
  {
    id: 'optimize-performance',
    name: 'Optimize Performance',
    description: 'Optimize code for better performance',
    category: 'optimization',
    prompt:
      'Optimize the code for better performance. Focus on algorithm efficiency, reducing unnecessary operations, caching, and minimizing resource usage.'
  },
  {
    id: 'reduce-bundle-size',
    name: 'Reduce Bundle Size',
    description: 'Optimize imports and reduce bundle size',
    category: 'optimization',
    prompt:
      'Analyze imports and dependencies to reduce bundle size. Use dynamic imports, tree shaking, and remove unused code. Suggest lighter alternatives for heavy dependencies.'
  },
  {
    id: 'optimize-database-queries',
    name: 'Optimize Database Queries',
    description: 'Improve database query performance',
    category: 'optimization',
    prompt:
      'Optimize database queries for better performance. Add appropriate indexes, reduce N+1 queries, use efficient joins, and implement query result caching where appropriate.'
  },

  // Security Templates
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Perform a security audit of the code',
    category: 'security',
    prompt:
      'Perform a comprehensive security audit. Check for vulnerabilities like SQL injection, XSS, CSRF, insecure dependencies, and exposed secrets. Provide fixes for any issues found.'
  },
  {
    id: 'add-input-validation',
    name: 'Add Input Validation',
    description: 'Add comprehensive input validation',
    category: 'security',
    prompt:
      'Add comprehensive input validation and sanitization to prevent security vulnerabilities. Validate all user inputs, API parameters, and form data.'
  },
  {
    id: 'secure-api',
    name: 'Secure API Endpoints',
    description: 'Add security measures to API endpoints',
    category: 'security',
    prompt:
      'Secure API endpoints by adding authentication, authorization, rate limiting, and input validation. Ensure proper CORS configuration and use HTTPS.'
  }
]

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: ClaudeCodeTemplate['category']): ClaudeCodeTemplate[] {
  return CLAUDE_CODE_TEMPLATES.filter((t) => t.category === category)
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): ClaudeCodeTemplate | undefined {
  return CLAUDE_CODE_TEMPLATES.find((t) => t.id === id)
}

/**
 * Process template variables in a prompt
 */
export function processTemplatePrompt(template: ClaudeCodeTemplate, variables: Record<string, string>): string {
  let prompt = template.prompt

  if (template.variables) {
    for (const variable of template.variables) {
      const value = variables[variable.name] || variable.defaultValue || `{{${variable.name}}}`
      const regex = new RegExp(`{{${variable.name}}}`, 'g')
      prompt = prompt.replace(regex, value)
    }
  }

  return prompt
}
