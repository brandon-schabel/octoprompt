import { z } from "zod"

export const UiGenClientRequestSchema = z.object({
    apiUrl: z.string().default("/api/ui-gen/generate"),
})

export type UiGenClientRequest = z.infer<typeof UiGenClientRequestSchema>

/** Minimal function to call the /api/ui-gen/generate endpoint. */
export async function createGenUIComponent(api: { request: (url: string, options?: any) => Promise<Response> }, args: {
    designContract: string
    componentName?: string
    generateData?: boolean
    dataSchema?: string
    seedId?: string
    styleDirectives?: string
}): Promise<{
    seedId: string
    output: {
        type: "ui_generation"
        html: string
        css: string
        data?: unknown
    }
}> {
    const resp = await api.request("/api/ui-gen/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
            designContract: args.designContract,
            componentName: args.componentName ?? "GenericComponent",
            generateData: args.generateData ?? false,
            dataSchema: args.dataSchema,
            seedId: args.seedId,
            styleDirectives: args.styleDirectives,
        },
    })
    if (!resp.ok) {
        throw new Error(`UI Generation failed: ${resp.status}`)
    }
    return resp.json() as Promise<{
        success: boolean
        seedId: string
        output: {
            type: "ui_generation"
            html: string
            css: string
            data?: unknown
        }
    }>
}

/** Helpers to call undo/redo/lock. */
export async function undoUI(api: { request: (url: string, options?: any) => Promise<Response> }, seedId: string) {
    const response = await api.request(`/api/ui-gen/undo?seedId=${seedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Undo failed")
    return response.json()
}

export async function redoUI(api: { request: (url: string, options?: any) => Promise<Response> }, seedId: string) {
    const response = await api.request(`/api/ui-gen/redo?seedId=${seedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Redo failed")
    return response.json()
}

export async function lockUI(api: { request: (url: string, options?: any) => Promise<Response> }, seedId: string) {
    const response = await api.request(`/api/ui-gen/lock?seedId=${seedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Lock failed")
    return response.json()
}

export async function fetchUISnapshot(api: { request: (url: string, options?: any) => Promise<Response> }, seedId: string) {
    const response = await api.request(`/api/ui-gen/snapshot?seedId=${seedId}`);
    if (!response.ok) throw new Error("Snapshot fetch failed")
    return response.json()
}