import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const defaultEvents = ["mousedown", "touchstart"];

export const useClickAway = <E extends Event = Event>(
    ref: RefObject<HTMLElement | null>,
    onClickAway: (event: E) => void,
    events: string[] = defaultEvents,
) => {
    const savedCallback = useRef(onClickAway);
    useEffect(() => {
        savedCallback.current = onClickAway;
    }, [onClickAway]);
    useEffect(() => {
        const handler = (event: any) => {
            const { current: el } = ref;
            el && !el.contains(event.target) && savedCallback.current(event);
        };
        for (const eventName of events) {
            window.addEventListener(eventName, handler);
        }
        return () => {
            for (const eventName of events) {
                window.removeEventListener(eventName, handler);
            }
        };
    }, [events, ref]);
};
