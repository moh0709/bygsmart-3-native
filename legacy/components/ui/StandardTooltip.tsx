
import React, { useState, useRef, useEffect } from 'react';
import { QuestionCircleIcon, XIcon } from '../icons';

interface StandardTooltipProps {
    title: string;
    description: string;
    calculation?: string;
    className?: string;
}

export const StandardTooltip: React.FC<StandardTooltipProps> = ({ title, description, calculation, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Adjust position to prevent overflow (simple version)
    const [positionClass, setPositionClass] = useState("left-0");
    useEffect(() => {
        if (isOpen && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            if (rect.right > window.innerWidth - 200) {
                setPositionClass("right-0");
            } else {
                setPositionClass("left-0");
            }
        }
    }, [isOpen]);

    return (
        <div className={`relative inline-flex items-center ${className}`} ref={wrapperRef}>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`text-text-secondary dark:text-text-dark-secondary hover:text-brand-primary transition-colors focus:outline-none ${isOpen ? 'text-brand-primary' : ''}`}
                aria-label="Info"
            >
                <QuestionCircleIcon className="w-4 h-4" />
            </button>

            {isOpen && (
                <div 
                    ref={tooltipRef}
                    className={`absolute bottom-full mb-2 ${positionClass} z-50 w-72 bg-bg dark:bg-bg-dark-surface rounded-card shadow-xl border border-border dark:border-border-dark animate-fade-in overflow-hidden`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bg-bg-subtle dark:bg-bg-dark px-4 py-3 border-b border-border dark:border-border-dark flex justify-between items-center">
                        <h4 className="font-bold text-sm text-text-primary dark:text-text-dark-primary">{title}</h4>
                        <button onClick={() => setIsOpen(false)} className="min-w-11 min-h-11 flex items-center justify-center -my-3 -mr-3 text-text-tertiary dark:text-text-dark-tertiary hover:text-text-secondary dark:hover:text-text-dark-secondary">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                    
                    <div className="p-4 space-y-4">
                        {/* Description Section */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-1">
                                Hvad viser den?
                            </p>
                            <p className="text-sm text-text-primary dark:text-text-dark-primary leading-relaxed">
                                {description}
                            </p>
                        </div>

                        {/* Calculation Section */}
                        {calculation && (
                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-control border border-info-border dark:border-info/30">
                                <p className="text-xs font-bold uppercase tracking-wider text-info-strong dark:text-info mb-1">
                                    Hvordan måles det?
                                </p>
                                <p className="text-xs text-info-strong dark:text-info font-mono leading-relaxed">
                                    {calculation}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Arrow/Pointer */}
                    <div className={`absolute -bottom-1.5 w-3 h-3 bg-bg dark:bg-bg-dark-surface border-b border-r border-border dark:border-border-dark transform rotate-45 ${positionClass === 'right-0' ? 'right-4' : 'left-3.5'}`}></div>
                </div>
            )}
        </div>
    );
};
