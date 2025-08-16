import { z } from '@hono/zod-openapi'
import { MessageRoleEnum } from './common.schemas'
import { DEFAULT_MODEL_EXAMPLES } from './model-defaults'

// --- Schema for individual messages (aligns with Vercel AI SDK CoreMessage) ---
export const AiMessageSchema = z
  .object({
    role: MessageRoleEnum,
    content: z.string()
  })
  .openapi('AiMessage')

// --- Updated Schema for AI SDK Options ---
// This schema defines common parameters to control the behavior of AI models during generation.
// Not all parameters are supported by all models or providers.
export const AiSdkOptionsSchema = z
  .object({
    // Provider URL overrides
    ollamaUrl: z.string().url().optional().openapi({
      description: 'Custom Ollama server URL to use instead of the default.',
      example: 'http://192.168.1.100:11434'
    }),
    lmstudioUrl: z.string().url().optional().openapi({
      description: 'Custom LMStudio server URL to use instead of the default.',
      example: 'http://localhost:1234'
    }),
    temperature: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .openapi({
        description:
          'Controls the randomness of the output. Lower values (e.g., 0.2) make the output more focused, deterministic, and suitable for factual tasks. Higher values (e.g., 0.8) increase randomness and creativity, useful for brainstorming or creative writing. A value of 0 typically means greedy decoding (always picking the most likely token).',
        example: DEFAULT_MODEL_EXAMPLES.temperature // A common default balancing creativity and coherence
      }),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .openapi({
        description:
          'The maximum number of tokens (words or parts of words) the model is allowed to generate in the response. This limits the output length and can affect cost. Note: This limit usually applies only to the *generated* tokens, not the input prompt tokens.',
        example: DEFAULT_MODEL_EXAMPLES.maxTokens // Example: Limit response to roughly 4000 tokens
      }),
    topP: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .openapi({
        description:
          "Controls diversity via nucleus sampling. It defines a probability threshold (e.g., 0.9). The model considers only the smallest set of most probable tokens whose cumulative probability exceeds this threshold for the next token selection. Lower values (e.g., 0.5) restrict choices more, leading to less random outputs. A value of 1 considers all tokens. It's often recommended to alter *either* `temperature` *or* `topP`, not both.",
        example: DEFAULT_MODEL_EXAMPLES.topP // Example: Consider top 90% probable tokens
      }),
    frequencyPenalty: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .openapi({
        // Added typical range
        description:
          'Applies a penalty to tokens based on how frequently they have already appeared in the generated text *and* the prompt. Positive values (e.g., 0.5) decrease the likelihood of the model repeating the same words or phrases verbatim, making the output less repetitive. Negative values encourage repetition.',
        example: DEFAULT_MODEL_EXAMPLES.frequencyPenalty // Example: Slightly discourage repeating words
      }),
    presencePenalty: z
      .number()
      .min(-2)
      .max(2)
      .optional()
      .openapi({
        // Added typical range
        description:
          'Applies a penalty to tokens based on whether they have appeared *at all* in the generated text *and* the prompt so far (regardless of frequency). Positive values (e.g., 0.5) encourage the model to introduce new concepts and topics, reducing the likelihood of repeating *any* previously mentioned word. Negative values encourage staying on topic.',
        example: DEFAULT_MODEL_EXAMPLES.presencePenalty // Example: Slightly encourage introducing new concepts
      }),
    topK: z
      .number()
      .int()
      .positive()
      .optional()
      .openapi({
        description:
          "Restricts the model's choices for the next token to the `k` most likely candidates. For example, if `topK` is 40, the model will only consider the top 40 most probable tokens at each step. A lower value restricts choices more. Setting `topK` to 1 is equivalent to greedy decoding (same as `temperature: 0`). Less commonly used than `topP`.",
        example: DEFAULT_MODEL_EXAMPLES.topK // Example: Consider only the 40 most likely next tokens
      }),
    stop: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .openapi({
        description:
          "Specifies one or more sequences of text where the AI should stop generating. Once the model generates a stop sequence, it will halt output immediately, even if `maxTokens` hasn't been reached. Useful for structured output or controlling conversational turns.",
        example: ['\nHuman:', '\n---'] // Example: Stop if 'Human:' or '---' appears on a new line
      }),
    response_format: z
      .any()
      .optional()
      .openapi({
        // Kept as z.any due to variance
        description:
          "Specifies the desired format for the model's response. This is highly provider-specific. A common use case is enforcing JSON output, often requiring specific model versions.",
        example: { type: 'json_object' } // Example: Request JSON output (syntax varies by provider)
      }),
    // structuredOutputMode, schemaName, etc. are often handled by specific library functions
    // like `generateObject` rather than generic options, so keeping them commented out is reasonable
    // unless you have a specific use case for passing them this way.
    provider: z.string().optional().openapi({
      description: 'The provider to use for the AI request.',
      example: DEFAULT_MODEL_EXAMPLES.provider
    }),
    model: z.string().optional().openapi({
      description: 'The model to use for the AI request.',
      example: DEFAULT_MODEL_EXAMPLES.model
    })
  })
  .partial()
  .openapi('AiSdkOptions') // .partial() makes all fields optional implicitly

// --- Schema for Available Models ---
const UnifiedModelSchema = z
  .object({
    id: z.string().openapi({ example: DEFAULT_MODEL_EXAMPLES.model, description: 'Model identifier' }),
    name: z.string().openapi({ example: 'GPT-4o Mini', description: 'User-friendly model name' }),
    provider: z.string().openapi({ example: DEFAULT_MODEL_EXAMPLES.provider, description: 'Provider ID' }),
    context_length: z.number().optional().openapi({ example: 128000, description: 'Context window size in tokens' })
    // Add other relevant fields like 'description', 'capabilities', etc.
  })
  .openapi('UnifiedModel')

export { UnifiedModelSchema }

export const ModelsListResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(UnifiedModelSchema)
  })
  .openapi('ModelsListResponse')

// --- Schema for Quick, One-Off Text Generation Request ---
export const AiGenerateTextRequestSchema = z
  .object({
    prompt: z.string().min(1, { message: 'Prompt cannot be empty.' }).openapi({
      description: 'The text prompt for the AI.',
      example:
        'Suggest 5 suitable filenames for a typescript utility file containing helper functions for string manipulation.'
    }),
    options: AiSdkOptionsSchema.optional().openapi({
      // Options are optional
      description: 'Optional parameters to override default model behavior (temperature, maxTokens, etc.).'
    }),
    systemMessage: z.string().optional().openapi({
      example: 'You are an expert programmer. Provide concise and relevant suggestions.',
      description: 'Optional system message to guide the AI behavior and persona.'
    })
  })
  .openapi('AiGenerateTextRequest')

// --- Schema for Quick, One-Off Text Generation Response ---
export const AiGenerateTextResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      text: z.string().openapi({ description: 'The generated text response from the AI.' })
    })
  })
  .openapi('AiGenerateTextResponse')

// --- Base Schema for Structured Data Configuration ---
export const BaseStructuredDataConfigSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    modelSettings: AiSdkOptionsSchema.optional(), // Use the updated AiSdkOptionsSchema
    systemPrompt: z.string().optional(),
    promptTemplate: z
      .string()
      .min(1)
      .optional()
      .refine((s) => s?.includes('{userInput}'), {
        message: "promptTemplate must include the placeholder '{userInput}'"
      })
  })
  .openapi('BaseStructuredDataConfig')

// --- Schemas for Structured Data Generation ---
export type BaseStructuredDataConfig = z.infer<typeof BaseStructuredDataConfigSchema>

export interface StructuredDataSchemaConfig<T extends z.ZodTypeAny> extends BaseStructuredDataConfig {
  schema: T
}

export const AiGenerateStructuredRequestSchema = z
  .object({
    schemaKey: z.string().min(1).openapi({
      description: 'The key identifying the predefined structured task configuration.',
      example: 'filenameSuggestion'
    }),
    userInput: z.string().min(1).openapi({
      description: "The user's input or context for the structured generation task.",
      example: 'A react component for displaying user profiles'
    }),
    options: AiSdkOptionsSchema.optional().openapi({
      description: 'Optional: Override default model options (temperature, etc.) defined in the task configuration.'
    })
  })
  .openapi('AiGenerateStructuredRequest')

export const AiGenerateStructuredResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.object({
      output: z.any().openapi({
        description: "The generated structured data, validated against the schema defined by the 'schemaKey'."
      })
      // Consider adding metadata: model used, tokens, latency, etc.
    })
  })
  .openapi('AiGenerateStructuredResponse')

// Define the Zod schema for filename suggestions
export const FilenameSuggestionSchema = z
  .object({
    suggestions: z
      .array(z.number())
      .length(5)
      .openapi({
        description: 'An array of exactly 5 suggested file ids (unix timestamp in milliseconds)',
        example: [1, 2, 3, 4, 5]
      }),
    reasoning: z.string().optional().openapi({
      description: 'Brief reasoning for the suggestions.',
      example: 'Suggestions focus on clarity and common naming conventions for utility files.'
    })
  })
  .openapi('FilenameSuggestionOutput')

// Asset Generation Schemas
export const ReadmeGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The generated README content in markdown format',
      example: '# Project Name\n\nDescription...'
    }),
    sections: z.array(z.string()).openapi({
      description: 'List of sections included in the README',
      example: ['Introduction', 'Installation', 'Usage', 'API', 'Contributing', 'License']
    })
  })
  .openapi('ReadmeGeneratorOutput')

export const ReactComponentGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The generated React component code',
      example: 'import React from "react"...'
    }),
    componentName: z.string().openapi({
      description: 'The name of the generated component',
      example: 'UserProfile'
    }),
    props: z
      .array(z.string())
      .optional()
      .openapi({
        description: 'List of props used in the component',
        example: ['id', 'name', 'avatar', 'bio']
      }),
    imports: z.array(z.string()).openapi({
      description: 'List of imports used in the component',
      example: ['react', '@/lib/utils', '@/components/ui/card']
    })
  })
  .openapi('ReactComponentGeneratorOutput')

export const TestSuiteGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The generated test suite code',
      example: 'import { describe, it, expect } from "bun:test"...'
    }),
    testCases: z.array(z.string()).openapi({
      description: 'List of test cases included',
      example: ['should render correctly', 'should handle click events', 'should validate inputs']
    })
  })
  .openapi('TestSuiteGeneratorOutput')

export const ConfigFileGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The generated configuration file content',
      example: '{\n  "compilerOptions": {...}\n}'
    }),
    fileType: z.string().openapi({
      description: 'The type of configuration file',
      example: 'tsconfig'
    })
  })
  .openapi('ConfigFileGeneratorOutput')

export const ApiRouteGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The generated API route code',
      example: 'import { createRoute } from "@hono/zod-openapi"...'
    }),
    routePath: z.string().openapi({
      description: 'The API route path',
      example: '/api/users/:id'
    }),
    methods: z.array(z.string()).openapi({
      description: 'HTTP methods implemented',
      example: ['GET', 'POST', 'PUT', 'DELETE']
    })
  })
  .openapi('ApiRouteGeneratorOutput')

export const ZodSchemaGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The generated Zod schema code',
      example: 'import { z } from "zod"...'
    }),
    schemaName: z.string().openapi({
      description: 'The name of the generated schema',
      example: 'UserSchema'
    }),
    fields: z.array(z.string()).openapi({
      description: 'List of fields in the schema',
      example: ['id', 'name', 'email', 'createdAt']
    })
  })
  .openapi('ZodSchemaGeneratorOutput')

export const SvgGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The complete SVG code starting with <svg and ending with </svg>',
      example:
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    })
  })
  .openapi('SvgGeneratorOutput')

export const ArchitectureDocGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The generated architecture documentation in markdown format',
      example: '# Project Architecture\n\n## Overview\n...'
    }),
    sections: z
      .array(
        z.object({
          title: z.string(),
          level: z.number().min(1).max(6)
        })
      )
      .openapi({
        description: 'Table of contents with section titles and heading levels',
        example: [
          { title: 'Overview', level: 2 },
          { title: 'Core Components', level: 2 }
        ]
      }),
    metadata: z
      .object({
        wordCount: z.number(),
        estimatedReadTime: z.string()
      })
      .optional()
  })
  .openapi('ArchitectureDocGeneratorOutput')

export const MermaidDiagramGeneratorSchema = z
  .object({
    content: z.string().openapi({
      description: 'The complete mermaid diagram code in markdown format',
      example: '```mermaid\ngraph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do this]\n  B -->|No| D[Do that]\n```'
    }),
    diagramType: z.enum(['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie']).openapi({
      description: 'The type of mermaid diagram generated',
      example: 'flowchart'
    }),
    rawMermaidCode: z.string().openapi({
      description: 'The raw mermaid code without markdown wrapper',
      example: 'graph TD\n  A[Start] --> B{Decision}'
    })
  })
  .openapi('MermaidDiagramGeneratorOutput')

// Export internal schemas needed by routes
export const FileSuggestionsZodSchema = z.object({
  fileIds: z.array(z.number())
})

export const PromptSuggestionsZodSchema = z.object({
  promptIds: z.array(z.number()).describe('Array of prompt IDs ordered by relevance (most relevant first)')
})

// Define other schemas as needed...
// const CodeReviewSchema = z.object({ ... });

// Central object mapping keys to structured task configurations
// Place this here or in a separate config file (e.g., gen-ai-config.ts) and import it
export const structuredDataSchemas = {
  filenameSuggestion: {
    // These fields match BaseStructuredDataConfigSchema
    name: 'Filename Suggestion',
    description: "Suggests 5 suitable filenames based on a description of the file's content.",
    // promptTemplate can be included to help with the prompt, but it's not required
    promptTemplate:
      'Based on the following file description, suggest 5 suitable and conventional filenames. File Description: {userInput}',
    systemPrompt:
      'You are an expert programmer specializing in clear code organization and naming conventions. Provide concise filename suggestions.',
    // modelSettings: {
    //     model: DEFAULT_MODEL_EXAMPLES.model,
    //     temperature: DEFAULT_MODEL_EXAMPLES.temperature,
    // },
    // This field is part of the interface, but not the base Zod schema
    schema: FilenameSuggestionSchema // The actual Zod schema instance
  },
  // Example of another entry
  basicSummary: {
    name: 'Basic Summary',
    description: 'Generates a short summary of the input text.',
    promptTemplate: 'Summarize the following text concisely: {userInput}',
    systemPrompt: 'You are a summarization expert.',
    // modelSettings: { model: DEFAULT_MODEL_EXAMPLES.model, temperature: DEFAULT_MODEL_EXAMPLES.temperature, maxTokens: DEFAULT_MODEL_EXAMPLES.maxTokens },
    schema: z
      .object({
        // Define the schema directly here
        summary: z.string().openapi({ description: 'The generated summary.' })
      })
      .openapi('BasicSummaryOutput')
  },
  // Asset generators
  readmeGenerator: {
    name: 'README Generator',
    description: 'Generates comprehensive README files for projects',
    promptTemplate: `Create a professional README.md file for the following project: {userInput}
Include appropriate sections such as: Overview, Features, Installation, Usage, Configuration, API Reference (if applicable), Contributing, and License.
Use clear markdown formatting with proper headings, code blocks, and lists.`,
    systemPrompt:
      'You are an expert technical writer specializing in creating clear, comprehensive, and well-structured README files for software projects.',
    schema: ReadmeGeneratorSchema
  },
  componentGenerator: {
    name: 'React Component Generator',
    description: 'Creates React components with TypeScript and best practices',
    promptTemplate: `Create a React component with TypeScript based on the following requirements: {userInput}
Follow these guidelines:
- Use functional components with proper TypeScript interfaces
- Include appropriate imports
- Follow React best practices and conventions
- Add helpful comments where necessary
- Use proper prop validation`,
    systemPrompt:
      'You are an expert React developer specializing in creating clean, reusable, and well-typed components.',
    schema: ReactComponentGeneratorSchema
  },
  testGenerator: {
    name: 'Test Suite Generator',
    description: 'Generates test files using Bun test framework',
    promptTemplate: `Create a comprehensive test suite using Bun test framework for: {userInput}
Include:
- Proper test structure with describe blocks
- Multiple test cases covering different scenarios
- Edge cases and error handling
- Mock data where appropriate`,
    systemPrompt: 'You are an expert in test-driven development, specializing in writing comprehensive test suites.',
    schema: TestSuiteGeneratorSchema
  },
  configGenerator: {
    name: 'Config File Generator',
    description: 'Creates configuration files for various tools',
    promptTemplate: `Generate a configuration file based on: {userInput}
Ensure the configuration is:
- Well-commented with explanations
- Following best practices for the specific tool
- Production-ready with sensible defaults`,
    systemPrompt: 'You are an expert in development tooling and configuration management.',
    schema: ConfigFileGeneratorSchema
  },
  apiRouteGenerator: {
    name: 'API Route Generator',
    description: 'Generates Hono API routes with validation',
    promptTemplate: `Create a Hono API route with Zod validation based on: {userInput}
Include:
- Proper route definition with OpenAPI specs
- Request/response validation schemas
- Error handling
- TypeScript types
- Follow RESTful conventions`,
    systemPrompt: 'You are an expert backend developer specializing in creating type-safe, well-documented APIs.',
    schema: ApiRouteGeneratorSchema
  },
  schemaGenerator: {
    name: 'Zod Schema Generator',
    description: 'Creates Zod schemas with TypeScript types',
    promptTemplate: `Generate a Zod schema with TypeScript types for: {userInput}
Include:
- Proper validation rules
- Helpful error messages
- TypeScript type inference
- OpenAPI documentation where appropriate`,
    systemPrompt: 'You are an expert in data validation and TypeScript, specializing in creating robust Zod schemas.',
    schema: ZodSchemaGeneratorSchema
  },
  svgGenerator: {
    name: 'SVG Generator',
    description: 'Creates optimized SVG graphics',
    promptTemplate: `{userInput}

CRITICAL: You MUST generate valid SVG XML code. The output must be a complete SVG element that can be rendered in a browser.`,
    systemPrompt: `You are an expert SVG designer who creates clean, optimized, and scalable vector graphics.

CRITICAL INSTRUCTIONS:
1. You MUST generate ONLY valid SVG XML code
2. Your response MUST start with <svg and end with </svg>
3. Do NOT include any text, explanations, or markdown - ONLY the SVG code
4. The SVG must be complete and renderable

Example of expected output format:
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
</svg>

Follow these SVG best practices:
- Include proper xmlns attribute
- Use viewBox for scalability
- Optimize paths and shapes
- Use the specified dimensions
- Apply the requested style (modern, minimalist, detailed, etc.)
- Use the specified colors
- Keep the code clean and optimized

Remember: Output ONLY the SVG code, nothing else.`,
    modelSettings: {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000
    },
    schema: SvgGeneratorSchema
  },
  architectureDocGenerator: {
    name: 'Architecture Documentation Generator',
    description: 'Creates comprehensive project architecture documentation and development guidelines',
    promptTemplate: `Generate a comprehensive architecture documentation based on the following project description and requirements: {userInput}

The documentation should include:
1. Project Overview - High-level description of what the project does
2. Architecture Overview - Core architectural patterns and principles
3. Project Structure - Directory organization and key components
4. Technology Stack - Languages, frameworks, and tools used
5. Core Concepts - Key abstractions and design patterns
6. Development Guidelines - Coding standards, conventions, and best practices
7. API Design Principles - How APIs should be structured
8. State Management - How data flows through the application
9. Testing Strategy - Approach to testing and quality assurance
10. Performance Considerations - Optimization strategies
11. Security Guidelines - Security best practices
12. Deployment & Operations - How the project is built and deployed

Make it practical and actionable, similar to a cursor rules file that helps developers understand how to work with and extend the codebase.`,
    systemPrompt: `You are an expert software architect and technical writer. Create clear, comprehensive, and practical architecture documentation that serves as a guide for developers working on the project. Focus on explaining the "why" behind architectural decisions and provide concrete examples where helpful. Write in a clear, concise manner that is easy to understand.`,
    modelSettings: {
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 4000
    },
    schema: ArchitectureDocGeneratorSchema
  },
  mermaidDiagramGenerator: {
    name: 'Mermaid Diagram Generator',
    description: 'Creates mermaid diagrams for visualizing architecture, flows, and relationships',
    promptTemplate: `Generate a mermaid diagram based on the following requirements: {userInput}

CRITICAL INSTRUCTIONS:
1. Generate a complete, valid mermaid diagram
2. Choose the most appropriate diagram type (flowchart, sequence, class, state, er, etc.)
3. Use clear, descriptive labels
4. Follow mermaid syntax precisely
5. Include the diagram in a markdown code block with \`\`\`mermaid

The output should be a markdown code block containing the mermaid diagram that can be rendered in any markdown viewer that supports mermaid.`,
    systemPrompt: `You are an expert in creating clear, informative mermaid diagrams. Generate diagrams that effectively communicate system architecture, data flows, relationships, and processes. Use appropriate diagram types and follow mermaid best practices for clarity and readability.`,
    modelSettings: {
      model: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 2000
    },
    schema: MermaidDiagramGeneratorSchema
  },
  chatNaming: {
    name: 'Chat Name Generation',
    description: 'Generates a concise, meaningful name for a chat based on its initial content.',
    promptTemplate:
      'Based on the following chat content, generate a concise and descriptive name (max 40 characters) that captures the main topic or purpose: {userInput}',
    systemPrompt:
      'You are an expert at creating clear, concise titles that accurately represent the content. Focus on the main topic or action requested.',
    modelSettings: {
      model: 'gpt-4o-mini',
      temperature: 0.5,
      maxTokens: 100
    },
    schema: z.object({
      chatName: z.string().max(40).openapi({
        description: 'A concise, descriptive name for the chat',
        example: 'Fix Authentication Bug'
      })
    })
  },
  tabNaming: {
    name: 'Tab Name Generation',
    description: 'Generates a meaningful name for a project tab based on project details and content.',
    promptTemplate:
      'Based on the following project information, generate a descriptive tab name (max 30 characters) that captures the main purpose or focus: Project Name: {projectName}, Selected Files: {selectedFiles}, Context: {context}',
    systemPrompt:
      'You are an expert at creating clear, concise tab names that accurately represent the project focus. Consider the project name, selected files, and any additional context.',
    modelSettings: {
      model: 'gpt-4o-mini',
      temperature: 0.5,
      maxTokens: 100
    },
    schema: z.object({
      tabName: z.string().max(30).openapi({
        description: 'A concise, descriptive name for the project tab',
        example: 'Auth Service Refactor'
      })
    })
  }
  // Add more structured tasks here...
} satisfies Record<string, StructuredDataSchemaConfig<any>>

// --- Type Exports ---
export type AiSdkOptions = z.infer<typeof AiSdkOptionsSchema>
export type AiGenerateTextRequest = z.infer<typeof AiGenerateTextRequestSchema>
export type AiGenerateStructuredRequest = z.infer<typeof AiGenerateStructuredRequestSchema>
export type UnifiedModel = z.infer<typeof UnifiedModelSchema>
export type AiMessage = z.infer<typeof AiMessageSchema>
