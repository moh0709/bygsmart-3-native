
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from './icons';

interface BackButtonProps {
    to?: string | number; // Can be a route string or a delta number (like -1)
    className?: string;
    onClick?: () => void; // Optional custom handler
    'data-ref-id'?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ to = -1, className = "", onClick, 'data-ref-id': dataRefId }) => {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (onClick) {
            onClick();
        } else {
            // @ts-ignore - Navigate accepts number or string
            navigate(to);
        }
    };

    return (
        <button 
            onClick={handleClick} 
            className={`
                group relative p-2 -ml-2 rounded-full
                hover:bg-bg-muted active:bg-border dark:hover:bg-bg-dark-muted dark:active:bg-border-dark
                transition-colors duration-150 ease-in-out
                touch-manipulation cursor-pointer
                flex items-center justify-center
                min-w-[44px] min-h-[44px]
                ${className}
            `}
            aria-label="Tilbage"
            type="button"
            data-ref-id={dataRefId || "back-button"}
        >
            <ArrowLeftIcon className="w-6 h-6 text-text-primary dark:text-text-dark-primary transition-transform group-active:-translate-x-1" />
        </button>
    );
};
