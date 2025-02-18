import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { useChatModelParams } from "../hooks/use-chat-model-params";
import { useDebounce } from "@/hooks/utility-hooks/use-debounce";
import { EditableNumberDisplay } from "./editable-number-display";
import { modelsTempNotAllowed } from "shared";

/**
 * A popover for adjusting advanced model parameters (temperature, max_tokens, etc.)
 * Now with a debounce so we don't frequently re-render the entire app.
 */
export function ModelSettingsPopover() {
    const [open, setOpen] = useState(false);

    // Get the isTempDisabled flag from the hook
    const {
        settings,
        setTemperature,
        setMaxTokens,
        setTopP,
        setFreqPenalty,
        setPresPenalty,
        setStream,
        isTempDisabled,
    } = useChatModelParams();

    /**
     * 2) Local states that reflect slider positions.
     *    We initialize them from the global settings, then
     *    only update the global state after a short debounce.
     */
    const [localTemperature, setLocalTemperature] = useState(settings.temperature);
    const [localMaxTokens, setLocalMaxTokens] = useState(settings.max_tokens);
    const [localTopP, setLocalTopP] = useState(settings.top_p);
    const [localFreqPenalty, setLocalFreqPenalty] = useState(settings.frequency_penalty);
    const [localPresPenalty, setLocalPresPenalty] = useState(settings.presence_penalty);
    const [localStream, setLocalStream] = useState(settings.stream);

    /**
     * 3) Keep local states in sync with global changes (in case
     *    something else updates them externally).
     */
    useEffect(() => {
        setLocalTemperature(settings.temperature);
    }, [settings.temperature]);

    useEffect(() => {
        setLocalMaxTokens(settings.max_tokens);
    }, [settings.max_tokens]);

    useEffect(() => {
        setLocalTopP(settings.top_p);
    }, [settings.top_p]);

    useEffect(() => {
        setLocalFreqPenalty(settings.frequency_penalty);
    }, [settings.frequency_penalty]);

    useEffect(() => {
        setLocalPresPenalty(settings.presence_penalty);
    }, [settings.presence_penalty]);

    useEffect(() => {
        setLocalStream(settings.stream);
    }, [settings.stream]);

    /**
     * 4) Debounce the global set* calls
     */
    const debouncedUpdateTemperature = useDebounce((val: number) => setTemperature(val), 500);
    const debouncedUpdateMaxTokens = useDebounce((val: number) => setMaxTokens(val), 500);
    const debouncedUpdateTopP = useDebounce((val: number) => setTopP(val), 500);
    const debouncedUpdateFreqPenalty = useDebounce((val: number) => setFreqPenalty(val), 500);
    const debouncedUpdatePresPenalty = useDebounce((val: number) => setPresPenalty(val), 500);
    const debouncedUpdateStream = useDebounce((val: boolean) => setStream(val), 500);

    /**
     * 5) Handle slider/toggle changes:
     *    - Update local state immediately so the UI is responsive
     *    - Debounce the global state update to limit re-renders
     */
    function handleTempChange(value: number[]) {
        const next = value[0];
        setLocalTemperature(next);
        debouncedUpdateTemperature(next);
    }

    function handleMaxTokensChange(value: number[]) {
        const next = value[0];
        setLocalMaxTokens(next);
        debouncedUpdateMaxTokens(next);
    }

    function handleTopPChange(value: number[]) {
        const next = value[0];
        setLocalTopP(next);
        debouncedUpdateTopP(next);
    }

    function handleFreqPenaltyChange(value: number[]) {
        const next = value[0];
        setLocalFreqPenalty(next);
        debouncedUpdateFreqPenalty(next);
    }

    function handlePresPenaltyChange(value: number[]) {
        const next = value[0];
        setLocalPresPenalty(next);
        debouncedUpdatePresPenalty(next);
    }

    function handleStreamToggle(checked: boolean) {
        setLocalStream(checked);
        debouncedUpdateStream(checked);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                    <Settings className="h-4 w-4" />
                    Model Settings
                </Button>
            </PopoverTrigger>

            <PopoverContent className="p-4 w-[320px] space-y-4">
                <div className="flex flex-col gap-3">
                    <h3 className="font-semibold text-sm">Model Parameters</h3>

                    {/* Temperature */}
                    <div className="flex items-center justify-between">
                        <Label 
                            htmlFor="temp" 
                            className={`text-sm w-24 ${isTempDisabled ? 'text-muted-foreground' : ''}`}
                        >
                            Temperature
                            {isTempDisabled && (
                                <span className="block text-xs text-muted-foreground">
                                    Not configurable
                                </span>
                            )}
                        </Label>
                        <div className="flex-1 ml-2">
                            <div className="flex items-center">
                                <Slider
                                    id="temp"
                                    value={[localTemperature]}
                                    onValueChange={handleTempChange}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    disabled={isTempDisabled}
                                    className={isTempDisabled ? 'opacity-50' : ''}
                                />
                                <EditableNumberDisplay
                                    value={localTemperature}
                                    onChange={(value) => handleTempChange([value])}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    formatValue={(val) => val.toFixed(2)}
                                    isDisabled={isTempDisabled}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Max Tokens */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="maxTokens" className="text-sm w-24">
                            Max Tokens
                        </Label>
                        <div className="flex-1 ml-2">
                            <div className="flex items-center">
                                <Slider
                                    id="maxTokens"
                                    value={[localMaxTokens]}
                                    onValueChange={handleMaxTokensChange}
                                    min={1}
                                    max={196000}
                                    step={1000}
                                />
                                <EditableNumberDisplay
                                    value={localMaxTokens}
                                    onChange={(value) => handleMaxTokensChange([value])}
                                    min={1}
                                    max={196000}
                                    step={1000}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Top P */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="topP" className="text-sm w-24">
                            Top P
                        </Label>
                        <div className="flex-1 ml-2">
                            <div className="flex items-center">
                                <Slider
                                    id="topP"
                                    value={[localTopP]}
                                    onValueChange={handleTopPChange}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                />
                                <EditableNumberDisplay
                                    value={localTopP}
                                    onChange={(value) => handleTopPChange([value])}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    formatValue={(val) => val.toFixed(2)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Frequency Penalty */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="freqPenalty" className="text-sm w-24">
                            Freq. Penalty
                        </Label>
                        <div className="flex-1 ml-2">
                            <div className="flex items-center">
                                <Slider
                                    id="freqPenalty"
                                    value={[localFreqPenalty]}
                                    onValueChange={handleFreqPenaltyChange}
                                    min={-2}
                                    max={2}
                                    step={0.01}
                                />
                                <EditableNumberDisplay
                                    value={localFreqPenalty}
                                    onChange={(value) => handleFreqPenaltyChange([value])}
                                    min={-2}
                                    max={2}
                                    step={0.01}
                                    formatValue={(val) => val.toFixed(2)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Presence Penalty */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="presPenalty" className="text-sm w-24">
                            Pres. Penalty
                        </Label>
                        <div className="flex-1 ml-2">
                            <div className="flex items-center">
                                <Slider
                                    id="presPenalty"
                                    value={[localPresPenalty]}
                                    onValueChange={handlePresPenaltyChange}
                                    min={-2}
                                    max={2}
                                    step={0.01}
                                />
                                <EditableNumberDisplay
                                    value={localPresPenalty}
                                    onChange={(value) => handlePresPenaltyChange([value])}
                                    min={-2}
                                    max={2}
                                    step={0.01}
                                    formatValue={(val) => val.toFixed(2)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Stream Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-muted/30">
                        <Label htmlFor="stream" className="text-sm">
                            Stream
                        </Label>
                        <Switch
                            id="stream"
                            checked={localStream}
                            onCheckedChange={handleStreamToggle}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}