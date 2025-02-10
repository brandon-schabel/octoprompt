import { z } from 'zod';

// Zod schemas for the 'chats' table
export const ChatCreateSchema = z.object({
  title: z.string(),
});

export const ChatReadSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ChatUpdateSchema = z.object({
  title: z.string().optional(),
});

export const ChatDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'chat_messages' table
export const ChatMessageCreateSchema = z.object({
  chatId: z.string(),
  role: z.string(),
  content: z.string(),
});

export const ChatMessageReadSchema = z.object({
  id: z.string(),
  chatId: z.string(),
  role: z.string(),
  content: z.string(),
  createdAt: z.date(),
});

export const ChatMessageUpdateSchema = z.object({
  role: z.string().optional(),
  content: z.string().optional(),
});

export const ChatMessageDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'projects' table
export const ProjectCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  path: z.string(),
});

export const ProjectReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  path: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProjectUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  path: z.string().optional(),
});

export const ProjectDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'files' table
export const FileCreateSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  path: z.string(),
  extension: z.string(),
  size: z.number(),
  content: z.string().optional(),
  summary: z.string().optional(),
  meta: z.string().optional(),
  checksum: z.string().optional(),
});

export const FileReadSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  path: z.string(),
  extension: z.string(),
  size: z.number(),
  content: z.string().nullable().optional(),
  summary: z.string(),
  summaryLastUpdatedAt: z.date(),
  meta: z.string(),
  checksum: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const FileUpdateSchema = z.object({
  name: z.string().optional(),
  path: z.string().optional(),
  extension: z.string().optional(),
  size: z.number().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  meta: z.string().optional(),
  checksum: z.string().optional(),
});

export const FileDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'prompts' table
export const PromptCreateSchema = z.object({
  name: z.string(),
  content: z.string(),
});

export const PromptReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const PromptUpdateSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
});

export const PromptDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'prompt_projects' table
export const PromptProjectCreateSchema = z.object({
  promptId: z.string(),
  projectId: z.string(),
});

export const PromptProjectReadSchema = z.object({
  id: z.string(),
  promptId: z.string(),
  projectId: z.string(),
});

export const PromptProjectUpdateSchema = z.object({
  promptId: z.string().optional(),
  projectId: z.string().optional(),
});

export const PromptProjectDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'provider_keys' table
export const ProviderKeyCreateSchema = z.object({
  provider: z.string(),
  key: z.string(),
});

export const ProviderKeyReadSchema = z.object({
  id: z.string(),
  provider: z.string(),
  key: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ProviderKeyUpdateSchema = z.object({
  provider: z.string().optional(),
  key: z.string().optional(),
});

export const ProviderKeyDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'tickets' table
export const TicketCreateSchema = z.object({
  projectId: z.string(),
  title: z.string(),
  overview: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  suggestedFileIds: z.string().optional(),
});

export const TicketReadSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  overview: z.string(),
  status: z.string(),
  priority: z.string(),
  suggestedFileIds: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TicketUpdateSchema = z.object({
  title: z.string().optional(),
  overview: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  suggestedFileIds: z.string().optional(),
});

export const TicketDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'ticket_files' table
export const TicketFileCreateSchema = z.object({
  ticketId: z.string(),
  fileId: z.string(),
});

export const TicketFileReadSchema = z.object({
  ticketId: z.string(),
  fileId: z.string(),
});

export const TicketFileDeleteSchema = z.object({
  ticketId: z.string(),
  fileId: z.string(),
});

// Zod schemas for the 'ticket_tasks' table
export const TicketTaskCreateSchema = z.object({
  ticketId: z.string(),
  content: z.string(),
  done: z.boolean().optional(),
  orderIndex: z.number().optional(),
});

export const TicketTaskReadSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  content: z.string(),
  done: z.preprocess((val) => {
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'boolean') return val;
    return false;
  }, z.boolean()),
  orderIndex: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const TicketTaskUpdateSchema = z.object({
  content: z.string().optional(),
  done: z.boolean().optional(),
});

export const TicketTaskDeleteSchema = z.object({
  id: z.string(),
});

// Zod schemas for the 'file_changes' table
export const FileChangeCreateSchema = z.object({
  filePath: z.string(),
  originalContent: z.string(),
  suggestedDiff: z.string(),
  status: z.string(),
  timestamp: z.number(),
});

export const FileChangeReadSchema = z.object({
  id: z.number(),
  filePath: z.string(),
  originalContent: z.string(),
  suggestedDiff: z.string(),
  status: z.string(),
  timestamp: z.number(),
});

export const FileChangeUpdateSchema = z.object({
  filePath: z.string().optional(),
  originalContent: z.string().optional(),
  suggestedDiff: z.string().optional(),
  status: z.string().optional(),
  timestamp: z.number().optional(),
});

export const FileChangeDeleteSchema = z.object({
  id: z.number(),
}); 