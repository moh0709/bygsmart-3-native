
import React from 'react';
import { BuildingIcon } from '../../../components/icons';
import { cn } from '../../../components/ui';

interface RegulationSwitchProps {
    isActive: boolean;
    onToggle: (checked: boolean) => void;
}

/** BR18 compliance-check toggle row — brand-tinted card when active. */
const RegulationSwitch: React.FC<RegulationSwitchProps> = ({ isActive, onToggle }) => {
    return (
        <div
            className={cn(
                'flex items-center justify-between gap-3 p-3 rounded-card border mb-4 transition-colors duration-200',
                isActive
                    ? 'bg-brand-subtle border-brand-border dark:bg-brand-subtle-dark dark:border-brand-border-dark'
                    : 'bg-bg border-border dark:bg-bg-dark-surface dark:border-border-dark'
            )}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div
                    className={cn(
                        'p-2 rounded-full shrink-0 transition-colors duration-200',
                        isActive
                            ? 'bg-brand-primary text-white'
                            : 'bg-bg-muted text-text-tertiary dark:bg-bg-dark-muted dark:text-text-dark-tertiary'
                    )}
                >
                    <BuildingIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <p
                        className={cn(
                            'text-label font-bold',
                            isActive
                                ? 'text-brand-primary dark:text-brand-light'
                                : 'text-text-secondary dark:text-text-dark-secondary'
                        )}
                    >
                        Bygningsreglementet (BR18)
                    </p>
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Tjek overholdelse af krav</p>
                </div>
            </div>
            {/* p-2 -m-2 expands the hit area of the 24px-high switch to ≥44px */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 p-2.5 -m-2.5">
                <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => onToggle(e.target.checked)}
                    className="sr-only peer"
                    aria-label="Tjek overholdelse af BR18"
                />
                <div className="w-11 h-6 rounded-full bg-border-strong dark:bg-border-dark-strong peer-checked:bg-brand-primary transition-colors duration-200 after:content-[''] after:absolute after:top-[4.5px] after:left-[4.5px] after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
        </div>
    );
};

export default RegulationSwitch;
