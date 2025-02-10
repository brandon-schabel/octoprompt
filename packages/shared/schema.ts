import type { z } from 'zod'
import { ChatMessageReadSchema, ChatReadSchema, FileReadSchema, ProjectReadSchema, PromptProjectReadSchema, PromptReadSchema, ProviderKeyReadSchema, TicketFileReadSchema, TicketReadSchema, TicketTaskReadSchema } from './src/utils/database/db-schemas'



export type ProjectFile = z.infer<typeof FileReadSchema>
export type Project = z.infer<typeof ProjectReadSchema>
export type Prompt = z.infer<typeof PromptReadSchema>
export type PromptProject = z.infer<typeof PromptProjectReadSchema>
export type Ticket = z.infer<typeof TicketReadSchema>
export type TicketFile = z.infer<typeof TicketFileReadSchema>
export type TicketTask = z.infer<typeof TicketTaskReadSchema>
export type ProviderKey = z.infer<typeof ProviderKeyReadSchema>
export type Chat = z.infer<typeof ChatReadSchema>
export type ChatMessage = z.infer<typeof ChatMessageReadSchema>
export type ExtendedChatMessage = ChatMessage & {
    tempId?: string
}
