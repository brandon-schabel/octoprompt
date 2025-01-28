import { Project } from "shared/schema"
import { ScanEye } from "lucide-react"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TicketIcon } from "lucide-react"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProjectSettingsDialog } from "../project-settings-dialog"
import { Badge } from "@/components/ui/badge"
import { Link } from "@tanstack/react-router"

type ProjectHeaderProps = {
    projectData: Project | null
    isOnTicketsRoute: boolean
    isOnSummarizationRoute: boolean
    openTicketsCount: number
}

const ProjectHeader = function ProjectHeader({
    projectData,
    isOnTicketsRoute,
    isOnSummarizationRoute,
    openTicketsCount,
}: ProjectHeaderProps) {
    if (!projectData) return null

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 pt-4">
            <div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <h2 className="text-lg font-semibold hover:cursor-help">
                                {projectData?.name}
                            </h2>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="flex items-center gap-2 max-w-md">
                            <span className="break-all">{projectData?.path}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 hover:bg-accent hover:text-accent-foreground"
                                onClick={(e) => {
                                    e.preventDefault()
                                    navigator.clipboard.writeText(projectData?.path || '')
                                    toast.success('Project path copied to clipboard')
                                }}
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <span className="hidden md:block text-sm text-muted-foreground">
                    {projectData?.path.slice(0, 100)}
                </span>
            </div>

            <div className="flex items-center space-x-4">
                <ProjectSettingsDialog />

                <Link
                    to="/tickets"
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                        hover:bg-accent/50 px-3 py-2 rounded-md ${isOnTicketsRoute
                            ? 'text-indigo-600 dark:text-indigo-400 bg-accent/80'
                            : 'text-foreground hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                >
                    <TicketIcon className="w-4 h-4" />
                    Tickets
                    {openTicketsCount > 0 && (
                        <Badge variant="count" className="ml-1">
                            {openTicketsCount}
                        </Badge>
                    )}
                </Link>

                <Link
                    to="/project-summarization"
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                        hover:bg-accent/50 px-3 py-2 rounded-md ${isOnSummarizationRoute
                            ? 'text-indigo-600 dark:text-indigo-400 bg-accent/80'
                            : 'text-foreground hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                >
                    <ScanEye className="w-4 h-4" />
                    Summarization
                </Link>
            </div>
        </div>
    )
}

export { ProjectHeader }