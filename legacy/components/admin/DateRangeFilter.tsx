import React, { useMemo } from 'react';
import { SegmentedControl, Input } from '../ui';

export type AdminPeriodPreset = 'mtd' | 'ytd' | 'l3m' | 'custom';
export type AdminCompareMode = 'prev' | 'yoy';

export interface AdminPeriodValue {
    preset: AdminPeriodPreset;
    from: string; // yyyy-mm-dd
    to: string; // yyyy-mm-dd
    compare: AdminCompareMode;
}

const toDateInput = (d: Date): string => d.toISOString().slice(0, 10);

const presetRange = (preset: AdminPeriodPreset): { from: string; to: string } => {
    const now = new Date();
    const to = toDateInput(now);
    if (preset === 'mtd') {
        return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    }
    if (preset === 'ytd') {
        return { from: toDateInput(new Date(now.getFullYear(), 0, 1)), to };
    }
    if (preset === 'l3m') {
        const from = new Date(now);
        from.setDate(from.getDate() - 90);
        return { from: toDateInput(from), to };
    }
    return { from: to, to };
};

/** Builds the default month-to-date filter value, matching the API's own default. */
export const defaultAdminPeriod = (): AdminPeriodValue => ({
    preset: 'mtd',
    ...presetRange('mtd'),
    compare: 'prev',
});

const PRESET_OPTIONS: Array<{ label: string; value: AdminPeriodPreset }> = [
    { label: 'MTD', value: 'mtd' },
    { label: 'YTD', value: 'ytd' },
    { label: 'Sidste 3 mdr.', value: 'l3m' },
    { label: 'Brugerdefineret', value: 'custom' },
];

const COMPARE_OPTIONS: Array<{ label: string; value: AdminCompareMode }> = [
    { label: 'Forrige periode', value: 'prev' },
    { label: 'Samme periode sidste år', value: 'yoy' },
];

/**
 * Shared period filter for admin insights: YTD / MTD / last-3-months presets,
 * a custom date-picker range, and a comparison-basis toggle (previous period
 * vs. year-over-year). Mirrors the `from`/`to`/`compare` query params every
 * `/api/admin/*` insights endpoint accepts.
 */
export const DateRangeFilter: React.FC<{ value: AdminPeriodValue; onChange: (next: AdminPeriodValue) => void }> = ({ value, onChange }) => {
    const rangeLabel = useMemo(() => {
        const fmt = (iso: string) => new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
        return `${fmt(value.from)} – ${fmt(value.to)}`;
    }, [value.from, value.to]);

    const setPreset = (preset: AdminPeriodPreset) => {
        if (preset === 'custom') {
            onChange({ ...value, preset });
            return;
        }
        onChange({ preset, ...presetRange(preset), compare: value.compare });
    };

    return (
        <div className="flex flex-col gap-2.5">
            <SegmentedControl size="sm" label="Periode" options={PRESET_OPTIONS} value={value.preset} onChange={setPreset} />
            {value.preset === 'custom' && (
                <div className="flex items-center gap-2">
                    <Input
                        aria-label="Fra dato"
                        type="date"
                        value={value.from}
                        max={value.to}
                        onChange={(e) => onChange({ ...value, from: e.target.value })}
                        className="flex-1"
                    />
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary shrink-0">til</span>
                    <Input
                        aria-label="Til dato"
                        type="date"
                        value={value.to}
                        min={value.from}
                        onChange={(e) => onChange({ ...value, to: e.target.value })}
                        className="flex-1"
                    />
                </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{rangeLabel}</span>
                <SegmentedControl
                    size="sm"
                    fullWidth={false}
                    label="Sammenlign med"
                    options={COMPARE_OPTIONS}
                    value={value.compare}
                    onChange={(compare) => onChange({ ...value, compare })}
                />
            </div>
        </div>
    );
};

export default DateRangeFilter;
