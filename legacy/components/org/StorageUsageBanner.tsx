import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrg } from '../../core/org/OrgProvider';
import { cn } from '../ui';

/**
 * Soft storage-quota banner (Phase 6, PRD §11.3): warns at 80 % of the org's
 * allowance and turns persistent at 100 % with a marketplace CTA. Uploads are
 * NEVER blocked — site data always comes first. Renders nothing until the
 * nightly metering job has produced data.
 */
const StorageUsageBanner: React.FC = () => {
    const { activeOrg, storageUsage } = useOrg();
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(false);

    if (!activeOrg || !storageUsage) return null;

    const allowanceBytes = activeOrg.storageAllowanceGb * 1024 * 1024 * 1024;
    if (allowanceBytes <= 0) return null;
    const percent = Math.round((storageUsage.bytesTotal / allowanceBytes) * 100);

    if (percent < 80) return null;
    const isFull = percent >= 100;
    // The 80 % warning is dismissible per session; the 100 % banner is not.
    if (dismissed && !isFull) return null;

    const usedGb = (storageUsage.bytesTotal / (1024 * 1024 * 1024)).toFixed(2);

    return (
        <div
            role="status"
            className={cn(
                'mx-4 mt-2 flex items-center gap-3 rounded-card border px-4 py-2.5 text-label',
                isFull
                    ? 'border-danger/40 bg-danger-subtle dark:bg-danger-subtle-dark text-danger'
                    : 'border-warning/40 bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning'
            )}
        >
            <span className="flex-1 min-w-0 truncate">
                {isFull
                    ? `Lagerplads opbrugt (${usedGb} af ${activeOrg.storageAllowanceGb} GB). Uploads virker stadig — men udvid din plads.`
                    : `Lagerplads ${percent}% brugt (${usedGb} af ${activeOrg.storageAllowanceGb} GB).`}
            </span>
            <button
                type="button"
                onClick={() => navigate('/moduler')}
                className="shrink-0 font-bold underline underline-offset-2"
            >
                Udvid
            </button>
            {!isFull && (
                <button
                    type="button"
                    onClick={() => setDismissed(true)}
                    aria-label="Skjul advarsel"
                    className="shrink-0 font-bold px-1"
                >
                    ✕
                </button>
            )}
        </div>
    );
};

export default StorageUsageBanner;
