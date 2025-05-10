import React, {
    useEffect,
    useRef,
    useMemo,
} from 'react';
import { cn } from '@/lib/utils';

interface SlidingSidebarProps {
    children: React.ReactNode;
    width?: number;
    side?: 'left' | 'right';
    isOpen: boolean;
    onClose: () => void;
}

/** A sliding sidebar component that can appear from the left or right, with click-outside and escape-key to close. */
export function SlidingSidebar({
    children,
    width = 300,
    side = 'left',
    isOpen,
    onClose,
}: SlidingSidebarProps) {
    const sidebarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                isOpen &&
                sidebarRef.current &&
                !sidebarRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        }
        const timerId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timerId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, side]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const computedTransform = useMemo(() => {
        if (!isOpen) {
            return side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
        }
        return 'translateX(0)';
    }, [isOpen, side, width]);

    return (
        <>
            <div
                ref={sidebarRef}
                className={cn(
                    'fixed top-0 h-full shadow-lg transition-transform duration-300 ease-in-out flex flex-col bg-background',
                    side === 'left' ? 'border-r left-0' : 'border-l right-0'
                )}
                style={{
                    width,
                    zIndex: 40,
                    transform: computedTransform,
                }}
                aria-hidden={!isOpen}
            >
                <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto h-full">
                    {children}
                </div>
            </div>
        </>
    );
}