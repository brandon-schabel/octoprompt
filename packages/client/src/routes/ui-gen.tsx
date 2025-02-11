import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/button" // or any button
import { useGeneratedUI, GeneratedUIRenderer } from "@/components/ui-generation/ui-generator"

/** TanStack Router route definition */
export const Route = createFileRoute("/ui-gen")({
    component: UIGenerationDemoPage,
})

function UIGenerationDemoPage() {
    const {
        seedId,
        html,
        css,
        data,
        error,
        loading,
        generate,
        undo,
        redo,
        lock,
    } = useGeneratedUI({
        designContract: `
Design Contract:
1) Must produce a minimal, clean table design.
2) Possibly use inline CSS or an external style block.
3) Must be self-contained valid HTML.
`,
        componentName: "tableOfStates",
        generateData: true,
        styleDirectives: "Use a simple table with a header row and lines. Use Tailwind.",
    })

    return (
        <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Button onClick={generate} disabled={loading}>
                    {seedId ? "Refresh" : "Generate UI"}
                </Button>
                <Button onClick={undo} disabled={!seedId || loading}>
                    Undo
                </Button>
                <Button onClick={redo} disabled={!seedId || loading}>
                    Redo
                </Button>
                <Button onClick={lock} disabled={!seedId || loading}>
                    Lock
                </Button>
            </div>
            {error && <p className="text-red-500">Error: {error}</p>}

            {data && (
                <pre className="bg-slate-100 p-2 text-xs overflow-auto">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
            <GeneratedUIRenderer html={html} css={css} />
        </div>
    )
}

