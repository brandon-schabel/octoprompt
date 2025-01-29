import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type EditableNumberDisplayProps = {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
    formatValue?: (value: number) => string;
};

export function EditableNumberDisplay({
    value,
    onChange,
    min,
    max,
    step = 1,
    className,
    formatValue = (val) => val.toString()
}: EditableNumberDisplayProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        const newValue = parseFloat(inputValue);
        
        if (!isNaN(newValue)) {
            let validValue = newValue;
            if (min !== undefined) validValue = Math.max(min, validValue);
            if (max !== undefined) validValue = Math.min(max, validValue);
            if (step) validValue = Math.round(validValue / step) * step;
            
            onChange(validValue);
        } else {
            setInputValue(value.toString());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur();
        } else if (e.key === "Escape") {
            setInputValue(value.toString());
            setIsEditing(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    return (
        <div 
            className={cn(
                "ml-2 w-16 text-right text-xs tabular-nums",
                className
            )}
        >
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="number"
                    value={inputValue}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    min={min}
                    max={max}
                    step={step}
                    className="w-full rounded border border-input bg-background px-1 py-0.5 text-right text-xs"
                />
            ) : (
                <span 
                    onDoubleClick={handleDoubleClick}
                    className="cursor-text"
                >
                    {formatValue(value)}
                </span>
            )}
        </div>
    );
} 