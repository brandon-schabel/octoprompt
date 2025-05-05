import React from "react";
import { useLinkFilesToTicket } from "../../hooks/api/use-tickets-api";
import { ProjectFile } from "@/hooks/generated";

interface TicketAttachmentsPanelProps {
    ticketId: string;
    projectFiles: ProjectFile[];
}

export function TicketAttachmentsPanel({ ticketId, projectFiles }: TicketAttachmentsPanelProps) {
    const [selectedFiles, setSelectedFiles] = React.useState<string[]>([]);
    const { mutateAsync: linkFiles, isPending } = useLinkFilesToTicket();

    function toggleFile(fileId: string) {
        setSelectedFiles((prev) =>
            prev.includes(fileId)
                ? prev.filter((id) => id !== fileId)
                : [...prev, fileId]
        );
    }

    async function handleLink() {
        try {
            await linkFiles({ ticketId, fileIds: selectedFiles });
            alert("Files linked successfully!");
        } catch (err) {
            console.error("Failed to link files:", err);
        }
    }

    return (
        <div className="mt-4 border p-3 rounded space-y-2">
            <h3 className="font-semibold">Attach Files</h3>
            <div className="max-h-40 overflow-auto border rounded p-2">
                {projectFiles.map((file) => {
                    const checked = selectedFiles.includes(file.id);
                    return (
                        <label key={file.id} className="block cursor-pointer">
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFile(file.id)}
                            />
                            <span className="ml-2">{file.name}</span>
                        </label>
                    );
                })}
            </div>
            <button
                onClick={handleLink}
                disabled={isPending || selectedFiles.length === 0}
                className="bg-green-500 text-white px-4 py-1 rounded"
            >
                {isPending ? "Linking..." : "Link Selected Files"}
            </button>
        </div>
    );
}