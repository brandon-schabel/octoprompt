# Git Commit History Components

This directory contains components for displaying and interacting with git commit history.

## Components

### CommitList

The main component that displays a paginated list of commits with search and filtering capabilities.

```tsx
import { CommitList } from './git-commit-history'

function MyComponent() {
  const [selectedBranch, setSelectedBranch] = useState<string>()

  return <CommitList projectId={projectId} selectedBranch={selectedBranch} onBranchChange={setSelectedBranch} />
}
```

### BranchSelector

A dropdown component for selecting git branches, showing the current branch and latest commit info.

```tsx
import { BranchSelector } from './git-commit-history'

function MyComponent() {
  return (
    <BranchSelector
      projectId={projectId}
      selectedBranch={selectedBranch}
      onBranchChange={(branch) => setSelectedBranch(branch)}
    />
  )
}
```

### CommitCard

Individual commit display component with collapsible details.

### CommitDetailModal

Modal dialog showing full commit details including file changes.

## Usage Example

```tsx
import { useState } from 'react'
import { CommitList, BranchSelector } from '@/components/projects/git-commit-history'

export function GitHistoryView({ projectId }: { projectId: number }) {
  const [selectedBranch, setSelectedBranch] = useState<string>()

  return (
    <div className='flex flex-col h-full'>
      <div className='p-4 border-b'>
        <BranchSelector projectId={projectId} selectedBranch={selectedBranch} onBranchChange={setSelectedBranch} />
      </div>
      <CommitList projectId={projectId} selectedBranch={selectedBranch} onBranchChange={setSelectedBranch} />
    </div>
  )
}
```
