import { router } from "server-router";
import { ApiError, json } from "@bnk/router";
import { z } from "zod";


import { AIFileChangeService } from "@/services/file-services/ai-file-change-service";
import { OpenRouterProviderService } from "@/services/model-providers/providers/open-router-provider";

// Create service instances
const openRouter = new OpenRouterProviderService();
const aiFileChangeService = new AIFileChangeService(
  openRouter,
);

// Validation schemas
const generateChangeSchema = z.object({
  filePath: z.string().min(1),
  prompt: z.string().min(1),
});

const confirmChangeSchema = z.object({
  changeId: z.number(),
});

/**
 * POST /api/file/ai-change
 * Generate an AI-suggested change for a file
 */
router.post(
  "/api/file/ai-change",
  {
    validation: {
      body: generateChangeSchema,
    },
  },
  async (_, { body }) => {
    try {
      const { filePath, prompt } = body;

      const result = await aiFileChangeService.generateFileChange(filePath, prompt);

      return json({
        success: true,
        changeId: result.changeId,
        diff: result.diff,
      });
    } catch (error) {
      console.error("[AI File Change] Error generating change:", error);
      throw new ApiError(
        "Failed to generate file change",
        500,
        "AI_GENERATION_FAILED"
      );
    }
  }
);

/**
 * GET /api/file/ai-change/:changeId
 * Get details about a specific change
 */
router.get(
  "/api/file/ai-change/:changeId",
  {
    validation: {
      params: z.object({
        changeId: z.string().transform((val) => parseInt(val, 10)),
      }),
    },
  },
  async (_, { params }) => {
    const change = await aiFileChangeService.getChange(params.changeId);
    if (!change) {
      throw new ApiError("Change not found", 404, "NOT_FOUND");
    }
    return json({ success: true, change });
  }
);

/**
 * POST /api/file/ai-change/:changeId/confirm
 * Confirm and apply an AI-suggested change
 */
router.post(
  "/api/file/ai-change/:changeId/confirm",
  {
    validation: {
      params: z.object({
        changeId: z.string().transform((val) => parseInt(val, 10)),
      }),
    },
  },
  async (_, { params }) => {
    const success = await aiFileChangeService.confirmChange(params.changeId);
    if (!success) {
      throw new ApiError("Change not found", 404, "NOT_FOUND");
    }
    return json({ success: true });
  }
); 