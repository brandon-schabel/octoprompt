/***************************************************************************************************
 * File: packages/ui-gen/src/ui-generation-react.tsx
 * A small React adapter that uses the above client-agnostic library
 **************************************************************************************************/
import React from "react"
import { useGenerateUI, useUndoUI, useRedoUI, useLockUI, useUISnapshot } from "./ui-generation-hooks"

export interface UseGeneratedUIOptions {
    designContract: string
    componentName?: string
    generateData?: boolean
    dataSchema?: string
    initialSeedId?: string
    styleDirectives?: string
}

export function useGeneratedUI(options: UseGeneratedUIOptions) {
    const [seedId, setSeedId] = React.useState<string | null>(options.initialSeedId ?? null)
    const [html, setHtml] = React.useState("")
    const [css, setCss] = React.useState("")
    const [data, setData] = React.useState<unknown>()

    // Use React Query hooks
    const generateUI = useGenerateUI()
    const undoUI = useUndoUI()
    const redoUI = useRedoUI()
    const lockUI = useLockUI()
    const { data: snapshot } = useUISnapshot(seedId ?? "")

    // Update UI state when snapshot changes
    React.useEffect(() => {
        if (snapshot?.snapshot) {
            setHtml(snapshot.snapshot.html)
            setCss(snapshot.snapshot.css)
            setData(snapshot.snapshot.data)
        }
    }, [snapshot])

    const generate = async () => {
        const result = await generateUI.mutateAsync({
            designContract: options.designContract,
            componentName: options.componentName,
            generateData: options.generateData,
            dataSchema: options.dataSchema,
            seedId: seedId ?? undefined,
            styleDirectives: options.styleDirectives,
        })

        console.log("result", result)
        setSeedId(result.seedId)
        setHtml(result.output.html)
        setCss(result.output.css)
        setData(result.output.data)
    }

    const undo = async () => {
        if (!seedId) return
        const result = await undoUI.mutateAsync(seedId)
        if (result.snapshot) {
            setHtml(result.snapshot.html)
            setCss(result.snapshot.css)
            setData(result.snapshot.data)
        }
    }

    const redo = async () => {
        if (!seedId) return
        const result = await redoUI.mutateAsync(seedId)
        if (result.snapshot) {
            setHtml(result.snapshot.html)
            setCss(result.snapshot.css)
            setData(result.snapshot.data)
        }
    }

    const lock = async () => {
        if (!seedId) return
        await lockUI.mutateAsync(seedId)
    }

    return {
        seedId,
        html,
        css,
        data,
        error: generateUI.error?.message ?? undoUI.error?.message ?? redoUI.error?.message ?? lockUI.error?.message ?? null,
        loading: generateUI.isPending || undoUI.isPending || redoUI.isPending || lockUI.isPending,
        generate,
        undo,
        redo,
        lock,
    }
}

/**
 * Minimal React component that renders the UI in a <div> dangerouslySetInnerHTML
 * plus optional <style> tag for the CSS.
 */
export function GeneratedUIRenderer(props: {
    html: string
    css: string
    className?: string
}) {
    return (
        <div className={props.className}>
            {props.css ? <style>{props.css}</style> : null}
            <div dangerouslySetInnerHTML={{ __html: props.html }} />
        </div>
    )
}