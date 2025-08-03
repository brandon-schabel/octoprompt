import type { HookConfig } from '@promptliano/schemas'

export interface HookTemplate {
  id: string
  name: string
  description: string
  category: 'security' | 'workflow' | 'logging' | 'testing' | 'productivity'
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
    config: {
      event: 'PreToolUse',
      matcher: '^Bash$',
      matcherType: 'tool_name_regex',
      command:
        'if [[ "$TOOL_INPUT" =~ rm.*-rf|rm.*-fr ]]; then echo "⚠️ Dangerous rm command blocked. Use with caution."; exit 1; fi',
      message: 'Attempted to run dangerous rm command',
      allow: false
    },
    tags: ['safety', 'bash', 'filesystem']
  },
  {
    id: 'confirm-production-changes',
    name: 'Confirm Production Changes',
    description: 'Requires confirmation before making changes to production files',
    category: 'security',
    config: {
      event: 'PreToolUse',
      matcher: '^(Edit|Write)$',
      matcherType: 'tool_name_regex',
      command:
        'if [[ "$TOOL_INPUT" =~ production|prod\\.env ]]; then read -p "⚠️ Modifying production file. Continue? (y/n): " -n 1 -r; echo; [[ $REPLY =~ ^[Yy]$ ]]; fi',
      message: 'Production file modification requires confirmation'
    },
    tags: ['production', 'safety', 'confirmation']
  },

  // Workflow Templates
  {
    id: 'git-commit-reminder',
    name: 'Git Commit Reminder',
    description: 'Reminds to commit changes after significant edits',
    category: 'workflow',
    config: {
      event: 'PostToolUse',
      matcher: '^(Edit|Write|MultiEdit)$',
      matcherType: 'tool_name_regex',
      command: 'echo "💡 Remember to commit your changes when ready: git add . && git commit -m \\"your message\\""',
      message: 'File modification completed'
    },
    tags: ['git', 'reminder', 'version-control']
  },
  {
    id: 'test-after-code-change',
    name: 'Run Tests After Code Changes',
    description: 'Automatically runs tests after modifying source code files',
    category: 'workflow',
    config: {
      event: 'PostToolUse',
      matcher: '^(Edit|Write)$',
      matcherType: 'tool_name_regex',
      command:
        'if [[ "$TOOL_INPUT" =~ \\.(ts|tsx|js|jsx)$ ]] && [[ "$TOOL_INPUT" =~ src/ ]]; then echo "🧪 Running tests..."; npm test; fi',
      message: 'Running tests after code change'
    },
    tags: ['testing', 'automation', 'ci']
  },

  // Logging Templates
  {
    id: 'log-all-commands',
    name: 'Log All Commands',
    description: 'Logs all bash commands to a file for audit purposes',
    category: 'logging',
    config: {
      event: 'PreToolUse',
      matcher: '^Bash$',
      matcherType: 'tool_name_regex',
      command: 'echo "[$(date)] $TOOL_INPUT" >> ~/.claude/command-history.log',
      message: 'Command logged to history'
    },
    tags: ['audit', 'history', 'bash']
  },
  {
    id: 'track-file-changes',
    name: 'Track File Modifications',
    description: 'Logs all file modifications with timestamps',
    category: 'logging',
    config: {
      event: 'PostToolUse',
      matcher: '^(Edit|Write|MultiEdit)$',
      matcherType: 'tool_name_regex',
      command:
        'echo "[$(date)] Modified: $(echo "$TOOL_INPUT" | jq -r .file_path 2>/dev/null || echo "unknown")" >> ~/.claude/file-changes.log',
      message: 'File change logged'
    },
    tags: ['audit', 'tracking', 'files']
  },

  // Testing Templates
  {
    id: 'validate-json-writes',
    name: 'Validate JSON Before Writing',
    description: 'Validates JSON syntax before writing to .json files',
    category: 'testing',
    config: {
      event: 'PreToolUse',
      matcher: '^Write$',
      matcherType: 'tool_name_regex',
      command:
        'if [[ "$TOOL_INPUT" =~ \\.json$ ]]; then echo "$TOOL_INPUT" | jq -r .content | jq . > /dev/null || { echo "❌ Invalid JSON content"; exit 1; }; fi',
      message: 'Validating JSON content'
    },
    tags: ['validation', 'json', 'quality']
  },
  {
    id: 'lint-before-commit',
    name: 'Lint Code Before Git Operations',
    description: 'Runs linter before allowing git commits',
    category: 'testing',
    config: {
      event: 'PreToolUse',
      matcher: '^Bash$',
      matcherType: 'tool_name_regex',
      command:
        'if [[ "$TOOL_INPUT" =~ git\\ commit ]]; then echo "🔍 Running linter..."; npm run lint || { echo "❌ Fix linting errors before committing"; exit 1; }; fi',
      message: 'Running pre-commit linter'
    },
    tags: ['quality', 'git', 'linting']
  },

  // Productivity Templates
  {
    id: 'format-on-save',
    name: 'Auto-format Code on Save',
    description: 'Automatically formats code files after editing',
    category: 'productivity',
    config: {
      event: 'PostToolUse',
      matcher: '^(Edit|Write|MultiEdit)$',
      matcherType: 'tool_name_regex',
      command:
        'if [[ "$TOOL_INPUT" =~ \\.(ts|tsx|js|jsx|css|scss)$ ]]; then prettier --write "$(echo "$TOOL_INPUT" | jq -r .file_path 2>/dev/null)" 2>/dev/null; fi',
      message: 'Auto-formatting code'
    },
    tags: ['formatting', 'prettier', 'automation']
  },
  {
    id: 'backup-before-edit',
    name: 'Backup Files Before Editing',
    description: 'Creates a backup copy of files before making changes',
    category: 'productivity',
    config: {
      event: 'PreToolUse',
      matcher: '^(Edit|MultiEdit)$',
      matcherType: 'tool_name_regex',
      command:
        'FILE=$(echo "$TOOL_INPUT" | jq -r .file_path 2>/dev/null); if [[ -f "$FILE" ]]; then cp "$FILE" "$FILE.backup.$(date +%Y%m%d_%H%M%S)"; fi',
      message: 'Creating backup of file'
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
    eventName: template.config.event,
    matcher: template.config.matcher,
    matcherType: template.config.matcherType,
    command: template.config.command,
    message: template.config.message,
    allow: template.config.allow
  }
}
