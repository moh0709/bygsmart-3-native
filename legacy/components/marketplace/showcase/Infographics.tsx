import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../ui';
import { useCountUp } from '../../ui/useCountUp';
import { CheckCircleIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from '../../icons';
import type { ShowcaseFaq, ShowcaseFeature, ShowcaseFlowStep, ShowcaseMetric } from '../../../core/registry/moduleShowcase';

// ─────────────────────────────────────────────────────────────────────────────
// Infographic blocks for the module landing pages. Presentation only — every
// colour is a DS token or the accent pair the page sets on its wrapper.
// ─────────────────────────────────────────────────────────────────────────────

/** Fires once when the element first scrolls into view. */
export function useInView<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || inView) return;
        if (typeof IntersectionObserver === 'undefined') {
            setInView(true);
            return;
        }
        // threshold 0, not a ratio: a section taller than the viewport can
        // never reach a 0.1+ intersection ratio, and would stay hidden forever.
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    setInView(true);
                    io.disconnect();
                }
            },
            { threshold: 0, rootMargin: '0px 0px -40px 0px' }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [inView]);

    return [ref, inView] as const;
}

/**
 * Reveal classes for a scroll-animated block.
 *
 * `sc-reveal` animates opacity 0 → 1, so an element that is already painted
 * when the observer fires would flash: visible → invisible → fade in. Holding
 * it at opacity-0 until it is seen makes the transition one-way.
 */
export const revealCls = (inView: boolean): string => (inView ? 'sc-reveal' : 'opacity-0');

/** Section wrapper: eyebrow + heading, revealed on scroll. */
export const ShowcaseSection: React.FC<{
    eyebrow: string;
    title: string;
    children: React.ReactNode;
    className?: string;
}> = ({ eyebrow, title, children, className }) => {
    const [ref, inView] = useInView<HTMLElement>();
    return (
        <section
            ref={ref}
            aria-label={title}
            className={cn('scroll-mt-16', revealCls(inView), className)}
        >
            <p className="text-caption font-bold uppercase tracking-[0.14em] text-brand-primary dark:text-brand-light px-1">
                {eyebrow}
            </p>
            <h2 className="text-title text-text-primary dark:text-text-dark-primary mt-1 mb-3 px-1">{title}</h2>
            {children}
        </section>
    );
};

// ── Impact strip ─────────────────────────────────────────────────────────────

/** Splits "~90" / "0 kr" into a countable number and its surrounding text. */
const splitMetric = (value: string) => {
    const m = value.match(/^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/);
    if (!m) return null;
    return { prefix: m[1], num: Number(m[2].replace(',', '.')), suffix: m[3] };
};

const MetricValue: React.FC<{ value: string; animate: boolean }> = ({ value, animate }) => {
    const parts = splitMetric(value);
    const counted = useCountUp(parts && animate ? parts.num : 0, 900);
    if (!parts) return <>{value}</>;
    const shown = animate ? Math.round(counted) : 0;
    return (
        <>
            {parts.prefix}
            {shown}
            {parts.suffix}
        </>
    );
};

export const ImpactStrip: React.FC<{ metrics: readonly ShowcaseMetric[] }> = ({ metrics }) => {
    const [ref, inView] = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className="grid grid-cols-3 gap-2">
            {metrics.map((m, i) => (
                <div
                    key={m.label}
                    className={cn(
                        'rich-surface rounded-card border border-border dark:border-border-dark',
                        'px-2.5 py-3 text-center',
                        revealCls(inView)
                    )}
                    style={{ ['--d' as string]: `${i * 90}ms` }}
                >
                    <p className="text-title text-text-primary dark:text-text-dark-primary tabular-nums">
                        <MetricValue value={m.value} animate={inView} />
                    </p>
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1 leading-snug">
                        {m.label}
                    </p>
                </div>
            ))}
        </div>
    );
};

// ── Feature grid ─────────────────────────────────────────────────────────────

export const FeatureGrid: React.FC<{ features: readonly ShowcaseFeature[] }> = ({ features }) => {
    const [ref, inView] = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {features.map((f, i) => {
                const Icon = f.icon;
                return (
                    <article
                        key={f.title}
                        className={cn(
                            'rich-surface rounded-card border border-border dark:border-border-dark p-4',
                            'transition-shadow duration-200 hover:shadow-card-hover',
                            revealCls(inView)
                        )}
                        style={{ ['--d' as string]: `${i * 70}ms` }}
                    >
                        <span
                            className="flex w-10 h-10 items-center justify-center rounded-control text-white shadow-card"
                            style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}
                            aria-hidden="true"
                        >
                            <Icon className="w-5 h-5" />
                        </span>
                        <h3 className="text-heading text-text-primary dark:text-text-dark-primary mt-3">{f.title}</h3>
                        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">{f.body}</p>
                    </article>
                );
            })}
        </div>
    );
};

// ── Flow diagram ─────────────────────────────────────────────────────────────

export const FlowDiagram: React.FC<{ steps: readonly ShowcaseFlowStep[] }> = ({ steps }) => {
    const [ref, inView] = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className="relative">
            {/* Spine — the connector every node hangs off on narrow layouts. */}
            <span
                className="absolute left-[19px] top-6 bottom-6 w-0.5 rounded-full sm:hidden"
                style={{ backgroundImage: 'linear-gradient(180deg, var(--sc-a), var(--sc-b))', opacity: 0.35 }}
                aria-hidden="true"
            />
            <ol className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                {steps.map((s, i) => (
                    <li
                        key={s.title}
                        className={cn('relative flex sm:block gap-3.5 pb-4 sm:pb-0 last:pb-0', revealCls(inView))}
                        style={{ ['--d' as string]: `${i * 110}ms` }}
                    >
                        <div className="relative shrink-0">
                            <span
                                className="flex w-10 h-10 items-center justify-center rounded-full text-white text-label font-bold shadow-card"
                                style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}
                            >
                                {i + 1}
                            </span>
                            {/* Horizontal connector on wide layouts. */}
                            {i < steps.length - 1 && (
                                <span
                                    className="hidden sm:block absolute top-1/2 left-full w-[calc(100%-1rem)] h-0.5 -translate-y-1/2 rounded-full"
                                    style={{ backgroundImage: 'linear-gradient(90deg, var(--sc-a), transparent)', opacity: 0.4 }}
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                        <div className="min-w-0 sm:mt-3">
                            <h3 className="text-heading text-text-primary dark:text-text-dark-primary">{s.title}</h3>
                            <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-0.5">{s.body}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
};

// ── Before / after ───────────────────────────────────────────────────────────

export const BeforeAfter: React.FC<{
    without: readonly string[];
    withIt: readonly string[];
    moduleName: string;
}> = ({ without, withIt, moduleName }) => {
    const [ref, inView] = useInView<HTMLDivElement>();
    return (
        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
                className={cn(
                    'rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-4',
                    revealCls(inView)
                )}
            >
                <p className="text-label font-bold text-text-secondary dark:text-text-dark-secondary">Uden modulet</p>
                <ul className="mt-3 space-y-2.5">
                    {without.map((t) => (
                        <li key={t} className="flex items-start gap-2.5">
                            <span className="flex w-5 h-5 shrink-0 items-center justify-center rounded-full bg-danger-subtle dark:bg-danger-subtle-dark mt-0.5">
                                <XIcon className="w-3 h-3 text-danger-strong dark:text-danger" />
                            </span>
                            <span className="text-body text-text-secondary dark:text-text-dark-secondary">{t}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <div
                className={cn(
                    'relative overflow-hidden rounded-card border p-4',
                    'border-brand-border dark:border-brand-border-dark bg-brand-subtle/60 dark:bg-brand-subtle-dark/40',
                    revealCls(inView)
                )}
                style={{ ['--d' as string]: '120ms' }}
            >
                <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">Med {moduleName}</p>
                <ul className="mt-3 space-y-2.5">
                    {withIt.map((t) => (
                        <li key={t} className="flex items-start gap-2.5">
                            <CheckCircleIcon className="w-5 h-5 shrink-0 text-success mt-0.5" />
                            <span className="text-body text-text-primary dark:text-text-dark-primary">{t}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

// ── FAQ ──────────────────────────────────────────────────────────────────────

export const FaqList: React.FC<{ items: readonly ShowcaseFaq[] }> = ({ items }) => {
    const [open, setOpen] = useState<number | null>(0);
    return (
        <div className="rounded-card border border-border dark:border-border-dark overflow-hidden divide-y divide-border dark:divide-border-dark bg-bg dark:bg-bg-dark-surface">
            {items.map((item, i) => {
                const isOpen = open === i;
                return (
                    <div key={item.q}>
                        <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : i)}
                            aria-expanded={isOpen}
                            aria-controls={`faq-panel-${i}`}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left min-h-[44px] hover:bg-bg-subtle dark:hover:bg-bg-dark-muted transition-colors"
                        >
                            <span className="text-body font-semibold text-text-primary dark:text-text-dark-primary">{item.q}</span>
                            <ChevronDownIcon
                                className={cn(
                                    'w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary transition-transform duration-200',
                                    isOpen && 'rotate-180'
                                )}
                            />
                        </button>
                        {isOpen && (
                            <div id={`faq-panel-${i}`} className="px-4 pb-4 -mt-1 animate-slide-down">
                                <p className="text-body text-text-secondary dark:text-text-dark-secondary">{item.a}</p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── Related modules ──────────────────────────────────────────────────────────

export const RelatedModules: React.FC<{
    items: readonly { id: string; name: string; tagline: string; price: string; Icon: React.FC<{ className?: string }> }[];
    onOpen: (id: string) => void;
}> = ({ items, onOpen }) => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {items.map(({ id, name, tagline, price, Icon }) => (
            <button
                key={id}
                type="button"
                onClick={() => onOpen(id)}
                className="rich-surface rounded-card border border-border dark:border-border-dark p-4 text-left min-h-[44px] transition-transform duration-150 active:scale-[0.99] hover:shadow-card-hover"
            >
                <div className="flex items-center gap-3">
                    <span className="flex w-9 h-9 shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light">
                        <Icon className="w-5 h-5" />
                    </span>
                    <span className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate flex-1">{name}</span>
                    <ChevronRightIcon className="w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />
                </div>
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2 line-clamp-2">{tagline}</p>
                <p className="text-caption font-semibold text-text-primary dark:text-text-dark-primary mt-1.5">{price}</p>
            </button>
        ))}
    </div>
);
