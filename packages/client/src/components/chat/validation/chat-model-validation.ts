import { chatModelSettingsSchema } from "shared/index";
import { z } from "zod";

// Additional validation schemas specific to chat model settings
export const chatModelValidation = {
    updateSettings: {
        body: chatModelSettingsSchema.partial()
    }
} as const;

// Type for partial updates
export type UpdateChatModelSettingsBody = z.infer<typeof chatModelValidation.updateSettings.body>; 