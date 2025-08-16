import React, { useState } from 'react'
import { useCommitDetail } from '@/hooks/api/use-git-api'
import type { GitFileDiff } from '@promptliano/api-client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@promptliano/ui'
import { ScrollArea } from '@promptliano/ui'
import { Button } from '@promptliano/ui'
import { Badge } from '@promptliano/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@promptliano/ui'
import { Skeleton } from '@promptliano/ui'
import { Avatar, AvatarFallback } from '@promptliano/ui'
import { Copy, GitCommit, User, Calendar, FileText, GitMerge, Plus, Minus, Edit, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { GitDiffDialog } from '../git-diff-dialog'

interface CommitDetailModalProps {
  projectId: number
  commitHash: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommitDetailModal({ projectId, commitHash, open, onOpenChange }: CommitDetailModalProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const { data: response, isLoading, error } = useCommitDetail(projectId, commitHash, false, open)

  const commitData = response?.data
  const commit = commitData?.commit

  const copyHash = () => {
    navigator.clipboard.writeText(commitHash)
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

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <Plus className='h-3 w-3 text-green-600' />
      case 'deleted':
        return <Minus className='h-3 w-3 text-red-600' />
      case 'modified':
        return <Edit className='h-3 w-3 text-yellow-600' />
      default:
        return <FileText className='h-3 w-3 text-muted-foreground' />
    }
  }

  const getFileStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'text-green-600'
      case 'deleted':
        return 'text-red-600'
      case 'modified':
        return 'text-yellow-600'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-4xl max-h-[90vh]'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <GitCommit className='h-5 w-5' />
              Commit Details
            </DialogTitle>
            <DialogDescription>
              {isLoading && 'Loading commit details...'}
              {error && 'Failed to load commit details'}
              {commit && `${commit.subject}`}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className='space-y-4'>
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-40 w-full' />
              <Skeleton className='h-60 w-full' />
            </div>
          ) : error ? (
            <div className='flex flex-col items-center justify-center h-64 text-destructive'>
              <AlertCircle className='h-12 w-12 mb-4 opacity-50' />
              <p>Failed to load commit details</p>
              <p className='text-sm text-muted-foreground mt-2'>{error.message}</p>
            </div>
          ) : commit ? (
            <Tabs defaultValue='overview' className='flex-1'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='overview'>Overview</TabsTrigger>
                <TabsTrigger value='files'>Files Changed ({commitData?.files?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value='overview' className='space-y-4'>
                {/* Author Info */}
                <div className='flex items-start gap-4'>
                  <Avatar className='h-12 w-12'>
                    <AvatarFallback>{getInitials(commit.author.name)}</AvatarFallback>
                  </Avatar>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <h3 className='font-semibold'>{commit.author.name}</h3>
                      {commit.author.email && (
                        <span className='text-sm text-muted-foreground'>{commit.author.email}</span>
                      )}
                    </div>
                    <div className='flex items-center gap-4 text-sm text-muted-foreground mt-1'>
                      <div className='flex items-center gap-1'>
                        <Calendar className='h-3 w-3' />
                        <span>
                          {commit.authoredDate && !isNaN(new Date(commit.authoredDate).getTime())
                            ? format(new Date(commit.authoredDate), 'PPpp')
                            : 'Date unavailable'}
                        </span>
                      </div>
                      {commit.committer && commit.committer.name !== commit.author.name && (
                        <div className='flex items-center gap-1'>
                          <User className='h-3 w-3' />
                          <span>Committed by {commit.committer.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Commit Hash */}
                <div className='bg-muted p-3 rounded-md'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium'>Commit Hash:</span>
                      <code className='font-mono text-sm'>{commitHash}</code>
                    </div>
                    <Button variant='ghost' size='sm' onClick={copyHash}>
                      <Copy className='h-4 w-4' />
                    </Button>
                  </div>
                </div>

                {/* Parents */}
                {commit.parents && commit.parents.length > 0 && (
                  <div>
                    <h4 className='text-sm font-medium mb-2 flex items-center gap-2'>
                      {commit.parents.length > 1 && <GitMerge className='h-4 w-4' />}
                      {commit.parents.length > 1 ? 'Merge Commit' : 'Parent Commit'}
                    </h4>
                    <div className='flex flex-wrap gap-2'>
                      {commit.parents.map((parent: string, index: number) => (
                        <Badge key={index} variant='secondary' className='font-mono'>
                          {parent}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commit Message */}
                <div>
                  <h4 className='text-sm font-medium mb-2'>Full Message</h4>
                  <pre className='text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md'>
                    {commit.subject}\n{commit.body}
                  </pre>
                </div>

                {/* Stats */}
                {commit.stats && (
                  <div>
                    <h4 className='text-sm font-medium mb-2'>Statistics</h4>
                    <div className='flex items-center gap-6 text-sm'>
                      <div className='flex items-center gap-2'>
                        <FileText className='h-4 w-4 text-muted-foreground' />
                        <span>{commit.stats.filesChanged} files changed</span>
                      </div>
                      {commit.stats.additions > 0 && (
                        <div className='flex items-center gap-1 text-green-600'>
                          <Plus className='h-4 w-4' />
                          <span>{commit.stats.additions} additions</span>
                        </div>
                      )}
                      {commit.stats.deletions > 0 && (
                        <div className='flex items-center gap-1 text-red-600'>
                          <Minus className='h-4 w-4' />
                          <span>{commit.stats.deletions} deletions</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value='files'>
                <ScrollArea className='h-[400px]'>
                  <div className='space-y-2'>
                    {commitData?.files?.map((file: GitFileDiff, index: number) => (
                      <div
                        key={index}
                        className='flex items-center justify-between p-3 rounded-md hover:bg-accent cursor-pointer'
                        onClick={() => setSelectedFile(file.path)}
                      >
                        <div className='flex items-center gap-3'>
                          {getFileStatusIcon(file.status)}
                          <span className={`font-mono text-sm ${getFileStatusColor(file.status)}`}>{file.path}</span>
                        </div>
                        <div className='flex items-center gap-3'>
                          {file.additions !== undefined && file.deletions !== undefined && (
                            <div className='flex items-center gap-2 text-sm'>
                              <span className='text-green-600'>+{file.additions}</span>
                              <span className='text-red-600'>-{file.deletions}</span>
                            </div>
                          )}
                          <Button variant='outline' size='sm'>
                            View Diff
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* File Diff Dialog */}
      {selectedFile && (
        <GitDiffDialog
          projectId={projectId}
          filePath={selectedFile}
          open={!!selectedFile}
          onOpenChange={(open) => !open && setSelectedFile(null)}
        />
      )}
    </>
  )
}
