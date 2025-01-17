import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { ExpandableTextarea } from '@/components/expandable-textarea'

interface PromptDialogProps {
    open: boolean
    editPromptId: string | null
    promptForm: UseFormReturn<any, any>
    handleCreatePrompt: (values: any) => Promise<void>
    handleUpdatePrompt: (values: any) => Promise<void>
    createPromptPending: boolean
    updatePromptPending: boolean
    onClose: () => void
}

export function PromptDialog({
    open,
    editPromptId,
    promptForm,
    handleCreatePrompt,
    handleUpdatePrompt,
    createPromptPending,
    updatePromptPending,
    onClose,
    
}: PromptDialogProps) {
    const handleFormKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement) {
            e.stopPropagation()
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(dialogOpen) => {
                if (!dialogOpen) {
                    promptForm.reset()
                }
                if (!dialogOpen) {
                    onClose()
                }
            }}
        >
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle>{editPromptId ? 'Edit Prompt' : 'New Prompt'}</DialogTitle>
                    <DialogDescription>
                        {editPromptId ? 'Update the prompt details.' : 'Create a new prompt.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...promptForm}>
                    <form 
                        onSubmit={promptForm.handleSubmit(editPromptId ? handleUpdatePrompt : handleCreatePrompt)} 
                        className="space-y-4"
                        onKeyDown={handleFormKeyDown}
                    >
                        <FormField
                            control={promptForm.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prompt Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Summarize Document" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={promptForm.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Prompt Content</FormLabel>
                                    <FormControl>
                                        <ExpandableTextarea
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            placeholder="Enter the prompt instructions here..."
                                            title="Edit Prompt Content"
                                            className="min-h-[200px]"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={createPromptPending || updatePromptPending}>
                                {(createPromptPending || updatePromptPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editPromptId ? 'Update Prompt' : 'Create Prompt'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}