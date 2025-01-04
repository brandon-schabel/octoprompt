import React, {
    useEffect,
    useRef,
    useState,
    MouseEvent as ReactMouseEvent,
    useMemo,
} from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronsLeft, ChevronsRight, X, LucideIcon } from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';

type IconProps = {
    openIcon?: LucideIcon;
    closeIcon?: LucideIcon;
    closeButtonIcon?: LucideIcon;
}

interface SlidingSidebarProps {
    children: React.ReactNode;
    width?: number;
    localStorageKey?: string;
    side?: 'left' | 'right';
    icons?: IconProps;
}

export function SlidingSidebar({
    children,
    width = 300,
    localStorageKey = 'slidingSidebarCollapsed',
    side = 'left',
    icons = {},
}: SlidingSidebarProps) {
    const {
        openIcon: CloseIcon = side === 'left' ? ChevronsRight : ChevronsLeft,
        closeIcon: OpenIcon = side === 'left' ? ChevronsLeft : ChevronsRight,
        closeButtonIcon: CloseButtonIcon = X,
    } = icons;
    const [isCollapsed, setIsCollapsed] = useLocalStorage(localStorageKey, false);
    const [isPreviewing, setIsPreviewing] = useState(false);

    // Draggable toggle button
    const [dragging, setDragging] = useState(false);

    // Track the initial mouse position and offset for x/y
    const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // x is always “distance from the edge” – left edge if side=left, right edge if side=right
    // y is the vertical position from the top
    const [buttonPosition, setButtonPosition] = useState(() => {
        if (typeof window !== 'undefined') {
            return {
                x: 40, // start ~20px from the chosen edge
                y: window.innerHeight / 2,
            };
        }
        return { x: 20, y: 300 };
    });

    const DRAG_THRESHOLD = 5;
    const MAX_EDGE_OFFSET = 50; // clamp to 50px from the left/right edge
    const PADDING_TOP_BOTTOM = 50; // clamp so we don't drag it offscreen

    const sidebarRef = useRef<HTMLDivElement>(null);

    // Utility for clamping a value between min and max
    function clamp(value: number, min: number, max: number) {
        return Math.max(min, Math.min(value, max));
    }

    // Keep isCollapsed in localStorage
    useEffect(() => {
        localStorage.setItem(localStorageKey, JSON.stringify(isCollapsed));
    }, [isCollapsed, localStorageKey]);

    // Close if clicked outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                !isCollapsed &&
                sidebarRef.current &&
                !sidebarRef.current.contains(e.target as Node)
            ) {
                setIsCollapsed(true);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCollapsed]);

    // Close if pressing Escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && !isCollapsed) {
                setIsCollapsed(true);
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCollapsed]);

    // Handle mouseDown on toggle
    const handleMouseDown = (e: ReactMouseEvent) => {
        setDragging(true);
        setMouseDownPos({ x: e.clientX, y: e.clientY });

        // For side=left, the buttonPosition.x is how far from left, so offset.x = e.clientX - that distance
        // For side=right, the buttonPosition.x is how far from right, so offset.x = (window.innerWidth - e.clientX) - that distance
        const offsetX =
            side === 'left'
                ? e.clientX - buttonPosition.x
                : (window.innerWidth - e.clientX) - buttonPosition.x;

        setOffset({
            x: offsetX,
            y: e.clientY - buttonPosition.y,
        });
    };

    // Drag logic
    useEffect(() => {
        function handleMouseMove(e: MouseEvent) {
            if (!dragging) return;

            // For side=left => newX is e.clientX - offset.x, clamped to [0, MAX_EDGE_OFFSET]
            // For side=right => newX is (window.innerWidth - e.clientX) - offset.x, clamped to [0, MAX_EDGE_OFFSET]
            const newX =
                side === 'left'
                    ? clamp(e.clientX - offset.x, 0, MAX_EDGE_OFFSET)
                    : clamp((window.innerWidth - e.clientX) - offset.x, 0, MAX_EDGE_OFFSET);

            const newY = clamp(e.clientY - offset.y, PADDING_TOP_BOTTOM, window.innerHeight - PADDING_TOP_BOTTOM);

            setButtonPosition({ x: newX, y: newY });
        }

        function handleMouseUp(e: MouseEvent) {
            if (!dragging) return;
            setDragging(false);

            const movedX = e.clientX - mouseDownPos.x;
            const movedY = e.clientY - mouseDownPos.y;
            const distance = Math.sqrt(movedX ** 2 + movedY ** 2);

            // If the mouse hardly moved, treat it as a toggle click
            if (distance < DRAG_THRESHOLD) {
                setIsCollapsed(prev => !prev);
            }
        }

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, offset, mouseDownPos, side]);

    // Decide the inline transform for the sliding sidebar itself
    const computedTransform = useMemo(() => {
        // If fully open
        if (!isCollapsed) return 'translateX(0)';

        // If collapsed but user is hovering => partial preview
        if (isPreviewing) {
            const previewDistance = width - 40; // how much to show
            return side === 'left'
                ? `translateX(-${previewDistance}px)`
                : `translateX(${previewDistance}px)`;
        }

        // Fully collapsed
        return side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
    }, [isCollapsed, isPreviewing, side, width]);

    return (
        <>
            {/* Draggable Toggle Button */}
            <Button
                variant="secondary"
                onMouseDown={handleMouseDown}
                onMouseEnter={() => setIsPreviewing(true)}
                onMouseLeave={() => setIsPreviewing(false)}
                style={{
                    position: 'fixed',
                    top: buttonPosition.y,
                    // If side=left => left: buttonPosition.x
                    // If side=right => right: buttonPosition.x
                    ...(side === 'left'
                        ? { left: buttonPosition.x }
                        : { right: buttonPosition.x }),
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    cursor: dragging ? 'grabbing' : 'grab',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    pointerEvents: isCollapsed ? 'auto' : 'none',
                }}
                className={cn(
                    'hover:bg-gray-100 dark:hover:bg-gray-800',
                    'active:scale-95 backdrop-blur-sm bg-opacity-80',
                    'hover:scale-105',
                    isCollapsed ? 'bg-white dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-800'
                )}
            >
                {isCollapsed ? (
                    <CloseIcon className="h-4 w-4" />
                ) : (
                    <OpenIcon className="h-4 w-4" />
                )}
            </Button>

            {/* Sidebar container */}
            <div
                ref={sidebarRef}
                className={cn(
                    'fixed top-0 h-full shadow-md transition-transform duration-300 flex flex-col gap-4 bg-background',
                    side === 'left' ? 'border-r left-0' : 'border-l right-0'
                )}
                style={{
                    width,
                    zIndex: 11,
                    transform: computedTransform,
                }}
            >
                {!isCollapsed && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(true)}
                        className="absolute top-2 right-2"
                    >
                        <CloseButtonIcon className="h-4 w-4" />
                    </Button>
                )}

                <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
                    {children}
                </div>
            </div>
        </>
    );
}