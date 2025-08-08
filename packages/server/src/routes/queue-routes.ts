import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  TaskQueueSchema,
  QueueItemSchema,
  QueueStatsSchema,
  QueueWithStatsSchema,
  CreateQueueBodySchema,
  UpdateQueueBodySchema,
  EnqueueItemBodySchema,
  UpdateQueueItemBodySchema,
  BatchEnqueueBodySchema,
  BatchUpdateItemsBodySchema,
  GetNextTaskResponseSchema,
  BulkMoveItemsBodySchema,
  ReorderQueueItemsBodySchema,
  QueueTimelineSchema,
  queueApiValidation,
  TicketSchema,
  TicketTaskSchema
} from '@promptliano/schemas'
import {
  createQueue,
  getQueueById,
  listQueuesByProject,
  updateQueue,
  deleteQueue,
  enqueueItem,
  updateQueueItem,
  deleteQueueItem,
  getQueueItems,
  getQueueItemsWithDetails,
  getQueueStats,
  getQueuesWithStats,
  batchEnqueueItems,
  batchUpdateQueueItems,
  enqueueTicketWithAllTasks,
  getNextTaskFromQueue,
  bulkMoveItems,
  reorderQueueItems,
  getQueueTimeline,
  getUnqueuedItems
} from '@promptliano/services'
import { ApiError } from '@promptliano/shared'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'

export const queueRoutes = new OpenAPIHono()

// Create queue
const createQueueRoute = createRoute({
  method: 'post',
  path: '/api/projects/:projectId/queues',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateQueueBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Queue created successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TaskQueueSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(createQueueRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const body = c.req.valid('json')

  const queue = await createQueue({
    ...body,
    projectId
  })

  return c.json({ success: true, data: queue })
})

// List queues for project
const listQueuesRoute = createRoute({
  method: 'get',
  path: '/api/projects/:projectId/queues',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'List of queues',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(TaskQueueSchema)
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(listQueuesRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const queues = await listQueuesByProject(projectId)
  return c.json({ success: true, data: queues })
})

// Get queue by ID
const getQueueRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'Queue details',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TaskQueueSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(getQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const queue = await getQueueById(queueId)
  return c.json({ success: true, data: queue })
})

// Update queue
const updateQueueRoute = createRoute({
  method: 'patch',
  path: '/api/queues/:queueId',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateQueueBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Queue updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: TaskQueueSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(updateQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const body = c.req.valid('json')
  const queue = await updateQueue(queueId, body)
  return c.json({ success: true, data: queue })
})

// Delete queue
const deleteQueueRoute = createRoute({
  method: 'delete',
  path: '/api/queues/:queueId',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'Queue deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ deleted: z.boolean() })
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(deleteQueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  await deleteQueue(queueId)
  return c.json({ success: true, data: { deleted: true } })
})

// Enqueue item
const enqueueItemRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/items',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: EnqueueItemBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Item enqueued successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: QueueItemSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(enqueueItemRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const body = c.req.valid('json')
  const item = await enqueueItem(queueId, body)
  return c.json({ success: true, data: item })
})

// Enqueue ticket with all tasks
const enqueueTicketRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/enqueue-ticket',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ticketId: z.number(),
            priority: z.number().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Ticket tasks enqueued successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(QueueItemSchema)
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(enqueueTicketRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { ticketId, priority } = c.req.valid('json')
  const items = await enqueueTicketWithAllTasks(queueId, ticketId, priority)
  return c.json({ success: true, data: items })
})

// Batch enqueue items
const batchEnqueueRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/batch-enqueue',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: BatchEnqueueBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Items batch enqueued successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(QueueItemSchema)
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(batchEnqueueRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { items } = c.req.valid('json')
  const results = await batchEnqueueItems(queueId, items)
  return c.json({ success: true, data: results })
})

// Get queue items
const getQueueItemsRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId/items',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    }),
    query: z.object({
      status: z.string().optional()
    })
  },
  responses: {
    200: {
      description: 'List of queue items',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(
              z.object({
                queueItem: QueueItemSchema,
                ticket: TicketSchema.optional(),
                task: TicketTaskSchema.optional()
              })
            )
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(getQueueItemsRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { status } = c.req.valid('query')
  const items = await getQueueItemsWithDetails(queueId, status)
  return c.json({ success: true, data: items })
})

// Update queue item
const updateQueueItemRoute = createRoute({
  method: 'patch',
  path: '/api/queue-items/:itemId',
  request: {
    params: z.object({
      itemId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateQueueItemBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Queue item updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: QueueItemSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(updateQueueItemRoute, async (c) => {
  const { itemId } = c.req.valid('param')
  const body = c.req.valid('json')
  const item = await updateQueueItem(itemId, body)
  return c.json({ success: true, data: item })
})

// Batch update queue items
const batchUpdateItemsRoute = createRoute({
  method: 'patch',
  path: '/api/queue-items/batch',
  request: {
    body: {
      content: {
        'application/json': {
          schema: BatchUpdateItemsBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Items batch updated successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(QueueItemSchema)
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(batchUpdateItemsRoute, async (c) => {
  const { updates } = c.req.valid('json')
  const results = await batchUpdateQueueItems(updates)
  return c.json({ success: true, data: results })
})

// Delete queue item
const deleteQueueItemRoute = createRoute({
  method: 'delete',
  path: '/api/queue-items/:itemId',
  request: {
    params: z.object({
      itemId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'Queue item deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ deleted: z.boolean() })
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(deleteQueueItemRoute, async (c) => {
  const { itemId } = c.req.valid('param')
  await deleteQueueItem(itemId)
  return c.json({ success: true, data: { deleted: true } })
})

// Get queue statistics
const getQueueStatsRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId/stats',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'Queue statistics',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: QueueStatsSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(getQueueStatsRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const stats = await getQueueStats(queueId)
  return c.json({ success: true, data: stats })
})

// Get all queues with stats
const getQueuesWithStatsRoute = createRoute({
  method: 'get',
  path: '/api/projects/:projectId/queues-with-stats',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'Queues with statistics',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.array(QueueWithStatsSchema)
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(getQueuesWithStatsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const queuesWithStats = await getQueuesWithStats(projectId)
  return c.json({ success: true, data: queuesWithStats })
})

// Get next task from queue
const getNextTaskRoute = createRoute({
  method: 'post',
  path: '/api/queues/:queueId/next-task',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            agentId: z.string().optional()
          })
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Next task from queue',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: GetNextTaskResponseSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(getNextTaskRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const { agentId } = c.req.valid('json')
  const nextTask = await getNextTaskFromQueue(queueId, agentId)
  return c.json({ success: true, data: nextTask })
})

// Bulk move items between queues
const bulkMoveItemsRoute = createRoute({
  method: 'post',
  path: '/api/queue-items/bulk-move',
  request: {
    body: {
      content: {
        'application/json': {
          schema: BulkMoveItemsBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Items moved successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ moved: z.boolean() })
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(bulkMoveItemsRoute, async (c) => {
  const { itemIds, targetQueueId, positions } = c.req.valid('json')
  await bulkMoveItems(itemIds, targetQueueId, positions)
  return c.json({ success: true, data: { moved: true } })
})

// Reorder items within a queue
const reorderQueueItemsRoute = createRoute({
  method: 'post',
  path: '/api/queue-items/reorder',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ReorderQueueItemsBodySchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Items reordered successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({ reordered: z.boolean() })
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(reorderQueueItemsRoute, async (c) => {
  const { queueId, itemIds } = c.req.valid('json')
  await reorderQueueItems(queueId, itemIds)
  return c.json({ success: true, data: { reordered: true } })
})

// Get queue timeline
const getQueueTimelineRoute = createRoute({
  method: 'get',
  path: '/api/queues/:queueId/timeline',
  request: {
    params: z.object({
      queueId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'Queue timeline',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: QueueTimelineSchema
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(getQueueTimelineRoute, async (c) => {
  const { queueId } = c.req.valid('param')
  const timeline = await getQueueTimeline(queueId)
  return c.json({ success: true, data: timeline })
})

// Get unqueued items
const getUnqueuedItemsRoute = createRoute({
  method: 'get',
  path: '/api/projects/:projectId/unqueued-items',
  request: {
    params: z.object({
      projectId: z.string().transform((val) => parseInt(val, 10))
    })
  },
  responses: {
    200: {
      description: 'Unqueued items',
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              tickets: z.array(z.any()),
              tasks: z.array(z.any())
            })
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    404: {
      description: 'Not found',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ApiErrorResponseSchema
        }
      }
    }
  }
})

queueRoutes.openapi(getUnqueuedItemsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const unqueuedItems = await getUnqueuedItems(projectId)
  return c.json({ success: true, data: unqueuedItems })
})
