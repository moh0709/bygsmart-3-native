import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { FloatingTimer } from './FloatingTimer';
import type { TimerState } from './TimeManagementTabContent';

const createTimerState = (isRunning: boolean): TimerState => ({
    isRunning,
    isPaused: false,
    seconds: 0,
    taskId: '',
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    log: vi.fn(),
});

beforeAll(() => {
    if (!window.PointerEvent) {
        Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent });
    }
});

describe('FloatingTimer', () => {
    test.each([
        ['idle', false, 'Start tid'],
        ['running', true, 'Åbn tidsfane'],
    ])('defaults to the bottom-right when %s', (_state, isRunning, accessibleName) => {
        render(
            <FloatingTimer
                timerState={createTimerState(isRunning)}
                projectTasks={[]}
                onOpenTimeTab={vi.fn()}
                onSaveLog={vi.fn()}
            />,
        );

        const wrapper = screen.getByRole('button', { name: accessibleName }).closest('div.fixed');

        expect(wrapper).toHaveClass(
            'right-4',
            'bottom-[calc(96px+env(safe-area-inset-bottom,0px))]',
            'md:bottom-4',
        );
        expect(wrapper).not.toHaveStyle({ top: '12px' });
    });

    test('dims after three seconds of inactivity and wakes on interaction', () => {
        vi.useFakeTimers();
        try {
            render(
                <FloatingTimer
                    timerState={createTimerState(false)}
                    projectTasks={[]}
                    onOpenTimeTab={vi.fn()}
                    onSaveLog={vi.fn()}
                />,
            );

            const startButton = screen.getByRole('button', { name: 'Start tid' });
            const wrapper = startButton.closest('div.fixed') as HTMLDivElement;
            wrapper.setPointerCapture = vi.fn();
            expect(wrapper).toHaveClass('opacity-100');
            expect(wrapper).not.toHaveClass('animate-fade-in');

            act(() => vi.advanceTimersByTime(3000));
            expect(wrapper).toHaveClass('opacity-60');

            fireEvent.pointerDown(startButton, {
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                clientX: 100,
                clientY: 100,
            });
            expect(wrapper.setPointerCapture).not.toHaveBeenCalled();
            expect(wrapper).toHaveClass('opacity-100');

            act(() => vi.advanceTimersByTime(3000));
            expect(wrapper).toHaveClass('opacity-60');
        } finally {
            vi.useRealTimers();
        }
    });

    test('keeps desktop controls clickable when the pointer does not move', () => {
        render(
            <FloatingTimer
                timerState={createTimerState(false)}
                projectTasks={[]}
                onOpenTimeTab={vi.fn()}
                onSaveLog={vi.fn()}
            />,
        );

        const startButton = screen.getByRole('button', { name: 'Start tid' });
        const wrapper = startButton.closest('div.fixed') as HTMLDivElement;
        wrapper.setPointerCapture = vi.fn();

        fireEvent.pointerDown(startButton, {
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: 100,
            clientY: 100,
        });
        fireEvent.pointerUp(startButton, {
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: 100,
            clientY: 100,
        });
        fireEvent.click(startButton);

        expect(wrapper.setPointerCapture).not.toHaveBeenCalled();
        expect(screen.getByRole('heading', { name: 'Vælg opgave til timer' })).toBeInTheDocument();
    });

    test.each([
        ['left', 0, { left: '0px' }],
        ['right', 1000, { right: '0px' }],
    ])('can be dragged from a control, docked, and compacted at the %s edge', (_side, targetX, expectedStyle) => {
        const timerState = { ...createTimerState(true), seconds: 125 };
        render(
            <FloatingTimer
                timerState={timerState}
                projectTasks={[]}
                onOpenTimeTab={vi.fn()}
                onSaveLog={vi.fn()}
            />,
        );

        const pauseButton = screen.getByRole('button', { name: 'Sæt timer på pause' });
        const wrapper = pauseButton.closest('div.fixed') as HTMLDivElement;
        Object.defineProperties(wrapper, {
            offsetWidth: { configurable: true, value: 160 },
            offsetHeight: { configurable: true, value: 48 },
        });
        wrapper.setPointerCapture = vi.fn();
        vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
            left: 800,
            right: 960,
            top: 200,
            bottom: 248,
            width: 160,
            height: 48,
            x: 800,
            y: 200,
            toJSON: () => ({}),
        });

        fireEvent.pointerDown(pauseButton, {
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: 900,
            clientY: 220,
        });
        fireEvent.pointerMove(wrapper, {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: targetX,
            clientY: 220,
        });
        expect(wrapper.setPointerCapture).toHaveBeenCalled();
        fireEvent.pointerUp(wrapper, {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: targetX,
            clientY: 220,
        });

        const compactButton = screen.getByRole('button', { name: 'Udvid timer' });
        expect(compactButton).toHaveTextContent('02:05');
        expect(compactButton.closest('div.fixed')).toHaveStyle(expectedStyle);
        expect(timerState.pause).not.toHaveBeenCalled();
    });

    test('dims the compact edge timer after three seconds', () => {
        vi.useFakeTimers();
        try {
            render(
                <FloatingTimer
                    timerState={{ ...createTimerState(true), seconds: 125 }}
                    projectTasks={[]}
                    onOpenTimeTab={vi.fn()}
                    onSaveLog={vi.fn()}
                />,
            );

            const timerButton = screen.getByRole('button', { name: 'Åbn tidsfane' });
            const wrapper = timerButton.closest('div.fixed') as HTMLDivElement;
            Object.defineProperties(wrapper, {
                offsetWidth: { configurable: true, value: 160 },
                offsetHeight: { configurable: true, value: 48 },
            });
            wrapper.setPointerCapture = vi.fn();
            vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
                left: 800,
                right: 960,
                top: 200,
                bottom: 248,
                width: 160,
                height: 48,
                x: 800,
                y: 200,
                toJSON: () => ({}),
            });

            fireEvent.pointerDown(timerButton, {
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                clientX: 900,
                clientY: 220,
            });
            fireEvent.pointerMove(wrapper, {
                pointerId: 1,
                pointerType: 'mouse',
                clientX: 0,
                clientY: 220,
            });
            fireEvent.pointerUp(wrapper, {
                pointerId: 1,
                pointerType: 'mouse',
                clientX: 0,
                clientY: 220,
            });

            const compactWrapper = screen.getByRole('button', { name: 'Udvid timer' }).closest('div.fixed');
            expect(compactWrapper).toHaveClass('opacity-100');

            act(() => vi.advanceTimersByTime(3000));
            expect(compactWrapper).toHaveClass('opacity-60');
        } finally {
            vi.useRealTimers();
        }
    });

    test('expands a compact timer when clicked', async () => {
        render(
            <FloatingTimer
                timerState={{ ...createTimerState(true), seconds: 65 }}
                projectTasks={[]}
                onOpenTimeTab={vi.fn()}
                onSaveLog={vi.fn()}
            />,
        );

        const timerButton = screen.getByRole('button', { name: 'Åbn tidsfane' });
        const wrapper = timerButton.closest('div.fixed') as HTMLDivElement;
        Object.defineProperties(wrapper, {
            offsetWidth: { configurable: true, value: 160 },
            offsetHeight: { configurable: true, value: 48 },
        });
        vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
            left: 800,
            right: 960,
            top: 200,
            bottom: 248,
            width: 160,
            height: 48,
            x: 800,
            y: 200,
            toJSON: () => ({}),
        });

        fireEvent.pointerDown(timerButton, {
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            clientX: 900,
            clientY: 220,
        });
        fireEvent.pointerMove(wrapper, {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: 1000,
            clientY: 220,
        });
        fireEvent.pointerUp(wrapper, {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: 1000,
            clientY: 220,
        });

        await new Promise(resolve => window.setTimeout(resolve, 0));
        fireEvent.click(screen.getByRole('button', { name: 'Udvid timer' }));

        expect(screen.getByRole('button', { name: 'Åbn tidsfane' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Udvid timer' })).not.toBeInTheDocument();
    });
});
