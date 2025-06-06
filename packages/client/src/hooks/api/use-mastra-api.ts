// 5 Most Recent Changes:
// 1. Initial creation of Mastra API hooks file
// 2. Added re-exports for Mastra mutation hooks
// 3. Added type exports for Mastra request/response types
// 4. Added octoClient export for direct access
// 5. Added comprehensive documentation

// Re-export Mastra hooks from main api-hooks file
export {
  useMastraCodeChange,
  useMastraBatchSummarize,
  useMastraSummarizeFile,
  octoClient
} from '../api-hooks'

// Re-export Mastra types for convenience
export type {
  MastraCodeChangeRequest,
  MastraCodeChangeResponse,
  MastraSummarizeRequest,
  MastraSummarizeResponse,
  MastraSingleSummarizeRequest,
  MastraSingleSummarizeResponse
} from '@octoprompt/schemas'
