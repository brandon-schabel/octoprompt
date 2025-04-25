import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings2Icon } from 'lucide-react';
import { useChatModelParams } from '../hooks/use-chat-model-params';
import { useSynchronizedState } from '@/hooks/api/global-state/global-state-utility-hooks';

/**
 * A popover for adjusting advanced model parameters (temperature, max_tokens, etc.)
 * Now with a debounce so we don't frequently re-render the entire app.
 */
export function ModelSettingsPopover() {
    const [open, setOpen] = useState(false);

    // Get the model parameters and setter functions from the hook
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

    // Use synchronized state hooks for each parameter with proper debouncing
    const [temperature, updateTemperature] = useSynchronizedState(
        settings.temperature,
        setTemperature,
        300,
        isTempDisabled
    );

    const [maxTokens, updateMaxTokens] = useSynchronizedState(
        settings.max_tokens,
        setMaxTokens
    );

    const [topP, updateTopP] = useSynchronizedState(
        settings.top_p,
        setTopP
    );

    const [freqPenalty, updateFreqPenalty] = useSynchronizedState(
        settings.frequency_penalty,
        setFreqPenalty
    );

    const [presPenalty, updatePresPenalty] = useSynchronizedState(
        settings.presence_penalty,
        setPresPenalty
    );

    const [stream, updateStream] = useSynchronizedState(
        settings.stream,
        setStream
    );

    function handleTempChange(value: number[]) {
        updateTemperature(value[0]);
    }

    function handleMaxTokensChange(value: number[]) {
        updateMaxTokens(value[0]);
    }

    function handleTopPChange(value: number[]) {
        updateTopP(value[0]);
    }

    function handleFreqPenaltyChange(value: number[]) {
        updateFreqPenalty(value[0]);
    }

    function handlePresPenaltyChange(value: number[]) {
        updatePresPenalty(value[0]);
    }

    function handleStreamToggle(checked: boolean) {
        updateStream(checked);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                    <Settings2Icon className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-4">
                    <h4 className="font-medium leading-none mb-3">Model Settings</h4>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="temperature">Temperature: {temperature.toFixed(2)}</Label>
                        </div>
                        <Slider
                            id="temperature"
                            disabled={isTempDisabled}
                            min={0}
                            max={2}
                            step={0.01}
                            value={[temperature]}
                            onValueChange={handleTempChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="max_tokens">Max Tokens: {maxTokens}</Label>
                        </div>
                        <Slider
                            id="max_tokens"
                            min={256}
                            max={4096}
                            step={1}
                            value={[maxTokens]}
                            onValueChange={handleMaxTokensChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="top_p">Top P: {topP.toFixed(2)}</Label>
                        </div>
                        <Slider
                            id="top_p"
                            min={0}
                            max={1}
                            step={0.01}
                            value={[topP]}
                            onValueChange={handleTopPChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="frequency_penalty">Frequency Penalty: {freqPenalty.toFixed(2)}</Label>
                        </div>
                        <Slider
                            id="frequency_penalty"
                            min={-2}
                            max={2}
                            step={0.01}
                            value={[freqPenalty]}
                            onValueChange={handleFreqPenaltyChange}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="presence_penalty">Presence Penalty: {presPenalty.toFixed(2)}</Label>
                        </div>
                        <Slider
                            id="presence_penalty"
                            min={-2}
                            max={2}
                            step={0.01}
                            value={[presPenalty]}
                            onValueChange={handlePresPenaltyChange}
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="stream"
                            checked={stream}
                            onCheckedChange={handleStreamToggle}
                        />
                        <Label htmlFor="stream">Enable Streaming</Label>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}