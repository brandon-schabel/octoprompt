import React from 'react'
import { AssetsSidebarNav, type AssetView } from './assets-sidebar-nav'
import { ProjectDocsView } from './views/project-docs-view'
import { ArchitectureView } from './views/architecture-view'
import { ApiDocsView } from './views/api-docs-view'
import { DatabaseSchemaView } from './views/database-schema-view'
import { UserGuidesView } from './views/user-guides-view'
import { DiagramsView } from './views/diagrams-view'
import { RecentAssetsView } from './views/recent-assets-view'
import { cn } from '@/lib/utils'

interface AssetsTabWithSidebarProps {
  projectId: number
  projectName?: string
  assetView?: AssetView
  onAssetViewChange: (view: AssetView) => void
  className?: string
}

export function AssetsTabWithSidebar({ 
  projectId, 
  projectName,
  assetView = 'project-docs', 
  onAssetViewChange, 
  className 
}: AssetsTabWithSidebarProps) {
  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Sidebar */}
      <div className="w-56 border-r bg-muted/30 flex-shrink-0">
        <AssetsSidebarNav
          activeView={assetView}
          onViewChange={onAssetViewChange}
          className="h-full"
        />
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {assetView === 'project-docs' && <ProjectDocsView projectId={projectId} projectName={projectName} />}
        {assetView === 'architecture' && <ArchitectureView projectId={projectId} projectName={projectName} />}
        {assetView === 'api-docs' && <ApiDocsView projectId={projectId} projectName={projectName} />}
        {assetView === 'database-schema' && <DatabaseSchemaView projectId={projectId} projectName={projectName} />}
        {assetView === 'user-guides' && <UserGuidesView projectId={projectId} projectName={projectName} />}
        {assetView === 'diagrams' && <DiagramsView projectId={projectId} projectName={projectName} />}
        {assetView === 'recent' && <RecentAssetsView projectId={projectId} projectName={projectName} />}
      </div>
    </div>
  )
}