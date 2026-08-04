import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../../ui';
import {
    CameraIcon, CheckIcon, CheckCircleIcon, MessageSquareIcon, FileTextIcon,
    PinIcon, CalculatorIcon,
} from '../../../icons';
import { DemoAction, DemoMeter, DemoPill, DemoStage, TapHint } from './shared';
import {
    FIELD_BAR, HANDOVER_STEPS, STEPPER_STAGES, WORKSPACE_TABS,
    PUNCH_STATUSES, PUNCH_TONE, PUNCH_PIN_HEX, formatElapsed, statusLabel,
} from './demoFacts';
import type { PunchListItemStatus, TaskStatus } from '../../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Site demos — Udførelse, KS & Aflevering, AR & Opmåling.
//
// Labels, statuses, tabs and step sequences come from ./demoFacts, which
// re-exports them from the owning modules. Local state only; no network.
// ─────────────────────────────────────────────────────────────────────────────

// ── Udførelse & Kommunikation ────────────────────────────────────────────────

type Handover = 'none' | 'submitted' | 'approved';

export const CheckInDemo: React.FC = () => {
    const [checkedIn, setCheckedIn] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [logged, setLogged] = useState(0);
    // The real bar gates Færdigmeld on permission (canFaerdigmeld), not on
    // elapsed time — so one completed check-in is enough to offer it.
    const [everCheckedIn, setEverCheckedIn] = useState(false);
    const [handover, setHandover] = useState<Handover>('none');
    const [tab, setTab] = useState(WORKSPACE_TABS[0].id);
    const [photos, setPhotos] = useState(0);
    const [messages, setMessages] = useState(0);

    useEffect(() => {
        if (!checkedIn) return;
        const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => window.clearInterval(t);
    }, [checkedIn]);

    // Mirrors stepperIndexFor: work starts the task, handover moves it on.
    const status: TaskStatus =
        handover === 'approved' ? 'Udført'
            : handover === 'submitted' ? 'Igangværende'
                : (checkedIn || everCheckedIn) ? 'Igangværende'
                    : 'To Do';
    const stepIndex = handover === 'approved' ? 3 : handover === 'submitted' ? 2 : status === 'Igangværende' ? 1 : 0;
    const handoverStep = handover === 'approved' ? HANDOVER_STEPS.length : handover === 'submitted' ? 1 : 0;
    const touched = everCheckedIn || handover !== 'none' || photos > 0 || messages > 0;

    const reset = () => {
        setCheckedIn(false); setSeconds(0); setLogged(0);
        setHandover('none'); setTab(WORKSPACE_TABS[0].id); setPhotos(0); setMessages(0);
        setEverCheckedIn(false);
    };
    const checkOut = () => { setCheckedIn(false); setLogged((l) => l + seconds); setSeconds(0); };

    return (
        <DemoStage title="Flisearbejde · Villa Solbakken" onReset={touched ? reset : undefined} className="p-0">
            {/* Status stepper — STEPPER_STAGES from the real task workspace. */}
            <div className="border-b border-border dark:border-border-dark px-3.5 py-3">
                <ol className="flex items-start">
                    {STEPPER_STAGES.map((label, i) => {
                        const filled = i < stepIndex || (stepIndex === STEPPER_STAGES.length - 1 && i === stepIndex);
                        const isCurrent = i === stepIndex && stepIndex !== STEPPER_STAGES.length - 1;
                        return (
                            <li key={label} className="relative flex flex-1 flex-col items-center">
                                {i > 0 && (
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'absolute top-[6px] left-[calc(-50%+10px)] right-[calc(50%+10px)] h-0.5 rounded-full',
                                            stepIndex >= i ? 'bg-brand-primary' : 'bg-border dark:bg-border-dark'
                                        )}
                                    />
                                )}
                                <span className="flex h-3.5 w-3.5 items-center justify-center">
                                    {filled ? <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
                                        : isCurrent ? <span className="h-3.5 w-3.5 rounded-full border-[3px] border-brand-primary bg-bg dark:bg-bg-dark-surface" />
                                            : <span className="h-2.5 w-2.5 rounded-full bg-border-strong dark:bg-border-dark-strong" />}
                                </span>
                                <span className={cn(
                                    'mt-1 text-caption',
                                    i <= stepIndex ? 'font-semibold text-text-primary dark:text-text-dark-primary'
                                        : 'text-text-tertiary dark:text-text-dark-tertiary'
                                )}>
                                    {label}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* Tab bar — the real WORKSPACE_TABS. */}
            <div className="flex gap-1 overflow-x-auto hide-scrollbar border-b border-border dark:border-border-dark px-2">
                {WORKSPACE_TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        aria-current={tab === t.id ? 'page' : undefined}
                        className={cn(
                            'shrink-0 px-3 py-2.5 text-caption font-semibold border-b-2 -mb-px transition-colors',
                            tab === t.id
                                ? 'border-brand-primary text-brand-primary dark:text-brand-light'
                                : 'border-transparent text-text-secondary dark:text-text-dark-secondary'
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                        Villa Solbakken · {statusLabel(status)}
                    </p>
                    {handover === 'submitted' && <DemoPill tone="warning">Afventer godkendelse</DemoPill>}
                    {handover === 'approved' && <DemoPill tone="success">Godkendt</DemoPill>}
                </div>

                {tab === 'overblik' && (
                    <div className="space-y-2 animate-slide-up">
                        <div className="flex items-center justify-between rounded-control bg-bg-subtle dark:bg-bg-dark-muted px-3 py-2.5">
                            <span className="text-label text-text-secondary dark:text-text-dark-secondary">Total tid på opgaven</span>
                            <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary tabular-nums">
                                {formatElapsed(logged + seconds)}
                            </span>
                        </div>
                        {checkedIn && (
                            <p className="flex items-center gap-2 text-label font-medium text-success-strong dark:text-success">
                                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                                Morten Iversen · {formatElapsed(seconds)}
                            </p>
                        )}
                    </div>
                )}

                {tab === 'dokumentation' && (
                    <div className="space-y-2 animate-slide-up">
                        <DemoAction tone="neutral" full onClick={() => setPhotos((p) => p + 1)}>
                            <CameraIcon className="w-4 h-4" /> Upload fotos &amp; filer ({photos})
                        </DemoAction>
                        {photos > 0 && (
                            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                                {Array.from({ length: photos }).map((_, i) => (
                                    <div key={i} className="shrink-0 w-14 h-14 rounded-control bg-bg-muted dark:bg-bg-dark-muted border border-border dark:border-border-dark flex items-center justify-center animate-scale-in">
                                        <CameraIcon className="w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'chat' && (
                    <div className="space-y-2 animate-slide-up">
                        <DemoAction tone="neutral" full onClick={() => setMessages((m) => m + 1)}>
                            <MessageSquareIcon className="w-4 h-4" /> Send besked ({messages})
                        </DemoAction>
                        {messages > 0 && (
                            <div className="rounded-card rounded-bl-sm bg-bg-muted dark:bg-bg-dark-muted px-3 py-2 animate-slide-up">
                                <p className="text-caption text-text-primary dark:text-text-dark-primary">
                                    <strong>@Jonas</strong> — “Fugen er tør i morgen tidlig.”
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'filer' && (
                    <div className="grid grid-cols-2 gap-2 animate-slide-up">
                        {['plan-1sal-rev-C.pdf', 'ks-skema.pdf'].map((f) => (
                            <div key={f} className="flex items-center gap-2 rounded-control border border-border dark:border-border-dark px-2.5 py-2">
                                <FileTextIcon className="w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />
                                <span className="text-caption text-text-primary dark:text-text-dark-primary truncate">{f}</span>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'team' && (
                    <div className="space-y-1.5 animate-slide-up">
                        {[['MI', 'Morten Iversen', 'OWNER'], ['JB', 'Jonas Bech', 'EMPLOYEE']].map(([ini, name, role]) => (
                            <div key={name} className="flex items-center gap-2.5 rounded-control border border-border dark:border-border-dark px-3 py-2">
                                <span className="flex w-7 h-7 items-center justify-center rounded-full text-white text-caption font-bold"
                                    style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}>{ini}</span>
                                <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary flex-1 truncate">{name}</span>
                                <DemoPill>{role}</DemoPill>
                            </div>
                        ))}
                    </div>
                )}

                {/* Aflevering card — HANDOVER_STEPS, shown once work is logged. */}
                {(handover !== 'none' || (!checkedIn && everCheckedIn)) && (
                    <div className="rounded-control border border-border dark:border-border-dark p-3 animate-slide-up">
                        <p className="text-label font-bold text-text-primary dark:text-text-dark-primary mb-2.5">Aflevering</p>
                        <ol className="space-y-2">
                            {HANDOVER_STEPS.map((step, i) => {
                                const done = i < handoverStep;
                                const isCurrent = i === handoverStep;
                                return (
                                    <li key={step.title} className="flex items-center gap-3">
                                        <span className={cn(
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-bold',
                                            done ? 'bg-brand-primary text-white'
                                                : isCurrent ? 'border-2 border-brand-primary text-brand-primary dark:text-brand-light'
                                                    : 'bg-bg-muted text-text-tertiary dark:bg-bg-dark-muted dark:text-text-dark-tertiary'
                                        )}>
                                            {done ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                                        </span>
                                        <span className="min-w-0">
                                            <span className={cn('block text-label font-semibold',
                                                done || isCurrent ? 'text-text-primary dark:text-text-dark-primary'
                                                    : 'text-text-tertiary dark:text-text-dark-tertiary')}>
                                                {step.title}
                                            </span>
                                            <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">{step.desc}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                )}
            </div>

            {/* Bottom action bar — mirrors TaskWorkspaceContent's fixed bar. */}
            <div className="border-t border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                    {checkedIn ? (
                        <>
                            <div className="min-w-0 grow">
                                <p className="font-mono text-body tabular-nums text-text-primary dark:text-text-dark-primary">
                                    {formatElapsed(seconds)}
                                </p>
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{FIELD_BAR.checkedIn}</p>
                            </div>
                            <DemoAction tone="danger" onClick={checkOut}>{FIELD_BAR.checkOut}</DemoAction>
                        </>
                    ) : handover === 'approved' ? (
                        <p className="grow text-label font-semibold text-success-strong dark:text-success">
                            Opgaven er godkendt og afsluttet
                        </p>
                    ) : (
                        <>
                            <p className="min-w-0 grow truncate text-label text-text-secondary dark:text-text-dark-secondary">
                                {everCheckedIn ? `${formatElapsed(logged)} registreret` : FIELD_BAR.nobodyCheckedIn}
                            </p>
                            {everCheckedIn && handover === 'none' && (
                                <DemoAction tone="neutral" onClick={() => setHandover('submitted')}>{FIELD_BAR.faerdigmeld}</DemoAction>
                            )}
                            {handover === 'submitted' && (
                                <DemoAction tone="neutral" onClick={() => setHandover('approved')}>{FIELD_BAR.godkend}</DemoAction>
                            )}
                            {handover === 'none' && (
                                <DemoAction onClick={() => { setCheckedIn(true); setEverCheckedIn(true); }}>{FIELD_BAR.checkIn}</DemoAction>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="px-3.5 pb-3">
                <TapHint show={!touched}>Tryk “{FIELD_BAR.checkIn}” — timeren starter i handlingsbjælken</TapHint>
            </div>
        </DemoStage>
    );
};

// ── KS & Aflevering ──────────────────────────────────────────────────────────

interface Defect { id: number; x: number; y: number; status: PunchListItemStatus; }

const nextStatus = (s: PunchListItemStatus): PunchListItemStatus =>
    PUNCH_STATUSES[(PUNCH_STATUSES.indexOf(s) + 1) % PUNCH_STATUSES.length];

const SEED: Defect[] = [{ id: 1, x: 32, y: 34, status: 'Åben' }];

export const DefectDemo: React.FC = () => {
    const [defects, setDefects] = useState<Defect[]>(SEED);
    const [touched, setTouched] = useState(false);
    const nextId = useRef(2);

    const addPin = (e: React.MouseEvent<SVGSVGElement>) => {
        if (defects.length >= 6) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setDefects((d) => [...d, {
            id: nextId.current++,
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            status: 'Åben',
        }]);
        setTouched(true);
    };

    const cycle = (id: number) => {
        setDefects((d) => d.map((p) => (p.id === id ? { ...p, status: nextStatus(p.status) } : p)));
        setTouched(true);
    };

    const reset = () => { setDefects(SEED); setTouched(false); nextId.current = 2; };
    const solved = defects.filter((d) => d.status === 'Løst').length;
    const allDone = defects.length > 0 && solved === defects.length;

    return (
        <DemoStage title="Mangelliste · Plan 1. sal" onReset={touched ? reset : undefined}>
            <div className="relative rounded-control overflow-hidden border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
                <svg viewBox="0 0 100 62" className="w-full block cursor-crosshair" onClick={addPin} role="presentation">
                    <g stroke="currentColor" className="text-text-tertiary dark:text-text-dark-tertiary" strokeWidth="0.7" fill="none">
                        <path d="M6 6 H94 V56 H6 Z" />
                        <path d="M52 6 V32 M6 32 H94 M52 44 V56" />
                    </g>
                    <rect x="7" y="7" width="44" height="24" fill="currentColor" className="text-brand-primary" opacity="0.07" />
                    <rect x="53" y="33" width="40" height="22" fill="currentColor" className="text-brand-primary" opacity="0.07" />
                    <text x="10" y="14" fontSize="3.4" fill="currentColor" className="text-text-tertiary dark:text-text-dark-tertiary">Stue</text>
                    <text x="56" y="41" fontSize="3.4" fill="currentColor" className="text-text-tertiary dark:text-text-dark-tertiary">Bad</text>
                </svg>

                {defects.map((d) => (
                    <button
                        key={d.id}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); cycle(d.id); }}
                        aria-label={`Mangel ${d.id} — ${d.status}. Tryk for næste status.`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center animate-scale-in"
                        style={{ left: `${d.x}%`, top: `${d.y}%` }}
                    >
                        <span className="absolute w-6 h-6 rounded-full opacity-30" style={{ background: PUNCH_PIN_HEX[d.status] }} />
                        <span
                            className="relative flex w-4 h-4 items-center justify-center rounded-full text-white shadow-card transition-colors duration-200"
                            style={{ background: PUNCH_PIN_HEX[d.status] }}
                        >
                            {d.status === 'Løst' && <CheckIcon className="w-3 h-3" />}
                        </span>
                    </button>
                ))}
            </div>

            <TapHint show={!touched}>Tryk på tegningen for at sætte en mangel</TapHint>

            <div className="mt-3 space-y-2">
                {defects.map((d, i) => (
                    <button
                        key={d.id}
                        type="button"
                        onClick={() => cycle(d.id)}
                        className="flex w-full items-center gap-3 rounded-control border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface px-3 py-2.5 min-h-[44px] text-left transition-all duration-150 active:scale-[0.99]"
                    >
                        <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ background: PUNCH_PIN_HEX[d.status] }}>
                            <PinIcon className="w-3.5 h-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                                {['Fuge mangler ved bruseniche', 'Ridse i vindueskarm', 'Manglende maling bag radiator', 'Løs fliseskinne', 'Utæt lyskontakt', 'Skæv liste ved dør'][i % 6]}
                            </span>
                            <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">
                                Tryk for næste status
                            </span>
                        </span>
                        <DemoPill tone={PUNCH_TONE[d.status]}>{d.status}</DemoPill>
                    </button>
                ))}
            </div>

            <div className="mt-3 rounded-control bg-bg-subtle dark:bg-bg-dark-muted p-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">
                        {solved} af {defects.length} løst
                    </span>
                    <span className="text-caption font-bold text-text-primary dark:text-text-dark-primary tabular-nums">
                        {defects.length ? Math.round((solved / defects.length) * 100) : 0}%
                    </span>
                </div>
                <DemoMeter className="mt-2" value={defects.length ? solved / defects.length : 0} tone={allDone ? 'success' : 'accent'} />
            </div>

            {allDone && (
                <div className="mt-3 rounded-control border border-success-border dark:border-success/40 bg-success-subtle dark:bg-success-subtle-dark p-3 flex items-center gap-2.5 animate-scale-in">
                    <FileTextIcon className="w-5 h-5 text-success shrink-0" />
                    <p className="text-caption text-success-strong dark:text-success">
                        <strong>Alle mangler er løst.</strong> Afleveringsrapporten samler pins, fotos og historik i én PDF.
                    </p>
                </div>
            )}
        </DemoStage>
    );
};

// ── AR & Opmåling ────────────────────────────────────────────────────────────

interface Pt { x: number; y: number; }

/** Metres per viewBox unit — the fixed scale this simulated room is drawn at. */
const M_PER_UNIT = 0.06;

const shoelaceArea = (pts: Pt[]): number => {
    if (pts.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum / 2) * M_PER_UNIT * M_PER_UNIT;
};

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y) * M_PER_UNIT;

export const ScanDemo: React.FC = () => {
    const [pts, setPts] = useState<Pt[]>([]);
    const closed = pts.length >= 4;
    const area = closed ? shoelaceArea(pts) : 0;

    const place = (e: React.MouseEvent<SVGSVGElement>) => {
        if (closed) return;
        const rect = e.currentTarget.getBoundingClientRect();
        setPts((p) => [...p, {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 62,
        }]);
    };

    const perimeter = pts.length > 1
        ? pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), closed ? dist(pts[pts.length - 1], pts[0]) : 0)
        : 0;

    return (
        <DemoStage title="AR-opmåling · Stue" onReset={pts.length ? () => setPts([]) : undefined}>
            <div className="relative rounded-control overflow-hidden bg-[#0B1220]">
                <svg viewBox="0 0 100 62" className="w-full block cursor-crosshair" onClick={place} role="presentation">
                    <defs>
                        <linearGradient id="sc-ar-floor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1E293B" />
                            <stop offset="100%" stopColor="#0B1220" />
                        </linearGradient>
                    </defs>
                    <rect width="100" height="62" fill="url(#sc-ar-floor)" />
                    <g stroke="#fff" strokeOpacity="0.09" strokeWidth="0.4">
                        {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} x1="0" y1={i * 7} x2="100" y2={i * 7} />)}
                        {Array.from({ length: 12 }).map((_, i) => <line key={`v${i}`} x1={i * 9} y1="0" x2={i * 9} y2="62" />)}
                    </g>
                    <path d="M14 52 L14 16 L58 8 L58 44 Z" fill="#fff" fillOpacity="0.04" stroke="#fff" strokeOpacity="0.16" strokeWidth="0.5" />
                    <path d="M58 8 L88 18 L88 50 L58 44" fill="#fff" fillOpacity="0.02" stroke="#fff" strokeOpacity="0.14" strokeWidth="0.5" />

                    <g stroke="var(--sc-a)" strokeWidth="1.2" fill="none" strokeLinecap="round">
                        <path d="M6 12 V6 H12 M88 6 H94 V12 M94 50 V56 H88 M12 56 H6 V50" />
                    </g>

                    {pts.length > 1 && (
                        <polyline
                            points={pts.map((p) => `${p.x},${p.y}`).join(' ') + (closed ? ` ${pts[0].x},${pts[0].y}` : '')}
                            fill={closed ? 'var(--sc-a)' : 'none'}
                            fillOpacity={closed ? 0.2 : 0}
                            stroke="#fff"
                            strokeWidth="0.9"
                            strokeLinejoin="round"
                        />
                    )}
                    {pts.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r="2.6" fill="#fff" />
                            <circle cx={p.x} cy={p.y} r="4.4" fill="#fff" fillOpacity="0.25" />
                        </g>
                    ))}
                    {pts.length > 1 && pts.slice(1).map((p, i) => {
                        const a = pts[i];
                        return (
                            <text key={i} x={(a.x + p.x) / 2} y={(a.y + p.y) / 2 - 2} fontSize="3.4" fill="#fff" fillOpacity="0.85" textAnchor="middle">
                                {dist(a, p).toFixed(2).replace('.', ',')} m
                            </text>
                        );
                    })}

                    {!closed && <rect y="0" width="100" height="1" fill="var(--sc-a)" opacity="0.5" className="sc-scanline" />}
                </svg>

                {pts.length === 0 && (
                    <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
                        <span className="sc-glass rounded-full px-3 py-1.5 text-caption font-semibold text-white">
                            Tryk i hjørnerne — 4 punkter lukker rummet
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                    { label: 'Punkter', value: `${pts.length}/4` },
                    { label: 'Omkreds', value: perimeter > 0 ? `${perimeter.toFixed(1).replace('.', ',')} m` : '—' },
                    { label: 'Areal', value: closed ? `${area.toFixed(1).replace('.', ',')} m²` : '—' },
                ].map((s) => (
                    <div key={s.label} className="rounded-control bg-bg-subtle dark:bg-bg-dark-muted px-2 py-2 text-center">
                        <p className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums">{s.value}</p>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{s.label}</p>
                    </div>
                ))}
            </div>

            {closed && (
                <div className="mt-3 rounded-control border border-border dark:border-border-dark p-3 animate-slide-up">
                    <div className="flex items-center gap-2">
                        <CalculatorIcon className="w-4 h-4 text-brand-primary dark:text-brand-light" />
                        <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">Sendt til malingsberegneren</p>
                    </div>
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1">
                        {area.toFixed(1).replace('.', ',')} m² · 2 lag · 10 % spild →{' '}
                        <strong className="text-text-primary dark:text-text-dark-primary">
                            {Math.max(1, Math.ceil((area * 2 * 1.1) / 10))} × 10 L
                        </strong>
                    </p>
                </div>
            )}
            <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-2">
                Simuleret viewport. På en enhed med AR-understøttelse måler RoomMapper i det virkelige rum;
                ellers falder modulet tilbage til opmåling på foto.
            </p>
        </DemoStage>
    );
};
