import React, { useMemo } from "react";
import { computeLineDiff } from "./compute-line-diff";

interface DiffViewerProps {
    oldValue: string;
    newValue: string;
}

/**
 * Renders a simple unified diff view with lines for additions/removals.
 * Common lines are shown without color. "Removed" lines in red, "Added" lines in green.
 */
export function DiffViewer({ oldValue, newValue }: DiffViewerProps) {
    const chunks = useMemo(() => computeLineDiff(oldValue, newValue), [oldValue, newValue]);

    return (
        <div className="w-full overflow-auto max-h-[300px] text-sm font-mono bg-muted p-3 rounded-md">
            {chunks.map((chunk, idx) => {
                if (chunk.type === "common") {
                    return (
                        <div key={idx} className="text-foreground">
                            {"  " + chunk.content}
                        </div>
                    );
                }
                if (chunk.type === "add") {
                    return (
                        <div key={idx} className="text-green-600 whitespace-pre-wrap">
                            + {chunk.content}
                        </div>
                    );
                }
                return (
                    <div key={idx} className="text-red-600 whitespace-pre-wrap">
                        - {chunk.content}
                    </div>
                );
            })}
        </div>
    );
}