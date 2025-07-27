import { GlassCard, AnimateOnScroll } from '@/components/ui'
import { Check, X, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompatibilityItem {
  feature: string
  vscode: boolean | 'partial' | 'beta'
  cursor: boolean | 'partial' | 'beta'
  claudeDesktop: boolean | 'partial' | 'beta'
  claudeCode: boolean | 'partial' | 'beta'
  note?: string
}

const compatibilityData: CompatibilityItem[] = [
  {
    feature: 'MCP Protocol Support',
    vscode: true,
    cursor: true,
    claudeDesktop: true,
    claudeCode: true
  },
  {
    feature: 'Auto-start Server',
    vscode: true,
    cursor: true,
    claudeDesktop: true,
    claudeCode: 'beta'
  },
  {
    feature: 'File Suggestions',
    vscode: true,
    cursor: true,
    claudeDesktop: true,
    claudeCode: true
  },
  {
    feature: 'Project Overview',
    vscode: true,
    cursor: true,
    claudeDesktop: true,
    claudeCode: true
  },
  {
    feature: 'Ticket Management',
    vscode: true,
    cursor: true,
    claudeDesktop: true,
    claudeCode: true
  },
  {
    feature: 'Git Operations',
    vscode: true,
    cursor: true,
    claudeDesktop: 'partial',
    claudeCode: 'partial',
    note: 'Limited to read operations in desktop clients'
  },
  {
    feature: 'Code Refactoring',
    vscode: true,
    cursor: true,
    claudeDesktop: false,
    claudeCode: 'beta'
  },
  {
    feature: 'Multi-file Operations',
    vscode: true,
    cursor: true,
    claudeDesktop: false,
    claudeCode: 'beta'
  },
  {
    feature: 'Terminal Integration',
    vscode: true,
    cursor: true,
    claudeDesktop: false,
    claudeCode: false
  },
  {
    feature: 'Extension Compatibility',
    vscode: true,
    cursor: true,
    claudeDesktop: false,
    claudeCode: false,
    note: 'IDE-specific feature'
  },
  {
    feature: 'Custom Keybindings',
    vscode: true,
    cursor: true,
    claudeDesktop: false,
    claudeCode: 'partial'
  },
  {
    feature: 'Workspace Support',
    vscode: true,
    cursor: true,
    claudeDesktop: true,
    claudeCode: true
  }
]

const versionRequirements = [
  {
    editor: 'VS Code',
    minVersion: '1.80.0',
    recommendedVersion: '1.85.0+',
    nodeVersion: '18.0.0+',
    os: ['Windows 10+', 'macOS 11+', 'Ubuntu 20.04+']
  },
  {
    editor: 'Cursor',
    minVersion: '0.20.0',
    recommendedVersion: '0.25.0+',
    nodeVersion: '18.0.0+',
    os: ['Windows 10+', 'macOS 11+', 'Ubuntu 20.04+']
  },
  {
    editor: 'Claude Desktop',
    minVersion: '1.0.0',
    recommendedVersion: 'Latest',
    nodeVersion: '18.0.0+',
    os: ['Windows 10+', 'macOS 12+']
  },
  {
    editor: 'Claude Code',
    minVersion: '0.1.0',
    recommendedVersion: 'Latest Beta',
    nodeVersion: '18.0.0+',
    os: ['Windows 10+', 'macOS 12+', 'Ubuntu 22.04+']
  }
]

const StatusIcon = ({ status }: { status: boolean | 'partial' | 'beta' }) => {
  if (status === true) {
    return <Check className='w-5 h-5 text-green-500' />
  }
  if (status === 'partial') {
    return <AlertCircle className='w-5 h-5 text-yellow-500' />
  }
  if (status === 'beta') {
    return <Info className='w-5 h-5 text-blue-500' />
  }
  return <X className='w-5 h-5 text-gray-500' />
}

const StatusText = ({ status }: { status: boolean | 'partial' | 'beta' }) => {
  if (status === true) return <span className='text-green-500'>Supported</span>
  if (status === 'partial') return <span className='text-yellow-500'>Partial</span>
  if (status === 'beta') return <span className='text-blue-500'>Beta</span>
  return <span className='text-gray-500'>Not Available</span>
}

export function CompatibilityMatrix() {
  return (
    <div className='space-y-12'>
      {/* Feature Compatibility */}
      <AnimateOnScroll>
        <div>
          <h2 className='text-3xl font-bold mb-6 text-center'>Feature Compatibility</h2>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-border'>
                  <th className='text-left p-4'>Feature</th>
                  <th className='text-center p-4 min-w-[120px]'>VS Code</th>
                  <th className='text-center p-4 min-w-[120px]'>Cursor</th>
                  <th className='text-center p-4 min-w-[120px]'>Claude Desktop</th>
                  <th className='text-center p-4 min-w-[120px]'>Claude Code</th>
                </tr>
              </thead>
              <tbody>
                {compatibilityData.map((item, index) => (
                  <tr key={index} className={cn('border-b border-border/50', index % 2 === 0 && 'bg-muted/5')}>
                    <td className='p-4'>
                      <div>
                        <span className='font-medium'>{item.feature}</span>
                        {item.note && <p className='text-xs text-muted-foreground mt-1'>{item.note}</p>}
                      </div>
                    </td>
                    <td className='p-4 text-center'>
                      <div className='flex justify-center'>
                        <StatusIcon status={item.vscode} />
                      </div>
                    </td>
                    <td className='p-4 text-center'>
                      <div className='flex justify-center'>
                        <StatusIcon status={item.cursor} />
                      </div>
                    </td>
                    <td className='p-4 text-center'>
                      <div className='flex justify-center'>
                        <StatusIcon status={item.claudeDesktop} />
                      </div>
                    </td>
                    <td className='p-4 text-center'>
                      <div className='flex justify-center'>
                        <StatusIcon status={item.claudeCode} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AnimateOnScroll>

      {/* Legend */}
      <AnimateOnScroll>
        <div className='flex justify-center'>
          <GlassCard className='p-6 inline-block'>
            <h3 className='font-semibold mb-3'>Status Legend</h3>
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <div className='flex items-center gap-2'>
                <Check className='w-5 h-5 text-green-500' />
                <span className='text-sm'>Fully Supported</span>
              </div>
              <div className='flex items-center gap-2'>
                <AlertCircle className='w-5 h-5 text-yellow-500' />
                <span className='text-sm'>Partial Support</span>
              </div>
              <div className='flex items-center gap-2'>
                <Info className='w-5 h-5 text-blue-500' />
                <span className='text-sm'>Beta Feature</span>
              </div>
              <div className='flex items-center gap-2'>
                <X className='w-5 h-5 text-gray-500' />
                <span className='text-sm'>Not Available</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </AnimateOnScroll>

      {/* Version Requirements */}
      <AnimateOnScroll>
        <div>
          <h2 className='text-3xl font-bold mb-6 text-center'>Version Requirements</h2>
          <div className='grid md:grid-cols-2 gap-6'>
            {versionRequirements.map((req, index) => (
              <GlassCard key={index} className='p-6'>
                <h3 className='text-xl font-semibold mb-4'>{req.editor}</h3>
                <div className='space-y-3'>
                  <div>
                    <span className='text-sm text-muted-foreground'>Minimum Version:</span>
                    <p className='font-mono'>{req.minVersion}</p>
                  </div>
                  <div>
                    <span className='text-sm text-muted-foreground'>Recommended:</span>
                    <p className='font-mono text-primary'>{req.recommendedVersion}</p>
                  </div>
                  <div>
                    <span className='text-sm text-muted-foreground'>Node.js:</span>
                    <p className='font-mono'>{req.nodeVersion}</p>
                  </div>
                  <div>
                    <span className='text-sm text-muted-foreground'>Operating Systems:</span>
                    <ul className='mt-1'>
                      {req.os.map((os, i) => (
                        <li key={i} className='text-sm flex items-center gap-2'>
                          <Check className='w-3 h-3 text-green-500' />
                          {os}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </AnimateOnScroll>

      {/* Update Schedule */}
      <AnimateOnScroll>
        <GlassCard className='p-8 text-center'>
          <h3 className='text-2xl font-bold mb-4'>Update Schedule</h3>
          <p className='text-muted-foreground mb-6 max-w-2xl mx-auto'>
            We continuously improve Promptliano's compatibility with all supported editors
          </p>
          <div className='grid md:grid-cols-3 gap-6 max-w-3xl mx-auto'>
            <div>
              <div className='text-3xl font-bold text-primary mb-2'>Weekly</div>
              <p className='text-sm text-muted-foreground'>Bug fixes & patches</p>
            </div>
            <div>
              <div className='text-3xl font-bold text-primary mb-2'>Monthly</div>
              <p className='text-sm text-muted-foreground'>Feature updates</p>
            </div>
            <div>
              <div className='text-3xl font-bold text-primary mb-2'>Quarterly</div>
              <p className='text-sm text-muted-foreground'>Major releases</p>
            </div>
          </div>
        </GlassCard>
      </AnimateOnScroll>
    </div>
  )
}
