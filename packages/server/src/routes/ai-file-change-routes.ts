import { router } from "server-router";
import { ApiError, json } from "@bnk/router";
import { z } from "zod";

import { db } from "@db";
import { confirmFileChange, generateFileChange, getFileChange } from "@/services/file-services/ai-file-change-service";


// Validation schemas
const generateChangeSchema = z.object({
  filePath: z.string().min(1),
  prompt: z.string().min(1),
});


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

      const result = await generateFileChange({
        filePath, prompt,
        db,
      });

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
    const change = await getFileChange(db, params.changeId);
    if (!change) {
      throw new ApiError("Change not found", 404, "NOT_FOUND");
    }
    return json({ success: true, change });
  }
);

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
    const success = await confirmFileChange(db, params.changeId);
    if (!success) {
      throw new ApiError("Change not found", 404, "NOT_FOUND");
    }
    return json({ success: true });
  }
); 