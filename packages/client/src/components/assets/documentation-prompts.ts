/**
 * Centralized documentation prompt templates for asset generation
 * These prompts are designed to generate high-quality documentation
 * with proper structure, examples, and best practices
 */

export const DOCUMENTATION_PROMPTS = {
  // Project Documentation Templates
  projectDocs: {
    comprehensive: {
      name: 'Comprehensive Project Documentation',
      category: 'project',
      prompt: `Generate comprehensive project documentation that includes:

# Project Name: {projectName}

## 1. Executive Summary
- Project purpose and vision
- Key stakeholders
- Success metrics
- Timeline overview

## 2. Project Overview
### Purpose
- Problem statement
- Solution approach
- Expected outcomes

### Scope
- In scope features
- Out of scope items
- Future considerations

### Technology Stack
- Frontend technologies
- Backend technologies
- Database and storage
- Infrastructure and deployment
- Third-party integrations

## 3. Getting Started
### Prerequisites
- System requirements
- Required software
- Access permissions

### Installation
\`\`\`bash
# Step-by-step installation commands
\`\`\`

### Configuration
- Environment variables
- Configuration files
- Service connections

### Quick Start
- First-time setup
- Running locally
- Basic usage examples

## 4. Architecture
### System Architecture
- High-level overview
- Component interactions
- Data flow diagrams

### Technical Architecture
- Design patterns
- Code organization
- Module structure

### Security Architecture
- Authentication approach
- Authorization model
- Data protection

## 5. Development Guidelines
### Code Standards
- Naming conventions
- File organization
- Best practices

### Development Workflow
- Branch strategy
- Commit guidelines
- Code review process

### Testing Strategy
- Unit testing
- Integration testing
- E2E testing

## 6. API Documentation
### REST API
- Endpoints overview
- Authentication
- Request/Response formats
- Error handling

### WebSocket Events
- Event types
- Message formats
- Connection management

## 7. Deployment
### Environments
- Development
- Staging
- Production

### Deployment Process
- Build process
- Deployment steps
- Rollback procedures

### Monitoring
- Health checks
- Logging
- Performance metrics

## 8. Maintenance
### Regular Tasks
- Database maintenance
- Log rotation
- Security updates

### Troubleshooting
- Common issues
- Debug procedures
- Support contacts

## 9. Contributing
### How to Contribute
- Contribution guidelines
- Pull request process
- Code of conduct

### Development Setup
- Local environment
- Testing requirements
- Documentation updates

## 10. Resources
### Documentation
- API reference
- User guides
- Technical specs

### Support
- Issue tracking
- Community channels
- Professional support

## Appendices
### A. Glossary
### B. Version History
### C. License Information`
    },
    
    readme: {
      name: 'README.md Template',
      category: 'project',
      prompt: `Create a professional README.md for {projectName}:

<div align="center">

# {projectName}

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

**Brief, compelling description of what {projectName} does**

[Demo](https://demo.link) | [Documentation](https://docs.link) | [Report Bug](https://github.com/link/issues)

</div>

## ✨ Features

- 🚀 **Feature 1**: Brief description
- 🎯 **Feature 2**: Brief description
- 🔧 **Feature 3**: Brief description
- 📊 **Feature 4**: Brief description

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Other requirements

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/user/{projectName}.git

# Navigate to project directory
cd {projectName}

# Install dependencies
npm install

# Start development server
npm run dev
\`\`\`

## 📖 Usage

### Basic Example

\`\`\`javascript
// Example code showing basic usage
import { Feature } from '{projectName}'

const result = Feature.doSomething()
console.log(result)
\`\`\`

### Advanced Configuration

\`\`\`javascript
// More complex example
const config = {
  option1: 'value',
  option2: true
}

Feature.configure(config)
\`\`\`

## 🏗️ Project Structure

\`\`\`
{projectName}/
├── src/              # Source files
├── tests/            # Test files
├── docs/             # Documentation
├── examples/         # Example implementations
└── scripts/          # Build and utility scripts
\`\`\`

## 🧪 Testing

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
\`\`\`

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Credit to contributors
- Inspiration sources
- Third-party libraries used

## 📞 Support

- 📧 Email: support@example.com
- 💬 Discord: [Join our server](https://discord.link)
- 📚 Documentation: [Read the docs](https://docs.link)

---

<div align="center">
Made with ❤️ by [Your Team]
</div>`
    }
  },

  // Architecture Documentation Templates
  architecture: {
    systemDiagram: {
      name: 'System Architecture Diagram',
      category: 'architecture',
      prompt: `Create a comprehensive system architecture diagram for {projectName}:

\`\`\`mermaid
graph TB
    %% User Layer
    subgraph "Users"
        EU[End Users]
        AD[Administrators]
        API[API Consumers]
    end
    
    %% Presentation Layer
    subgraph "Frontend"
        WEB[Web Application<br/>React/Next.js]
        MOB[Mobile Apps<br/>React Native]
        DESK[Desktop App<br/>Electron]
    end
    
    %% API Gateway
    subgraph "API Layer"
        GW[API Gateway<br/>Rate Limiting & Auth]
        LB[Load Balancer]
        CACHE[CDN/Cache Layer]
    end
    
    %% Application Services
    subgraph "Microservices"
        AUTH[Auth Service]
        USER[User Service]
        CORE[Core Business Logic]
        NOTIFY[Notification Service]
        REPORT[Reporting Service]
    end
    
    %% Data Layer
    subgraph "Data Storage"
        PRIM[(Primary DB<br/>PostgreSQL)]
        READ[(Read Replicas)]
        REDIS[(Redis Cache)]
        S3[Object Storage]
        SEARCH[Elasticsearch]
    end
    
    %% External Services
    subgraph "Third Party"
        EMAIL[Email Provider]
        SMS[SMS Gateway]
        PAY[Payment Gateway]
        MONITOR[Monitoring]
    end
    
    %% Connections
    EU --> WEB
    EU --> MOB
    AD --> DESK
    API --> GW
    
    WEB --> CACHE
    MOB --> GW
    DESK --> GW
    CACHE --> LB
    GW --> LB
    
    LB --> AUTH
    LB --> USER
    LB --> CORE
    LB --> NOTIFY
    LB --> REPORT
    
    AUTH --> REDIS
    USER --> PRIM
    USER --> READ
    CORE --> PRIM
    CORE --> REDIS
    CORE --> S3
    NOTIFY --> EMAIL
    NOTIFY --> SMS
    REPORT --> READ
    REPORT --> SEARCH
    
    CORE --> PAY
    All --> MONITOR
    
    classDef userLayer fill:#e1f5fe
    classDef frontLayer fill:#f3e5f5
    classDef apiLayer fill:#fff3e0
    classDef serviceLayer fill:#e8f5e9
    classDef dataLayer fill:#fce4ec
    classDef externalLayer fill:#f5f5f5
\`\`\`

## Architecture Documentation

### Overview
Provide a comprehensive explanation of the architecture including:
- Design principles
- Technology choices
- Scalability considerations
- Security measures

### Component Details
For each major component, describe:
- Purpose and responsibilities
- Technologies used
- Interfaces and APIs
- Data flows
- Error handling

### Deployment Architecture
- Infrastructure requirements
- Container orchestration
- Service mesh details
- Monitoring and observability`
    },

    dataFlow: {
      name: 'Data Flow Diagram',
      category: 'architecture',
      prompt: `Generate a detailed data flow diagram for {projectName}:

\`\`\`mermaid
graph LR
    %% Data Sources
    subgraph "Data Input"
        UI[User Interface]
        API[API Requests]
        BATCH[Batch Jobs]
        STREAM[Event Streams]
    end
    
    %% Processing Pipeline
    subgraph "Data Processing"
        VAL{Validation}
        TRANS[Transformation]
        ENRICH[Enrichment]
        AGG[Aggregation]
    end
    
    %% Storage
    subgraph "Data Storage"
        TRANS_DB[(Transactional<br/>Database)]
        ANALYTICS[(Analytics<br/>Database)]
        LAKE[(Data Lake)]
        CACHE[(Cache Layer)]
    end
    
    %% Output
    subgraph "Data Output"
        REPORT[Reports]
        DASH[Dashboards]
        EXPORT[Data Export]
        WEBHOOK[Webhooks]
    end
    
    %% Flow
    UI --> VAL
    API --> VAL
    BATCH --> VAL
    STREAM --> VAL
    
    VAL -->|Valid| TRANS
    VAL -->|Invalid| ERROR[Error Handler]
    
    TRANS --> ENRICH
    ENRICH --> AGG
    
    AGG --> TRANS_DB
    AGG --> ANALYTICS
    AGG --> LAKE
    AGG --> CACHE
    
    TRANS_DB --> REPORT
    ANALYTICS --> DASH
    LAKE --> EXPORT
    CACHE --> WEBHOOK
    
    ERROR --> LOG[Error Logs]
    ERROR --> NOTIFY[Notifications]
\`\`\`

Document:
- Data sources and formats
- Transformation rules
- Validation criteria
- Storage strategies
- Access patterns`
    }
  },

  // API Documentation Templates
  apiDocs: {
    restApi: {
      name: 'REST API Documentation',
      category: 'api',
      prompt: `Generate comprehensive REST API documentation for {projectName}:

# {projectName} REST API Documentation

## Overview

Base URL: \`https://api.{projectName}.com/v1\`

### Authentication

All API requests require authentication using Bearer tokens:

\`\`\`
Authorization: Bearer <your-token>
\`\`\`

### Rate Limiting

- 1000 requests per hour for authenticated users
- 100 requests per hour for unauthenticated users

### Response Format

All responses follow this structure:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0"
  }
}
\`\`\`

Error responses:

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
\`\`\`

## Endpoints

### Authentication

#### POST /auth/register
Create a new user account.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
\`\`\`

**Response:** 201 Created
\`\`\`json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_123",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": {
      "access": "eyJ...",
      "refresh": "eyJ...",
      "expiresIn": 3600
    }
  }
}
\`\`\`

#### POST /auth/login
Authenticate and receive tokens.

**Request:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
\`\`\`

**Response:** 200 OK
[Similar structure to register]

### Resources

#### GET /users
List all users (paginated).

**Query Parameters:**
- \`page\` (integer): Page number (default: 1)
- \`limit\` (integer): Items per page (default: 20, max: 100)
- \`sort\` (string): Sort field (default: createdAt)
- \`order\` (string): Sort order - asc/desc (default: desc)
- \`search\` (string): Search query

**Response:** 200 OK
\`\`\`json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "usr_123",
        "email": "user@example.com",
        "name": "John Doe",
        "role": "user",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
\`\`\`

#### GET /users/:id
Get a specific user.

**Response:** 200 OK
\`\`\`json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "profile": {
        "bio": "Software developer",
        "avatar": "https://..."
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  }
}
\`\`\`

#### PUT /users/:id
Update user information.

**Request:**
\`\`\`json
{
  "name": "Jane Doe",
  "profile": {
    "bio": "Senior developer"
  }
}
\`\`\`

**Response:** 200 OK
[Returns updated user object]

### Error Codes

| Code | Description |
|------|-------------|
| AUTH_REQUIRED | Authentication token missing |
| AUTH_INVALID | Invalid or expired token |
| VALIDATION_ERROR | Request validation failed |
| NOT_FOUND | Resource not found |
| RATE_LIMIT | Rate limit exceeded |
| SERVER_ERROR | Internal server error |

### Webhooks

Configure webhooks to receive real-time updates:

POST /webhooks
\`\`\`json
{
  "url": "https://your-server.com/webhook",
  "events": ["user.created", "user.updated"],
  "secret": "your-webhook-secret"
}
\`\`\``
    },

    graphql: {
      name: 'GraphQL API Schema',
      category: 'api',
      prompt: `Generate a comprehensive GraphQL schema for {projectName}:

# {projectName} GraphQL API

## Schema

\`\`\`graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

# Scalars
scalar DateTime
scalar JSON
scalar Upload

# Enums
enum Role {
  ADMIN
  USER
  GUEST
}

enum Status {
  ACTIVE
  INACTIVE
  PENDING
  ARCHIVED
}

# Interfaces
interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Types
type User implements Node & Timestamped {
  id: ID!
  email: String!
  name: String!
  role: Role!
  profile: UserProfile
  projects(
    first: Int
    after: String
    filter: ProjectFilter
  ): ProjectConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type UserProfile {
  bio: String
  avatar: String
  location: String
  website: String
}

type Project implements Node & Timestamped {
  id: ID!
  name: String!
  description: String
  owner: User!
  members(
    first: Int
    after: String
  ): UserConnection!
  tasks(
    first: Int
    after: String
    filter: TaskFilter
  ): TaskConnection!
  status: Status!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Task implements Node & Timestamped {
  id: ID!
  title: String!
  description: String
  project: Project!
  assignee: User
  status: TaskStatus!
  priority: Priority!
  dueDate: DateTime
  attachments: [Attachment!]!
  comments(
    first: Int
    after: String
  ): CommentConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Input Types
input CreateUserInput {
  email: String!
  password: String!
  name: String!
  role: Role = USER
}

input UpdateUserInput {
  name: String
  profile: UserProfileInput
}

input UserProfileInput {
  bio: String
  avatar: String
  location: String
  website: String
}

input ProjectFilter {
  status: Status
  ownerId: ID
  search: String
}

input TaskFilter {
  status: TaskStatus
  assigneeId: ID
  priority: Priority
  dueBefore: DateTime
  dueAfter: DateTime
}

# Connections (Relay-style pagination)
type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Queries
type Query {
  # User queries
  me: User
  user(id: ID!): User
  users(
    first: Int = 20
    after: String
    filter: UserFilter
    orderBy: UserOrderBy
  ): UserConnection!
  
  # Project queries
  project(id: ID!): Project
  projects(
    first: Int = 20
    after: String
    filter: ProjectFilter
    orderBy: ProjectOrderBy
  ): ProjectConnection!
  
  # Search
  search(
    query: String!
    type: SearchType
    first: Int = 20
  ): SearchResultConnection!
}

# Mutations
type Mutation {
  # Authentication
  register(input: CreateUserInput!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
  refreshToken(token: String!): AuthPayload!
  logout: Boolean!
  
  # User mutations
  updateProfile(input: UpdateUserInput!): User!
  changePassword(oldPassword: String!, newPassword: String!): User!
  
  # Project mutations
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  deleteProject(id: ID!): Boolean!
  
  # Task mutations
  createTask(input: CreateTaskInput!): Task!
  updateTask(id: ID!, input: UpdateTaskInput!): Task!
  deleteTask(id: ID!): Boolean!
  assignTask(taskId: ID!, userId: ID!): Task!
}

# Subscriptions
type Subscription {
  # Task updates
  taskUpdated(projectId: ID!): Task!
  taskCreated(projectId: ID!): Task!
  
  # Project activity
  projectActivity(projectId: ID!): Activity!
  
  # User notifications
  notification(userId: ID!): Notification!
}

# Auth
type AuthPayload {
  user: User!
  token: String!
  refreshToken: String!
  expiresIn: Int!
}
\`\`\`

## Example Queries

### Get current user with projects
\`\`\`graphql
query GetMe {
  me {
    id
    name
    email
    projects(first: 10) {
      edges {
        node {
          id
          name
          status
          tasks(filter: { status: OPEN }) {
            totalCount
          }
        }
      }
    }
  }
}
\`\`\`

### Create a new project
\`\`\`graphql
mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) {
    id
    name
    description
    owner {
      id
      name
    }
  }
}
\`\`\`

Variables:
\`\`\`json
{
  "input": {
    "name": "New Project",
    "description": "Project description"
  }
}
\`\`\``
    }
  },

  // Database Documentation Templates
  database: {
    schema: {
      name: 'Database Schema Documentation',
      category: 'database',
      prompt: `Generate complete database schema documentation for {projectName}:

# Database Schema Documentation

## Database Information
- **Type**: PostgreSQL 14+
- **Encoding**: UTF8
- **Collation**: en_US.UTF-8
- **Time Zone**: UTC

## Naming Conventions
- Tables: snake_case, plural (e.g., users, project_members)
- Columns: snake_case (e.g., created_at, user_id)
- Indexes: idx_table_column (e.g., idx_users_email)
- Foreign Keys: fk_table_column (e.g., fk_tasks_user_id)
- Constraints: chk_table_description (e.g., chk_users_email_valid)

## Tables

### users
Stores user account information and authentication data.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | | User email address |
| email_verified | BOOLEAN | NOT NULL | false | Email verification status |
| password_hash | VARCHAR(255) | NOT NULL | | Bcrypt hashed password |
| name | VARCHAR(100) | NOT NULL | | User display name |
| role | VARCHAR(50) | NOT NULL | 'user' | User role (admin, user, guest) |
| status | VARCHAR(50) | NOT NULL | 'active' | Account status |
| last_login_at | TIMESTAMP | | | Last login timestamp |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Last update time |

**Indexes:**
- idx_users_email ON (email)
- idx_users_role ON (role)
- idx_users_created_at ON (created_at DESC)

**Constraints:**
- chk_users_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
- chk_users_role CHECK (role IN ('admin', 'user', 'guest'))

### projects
Project management and organization.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | Project identifier |
| name | VARCHAR(255) | NOT NULL | | Project name |
| slug | VARCHAR(255) | UNIQUE, NOT NULL | | URL-friendly identifier |
| description | TEXT | | | Project description |
| owner_id | UUID | NOT NULL | | Project owner |
| visibility | VARCHAR(50) | NOT NULL | 'private' | Visibility setting |
| settings | JSONB | | '{}' | Project configuration |
| archived_at | TIMESTAMP | | | Archive timestamp |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Last update |

**Foreign Keys:**
- fk_projects_owner_id FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE

**Indexes:**
- idx_projects_owner_id ON (owner_id)
- idx_projects_slug ON (slug)
- idx_projects_visibility ON (visibility) WHERE archived_at IS NULL

### project_members
Many-to-many relationship for project membership.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| project_id | UUID | NOT NULL | | Project reference |
| user_id | UUID | NOT NULL | | User reference |
| role | VARCHAR(50) | NOT NULL | 'member' | Member role |
| permissions | JSONB | | '{}' | Custom permissions |
| joined_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | Join timestamp |

**Primary Key:** (project_id, user_id)

**Foreign Keys:**
- fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

### Migration History

\`\`\`sql
-- V1.0.0__Initial_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes and constraints
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE
    ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
\`\`\`

## Performance Considerations

### Indexing Strategy
- Index all foreign key columns
- Index columns used in WHERE clauses
- Consider partial indexes for filtered queries
- Use covering indexes for read-heavy queries

### Partitioning
Consider partitioning for:
- Tables > 10GB
- Time-series data
- Archival requirements

### Query Optimization
- Use EXPLAIN ANALYZE for slow queries
- Monitor pg_stat_statements
- Regular VACUUM and ANALYZE
- Consider materialized views for complex aggregations`
    },

    erd: {
      name: 'Entity Relationship Diagram',
      category: 'database',
      prompt: `Create a complete Entity Relationship Diagram for {projectName}:

\`\`\`mermaid
erDiagram
    %% Core Entities
    users {
        uuid id PK
        string email UK
        boolean email_verified
        string password_hash
        string name
        string role
        string status
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
    }
    
    projects {
        uuid id PK
        string name
        string slug UK
        text description
        uuid owner_id FK
        string visibility
        jsonb settings
        timestamp archived_at
        timestamp created_at
        timestamp updated_at
    }
    
    project_members {
        uuid project_id PK,FK
        uuid user_id PK,FK
        string role
        jsonb permissions
        timestamp joined_at
    }
    
    tasks {
        uuid id PK
        string title
        text description
        uuid project_id FK
        uuid assignee_id FK
        uuid reporter_id FK
        string status
        string priority
        integer story_points
        timestamp due_date
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }
    
    comments {
        uuid id PK
        text content
        uuid task_id FK
        uuid author_id FK
        uuid parent_id FK
        boolean edited
        timestamp edited_at
        timestamp created_at
    }
    
    attachments {
        uuid id PK
        string filename
        string mime_type
        integer size_bytes
        string storage_path
        uuid uploaded_by FK
        uuid task_id FK
        timestamp created_at
    }
    
    activity_logs {
        uuid id PK
        string entity_type
        uuid entity_id
        string action
        jsonb changes
        uuid user_id FK
        string ip_address
        timestamp created_at
    }
    
    %% Relationships
    users ||--o{ projects : owns
    users ||--o{ project_members : has
    projects ||--o{ project_members : contains
    projects ||--o{ tasks : has
    users ||--o{ tasks : assigned_to
    users ||--o{ tasks : reported_by
    tasks ||--o{ comments : has
    users ||--o{ comments : writes
    comments ||--o{ comments : replies_to
    tasks ||--o{ attachments : has
    users ||--o{ attachments : uploads
    users ||--o{ activity_logs : generates
    
    %% Audit relationships
    projects ||--o{ activity_logs : tracked_in
    tasks ||--o{ activity_logs : tracked_in
\`\`\`

## Relationship Details

### One-to-Many Relationships
1. **users → projects**: A user can own multiple projects
2. **projects → tasks**: A project contains multiple tasks
3. **tasks → comments**: A task can have multiple comments
4. **tasks → attachments**: A task can have multiple file attachments

### Many-to-Many Relationships
1. **users ↔ projects** (via project_members): Users can be members of multiple projects
2. **users ↔ tasks** (via assignments): Users can be assigned to multiple tasks

### Self-Referential Relationships
1. **comments → comments**: Comments can have nested replies

## Indexes and Performance

### Primary Indexes
- All primary keys are automatically indexed
- UUID primary keys for distributed systems

### Secondary Indexes
- Foreign key columns for JOIN performance
- Frequently queried columns (email, slug, status)
- Composite indexes for common query patterns

### Constraints
- Referential integrity via foreign keys
- Unique constraints on business keys
- Check constraints for data validation
- NOT NULL constraints for required fields`
    }
  },

  // User Documentation Templates
  userGuides: {
    gettingStarted: {
      name: 'Getting Started Guide',
      category: 'user',
      prompt: `Create an engaging Getting Started guide for {projectName}:

# Welcome to {projectName}! 🎉

## What is {projectName}?

{projectName} is [brief, user-friendly description of what the product does and who it's for].

## Quick Start (5 minutes)

### Step 1: Sign Up
1. Go to [{projectName} website](https://example.com)
2. Click **"Get Started"** button
3. Enter your email and create a password
4. Check your email for verification link
5. Click the link to activate your account

![Sign up process](signup-screenshot.png)

### Step 2: Your First Project
1. After logging in, click **"Create New Project"**
2. Give your project a memorable name
3. Choose a template or start from scratch
4. Click **"Create"**

![Create project](create-project-screenshot.png)

### Step 3: Explore the Dashboard
Your dashboard is your command center:
- **Projects**: View and manage all your projects
- **Recent Activity**: See what's happening
- **Quick Actions**: Common tasks at your fingertips

![Dashboard overview](dashboard-screenshot.png)

## Key Features Tour

### 🎯 Feature 1: [Feature Name]
[What it does and why it's useful]

**Try it now:**
1. Navigate to [location]
2. Click [button/link]
3. [Next step]

### 🚀 Feature 2: [Feature Name]
[What it does and why it's useful]

**Try it now:**
1. Go to [location]
2. Select [option]
3. [Result]

### 📊 Feature 3: [Feature Name]
[What it does and why it's useful]

## Your First Task

Let's put it all together! Try this simple task:

1. Create a new [item]
2. Add some [content]
3. Share it with [someone]
4. View the results

**Congratulations!** 🎊 You've completed your first task in {projectName}.

## Tips for Success

### Do's ✅
- Start with simple projects
- Explore one feature at a time
- Use keyboard shortcuts (press '?' to see them)
- Join our community forum

### Don'ts ❌
- Don't skip the tutorial
- Don't hesitate to ask for help
- Don't forget to save your work

## Getting Help

### 💬 Live Chat
Click the chat bubble in the bottom right corner

### 📚 Help Center
Visit [help.{projectName}.com](https://help.example.com)

### 👥 Community
Join our [community forum](https://community.example.com)

### 📧 Email Support
Contact us at support@{projectName}.com

## What's Next?

Ready to dive deeper? Check out these resources:

- **[Video Tutorials](https://tutorials.example.com)** - Visual learning
- **[Best Practices Guide](https://docs.example.com/best-practices)** - Pro tips
- **[API Documentation](https://api.example.com)** - For developers
- **[Case Studies](https://examples.example.com)** - Real-world examples

## Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|--------------|-----|
| New Item | Ctrl + N | Cmd + N |
| Save | Ctrl + S | Cmd + S |
| Search | Ctrl + K | Cmd + K |
| Help | ? | ? |

---

**Remember**: Everyone starts somewhere. You've got this! 💪

*Last updated: [Date]*`
    },

    featureGuide: {
      name: 'Feature Deep Dive',
      category: 'user', 
      prompt: `Create a detailed feature guide for a specific feature in {projectName}:

# [Feature Name] - Complete Guide

## Overview

[Feature Name] helps you [what it does and key benefits]. Whether you're [use case 1] or [use case 2], this feature will [key value proposition].

## When to Use [Feature Name]

### Perfect for:
- ✅ [Scenario 1]
- ✅ [Scenario 2]
- ✅ [Scenario 3]

### Not recommended for:
- ❌ [Scenario where it's not suitable]
- ❌ [Another scenario]

## Getting Started

### Prerequisites
Before using [Feature Name], make sure you have:
- [ ] [Requirement 1]
- [ ] [Requirement 2]
- [ ] Appropriate permissions

### Accessing the Feature
1. Log in to {projectName}
2. Navigate to [Menu] → [Submenu]
3. Click on [Feature Name]

![Feature location](feature-location.png)

## Core Concepts

### Concept 1: [Name]
[Explanation of the concept with examples]

### Concept 2: [Name]
[Explanation with visual diagram if helpful]

## Step-by-Step Instructions

### Basic Usage

#### Task 1: [Common Task]
1. **Start by** [first action]
   - Tip: [Helpful tip]
2. **Then** [second action]
   - Note: [Important note]
3. **Finally** [final action]

![Step by step visual](step-by-step.png)

#### Task 2: [Another Common Task]
[Similar structure]

### Advanced Usage

#### Power User Tip 1: [Advanced Feature]
[Detailed explanation with examples]

#### Power User Tip 2: [Integration]
[How to integrate with other features]

## Best Practices

### Do's ✅
1. **Always** [best practice 1]
   - Why: [reasoning]
2. **Consider** [best practice 2]
   - Example: [example]

### Don'ts ❌
1. **Avoid** [common mistake]
   - Instead: [better approach]
2. **Never** [critical mistake]
   - Because: [consequences]

## Common Issues & Solutions

### Issue 1: [Problem Description]
**Symptoms:** [What user sees]
**Solution:** 
1. [Step 1]
2. [Step 2]

### Issue 2: [Problem Description]
**Symptoms:** [What happens]
**Quick Fix:** [Immediate solution]
**Long-term Fix:** [Proper solution]

## Examples & Use Cases

### Example 1: [Industry/Role]
"As a [role], I use [Feature Name] to [achieve goal]..."
[Detailed walkthrough]

### Example 2: [Different Industry/Role]
[Another detailed example]

## Integration with Other Features

### Works great with:
- **[Feature A]**: [How they work together]
- **[Feature B]**: [Integration benefits]

### API Integration
\`\`\`javascript
// Example code for developers
const result = await {projectName}.featureName({
  option1: 'value',
  option2: true
});
\`\`\`

## Performance Tips

- 🚀 [Tip for better performance]
- 🚀 [Another optimization]
- 🚀 [Speed improvement technique]

## FAQs

**Q: Can I [common question]?**
A: Yes! Here's how... [answer]

**Q: What happens if [scenario]?**
A: [Detailed answer with solution]

**Q: Is there a limit to [feature aspect]?**
A: [Clear answer about limitations]

## Related Resources

- 📺 [Video Tutorial: [Feature Name] in Action](link)
- 📄 [PDF Quick Reference Guide](link)
- 🔗 [API Documentation](link)
- 💡 [Blog: Creative Ways to Use [Feature Name]](link)

---

**Need more help?** Contact our support team or visit the [Help Center](link).`
    }
  },

  // Diagram Templates
  diagrams: {
    flowchart: {
      name: 'Process Flowchart',
      category: 'diagram',
      prompt: `Create a detailed process flowchart for {projectName}:

\`\`\`mermaid
flowchart TD
    %% Start and End nodes
    Start([Start Process]) --> CheckAuth{User Authenticated?}
    
    %% Authentication Path
    CheckAuth -->|No| Login[Login Page]
    Login --> Validate{Valid Credentials?}
    Validate -->|No| ShowError[Show Error Message]
    ShowError --> Login
    Validate -->|Yes| SetSession[Set Session]
    SetSession --> Dashboard
    
    CheckAuth -->|Yes| Dashboard[Load Dashboard]
    
    %% Main Process Flow
    Dashboard --> SelectAction{Select Action}
    
    SelectAction -->|Create| CreateFlow[Create New Item]
    CreateFlow --> FillForm[Fill Out Form]
    FillForm --> ValidateForm{Form Valid?}
    ValidateForm -->|No| ShowFormError[Show Validation Errors]
    ShowFormError --> FillForm
    ValidateForm -->|Yes| SaveData[(Save to Database)]
    
    SelectAction -->|Read| ReadFlow[View Items]
    ReadFlow --> LoadData[(Load from Database)]
    LoadData --> DisplayList[Display Item List]
    DisplayList --> SelectItem{Select Item?}
    SelectItem -->|Yes| ShowDetails[Show Item Details]
    SelectItem -->|No| Dashboard
    
    SelectAction -->|Update| UpdateFlow[Edit Item]
    UpdateFlow --> LoadItem[(Load Item Data)]
    LoadItem --> EditForm[Edit Form]
    EditForm --> ValidateEdit{Valid Changes?}
    ValidateEdit -->|No| ShowEditError[Show Errors]
    ShowEditError --> EditForm
    ValidateEdit -->|Yes| UpdateData[(Update Database)]
    
    SelectAction -->|Delete| DeleteFlow[Delete Item]
    DeleteFlow --> ConfirmDelete{Confirm Delete?}
    ConfirmDelete -->|No| Dashboard
    ConfirmDelete -->|Yes| DeleteData[(Delete from Database)]
    
    %% Success Flows
    SaveData --> Success[Show Success Message]
    UpdateData --> Success
    DeleteData --> Success
    Success --> Dashboard
    
    %% Styling
    classDef startEnd fill:#d4f1d4,stroke:#27ae60,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef database fill:#fce4ec,stroke:#e91e63,stroke-width:2px
    classDef error fill:#ffebee,stroke:#f44336,stroke-width:2px
    
    class Start,End startEnd
    class CreateFlow,ReadFlow,UpdateFlow,DeleteFlow,FillForm,DisplayList,EditForm process
    class CheckAuth,SelectAction,ValidateForm,SelectItem,ValidateEdit,ConfirmDelete decision
    class SaveData,LoadData,LoadItem,UpdateData,DeleteData database
    class ShowError,ShowFormError,ShowEditError error
\`\`\`

## Process Documentation

### Overview
This flowchart illustrates [describe the overall process and its purpose].

### Key Decision Points
1. **Authentication Check**: Ensures user is logged in before accessing features
2. **Action Selection**: Main branching point for CRUD operations
3. **Validation Steps**: Ensures data integrity at each modification point

### Process Flows
- **Create Flow**: New item creation with validation
- **Read Flow**: Data retrieval and display
- **Update Flow**: Modification of existing items
- **Delete Flow**: Removal with confirmation

### Error Handling
- Login failures redirect to login page
- Validation errors show inline messages
- Database errors trigger rollback procedures`
    },

    sequence: {
      name: 'Sequence Diagram',
      category: 'diagram',
      prompt: `Generate a sequence diagram for {projectName}:

\`\`\`mermaid
sequenceDiagram
    %% Participants
    participant U as User
    participant UI as Frontend UI
    participant API as API Gateway
    participant Auth as Auth Service
    participant DB as Database
    participant Cache as Cache Layer
    participant Queue as Message Queue
    participant Email as Email Service
    
    %% User Registration Flow
    rect rgb(200, 230, 255)
        Note over U,Email: User Registration Flow
        U->>UI: Click "Sign Up"
        UI->>UI: Show Registration Form
        U->>UI: Fill Form & Submit
        UI->>UI: Client-side Validation
        UI->>API: POST /api/register
        API->>Auth: Validate Registration Data
        
        alt Email Already Exists
            Auth-->>API: Error: Email Taken
            API-->>UI: 409 Conflict
            UI-->>U: Show Error Message
        else Email Available
            Auth->>DB: Create User Record
            DB-->>Auth: User Created
            Auth->>Queue: Enqueue Welcome Email
            Queue->>Email: Send Welcome Email
            Email-->>U: Welcome Email
            Auth->>Auth: Generate JWT Token
            Auth-->>API: User + Token
            API-->>UI: 201 Created + Token
            UI->>UI: Store Token
            UI-->>U: Redirect to Dashboard
        end
    end
    
    %% Data Fetch with Caching
    rect rgb(230, 255, 200)
        Note over U,Cache: Data Fetch with Caching
        U->>UI: Request Data
        UI->>API: GET /api/data
        API->>API: Validate JWT Token
        API->>Cache: Check Cache
        
        alt Cache Hit
            Cache-->>API: Cached Data
            API-->>UI: 200 OK (from cache)
        else Cache Miss
            API->>DB: Query Data
            DB-->>API: Result Set
            API->>Cache: Store in Cache
            Cache-->>API: Acknowledged
            API-->>UI: 200 OK (from DB)
        end
        
        UI->>UI: Render Data
        UI-->>U: Display Results
    end
    
    %% Real-time Updates
    rect rgb(255, 230, 200)
        Note over U,UI: Real-time Updates via WebSocket
        U->>UI: Subscribe to Updates
        UI->>API: WS: Subscribe
        API->>API: Establish WebSocket
        
        loop Real-time Events
            DB->>API: Data Change Event
            API->>Cache: Invalidate Cache
            API->>UI: WS: Update Event
            UI->>UI: Update UI State
            UI-->>U: Show Update
        end
        
        U->>UI: Unsubscribe
        UI->>API: WS: Close
        API->>API: Clean up connection
    end
\`\`\`

## Sequence Details

### Flows Illustrated

1. **User Registration**
   - Input validation (client and server)
   - Duplicate checking
   - Asynchronous email sending
   - Token generation

2. **Data Fetching with Cache**
   - JWT authentication
   - Cache-first strategy
   - Fallback to database
   - Cache population

3. **Real-time Updates**
   - WebSocket connection
   - Event propagation
   - Cache invalidation
   - UI state management

### Key Patterns
- **Authentication**: JWT tokens for stateless auth
- **Caching**: Reduce database load
- **Async Processing**: Queue for non-blocking operations
- **Real-time**: WebSocket for live updates`
    }
  }
}

/**
 * Helper function to get a prompt template
 * @param category - The category of documentation
 * @param template - The specific template name
 * @param projectName - The project name to interpolate
 */
export function getDocumentationPrompt(
  category: keyof typeof DOCUMENTATION_PROMPTS,
  template: string,
  projectName: string
): string {
  const categoryTemplates = DOCUMENTATION_PROMPTS[category] as any
  const promptTemplate = categoryTemplates[template]
  
  if (!promptTemplate || !promptTemplate.prompt) {
    throw new Error(`Template ${template} not found in category ${category}`)
  }
  
  // Replace {projectName} placeholder
  return promptTemplate.prompt.replace(/{projectName}/g, projectName)
}

/**
 * Get all templates for a specific category
 */
export function getTemplatesByCategory(category: keyof typeof DOCUMENTATION_PROMPTS) {
  return Object.entries(DOCUMENTATION_PROMPTS[category]).map(([key, value]) => ({
    id: key,
    name: value.name,
    category: value.category,
    description: value.prompt.substring(0, 200) + '...'
  }))
}

/**
 * Get all available categories
 */
export function getDocumentationCategories() {
  return Object.keys(DOCUMENTATION_PROMPTS) as Array<keyof typeof DOCUMENTATION_PROMPTS>
}