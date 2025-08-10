import { z } from '@hono/zod-openapi'
import {
  validateDataField,
  createTrackedHandler,
  MCPError,
  MCPErrorCode,
  createMCPError,
  formatMCPErrorResponse,
  type MCPToolDefinition,
  type MCPToolResponse
} from '../shared'

export enum DocumentationSearchAction {
  SEARCH = 'search',
  GET_CATEGORIES = 'get_categories',
  GET_ARTICLE = 'get_article',
  SUGGEST_RELATED = 'suggest_related'
}

const DocumentationSearchSchema = z.object({
  action: z.enum([
    DocumentationSearchAction.SEARCH,
    DocumentationSearchAction.GET_CATEGORIES,
    DocumentationSearchAction.GET_ARTICLE,
    DocumentationSearchAction.SUGGEST_RELATED
  ]),
  data: z.any().optional()
})

export const documentationSearchTool: MCPToolDefinition = {
  name: 'documentation_search',
  description:
    'Search and retrieve Promptliano documentation. Actions: search (search docs), get_categories (list categories), get_article (get specific article), suggest_related (get related articles)',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform',
        enum: Object.values(DocumentationSearchAction)
      },
      data: {
        type: 'object',
        description:
          'Action-specific data. For search: { query: "how to setup MCP", filters: { category: "getting-started", difficulty: "beginner" } }. For get_article: { articleId: "mcp-setup-guide" }. For suggest_related: { articleId: "mcp-setup-guide", limit: 5 }'
      }
    },
    required: ['action']
  },
  handler: createTrackedHandler(
    'documentation_search',
    async (args: z.infer<typeof DocumentationSearchSchema>): Promise<MCPToolResponse> => {
      try {
        const { action, data } = args
        // Mock documentation data
        const categories = [
          { id: 'getting-started', title: 'Getting Started', articles: 12 },
          { id: 'mcp-integration', title: 'MCP Integration', articles: 8 },
          { id: 'api-reference', title: 'API Reference', articles: 24 },
          { id: 'troubleshooting', title: 'Troubleshooting', articles: 15 }
        ]
        const articles = [
          {
            id: 'mcp-setup-guide',
            title: 'MCP Setup Guide',
            category: 'getting-started',
            summary: 'Complete guide to setting up Promptliano MCP with your editor',
            difficulty: 'beginner',
            readingTime: 5
          },
          {
            id: 'mcp-tools-overview',
            title: 'MCP Tools Overview',
            category: 'mcp-integration',
            summary: 'Learn about all available MCP tools in Promptliano',
            difficulty: 'intermediate',
            readingTime: 10
          },
          {
            id: 'troubleshooting-connection',
            title: 'Troubleshooting MCP Connection Issues',
            category: 'troubleshooting',
            summary: 'Common MCP connection problems and their solutions',
            difficulty: 'intermediate',
            readingTime: 7
          }
        ]
        switch (action) {
          case DocumentationSearchAction.SEARCH: {
            const query = validateDataField<string>(data, 'query', 'string', '"how to setup"')
            const filters = data?.filters || {}
            // Simple search simulation
            const results = articles.filter((article) => {
              const matchesQuery =
                article.title.toLowerCase().includes(query.toLowerCase()) ||
                article.summary.toLowerCase().includes(query.toLowerCase())
              const matchesCategory = !filters.category || article.category === filters.category
              const matchesDifficulty = !filters.difficulty || article.difficulty === filters.difficulty
              return matchesQuery && matchesCategory && matchesDifficulty
            })
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Search Results for "${query}":\n\n` +
                    (results.length > 0
                      ? results
                          .map(
                            (r) =>
                              `**${r.title}**\n` +
                              `Category: ${r.category} | Difficulty: ${r.difficulty} | ${r.readingTime} min read\n` +
                              `${r.summary}\n`
                          )
                          .join('\n')
                      : 'No results found. Try different keywords or filters.')
                }
              ]
            }
          }
          case DocumentationSearchAction.GET_CATEGORIES: {
            return {
              content: [
                {
                  type: 'text',
                  text:
                    'Documentation Categories:\n\n' +
                    categories.map((c) => `**${c.title}** (${c.id})\n` + `  Articles: ${c.articles}`).join('\n\n')
                }
              ]
            }
          }
          case DocumentationSearchAction.GET_ARTICLE: {
            const articleId = validateDataField<string>(data, 'articleId', 'string', '"mcp-setup-guide"')
            const article = articles.find((a) => a.id === articleId)
            if (!article) {
              throw createMCPError(MCPErrorCode.SEARCH_FAILED, `Article not found: ${articleId}`)
            }
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `# ${article.title}\n\n` +
                    `**Category:** ${article.category}\n` +
                    `**Difficulty:** ${article.difficulty}\n` +
                    `**Reading Time:** ${article.readingTime} minutes\n\n` +
                    `## Summary\n${article.summary}\n\n` +
                    `## Content\n[Full article content would be loaded here]\n\n` +
                    `---\n*Use suggest_related action to find similar articles*`
                }
              ]
            }
          }
          case DocumentationSearchAction.SUGGEST_RELATED: {
            const articleId = validateDataField<string>(data, 'articleId', 'string', '"mcp-setup-guide"')
            const limit = data?.limit || 3
            // Find related articles (simplified logic)
            const currentArticle = articles.find((a) => a.id === articleId)
            if (!currentArticle) {
              throw createMCPError(MCPErrorCode.SEARCH_FAILED, `Article not found: ${articleId}`)
            }
            const related = articles
              .filter(
                (a) =>
                  a.id !== articleId &&
                  (a.category === currentArticle.category || a.difficulty === currentArticle.difficulty)
              )
              .slice(0, limit)
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `Related Articles for "${currentArticle.title}":\n\n` +
                    related.map((r) => `- **${r.title}** (${r.category})\n  ${r.summary}`).join('\n\n')
                }
              ]
            }
          }
          default:
            throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
              action,
              validActions: Object.values(DocumentationSearchAction)
            })
        }
      } catch (error) {
        const mcpError =
          error instanceof MCPError
            ? error
            : MCPError.fromError(error, { tool: 'documentation_search', action: args.action })
        return formatMCPErrorResponse(mcpError)
      }
    }
  )
}
