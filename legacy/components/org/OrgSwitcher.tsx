import React, { useEffect, useRef, useState } from 'react';
import { useOrg } from '../../core/org/OrgProvider';
import { useToast } from '../../contexts/ToastContext';
import { BuildingIcon, CheckIcon } from '../icons';

/**
 * Active-org switcher in the global top bar. Renders ONLY when the user has
 * more than one active membership — single-org users (the vast majority)
 * never see it. Switching is server-validated (set_active_org RPC).
 */
const OrgSwitcher: React.FC = () => {
    const { memberships, activeOrg, switchOrg } = useOrg();
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const activeMemberships = memberships.filter((m) => m.status === 'active');

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    if (activeMemberships.length < 2 || !activeOrg) return null;

    const handleSwitch = async (orgId: string) => {
        if (orgId === activeOrg.id) { setOpen(false); return; }
        setSwitching(true);
        try {
            await switchOrg(orgId);
            setOpen(false);
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Kunne ikke skifte organisation.', 'error');
        } finally {
            setSwitching(false);
        }
    };

    return (
        <div className="relative min-w-0" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={switching}
                className="flex items-center gap-1.5 max-w-[160px] min-h-11 px-2 rounded-control text-label font-semibold text-text-primary dark:text-text-dark-primary hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors disabled:opacity-50"
                title="Skift organisation"
                aria-label={`Aktiv organisation: ${activeOrg.name}. Skift organisation`}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <BuildingIcon className="w-4 h-4 shrink-0 text-text-secondary dark:text-text-dark-secondary" />
                <span className="truncate">{activeOrg.name}</span>
                <svg className="w-3 h-3 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-bg dark:bg-bg-dark-surface rounded-card shadow-modal border border-border dark:border-border-dark z-50 animate-scale-in overflow-hidden" role="menu">
                    <p className="px-3 pt-3 pb-1 text-caption font-bold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                        Organisationer
                    </p>
                    {activeMemberships.map((m) => (
                        <button
                            key={m.org.id}
                            type="button"
                            role="menuitem"
                            onClick={() => handleSwitch(m.org.id)}
                            className="flex items-center gap-2 w-full min-h-11 px-3 py-2 text-label font-semibold text-text-primary dark:text-text-dark-primary text-left transition-colors hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50"
                        >
                            <span className="flex-1 truncate">{m.org.name}</span>
                            {m.org.id === activeOrg.id && (
                                <CheckIcon className="w-4 h-4 shrink-0 text-brand-primary" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrgSwitcher;
