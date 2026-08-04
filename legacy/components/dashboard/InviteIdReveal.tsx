import React, { useEffect, useRef, useState } from 'react';
import { InfoIcon, CopyIcon } from '../icons';
import { useToast } from '../../contexts/ToastContext';

interface InviteIdRevealProps {
    /** The short, human-friendly label shown inline (e.g. "Opgave 1.2"). */
    label: string;
    /** The full identifier revealed in the popover + copied to clipboard. */
    fullId: string;
}

/**
 * Inline label + info button that reveals the full (long) identifier in a small
 * popover with a copy-to-clipboard action. Inherits its text colour from the
 * surrounding card, so it works on both the coloured invitation banners and the
 * plain partner cards. The popover itself is always solid for readability.
 */
const InviteIdReveal: React.FC<InviteIdRevealProps> = ({ label, fullId }) => {
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(fullId);
            showToast('Kopieret til udklipsholder', 'success');
        } catch {
            showToast('Kunne ikke kopiere', 'error');
        }
    };

    return (
        <div ref={ref} className="relative inline-flex items-center gap-1.5 text-xs">
            <span className="font-medium">{label}</span>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
                aria-label="Vis fuldt ID"
                aria-expanded={open}
                className="inline-flex items-center justify-center rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity"
            >
                <InfoIcon className="w-3.5 h-3.5" />
            </button>

            {open && (
                <div
                    role="dialog"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 top-full mt-1.5 z-30 w-max max-w-[260px] rounded-xl border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface shadow-modal p-2.5 text-left"
                >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary mb-1">
                        Fuldt ID
                    </p>
                    <div className="flex items-center gap-1.5">
                        <code className="flex-1 font-mono text-[11px] leading-snug text-text-primary dark:text-text-dark-primary bg-bg-muted dark:bg-bg-dark-muted rounded px-1.5 py-1 break-all">
                            {fullId}
                        </code>
                        <button
                            type="button"
                            onClick={handleCopy}
                            aria-label="Kopiér ID til udklipsholder"
                            className="shrink-0 inline-flex items-center justify-center rounded-lg p-1.5 text-brand-primary hover:bg-brand-subtle dark:hover:bg-brand-subtle-dark transition-colors"
                        >
                            <CopyIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InviteIdReveal;
