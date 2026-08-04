
import React, { useState, useEffect } from 'react';
import { CloudIcon, RefreshCwIcon, CheckCircleIcon, AlertTriangleIcon } from './icons';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SaveStatusIndicator: React.FC = () => {
    const [status, setStatus] = useState<SaveStatus>('idle');
    
    useEffect(() => {
        const handleStatusChange = (e: CustomEvent) => {
            setStatus(e.detail.status);
            if (e.detail.status === 'saved') {
                setTimeout(() => setStatus('idle'), 2000);
            }
        };

        window.addEventListener('db-status' as any, handleStatusChange as any);
        return () => window.removeEventListener('db-status' as any, handleStatusChange as any);
    }, []);

    if (status === 'idle') return null;

    return (
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-1/2 transform -translate-x-1/2 z-[100] animate-fade-in">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm border transition-colors ${
                status === 'saving' ? 'bg-info-subtle/90 border-info-border text-info-strong dark:bg-info-subtle-dark/90 dark:border-info/30 dark:text-info' :
                status === 'saved' ? 'bg-success-subtle/90 border-success-border text-success-strong dark:bg-success-subtle-dark/90 dark:border-success/30 dark:text-success' :
                'bg-danger-subtle/90 border-danger-border text-danger-strong dark:bg-danger-subtle-dark/90 dark:border-danger/30 dark:text-danger'
            }`}>
                {status === 'saving' && <RefreshCwIcon className="w-3 h-3 animate-spin" />}
                {status === 'saved' && <CheckCircleIcon className="w-3 h-3" />}
                {status === 'error' && <AlertTriangleIcon className="w-3 h-3" />}
                
                <span className="text-xs font-semibold">
                    {status === 'saving' && 'Gemmer...'}
                    {status === 'saved' && 'Gemt i skyen'}
                    {status === 'error' && 'Fejl ved lagring'}
                </span>
            </div>
        </div>
    );
};

export default SaveStatusIndicator;
