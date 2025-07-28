import { GlassCard } from '@/components/ui/glass-card'
import { Github, Trophy, Code, FileText, Bug } from 'lucide-react'
import type { Contributor } from '@/schemas/community.schemas'

const mockContributors: Contributor[] = [
  {
    id: '1',
    username: 'brandon',
    name: 'Brandon',
    avatar: 'https://github.com/brandon.png',
    githubUrl: 'https://github.com/brandon',
    contributions: 342,
    role: 'maintainer',
    badges: ['early-adopter', 'feature-builder']
  },
  {
    id: '2',
    username: 'alice-dev',
    name: 'Alice Chen',
    avatar: 'https://github.com/alice-dev.png',
    githubUrl: 'https://github.com/alice-dev',
    contributions: 89,
    role: 'contributor',
    badges: ['bug-hunter', 'doc-writer']
  },
  {
    id: '3',
    username: 'dev-master',
    name: 'John Doe',
    avatar: 'https://github.com/dev-master.png',
    githubUrl: 'https://github.com/dev-master',
    contributions: 67,
    role: 'contributor',
    badges: ['feature-builder']
  },
  {
    id: '4',
    username: 'sarah-codes',
    name: 'Sarah Williams',
    avatar: 'https://github.com/sarah-codes.png',
    githubUrl: 'https://github.com/sarah-codes',
    contributions: 45,
    role: 'contributor',
    badges: ['doc-writer']
  },
  {
    id: '5',
    username: 'mike-js',
    name: 'Mike Johnson',
    avatar: 'https://github.com/mike-js.png',
    githubUrl: 'https://github.com/mike-js',
    contributions: 38,
    role: 'supporter',
    badges: ['bug-hunter']
  },
  {
    id: '6',
    username: 'emma-react',
    name: 'Emma Davis',
    avatar: 'https://github.com/emma-react.png',
    githubUrl: 'https://github.com/emma-react',
    contributions: 29,
    role: 'supporter',
    badges: ['early-adopter']
  }
]

const badgeIcons = {
  'early-adopter': Trophy,
  'bug-hunter': Bug,
  'doc-writer': FileText,
  'feature-builder': Code
}

const badgeLabels = {
  'early-adopter': 'Early Adopter',
  'bug-hunter': 'Bug Hunter',
  'doc-writer': 'Documentation',
  'feature-builder': 'Feature Builder'
}

interface ContributorsProps {
  contributors?: Contributor[]
  totalCount?: number
}

export function Contributors({ contributors = mockContributors, totalCount = 127 }: ContributorsProps) {
  return (
    <GlassCard className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-2xl font-bold mb-2'>Top Contributors</h3>
          <p className='text-muted-foreground'>Amazing developers building Promptliano</p>
        </div>
        <a
          href='https://github.com/brandon-schabel/promptliano/graphs/contributors'
          target='_blank'
          rel='noopener noreferrer'
          className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          View all {totalCount} contributors
          <Github className='w-4 h-4' />
        </a>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
        {contributors.map((contributor) => (
          <a
            key={contributor.id}
            href={contributor.githubUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='group relative bg-background/50 rounded-lg p-4 hover:bg-background/80 transition-colors'
          >
            <div className='flex items-start gap-3'>
              <img
                src={contributor.avatar}
                alt={contributor.name || contributor.username}
                className='w-12 h-12 rounded-full'
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${contributor.username}&background=random`
                }}
              />
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <h4 className='font-semibold truncate'>{contributor.name || contributor.username}</h4>
                  {contributor.role === 'maintainer' && (
                    <span className='text-xs bg-primary/20 text-primary px-2 py-0.5 rounded'>Maintainer</span>
                  )}
                </div>
                <p className='text-sm text-muted-foreground'>@{contributor.username}</p>
                <p className='text-sm font-medium mt-1'>{contributor.contributions} contributions</p>
              </div>
            </div>

            {contributor.badges.length > 0 && (
              <div className='flex gap-1 mt-3'>
                {contributor.badges.map((badge) => {
                  const Icon = badgeIcons[badge]
                  return (
                    <div
                      key={badge}
                      className='w-6 h-6 bg-primary/10 rounded flex items-center justify-center group-hover:bg-primary/20 transition-colors'
                      title={badgeLabels[badge]}
                    >
                      <Icon className='w-3.5 h-3.5 text-primary' />
                    </div>
                  )
                })}
              </div>
            )}
          </a>
        ))}
      </div>

      <div className='mt-6 p-4 bg-primary/5 rounded-lg'>
        <p className='text-sm text-center'>
          Want to contribute? Check out our{' '}
          <a
            href='https://github.com/brandon-schabel/promptliano/blob/main/CONTRIBUTING.md'
            className='font-medium text-primary hover:underline'
            target='_blank'
            rel='noopener noreferrer'
          >
            contribution guide
          </a>{' '}
          and start building with us!
        </p>
      </div>
    </GlassCard>
  )
}
