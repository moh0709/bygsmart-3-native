
import React from 'react';
import { SegmentedControl as KitSegmentedControl } from '../../../components/ui';

type ControlValue = string;

interface SegmentedControlProps<T extends ControlValue> {
    options: { label: string; value: T }[];
    value: T;
    onChange: (value: T) => void;
    className?: string;
    compact?: boolean;
}

/**
 * Calculator-local segmented control — thin wrapper that delegates to the kit
 * `SegmentedControl` (tokens, radiogroup semantics, arrow-key navigation).
 * Public API kept for the ~80 calculator pages; `compact` maps to size="sm".
 */
const SegmentedControl = <T extends ControlValue>({ options, value, onChange, className = "", compact = false }: SegmentedControlProps<T>) => (
    <KitSegmentedControl<T>
        options={options}
        value={value}
        onChange={onChange}
        className={className}
        size={compact ? 'sm' : 'md'}
    />
);

export default SegmentedControl;
