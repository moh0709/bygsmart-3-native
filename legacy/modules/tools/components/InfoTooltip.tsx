import React, { useState, useRef, useEffect } from 'react';

/**
 * Tap-to-toggle info popover for input labels. Kept as click-toggle (rather
 * than the hover/focus kit Tooltip) so it works reliably on touch devices;
 * visuals follow the kit Tooltip tokens.
 */
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTooltip = () => {
        if (!isOpen && wrapperRef.current && tooltipRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();

            let top = rect.top - tooltipRect.height - 8;
            let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

            // Adjust if out of bounds
            if (top < 0) top = rect.bottom + 8;
            if (left < 0) left = 8;
            if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 8;

            setPosition({ top, left });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div ref={wrapperRef} className="relative inline-flex items-center">
            <button
                type="button"
                onClick={toggleTooltip}
                aria-label="Mere info"
                aria-expanded={isOpen}
                className="relative w-4 h-4 rounded-full flex items-center justify-center text-caption font-bold bg-bg-muted text-text-secondary hover:bg-border hover:text-text-primary dark:bg-bg-dark-muted dark:text-text-dark-secondary dark:hover:bg-border-dark dark:hover:text-text-dark-primary transition-colors before:absolute before:-inset-3.5 before:content-['']"
            >
                ?
            </button>

            {isOpen && (
                <div
                    ref={tooltipRef}
                    role="tooltip"
                    className="fixed z-[120] w-64 px-3 py-2 rounded-control text-label shadow-raised animate-fade-in bg-text-primary text-white dark:bg-bg-dark-muted dark:text-text-dark-primary"
                    style={{ top: position.top, left: position.left }}
                >
                    {text}
                    <div className="absolute w-2 h-2 bg-text-primary dark:bg-bg-dark-muted transform rotate-45" style={{ left: 'calc(50% - 4px)', bottom: '-4px' }}></div>
                </div>
            )}
        </div>
    );
};

export default InfoTooltip;
