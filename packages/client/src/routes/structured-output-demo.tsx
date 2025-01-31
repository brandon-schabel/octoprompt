import { useState } from "react";
import { useGenerateStructuredOutput } from "@/hooks/api/use-structured-output";
import { createFileRoute } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute('/structured-output-demo')({
    component: DemoGenerateName,
})

export function DemoGenerateName() {
    const [prompt, setPrompt] = useState("");
    const { mutateAsync: generateName, isPending } = useGenerateStructuredOutput("generateName");

    const handleClick = async () => {
        try {
            const result = await generateName({
                userMessage: `Create a short, unique name for: "${prompt}"`,
                systemMessage: "You are a naming assistant. Return JSON with { generatedName: string }.",
            });
            alert("Generated name: " + result.generatedName);
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

