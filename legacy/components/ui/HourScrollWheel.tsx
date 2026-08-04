
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUpIcon, ChevronDownIcon, ClockIcon } from '../icons';

interface HourScrollWheelProps {
    value: number;
    onChange: (val: number) => void;
    className?: string;
}

const WheelControl: React.FC<{ value: number; onChange: (val: number) => void }> = ({ value, onChange }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startVal = useRef(0);
    const step = 0.5;

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Handle Mouse Wheel
    const handleWheel = (e: React.WheelEvent) => {
        const delta = Math.sign(e.deltaY) * -1; // Up is positive
        const newValue = Math.max(0, value + delta * step);
        onChange(newValue);
    };

    // Mouse Dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        startY.current = e.clientY;
        startVal.current = value;
    };

    // Touch Dragging
    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        startY.current = e.touches[0].clientY;
        startVal.current = value;
    };

    useEffect(() => {
        const handleMove = (clientY: number) => {
            if (!isDragging) return;
            const diff = startY.current - clientY; // Drag up = positive diff
            // Sensitivity: 30px per step for better control in modal
            const steps = Math.round(diff / 30);
            const newValue = Math.max(0, startVal.current + steps * step);
            if (newValue !== value) {
                onChange(newValue);
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                e.preventDefault();
                handleMove(e.clientY);
            }
        };
        
        const onTouchMove = (e: TouchEvent) => {
            if (isDragging) {
                if (e.cancelable) e.preventDefault();
                handleMove(e.touches[0].clientY);
            }
        };

        const onEnd = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onEnd);
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onEnd);
        }

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onEnd);
        };
    }, [isDragging, value, onChange]);

    return (
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-2xl flex flex-col items-center w-72 border border-border dark:border-border-dark animate-fade-in transform scale-100 transition-transform select-none">
            <h3 className="text-lg font-bold mb-2 text-text-primary dark:text-text-dark-primary">Juster Estimerede Timer</h3>
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary mb-6 text-center">Scroll eller træk for at ændre</p>
            
            <div 
                className={`relative w-32 h-48 bg-bg-subtle dark:bg-bg-dark border rounded-xl flex flex-col items-center justify-center overflow-hidden select-none cursor-ns-resize transition-colors touch-none ${isDragging ? 'border-brand-primary ring-4 ring-brand-primary/20' : 'border-border-strong dark:border-border-dark-strong'}`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                {/* Visual Indicators */}
                <div className={`absolute top-2 transition-opacity duration-200 ${isDragging ? 'text-brand-primary opacity-100' : 'text-text-tertiary dark:text-text-dark-tertiary opacity-50'}`}>
                    <ChevronUpIcon className="w-8 h-8"/>
                </div>
                
                <div className="font-bold text-4xl text-text-primary dark:text-text-dark-primary z-10 tabular-nums">
                    {value.toFixed(1)}
                </div>
                <div className="text-xs text-text-secondary dark:text-text-dark-secondary uppercase font-bold tracking-wider mt-1">
                    timer
                </div>

                <div className={`absolute bottom-2 transition-opacity duration-200 ${isDragging ? 'text-brand-primary opacity-100' : 'text-text-tertiary dark:text-text-dark-tertiary opacity-50'}`}>
                    <ChevronDownIcon className="w-8 h-8"/>
                </div>

                {/* Glass effect overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-bg/80 via-transparent to-bg/80 dark:from-bg-dark/80 dark:to-bg-dark/80 pointer-events-none"></div>
            </div>
            
            <div className="mt-6 text-center text-xs text-text-secondary dark:text-text-dark-secondary opacity-75">
                Tryk udenfor for at gemme
            </div>
        </div>
    );
}

const HourScrollWheel: React.FC<HourScrollWheelProps> = ({ value, onChange, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 touch-none" onClick={() => setIsOpen(false)}>
            <div onClick={e => e.stopPropagation()}>
                <WheelControl value={value} onChange={onChange} />
            </div>
        </div>
    );

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)} 
                className={`relative flex flex-col items-center justify-center min-h-11 bg-bg dark:bg-bg-dark border border-border dark:border-border-dark-strong rounded-control px-3 py-1 hover:border-brand-primary hover:shadow-sm transition-all group ${className}`}
                title="Klik for at justere timer"
            >
                <div className="flex items-center gap-1">
                    <ClockIcon className="w-3 h-3 text-text-secondary dark:text-text-dark-secondary group-hover:text-brand-primary transition-colors"/>
                    <span className="font-bold text-lg text-text-primary dark:text-text-dark-primary tabular-nums leading-none">{value.toFixed(1)}</span>
                </div>
                <span className="text-caption text-text-secondary dark:text-text-dark-secondary uppercase font-bold tracking-wider leading-none">timer</span>
            </button>

            {isOpen && createPortal(modalContent, document.body)}
        </>
    );
};

export default HourScrollWheel;
