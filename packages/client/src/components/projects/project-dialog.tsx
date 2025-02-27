import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateProject, useUpdateProject, useGetProject, useSyncProject } from "@/hooks/api/use-projects-api"
import { useEffect, useState } from "react"
import { CreateProjectBody } from "shared/index"
import { useUpdateActiveProjectTab } from "@/zustand/updaters"

type ProjectDialogProps = {
    open: boolean
    projectId: string | null
    onOpenChange: (open: boolean) => void
}

export function ProjectDialog({ open, projectId, onOpenChange }: ProjectDialogProps) {
    const navigate = useNavigate()
    const updateActiveProjectTab = useUpdateActiveProjectTab()
    const [formData, setFormData] = useState<CreateProjectBody>({
        name: "",
        description: "",
        path: "",
    })

    const { mutate: createProject, isPending: isCreating } = useCreateProject()
    const { mutate: updateProject, isPending: isUpdating } = useUpdateProject()
    const { data: projectData } = useGetProject(projectId ?? "")

    // We'll use this state to know when we have a newly created project to sync
    const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null)
    const { mutate: syncProject } = useSyncProject(newlyCreatedProjectId ?? "")

    useEffect(() => {
        if (projectData?.project && projectId) {
            setFormData({
                name: projectData.project.name,
                description: projectData.project.description ?? undefined,
                path: projectData.project.path,
            })
        } else {
            setFormData({
                name: "",
                description: "",
                path: "",
            })
        }
    }, [projectData, projectId])

    // When newlyCreatedProjectId is set, we sync and then navigate
    useEffect(() => {
        if (newlyCreatedProjectId) {
            syncProject(undefined, {
                onSuccess: () => {
                    navigate({ to: '/projects' })
                    onOpenChange(false)
                }
            })
        }
    }, [newlyCreatedProjectId, syncProject, navigate, onOpenChange])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (projectId) {
            // Editing existing project
            updateProject({ id: projectId, updates: formData }, {
                onSuccess: () => {
                    onOpenChange(false)
                }
            })
        } else {
            // Creating new project
            createProject(formData, {
                onSuccess: (response) => {
                    if (response.project) {
                        // Set newly created project as current
                        updateActiveProjectTab(prev => ({
                            ...prev,
                            selectedProjectId: response?.project?.id || null,
                            selectedFiles: [],
                            selectedPrompts: []
                        }))
                        // Store the newly created project id to trigger sync in useEffect
                        setNewlyCreatedProjectId(response.project.id)
                    }
                }
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{projectId ? "Edit Project" : "New Project"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="path">Path</Label>
                            <Input
                                id="path"
                                value={formData.path}
                                onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isCreating || isUpdating}>
                            {projectId ? "Save Changes" : "Create Project"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}