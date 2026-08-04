
import React from 'react';
import InfoTooltip from './InfoTooltip';
import { cn } from '../../../components/ui';

/**
 * Numeric input for calculator pages — visually aligned with the kit `Field`
 * (border-strong, radius-control, 44px control) with a unit-suffix slot.
 * Sanitises decimal input (comma → dot, single separator, leading minus).
 */
const InputField: React.FC<{
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    unit: string;
    placeholder?: string;
    name?: string;
    onFocus?: (name: string) => void;
    onBlur?: () => void;
    info?: string;
    /** Optional helper text below the field (kit Field pattern). */
    hint?: string;
    /** Optional error message below the field — overrides hint. */
    error?: string;
}> = ({ label, value, onChange, unit, placeholder = "0", name, onFocus, onBlur, info, hint, error }) => {

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Allow digits, one dot or comma (converted to dot for state), and minus sign at start
        let val = e.target.value;

        // Basic sanitation: keep numbers, dot, comma, minus
        val = val.replace(/[^0-9.,-]/g, '');

        // Ensure only one decimal separator
        const parts = val.split(/[.,]/);
        if (parts.length > 2) {
            val = parts[0] + '.' + parts.slice(1).join('');
        } else {
            val = val.replace(',', '.');
        }

        // Ensure minus sign is only at the start
        if (val.lastIndexOf('-') > 0) {
             val = val.replace(/-/g, '');
             val = '-' + val;
        }

        e.target.value = val;
        onChange(e);
    };

    return (
        <div className="w-full">
            <label className="flex items-center gap-1 text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                <span>{label}</span>
                {info && <InfoTooltip text={info} />}
            </label>
            <div className="relative">
                <input
                    type="text" // text (not number) to allow controlled decimal sanitation
                    inputMode="decimal"
                    value={value}
                    onChange={handleChange}
                    onFocus={() => onFocus && name && onFocus(name)}
                    onBlur={() => onBlur && onBlur()}
                    placeholder={placeholder}
                    aria-invalid={error ? 'true' : undefined}
                    className={cn(
                        'w-full h-11 rounded-control border bg-bg pl-3 pr-12 text-base tabular-nums',
                        'text-text-primary placeholder:text-text-tertiary transition-colors duration-150',
                        'dark:bg-bg-dark-surface dark:text-text-dark-primary dark:placeholder:text-text-dark-tertiary',
                        'focus:outline-none',
                        error
                            ? 'border-danger focus:border-danger'
                            : 'border-border-strong focus:border-brand-primary dark:border-border-dark-strong'
                    )}
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-label text-text-secondary dark:text-text-dark-secondary pointer-events-none">{unit}</span>
            </div>
            {error ? (
                <p role="alert" className="mt-1.5 text-sm text-danger">{error}</p>
            ) : hint ? (
                <p className="mt-1.5 text-sm text-text-tertiary dark:text-text-dark-tertiary">{hint}</p>
            ) : null}
        </div>
    );
};

export default InputField;
