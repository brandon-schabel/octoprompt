import { useState } from "react";
import { useGenerateStructuredData, } from "@/hooks/api/use-gen-ai-api";
import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@ui";
import { Button } from "@ui";

export const Route = createFileRoute('/structured-output-demo')({
    component: DemoGenerateName,
})

export function DemoGenerateName() {
    const [prompt, setPrompt] = useState("");
    const { mutateAsync: generateName, isPending } = useGenerateStructuredData("filenameSuggestion");

    const handleClick = async () => {
        try {
            const result = await generateName({
                prompt: `Create a short, unique name for: "${prompt}"`,
            })

            console.log({ result })
            alert("Generated name: " + result.data.output.suggestions.join(','));
        } catch (error) {
            console.error("Failed to generate name:", error);
            alert("Error generating name. Check console for details.");
        }
    };

    return (
        <div>
            <h2>Generate a Name</h2>
            <Input
                type="text"
                placeholder="Enter something to name..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
            />
            <Button onClick={handleClick} disabled={isPending}>
                {isPending ? "Generating..." : "Generate Name"}
            </Button>
        </div>
    );
}

