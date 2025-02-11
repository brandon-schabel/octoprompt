/***************************************************************************************************
 * File: packages/server/src/services/ui-generation-service.ts
 * Core "UI Generation" service, using your structured output approach + in-memory seed storage
 **************************************************************************************************/
import { v4 as uuidv4 } from "uuid"
import { z } from "zod"
import { structuredOutputSchemas } from "shared/src/structured-outputs/structured-output-schema"
import { generateStructuredOutput } from "./structured-output-service"
import type { InferStructuredOutput } from "shared/src/structured-outputs/structured-output-schema"
import { ApiError } from "shared"

/**
 * In-memory store for seeds and their final UI JSON payload
 * Key: seedId
 * Value: { html, css, data, locked, historyStack, currentHistoryIndex, etc. }
 */
const inMemorySeeds: Record<
    string,
    {
        html: string
        css: string
        data?: unknown
        locked: boolean
        history: { html: string; css: string; data?: unknown }[]
        historyIndex: number
    }
> = {}

/** Incoming request shape to generate a UI. */
export const uiGeneratorRequestSchema = z.object({
    designContract: z.string().default(""),
    componentName: z.string().default("GenericComponent"),
    generateData: z.boolean().default(false),
    // the user can pass a zod schema as a string if needed
    // or we just store an ID reference if the schema is known
    dataSchema: z.string().optional(), // e.g. user-provided JSON schema in string form

    // optionally re-generate with a specific seed
    seedId: z.string().optional(),
    // extra instructions or style? e.g. "Use Tailwind" or "raw HTML only"
    styleDirectives: z.string().optional(),
})

export type UIGeneratorRequest = z.infer<typeof uiGeneratorRequestSchema>

/** "UI Generation" structured output. */
export type UIGeneratorOutput = InferStructuredOutput<"ui_generation">

/**
 * Generates a brand-new UI. If seedId is provided and we have it, we use its style (unless locked).
 */
export async function generateUI(input: UIGeneratorRequest): Promise<{ seedId: string; output: UIGeneratorOutput }> {
    const validated = uiGeneratorRequestSchema.parse(input)
    const { seedId, designContract, styleDirectives, componentName, generateData } = validated

    let activeSeedId = seedId
    let existingSeed = activeSeedId ? inMemorySeeds[activeSeedId] : undefined
    if (existingSeed && existingSeed.locked) {
        throw new ApiError(`Seed ${activeSeedId} is locked. Cannot regenerate.`, 400, "UI_GEN_LOCKED_SEED")
    }

    if (!existingSeed) {
        activeSeedId = uuidv4()
        inMemorySeeds[activeSeedId] = {
            html: "",
            css: "",
            data: undefined,
            locked: false,
            history: [],
            historyIndex: -1,
        }
        existingSeed = inMemorySeeds[activeSeedId]
    }

    // Build the prompt for the structured output
    // We rely on the "ui_generation" schema name
    const systemMsg = `
You are an expert UI generator. 
Here is a design contract you must follow:
${designContract}

The user also says:
${styleDirectives ?? ""}
`
    const userMsg = `
Generate a UI for the component: "${componentName}"
User wants ${generateData ? "data included" : "no data included"}.
Return valid JSON that matches the "ui_generation" schema exactly:
- "type": "ui_generation"
- "html": A complete self-contained HTML snippet
- "css": Possibly empty or inline
- "data": Omit if generateData=false, else provide an array/object with sample data 
`

    // Use your structured output service
    const output = (await generateStructuredOutput({
        outputType: "ui_generation",
        userMessage: userMsg,
        systemMessage: systemMsg,
        // adjust model or temperature if needed
        model: "mistralai/codestral-2501",
        temperature: 0.7,
        chatId: `ui-gen-${activeSeedId}`,
        appendSchemaToPrompt: true,
    })) as UIGeneratorOutput

    // Update the in-memory seed history
    existingSeed.html = output.html
    existingSeed.css = output.css
    existingSeed.data = output.data
    existingSeed.history.push({ html: output.html, css: output.css, data: output.data })
    existingSeed.historyIndex = existingSeed.history.length - 1

    return { seedId: activeSeedId ?? "", output }
}

/** Undo last generation for a given seed. */
export function undoUI(seedId: string): UIGeneratorOutput {
    const seed = inMemorySeeds[seedId]
    if (!seed) throw new ApiError(`Seed not found: ${seedId}`, 404, "UI_GEN_SEED_NOT_FOUND")
    if (seed.locked) throw new ApiError(`Seed is locked: ${seedId}`, 400, "UI_GEN_LOCKED_SEED")
    if (seed.historyIndex <= 0) throw new ApiError("No more undo steps available.", 400, "UI_GEN_NO_UNDO")

    seed.historyIndex--
    const snapshot = seed.history[seed.historyIndex]
    seed.html = snapshot.html
    seed.css = snapshot.css
    seed.data = snapshot.data
    return { type: "ui_generation", ...snapshot }
}

/** Redo a generation for a given seed. */
export function redoUI(seedId: string): UIGeneratorOutput {
    const seed = inMemorySeeds[seedId]
    if (!seed) throw new ApiError(`Seed not found: ${seedId}`, 404, "UI_GEN_SEED_NOT_FOUND")
    if (seed.locked) throw new ApiError(`Seed is locked: ${seedId}`, 400, "UI_GEN_LOCKED_SEED")
    if (seed.historyIndex >= seed.history.length - 1) {
        throw new ApiError("No more redo steps available.", 400, "UI_GEN_NO_REDO")
    }

    seed.historyIndex++
    const snapshot = seed.history[seed.historyIndex]
    seed.html = snapshot.html
    seed.css = snapshot.css
    seed.data = snapshot.data
    return { type: "ui_generation", ...snapshot }
}

/** Lock a seed so it cannot be changed/undo/redo/regenerated. */
export function lockSeed(seedId: string): void {
    const seed = inMemorySeeds[seedId]
    if (!seed) throw new ApiError(`Seed not found: ${seedId}`, 404, "UI_GEN_SEED_NOT_FOUND")
    seed.locked = true
}

/** Retrieve a current UI snapshot from a seed. */
export function getCurrentSeedSnapshot(seedId: string): UIGeneratorOutput {
    const seed = inMemorySeeds[seedId]
    if (!seed) throw new ApiError(`Seed not found: ${seedId}`, 404, "UI_GEN_SEED_NOT_FOUND")
    return {
        type: "ui_generation",
        html: seed.html,
        css: seed.css,
        data: seed.data,
    }
}