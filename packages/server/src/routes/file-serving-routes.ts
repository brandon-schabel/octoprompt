// Recent changes:
// 1. Initial implementation of file serving routes for chat attachments
// 2. File streaming with proper content-type and headers
// 3. URL path parameter validation with Zod schemas
// 4. Error handling for file not found scenarios
// 5. Support for inline display and download of attachments

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { attachmentStorage } from '@/utils/storage/attachment-storage'
import { ApiError } from '@octoprompt/shared'
import { ApiErrorResponseSchema, unixTSSchemaSpec } from '@octoprompt/schemas'
import { stream } from 'hono/streaming'

const GetChatAttachmentParamsSchema = z.object({
  chatId: unixTSSchemaSpec.openapi({ param: { name: 'chatId', in: 'path' } }),
  // This messageId could be the tempMessageId if the final association hasn't happened,
  // or the final messageId if paths are updated post-message creation.
  messageId: z.string().openapi({ param: { name: 'messageId', in: 'path' } }),
  attachmentId: unixTSSchemaSpec.openapi({ param: { name: 'attachmentId', in: 'path' } }),
  fileName: z.string().openapi({ param: { name: 'fileName', in: 'path' } }),
})

const getChatAttachmentRouteDef = createRoute({
  method: 'get',
  path: '/api/files/chats/{chatId}/{messageId}/{attachmentId}/{fileName}',
  tags: ['Files', 'Attachments'],
  summary: 'Serve a specific chat message attachment',
  request: { params: GetChatAttachmentParamsSchema },
  responses: {
    200: { description: 'File content streamed successfully.' }, // Content-Type set dynamically
    404: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Attachment not found.' },
    500: { content: { 'application/json': { schema: ApiErrorResponseSchema } }, description: 'Internal Server Error' }
  },
})

export const fileServingRoutes = new OpenAPIHono()
  .openapi(getChatAttachmentRouteDef, async (c) => {
    const { chatId, messageId, attachmentId, fileName } = c.req.valid('param')

    const file = await attachmentStorage.getFile(chatId, parseInt(messageId,10), attachmentId, fileName)
    if (!file) {
      throw new ApiError(404, 'Attachment not found.', 'ATTACHMENT_NOT_FOUND')
    }

    c.header('Content-Type', file.type || 'application/octet-stream')
    c.header('Content-Length', file.size.toString())
    // Forcing download:
    // c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    // For inline display (e.g. images in browser):
    c.header('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`)

    return stream(c, async (streamInstance) => {
      await streamInstance.pipe(file.stream())
    })
  })
