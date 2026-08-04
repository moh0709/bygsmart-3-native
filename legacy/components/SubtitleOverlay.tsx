
import React from 'react';
import { MicIcon } from './icons';

interface SubtitleOverlayProps {
    text: string;
    isVisible: boolean;
    onCancel: () => void;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({ text, isVisible, onCancel }) => {
    if (!isVisible || !text) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-[100] flex justify-center pointer-events-none animate-fade-in">
            <div className="bg-black/80 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl max-w-2xl w-full pointer-events-auto flex items-start gap-4 border border-white/10">
                <div className="mt-1 p-2 bg-brand-primary rounded-full animate-pulse">
                    <MicIcon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-lg font-medium leading-relaxed font-sans">{text}</p>
                </div>
                <button
                    onClick={onCancel}
                    className="text-text-dark-secondary hover:text-white transition-colors text-xs font-bold uppercase tracking-wider min-h-11 px-2 self-start"
                >
                    Stop
                </button>
            </div>
        </div>
    );
};
