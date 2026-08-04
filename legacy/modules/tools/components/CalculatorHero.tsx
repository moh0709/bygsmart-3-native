import React from 'react';
import { Alert } from '../../../components/ui';

interface CalculatorHeroProps {
    /** SVG or element to render in the illustrated banner */
    illustration?: React.ReactNode;
    /** Informational hint text shown below illustration */
    hint?: string;
    /** Regulation reference shown as a bold badge, e.g. "BR18 §258" */
    complianceRef?: string;
    /** CSS hex or hsl color for gradient start */
    accentFrom?: string;
    /** CSS hex or hsl color for gradient end */
    accentTo?: string;
    className?: string;
}

/**
 * Compact intro block for calculator pages: a small illustration panel with a
 * subtle per-trade accent tint, plus an info callout for hint + regulation ref.
 */
const CalculatorHero: React.FC<CalculatorHeroProps> = ({
    illustration,
    hint,
    complianceRef,
    accentFrom = '#3b82f6',
    accentTo = '#1d4ed8',
    className = '',
}) => {
    if (!illustration && !hint && !complianceRef) return null;

    return (
        <div className={`space-y-3 ${className}`}>
            {illustration && (
                <div
                    className="rounded-card border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface overflow-hidden"
                    style={{
                        // Subtle (≤12% alpha) accent tint — keeps the trade colour
                        // identity without an oversized gradient banner.
                        backgroundImage: `linear-gradient(135deg, ${accentFrom}10, ${accentTo}1f)`,
                    }}
                >
                    <div className="flex items-center justify-center min-h-[120px] p-3">
                        {illustration}
                    </div>
                </div>
            )}

            {(hint || complianceRef) && (
                <Alert variant="info">
                    {hint && <p className="leading-snug">{hint}</p>}
                    {complianceRef && (
                        <p className={`text-caption font-bold ${hint ? 'mt-1.5' : ''}`}>
                            Jvf.&nbsp;{complianceRef}
                        </p>
                    )}
                </Alert>
            )}
        </div>
    );
};

export default CalculatorHero;
