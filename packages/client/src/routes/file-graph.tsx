/**
 * This file handles the dedicated page for the FileGraph visualization.
 * It provides a full-screen, immersive experience for exploring the project's file structure
 * as an interactive D3 visualization.
 * 
 * Most recent changes:
 * - Initial implementation of the dedicated file graph page
 * - Added project selection and navigation
 * - Connected with the FileGraph component for visualization
 * - Fixed import for useGetProject hook
 * - Fixed project data access pattern
 * - Added file tree construction logic
 * - Optimized to prevent unnecessary D3 re-renders
 * - Added direct use of React Query store for state changes
 * - Used memo and callback patterns to isolate D3 from React updates
 * - Separated file selection from file viewing to prevent graph re-renders
 * - Improved D3 internal state handling to avoid "spaghetti" rendering issues
 */

import { createFileRoute } from '@tanstack/react-router';
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useActiveProjectTab } from '@/zustand/selectors';
import { useGetProject, useGetProjectFiles } from '@/hooks/api/use-projects-api';
import { FileGraph, FileGraphRef } from '@/components/projects/file-panel/file-graph/file-graph';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye } from 'lucide-react';
import { buildFileTree } from '@/components/projects/utils/projects-utils';
import { FileViewerDialog } from '@/components/navigation/file-viewer-dialog';
import type { ProjectFile } from 'shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSelectedFiles } from '@/hooks/utility-hooks/use-selected-files';

export const Route = createFileRoute('/file-graph')({
    component: FileGraphPage,
});

// Create a memoized wrapper component to prevent D3 re-renders
const GraphWrapper = React.memo(({
    fileTree,
    projectRoot,
}: {
    fileTree: Record<string, any>;
    projectRoot: string;
}) => {
    const fileGraphRef = useRef<FileGraphRef>(null);

    // Use effect to focus graph only once
    useEffect(() => {
        setTimeout(() => {
            if (fileGraphRef.current) {
                fileGraphRef.current.focusGraph();
            }
        }, 200);
    }, []);

    return (
        <FileGraph
            ref={fileGraphRef}
            root={fileTree}
            projectRoot={projectRoot}
        />
    );
}, (prevProps, nextProps) => {
    // Custom comparison function to only re-render when the core data changes
    // We use a deep equality check for the root keys only to provide better stability
    return (
        prevProps.projectRoot === nextProps.projectRoot &&
        // Only do a shallow comparison of the file tree root keys
        Object.keys(prevProps.fileTree).length === Object.keys(nextProps.fileTree).length &&
        Object.keys(prevProps.fileTree).every(key => key in nextProps.fileTree)
    );
});

function FileGraphPage() {
    const navigate = useNavigate();
    const { tabData: activeProjectTabState } = useActiveProjectTab();
    const selectedProjectId = activeProjectTabState?.selectedProjectId;
    const queryClient = useQueryClient();

    // Refs to persist values across renders
    const projectIdRef = useRef<string | null>(null);

    // Get project data using TanStack Query
    const { data: projectResponse, isLoading: projectLoading } = useGetProject(selectedProjectId || '');
    const projectData = projectResponse?.project;

    // Get project files
    const { data: fileData, isLoading: filesLoading } = useGetProjectFiles(selectedProjectId || '');

    // Configure the query client for manual control if needed
    useEffect(() => {
        // Configure the query client to minimize re-renders
        if (selectedProjectId) {
            queryClient.setQueryDefaults(['projects', 'detail', selectedProjectId], {
                refetchOnWindowFocus: false,
                staleTime: 5 * 60 * 1000, // 5 minutes
            });

            queryClient.setQueryDefaults(['project-files', 'list', { projectId: selectedProjectId }], {
                refetchOnWindowFocus: false,
                staleTime: 5 * 60 * 1000, // 5 minutes
            });
        }
    }, [selectedProjectId, queryClient]);

    // Build file tree from files with advanced memoization
    const fileTree = useMemo(() => {
        if (!fileData?.files?.length) return {};
        return buildFileTree(fileData.files);
    }, [fileData?.files]);

    // Effect to update projectIdRef to track current project
    useEffect(() => {
        projectIdRef.current = selectedProjectId || null;
    }, [selectedProjectId]);

    // Get the selected files to determine what file to view
    const { selectedFiles } = useSelectedFiles();

    // File viewer state - isolated from D3 state
    const [viewerDialogOpen, setViewerDialogOpen] = useState(false);
    const [viewedFilePath, setViewedFilePath] = useState<string | null>(null);

    // Get viewed file directly from query cache when needed
    const viewedFile = useMemo(() => {
        if (!viewedFilePath || !fileData?.files) return null;
        return fileData.files.find(f => f.path === viewedFilePath) || null;
    }, [viewedFilePath, fileData?.files]);

    // Get currently selected file
    const selectedFile = useMemo(() => {
        if (!selectedFiles || selectedFiles.length === 0 || !fileData?.files) return null;
        // Find the first selected file
        return fileData.files.find(f => selectedFiles.includes(f.path)) || null;
    }, [selectedFiles, fileData?.files]);

    // Handle back navigation
    const handleBack = useCallback(() => {
        navigate({ to: '/projects' });
    }, [navigate]);

    // Close file viewer
    const closeFileViewer = useCallback(() => {
        setViewerDialogOpen(false);
    }, []);

    // View currently selected file
    const viewSelectedFile = useCallback(() => {
        if (selectedFile) {
            setViewedFilePath(selectedFile.path);
            setViewerDialogOpen(true);
        }
    }, [selectedFile]);

    if (projectLoading || filesLoading) {
        return <div className="flex items-center justify-center h-screen">Loading project...</div>;
    }

    if (!projectData || !fileData || !fileData.files.length) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <div className="mb-4">No project selected or file tree is empty</div>
                <Button onClick={handleBack}>Back to Projects</Button>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col h-screen w-full">
                <div className="flex items-center p-4 border-b">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="mr-2"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <h1 className="text-xl font-semibold">{projectData.name} - File Visualization</h1>

                    {/* Add button to view selected file */}
                    <div className="ml-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={viewSelectedFile}
                            disabled={!selectedFile}
                            className="flex items-center"
                        >
                            <Eye className="h-4 w-4 mr-2" />
                            View Selected File
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden">
                    {fileTree && Object.keys(fileTree).length > 0 && (
                        <GraphWrapper
                            fileTree={fileTree}
                            projectRoot={projectData.path || ''}
                        />
                    )}
                </div>
            </div>

            {viewedFile && viewerDialogOpen && (
                <FileViewerDialog
                    key={viewedFile.path}
                    open={viewerDialogOpen}
                    viewedFile={viewedFile}
                    onClose={closeFileViewer}
                />
            )}
        </>
    );
} 