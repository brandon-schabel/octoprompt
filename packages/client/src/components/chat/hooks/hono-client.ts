import { hc } from 'hono/client'
import { type ChatRouteTypes } from '@server/src/routes/chat-routes'
import { SERVER_HTTP_ENDPOINT } from '@/constants/server-constants'
import { type AdminRouteTypes } from '@server/src/routes/admin-routes'
import { type AiFileChangeRouteTypes } from '@server/src/routes/ai-file-change-routes'
import { type KvRouteTypes } from '@server/src/routes/kv-routes'
import { type ProjectRouteTypes } from '@server/src/routes/project-routes'
import { type PromptRouteTypes } from '@server/src/routes/prompt-routes'
import { type ProviderKeyRouteTypes } from '@server/src/routes/provider-key-routes'
import { type PromptimizerRouteTypes } from '@server/src/routes/promptimizer-routes'
import { type TicketRouteTypes } from '@server/src/routes/ticket-routes'

export const adminClient = hc<AdminRouteTypes>(SERVER_HTTP_ENDPOINT)
export const aiFileChangeClient = hc<AiFileChangeRouteTypes>(SERVER_HTTP_ENDPOINT)
export const chatClient = hc<ChatRouteTypes>(SERVER_HTTP_ENDPOINT)
export const projectClient = hc<ProjectRouteTypes>(SERVER_HTTP_ENDPOINT)
export const promptClient = hc<PromptRouteTypes>(SERVER_HTTP_ENDPOINT)
export const kvClient = hc<KvRouteTypes>(SERVER_HTTP_ENDPOINT)
export const providerKeyClient = hc<ProviderKeyRouteTypes>(SERVER_HTTP_ENDPOINT)
export const promptimizerClient = hc<PromptimizerRouteTypes>(SERVER_HTTP_ENDPOINT)
export const ticketClient = hc<TicketRouteTypes>(SERVER_HTTP_ENDPOINT)





// chatClient[':chatId'].messages.$get({param: {}})
// const res = await honoClient..$get()
