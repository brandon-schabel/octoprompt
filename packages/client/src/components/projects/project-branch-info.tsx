import { GitBranch } from 'lucide-react'
import { useGitCurrentBranch } from '@/hooks/api/use-git-branch'

interface ProjectBranchInfoProps {
  projectId: number
  className?: string
}

export function ProjectBranchInfo({ projectId, className = '' }: ProjectBranchInfoProps) {
  const { branch } = useGitCurrentBranch(projectId)

  if (!branch) return null

  return (
    <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
      <GitBranch className='h-3 w-3 shrink-0' />
      <span className='truncate'>{branch}</span>
    </div>
  )
}
