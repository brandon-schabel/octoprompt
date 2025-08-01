import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@ui'
import { Button } from '@ui'
import {
  BarChart3,
  FileText,
  Settings,
  ChevronDown,
  Download,
  Activity,
  GitBranch,
  FolderOpen,
  Layers,
  ListTodo,
  Circle,
  History,
  Package2,
  FileSignature,
  FolderTree,
  GitPullRequest,
  GitCommit,
  Upload,
  Sliders
} from 'lucide-react'
import type { ProjectsSearch, ProjectView } from '@/lib/search-schemas'
import { cn } from '@/lib/utils'
import { useActiveProjectTab, useAppSettings } from '@/hooks/use-kv-local-storage'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promptlianoClient } from '@/hooks/promptliano-client'
import { toast } from 'sonner'

interface ProjectNavigationMenuProps {
  currentSearch: ProjectsSearch
  activeView: ProjectView | undefined
  onViewChange: (view: ProjectView) => void
  claudeCodeEnabled?: boolean
  showMenus?: boolean
  showTabs?: boolean
}

export function ProjectNavigationMenu({
  currentSearch,
  activeView,
  onViewChange,
  claudeCodeEnabled,
  showMenus = true,
  showTabs = true
}: ProjectNavigationMenuProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [{ summarizationEnabledProjectIds = [] }] = useAppSettings()
  const [activeProjectTabState] = useActiveProjectTab()
  const selectedProjectId = activeProjectTabState?.selectedProjectId
  const isSummarizationEnabled = selectedProjectId ? summarizationEnabledProjectIds.includes(selectedProjectId) : false

  // Check if project has MCP configuration
  const { data: mcpConfigData } = useQuery({
    queryKey: ['mcp-project-config', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null
      const result = await promptlianoClient.mcpProjectConfig.loadProjectConfig(selectedProjectId)
      return result.data
    },
    enabled: !!selectedProjectId
  })

  const hasProjectMcpConfig = !!mcpConfigData?.config

  // Git pull mutation
  const pullMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error('No project selected')
      return promptlianoClient.git.pull(selectedProjectId)
    },
    onSuccess: () => {
      toast.success('Successfully pulled from remote')
      queryClient.invalidateQueries({ queryKey: ['git-status', selectedProjectId] })
      queryClient.invalidateQueries({ queryKey: ['git-log', selectedProjectId] })
    },
    onError: (error) => {
      toast.error(`Failed to pull: ${error.message}`)
    }
  })

  // Git push mutation
  const pushMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error('No project selected')
      return promptlianoClient.git.push(selectedProjectId)
    },
    onSuccess: () => {
      toast.success('Successfully pushed to remote')
      queryClient.invalidateQueries({ queryKey: ['git-status', selectedProjectId] })
      queryClient.invalidateQueries({ queryKey: ['git-log', selectedProjectId] })
    },
    onError: (error) => {
      toast.error(`Failed to push: ${error.message}`)
    }
  })

  const navigateToManageView = (manageView: string, section?: string) => {
    navigate({
      to: '/projects',
      search: {
        ...currentSearch,
        activeView: 'manage',
        manageView,
        section
      } as any,
      replace: true
    })
  }

  const navigateToGitView = (gitView?: string) => {
    navigate({
      to: '/projects',
      search: {
        ...currentSearch,
        activeView: 'git',
        gitView
      } as any,
      replace: true
    })
  }

  const navigateToSettings = (tab: string) => {
    navigate({
      to: '/settings',
      search: { tab }
    })
  }

  if (!showMenus && !showTabs) return null

  if (showTabs && !showMenus) {
    return (
      <div className='flex items-center gap-1 bg-muted rounded-md p-0.5'>
        <Button
          variant={activeView === 'context' ? 'secondary' : 'ghost'}
          size='sm'
          onClick={() => onViewChange('context')}
          className='h-7 px-3 text-sm flex items-center gap-1'
        >
          <Layers className='h-3.5 w-3.5' />
          Context
        </Button>
        <Button
          variant={activeView === 'tickets' ? 'secondary' : 'ghost'}
          size='sm'
          onClick={() => onViewChange('tickets')}
          className='h-7 px-3 text-sm flex items-center gap-1'
        >
          <ListTodo className='h-3.5 w-3.5' />
          Tickets
        </Button>
        {/* <Button
          variant={activeView === 'git' ? 'secondary' : 'ghost'}
          size='sm'
          onClick={() => onViewChange('git')}
          className='h-7 px-3 text-sm flex items-center gap-1'
        >
          <GitBranch className='h-3.5 w-3.5' />
          Git
        </Button> */}
        <Button
          variant={activeView === 'manage' ? 'secondary' : 'ghost'}
          size='sm'
          onClick={() => onViewChange('manage')}
          className='h-7 px-3 text-sm flex items-center gap-1'
        >
          <Sliders className='h-3.5 w-3.5' />
          Manage
        </Button>
        <Button
          variant={activeView === 'assets' ? 'secondary' : 'ghost'}
          size='sm'
          onClick={() => onViewChange('assets')}
          className='h-7 px-3 text-sm flex items-center gap-1'
        >
          <FolderOpen className='h-3.5 w-3.5' />
          Assets
        </Button>
        {claudeCodeEnabled && (
          <Button
            variant={activeView === 'claude-code' ? 'secondary' : 'ghost'}
            size='sm'
            onClick={() => onViewChange('claude-code')}
            className='h-7 px-3 text-sm'
          >
            Claude Code
          </Button>
        )}
      </div>
    )
  }

  return (
    <Menubar className='h-8 p-0.5'>
      <MenubarMenu>
        <MenubarTrigger className='flex items-center gap-1 h-7 px-2 py-1 text-sm group'>
          MCP
          <ChevronDown className='h-3 w-3 opacity-60 transition-all duration-200 group-hover:scale-125 group-hover:opacity-100 dark:group-hover:text-white' />
        </MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => navigateToManageView('mcp-analytics')} className='flex items-center gap-2'>
            <Activity className='h-4 w-4' />
            MCP Analytics
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => navigateToSettings('global-mcp')} className='flex items-center gap-2'>
            <Download className='h-4 w-4' />
            Global MCP Installation
          </MenubarItem>
          <MenubarItem
            onClick={() => navigateToManageView('project-settings', 'mcp-config')}
            className='flex items-center gap-2'
          >
            <Settings className='h-4 w-4' />
            <span>Project MCP Configuration</span>
            {hasProjectMcpConfig && <Circle className='h-2 w-2 ml-auto fill-green-500 text-green-500' />}
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className='flex items-center gap-1 h-7 px-2 py-1 text-sm group'>
          Project
          <ChevronDown className='h-3 w-3 opacity-60 transition-all duration-200 group-hover:scale-125 group-hover:opacity-100 dark:group-hover:text-white' />
        </MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={() => navigateToManageView('statistics')} className='flex items-center gap-2'>
            <BarChart3 className='h-4 w-4' />
            Statistics
          </MenubarItem>
          <MenubarItem
            onClick={() => navigateToManageView('summarization', 'project-summarization-settings')}
            className='flex items-center gap-2'
          >
            <FileText className='h-4 w-4' />
            <span>Enable Summarization</span>
            <Circle
              className={cn(
                'h-2 w-2 ml-auto',
                isSummarizationEnabled ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'
              )}
            />
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => navigateToManageView('project-settings')} className='flex items-center gap-2'>
            <Settings className='h-4 w-4' />
            Settings
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className='flex items-center gap-1 h-7 px-2 py-1 text-sm group'>
          Git
          <ChevronDown className='h-3 w-3 opacity-60 transition-all duration-200 group-hover:scale-125 group-hover:opacity-100 dark:group-hover:text-white' />
        </MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            onClick={() => pullMutation.mutate()}
            disabled={!selectedProjectId || pullMutation.isPending}
            className='flex items-center gap-2'
          >
            <GitPullRequest className='h-4 w-4' />
            {pullMutation.isPending ? 'Pulling...' : 'Pull'}
          </MenubarItem>
          <MenubarItem
            onClick={() => pushMutation.mutate()}
            disabled={!selectedProjectId || pushMutation.isPending}
            className='flex items-center gap-2'
          >
            <Upload className='h-4 w-4' />
            {pushMutation.isPending ? 'Pushing...' : 'Push'}
          </MenubarItem>
          <MenubarItem
            onClick={() => {
              navigateToGitView('changes')
              // Focus commit message input after navigation
              setTimeout(() => {
                const commitTextarea = document.querySelector(
                  'textarea[placeholder="Commit message..."]'
                ) as HTMLTextAreaElement
                if (commitTextarea) {
                  commitTextarea.focus()
                }
              }, 100)
            }}
            className='flex items-center gap-2'
          >
            <GitCommit className='h-4 w-4' />
            Commit
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={() => navigateToGitView('changes')} className='flex items-center gap-2'>
            <FileSignature className='h-4 w-4' />
            Changes
          </MenubarItem>
          <MenubarItem onClick={() => navigateToGitView('history')} className='flex items-center gap-2'>
            <History className='h-4 w-4' />
            History
          </MenubarItem>
          <MenubarItem onClick={() => navigateToGitView('branches')} className='flex items-center gap-2'>
            <GitBranch className='h-4 w-4' />
            Branches
          </MenubarItem>
          <MenubarItem onClick={() => navigateToGitView('stashes')} className='flex items-center gap-2'>
            <Package2 className='h-4 w-4' />
            Stashes
          </MenubarItem>
          <MenubarItem onClick={() => navigateToGitView('worktrees')} className='flex items-center gap-2'>
            <FolderTree className='h-4 w-4' />
            Worktrees
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}
