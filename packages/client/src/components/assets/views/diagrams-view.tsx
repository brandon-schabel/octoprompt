import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DocumentationGeneratorDialog } from '@/components/assets/documentation-generator-dialog'
import { GitBranch, Sparkles, Copy, Workflow, Activity, Share2, Layers3 } from 'lucide-react'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

interface DiagramsViewProps {
  projectId: number
  projectName?: string
}

const diagramTemplates = {
  flowchart: {
    name: 'Flowchart',
    icon: Workflow,
    description: 'Process flows and decision trees',
    syntax: 'graph TD',
    prompt: `Create a flowchart for {projectName}:

\`\`\`mermaid
graph TD
    Start([Start]) --> Input[/User Input/]
    Input --> Validate{Valid?}
    Validate -->|Yes| Process[Process Data]
    Validate -->|No| Error[Show Error]
    Error --> Input
    Process --> Store[(Store in DB)]
    Store --> Notify[Send Notification]
    Notify --> End([End])
    
    style Start fill:#e1f5e1
    style End fill:#e1f5e1
    style Error fill:#ffe1e1
    style Process fill:#e1e5ff
\`\`\`

Create a detailed flowchart showing:
- Main process flow
- Decision points
- Error handling paths
- Success paths
- Key integrations`
  },
  sequence: {
    name: 'Sequence Diagram',
    icon: Activity,
    description: 'Interaction between components',
    syntax: 'sequenceDiagram',
    prompt: `Create a sequence diagram for {projectName}:

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database
    participant E as Email Service
    
    U->>F: Login Request
    F->>A: POST /auth/login
    A->>D: Validate Credentials
    D-->>A: User Data
    A->>A: Generate Token
    A->>E: Send Login Email
    A-->>F: Auth Token
    F->>F: Store Token
    F-->>U: Dashboard
    
    Note over U,F: User is now authenticated
    
    U->>F: Request Data
    F->>A: GET /api/data
    Note right of A: Check Auth Token
    A->>D: Query Data
    D-->>A: Results
    A-->>F: JSON Response
    F-->>U: Display Data
\`\`\`

Show interactions for:
- Authentication flow
- Data operations
- Error scenarios
- Async operations`
  },
  stateDiagram: {
    name: 'State Diagram',
    icon: Share2,
    description: 'State machines and transitions',
    syntax: 'stateDiagram-v2',
    prompt: `Create a state diagram for {projectName}:

\`\`\`mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> InReview: Submit
    InReview --> Approved: Approve
    InReview --> Rejected: Reject
    InReview --> Draft: Request Changes
    Rejected --> Draft: Revise
    Approved --> Published: Publish
    Published --> Archived: Archive
    Archived --> [*]
    
    Draft: Draft State
    Draft: - Can edit
    Draft: - Can delete
    
    InReview: Under Review
    InReview: - Read only
    InReview: - Awaiting approval
    
    Published: Published
    Published: - Public visible
    Published: - Version locked
\`\`\`

Define states for:
- Object lifecycle
- Valid transitions
- State properties
- Trigger events`
  },
  userJourney: {
    name: 'User Journey',
    icon: Layers3,
    description: 'User experience flow',
    syntax: 'journey',
    prompt: `Create a user journey diagram for {projectName}:

\`\`\`mermaid
journey
    title User Journey: First Time Setup
    section Discovery
      Visit Website: 5: User
      Read Features: 4: User
      Check Pricing: 3: User
    section Sign Up
      Create Account: 5: User
      Verify Email: 4: User
      Complete Profile: 3: User
    section Onboarding
      Welcome Tour: 5: User
      Setup Workspace: 4: User
      Invite Team: 3: User
    section First Use
      Create Project: 5: User
      Add Content: 4: User
      Share Results: 5: User
\`\`\`

Map the journey for:
- New user onboarding
- Key task completion
- Problem resolution
- Feature discovery`
  },
  classDiagram: {
    name: 'Class Diagram',
    icon: GitBranch,
    description: 'Object relationships and structure',
    syntax: 'classDiagram',
    prompt: `Create a class diagram for {projectName}:

\`\`\`mermaid
classDiagram
    class User {
        +String id
        +String email
        +String name
        -String passwordHash
        +login()
        +logout()
        +updateProfile()
    }
    
    class Project {
        +String id
        +String name
        +String description
        +Date createdAt
        +addMember()
        +removeMember()
        +updateSettings()
    }
    
    class Task {
        +String id
        +String title
        +String status
        +Date dueDate
        +assign()
        +complete()
        +update()
    }
    
    class Comment {
        +String id
        +String content
        +Date timestamp
        +edit()
        +delete()
    }
    
    User "1" --> "0..*" Project : owns
    User "1" --> "0..*" Task : assigned
    Project "1" --> "0..*" Task : contains
    Task "1" --> "0..*" Comment : has
    User "1" --> "0..*" Comment : writes
\`\`\`

Show:
- Class properties
- Methods
- Relationships
- Inheritance`
  }
}

export function DiagramsView({ projectId, projectName = 'Project' }: DiagramsViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof diagramTemplates>('flowchart')
  const [customDescription, setCustomDescription] = useState('')
  const [diagramTheme, setDiagramTheme] = useState('default')
  const [diagramDirection, setDiagramDirection] = useState('TD')
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [diagramPrompt, setDiagramPrompt] = useState('')
  const { copyToClipboard } = useCopyClipboard()

  const template = diagramTemplates[selectedTemplate]

  const handleGenerateDiagram = () => {
    setGeneratorOpen(true)
  }

  const handleCopyPrompt = async () => {
    const prompt = customDescription || template.prompt.replace('{projectName}', projectName)
    await copyToClipboard(prompt, {
      successMessage: 'Diagram prompt copied'
    })
  }

  return (
    <div className='h-full flex flex-col p-6 space-y-6'>
      <div>
        <h2 className='text-2xl font-bold flex items-center gap-2'>
          <GitBranch className='h-6 w-6' />
          Diagrams & Visualizations
        </h2>
        <p className='text-muted-foreground mt-1'>Create various diagrams to visualize {projectName}</p>
      </div>

      <Tabs defaultValue='templates' className='flex-1'>
        <TabsList>
          <TabsTrigger value='templates'>Diagram Types</TabsTrigger>
          <TabsTrigger value='custom'>Custom Diagram</TabsTrigger>
          <TabsTrigger value='mermaid-help'>Mermaid Guide</TabsTrigger>
        </TabsList>

        <TabsContent value='templates' className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {Object.entries(diagramTemplates).map(([key, template]) => {
              const Icon = template.icon
              return (
                <Card
                  key={key}
                  className={`cursor-pointer transition-all ${selectedTemplate === key ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedTemplate(key as keyof typeof diagramTemplates)}
                >
                  <CardHeader className='pb-3'>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center gap-3'>
                        <Icon className='h-5 w-5 text-primary' />
                        <div>
                          <CardTitle className='text-base'>{template.name}</CardTitle>
                          <CardDescription className='text-sm'>{template.description}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='flex items-center justify-between'>
                      <Badge variant='secondary' className='text-xs font-mono'>
                        {template.syntax}
                      </Badge>
                      {selectedTemplate === key && <Badge>Selected</Badge>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Diagram Options</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='space-y-2'>
                  <Label>Theme</Label>
                  <Select value={diagramTheme} onValueChange={setDiagramTheme}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='default'>Default</SelectItem>
                      <SelectItem value='dark'>Dark</SelectItem>
                      <SelectItem value='forest'>Forest</SelectItem>
                      <SelectItem value='neutral'>Neutral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className='space-y-2'>
                  <Label>Direction (Flowcharts)</Label>
                  <Select value={diagramDirection} onValueChange={setDiagramDirection}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='TD'>Top Down</SelectItem>
                      <SelectItem value='LR'>Left to Right</SelectItem>
                      <SelectItem value='BT'>Bottom Up</SelectItem>
                      <SelectItem value='RL'>Right to Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className='flex gap-2'>
            <Button onClick={handleGenerateDiagram} className='flex-1'>
              <Sparkles className='h-4 w-4 mr-2' />
              Generate Diagram
            </Button>
            <Button variant='outline' onClick={handleCopyPrompt}>
              <Copy className='h-4 w-4' />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value='custom' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Custom Diagram</CardTitle>
              <CardDescription>Describe any diagram you need</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Diagram Description</Label>
                <Textarea
                  placeholder='Describe the diagram you want to create. Be specific about nodes, relationships, and any special requirements...'
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className='min-h-[200px]'
                />
              </div>

              <div className='space-y-2'>
                <Label>Diagram Type</Label>
                <Select defaultValue='auto'>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='auto'>Auto-detect</SelectItem>
                    <SelectItem value='flowchart'>Flowchart</SelectItem>
                    <SelectItem value='sequence'>Sequence</SelectItem>
                    <SelectItem value='state'>State</SelectItem>
                    <SelectItem value='er'>Entity Relationship</SelectItem>
                    <SelectItem value='gantt'>Gantt Chart</SelectItem>
                    <SelectItem value='pie'>Pie Chart</SelectItem>
                    <SelectItem value='mindmap'>Mind Map</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerateDiagram} className='w-full'>
                <Sparkles className='h-4 w-4 mr-2' />
                Generate Custom Diagram
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='mermaid-help' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Mermaid Diagram Syntax Guide</CardTitle>
              <CardDescription>Quick reference for creating Mermaid diagrams</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Flowchart Basics</h4>
                  <pre className='text-xs bg-muted p-2 rounded'>
                    {`graph TD
    A[Rectangle] --> B(Rounded)
    B --> C{Diamond}
    C -->|Yes| D[Result 1]
    C -->|No| E[Result 2]`}
                  </pre>
                </div>

                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Sequence Diagram</h4>
                  <pre className='text-xs bg-muted p-2 rounded'>
                    {`sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi!
    Note over Alice,Bob: Conversation`}
                  </pre>
                </div>

                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Node Shapes</h4>
                  <p className='text-sm text-muted-foreground'>
                    • [Text] - Rectangle
                    <br />
                    • (Text) - Rounded
                    <br />• {`{Text}`} - Diamond
                    <br />
                    • ((Text)) - Circle
                    <br />• [/Text/] - Parallelogram
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DocumentationGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        documentationType='mermaid-diagram'
        projectContext={{
          name: projectName,
          description: diagramPrompt || template.prompt.replace('{projectName}', projectName || 'Project')
        }}
        onSuccess={(content, name) => {
          // Handle success - diagram generated
        }}
      />
    </div>
  )
}
