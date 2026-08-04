
import React from 'react';
import { MicIcon, XIcon, SparklesIcon } from '../../../components/icons';

interface HandsFreeOverlayProps {
    status: 'listening' | 'thinking' | 'speaking';
    transcript: string;
    subtitle: string;
    onClose: () => void;
}

export const HandsFreeOverlay: React.FC<HandsFreeOverlayProps> = ({ status, transcript, subtitle, onClose }) => {
    return (
        <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center justify-end pb-8 pointer-events-none">
            {/* Subtitle Bubble (Bot Speech) */}
            {status === 'speaking' && subtitle && (
                <div className="mb-4 max-w-lg w-[90%] bg-black/80 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 pointer-events-auto animate-fade-in">
                    <p className="text-lg font-medium leading-relaxed text-center">{subtitle}</p>
                </div>
            )}

            {/* Main Controller Pill */}
            <div className="bg-bg dark:bg-bg-dark-surface shadow-2xl rounded-full px-6 py-4 flex items-center gap-6 pointer-events-auto border border-border dark:border-border-dark transition-all duration-300 transform hover:scale-105">
                
                {/* Visualizer / Status Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    status === 'listening' ? 'bg-danger text-white animate-pulse' :
                    status === 'thinking' ? 'bg-brand-primary text-white animate-spin' :
                    'bg-success text-white'
                }`}>
                    {status === 'thinking' ? <SparklesIcon className="w-6 h-6"/> : <MicIcon className="w-6 h-6"/>}
                </div>

                {/* User Transcript or Status Text */}
                <div className="flex flex-col min-w-[150px] max-w-[250px]">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-0.5">
                        {status === 'listening' ? 'Lytter...' : status === 'thinking' ? 'Behandler...' : 'Taler...'}
                    </span>
                    <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">
                        {status === 'listening' ? (transcript || "Sig noget...") : status === 'thinking' ? "Vent venligst" : "Svarer"}
                    </span>
                </div>

                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="p-3 rounded-full bg-bg-muted dark:bg-bg-dark-muted hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark text-text-secondary dark:text-text-dark-secondary hover:text-danger-strong dark:hover:text-danger transition-colors"
                    title="Afslut Hands-free"
                >
                    <XIcon className="w-5 h-5"/>
                </button>
            </div>
            
            {status === 'listening' && (
                <p className="text-xs text-white/80 font-medium mt-2 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm pointer-events-auto cursor-pointer" onClick={onClose}>
                    Tryk på X for at stoppe
                </p>
            )}
        </div>
    );
};
