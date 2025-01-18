import OpenAI from "openai";
import { ProviderKeyService } from "./provider-key-service";
import { ProviderKeysConfig } from "@bnk/ai";

export class WhisperService {
    private providerKeyService: ProviderKeyService

    private async initOpenAI() {
        const key = await this.getKey();
        return new OpenAI({
            apiKey: key,
        });
    }

    constructor() {
        this.providerKeyService = new ProviderKeyService();
    }


    private async getKey(): Promise<string> {
        const keys = await this.providerKeyService.listKeys()
        return keys.find(k => k.provider === "openai")?.key ?? "";
    }

    /** Example: transcribe a file via OpenAI/Whisper */
    async transcribeAudioFile(file: File, prompt?: string): Promise<string> {
        const openai = await this.initOpenAI();


        const transcriptionFile = new File([await file.arrayBuffer()], "audio.webm", {
            type: "audio/webm",
        });
        return openai.audio.transcriptions.create({
            file: transcriptionFile,
            model: "whisper-1",
            prompt: prompt ?? undefined,
            response_format: "text",
        });
    }


    /** Example: translate an audio file via OpenAI/Whisper */
    async translateAudioFile(file: File, prompt?: string): Promise<string> {
        const openai = await this.initOpenAI();

        const translationFile = new File([await file.arrayBuffer()], "audio.webm", {
            type: "audio/webm",
        });
        return openai.audio.translations.create({
            file: translationFile,
            model: "whisper-1",
            prompt: prompt ?? undefined,
            response_format: "text",
        });
    }
}