import app from "@/server-router";
import { z } from "zod";

import { db } from "@db";
import { confirmFileChange, generateFileChange, getFileChange } from "@/services/file-services/ai-file-change-service";

// Validation schemas
const generateChangeSchema = z.object({
  filePath: z.string().min(1),
  prompt: z.string().min(1),
});

// POST endpoint to generate AI file changes
app.post("/api/file/ai-change", async (c) => {
  try {
    const body = await c.req.json();

    // Validate the request body
    const result = generateChangeSchema.safeParse(body);
    if (!result.success) {
      return c.json({
        success: false,
        error: "Invalid request body",
        details: result.error.issues
      }, 400);
    }

    const validatedBody = result.data;
    const changeResult = await generateFileChange({
      filePath: validatedBody.filePath,
      prompt: validatedBody.prompt,
      db
    });

    return c.json({
      success: true,
      result: changeResult
    });
  } catch (error) {
    console.error("Error generating file change:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// GET endpoint to retrieve an AI file change by ID
app.get("/api/file/ai-change/:fileChangeId", async (c) => {
  try {
    const fileChangeId = c.req.param('fileChangeId');
    const changeId = parseInt(fileChangeId, 10);

    if (isNaN(changeId)) {
      return c.json({
        success: false,
        error: "Invalid file change ID"
      }, 400);
    }

    const fileChange = await getFileChange(db, changeId);

    if (fileChange === null) {
      return c.json({
        success: false,
        error: "File change not found"
      }, 404);
    }

    return c.json({
      success: true,
      fileChange
    });
  } catch (error) {
    console.error("Error retrieving file change:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// POST endpoint to confirm an AI file change
app.post("/api/file/ai-change/:fileChangeId/confirm", async (c) => {
  try {
    const fileChangeId = c.req.param('fileChangeId');
    const changeId = parseInt(fileChangeId, 10);

    if (isNaN(changeId)) {
      return c.json({
        success: false,
        error: "Invalid file change ID"
      }, 400);
    }

    const result = await confirmFileChange(db, changeId);

    return c.json({
      success: true,
      result
    });
  } catch (error) {
    console.error("Error confirming file change:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});