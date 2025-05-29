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
  const {
    data: systemStatus,
    isLoading: isLoadingSystem,
    error: systemError,
    refetch: refetchSystemStatus
  } = useGetSystemStatus()

  // Format uptime to a human-readable string
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (3600 * 24))
    const hours = Math.floor((seconds % (3600 * 24)) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    return `${days}d ${hours}h ${minutes}m ${remainingSeconds}s`
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

  return (
    <div className='container p-2'>
      <Tabs defaultValue='system-status'>
        <TabsList className='mb-4'>
          <TabsTrigger value='system-status'>System Status</TabsTrigger>
          <TabsTrigger value='database-stats'>Database Stats</TabsTrigger>
          <TabsTrigger value='swagger-ui'>Swagger UI</TabsTrigger>
        </TabsList>

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
            </div>

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
