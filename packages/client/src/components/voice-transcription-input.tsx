import React, { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { AdaptiveChatInput } from "@/components/adaptive-chat-input"
import { Progress } from "@/components/ui/progress"
import { useWhisperTranscription } from "@/hooks/api/use-whisper-transcription"

type VoiceTranscriptionInputProps = {
    debug?: boolean;
    onTranscriptionComplete?: (transcript: string) => void;
}

export function VoiceTranscriptionInput({ 
    debug = false,
    onTranscriptionComplete 
}: VoiceTranscriptionInputProps) {
    const [progress, setProgress] = useState(0)

    const log = useCallback((message: string, data?: unknown) => {
        if (!debug) return;
        if (data) {
            console.log(`[Voice Input] ${message}`, data);
        } else {
            console.log(`[Voice Input] ${message}`);
        }
    }, [debug]);

    const { 
        transcript, 
        isRecording, 
        startRecording, 
        stopRecording,
        isTranscribing,
        error,
        recordedBlob 
    } = useWhisperTranscription({
        chunkSizeMs: 5000,
        prompt: "The user is discussing technical topics and code.",
        debug
    });

    // Update progress bar during recording/transcribing
    React.useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress(prev => Math.min(prev + 1, 95));
            }, 100);
        } else if (isTranscribing) {
            setProgress(96);
        } else if (transcript) {
            setProgress(100);
            onTranscriptionComplete?.(transcript);
        } else {
            setProgress(0);
        }
        return () => clearInterval(interval);
    }, [isRecording, isTranscribing, transcript, onTranscriptionComplete]);

    const handleStartRecording = async () => {
        log('Starting recording...');
        try {
            await startRecording();
            log('Recording started successfully');
        } catch (error) {
            log('Failed to start recording', error);
        }
    };

    const handleStopRecording = () => {
        log('Stopping recording...');
        stopRecording();
        log('Recording stopped');
    };

    return (
        <div className="space-y-4">
            <AdaptiveChatInput
                value={transcript}
                onChange={() => {}} // Transcript is read-only
                placeholder={
                    isRecording ? "Recording in progress..." :
                    isTranscribing ? "Transcribing..." :
                    error ? "Error occurred during recording/transcription" :
                    "Your transcribed text will appear here..."
                }
                disabled={isRecording || isTranscribing}
            />
            
            {(isRecording || isTranscribing || progress > 0) && (
                <Progress value={progress} className="w-full" />
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    {!isRecording && (
                        <Button 
                            onClick={handleStartRecording}
                            disabled={isTranscribing}
                        >
                            Start Recording
                        </Button>
                    )}
                    {isRecording && (
                        <Button 
                            onClick={handleStopRecording} 
                            variant="destructive"
                        >
                            Stop Recording
                        </Button>
                    )}
                </div>
                
                {error && (
                    <p className="text-sm text-red-500">
                        {error.message}
                    </p>
                )}
                
                {recordedBlob && !isTranscribing && (
                    <p className="text-sm text-gray-500">
                        Recording size: {(recordedBlob.size / 1024).toFixed(2)} KB
                    </p>
                )}
            </div>
        </div>
    )
}