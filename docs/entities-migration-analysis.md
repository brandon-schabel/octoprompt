# Entity Migration Analysis

## Entities Still Using JSON Blob Storage

### 1. Projects (`projects` table)

**Current JSON Structure:**

```typescript
interface Project {
  id: number
  name: string
  path: string
  created: number
  updated: number
  lastOpened?: number
  settings?: ProjectSettings
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  last_opened INTEGER,
  settings TEXT DEFAULT '{}', -- JSON for flexible settings
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)

CREATE INDEX idx_projects_path ON projects(path)
CREATE INDEX idx_projects_last_opened ON projects(last_opened)
```

**Migration Priority:** HIGH - Core entity used everywhere

---

### 2. Agents (`agents` table)

**Current JSON Structure:**

```typescript
interface Agent {
  id: number
  name: string
  description: string
  content: string
  color?: string
  filePath?: string
  created: number
  updated: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE agents (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  color TEXT,
  file_path TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)

CREATE INDEX idx_agents_name ON agents(name)
CREATE INDEX idx_agents_created_at ON agents(created_at)
```

**Migration Priority:** MEDIUM - Used frequently but simpler structure

---

### 3. Project Files (`project_files` table)

**Current JSON Structure:**

```typescript
interface ProjectFile {
  id: string
  projectId: number
  path: string
  relativePath: string
  type: 'file' | 'directory'
  lastModified?: number
  size?: number
  summary?: string
  metadata?: Record<string, any>
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'directory')),
  last_modified INTEGER,
  size INTEGER,
  summary TEXT,
  metadata TEXT DEFAULT '{}', -- JSON for flexible metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)

CREATE INDEX idx_project_files_project_id ON project_files(project_id)
CREATE INDEX idx_project_files_path ON project_files(path)
CREATE INDEX idx_project_files_type ON project_files(type)
CREATE INDEX idx_project_files_project_type ON project_files(project_id, type)
```

**Migration Priority:** HIGH - Critical for file management and search

---

### 4. Prompts (`prompts` table)

**Current JSON Structure:**

```typescript
interface Prompt {
  id: number
  name: string
  content: string
  category?: string
  tags?: string[]
  created: number
  updated: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE prompts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)

CREATE INDEX idx_prompts_name ON prompts(name)
CREATE INDEX idx_prompts_category ON prompts(category)
CREATE INDEX idx_prompts_created_at ON prompts(created_at)
```

**Migration Priority:** MEDIUM - Important but manageable scope

---

### 5. Prompt Projects (`prompt_projects` table)

**Current JSON Structure:**

```typescript
interface PromptProject {
  id: string
  promptId: number
  projectId: number
  created: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE prompt_projects (
  id TEXT PRIMARY KEY,
  prompt_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (prompt_id, project_id)
)

CREATE INDEX idx_prompt_projects_prompt_id ON prompt_projects(prompt_id)
CREATE INDEX idx_prompt_projects_project_id ON prompt_projects(project_id)
```

**Migration Priority:** LOW - Simple junction table

---

### 6. MCP Server Configs (`mcp_server_configs` table)

**Current JSON Structure:**

```typescript
interface MCPServerConfig {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
  created: number
  updated: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE mcp_server_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  args TEXT DEFAULT '[]', -- JSON array
  env TEXT DEFAULT '{}', -- JSON object
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)

CREATE INDEX idx_mcp_server_configs_name ON mcp_server_configs(name)
CREATE INDEX idx_mcp_server_configs_enabled ON mcp_server_configs(enabled)
```

**Migration Priority:** MEDIUM - Important for MCP functionality

---

### 7. MCP Server States (`mcp_server_states` table)

**Current JSON Structure:**

```typescript
interface MCPServerState {
  id: string
  serverId: string
  status: 'running' | 'stopped' | 'error'
  pid?: number
  error?: string
  lastHeartbeat?: number
  created: number
  updated: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE mcp_server_states (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'stopped', 'error')),
  pid INTEGER,
  error TEXT,
  last_heartbeat INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES mcp_server_configs(id) ON DELETE CASCADE
)

CREATE INDEX idx_mcp_server_states_server_id ON mcp_server_states(server_id)
CREATE INDEX idx_mcp_server_states_status ON mcp_server_states(status)
CREATE INDEX idx_mcp_server_states_updated_at ON mcp_server_states(updated_at)
```

**Migration Priority:** MEDIUM - Runtime state management

---

### 8. MCP Tools (`mcp_tools` table)

**Current JSON Structure:**

```typescript
interface MCPTool {
  id: string
  serverId: string
  name: string
  description: string
  inputSchema?: any
  created: number
  updated: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE mcp_tools (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  input_schema TEXT, -- JSON schema
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES mcp_server_configs(id) ON DELETE CASCADE
)

CREATE INDEX idx_mcp_tools_server_id ON mcp_tools(server_id)
CREATE INDEX idx_mcp_tools_name ON mcp_tools(name)
CREATE INDEX idx_mcp_tools_created_at ON mcp_tools(created_at)
```

**Migration Priority:** LOW - Stable structure

---

### 9. MCP Resources (`mcp_resources` table)

**Current JSON Structure:**

```typescript
interface MCPResource {
  id: string
  serverId: string
  uri: string
  name: string
  description?: string
  mimeType?: string
  created: number
  updated: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE mcp_resources (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  uri TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mime_type TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (server_id) REFERENCES mcp_server_configs(id) ON DELETE CASCADE
)

CREATE INDEX idx_mcp_resources_server_id ON mcp_resources(server_id)
CREATE INDEX idx_mcp_resources_uri ON mcp_resources(uri)
CREATE INDEX idx_mcp_resources_created_at ON mcp_resources(created_at)
```

**Migration Priority:** LOW - Stable structure

---

### 10. MCP Tool Executions (`mcp_tool_executions` table)

**Current JSON Structure:**

```typescript
interface MCPToolExecution {
  id: string
  toolId: string
  projectId?: number
  input: any
  output?: any
  error?: string
  duration?: number
  created: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE mcp_tool_executions (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL,
  project_id INTEGER,
  input TEXT NOT NULL, -- JSON
  output TEXT, -- JSON
  error TEXT,
  duration INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (tool_id) REFERENCES mcp_tools(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)

CREATE INDEX idx_mcp_tool_executions_tool_id ON mcp_tool_executions(tool_id)
CREATE INDEX idx_mcp_tool_executions_project_id ON mcp_tool_executions(project_id)
CREATE INDEX idx_mcp_tool_executions_created_at ON mcp_tool_executions(created_at)
```

**Migration Priority:** MEDIUM - Important for analytics

---

### 11. Selected Files (`selected_files` table)

**Current JSON Structure:**

```typescript
interface SelectedFile {
  id: string
  projectId: number
  tabId: number
  filePath: string
  selected: boolean
  created: number
  updated: number
}
```

**Proposed Column Schema:**

```sql
CREATE TABLE selected_files (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  tab_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  selected INTEGER NOT NULL DEFAULT 1 CHECK (selected IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, tab_id, file_path)
)

CREATE INDEX idx_selected_files_project_id ON selected_files(project_id)
CREATE INDEX idx_selected_files_tab_id ON selected_files(tab_id)
CREATE INDEX idx_selected_files_project_tab ON selected_files(project_id, tab_id)
CREATE INDEX idx_selected_files_updated_at ON selected_files(updated_at)
```

**Migration Priority:** HIGH - Critical for UI state

---

## Migration Order Recommendation

1. **Phase 1 - Core Entities (HIGH Priority)**
   - projects
   - project_files
   - selected_files

2. **Phase 2 - Feature Entities (MEDIUM Priority)**
   - agents
   - prompts
   - mcp_server_configs
   - mcp_server_states
   - mcp_tool_executions

3. **Phase 3 - Supporting Entities (LOW Priority)**
   - prompt_projects
   - mcp_tools
   - mcp_resources

## Key Considerations

1. **Foreign Key Relationships**: Ensure proper cascade behavior
2. **Unique Constraints**: Add where business logic requires
3. **JSON Fields**: Keep for truly flexible data (settings, metadata)
4. **Performance**: Add indexes based on query patterns
5. **Data Migration**: Plan for production data preservation
