import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AssetGeneratorWrapper } from '@/components/assets/asset-generator-wrapper'
import { Database, Sparkles, Copy, Table2, Network, Key } from 'lucide-react'
import { useCopyClipboard } from '@/hooks/utility-hooks/use-copy-clipboard'

interface DatabaseSchemaViewProps {
  projectId: number
  projectName?: string
}

const databaseTemplates = {
  erd: {
    name: 'Entity Relationship Diagram',
    icon: Network,
    description: 'Complete database ERD with relationships',
    prompt: `Create an Entity Relationship Diagram for {projectName} database:

\`\`\`mermaid
erDiagram
    %% User Management
    USER {
        string id PK
        string email UK
        string name
        string password_hash
        datetime created_at
        datetime updated_at
    }
    
    %% Projects
    PROJECT {
        string id PK
        string name
        string description
        string owner_id FK
        datetime created_at
        datetime updated_at
    }
    
    %% Tasks
    TASK {
        string id PK
        string title
        text description
        string project_id FK
        string assignee_id FK
        string status
        datetime due_date
        datetime created_at
        datetime updated_at
    }
    
    %% Comments
    COMMENT {
        string id PK
        text content
        string task_id FK
        string author_id FK
        datetime created_at
    }
    
    %% Relationships
    USER ||--o{ PROJECT : owns
    USER ||--o{ TASK : assigned
    PROJECT ||--o{ TASK : contains
    TASK ||--o{ COMMENT : has
    USER ||--o{ COMMENT : writes
\`\`\`

Include documentation for:
- Table purposes
- Column descriptions
- Relationship explanations
- Indexes and constraints
- Data types and validations`
  },
  schema: {
    name: 'Database Schema Documentation',
    icon: Table2,
    description: 'Detailed schema with all tables and columns',
    prompt: `Generate comprehensive database schema documentation for {projectName}:

# Database Schema

## Overview
- Database: PostgreSQL 14
- Character Set: UTF-8
- Collation: en_US.UTF-8

## Tables

### users
User accounts and authentication data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| name | VARCHAR(100) | NOT NULL | Display name |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt password hash |
| role | ENUM | DEFAULT 'user' | User role (admin, user) |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

**Indexes:**
- \`idx_users_email\` ON (email)
- \`idx_users_created_at\` ON (created_at)

### projects
Project management data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Project identifier |
| name | VARCHAR(255) | NOT NULL | Project name |
| description | TEXT | | Project description |
| owner_id | UUID | FOREIGN KEY (users.id) | Project owner |
| status | VARCHAR(50) | DEFAULT 'active' | Project status |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation time |

Include:
- All tables with descriptions
- Column specifications
- Foreign key relationships
- Indexes and performance considerations
- Migration notes`
  },
  migrations: {
    name: 'Database Migration Plan',
    icon: Key,
    description: 'Migration scripts and version history',
    prompt: `Create a database migration plan for {projectName}:

# Database Migrations

## Current Version: 1.5.0

### Migration History

#### Version 1.0.0 - Initial Schema
\`\`\`sql
-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
\`\`\`

#### Version 1.1.0 - Add Tasks
\`\`\`sql
-- Create tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(id),
    assignee_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
\`\`\`

Include:
- Complete migration history
- Rollback procedures
- Data migration scripts
- Performance impact notes
- Testing procedures`
  }
}

export function DatabaseSchemaView({ projectId, projectName = 'Project' }: DatabaseSchemaViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof databaseTemplates>('erd')
  const [dbType, setDbType] = useState('postgresql')
  const [includeIndexes, setIncludeIndexes] = useState(true)
  const [includeConstraints, setIncludeConstraints] = useState(true)
  const [includeSampleData, setIncludeSampleData] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const { copyToClipboard } = useCopyClipboard()

  const template = databaseTemplates[selectedTemplate]

  const handleGenerateSchema = () => {
    setGeneratorOpen(true)
  }

  const handleCopyPrompt = async () => {
    const prompt = template.prompt.replace('{projectName}', projectName)
    await copyToClipboard(prompt, {
      successMessage: 'Database schema prompt copied'
    })
  }

  return (
    <div className='h-full flex flex-col p-6 space-y-6'>
      <div>
        <h2 className='text-2xl font-bold flex items-center gap-2'>
          <Database className='h-6 w-6' />
          Database Schema
        </h2>
        <p className='text-muted-foreground mt-1'>Generate database documentation for {projectName}</p>
      </div>

      <Tabs defaultValue='templates' className='flex-1'>
        <TabsList>
          <TabsTrigger value='templates'>Schema Templates</TabsTrigger>
          <TabsTrigger value='config'>Configuration</TabsTrigger>
          <TabsTrigger value='best-practices'>Best Practices</TabsTrigger>
        </TabsList>

        <TabsContent value='templates' className='space-y-4'>
          <div className='grid gap-4'>
            {Object.entries(databaseTemplates).map(([key, template]) => {
              const Icon = template.icon
              return (
                <Card
                  key={key}
                  className={`cursor-pointer transition-all ${selectedTemplate === key ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedTemplate(key as keyof typeof databaseTemplates)}
                >
                  <CardHeader>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center gap-3'>
                        <Icon className='h-5 w-5 text-primary' />
                        <div>
                          <CardTitle className='text-lg'>{template.name}</CardTitle>
                          <CardDescription>{template.description}</CardDescription>
                        </div>
                      </div>
                      {selectedTemplate === key && <Badge>Selected</Badge>}
                    </div>
                  </CardHeader>
                </Card>
              )
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Documentation Options</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='indexes'
                  checked={includeIndexes}
                  onCheckedChange={(checked) => setIncludeIndexes(!!checked)}
                />
                <Label htmlFor='indexes' className='cursor-pointer'>
                  Include index definitions
                </Label>
              </div>

              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='constraints'
                  checked={includeConstraints}
                  onCheckedChange={(checked) => setIncludeConstraints(!!checked)}
                />
                <Label htmlFor='constraints' className='cursor-pointer'>
                  Include constraints and validations
                </Label>
              </div>

              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='sample'
                  checked={includeSampleData}
                  onCheckedChange={(checked) => setIncludeSampleData(!!checked)}
                />
                <Label htmlFor='sample' className='cursor-pointer'>
                  Include sample data
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className='flex gap-2'>
            <Button onClick={handleGenerateSchema} className='flex-1'>
              <Sparkles className='h-4 w-4 mr-2' />
              Generate Database Documentation
            </Button>
            <Button variant='outline' onClick={handleCopyPrompt}>
              <Copy className='h-4 w-4' />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value='config' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
              <CardDescription>Specify your database details for accurate documentation</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <Label>Database Type</Label>
                <Select value={dbType} onValueChange={setDbType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='postgresql'>PostgreSQL</SelectItem>
                    <SelectItem value='mysql'>MySQL</SelectItem>
                    <SelectItem value='sqlite'>SQLite</SelectItem>
                    <SelectItem value='mongodb'>MongoDB</SelectItem>
                    <SelectItem value='redis'>Redis</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Naming Convention</Label>
                <Select defaultValue='snake_case'>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='snake_case'>snake_case</SelectItem>
                    <SelectItem value='camelCase'>camelCase</SelectItem>
                    <SelectItem value='PascalCase'>PascalCase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label>Documentation Style</Label>
                <Select defaultValue='detailed'>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='minimal'>Minimal</SelectItem>
                    <SelectItem value='standard'>Standard</SelectItem>
                    <SelectItem value='detailed'>Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='best-practices' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Database Best Practices</CardTitle>
              <CardDescription>Guidelines for optimal database design</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Normalization</h4>
                  <p className='text-sm text-muted-foreground'>
                    Follow 3NF for transactional data, denormalize for read-heavy workloads
                  </p>
                </div>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Indexing Strategy</h4>
                  <p className='text-sm text-muted-foreground'>
                    Index foreign keys, frequently queried columns, and sort fields
                  </p>
                </div>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Data Types</h4>
                  <p className='text-sm text-muted-foreground'>
                    Use appropriate data types to optimize storage and query performance
                  </p>
                </div>
                <div className='p-4 border rounded-lg'>
                  <h4 className='font-medium mb-2'>Constraints</h4>
                  <p className='text-sm text-muted-foreground'>
                    Implement constraints at database level for data integrity
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AssetGeneratorWrapper
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        assetType='database-doc'
        projectContext={{
          name: projectName,
          description: `Database schema documentation for ${projectName}`
        }}
        onSuccess={(content, name) => {
          // Handle success
        }}
      />
    </div>
  )
}
