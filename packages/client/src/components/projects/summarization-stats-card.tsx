import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui'
import { Progress } from '@ui'
import { Badge } from '@ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ui'
import { FileText, Clock, Binary, AlertCircle, FileX, CheckCircle2, HelpCircle, TrendingUp } from 'lucide-react'
import { ProjectFile } from '@promptliano/schemas'
import {
  getSummarizationStats,
  getFileCountDescription,
  FileCategorization,
  categorizeProjectFiles
} from '@/lib/file-categorization'

interface SummarizationStatsCardProps {
  projectFiles: ProjectFile[]
  isEnabled: boolean
}

export function SummarizationStatsCard({ projectFiles, isEnabled }: SummarizationStatsCardProps) {
  const stats = getSummarizationStats(projectFiles)
  const categorization = categorizeProjectFiles(projectFiles)

  const categoryItems = [
    {
      label: 'Summarized',
      count: stats.summarized,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      tooltip: 'Files that have been successfully summarized'
    },
    {
      label: 'Pending',
      count: stats.pending,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      tooltip: 'Text files waiting to be summarized'
    },
    {
      label: 'Binary Files',
      count: stats.binary,
      icon: Binary,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      tooltip: 'Binary files (images, videos, etc.) that cannot be summarized'
    },
    {
      label: 'Too Large',
      count: stats.tooLarge,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      tooltip: 'Files exceeding the 1MB size limit for summarization'
    },
    {
      label: 'Empty',
      count: stats.empty,
      icon: FileX,
      color: 'text-gray-500',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      tooltip: 'Files with no content or only whitespace'
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <span className='flex items-center gap-2'>
            <TrendingUp className='h-5 w-5' />
            Summarization Coverage
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className='h-4 w-4 text-muted-foreground cursor-help' />
              </TooltipTrigger>
              <TooltipContent className='max-w-xs'>
                <p>
                  File summaries enable AI-powered features like intelligent file search, project documentation
                  generation, and context-aware code suggestions.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription>Track your project's file summarization progress</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* Overall Progress */}
        <div className='space-y-2'>
          <div className='flex justify-between text-sm'>
            <span className='font-medium'>Overall Coverage</span>
            <span className='text-muted-foreground'>
              {stats.summarized} / {stats.summarizable} summarizable files
            </span>
          </div>
          <Progress value={stats.coveragePercentage} className='h-3' />
          <div className='flex justify-between text-xs text-muted-foreground'>
            <span>{stats.coveragePercentage.toFixed(1)}% complete</span>
            {stats.pending > 0 && <span>{stats.pending} files remaining</span>}
          </div>
        </div>

        {/* File Categories */}
        <div className='space-y-3'>
          <h4 className='text-sm font-medium'>File Breakdown</h4>
          <div className='grid grid-cols-1 gap-2'>
            {categoryItems.map((item) => (
              <TooltipProvider key={item.label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex items-center justify-between p-2 rounded-md ${item.bgColor} cursor-help`}>
                      <div className='flex items-center gap-2'>
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                        <span className='text-sm font-medium'>{item.label}</span>
                      </div>
                      <Badge variant='secondary' className='ml-2'>
                        {item.count}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.tooltip}</p>
                    <p className='text-xs mt-1'>{getFileCountDescription(item.count, stats.total)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className='pt-3 border-t space-y-2'>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Total Project Files</span>
            <span className='font-medium'>{stats.total}</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Summarizable Files</span>
            <span className='font-medium'>{stats.summarizable}</span>
          </div>
          <div className='flex justify-between text-sm'>
            <span className='text-muted-foreground'>Non-summarizable Files</span>
            <span className='font-medium'>{stats.nonSummarizable}</span>
          </div>
        </div>

        {/* Enable/Disable Notice */}
        {!isEnabled && (
          <div className='bg-muted p-3 rounded-md'>
            <p className='text-sm text-muted-foreground'>
              <AlertCircle className='inline h-4 w-4 mr-1' />
              File summarization is currently disabled for this project. Enable it to start tracking progress.
            </p>
          </div>
        )}

        {/* Call to Action */}
        {isEnabled && stats.pending > 0 && (
          <div className='bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md'>
            <p className='text-sm text-blue-600 dark:text-blue-400'>
              <FileText className='inline h-4 w-4 mr-1' />
              {stats.pending} files are ready to be summarized. Select them below and click "Summarize Selected" to
              improve your coverage.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
