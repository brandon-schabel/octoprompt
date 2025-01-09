import { ProviderPlugin } from "../../provider-plugin";
import { StreamParams } from "../streaming-types";

export class OllamaPlugin implements ProviderPlugin {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async prepareRequest(params: StreamParams) {
        const { userMessage, options } = params;

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: options.model || "llama3:latest",
                messages: [{ role: "user", content: userMessage }],
                stream: true,
                ...options, // pass along other config
            }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        return response.body.getReader();
    }

    parseServerSentEvent(line: string): string | null {
        // Each line is JSON
        // We can ignore lines that don't parse.
        // Return "[DONE]" if there's some condition for done (if needed).
        try {
            const data = JSON.parse(line);
            const chunk = data?.message?.content || "";
            return chunk || null;
        } catch {
            // If partial or invalid JSON
            return null;
        }
    }
}