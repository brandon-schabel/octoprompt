import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ui'
import { Card, CardHeader, CardContent, CardTitle } from '@ui'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@ui'
import { Alert, AlertTitle, AlertDescription } from '@ui'
import { Badge } from '@ui'
import { Button } from '@ui'
import { Loader2, RefreshCw } from 'lucide-react'
import { useGetEnvironmentInfo, useGetSystemStatus } from '@/hooks/api/use-admin-api'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'

export const Route = createFileRoute('/admin')({
  component: AdminPage
})

function AdminPage() {
  const { data: envInfo, isLoading: isLoadingEnv, error: envError, refetch: refetchEnvInfo } = useGetEnvironmentInfo()

  const {
    data: systemStatus,
    isLoading: isLoadingSystem,
    error: systemError,
    refetch: refetchSystemStatus
  } = useGetSystemStatus()

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Format uptime to a human-readable string
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (3600 * 24))
    const hours = Math.floor((seconds % (3600 * 24)) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`
  }

  const handleRefreshEnvInfo = async () => {
    try {
      await refetchEnvInfo()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error('Failed to refresh environment info', {
        description: errorMessage
      })
    }
  }

  // Handle refresh for system status
  const handleRefreshSystemStatus = async () => {
    try {
      await refetchSystemStatus()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      toast.error('Failed to refresh system status', {
        description: errorMessage
      })
    }
  }

  console.log('envInfo', envInfo)

  return (
    <div className='container p-2'>
      <Tabs defaultValue='env-info'>
        <TabsList className='mb-4'>
          <TabsTrigger value='env-info'>Environment Info</TabsTrigger>
          <TabsTrigger value='system-status'>System Status</TabsTrigger>
          <TabsTrigger value='database-stats'>Database Stats</TabsTrigger>
          <TabsTrigger value='swagger-ui'>Swagger UI</TabsTrigger>
        </TabsList>

        {/* Environment Info Panel */}
        <TabsContent value='env-info'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-xl font-semibold'>Environment Information</h2>
              <Button variant='outline' size='sm' onClick={handleRefreshEnvInfo} disabled={isLoadingEnv}>
                {isLoadingEnv ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className='mr-2 h-4 w-4' />
                    Refresh
                  </>
                )}
              </Button>
            </div>

            {envError && (
              <Alert variant='destructive'>
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {envError instanceof Error ? envError.message : 'Failed to fetch environment info'}
                </AlertDescription>
              </Alert>
            )}

            {isLoadingEnv && !envInfo ? (
              <div className='flex flex-col items-center justify-center py-10'>
                <Loader2 className='h-8 w-8 animate-spin text-primary' />
                <p className='mt-4 text-muted-foreground'>Loading environment information...</p>
              </div>
            ) : envInfo ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Environment Variables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(envInfo.environment).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className='font-medium'>{key}</TableCell>
                            <TableCell>
                              {value || <span className='text-muted-foreground italic'>undefined</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Server Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className='font-medium'>Node Version</TableCell>
                          <TableCell>{envInfo?.serverInfo?.version}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className='font-medium'>Bun Version</TableCell>
                          <TableCell>{envInfo?.serverInfo?.bunVersion}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className='font-medium'>Platform</TableCell>
                          <TableCell>{envInfo?.serverInfo?.platform}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className='font-medium'>Architecture</TableCell>
                          <TableCell>{envInfo?.serverInfo?.arch}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className='font-medium'>Uptime</TableCell>
                          <TableCell>{formatUptime(envInfo?.serverInfo?.uptime)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* <Card>
                  <CardHeader>
                    <CardTitle>Memory Usage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(envInfo?.serverInfo?.memoryUsage).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell className='font-medium'>{key}</TableCell>
                            <TableCell>{formatBytes(value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card> */}
              </>
            ) : null}
          </div>
        </TabsContent>

        {/* System Status Panel */}
        <TabsContent value='system-status'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-xl font-semibold'>System Status</h2>
              <Button variant='outline' size='sm' onClick={handleRefreshSystemStatus} disabled={isLoadingSystem}>
                {isLoadingSystem ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className='mr-2 h-4 w-4' />
                    Refresh
                  </>
                )}
              </Button>
            </div>

            {systemError && (
              <Alert variant='destructive'>
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {systemError instanceof Error ? systemError.message : 'Failed to fetch system status'}
                </AlertDescription>
              </Alert>
            )}

            {isLoadingSystem && !systemStatus ? (
              <div className='flex flex-col items-center justify-center py-10'>
                <Loader2 className='h-8 w-8 animate-spin text-primary' />
                <p className='mt-4 text-muted-foreground'>Loading system status...</p>
              </div>
            ) : systemStatus ? (
              <Card>
                <CardHeader className='flex flex-row items-center'>
                  <CardTitle>Current Status</CardTitle>
                  <Badge className='ml-2' variant={systemStatus.status === 'operational' ? 'default' : 'destructive'}>
                    {systemStatus.status.toUpperCase()}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className='font-medium'>API</TableCell>
                        <TableCell>
                          <Badge variant={systemStatus.checks.api === 'healthy' ? 'default' : 'destructive'}>
                            {systemStatus.checks.api.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className='font-medium'>Last Check</TableCell>
                        <TableCell>{new Date(systemStatus.checks.timestamp).toLocaleString()}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        {/* Database Stats Panel */}
        <TabsContent value='database-stats'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-xl font-semibold'>Database Statistics</h2>
              <Button variant='outline' size='sm' onClick={handleRefreshEnvInfo} disabled={isLoadingEnv}>
                {isLoadingEnv ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className='mr-2 h-4 w-4' />
                    Refresh
                  </>
                )}
              </Button>
            </div>

            {envError && (
              <Alert variant='destructive'>
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {envError instanceof Error ? envError.message : 'Failed to fetch database statistics'}
                </AlertDescription>
              </Alert>
            )}

            {/* {!envInfo?.databaseStats && isLoadingEnv && !envInfo ? (
              <div className='flex flex-col items-center justify-center py-10'>
                <Loader2 className='h-8 w-8 animate-spin text-primary' />
                <p className='mt-4 text-muted-foreground'>Loading database statistics...</p>
              </div>
            ) : envInfo?.databaseStats ? (
              <Card>
                <CardHeader>
                  <CardTitle>Table Row Counts</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Table Name</TableHead>
                        <TableHead>Row Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(envInfo?.databaseStats ?? {}).map(([table, { count }]) => (
                        <TableRow key={table}>
                          <TableCell className='font-medium'>{table}</TableCell>
                          <TableCell>{count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null} */}
          </div>
        </TabsContent>

        {/* Swagger UI Panel */}
        <TabsContent value='swagger-ui'>
          <div className='h-[calc(100vh-200px)]'>
            <iframe src={`${SERVER_HTTP_ENDPOINT}/swagger`} title='Swagger UI' className='w-full h-full border-none' />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminPage
