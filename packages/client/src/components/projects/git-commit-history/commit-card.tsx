import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Copy, ChevronDown, ChevronRight, GitCommit, Clock, User, FileText, GitMerge } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import type { GitCommitEnhanced } from '@octoprompt/schemas'

interface CommitCardProps {
  commit: GitCommitEnhanced
  onClick?: () => void
}

export function CommitCard({ commit, onClick }: CommitCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const copyHash = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(commit.hash)
    toast.success('Commit hash copied to clipboard')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const shortHash = commit.hash.slice(0, 7)
  
  // Safely handle date formatting
  const dateIsValid = commit.authoredDate && !isNaN(new Date(commit.authoredDate).getTime())
  const relativeTime = commit.relativeTime || (dateIsValid 
    ? formatDistanceToNow(new Date(commit.authoredDate), { addSuffix: true })
    : 'Date unavailable')
  const fullDate = dateIsValid 
    ? format(new Date(commit.authoredDate), 'PPpp')
    : 'Date unavailable'
  
  // Use subject and body from schema
  const subject = commit.subject
  const body = commit.body

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer p-4 hover:bg-accent/50 transition-colors">
            <div className="flex items-start gap-3">
              {/* Expand/Collapse Icon */}
              <Button variant="ghost" size="icon" className="h-6 w-6 mt-0.5">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>

              {/* Author Avatar */}
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-xs">{getInitials(commit.author.name)}</AvatarFallback>
              </Avatar>

              {/* Commit Info */}
              <div className="flex-1 min-w-0">
                {/* First Row: Subject */}
                <p className="font-medium line-clamp-1 mb-1">{subject}</p>

                {/* Second Row: Metadata */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {/* Hash with Copy */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 font-mono text-xs hover:text-primary"
                          onClick={copyHash}
                        >
                          <GitCommit className="h-3 w-3 mr-1" />
                          {shortHash}
                          <Copy className="h-3 w-3 ml-1 opacity-50" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Click to copy full hash</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Author */}
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{commit.author.name}</span>
                  </div>

                  {/* Time */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{relativeTime}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{fullDate}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* File Stats */}
                  {commit.stats && (
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      <span>{commit.stats.filesChanged} files</span>
                      {commit.stats.additions > 0 && (
                        <span className="text-green-600">+{commit.stats.additions}</span>
                      )}
                      {commit.stats.deletions > 0 && (
                        <span className="text-red-600">-{commit.stats.deletions}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags/Refs */}
                {commit.refs && commit.refs.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    {commit.refs.map((ref: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {ref}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* View Details Button */}
              <Button variant="outline" size="sm" onClick={(e) => {
                e.stopPropagation()
                onClick?.()
              }}>
                View Details
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {/* Full Message Body */}
            {body && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Full Message</h4>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-3 rounded-md">
                  {body}
                </pre>
              </div>
            )}

            {/* Additional Metadata */}
            <div className="space-y-2 text-sm">
              {/* Full Hash */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Full Hash:</span>
                <code className="font-mono text-xs bg-muted px-2 py-1 rounded">{commit.hash}</code>
              </div>

              {/* Parents */}
              {commit.parents && commit.parents.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {commit.parents.length > 1 ? (
                      <>
                        <GitMerge className="h-3 w-3 inline mr-1" />
                        Merge Commit:
                      </>
                    ) : (
                      'Parent:'
                    )}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {commit.parents.map((parent: string, index: number) => (
                      <code key={index} className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {parent.slice(0, 7)}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Author Email */}
              {commit.author.email && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{commit.author.email}</span>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}