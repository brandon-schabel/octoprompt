export * from './schema';
export type {
    InferSelectModel,
    InferInsertModel,
} from 'drizzle-orm';

export type {
    SQL,
    SQLWrapper,
} from 'drizzle-orm/sql';

export {
    eq,
    and,
    or,
    not,
    sql,
    inArray
} from 'drizzle-orm';


export type { CreateChatBody, CreateMessageBody, DeleteChatParams, DeleteMessageParams, ForkChatBody, ForkChatFromMessageBody, ForkChatFromMessageParams, GetMessagesParams, UpdateChatBody, UpdateChatParams, FileSearchValidationBody, ForkChatParams, UnifiedModel, APIProviders, CreateMessageBodyGeneric } from './src/validation/chat-api-validation';
export type { CreateProjectBody, UpdateProjectParams, UpdateProjectBody, GetOrDeleteProjectParams, GetProjectFilesParams, SyncProjectParams } from './src/validation/projects-api-validation';
export type { CreatePromptBody, UpdatePromptParams, UpdatePromptBody, GetOrDeletePromptParams, ListPromptsParams } from './src/validation/prompt-api-validation';
export type { CreateProviderKeyBody, UpdateProviderKeyParams, UpdateProviderKeyBody, GetOrDeleteProviderKeyParams } from './src/validation/provider-key-api-validation';
export type { ModelOptions } from './src/validation/model-options-schema';
export { projectsApiValidation } from './src/validation/projects-api-validation';
export { promptApiValidation } from './src/validation/prompt-api-validation';
export { providerKeyApiValidation } from './src/validation/provider-key-api-validation';
export { codeEditorApiValidation, type EditFileBody, type EditFileParams } from './src/validation/code-editor-api-validation';
export {
    globalStateSchema, createInitialGlobalState, type GlobalState, type ProjectTabState, projectTabStateSchema as tabStateSchema, type LinkSettings, linkSettingsSchema, type ChatTabState, chatTabStateSchema, chatTabsStateRecordSchema,
    type ChatTabsStateRecord, type ProjectTabsStateRecord, projectTabsStateRecordSchema
} from './src/global-state/global-state-schema';

// export type { ApiValidationSchemaRecord } from './src/types/api-validation-schema-record';
export { ApiError } from './src/error/api-error';