import { useEffect, useState } from "react"
import { useNavigate, useMatches } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProjectList } from "@/components/projects/project-list"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { ChatDialog } from "@/components/chat/chat-dialog"
import { useGetProjects, useDeleteProject } from "@/hooks/api/use-projects-api"
import { Link } from "@tanstack/react-router"
import { useHotkeys } from 'react-hotkeys-hook'
import { FolderIcon, MessageSquareIcon, KeyIcon, Settings, HelpCircle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useApi } from "@/hooks/use-api"
import { HelpDialog } from "@/components/navigation/help-dialog"
import { SettingsDialog } from "@/components/settings/settings-dialog"
import { useUpdateActiveProjectTab } from "@/zustand/updaters"
import { useActiveProjectTab } from "@/zustand/selectors"
import { useSettingsField } from "@/zustand/zustand-utility-hooks"

export function AppNavbar() {
    const [openDialog, setOpenDialog] = useState(false)
    const [projectDialogOpen, setProjectDialogOpen] = useState(false)
    const [chatDialogOpen, setChatDialogOpen] = useState(false)
    const [editProjectId, setEditProjectId] = useState<string | null>(null)
    const [helpOpen, setHelpOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)

    const matches = useMatches()
    // We treat /tickets and /project-summarization as part of "projects" route
    const isOnProjectsRoute = matches.some(match =>
        ["/projects", "/tickets", "/project-summarization"].includes(match.routeId)
    )
    const isOnChatRoute = matches.some(match => match.routeId === "/chat")
    const isOnKeysRoute = matches.some(match => match.routeId === "/keys")

    const { data: theme = 'dark' } = useSettingsField('theme')

    const updateActiveProjectTab = useUpdateActiveProjectTab();
    const { tabData: activeProjectTabState } = useActiveProjectTab()
    const selectedProjectId = activeProjectTabState?.selectedProjectId;
    const navigate = useNavigate()
    const { data: projectData, isLoading: projectsLoading } = useGetProjects()
    const { mutate: deleteProject } = useDeleteProject()
    const { api } = useApi()

    const globalTheme = theme || 'dark'

    useEffect(() => {
        if (globalTheme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [globalTheme])

    // Health check
    useQuery<{ success: boolean }>({
        queryKey: ['health'],
        refetchInterval: 30000,
        queryFn: () =>
            api.request('/api/health', {
                method: 'GET',
            }).then(res => {
                if (res.status === 200) {
                    return res.json()
                }
                throw new Error('Failed to fetch health')
            })
    })

    // Hotkeys
    useHotkeys('mod+o', (e: any) => {
        e.preventDefault()
        setOpenDialog(true)
    })

    useHotkeys('mod+n', (e: any) => {
        e.preventDefault()
        handleOpenNewProject()
    })

    const handleSelectProject = (id: string) => {
        updateActiveProjectTab(prev => ({
            ...prev,
            selectedProjectId: id,
            selectedFiles: [],
            selectedPrompts: []
        }))
        setOpenDialog(false)
        navigate({ to: '/projects' })
    }

    const handleOpenNewProject = () => {
        setEditProjectId(null)
        setProjectDialogOpen(true)
    }

    const handleEditProject = (id: string) => {
        setEditProjectId(id)
        setProjectDialogOpen(true)
        setOpenDialog(false)
    }

    return (
        <>
            <nav className="flex items-center w-full px-4 py-2 border-b">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        {/* Projects link */}
                        <Link
                            to="/projects"
                            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                px-3 py-2 rounded-md 
                ${isOnProjectsRoute
                                    ? "text-indigo-600 dark:text-blue-300 bg-indigo-50 dark:bg-primary/30"
                                    : "text-foreground hover:text-indigo-600 dark:hover:text-blue-300 hover:bg-accent/50 dark:hover:bg-primary/20"
                                }`}
                        >
                            <FolderIcon className="w-4 h-4" />
                            Project
                        </Link>
                        <div className="h-4 w-[1px] bg-border" />

                        {/* Chat link */}
                        <Link
                            to="/chat"
                            search={{ prefill: false }}
                            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                px-3 py-2 rounded-md 
                ${isOnChatRoute
                                    ? "text-indigo-600 dark:text-blue-300 bg-indigo-50 dark:bg-primary/30"
                                    : "text-foreground hover:text-indigo-600 dark:hover:text-blue-300 hover:bg-accent/50 dark:hover:bg-primary/20"
                                }`}
                        >
                            <MessageSquareIcon className="w-4 h-4" />
                            Chat
                        </Link>
                        <div className="h-4 w-[1px] bg-border" />

                        {/* Keys link */}
                        <Link
                            to="/keys"
                            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors 
                px-3 py-2 rounded-md 
                ${isOnKeysRoute
                                    ? "text-indigo-600 dark:text-blue-300 bg-indigo-50 dark:bg-primary/30"
                                    : "text-foreground hover:text-indigo-600 dark:hover:text-blue-300 hover:bg-accent/50 dark:hover:bg-primary/20"
                                }`}
                        >
                            <KeyIcon className="w-4 h-4" />
                            Keys
                        </Link>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isOnChatRoute && (
                            <Button
                                variant="outline"
                                onClick={() => setOpenDialog(true)}
                                className="ml-auto"
                            >
                                <FolderIcon className="mr-2 h-4 w-4" /> Projects
                            </Button>
                        )}

                        {isOnChatRoute && (
                            <Button
                                variant="outline"
                                onClick={() => setChatDialogOpen(true)}
                                className="ml-auto"
                            >
                                <MessageSquareIcon className="mr-2 h-4 w-4" /> New Chat
                            </Button>
                        )}

                        {/* Settings button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSettingsOpen(true)}
                        >
                            <Settings className="h-5 w-5" />
                        </Button>

                        {/* Help button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHelpOpen(true)}
                            className="ml-2"
                        >
                            <HelpCircle className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Dialog: Open Project */}
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Open Project</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                        <ProjectList
                            loading={projectsLoading}
                            projects={projectData?.projects ?? []}
                            selectedProjectId={selectedProjectId ?? null}
                            onSelectProject={handleSelectProject}
                            onEditProject={handleEditProject}
                            onDeleteProject={(id) => {
                                deleteProject(id)
                                setOpenDialog(false)
                            }}
                            onCreateProject={() => {
                                setEditProjectId(null)
                                setProjectDialogOpen(true)
                                setOpenDialog(false)
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <ProjectDialog
                open={projectDialogOpen}
                projectId={editProjectId}
                onOpenChange={setProjectDialogOpen}
            />
            <ChatDialog
                open={chatDialogOpen}
                onOpenChange={setChatDialogOpen}
            />
            <HelpDialog
                open={helpOpen}
                onOpenChange={setHelpOpen}
            />
            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
            />
        </>
    )
}