import React from 'react';
import { cn } from '../ui';
import type { ModulePreviewVariant } from '../../core/registry/marketplaceCatalog';

// ─────────────────────────────────────────────────────────────────────────────
// Stylized, abstract UI preview for module detail pages — skeleton-style
// blocks that suggest the module's interface without hardcoding screenshots.
// Pure presentation, DS tokens only.
// ─────────────────────────────────────────────────────────────────────────────

const Pill: React.FC<{ w: string; tone?: 'brand' | 'muted' | 'success' | 'warning' }> = ({ w, tone = 'muted' }) => (
    <span
        className={cn(
            'inline-block h-2 rounded-full',
            w,
            tone === 'brand' && 'bg-brand-primary/60',
            tone === 'muted' && 'bg-border-strong/60 dark:bg-border-dark-strong/60',
            tone === 'success' && 'bg-success/60',
            tone === 'warning' && 'bg-warning/70'
        )}
        aria-hidden="true"
    />
);

const Row: React.FC<{ trailing?: React.ReactNode }> = ({ trailing }) => (
    <div className="flex items-center gap-3 rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark px-3 py-2.5">
        <span className="w-6 h-6 rounded-full bg-brand-primary/15 shrink-0" />
        <div className="flex-1 space-y-1.5 min-w-0">
            <Pill w="w-2/3" tone="brand" />
            <Pill w="w-1/3" />
        </div>
        {trailing}
    </div>
);

const variants: Record<ModulePreviewVariant, React.ReactNode> = {
    list: (
        <div className="space-y-2">
            <Row trailing={<Pill w="w-10" tone="success" />} />
            <Row trailing={<Pill w="w-10" tone="warning" />} />
            <Row trailing={<Pill w="w-10" tone="muted" />} />
        </div>
    ),
    board: (
        <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((col) => (
                <div key={col} className="space-y-2">
                    <Pill w="w-3/4" tone="brand" />
                    {[0, 1].map((card) => (
                        <div key={card} className="rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-2.5 space-y-1.5">
                            <Pill w="w-full" />
                            <Pill w="w-1/2" tone={col === 2 ? 'success' : 'muted'} />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    ),
    doc: (
        <div className="rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-4 space-y-2.5">
            <div className="flex items-center justify-between">
                <Pill w="w-1/3" tone="brand" />
                <span className="w-8 h-8 rounded-control bg-brand-primary/15" />
            </div>
            <Pill w="w-full" />
            <Pill w="w-5/6" />
            <Pill w="w-full" />
            <Pill w="w-2/3" />
            <div className="pt-2 flex gap-2">
                <span className="h-7 w-20 rounded-control bg-brand-primary/70" />
                <span className="h-7 w-20 rounded-control border border-border dark:border-border-dark" />
            </div>
        </div>
    ),
    chat: (
        <div className="space-y-2">
            <div className="flex justify-start">
                <div className="max-w-[70%] rounded-card rounded-bl-sm bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-3 space-y-1.5 w-56">
                    <Pill w="w-full" />
                    <Pill w="w-2/3" />
                </div>
            </div>
            <div className="flex justify-end">
                <div className="max-w-[70%] rounded-card rounded-br-sm bg-brand-primary/80 p-3 space-y-1.5 w-48">
                    <span className="block h-2 rounded-full bg-white/70 w-full" />
                    <span className="block h-2 rounded-full bg-white/70 w-1/2" />
                </div>
            </div>
            <div className="flex justify-start">
                <div className="max-w-[70%] rounded-card rounded-bl-sm bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-3 w-40">
                    <Pill w="w-full" tone="success" />
                </div>
            </div>
        </div>
    ),
    stat: (
        <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
                {(['brand', 'success', 'warning'] as const).map((tone) => (
                    <div key={tone} className="rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-3 space-y-2">
                        <span className={cn('block h-4 w-10 rounded', tone === 'brand' ? 'bg-brand-primary/60' : tone === 'success' ? 'bg-success/60' : 'bg-warning/70')} />
                        <Pill w="w-full" />
                    </div>
                ))}
            </div>
            <div className="rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-3 space-y-2">
                <Pill w="w-1/4" tone="brand" />
                <div className="h-2 rounded-full bg-border-strong/40 dark:bg-border-dark-strong/40 overflow-hidden">
                    <div className="h-full w-2/3 rounded-full bg-brand-primary/70" />
                </div>
                <div className="h-2 rounded-full bg-border-strong/40 dark:bg-border-dark-strong/40 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-success/70" />
                </div>
            </div>
        </div>
    ),
    scan: (
        <div className="relative rounded-control bg-bg-dark border border-border-dark p-4 h-44 overflow-hidden">
            <span className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-brand-light rounded-tl" />
            <span className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-brand-light rounded-tr" />
            <span className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-brand-light rounded-bl" />
            <span className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-brand-light rounded-br" />
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-28 h-20 border-2 border-dashed border-brand-light/70 rounded-control rotate-6" />
            </div>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 h-2 w-16 rounded-full bg-white/50" />
        </div>
    ),
    grid: (
        <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark flex flex-col items-center justify-center gap-1.5 p-2">
                    <span className={cn('w-6 h-6 rounded-control', i % 3 === 0 ? 'bg-brand-primary/30' : 'bg-border-strong/40 dark:bg-border-dark-strong/40')} />
                    <Pill w="w-3/4" />
                </div>
            ))}
        </div>
    ),
};

/** Framed, non-interactive preview canvas. */
export const ModulePreview: React.FC<{ variant: ModulePreviewVariant }> = ({ variant }) => (
    <div
        className="rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-4"
        aria-hidden="true"
    >
        {variants[variant]}
    </div>
);
