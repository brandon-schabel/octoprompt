import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Info, FileText, ChevronDown } from "lucide-react"
import {
    useGetProjectFiles,
    useSummarizeProjectFiles,
    useGetFileSummaries,
    useResummarizeAllFiles,
    useRemoveSummariesFromFiles
} from "@/hooks/api/use-projects-api"
import { ProjectFile } from "shared/schema"
import { matchesAnyPattern } from "shared/src/utils/pattern-matcher"
import { buildCombinedFileSummaries } from "shared/src/utils/summary-formatter"

import { FileViewerDialog } from "@/components/navigation/file-viewer-dialog"
import { SummaryDialog } from "@/components/projects/summary-dialog"
import { useUpdateSettings } from "@/websocket-state/hooks/updaters/websocket-updater-hooks"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { FormatTokenCount } from "@/components/format-token-count"
import { estimateTokenCount } from "@/components/projects/file-panel/file-tree/file-tree-utils/file-node-tree-utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { AppSettings } from "shared/src/global-state/global-state-schema"
import { useActiveProjectTab } from "@/websocket-state/hooks/selectors/websocket-selectors"
import { useSettingsField } from "@/websocket-state/hooks/settings/settings-hooks"

export const Route = createFileRoute("/project-summarization")({
    component: ProjectSummarizationSettingsPage,
})

// Type for sorting
type SortOption = "nameAsc" | "nameDesc"
    | "lastSummarizedAsc" | "lastSummarizedDesc"
    | "fileTokenAsc" | "fileTokenDesc"
    | "summaryTokenAsc" | "summaryTokenDesc"
    | "sizeAsc" | "sizeDesc"

/**
 * We no longer import a separate "FileSummary" type because file records now store
 * their summaries directly on the `files` table. We simply use `ProjectFile` and read `.summary`.
 */
function ResummarizeButton({ projectId, fileId, disabled }: { projectId: string, fileId: string, disabled: boolean }) {
    const summarizeMutation = useSummarizeProjectFiles(projectId)

    return (
        <button
            className="text-blue-600 hover:underline"
            onClick={() => {
                summarizeMutation.mutate(
                    { fileIds: [fileId], force: true },
                    {
                        onSuccess: (resp) => {
                            toast.success(resp.message || "File has been successfully re-summarized")
                        },
                        onError: (error) => {
                            toast.error(error.message || "Failed to re-summarize file")
                        }
                    }
                )
            }}
            disabled={disabled || summarizeMutation.isPending}
        >
            {summarizeMutation.isPending ? "Summarizing..." : "Re-summarize"}
        </button>
    )
}

function ProjectSummarizationSettingsPage() {
    const { data: summarizationEnabledProjectIds = [] } = useSettingsField('summarizationEnabledProjectIds')
    const { data: summarizationIgnorePatterns = [] } = useSettingsField('summarizationIgnorePatterns')
    const { tabData: projectTabState } = useActiveProjectTab()
    const updateSettings = useUpdateSettings()

    const selectedProjectId = projectTabState?.selectedProjectId
    const isProjectSummarizationEnabled = selectedProjectId
        ? summarizationEnabledProjectIds?.includes(selectedProjectId)
        : false

    const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
    const [expandedSummaryFileId, setExpandedSummaryFileId] = useState<string | null>(null)
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false)
    const [selectedFileRecord, setSelectedFileRecord] = useState<ProjectFile | null>(null)

    // -- Sorting & Filtering additions --
    const [sortBy, setSortBy] = useState<SortOption>("nameAsc")
    // Example numeric filters for token counts
    const [minTokensFilter, setMinTokensFilter] = useState<number | null>(null)
    const [maxTokensFilter, setMaxTokensFilter] = useState<number | null>(null)

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
            map.set(f.id, f)
        }
        return map
    }, [summaries])

    // 3) Summarize selected files
    const summarizeMutation = useSummarizeProjectFiles(selectedProjectId ?? "")
    const removeSummariesMutation = useRemoveSummariesFromFiles(selectedProjectId ?? "")
    const resummarizeAllMutation = useResummarizeAllFiles(selectedProjectId ?? "")

    const ignorePatterns = summarizationIgnorePatterns ?? []
    const includedFiles: ProjectFile[] = []
    const excludedFiles: ProjectFile[] = []

    // Partition files into "ignored" vs "included"
    for (const file of projectFiles) {
        const isIgnored = matchesAnyPattern(file.path, ignorePatterns)
        if (isIgnored) {
            excludedFiles.push(file)
        } else {
            includedFiles.push(file)
        }
    }

    // -------------------------------------------------------------
    // Compute token counts (used for sorting & filtering).
    // We can memoize a map of { fileId -> tokenCount } for performance.
    // -------------------------------------------------------------
    const tokensMap = useMemo(() => {
        const map = new Map<string, number>()
        for (const file of includedFiles) {
            if (file.content) {
                map.set(file.id, estimateTokenCount(file.content))
            } else {
                map.set(file.id, 0)
            }
        }
        return map
    }, [includedFiles])

    // Add summaryTokensMap calculation
    const summaryTokensMap = useMemo(() => {
        const map = new Map<string, number>()
        for (const file of includedFiles) {
            if (file.summary) {
                map.set(file.id, estimateTokenCount(file.summary))
            } else {
                map.set(file.id, 0)
            }
        }
        return map
    }, [includedFiles])

    // File size is in the DB (`file.size`), so we can use that directly.

    // -------------------------------------------------------------
    // Filtering by token count
    // -------------------------------------------------------------
    const filteredIncludedFiles = useMemo(() => {
        return includedFiles.filter((file) => {
            const tokenCount = tokensMap.get(file.id) ?? 0
            if (minTokensFilter !== null && tokenCount < minTokensFilter) return false
            if (maxTokensFilter !== null && tokenCount > maxTokensFilter) return false
            return true
        })
    }, [includedFiles, minTokensFilter, maxTokensFilter, tokensMap])

    // -------------------------------------------------------------
    // Sorting logic
    // -------------------------------------------------------------
    const sortedIncludedFiles = useMemo(() => {
        return [...filteredIncludedFiles].sort((a, b) => {
            const fileA = summariesMap.get(a.id)
            const fileB = summariesMap.get(b.id)

            // Fallbacks
            const nameA = fileA?.path ?? ""
            const nameB = fileB?.path ?? ""
            const updatedA = fileA?.summaryLastUpdatedAt
                ? new Date(fileA.summaryLastUpdatedAt).getTime()
                : 0
            const updatedB = fileB?.summaryLastUpdatedAt
                ? new Date(fileB.summaryLastUpdatedAt).getTime()
                : 0
            const fileTokensA = tokensMap.get(a.id) ?? 0
            const fileTokensB = tokensMap.get(b.id) ?? 0
            const summaryTokensA = summaryTokensMap.get(a.id) ?? 0
            const summaryTokensB = summaryTokensMap.get(b.id) ?? 0
            const sizeA = fileA?.size ?? 0
            const sizeB = fileB?.size ?? 0

            switch (sortBy) {
                case "nameAsc":
                    return nameA.localeCompare(nameB)
                case "nameDesc":
                    return nameB.localeCompare(nameA)

                case "lastSummarizedAsc":
                    return updatedA - updatedB
                case "lastSummarizedDesc":
                    return updatedB - updatedA

                case "fileTokenAsc":
                    return fileTokensA - fileTokensB
                case "fileTokenDesc":
                    return fileTokensB - fileTokensA

                case "summaryTokenAsc":
                    return summaryTokensA - summaryTokensB
                case "summaryTokenDesc":
                    return summaryTokensB - summaryTokensA

                case "sizeAsc":
                    return sizeA - sizeB
                case "sizeDesc":
                    return sizeB - sizeA

                default:
                    return 0
            }
        })
    }, [filteredIncludedFiles, summariesMap, sortBy, tokensMap, summaryTokensMap])

    // Similarly for excluded files, if you want them sorted:
    const sortedExcludedFiles = useMemo(() => {
        return [...excludedFiles].sort((a, b) => {
            const fileA = summariesMap.get(a.id)
            const fileB = summariesMap.get(b.id)

            // Fallbacks
            const nameA = fileA?.path ?? ""
            const nameB = fileB?.path ?? ""
            const updatedA = fileA?.summaryLastUpdatedAt
                ? new Date(fileA.summaryLastUpdatedAt).getTime()
                : 0
            const updatedB = fileB?.summaryLastUpdatedAt
                ? new Date(fileB.summaryLastUpdatedAt).getTime()
                : 0
            const tokensA = tokensMap.get(a.id) ?? 0
            const tokensB = tokensMap.get(b.id) ?? 0
            const sizeA = fileA?.size ?? 0
            const sizeB = fileB?.size ?? 0

            switch (sortBy) {
                case "nameAsc":
                    return nameA.localeCompare(nameB)
                case "nameDesc":
                    return nameB.localeCompare(nameA)

                case "lastSummarizedAsc":
                    return updatedA - updatedB
                case "lastSummarizedDesc":
                    return updatedB - updatedA

                case "fileTokenAsc":
                    return tokensA - tokensB
                case "fileTokenDesc":
                    return tokensB - tokensA

                case "sizeAsc":
                    return sizeA - sizeB
                case "sizeDesc":
                    return sizeB - sizeA

                default:
                    return 0
            }
        })
    }, [excludedFiles, summariesMap, sortBy, tokensMap])

    function toggleFileSelection(fileId: string) {
        setSelectedFileIds((prev) =>
            prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
        )
    }

    function handleSummarize() {
        if (!selectedFileIds.length) {
            toast.error("No Files Selected", {
                description: "Please select at least one file to summarize",
            })
            return
        }
        summarizeMutation.mutate(
            { fileIds: selectedFileIds },
            {
                onSuccess: (resp) => {
                    toast.success(resp.message || "Selected files have been summarized", {
                        description: "Selected files have been summarized",
                    })
                },
            }
        )
    }

    function handleForceSummarize() {
        if (!selectedFileIds.length) {
            toast.error("No Files Selected", {
                description: "Please select at least one file to re-summarize",
            })
            return
        }
        summarizeMutation.mutate(
            { fileIds: selectedFileIds, force: true },
            {
                onSuccess: (resp) => {
                    toast.success(resp.message || "Selected files have been force re-summarized", {
                        description: "Selected files have been force re-summarized",
                    })
                },
            }
        )
    }

    function handleRemoveSummaries() {
        if (!selectedFileIds.length) {
            toast.error("No Files Selected", {
                description: "Please select at least one file to remove summaries from",
            })
            return
        }
        removeSummariesMutation.mutate(selectedFileIds, {
            onSuccess: (resp) => {
                toast.success(resp.message || `Removed ${resp.removedCount} summaries`, {
                    description: "Summaries have been removed",
                })
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

    const [isResummarizeDialogOpen, setIsResummarizeDialogOpen] = useState(false)

    function handleResummarizeAll() {
        if (!selectedProjectId) return
        setIsResummarizeDialogOpen(true)
    }

    function handleConfirmResummarize() {
        if (!selectedProjectId) return
        resummarizeAllMutation.mutate()
        setIsResummarizeDialogOpen(false)
    }

    function handleExcludeFile(filePath: string) {
        updateSettings((prev: AppSettings) => ({
            ...prev,
            summarizationIgnorePatterns: [
                ...prev.summarizationIgnorePatterns,
                filePath,
            ],
        }))
    }

    // --------------------------------------------
    // "Summary Memory" & aggregated stats
    // --------------------------------------------
    const totalContentLength = useMemo(() => {
        let total = 0
        for (const file of includedFiles) {
            if (file.content) {
                total += file.content.length
            }
        }
        return total
    }, [includedFiles])

    const totalTokensInSummaries = useMemo(() => {
        let total = 0
        for (const file of includedFiles) {
            if (file.summary) {
                total += estimateTokenCount(file.summary)
            }
        }
        return total
    }, [includedFiles])

    const combinedSummary = useMemo(() => {
        return includedFiles
            .filter(f => f.summary)
            .map(f => f.summary)
            .join("\n\n")
    }, [includedFiles])

    const combinedSummaryTokens = useMemo(() => {
        return estimateTokenCount(combinedSummary)
    }, [combinedSummary])

    const totalTokensInContent = useMemo(() => {
        let total = 0
        for (const file of includedFiles) {
            if (file.content) {
                total += estimateTokenCount(file.content)
            }
        }
        return total
    }, [includedFiles])

    const formattedCombinedSummary = useMemo(() => {
        const includedSummaries = summaries.filter(file =>
            !matchesAnyPattern(file.path, summarizationIgnorePatterns ?? [])
        );

        return buildCombinedFileSummaries(includedSummaries, {
            sectionDelimiter: "----------------------------------------",
            headerStyle: (file) => `File: ${file.path}`,
            footerStyle: (file) => `Last Updated: ${file.summaryLastUpdatedAt
                ? new Date(file.summaryLastUpdatedAt).toLocaleString()
                : 'Never'
                }`,
            includeEmptySummaries: false,
        });
    }, [summaries, summarizationIgnorePatterns]);

    const [combinedSummaryDialogOpen, setCombinedSummaryDialogOpen] = useState(false);

    if (isLoading) {
        return <div className="p-4">Loading files...</div>
    }
    if (isError) {
        return <div className="p-4">Error fetching files</div>
    }

    return (
        <div className="p-4 space-y-6">
            {/* SUMMARY MEMORY & AGGREGATE STATS CARD */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Summary Memory</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => setCombinedSummaryDialogOpen(true)}
                            disabled={!isProjectSummarizationEnabled || summaries.length === 0}
                        >
                            <FileText className="h-4 w-4" />
                            View Combined Summary
                        </Button>
                    </CardTitle>
                    <CardDescription>
                        A combined or "consolidated" view of all file summaries.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="text-sm">
                            <strong>Total files with summaries:</strong> {summaries.length}
                            <span className="text-xs ml-2 text-muted-foreground">
                                (all files, including excluded)
                            </span>
                        </p>
                        <p className="text-sm">
                            <strong>Total included files with summaries:</strong>{" "}
                            {includedFiles.filter(f => f.summary).length}
                            <span className="text-xs ml-2 text-muted-foreground">
                                (only files not matching ignore patterns)
                            </span>
                        </p>
                        <p className="text-sm">
                            <strong>Total content length:</strong> {totalContentLength} characters
                        </p>
                        <p className="text-sm flex items-center gap-1">
                            <strong>Total tokens (raw content):</strong>{" "}
                            <FormatTokenCount tokenContent={totalTokensInContent} />
                        </p>
                        <p className="text-sm flex items-center gap-1">
                            <strong>Total tokens (included files summaries):</strong>{" "}
                            <FormatTokenCount tokenContent={totalTokensInSummaries} />
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* MAIN PROJECT SUMMARIZATION SETTINGS CARD */}
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Project Summarization Settings</CardTitle>
                    <CardDescription>
                        Configure ignore patterns, view file summaries, and optionally sort/filter the file list.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium">Enable Summarization</span>
                                <p className="text-sm text-muted-foreground">
                                    When enabled, new or changed files will be automatically summarized.
                                </p>
                            </div>
                            <Switch
                                checked={isProjectSummarizationEnabled}
                                onCheckedChange={(check) => {
                                    if (!selectedProjectId) return
                                    updateSettings((prev: AppSettings) => ({
                                        ...prev,
                                        summarizationEnabledProjectIds: check
                                            ? [...prev.summarizationEnabledProjectIds, selectedProjectId]
                                            : prev.summarizationEnabledProjectIds.filter(
                                                (id: string) => id !== selectedProjectId
                                            ),
                                    }))
                                }}
                            />
                        </div>
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
                    <IgnorePatternList
                        disabled={!isProjectSummarizationEnabled}
                    />
                    {/* Sort-by dropdown */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <label>Sort By:</label>
                        <Select
                            value={sortBy}
                            onValueChange={(value) =>
                                setSortBy(value as SortOption)
                            }
                            disabled={!isProjectSummarizationEnabled}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Sort by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="nameAsc">Name (A→Z)</SelectItem>
                                <SelectItem value="nameDesc">Name (Z→A)</SelectItem>
                                <SelectItem value="lastSummarizedAsc">Last Summarized (Oldest)</SelectItem>
                                <SelectItem value="lastSummarizedDesc">Last Summarized (Newest)</SelectItem>
                                <SelectItem value="fileTokenAsc">File Tokens (asc)</SelectItem>
                                <SelectItem value="fileTokenDesc">File Tokens (desc)</SelectItem>
                                <SelectItem value="summaryTokenAsc">Summary Tokens (asc)</SelectItem>
                                <SelectItem value="summaryTokenDesc">Summary Tokens (desc)</SelectItem>
                                <SelectItem value="sizeAsc">File Size (smallest)</SelectItem>
                                <SelectItem value="sizeDesc">File Size (largest)</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Optional: Filter by token range */}
                        <div className="flex items-center gap-2">
                            <label htmlFor="minTokens" className="text-sm">Min Tokens:</label>
                            <Input
                                id="minTokens"
                                type="number"
                                placeholder="0"
                                className="w-24"
                                value={minTokensFilter ?? ""}
                                disabled={!isProjectSummarizationEnabled}
                                onChange={(e) =>
                                    setMinTokensFilter(e.target.value ? Number(e.target.value) : null)
                                }
                            />
                            <label htmlFor="maxTokens" className="text-sm">Max Tokens:</label>
                            <Input
                                id="maxTokens"
                                type="number"
                                placeholder="∞"
                                className="w-24"
                                value={maxTokensFilter ?? ""}
                                disabled={!isProjectSummarizationEnabled}
                                onChange={(e) =>
                                    setMaxTokensFilter(e.target.value ? Number(e.target.value) : null)
                                }
                            />
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-sm font-semibold">Included Files</h3>
                                <div className="flex items-center gap-1">
                                    <Checkbox
                                        id="select-all"
                                        checked={
                                            selectedFileIds.length === sortedIncludedFiles.length &&
                                            sortedIncludedFiles.length > 0
                                        }
                                        disabled={!isProjectSummarizationEnabled}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedFileIds(sortedIncludedFiles.map((f) => f.id))
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
                            <ul
                                className={`mt-2 space-y-1 ${!isProjectSummarizationEnabled ? "opacity-50" : ""
                                    }`}
                            >
                                {sortedIncludedFiles.map((file) => {
                                    const fileRecord = summariesMap.get(file.id)
                                    const hasSummary = !!fileRecord?.summary
                                    const lastSummarized = fileRecord?.summaryLastUpdatedAt
                                        ? new Date(fileRecord.summaryLastUpdatedAt).toLocaleString()
                                        : null
                                    const tokenCount = tokensMap.get(file.id) ?? 0
                                    const summaryTokenCount = summaryTokensMap.get(file.id) ?? 0

                                    return (
                                        <li
                                            key={file.id}
                                            className="group flex flex-col gap-1 text-xs rounded-md hover:bg-accent/10 transition-colors duration-200 p-1"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id={file.id}
                                                    checked={selectedFileIds.includes(file.id)}
                                                    disabled={!isProjectSummarizationEnabled}
                                                    onCheckedChange={() =>
                                                        toggleFileSelection(file.id)
                                                    }
                                                />
                                                <label
                                                    htmlFor={file.id}
                                                    className={`cursor-pointer ${hasSummary
                                                        ? "font-medium text-blue-600"
                                                        : ""
                                                        }`}
                                                >
                                                    {file.path}
                                                </label>

                                                {/* Token counts - always visible */}
                                                <div className="flex items-center gap-2 ml-2">
                                                    <span className="text-[10px] text-muted-foreground">File:</span>
                                                    <FormatTokenCount tokenContent={tokensMap.get(file.id) ?? 0} />
                                                    {hasSummary && (
                                                        <>
                                                            <span className="text-[10px] text-muted-foreground">Summary:</span>
                                                            <FormatTokenCount tokenContent={summaryTokensMap.get(file.id) ?? 0} />
                                                        </>
                                                    )}
                                                </div>

                                                {/* Hide these controls until hover */}
                                                <div className="flex items-center ml-auto opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                                    {lastSummarized && (
                                                        <span className="text-muted-foreground text-[10px]">
                                                            Last: {lastSummarized}
                                                        </span>
                                                    )}
                                                    {hasSummary && (
                                                        <button
                                                            className="flex items-center gap-1 text-blue-600 hover:underline"
                                                            onClick={() => handleToggleSummary(file.id)}
                                                            disabled={!isProjectSummarizationEnabled}
                                                        >
                                                            <Info className="h-4 w-4" />
                                                            View
                                                        </button>
                                                    )}
                                                    <ResummarizeButton
                                                        projectId={selectedProjectId ?? ""}
                                                        fileId={file.id}
                                                        disabled={!isProjectSummarizationEnabled}
                                                    />
                                                    <button
                                                        className="text-red-600 hover:underline"
                                                        onClick={() => handleExcludeFile(file.path)}
                                                        disabled={!isProjectSummarizationEnabled}
                                                    >
                                                        Exclude
                                                    </button>
                                                </div>
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

                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                    onClick={handleSummarize}
                                    disabled={
                                        selectedFileIds.length === 0 ||
                                        summarizeMutation.isPending ||
                                        !isProjectSummarizationEnabled
                                    }
                                >
                                    {summarizeMutation.isPending
                                        ? "Summarizing..."
                                        : "Summarize Selected"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleForceSummarize}
                                    disabled={
                                        selectedFileIds.length === 0 ||
                                        summarizeMutation.isPending ||
                                        !isProjectSummarizationEnabled
                                    }
                                >
                                    {summarizeMutation.isPending
                                        ? "Re-summarizing..."
                                        : "Force Re-summarize"}
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleRemoveSummaries}
                                    disabled={
                                        selectedFileIds.length === 0 ||
                                        removeSummariesMutation.isPending ||
                                        !isProjectSummarizationEnabled
                                    }
                                >
                                    {removeSummariesMutation.isPending
                                        ? "Removing..."
                                        : "Remove Summaries"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleResummarizeAll}
                                    disabled={!isProjectSummarizationEnabled}
                                >
                                    {resummarizeAllMutation.isPending
                                        ? "Re-summarizing All..."
                                        : "Force Re-summarize All Files"}
                                </Button>
                            </div>
                        </div>

                        <div
                            className={
                                !isProjectSummarizationEnabled ? "opacity-50 pointer-events-none" : ""
                            }
                        >
                            <Collapsible>
                                <div className="flex items-center gap-2">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="p-0">
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <h3 className="text-sm font-semibold">
                                        Excluded Files ({sortedExcludedFiles.length})
                                    </h3>
                                </div>
                                <CollapsibleContent>
                                    <ul className="mt-2 list-inside list-disc space-y-1 pl-4">
                                        {sortedExcludedFiles.map((file) => (
                                            <li key={file.id} className="text-xs">
                                                {file.path}
                                            </li>
                                        ))}
                                    </ul>
                                </CollapsibleContent>
                            </Collapsible>
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

            <Dialog open={isResummarizeDialogOpen} onOpenChange={setIsResummarizeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Re-summarize All</DialogTitle>
                        <DialogDescription>
                            This will force re-summarize all files in the project. This action cannot be undone.
                            Are you sure you want to continue?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsResummarizeDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleConfirmResummarize}
                            disabled={resummarizeAllMutation.isPending}
                        >
                            {resummarizeAllMutation.isPending ? "Re-summarizing..." : "Yes, Re-summarize All"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FileViewerDialog
                open={summaryDialogOpen}
                markdownText={selectedFileRecord?.summary ?? ""}
                onClose={() => {
                    setSummaryDialogOpen(false)
                    setSelectedFileRecord(null)
                }}
            />

            <SummaryDialog
                isOpen={combinedSummaryDialogOpen}
                onClose={() => setCombinedSummaryDialogOpen(false)}
                summaryContent={formattedCombinedSummary}
            />
        </div>
    )
}

/**
 * This is just an extracted pattern-list for ignore patterns
 * to keep the main component smaller.
 */
function IgnorePatternList({ disabled }: { disabled: boolean }) {
    const updateSettings = useUpdateSettings()
    const { data: patterns } = useSettingsField('summarizationIgnorePatterns')
    const [newPattern, setNewPattern] = useState("")

    function handleAdd() {
        const trimmed = newPattern.trim()
        if (!trimmed) return
        updateSettings((prev: AppSettings) => ({
            ...prev,
            summarizationIgnorePatterns: [...prev.summarizationIgnorePatterns, trimmed],
        }))
        setNewPattern("")
    }

    function handleRemove(pattern: string) {
        updateSettings((prev: AppSettings) => ({
            ...prev,
            summarizationIgnorePatterns: prev.summarizationIgnorePatterns.filter((p: string) => p !== pattern),
        }))
    }

    return (
        <div className={!disabled ? "" : "opacity-50 pointer-events-none"}>
            <div className="flex items-center gap-2 mt-2">
                <Input
                    placeholder="Add ignore pattern (e.g. node_modules, *.md, etc.)"
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                />
                <Button onClick={handleAdd}>Add</Button>
            </div>
            <Collapsible className="mt-3">
                <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0">
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </CollapsibleTrigger>
                    <span className="text-sm font-medium">
                        Current Patterns ({patterns?.length ?? 0})
                    </span>
                </div>
                <CollapsibleContent>
                    <ul className="mt-2 space-y-1">
                        {patterns?.map((pattern, idx) => (
                            <li
                                key={`${pattern}-${idx}`}
                                className="flex items-center justify-between rounded p-1 hover:bg-accent/10"
                            >
                                <span className="font-mono text-xs">{pattern}</span>
                                <Button variant="ghost" size="icon" onClick={() => handleRemove(pattern)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}