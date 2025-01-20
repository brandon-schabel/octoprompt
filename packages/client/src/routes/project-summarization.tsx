import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useGetProjectFiles, useSummarizeProjectFiles, useGetFileSummaries, useResummarizeAllFiles } from "@/hooks/api/use-projects-api"
import { ProjectFile } from "shared/schema"
import { matchesAnyPattern } from "shared/src/utils/pattern-matcher"

import { FileViewerDialog } from "@/components/navigation/file-viewer-dialog"
import { useGlobalStateHelpers } from "@/components/global-state/use-global-state-helpers"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

/**
 * We no longer import FileSummary. The combined schema means we use ProjectFile and read the .summary field.
 */

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
    const { updateSettings, state } = useGlobalStateHelpers()
    const settings = state.settings
    const projectActiveTabId = state.projectActiveTabId
    const selectedProjectId = projectActiveTabId && state.projectTabs[projectActiveTabId]?.selectedProjectId

    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
    const [expandedSummaryFileId, setExpandedSummaryFileId] = useState<string | null>(null)

    // We'll store the currently viewed file (for the dialog):
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)
    const [selectedFileRecord, setSelectedFileRecord] = useState<ProjectFile | null>(null)

    // Sorting
    const [sortBy, setSortBy] = useState<"name" | "lastSummarized">("name")

    // 1) Fetch all project files
    const { data, isLoading, isError } = useGetProjectFiles(selectedProjectId ?? "")
    const projectFiles = (data?.files || []) as ProjectFile[]

    // 2) Fetch all file entries (now each includes its summary)
    const { data: summariesData } = useGetFileSummaries(selectedProjectId ?? "")
    const summaries = summariesData?.summaries || []

    // Build a lookup map of fileId -> ProjectFile
    const summariesMap = useMemo(() => {
        const map = new Map<string, ProjectFile>()
        for (const f of summaries) {
            map.set(f.id, f as ProjectFile)
        }
        return map
    }, [summaries])

    // 3) Summarize selected files
    const summarizeMutation = useSummarizeProjectFiles(selectedProjectId ?? "")
    const resummarizeAllMutation = useResummarizeAllFiles(selectedProjectId ?? "")

    // Partition files into included vs. excluded
    const ignorePatterns = settings.summarizationIgnorePatterns
    const includedFiles: ProjectFile[] = []
    const excludedFiles: ProjectFile[] = []

    for (const file of projectFiles) {
        const isIgnored = matchesAnyPattern(file.path, ignorePatterns)
        if (isIgnored) excludedFiles.push(file)
        else includedFiles.push(file)
    }

    /**
     * Sort the included/excluded arrays based on `sortBy`.
     * If 'name', we sort by file.path (alphabetical).
     * If 'lastSummarized', we sort by .summaryLastUpdatedAt (descending).
     */
    includedFiles.sort((a, b) => {
        if (sortBy === "name") {
            return a.path.localeCompare(b.path)
        } else {
            const aUpdated = summariesMap.get(a.id)?.summaryLastUpdatedAt
                ? Number(summariesMap.get(a.id)!.summaryLastUpdatedAt)
                : 0
            const bUpdated = summariesMap.get(b.id)?.summaryLastUpdatedAt
                ? Number(summariesMap.get(b.id)!.summaryLastUpdatedAt)
                : 0
            return bUpdated - aUpdated
        }
    })

    excludedFiles.sort((a, b) => {
        if (sortBy === "name") {
            return a.path.localeCompare(b.path)
        } else {
            const aUpdated = summariesMap.get(a.id)?.summaryLastUpdatedAt
                ? Number(summariesMap.get(a.id)!.summaryLastUpdatedAt)
                : 0
            const bUpdated = summariesMap.get(b.id)?.summaryLastUpdatedAt
                ? Number(summariesMap.get(b.id)!.summaryLastUpdatedAt)
                : 0
            return bUpdated - aUpdated
        }
    })

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
        const f = summariesMap.get(fileId)
        if (f) {
            setSelectedFileRecord(f)
            setSummaryDialogOpen(true)
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
            <Card className="w-full ">
                <CardHeader>
                    <CardTitle>Project Summarization Settings</CardTitle>
                    <CardDescription>
                        Configure ignore patterns, view file summaries, and optionally sort the file list.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Sort-by dropdown */}
                    <div className="mb-4 flex items-center gap-2">
                        <label>Sort By:</label>
                        <Select value={sortBy} onValueChange={(value) => setSortBy(value as "name" | "lastSummarized")}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sort by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="lastSummarized">Last Summarized</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mb-4 text-sm">
                        <p>
                            Found <strong>{projectFiles.length}</strong> total files.
                        </p>
                        <p>
                            <span className="text-green-600">{includedFiles.length}</span> included
                            <br />
                            <span className="text-red-600">{excludedFiles.length}</span> excluded
                        </p>
                    </div>

                    {/* Patterns */}
                    <h3 className="text-sm font-medium">Ignore Patterns</h3>
                    <PatternList
                        patterns={ignorePatterns}
                        onAdd={(pattern) =>
                            updateSettings((prev) => ({
                                ...prev,
                                summarizationIgnorePatterns: [...prev.summarizationIgnorePatterns, pattern],
                            }))
                        }
                        onRemove={(pattern) =>
                            updateSettings((prev) => ({
                                ...prev,
                                summarizationIgnorePatterns: prev.summarizationIgnorePatterns.filter((p) => p !== pattern),
                            }))
                        }
                        onUpdate={(oldP, newP) =>
                            updateSettings((prev) => ({
                                ...prev,
                                summarizationIgnorePatterns: prev.summarizationIgnorePatterns.map((p) =>
                                    p === oldP ? newP : p
                                ),
                            }))
                        }
                    />

                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-sm font-semibold">Included Files</h3>
                                <div className="flex items-center gap-1">
                                    <Checkbox
                                        id="select-all"
                                        checked={selectedFileIds.length === includedFiles.length}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedFileIds(includedFiles.map(f => f.id))
                                            } else {
                                                setSelectedFileIds([])
                                            }
                                        }}
                                    />
                                    <label htmlFor="select-all" className="text-xs cursor-pointer">
                                        Select All
                                    </label>
                                </div>
                            </div>
                            <ul className="mt-2 space-y-1">
                                {includedFiles.map((file) => {
                                    const fileRecord = summariesMap.get(file.id)
                                    const hasSummary = !!fileRecord?.summary
                                    const lastSummarized = fileRecord?.summaryLastUpdatedAt
                                        ? new Date(fileRecord.summaryLastUpdatedAt).toLocaleString()
                                        : null

                                    return (
                                        <li key={file.id} className="flex flex-col gap-1 text-xs">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id={file.id}
                                                    checked={selectedFileIds.includes(file.id)}
                                                    onCheckedChange={() => toggleFileSelection(file.id)}
                                                />
                                                <label
                                                    htmlFor={file.id}
                                                    className={`cursor-pointer ${hasSummary ? "font-medium text-blue-600" : ""}`}
                                                >
                                                    {file.path}
                                                </label>
                                                {lastSummarized && (
                                                    <span className="text-muted-foreground ml-auto text-[10px]">
                                                        Last Summarized: {lastSummarized}
                                                    </span>
                                                )}
                                                {hasSummary && (
                                                    <button
                                                        className="flex items-center gap-1 text-blue-600 hover:underline"
                                                        onClick={() => handleToggleSummary(file.id)}
                                                    >
                                                        <Info className="h-4 w-4" />
                                                        View
                                                    </button>
                                                )}
                                            </div>
                                            {expandedSummaryFileId === file.id && fileRecord && (
                                                <div className="col-span-2 mt-1 w-full rounded border p-2 text-sm">
                                                    <strong>File Summary:</strong>
                                                    <br />
                                                    {fileRecord.summary}
                                                </div>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                            <div className="mt-4 flex gap-2">
                                <Button
                                    onClick={handleSummarize}
                                    disabled={selectedFileIds.length === 0 || summarizeMutation.isPending}
                                >
                                    {summarizeMutation.isPending ? "Summarizing..." : "Summarize Selected Files"}
                                </Button>
                                {/* <Button
                                    variant="outline"
                                    onClick={handleResummarizeAll}
                                    disabled={resummarizeAllMutation.isPending}
                                >
                                    {resummarizeAllMutation.isPending ? "Processing..." : "Resummarize All Files"}
                                </Button> */}
                            </div>
                        </div>

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

            <FileViewerDialog
                open={summaryDialogOpen}
                markdownText={selectedFileRecord?.summary ?? ""}
                onClose={() => {
                    setSummaryDialogOpen(false)
                    setSelectedFileRecord(null)
                }}
            />
        </div>
    )
}