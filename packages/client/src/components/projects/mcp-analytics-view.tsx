import React from 'react'
import { MCPAnalyticsTabView } from './mcp-analytics-tab-view'

interface MCPAnalyticsViewProps {
  projectId: number
}

export function MCPAnalyticsView({ projectId }: MCPAnalyticsViewProps) {
  return <MCPAnalyticsTabView projectId={projectId} />
}
