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
import { HelpDialog } from "@/components/help-dialog"
import { useGlobalStateContext } from "./global-state-context"
import { SettingsDialog } from "@/components/settings/settings-dialog"

export function AppNavbar() {
    const [openDialog, setOpenDialog] = useState(false)
    const [projectDialogOpen, setProjectDialogOpen] = useState(false)
    const [chatDialogOpen, setChatDialogOpen] = useState(false)
    const [editProjectId, setEditProjectId] = useState<string | null>(null)
    const [helpOpen, setHelpOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)

    const matches = useMatches()
    const isOnChatRoute = matches.some(match => match.routeId === "/chat")
    const isOnProjectsRoute = matches.some(match => match.routeId === "/projects")
    const isOnKeysRoute = matches.some(match => match.routeId === "/keys")

    const { activeProjectTabState: activeTabState, updateActiveProjectTab: updateActiveTab, updateGlobalStateKey } = useGlobalStateContext()
    const selectedProjectId = activeTabState?.selectedProjectId
    const navigate = useNavigate()
    const { data: projectData, isLoading: projectsLoading } = useGetProjects()
    const { mutate: deleteProject } = useDeleteProject()
    const { api } = useApi()
    const { state, } = useGlobalStateContext()

    const globalTheme = state?.settings.theme

    // Dark mode state
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

    useEffect(() => {
        if (globalTheme === 'dark') {
            setIsDarkMode(true)
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [globalTheme])

    const handleThemeToggle = () => {
        const newMode = !isDarkMode
        setIsDarkMode(newMode)
        if (newMode) {
            document.documentElement.classList.add('dark')
            // localStorage.setItem('theme', 'dark')
            updateGlobalStateKey('settings', (prev) => ({
                ...prev,
                theme: 'dark' as 'light' | 'dark',
            }))
        } else {
            document.documentElement.classList.remove('dark')
            // localStorage.setItem('theme', 'light')
            updateGlobalStateKey('settings', (prev) => ({
                ...prev,
                theme: 'light' as 'light' | 'dark',
            }))
        }
    }

    useQuery<{ success: boolean }>({
        queryKey: ['health'],
        refetchInterval: 30000,
        queryFn: () => api.request('/api/health', {
            method: 'GET',
        }).then(res => {
            if (res.status === 200) {
                return res.json()
            }
            throw new Error('Failed to fetch health')
        })
    })

    useHotkeys('mod+o', (e: any) => {
        e.preventDefault()
        setOpenDialog(true)
    })

    useHotkeys('mod+n', (e: any) => {
        e.preventDefault()
        handleOpenNewProject()
    })

    const handleSelectProject = (id: string) => {
        updateActiveTab(prev => ({
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
            <nav className="flex items-center w-full px-4 py-2 border-b ">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <Link
                            to="/projects"
                            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isOnProjectsRoute
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                                }`}
                        >
                            <FolderIcon className="w-4 h-4" />
                            Project
                        </Link>
                        <Link
                            to="/chat"
                            search={{ prefill: false }}
                            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isOnChatRoute
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                                }`}
                        >
                            <MessageSquareIcon className="w-4 h-4" />
                            Chat
                        </Link>
                        <Link
                            to="/keys"
                            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${isOnKeysRoute
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
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