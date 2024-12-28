import { useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProjectList } from "@/components/projects/project-list"
import { ProjectDialog } from "@/components/projects/project-dialog"
import { useGetProjects, useDeleteProject } from "@/hooks/api/use-projects-api"
import { Link } from "@tanstack/react-router"
import { useHotkeys } from 'react-hotkeys-hook'
import { FolderIcon, MessageSquareIcon, KeyIcon, Settings, HelpCircle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useApi } from "@/hooks/use-api"
import { Switch } from "@/components/ui/switch"
import { HelpDialog } from "@/components/help-dialog"
import { useGlobalStateContext } from "./global-state-context"

export function AppNavbar() {
    const [openDialog, setOpenDialog] = useState(false)
    const [projectDialogOpen, setProjectDialogOpen] = useState(false)
    const [editProjectId, setEditProjectId] = useState<string | null>(null)
    const [helpOpen, setHelpOpen] = useState(false)

    const { activeProjectTabState: activeTabState, updateActiveProjectTab: updateActiveTab } = useGlobalStateContext()
    const selectedProjectId = activeTabState?.selectedProjectId
    const navigate = useNavigate()
    const { data: projectData, isLoading: projectsLoading } = useGetProjects()
    const { mutate: deleteProject } = useDeleteProject()
    const { api } = useApi()

    // Dark mode state
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false)

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme')
        if (storedTheme === 'dark') {
            setIsDarkMode(true)
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }, [])

    const handleThemeToggle = () => {
        const newMode = !isDarkMode
        setIsDarkMode(newMode)
        if (newMode) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
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
        console.log("handleSelectProject", id)
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
                            className="inline-flex items-center gap-2 text-sm font-medium hover:text-indigo-600"
                        >
                            <FolderIcon className="w-4 h-4" />
                            Project
                        </Link>
                        <Link
                            to="/chat"
                            search={{ prefill: false }}
                            className="inline-flex items-center gap-2 text-sm font-medium hover:text-indigo-600"
                        >
                            <MessageSquareIcon className="w-4 h-4" />
                            Chat
                        </Link>
                        <Link
                            to="/keys"
                            className="inline-flex items-center gap-2 text-sm font-medium hover:text-indigo-600"
                        >
                            <KeyIcon className="w-4 h-4" />
                            Keys
                        </Link>
                    </div>


                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setOpenDialog(true)}
                            className="ml-auto"
                        >
                            <Settings /> Projects
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

                        {/* Dark mode toggle */}
                        <div className="flex items-center gap-2 ml-4">
                            <span className="text-sm">Dark Mode</span>
                            <Switch checked={isDarkMode} onCheckedChange={handleThemeToggle} />
                        </div>
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
            <HelpDialog
                open={helpOpen}
                onOpenChange={setHelpOpen}
            />
        </>
    )
}