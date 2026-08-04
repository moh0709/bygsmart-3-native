import React, { useState } from 'react';
import { cn } from '../../../ui';
import {
    AlertTriangleIcon, CameraIcon, CheckCircleIcon, FileTextIcon, PlusIcon,
    SendIcon, ShoppingCartIcon, TrendingUpIcon,
} from '../../../icons';
import { DemoAction, DemoMeter, DemoPill, DemoRow, DemoStage, TapHint, kr } from './shared';
import { BUDGET_CATEGORY_LABELS, QUOTATION_STATUS, SUPPLIERS } from './demoFacts';
import type { ProjectBudgetCategory, QuotationStatus } from '../../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Commercial demos — Budget, Indkøb, Tilbud.
// ─────────────────────────────────────────────────────────────────────────────

// ── Budget: burn mod baseline ────────────────────────────────────────────────

interface BudgetLine { key: ProjectBudgetCategory; baseline: number; spent: number; step: number; }

/** The four real ProjectBudgetCategory buckets — labels via BUDGET_CATEGORY_LABELS. */
const BUDGET_SEED: BudgetLine[] = [
    { key: 'materials', baseline: 340_000, spent: 214_000, step: 38_000 },
    { key: 'labor', baseline: 280_000, spent: 132_000, step: 26_000 },
    { key: 'subcontractors', baseline: 220_000, spent: 196_000, step: 34_000 },
    { key: 'other', baseline: 60_000, spent: 21_000, step: 12_000 },
];

const toneFor = (ratio: number) => (ratio > 1 ? 'danger' : ratio > 0.85 ? 'warning' : 'accent');

export const BudgetDemo: React.FC = () => {
    const [lines, setLines] = useState<BudgetLine[]>(BUDGET_SEED);
    const [touched, setTouched] = useState(false);

    const spend = (i: number) => {
        setLines((ls) => ls.map((l, k) => (k === i ? { ...l, spent: l.spent + l.step } : l)));
        setTouched(true);
    };

    const baseline = lines.reduce((s, l) => s + l.baseline, 0);
    const spent = lines.reduce((s, l) => s + l.spent, 0);
    const over = lines.filter((l) => l.spent > l.baseline);

    return (
        <DemoStage title="Budget · Villa Solbakken" onReset={touched ? () => { setLines(BUDGET_SEED); setTouched(false); } : undefined}>
            <div className="rounded-control border border-border dark:border-border-dark p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                    <div>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Forbrug i alt</p>
                        <p className="text-title text-text-primary dark:text-text-dark-primary tabular-nums mt-0.5">{kr(spent)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Baseline</p>
                        <p className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums">{kr(baseline)}</p>
                    </div>
                </div>
                <DemoMeter className="mt-2.5" value={spent / baseline} tone={toneFor(spent / baseline)} />
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2 tabular-nums">
                    {Math.round((spent / baseline) * 100)} % brugt · {kr(Math.max(0, baseline - spent))} tilbage
                </p>
            </div>

            <TapHint show={!touched}>Registrér forbrug på en post — se burn-raten reagere</TapHint>

            <div className="mt-3 space-y-2">
                {lines.map((l, i) => {
                    const ratio = l.spent / l.baseline;
                    return (
                        <div key={l.key} className="rounded-control border border-border dark:border-border-dark p-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{BUDGET_CATEGORY_LABELS[l.key]}</p>
                                <DemoPill tone={ratio > 1 ? 'danger' : ratio > 0.85 ? 'warning' : 'neutral'}>
                                    {Math.round(ratio * 100)} %
                                </DemoPill>
                            </div>
                            <DemoMeter className="mt-2" value={ratio} tone={toneFor(ratio)} />
                            <div className="flex items-center justify-between gap-2 mt-2.5">
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary tabular-nums">
                                    {kr(l.spent)} af {kr(l.baseline)}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => spend(i)}
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-caption font-bold bg-bg-muted dark:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary transition-transform duration-150 active:scale-[0.96]"
                                >
                                    <PlusIcon className="w-3 h-3" />
                                    Bogfør {kr(l.step)}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {over.length > 0 && (
                <div className="mt-3 rounded-control bg-danger-subtle dark:bg-danger-subtle-dark p-3 flex items-start gap-2 animate-scale-in">
                    <AlertTriangleIcon className="w-4 h-4 text-danger-strong dark:text-danger shrink-0 mt-0.5" />
                    <p className="text-caption text-danger-strong dark:text-danger">
                        <strong>{over.map((l) => BUDGET_CATEGORY_LABELS[l.key]).join(', ')}</strong> er over baseline. I virkeligheden ville du have
                        set advarslen på projektets forside, allerede da posten ramte 85 %.
                    </p>
                </div>
            )}
        </DemoStage>
    );
};

// ── Indkøb: liste, kvittering og levering ────────────────────────────────────

interface PurchaseItem { id: number; name: string; supplier: string; itemNumber: string; price: number; delivered: boolean; receipt: boolean; }

// Suppliers come from SUPPLIERS (the list actually shipped with the module);
// item numbers mirror the vendorItems shape the real picker offers.
const CATALOG: Omit<PurchaseItem, 'id' | 'delivered' | 'receipt'>[] = [
    { name: 'Gipsplade 13 mm × 48', supplier: SUPPLIERS[0], itemNumber: '321001', price: 4_272 },
    { name: 'Cement 25 kg × 30', supplier: SUPPLIERS[1], itemNumber: '550112', price: 1_620 },
    { name: 'Træskrue 5×60 mm × 6', supplier: SUPPLIERS[0], itemNumber: '874200', price: 894 },
    { name: 'Træbjælke 45×95 · 60 m', supplier: SUPPLIERS[1], itemNumber: '663840', price: 2_280 },
];

export const PurchaseDemo: React.FC = () => {
    const [items, setItems] = useState<PurchaseItem[]>([
        { id: 1, ...CATALOG[0], delivered: false, receipt: false },
    ]);
    const [touched, setTouched] = useState(false);

    const add = () => {
        const next = CATALOG[items.length % CATALOG.length];
        setItems((is) => [...is, { id: Date.now(), ...next, delivered: false, receipt: false }]);
        setTouched(true);
    };
    const toggleDelivered = (id: number) => {
        setItems((is) => is.map((i) => (i.id === id ? { ...i, delivered: !i.delivered } : i)));
        setTouched(true);
    };
    const attach = (id: number) => {
        setItems((is) => is.map((i) => (i.id === id ? { ...i, receipt: true } : i)));
        setTouched(true);
    };

    const total = items.reduce((s, i) => s + i.price, 0);
    const pending = items.filter((i) => !i.delivered).length;

    return (
        <DemoStage
            title="Indkøb · Villa Solbakken"
            onReset={touched ? () => { setItems([{ id: 1, ...CATALOG[0], delivered: false, receipt: false }]); setTouched(false); } : undefined}
        >
            <div className="space-y-2">
                {items.map((i) => (
                    <div key={i.id} className="rounded-control border border-border dark:border-border-dark p-3 animate-scale-in">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{i.name}</p>
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">{i.supplier} · varenr. {i.itemNumber}</p>
                            </div>
                            <p className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums shrink-0">
                                {kr(i.price)}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            <button
                                type="button"
                                onClick={() => toggleDelivered(i.id)}
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-caption font-bold transition-all duration-150 active:scale-[0.96]',
                                    i.delivered
                                        ? 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success'
                                        : 'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary'
                                )}
                            >
                                <CheckCircleIcon className="w-3 h-3" />
                                {i.delivered ? 'Leveret' : 'Markér leveret'}
                            </button>
                            <button
                                type="button"
                                onClick={() => attach(i.id)}
                                disabled={i.receipt}
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-caption font-bold transition-all duration-150 active:scale-[0.96] disabled:active:scale-100',
                                    i.receipt
                                        ? 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light'
                                        : 'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary'
                                )}
                            >
                                <CameraIcon className="w-3 h-3" />
                                {i.receipt ? 'Kvittering vedhæftet' : 'Vedhæft kvittering'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <DemoAction full className="mt-2.5" onClick={add}>
                <ShoppingCartIcon className="w-4 h-4" />
                Tilføj indkøb
            </DemoAction>

            <TapHint show={!touched}>Tilføj varer og markér dem leveret</TapHint>

            <div className="mt-3 rounded-control bg-bg-subtle dark:bg-bg-dark-muted p-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Indkøb i alt</span>
                    <span className="text-heading text-text-primary dark:text-text-dark-primary tabular-nums">{kr(total)}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Afventer levering</span>
                    <DemoPill tone={pending ? 'warning' : 'success'}>
                        {pending ? `${pending} stk.` : 'Alt leveret'}
                    </DemoPill>
                </div>
                <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary flex items-center gap-1.5 pt-1">
                    <TrendingUpIcon className="w-3.5 h-3.5" />
                    Med Budget aktivt bogføres beløbet automatisk på posten Materialer.
                </p>
            </div>
        </DemoStage>
    );
};

// ── Tilbud: linjer, moms og status ───────────────────────────────────────────

interface QuoteLine { id: number; text: string; qty: number; unit: string; price: number; }

const QUOTE_CATALOG: Omit<QuoteLine, 'id'>[] = [
    { text: 'Nedrivning af eksist. badeværelse', qty: 1, unit: 'stk', price: 12_500 },
    { text: 'Flisearbejde, vægge og gulv', qty: 24, unit: 'm²', price: 890 },
    { text: 'VVS — installation og montering', qty: 1, unit: 'stk', price: 18_400 },
    { text: 'Malerarbejde, loft', qty: 9, unit: 'm²', price: 240 },
];


export const QuoteDemo: React.FC = () => {
    const [lines, setLines] = useState<QuoteLine[]>([{ id: 1, ...QUOTE_CATALOG[0] }]);
    const [status, setStatus] = useState<QuotationStatus>('DRAFT');
    const touched = lines.length > 1 || status !== 'DRAFT';

    const add = () => {
        const next = QUOTE_CATALOG[lines.length % QUOTE_CATALOG.length];
        setLines((ls) => [...ls, { id: Date.now(), ...next }]);
    };

    const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const vat = subtotal * 0.25;

    return (
        <DemoStage
            title="Tilbud · Badeværelse, Nørrebrogade 42"
            onReset={touched ? () => { setLines([{ id: 1, ...QUOTE_CATALOG[0] }]); setStatus('DRAFT'); } : undefined}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Tilbud nr. 2026-041</p>
                <DemoPill tone={QUOTATION_STATUS[status].tone === 'info' ? 'accent' : QUOTATION_STATUS[status].tone}>
                    {QUOTATION_STATUS[status].label}
                </DemoPill>
            </div>

            <div className="mt-3 space-y-1.5">
                {lines.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-control border border-border dark:border-border-dark px-3 py-2.5 animate-scale-in">
                        <div className="min-w-0 flex-1">
                            <p className="text-caption font-semibold text-text-primary dark:text-text-dark-primary truncate">{l.text}</p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary tabular-nums">
                                {l.qty} {l.unit} × {kr(l.price)}
                            </p>
                        </div>
                        <p className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums shrink-0">
                            {kr(l.qty * l.price)}
                        </p>
                    </div>
                ))}
            </div>

            {status === 'DRAFT' && (
                <DemoAction full className="mt-2.5" tone="neutral" onClick={add}>
                    <PlusIcon className="w-4 h-4" />
                    Tilføj linje
                </DemoAction>
            )}

            <TapHint show={!touched}>Tilføj linjer — moms og total regnes med det samme</TapHint>

            <div className="mt-3 rounded-control bg-bg-subtle dark:bg-bg-dark-muted p-3 space-y-1.5">
                {[
                    ['Subtotal', kr(subtotal)],
                    ['Moms 25 %', kr(vat)],
                ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{k}</span>
                        <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary tabular-nums">{v}</span>
                    </div>
                ))}
                <div className="flex items-center justify-between border-t border-border dark:border-border-dark pt-2 mt-1">
                    <span className="text-label font-bold text-text-primary dark:text-text-dark-primary">Total inkl. moms</span>
                    <span className="text-heading text-text-primary dark:text-text-dark-primary tabular-nums">{kr(subtotal + vat)}</span>
                </div>
            </div>

            <div className="mt-3">
                {status === 'DRAFT' && (
                    <DemoAction full onClick={() => setStatus('SENT')}>
                        <SendIcon className="w-4 h-4" />
                        Send som PDF til kunden
                    </DemoAction>
                )}
                {status === 'SENT' && (
                    <div className="space-y-2 animate-slide-up">
                        <div className="rounded-control border border-border dark:border-border-dark p-3 flex items-center gap-2.5">
                            <FileTextIcon className="w-5 h-5 text-brand-primary dark:text-brand-light shrink-0" />
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                                <strong className="text-text-primary dark:text-text-dark-primary">tilbud-2026-041.pdf</strong> —
                                med firmanavn, CVR og logo fra jeres profil.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <DemoAction tone="danger" onClick={() => setStatus('REJECTED')}>
                                {QUOTATION_STATUS.REJECTED.label}
                            </DemoAction>
                            <DemoAction tone="success" onClick={() => setStatus('ACCEPTED')}>
                                <CheckCircleIcon className="w-4 h-4" />
                                {QUOTATION_STATUS.ACCEPTED.label}
                            </DemoAction>
                        </div>
                    </div>
                )}
                {status === 'ACCEPTED' && (
                    <div className="rounded-control border border-success-border dark:border-success/40 bg-success-subtle dark:bg-success-subtle-dark p-3.5 animate-scale-in">
                        <div className="flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5 text-success" />
                            <p className="text-label font-bold text-success-strong dark:text-success">Tilbud accepteret</p>
                        </div>
                        <p className="text-caption text-success-strong dark:text-success mt-1">
                            Linjerne kan nu bruges som udgangspunkt for opgaver og budgetposter på samme sag.
                        </p>
                    </div>
                )}
                {status === 'REJECTED' && (
                    <div className="rounded-control border border-danger-border dark:border-danger/40 bg-danger-subtle dark:bg-danger-subtle-dark p-3.5 animate-scale-in">
                        <p className="text-label font-bold text-danger-strong dark:text-danger">
                            {QUOTATION_STATUS.REJECTED.label}
                        </p>
                        <p className="text-caption text-danger-strong dark:text-danger mt-1">
                            Tilbuddet bliver stående på sagen med sine linjer, så du kan genbruge dem i næste bud.
                        </p>
                    </div>
                )}
            </div>
        </DemoStage>
    );
};
