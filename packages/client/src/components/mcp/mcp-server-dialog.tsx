import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { MCPServerConfig } from '@octoprompt/schemas'
import { useCreateMCPServerConfig, useUpdateMCPServerConfig } from '@/hooks/api/use-mcp-api'

const mcpServerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  command: z.string().min(1, 'Command is required'),
  args: z.string().optional().default(''),
  env: z.string().optional().default(''),
  enabled: z.boolean().default(true),
  autoStart: z.boolean().default(false),
})

type MCPServerFormValues = z.infer<typeof mcpServerFormSchema>

interface MCPServerDialogProps {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  editingServer?: MCPServerConfig | null
}

export function MCPServerDialog({ 
  projectId, 
  open, 
  onOpenChange, 
  editingServer 
}: MCPServerDialogProps) {
  const isEditing = !!editingServer
  const createMutation = useCreateMCPServerConfig(projectId)
  const updateMutation = useUpdateMCPServerConfig(projectId, editingServer?.id || 0)

  const form = useForm<MCPServerFormValues>({
    resolver: zodResolver(mcpServerFormSchema),
    defaultValues: {
      name: '',
      command: '',
      args: '',
      env: '',
      enabled: true,
      autoStart: false,
    },
  })

  useEffect(() => {
    if (editingServer) {
      form.reset({
        name: editingServer.name,
        command: editingServer.command,
        args: editingServer.args.join(' '),
        env: Object.entries(editingServer.env)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n'),
        enabled: editingServer.enabled,
        autoStart: editingServer.autoStart,
      })
    } else {
      form.reset({
        name: '',
        command: '',
        args: '',
        env: '',
        enabled: true,
        autoStart: false,
      })
    }
  }, [editingServer, form])

  const onSubmit = async (values: MCPServerFormValues) => {
    try {
      // Parse args from string to array
      const args = values.args?.trim() ? values.args.trim().split(/\s+/) : []
      
      // Parse env from string to object
      const env: Record<string, string> = {}
      if (values.env?.trim()) {
        values.env.split('\n').forEach(line => {
          const [key, ...valueParts] = line.split('=')
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim()
          }
        })
      }

      const data = {
        name: values.name,
        command: values.command,
        args,
        env,
        enabled: values.enabled,
        autoStart: values.autoStart,
      }

      if (isEditing) {
        await updateMutation.mutateAsync(data)
        toast.success('MCP server updated successfully')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('MCP server created successfully')
      }

      onOpenChange(false)
    } catch (error) {
      toast.error(isEditing ? 'Failed to update MCP server' : 'Failed to create MCP server')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit MCP Server' : 'Add MCP Server'}
          </DialogTitle>
          <DialogDescription>
            Configure a Model Context Protocol server for this project
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="File System Tools" {...field} />
                  </FormControl>
                  <FormDescription>
                    A friendly name for this MCP server
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Command</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="npx @modelcontextprotocol/server-filesystem" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    The command to start the MCP server
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="args"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arguments (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="--root /path/to/project" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Command line arguments separated by spaces
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="env"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Environment Variables (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="NODE_ENV=production&#10;API_KEY=your-key" 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    One per line in KEY=value format
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Enabled
                      </FormLabel>
                      <FormDescription>
                        Allow this server to be started
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoStart"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Auto-start
                      </FormLabel>
                      <FormDescription>
                        Automatically start when project opens
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? isEditing
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditing
                  ? 'Update'
                  : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}