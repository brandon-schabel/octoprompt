import { useApi } from '@/hooks/use-api';
import { useState, useRef, useCallback, useEffect } from 'react'

type UseWhisperTranscriptionOptions = {
    chunkSizeMs?: number;
    prompt?: string;
    debug?: boolean;
    apiEndpoint?: string; // API endpoint to send the audio file to, defaults to '/api/ai/whisper-stream'
    audioConstraints?: MediaTrackConstraints; // Additional constraints for audio
    audioBitsPerSecond?: number;
    mimeTypes?: string[];
}

type UseWhisperTranscriptionReturn = {
    transcript: string;
    isRecording: boolean;
    isTranscribing: boolean;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    error: Error | null;
    recordedBlob: Blob | null;
    recordedUrl: string | null;
}

/**
 * A custom hook that handles:
 * - Recording audio via MediaRecorder
 * - Stopping and creating a Blob of the recorded audio
 * - Sending the audio to a Whisper transcription endpoint and receiving a transcription
 * - Providing debug logging if needed
 */
export function useWhisperTranscription({
    chunkSizeMs = 5000,
    prompt = '',
    debug = false,
    apiEndpoint = '/api/ai/whisper-stream',
    audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
    },
    audioBitsPerSecond = 128000,
    mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav'
    ],
}: UseWhisperTranscriptionOptions): UseWhisperTranscriptionReturn {
    const [isRecording, setIsRecording] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const [transcript, setTranscript] = useState('')
    const [error, setError] = useState<Error | null>(null)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
    const { api } = useApi()

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const log = useCallback((message: string, data?: any) => {
        if (!debug) return
        if (data !== undefined) {
            console.log(`[useWhisperTranscription] ${message}`, data)
        } else {
            console.log(`[useWhisperTranscription] ${message}`)
        }
    }, [debug])

    // Cleanup object URL on unmount or whenever recordedBlob changes
    useEffect(() => {
        if (recordedUrl) {
            return () => {
                URL.revokeObjectURL(recordedUrl)
            }
        }
    }, [recordedUrl])

    const getSupportedMimeType = useCallback((): string => {
        const supported = mimeTypes.find(type => MediaRecorder.isTypeSupported(type))
        return supported ?? 'audio/webm;codecs=opus'
    }, [mimeTypes])

    const startRecording = useCallback(async () => {
        log('Attempting to start recording...')
        setError(null)
        setTranscript('')
        setRecordedBlob(null)
        setRecordedUrl(null)
        chunksRef.current = []

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
            const mimeType = getSupportedMimeType()
            const options = { mimeType, audioBitsPerSecond }

            const mediaRecorder = new MediaRecorder(stream, options)
            mediaRecorderRef.current = mediaRecorder

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data)
                    log('Received audio chunk', e.data.size)
                }
            }

            mediaRecorder.onerror = ((event: Event) => {
                const mediaRecorderError = (event.target as MediaRecorder).onerror;
                log('MediaRecorder error');
                setError(new Error('MediaRecorder error occurred'));
            }) as EventListener;

            mediaRecorder.onstart = () => {
                log('MediaRecorder started')
            }

            mediaRecorder.start(chunkSizeMs)
            setIsRecording(true)
            log('Recording started successfully')
        } catch (err: any) {
            log('Failed to start recording', err)
            setError(err)
        }
    }, [audioConstraints, audioBitsPerSecond, chunkSizeMs, getSupportedMimeType, log])

    const stopRecording = useCallback(() => {
        const mediaRecorder = mediaRecorderRef.current
        if (!mediaRecorder) {
            log('No active recorder to stop')
            return
        }

        if (mediaRecorder.state === 'recording') {
            mediaRecorder.onstop = async () => {
                setIsRecording(false)
                log('Recorder stopped')

                if (chunksRef.current.length === 0) {
                    const err = new Error('No audio data recorded')
                    setError(err)
                    log('No audio data recorded', err)
                    return
                }

                // Create a blob from all recorded chunks
                const mimeType = mediaRecorder.mimeType
                const blob = new Blob(chunksRef.current, { type: mimeType })
                setRecordedBlob(blob)
                const url = URL.createObjectURL(blob)
                setRecordedUrl(url)
                log('Final blob created', blob.size)

                // Automatically send to the transcription endpoint
                setIsTranscribing(true)
                try {
                    const formData = new FormData()
                    formData.append('audio', blob, `recording.${mimeType.split('/')[1]}`)
                    if (prompt) {
                        formData.append('prompt', prompt)
                    }

                    const response = await api.request(apiEndpoint, {
                        method: 'POST',
                        body: formData,
                    })

                    if (!response.ok) {
                        throw new Error(`Transcription request failed with status ${response.status}`)
                    }

                    const result = await response.json() as {
                        text: string
                    }
                    log('Transcription result', result)
                    if (typeof result?.text === 'string') {
                        setTranscript(result.text)
                    } else {
                        setError(new Error('No transcript found in the response'))
                    }
                } catch (err: any) {
                    log('Transcription error', err)
                    setError(err)
                } finally {
                    setIsTranscribing(false)
                }
            }

            log('Stopping MediaRecorder...')
            mediaRecorder.stop()
            mediaRecorder.stream.getTracks().forEach(track => track.stop())
        }
    }, [apiEndpoint, log, prompt])

    return {
        transcript,
        isRecording,
        isTranscribing,
        startRecording,
        stopRecording,
        error,
        recordedBlob,
        recordedUrl
    }
}