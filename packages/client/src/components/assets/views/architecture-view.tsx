import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AssetGeneratorDialog } from '@/components/assets/asset-generator-dialog'
import { Building2, Sparkles, Copy, GitBranch, Network, Layers } from 'lucide-react'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

interface ArchitectureViewProps {
  projectId: number
  projectName?: string
}

const architectureTemplates = {
  systemOverview: {
    name: 'System Architecture Overview',
    icon: Network,
    description: 'High-level system architecture with all components',
    diagramType: 'graph TD',
    prompt: `Create a Mermaid diagram showing the complete system architecture for {projectName}:

\`\`\`mermaid
graph TD
    %% Frontend Layer
    subgraph "Frontend"
        UI[React UI]
        State[State Management]
        Router[Router]
    end
    
    %% API Layer
    subgraph "API Gateway"
        REST[REST API]
        WS[WebSocket]
        Auth[Authentication]
    end
    
    %% Backend Services
    subgraph "Backend Services"
        Service1[Service 1]
        Service2[Service 2]
        Queue[Message Queue]
    end
    
    %% Data Layer
    subgraph "Data Storage"
        DB[(Database)]
        Cache[(Cache)]
        Files[File Storage]
    end
    
    %% Connections
    UI --> REST
    UI --> WS
    REST --> Auth
    Auth --> Service1
    Service1 --> DB
    Service1 --> Cache
    Service2 --> Queue
    Queue --> Files
\`\`\`

Include detailed documentation explaining:
- Each component's responsibility
- Communication protocols
- Data flow patterns
- Security boundaries`
  },
  dataFlow: {
    name: 'Data Flow Diagram',
    icon: GitBranch,
    description: 'Shows how data moves through the system',
    diagramType: 'graph LR',
    prompt: `Create a data flow diagram for {projectName} showing:

\`\`\`mermaid
graph LR
    %% User Actions
    User[User Input] --> Validation{Validate}
    Validation -->|Valid| Processing[Process Data]
    Validation -->|Invalid| Error[Error Response]
    
    %% Processing Pipeline
    Processing --> Transform[Transform]
    Transform --> Store[(Store in DB)]
    Store --> Cache[(Update Cache)]
    
    %% Response Flow
    Cache --> Response[Format Response]
    Response --> User
    
    %% Background Jobs
    Store --> Queue[Job Queue]
    Queue --> Worker[Background Worker]
    Worker --> Notification[Send Notifications]
\`\`\`

Document:
- Data transformation steps
- Validation rules
- Error handling
- Performance optimizations`
  },
  componentDiagram: {
    name: 'Component Diagram',
    icon: Layers,
    description: 'Detailed component relationships and dependencies',
    diagramType: 'classDiagram',
    prompt: `Generate a component diagram for {projectName}:

\`\`\`mermaid
classDiagram
    %% Core Components
    class UserInterface {
        +renderComponents()
        +handleUserInput()
        +updateState()
    }
    
    class APIClient {
        +get()
        +post()
        +put()
        +delete()
    }
    
    class AuthService {
        +login()
        +logout()
        +validateToken()
    }
    
    class DataService {
        +fetchData()
        +saveData()
        +cacheData()
    }
    
    %% Relationships
    UserInterface --> APIClient : uses
    APIClient --> AuthService : authenticates
    APIClient --> DataService : requests data
    DataService --> Database : persists
    DataService --> CacheLayer : caches
\`\`\`

Explain:
- Component responsibilities
- Interface definitions
- Dependency management
- Extension points`
  },
  deploymentDiagram: {
    name: 'Deployment Architecture',
    icon: Building2,
    description: 'Infrastructure and deployment topology',
    diagramType: 'graph TB',
    prompt: `Create a deployment architecture diagram for {projectName}:

\`\`\`mermaid
graph TB
    %% Cloud Infrastructure
    subgraph "Cloud Provider"
        subgraph "Production Environment"
            LB[Load Balancer]
            subgraph "App Cluster"
                App1[App Instance 1]
                App2[App Instance 2]
                App3[App Instance 3]
            end
            subgraph "Data Tier"
                DB[(Primary DB)]
                DBR[(Read Replica)]
                Cache[(Redis Cache)]
            end
        end
        
        subgraph "Supporting Services"
            CDN[CDN]
            S3[Object Storage]
            Queue[Message Queue]
        end
    end
    
    %% Connections
    Internet --> CDN
    CDN --> LB
    LB --> App1
    LB --> App2
    LB --> App3
    App1 --> DB
    App2 --> DBR
    App3 --> Cache
    App1 --> Queue
\`\`\`

Include:
- Infrastructure specifications
- Scaling strategies
- Disaster recovery
- Monitoring setup`
  }
}

export function ArchitectureView({ projectId, projectName = 'Project' }: ArchitectureViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof architectureTemplates>('systemOverview')
  const [customPrompt, setCustomPrompt] = useState('')
  const [diagramStyle, setDiagramStyle] = useState('default')
  const [includeDocumentation, setIncludeDocumentation] = useState(true)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const { copyToClipboard } = useCopyClipboard()

  const template = architectureTemplates[selectedTemplate]

  const handleGenerateArchitecture = () => {
    setGeneratorOpen(true)
  }

  const handleCopyPrompt = async () => {
    const prompt = customPrompt || template.prompt.replace('{projectName}', projectName)
    await copyToClipboard(prompt, {
      successMessage: 'Architecture prompt copied'
    })
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Architecture Diagrams
        </h2>
        <p className="text-muted-foreground mt-1">
          Create architecture diagrams and documentation for {projectName}
        </p>
      </div>

      <Tabs defaultValue="templates" className="flex-1">
        <TabsList>
          <TabsTrigger value="templates">Diagram Templates</TabsTrigger>
          <TabsTrigger value="custom">Custom Diagram</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(architectureTemplates).map(([key, template]) => {
              const Icon = template.icon
              return (
                <Card 
                  key={key}
                  className={`cursor-pointer transition-all ${
                    selectedTemplate === key ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedTemplate(key as keyof typeof architectureTemplates)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription className="text-sm">{template.description}</CardDescription>
                        </div>
                      </div>
                      {selectedTemplate === key && (
                        <Badge>Selected</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" className="text-xs">
                      {template.diagramType}
                    </Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Diagram Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Diagram Style</Label>
                  <Select value={diagramStyle} onValueChange={setDiagramStyle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default</SelectItem>
                      <SelectItem value="dark">Dark Theme</SelectItem>
                      <SelectItem value="sketch">Hand-drawn</SelectItem>
                      <SelectItem value="clean">Minimalist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Detail Level</Label>
                  <Select defaultValue="detailed">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high-level">High Level</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleGenerateArchitecture} className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Architecture Diagram
            </Button>
            <Button variant="outline" onClick={handleCopyPrompt}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Architecture Diagram</CardTitle>
              <CardDescription>
                Design your own architecture diagram with specific requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Diagram Description</Label>
                <Textarea
                  placeholder="Describe the architecture diagram you need..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="min-h-[150px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Diagram Type</Label>
                <Select defaultValue="flowchart">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flowchart">Flowchart</SelectItem>
                    <SelectItem value="sequence">Sequence Diagram</SelectItem>
                    <SelectItem value="class">Class Diagram</SelectItem>
                    <SelectItem value="state">State Diagram</SelectItem>
                    <SelectItem value="er">Entity Relationship</SelectItem>
                    <SelectItem value="gantt">Gantt Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerateArchitecture} className="w-full">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Custom Diagram
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Architecture Examples</CardTitle>
              <CardDescription>
                Common architecture patterns and best practices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Microservices Architecture</h4>
                  <p className="text-sm text-muted-foreground">
                    Distributed system with independent services communicating via APIs
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Event-Driven Architecture</h4>
                  <p className="text-sm text-muted-foreground">
                    Components communicate through events and message queues
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Serverless Architecture</h4>
                  <p className="text-sm text-muted-foreground">
                    Cloud functions triggered by events with managed infrastructure
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AssetGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        assetType="mermaid-diagram"
        onSuccess={(content, name) => {
          // Handle success
        }}
      />
    </div>
  )
}