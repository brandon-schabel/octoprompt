import type { HookConfig, HookEvent } from '@promptliano/schemas'

export interface HookTemplate {
  id: string
  name: string
  description: string
  category: 'security' | 'workflow' | 'logging' | 'testing' | 'productivity'
  event: HookEvent
  matcher: string
  config: HookConfig
  tags: string[]
}

export const HOOK_TEMPLATES: HookTemplate[] = [
  // Security Templates
  {
    id: 'block-rm-rf',
    name: 'Block Dangerous rm Commands',
    description: 'Prevents execution of rm -rf commands to avoid accidental deletions',
    category: 'security',
    event: 'PreToolUse',
    matcher: '^Bash$',
    config: {
      type: 'command',
      command:
        'if [[ "$TOOL_INPUT" =~ rm.*-rf|rm.*-fr ]]; then echo "⚠️ Dangerous rm command blocked. Use with caution."; exit 1; fi',
      timeout: 5,
      run_in_background: false
    },
    tags: ['safety', 'bash', 'filesystem']
  },
  {
    id: 'confirm-production-changes',
    name: 'Confirm Production Changes',
    description: 'Requires confirmation before making changes to production files',
    category: 'security',
    event: 'PreToolUse',
    matcher: '^(Edit|Write)$',
    config: {
      type: 'command',
      command:
        'if [[ "$TOOL_INPUT" =~ production|prod\\.env ]]; then read -p "⚠️ Modifying production file. Continue? (y/n): " -n 1 -r; echo; [[ $REPLY =~ ^[Yy]$ ]]; fi',
      timeout: 30,
      run_in_background: false
    },
    tags: ['production', 'safety', 'confirmation']
  },

  // Workflow Templates
  {
    id: 'git-commit-reminder',
    name: 'Git Commit Reminder',
    description: 'Reminds to commit changes after significant edits',
    category: 'workflow',
    event: 'PostToolUse',
    matcher: '^(Edit|Write|MultiEdit)$',
    config: {
      type: 'command',
      command: 'echo "💡 Remember to commit your changes when ready: git add . && git commit -m \\"your message\\""',
      timeout: 5,
      run_in_background: false
    },
    tags: ['git', 'reminder', 'version-control']
  },
  {
    id: 'test-after-code-change',
    name: 'Run Tests After Code Changes',
    description: 'Automatically runs tests after modifying source code files',
    category: 'workflow',
    event: 'PostToolUse',
    matcher: '^(Edit|Write)$',
    config: {
      type: 'command',
      command:
        'if [[ "$TOOL_INPUT" =~ \\.(ts|tsx|js|jsx)$ ]] && [[ "$TOOL_INPUT" =~ src/ ]]; then echo "🧪 Running tests..."; npm test; fi',
      timeout: 120,
      run_in_background: true
    },
    tags: ['testing', 'automation', 'ci']
  },

  // Logging Templates
  {
    id: 'log-all-commands',
    name: 'Log All Commands',
    description: 'Logs all bash commands to a file for audit purposes',
    category: 'logging',
    event: 'PreToolUse',
    matcher: '^Bash$',
    config: {
      type: 'command',
      command: 'echo "[$(date)] $TOOL_INPUT" >> ~/.claude/command-history.log',
      timeout: 5,
      run_in_background: false
    },
    tags: ['audit', 'history', 'bash']
  },
  {
    id: 'track-file-changes',
    name: 'Track File Modifications',
    description: 'Logs all file modifications with timestamps',
    category: 'logging',
    event: 'PostToolUse',
    matcher: '^(Edit|Write|MultiEdit)$',
    config: {
      type: 'command',
      command:
        'echo "[$(date)] Modified: $(echo "$TOOL_INPUT" | jq -r .file_path 2>/dev/null || echo "unknown")" >> ~/.claude/file-changes.log',
      timeout: 5,
      run_in_background: false
    },
    tags: ['audit', 'tracking', 'files']
  },

  // Testing Templates
  {
    id: 'validate-json-writes',
    name: 'Validate JSON Before Writing',
    description: 'Validates JSON syntax before writing to .json files',
    category: 'testing',
    event: 'PreToolUse',
    matcher: '^Write$',
    config: {
      type: 'command',
      command:
        'if [[ "$TOOL_INPUT" =~ \\.json$ ]]; then echo "$TOOL_INPUT" | jq -r .content | jq . > /dev/null || { echo "❌ Invalid JSON content"; exit 1; }; fi',
      timeout: 10,
      run_in_background: false
    },
    tags: ['validation', 'json', 'quality']
  },
  {
    id: 'lint-before-commit',
    name: 'Lint Code Before Git Operations',
    description: 'Runs linter before allowing git commits',
    category: 'testing',
    event: 'PreToolUse',
    matcher: '^Bash$',
    config: {
      type: 'command',
      command:
        'if [[ "$TOOL_INPUT" =~ git\\ commit ]]; then echo "🔍 Running linter..."; npm run lint || { echo "❌ Fix linting errors before committing"; exit 1; }; fi',
      timeout: 60,
      run_in_background: false
    },
    tags: ['quality', 'git', 'linting']
  },

  // Productivity Templates
  {
    id: 'format-on-save',
    name: 'Auto-format Code on Save',
    description: 'Automatically formats code files after editing',
    category: 'productivity',
    event: 'PostToolUse',
    matcher: '^(Edit|Write|MultiEdit)$',
    config: {
      type: 'command',
      command:
        'if [[ "$TOOL_INPUT" =~ \\.(ts|tsx|js|jsx|css|scss)$ ]]; then prettier --write "$(echo "$TOOL_INPUT" | jq -r .file_path 2>/dev/null)" 2>/dev/null; fi',
      timeout: 30,
      run_in_background: true
    },
    tags: ['formatting', 'prettier', 'automation']
  },
  {
    id: 'backup-before-edit',
    name: 'Backup Files Before Editing',
    description: 'Creates a backup copy of files before making changes',
    category: 'productivity',
    event: 'PreToolUse',
    matcher: '^(Edit|MultiEdit)$',
    config: {
      type: 'command',
      command:
        'FILE=$(echo "$TOOL_INPUT" | jq -r .file_path 2>/dev/null); if [[ -f "$FILE" ]]; then cp "$FILE" "$FILE.backup.$(date +%Y%m%d_%H%M%S)"; fi',
      timeout: 10,
      run_in_background: false
    },
    tags: ['backup', 'safety', 'files']
  }
]

// Helper function to get templates by category
export function getTemplatesByCategory(category: HookTemplate['category']): HookTemplate[] {
  return HOOK_TEMPLATES.filter((template) => template.category === category)
}

// Helper function to get template by ID
export function getTemplateById(id: string): HookTemplate | undefined {
  return HOOK_TEMPLATES.find((template) => template.id === id)
}

// Helper function to search templates by tags
export function searchTemplatesByTags(tags: string[]): HookTemplate[] {
  return HOOK_TEMPLATES.filter((template) => tags.some((tag) => template.tags.includes(tag.toLowerCase())))
}

// Helper function to get all unique tags
export function getAllTemplateTags(): string[] {
  const tags = new Set<string>()
  HOOK_TEMPLATES.forEach((template) => {
    template.tags.forEach((tag) => tags.add(tag))
  })
  return Array.from(tags).sort()
}

// Helper function to convert template to hook config for creation
export function templateToCreateBody(template: HookTemplate, level: 'user' | 'project' | 'local' = 'project') {
  return {
    level,
    eventName: template.event,
    matcher: template.matcher,
    config: template.config
  }
}
