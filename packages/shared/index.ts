export type { CreateProjectBody, UpdateProjectParams, UpdateProjectBody, GetOrDeleteProjectParams, GetProjectFilesParams, SyncProjectParams } from './src/validation/projects-api-validation';
export type { CreatePromptBody, UpdatePromptBody, } from './src/validation/prompt-api-validation';
export type { CreateProviderKeyBody, UpdateProviderKeyBody, } from './src/validation/provider-key-api-validation';
export type { ModelOptions } from './src/validation/model-options-schema';
export { projectsApiValidation } from './src/validation/projects-api-validation';
export { promptApiValidation } from './src/validation/prompt-api-validation';
export { providerKeyApiValidation } from './src/validation/provider-key-api-validation';
export { ticketsApiValidation, type CreateTicketBody, type UpdateTicketBody, createTicketSchema, linkFilesSchema, suggestTasksSchema, updateTicketSchema } from './src/validation/ticket-api-validation';
export { codeEditorApiValidation, type EditFileBody, type EditFileParams } from './src/validation/code-editor-api-validation';
export * from './src/global-state/global-state-schema';

// export type { ApiValidationSchemaRecord } from './src/types/api-validation-schema-record';
export { ApiError } from './src/error/api-error';
export { matchesAnyPattern, filterByPatterns } from './src/utils/pattern-matcher';
// export type { ChatAppState, ChatClientMessage, IncomingServerMessage, InitialStateServerMessage, OutgoingClientMessage, StateUpdateServerMessage } from './src/types/chat-types'


// export * from './src/types/global-websocket-types';

export { buildCombinedFileSummaries } from './src/utils/summary-formatter';
export * from './src/global-state/websocket-global-schema';
export * from './src/utils/merge-deep'

export * from './src/structured-outputs/structured-output-schema';
export * from './src/structured-outputs/structured-output-utils';
export * from './src/constants/model-default-configs';
export * from './src/constants/models-temp-not-allowed';
export * from './schema'