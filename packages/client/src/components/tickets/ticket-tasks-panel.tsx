import React, { useState } from "react";
import { useListTasks, useCreateTask, useUpdateTask, useDeleteTask, useReorderTasks, useAutoGenerateTasks } from "../../hooks/api/use-tickets-api";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ArrowDown, ArrowUp, CheckSquare, Copy, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { useCopyClipboard } from "@/hooks/utility-hooks/use-copy-clipboard";
import { TicketTask } from "shared/schema";
import { toast } from "sonner";

interface TicketTasksPanelProps {
    ticketId: string;
    overview: string;
}

/**
 * Utility to format tasks in different ways:
 * - Markdown (checkbox list)
 * - Bulleted
 * - Comma-separated
 */
function formatTasks(mode: "markdown" | "bulleted" | "comma", tasks: TicketTask[]): string {
    switch (mode) {
        case "markdown":
            return tasks
                .map((t) => `- [${t.done ? "x" : " "}] ${t.content}`)
                .join("\n");
        case "bulleted":
            return tasks.map((t) => `• ${t.content}`).join("\n");
        case "comma":
            return tasks.map((t) => t.content).join(", ");
        default:
            return tasks.map((t) => t.content).join("\n");
    }
}

export function TicketTasksPanel({ ticketId, overview }: TicketTasksPanelProps) {
    const { data, isLoading } = useListTasks(ticketId);
    const createTaskMut = useCreateTask();
    const updateTaskMut = useUpdateTask();
    const deleteTaskMut = useDeleteTask();
    const reorderMut = useReorderTasks();
    const autoGenMut = useAutoGenerateTasks();

    const [newTaskContent, setNewTaskContent] = useState("");
    const { copyToClipboard } = useCopyClipboard();

    const tasks = data?.tasks ?? [];

    const handleCreateTask = async () => {
        if (!newTaskContent.trim()) return;
        await createTaskMut.mutateAsync({ ticketId, content: newTaskContent });
        setNewTaskContent("");
    };

    const handleToggleDone = (task: TicketTask) => {
        updateTaskMut.mutate({
            ticketId,
            taskId: task.id,
            updates: { done: !task.done },
        });
    };

    const handleDeleteTask = (task: TicketTask) => {
        deleteTaskMut.mutate({ ticketId, taskId: task.id });
    };

    const moveTaskUp = (idx: number) => {
        if (idx <= 0) return;
        const newOrder = [...tasks];
        // swap tasks
        const temp = newOrder[idx];
        newOrder[idx] = newOrder[idx - 1];
        newOrder[idx - 1] = temp;
        // reassign orderIndex
        reorderMut.mutate({
            ticketId,
            tasks: newOrder.map((t, i) => ({ taskId: t.id, orderIndex: i })),
        });
    };

    const moveTaskDown = (idx: number) => {
        if (idx >= tasks.length - 1) return;
        const newOrder = [...tasks];
        const temp = newOrder[idx];
        newOrder[idx] = newOrder[idx + 1];
        newOrder[idx + 1] = temp;
        reorderMut.mutate({
            ticketId,
            tasks: newOrder.map((t, i) => ({ taskId: t.id, orderIndex: i })),
        });
    };

    const handleCopyTasks = (mode: "markdown" | "bulleted" | "comma") => {
        const formatted = formatTasks(mode, tasks);
        copyToClipboard(formatted, {
            successMessage: `Tasks copied as ${mode}!`,
            errorMessage: "Failed to copy tasks",
        });
    };

    const handleAutoGenerateTasks = async () => {
        // Calls the auto-generate endpoint
        await autoGenMut.mutateAsync({ ticketId });
        toast.success("Tasks generated from overview!");
    };

    return (
        <div className="border rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Tasks</h3>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAutoGenerateTasks}
                        disabled={autoGenMut.isPending}
                    >
                        <RefreshCcw className="h-3 w-3 mr-1" />
                        {autoGenMut.isPending ? "Generating..." : "Auto-Generate"}
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Copy className="h-3 w-3 mr-1" />
                                Copy Tasks
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleCopyTasks("markdown")}>
                                Copy as Markdown
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyTasks("bulleted")}>
                                Copy as Bulleted List
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyTasks("comma")}>
                                Copy as Comma-Separated
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* New Task Input */}
            <div className="flex items-center space-x-2">
                <Input
                    placeholder="Add a new task..."
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleCreateTask();
                        }
                    }}
                />
                <Button onClick={handleCreateTask}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {/* Tasks List */}
            <div className="space-y-2 max-h-64 overflow-auto">
                {isLoading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
                {(!isLoading && tasks.length === 0) && (
                    <p className="text-sm text-muted-foreground">No tasks yet. Add some above.</p>
                )}
                {tasks.map((task, idx) => (
                    <div
                        key={task.id}
                        className="flex items-center justify-between p-2 border rounded"
                    >
                        <div className="flex items-center space-x-3 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => handleToggleDone(task)}
                                className="flex items-center justify-center"
                            >
                                <CheckSquare
                                    className={`h-4 w-4 ${
                                        task.done ? "text-green-600" : "text-gray-400"
                                    }`}
                                />
                            </button>
                            <span
                                className={`text-sm whitespace-pre-wrap ${
                                    task.done ? "line-through text-gray-400" : ""
                                }`}
                            >
                                {task.content}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveTaskUp(idx)}
                                disabled={idx <= 0}
                            >
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveTaskDown(idx)}
                                disabled={idx >= tasks.length - 1}
                            >
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTask(task)}
                            >
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 