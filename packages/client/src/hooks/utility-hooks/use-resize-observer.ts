/**
 * Resize Observer Hook
 * 
 * This hook provides a way to observe and respond to size changes of a DOM element.
 * It's particularly useful for components that need to adjust their layout or rendering
 * based on their container's dimensions.
 * 
 * Most recent changes:
 * - Initial implementation
 * - Added debounce functionality to prevent excessive re-renders
 */

import { useState, useEffect, RefObject } from 'react';

type Size = {
  width: number;
  height: number;
};

export function useResizeObserver(
  ref: RefObject<HTMLElement>,
  debounceMs: number = 0
): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  
  useEffect(() => {
    if (!ref.current) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    const updateSize = (entries: ResizeObserverEntry[]) => {
      if (!entries[0]) return;
      
      const { width, height } = entries[0].contentRect;
      
      if (debounceMs > 0) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setSize({ width, height });
        }, debounceMs);
      } else {
        setSize({ width, height });
      }
    };
    
    const observer = new ResizeObserver(updateSize);
    observer.observe(ref.current);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [ref, debounceMs]);
  
  return size;
} 