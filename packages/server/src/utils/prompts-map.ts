// This utility is located at packages/server/src/utils/prompts-map.ts.
// It uses import.meta.dir to construct absolute paths to the /prompts
// directory at the root of the workspace. This ensures consistent prompt loading
// regardless of the script's execution directory (Bun.cwd()).

import { isProdEnv } from "@/constants/server-config"

// in prod it's just relatives to the root server.js built server, but in dev it's relative to this file using import.meta.dir
const promptsDir = isProdEnv ? './prompts' : import.meta.dir + '/../../../../prompts'


const contemplativePrompt = Bun.file(promptsDir + '/contemplative-prompt.md').text()
const summarizationSteps = Bun.file(promptsDir + '/summarization-prompt.md').text()
const octopromptPlanningMetaPrompt = Bun.file(promptsDir + '/octoprompt-planning-meta-prompt.md').text()

export const promptsMap = {
  contemplativePrompt,
  summarizationSteps,
  octopromptPlanningMetaPrompt
}
