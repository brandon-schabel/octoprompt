import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiErrorResponseSchema, OperationSuccessResponseSchema } from '@promptliano/schemas'
import {
  CreatePromptBodySchema,
  UpdatePromptBodySchema,
  PromptIdParamsSchema,
  ProjectAndPromptIdParamsSchema,
  PromptResponseSchema,
  PromptListResponseSchema,
  SuggestPromptsRequestSchema,
  SuggestPromptsResponseSchema
} from '@promptliano/schemas'
import {
  addPromptToProject,
  createPrompt,
  deletePrompt,
  getPromptById,
  listAllPrompts,
  listPromptsByProject,
  removePromptFromProject,
  updatePrompt,
  suggestPrompts
} from '@promptliano/services'
import { ProjectIdParamsSchema } from '@promptliano/schemas'

const createPromptRoute = createRoute({
  method: 'post',
  path: '/api/prompts',
  tags: ['Prompts'],
  summary: 'Create a new prompt',
  request: {
    body: {
      content: { 'application/json': { schema: CreatePromptBodySchema } },
      required: true
    }
  },
  responses: {
    201: {
      content: { 'application/json': { schema: PromptResponseSchema } },
      description: 'Prompt created successfully'
    },
    422: {
      // Validation Error
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    404: {
      // Project not found if projectId is provided and invalid
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Referenced project not found'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const listAllPromptsRoute = createRoute({
  method: 'get',
  path: '/api/prompts',
  tags: ['Prompts'],
  summary: 'List all available prompts',
  responses: {
    200: {
      content: { 'application/json': { schema: PromptListResponseSchema } },
      description: 'Successfully retrieved all prompts'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const listProjectPromptsRoute = createRoute({
  method: 'get',
  path: '/api/projects/{projectId}/prompts',
  tags: ['Projects', 'Prompts'],
  summary: 'List prompts associated with a specific project',
  request: {
    params: ProjectIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PromptListResponseSchema } },
      description: 'Successfully retrieved project prompts'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const suggestPromptsRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/suggest-prompts',
  tags: ['Projects', 'Prompts', 'AI'],
  summary: 'Get AI-suggested prompts based on user input',
  description: 'Uses AI to analyze user input and suggest the most relevant prompts from the project',
  request: {
    params: ProjectIdParamsSchema,
    body: {
      content: { 'application/json': { schema: SuggestPromptsRequestSchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SuggestPromptsResponseSchema } },
      description: 'Successfully retrieved suggested prompts'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const addPromptToProjectRoute = createRoute({
  method: 'post',
  path: '/api/projects/{projectId}/prompts/{promptId}',
  tags: ['Projects', 'Prompts'],
  summary: 'Associate a prompt with a project',
  request: {
    params: ProjectAndPromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Prompt successfully associated with project'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or Prompt not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const removePromptFromProjectRoute = createRoute({
  method: 'delete',
  path: '/api/projects/{projectId}/prompts/{promptId}',
  tags: ['Projects', 'Prompts'],
  summary: 'Disassociate a prompt from a project',
  request: {
    params: ProjectAndPromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Prompt successfully disassociated from project'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Project or Prompt not found, or association does not exist'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const getPromptByIdRoute = createRoute({
  method: 'get',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: 'Get a specific prompt by its ID',
  request: {
    params: PromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PromptResponseSchema } },
      description: 'Successfully retrieved prompt'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const updatePromptRoute = createRoute({
  method: 'patch',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: "Update a prompt's details",
  request: {
    params: PromptIdParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdatePromptBodySchema } },
      required: true
    }
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PromptResponseSchema } },
      description: 'Prompt updated successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    422: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

const deletePromptRoute = createRoute({
  method: 'delete',
  path: '/api/prompts/{promptId}',
  tags: ['Prompts'],
  summary: 'Delete a prompt',
  request: {
    params: PromptIdParamsSchema
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OperationSuccessResponseSchema } },
      description: 'Prompt deleted successfully'
    },
    404: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Prompt not found'
    },
    422: {
      // Validation Error
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Validation Error'
    },
    500: {
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
      description: 'Internal Server Error'
    }
  }
})

export const promptRoutes = new OpenAPIHono()
  .openapi(createPromptRoute, async (c) => {
    const body = c.req.valid('json')
    const createdPrompt = await createPrompt({
      name: body.name,
      content: body.content,
      projectId: body.projectId
    })
    return c.json({ success: true, data: createdPrompt } satisfies z.infer<typeof PromptResponseSchema>, 201)
  })
  .openapi(listAllPromptsRoute, async (c) => {
    return c.json(
      { success: true, data: await listAllPrompts() } satisfies z.infer<typeof PromptListResponseSchema>,
      200
    )
  })
  .openapi(listProjectPromptsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const projectPrompts = await listPromptsByProject(projectId)
    return c.json({ success: true, data: projectPrompts } satisfies z.infer<typeof PromptListResponseSchema>, 200)
  })
  .openapi(suggestPromptsRoute, async (c) => {
    const { projectId } = c.req.valid('param')
    const { userInput, limit } = c.req.valid('json')
    const suggestedPrompts = await suggestPrompts(projectId, userInput, limit)
    return c.json(
      { success: true, data: { prompts: suggestedPrompts } } satisfies z.infer<typeof SuggestPromptsResponseSchema>,
      200
    )
  })

  .openapi(addPromptToProjectRoute, async (c) => {
    const { promptId, projectId } = c.req.valid('param')
    await addPromptToProject(promptId, projectId)
    return c.json(
      { success: true, message: 'Prompt linked to project.' } satisfies z.infer<typeof OperationSuccessResponseSchema>,
      200
    )
  })
  .openapi(removePromptFromProjectRoute, async (c) => {
    const { promptId, projectId } = c.req.valid('param')
    await removePromptFromProject(promptId, projectId)
    return c.json(
      { success: true, message: 'Prompt unlinked from project.' } satisfies z.infer<
        typeof OperationSuccessResponseSchema
      >,
      200
    )
  })
  .openapi(getPromptByIdRoute, async (c) => {
    const { promptId } = c.req.valid('param')
    const prompt = await getPromptById(promptId)
    return c.json({ success: true, data: prompt } satisfies z.infer<typeof PromptResponseSchema>, 200)
  })
  .openapi(updatePromptRoute, async (c) => {
    const { promptId } = c.req.valid('param')
    const body = c.req.valid('json')
    const updatedPrompt = await updatePrompt(promptId, body)
    return c.json({ success: true, data: updatedPrompt } satisfies z.infer<typeof PromptResponseSchema>, 200)
  })
  .openapi(deletePromptRoute, async (c) => {
    const { promptId } = c.req.valid('param')
    await deletePrompt(promptId)
    return c.json(
      { success: true, message: 'Prompt deleted successfully.' } satisfies z.infer<
        typeof OperationSuccessResponseSchema
      >,
      200
    )
  })

export type PromptRouteTypes = typeof promptRoutes
