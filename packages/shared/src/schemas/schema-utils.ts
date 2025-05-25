import { unixTimestampSchema } from "../utils/unix-ts-utils";
import { z } from "@hono/zod-openapi";

export const unixTSSchemaSpec = unixTimestampSchema.openapi({ example: 1716537600000, description: 'ID or Timestamp in unix timestamp (milliseconds)' })
export const unixTSOptionalSchemaSpec = unixTSSchemaSpec.optional().openapi({ example: 1716537600000, description: 'Optional ID or Timestamp in unix timestamp (milliseconds)' })
export const unixTSArraySchemaSpec = z.array(unixTSSchemaSpec).openapi({ example: [1716537600000, 1716537600001], description: 'Array of IDs or Timestamps in unix timestamp (milliseconds)' })
export const unixTSArrayOptionalSchemaSpec = z.array(unixTSOptionalSchemaSpec).openapi({ example: [1716537600000, 1716537600001], description: 'Array of Optional IDs or Timestamps in unix timestamp (milliseconds)' })
