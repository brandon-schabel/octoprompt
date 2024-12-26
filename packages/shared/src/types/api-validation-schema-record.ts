import type { ValidationSchema } from '@bnk/router'

export type ApiValidationSchemaRecord = {
    [path: string]: ValidationSchema
}
