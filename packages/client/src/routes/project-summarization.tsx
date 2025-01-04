// packages/client/src/routes/project-summarization.tsx

import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCurrentProjectTabState, useGlobalSettings } from "@/components/global-state-context"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Info } from "lucide-react"
import { useGetProjectFiles, useSummarizeProjectFiles, useGetFileSummaries } from "@/hooks/api/use-projects-api"
import { ProjectFile } from "shared/schema"
import { matchesAnyPattern } from "shared/src/utils/pattern-matcher"
import { FileSummary } from "shared"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

export const Route = createFileRoute("/project-summarization")({
    component: ProjectSummarizationSettingsPage,
})

function PatternList({
    patterns,
    onAdd,
    onRemove,
    onUpdate,
}: {
    patterns: string[]
    onAdd: (pattern: string) => void
    onRemove: (pattern: string) => void
    onUpdate: (oldPattern: string, newPattern: string) => void
}) {
    const [newPattern, setNewPattern] = useState("")
    const [editingPattern, setEditingPattern] = useState<{ index: number; value: string } | null>(
        null
    )

    function handleAdd() {
        const trimmed = newPattern.trim()
        if (!trimmed) return
        onAdd(trimmed)
        setNewPattern("")
    }

    function handleStartEdit(pattern: string, index: number) {
        setEditingPattern({ index, value: pattern })
    }

    function handleSaveEdit() {
        if (!editingPattern) return
        const trimmed = editingPattern.value.trim()
        if (!trimmed) return

        onUpdate(patterns[editingPattern.index], trimmed)
        setEditingPattern(null)
    }

    function handleCancelEdit() {
        setEditingPattern(null)
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            handleSaveEdit()
        } else if (e.key === "Escape") {
            handleCancelEdit()
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Input
                    placeholder="e.g. node_modules"
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                />
                <Button onClick={handleAdd}>Add</Button>
            </div>

            <ul className="space-y-1">
                {patterns.map((pattern, index) => (
                    <li key={pattern} className="flex items-center justify-between rounded p-1 hover:bg-accent">
                        {editingPattern?.index === index ? (
                            <div className="flex flex-1 items-center gap-2">
                                <Input
                                    value={editingPattern.value}
                                    onChange={(e) => setEditingPattern({ ...editingPattern, value: e.target.value })}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                />
                                <Button size="sm" onClick={handleSaveEdit}>
                                    Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <>
                                <span
                                    className="cursor-pointer font-mono text-sm"
                                    onClick={() => handleStartEdit(pattern, index)}
                                >
                                    {pattern}
                                </span>
                                <Button variant="ghost" size="icon" onClick={() => onRemove(pattern)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}

function ProjectSummarizationSettingsPage() {
    const { settings, updateSettings } = useGlobalSettings()
    const { selectedProjectId } = useCurrentProjectTabState()
    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
    const [expandedSummaryFileId, setExpandedSummaryFileId] = useState<string | null>(null)
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)
    const [selectedSummary, setSelectedSummary] = useState<FileSummary | null>(null)
    const isDarkMode = settings.theme === "dark"
    const selectedTheme = isDarkMode ? settings.codeThemeDark : settings.codeThemeLight

    // --- 1) Fetch the project files
    const { data, isLoading, isError } = useGetProjectFiles(selectedProjectId ?? "")
    const projectFiles = data?.files || []

    // --- 2) Summaries for all files in this project
    const { data: summariesData } = useGetFileSummaries(selectedProjectId ?? "")
    const summaries = summariesData?.summaries || []

    // Build a map from fileId -> FileSummary
    const summariesMap = useMemo(() => {
        const map = new Map<string, FileSummary>()
        for (const summary of summaries) {
            map.set(summary.fileId, summary)
        }
        return map
    }, [summaries])

    // --- 3) Summarize selected files
    const summarizeMutation = useSummarizeProjectFiles(selectedProjectId ?? "")

    // Separate “ignored” vs “included” based on user patterns
    const ignorePatterns = settings.summarizationIgnorePatterns
    const includedFiles: ProjectFile[] = []
    const excludedFiles: ProjectFile[] = []

    for (const file of projectFiles) {
        const isIgnored = matchesAnyPattern(file.path, ignorePatterns)
        if (isIgnored) excludedFiles.push(file)
        else includedFiles.push(file)
    }

    function handleAddIgnore(pattern: string) {
        updateSettings((prev) => ({
            ...prev,
            summarizationIgnorePatterns: [...prev.summarizationIgnorePatterns, pattern],
        }))
    }

    function handleRemoveIgnore(pattern: string) {
        updateSettings((prev) => ({
            ...prev,
            summarizationIgnorePatterns: prev.summarizationIgnorePatterns.filter((p) => p !== pattern),
        }))
    }

    function handleUpdateIgnore(oldPattern: string, newPattern: string) {
        updateSettings((prev) => ({
            ...prev,
            summarizationIgnorePatterns: prev.summarizationIgnorePatterns.map((p) =>
                p === oldPattern ? newPattern : p
            ),
        }))
    }

    // Toggle a file in the selectedFileIds array
    function toggleFileSelection(fileId: string) {
        setSelectedFileIds((prev) =>
            prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
        )
    }

    function handleSummarize() {
        if (!selectedFileIds.length) {
            alert("No files selected!")
            return
        }

        summarizeMutation.mutate(selectedFileIds, {
            onSuccess: (resp) => {
                alert(resp.summary || "Summaries updated!")
            },
        })
    }

    function handleToggleSummary(fileId: string) {
        const summary = summariesMap.get(fileId)
        if (summary) {
            setSelectedSummary(summary)
            setSummaryDialogOpen(true)
        }
    }

    const handleCopyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
        } catch (error) {
            console.error("Failed to copy text:", error)
        }
    }

    if (isLoading) {
        return <div className="p-4">Loading files...</div>
    }
    if (isError) {
        return <div className="p-4">Error fetching files</div>
    }

    return (
        <div className="p-4">
            <Card className="w-full max-w-2xl">
                <CardHeader>
                    <CardTitle>Project Summarization Settings</CardTitle>
                    <CardDescription>
                        Configure which files to <strong>ignore</strong> from summarization, and view existing
                        summaries.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Show included/excluded counts */}
                    <div className="mb-4 text-sm">
                        <p>
                            Found <strong>{projectFiles.length}</strong> total files.
                        </p>
                        <p>
                            <span className="text-green-600">{includedFiles.length}</span> files{" "}
                            <strong>included</strong>
                            <br />
                            <span className="text-red-600">{excludedFiles.length}</span> files{" "}
                            <strong>excluded</strong>
                        </p>
                    </div>

                    {/* Ignore Patterns List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium">Ignore Patterns</h3>
                        <p className="text-sm text-muted-foreground">
                            Files matching these patterns will be excluded from summarization.
                        </p>
                        <PatternList
                            patterns={ignorePatterns}
                            onAdd={handleAddIgnore}
                            onRemove={handleRemoveIgnore}
                            onUpdate={handleUpdateIgnore}
                        />
                    </div>

                    {/* Render included & excluded files */}
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        {/* Included Files */}
                        <div>
                            <h3 className="text-sm font-semibold">Included Files</h3>
                            <ul className="mt-2 space-y-1">
                                {includedFiles.map((file) => {
                                    const fileSummary = summariesMap.get(file.id)
                                    const hasSummary = !!fileSummary

                                    return (
                                        <li key={file.id} className="flex items-start gap-2 text-xs">
                                            <Checkbox
                                                id={file.id}
                                                checked={selectedFileIds.includes(file.id)}
                                                onCheckedChange={() => toggleFileSelection(file.id)}
                                            />
                                            <div className="flex-1">
                                                <label 
                                                    htmlFor={file.id} 
                                                    className={`cursor-pointer ${hasSummary ? 'text-blue-600 font-medium' : ''}`}
                                                >
                                                    {file.path}
                                                    {hasSummary && (
                                                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-800">
                                                            Summarized
                                                        </span>
                                                    )}
                                                </label>
                                            </div>
                                            {hasSummary && (
                                                <button
                                                    className="flex items-center gap-1 text-blue-600 hover:underline"
                                                    onClick={() => handleToggleSummary(file.id)}
                                                >
                                                    <Info className="h-4 w-4" />
                                                    {expandedSummaryFileId === file.id ? "Hide Summary" : "View Summary"}
                                                </button>
                                            )}
                                            {/* Show the summary if expanded */}
                                            {expandedSummaryFileId === file.id && fileSummary && (
                                                <div className="col-span-2 mt-1 w-full rounded border p-2 text-sm">
                                                    <strong>File Summary:</strong>
                                                    <br />
                                                    {fileSummary.summary}
                                                </div>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                            <div className="mt-4">
                                <Button
                                    onClick={handleSummarize}
                                    disabled={selectedFileIds.length === 0 || summarizeMutation.isPending}
                                >
                                    {summarizeMutation.isPending ? "Summarizing..." : "Summarize Selected Files"}
                                </Button>
                            </div>
                        </div>

                        {/* Excluded Files */}
                        <div>
                            <h3 className="text-sm font-semibold">Excluded Files</h3>
                            <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                                {excludedFiles.map((file) => (
                                    <li key={file.id} className="text-xs">
                                        {file.path}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground">
                    <p>
                        Use glob patterns like <code>*.ts</code>, <code>**/test/**</code>, or{" "}
                        <code>node_modules/**</code>.
                    </p>
                </CardFooter>
            </Card>

            <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>File Summary</DialogTitle>
                    </DialogHeader>
                    {selectedSummary && (
                        <div className="mt-4">
                            <MarkdownRenderer
                                content={selectedSummary.summary}
                                isDarkMode={isDarkMode}
                                themeStyle={selectedTheme}
                                copyToClipboard={handleCopyToClipboard}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}