import { useRef, useCallback } from 'react';

/**
 * Mouse click-and-drag horizontal scrolling for an overflow-x container.
 *
 * Touch devices already scroll natively, so this only wires mouse handlers.
 * A drag beyond a small threshold suppresses the trailing click (capture phase)
 * so draggable cards don't also navigate when the user was just scrolling.
 *
 * Usage:
 *   const { ref, dragScrollProps } = useDragScroll<HTMLDivElement>();
 *   <div ref={ref} {...dragScrollProps} className="overflow-x-auto …">…</div>
 */
export function useDragScroll<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const state = useRef({ down: false, moved: false, startX: 0, startScroll: 0 });

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        const el = ref.current;
        if (!el || e.button !== 0) return;
        state.current = { down: true, moved: false, startX: e.clientX, startScroll: el.scrollLeft };
        // Disable scroll-snap and smooth-scroll for the duration of the drag so
        // the strip tracks the cursor 1:1 instead of snapping/animating (which
        // reads as lag). Restored on release.
        el.style.scrollSnapType = 'none';
        el.style.scrollBehavior = 'auto';
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        const el = ref.current;
        if (!el || !state.current.down) return;
        e.preventDefault();
        const dx = e.clientX - state.current.startX;
        if (Math.abs(dx) > 4) state.current.moved = true;
        el.scrollLeft = state.current.startScroll - dx;
    }, []);

    const endDrag = useCallback(() => {
        const el = ref.current;
        if (state.current.down && el) {
            // Restore snap so the nearest card settles into place after release.
            el.style.scrollSnapType = '';
            el.style.scrollBehavior = '';
        }
        state.current.down = false;
    }, []);

    // Runs in the capture phase (before descendant onClick handlers), so a click
    // that concludes a drag is swallowed and never reaches a child card/button.
    const onClickCapture = useCallback((e: React.MouseEvent) => {
        if (state.current.moved) {
            e.stopPropagation();
            e.preventDefault();
            state.current.moved = false;
        }
    }, []);

    return {
        ref,
        dragScrollProps: {
            onMouseDown,
            onMouseMove,
            onMouseUp: endDrag,
            onMouseLeave: endDrag,
            onClickCapture,
        },
    };
}

export default useDragScroll;
