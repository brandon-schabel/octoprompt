import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { AssetGeneratorDialog } from '@/components/assets/asset-generator-dialog'
import { Code2, Sparkles, Copy, FileJson, Globe, Shield } from 'lucide-react'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

interface ApiDocsViewProps {
  projectId: number
  projectName?: string
}

const apiDocTemplates = {
  restApi: {
    name: 'REST API Documentation',
    icon: Globe,
    description: 'Complete REST API reference with examples',
    format: 'openapi',
    prompt: `Generate comprehensive REST API documentation for {projectName}:

# API Reference

## Overview
Base URL: \`https://api.{projectName}.com/v1\`
Authentication: Bearer Token

## Endpoints

### Authentication

#### POST /auth/login
Authenticate user and receive access token.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securepassword"
}
\`\`\`

**Response:**
\`\`\`json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600
}
\`\`\`

### Users

#### GET /users
List all users with pagination.

**Query Parameters:**
- \`page\` (integer): Page number (default: 1)
- \`limit\` (integer): Items per page (default: 20)
- \`sort\` (string): Sort field (default: created_at)

**Response:**
\`\`\`json
{
  "data": [
    {
      "id": "123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "pages": 5
  }
}
\`\`\`

Include:
- All endpoints with descriptions
- Request/response schemas
- Error responses
- Rate limiting info
- Authentication details`
  },
  graphqlApi: {
    name: 'GraphQL API Schema',
    icon: FileJson,
    description: 'GraphQL schema documentation with queries and mutations',
    format: 'graphql',
    prompt: `Generate GraphQL API documentation for {projectName}:

# GraphQL API Reference

## Schema Overview

\`\`\`graphql
type Query {
  # Get current user
  me: User
  
  # Get user by ID
  user(id: ID!): User
  
  # List users with filtering
  users(
    filter: UserFilter
    page: Int = 1
    limit: Int = 20
  ): UserConnection!
}

type Mutation {
  # User authentication
  login(email: String!, password: String!): AuthPayload!
  
  # Create new user
  createUser(input: CreateUserInput!): User!
  
  # Update user
  updateUser(id: ID!, input: UpdateUserInput!): User!
}

type User {
  id: ID!
  email: String!
  name: String!
  createdAt: DateTime!
  posts: [Post!]!
}

type AuthPayload {
  token: String!
  user: User!
}
\`\`\`

## Query Examples

### Get Current User
\`\`\`graphql
query GetMe {
  me {
    id
    name
    email
    posts {
      id
      title
    }
  }
}
\`\`\`

Include:
- Complete type definitions
- Query/mutation examples
- Subscription documentation
- Error handling
- Authentication flow`
  },
  webhooks: {
    name: 'Webhooks Documentation',
    icon: Shield,
    description: 'Webhook events and payload documentation',
    format: 'webhooks',
    prompt: `Generate webhook documentation for {projectName}:

# Webhooks Reference

## Overview
Webhooks allow you to receive real-time notifications when events occur in {projectName}.

## Configuration
POST https://api.{projectName}.com/v1/webhooks

\`\`\`json
{
  "url": "https://your-server.com/webhook",
  "events": ["user.created", "order.completed"],
  "secret": "your-webhook-secret"
}
\`\`\`

## Events

### user.created
Triggered when a new user is created.

**Payload:**
\`\`\`json
{
  "event": "user.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "user": {
      "id": "123",
      "email": "new@example.com",
      "name": "New User"
    }
  }
}
\`\`\`

### order.completed
Triggered when an order is completed.

**Payload:**
\`\`\`json
{
  "event": "order.completed",
  "timestamp": "2024-01-15T10:35:00Z",
  "data": {
    "order": {
      "id": "456",
      "total": 99.99,
      "items": [...]
    }
  }
}
\`\`\`

Include:
- All webhook events
- Payload schemas
- Security (HMAC signatures)
- Retry logic
- Error handling`
  }
}

export function ApiDocsView({ projectId, projectName = 'Project' }: ApiDocsViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof apiDocTemplates>('restApi')
  const [apiBaseUrl, setApiBaseUrl] = useState('https://api.example.com/v1')
  const [authType, setAuthType] = useState('bearer')
  const [includeExamples, setIncludeExamples] = useState(true)
  const [includeSchemas, setIncludeSchemas] = useState(true)
  const [customEndpoints, setCustomEndpoints] = useState('')
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const { copyToClipboard } = useCopyClipboard()

  const template = apiDocTemplates[selectedTemplate]

  const handleGenerateApiDocs = () => {
    setGeneratorOpen(true)
  }

  const handleCopyPrompt = async () => {
    const prompt = template.prompt.replace('{projectName}', projectName)
    await copyToClipboard(prompt, {
      successMessage: 'API documentation prompt copied'
    })
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Code2 className="h-6 w-6" />
          API Documentation
        </h2>
        <p className="text-muted-foreground mt-1">
          Generate API reference documentation for {projectName}
        </p>
      </div>

      <Tabs defaultValue="templates" className="flex-1">
        <TabsList>
          <TabsTrigger value="templates">API Templates</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(apiDocTemplates).map(([key, template]) => {
              const Icon = template.icon
              return (
                <Card 
                  key={key}
                  className={`cursor-pointer transition-all ${
                    selectedTemplate === key ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedTemplate(key as keyof typeof apiDocTemplates)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription>{template.description}</CardDescription>
                        </div>
                      </div>
                      {selectedTemplate === key && (
                        <Badge>Selected</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">{template.format}</Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateApiDocs} className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate API Documentation
            </Button>
            <Button variant="outline" onClick={handleCopyPrompt}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure your API details for accurate documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>

              <div className="space-y-2">
                <Label>Authentication Type</Label>
                <Select value={authType} onValueChange={setAuthType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="apikey">API Key</SelectItem>
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                    <SelectItem value="none">No Auth</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Custom Endpoints (Optional)</Label>
                <Textarea
                  value={customEndpoints}
                  onChange={(e) => setCustomEndpoints(e.target.value)}
                  placeholder="List specific endpoints to document..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentation Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="examples"
                  checked={includeExamples}
                  onCheckedChange={(checked) => setIncludeExamples(!!checked)}
                />
                <Label htmlFor="examples" className="cursor-pointer">
                  Include code examples in multiple languages
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="schemas"
                  checked={includeSchemas}
                  onCheckedChange={(checked) => setIncludeSchemas(!!checked)}
                />
                <Label htmlFor="schemas" className="cursor-pointer">
                  Include detailed schema definitions
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="postman" defaultChecked />
                <Label htmlFor="postman" className="cursor-pointer">
                  Generate Postman collection
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="openapi" defaultChecked />
                <Label htmlFor="openapi" className="cursor-pointer">
                  Generate OpenAPI specification
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Documentation Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Documentation Format</Label>
                <Select defaultValue="markdown">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="openapi">OpenAPI 3.0</SelectItem>
                    <SelectItem value="postman">Postman Collection</SelectItem>
                    <SelectItem value="insomnia">Insomnia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Code Examples Languages</Label>
                <Select defaultValue="multiple">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple">Multiple Languages</SelectItem>
                    <SelectItem value="javascript">JavaScript Only</SelectItem>
                    <SelectItem value="python">Python Only</SelectItem>
                    <SelectItem value="curl">cURL Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Version</Label>
                <Input defaultValue="v1" placeholder="API version" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AssetGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        assetType="api-documentation"
        onSuccess={(content, name) => {
          // Handle success
        }}
      />
    </div>
  )
}