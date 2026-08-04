import React, { useEffect, useState } from 'react';
import { cn } from '../../../ui';
import {
    AlertTriangleIcon, CalendarIcon, CheckCircleIcon, ChevronRightIcon, DownloadIcon,
    PauseIcon, PlayIcon, TrendingUpIcon, ZoomInIcon,
} from '../../../icons';
import { DemoAction, DemoChip, DemoMeter, DemoPill, DemoStage, TapHint, kr } from './shared';
import {
    KANBAN_COLUMNS, STATUS_VARIANT, statusLabel, PROJECT_DESTINATIONS,
    GANTT_ZOOM, TIME_ACTIVITY_TYPES, TIMER_UI, formatElapsed,
} from './demoFacts';
import type { TaskStatus } from '../../../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Work demos — Projekter, Opgaver, Tidsregistrering, Plan & Kalender.
// Labels and statuses come from ./demoFacts (re-exported from the modules).
// ─────────────────────────────────────────────────────────────────────────────

/** Badge variants used by the app → the tones DemoPill understands. */
const toneOf = (v: string): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' =>
    v === 'info' ? 'accent' : v === 'success' ? 'success' : v === 'danger' ? 'danger' : 'neutral';

// ── Projekter: projekt-hub med de fem destinationer ──────────────────────────

export const ProjectPulseDemo: React.FC = () => {
    const [dest, setDest] = useState<string>('overblik');
    const [touched, setTouched] = useState(false);
    const active = PROJECT_DESTINATIONS.find((d) => d.id === dest)!;

    return (
        <DemoStage
            title="Villa Solbakken · Sag 2026-118"
            onReset={touched ? () => { setDest('overblik'); setTouched(false); } : undefined}
        >
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
                {PROJECT_DESTINATIONS.map((d) => (
                    <DemoChip key={d.id} active={dest === d.id} onClick={() => { setDest(d.id); setTouched(true); }}>
                        {d.label}
                    </DemoChip>
                ))}
            </div>
            <TapHint show={!touched}>Skift destination — sagen holder konteksten</TapHint>

            <div key={dest} className="mt-3 animate-slide-up">
                {dest === 'overblik' && (
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                            {[{ v: '68%', l: 'Fremdrift' }, { v: '12', l: 'Åbne opgaver' }, { v: '3', l: 'Kræver svar' }].map((s) => (
                                <div key={s.l} className="rounded-control bg-bg-subtle dark:bg-bg-dark-muted px-2 py-2.5 text-center">
                                    <p className="text-heading text-text-primary dark:text-text-dark-primary tabular-nums">{s.v}</p>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{s.l}</p>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-control border border-border dark:border-border-dark p-3">
                            <div className="flex items-center gap-2">
                                <TrendingUpIcon className="w-4 h-4 text-brand-primary dark:text-brand-light" />
                                <p className="text-label font-bold text-text-primary dark:text-text-dark-primary flex-1">Projekt puls</p>
                                <DemoPill tone="success">På sporet</DemoPill>
                            </div>
                            <DemoMeter className="mt-2.5" value={0.68} />
                        </div>
                    </div>
                )}

                {dest === 'opgaver' && (
                    <div className="space-y-2">
                        {([
                            ['Gipsning, 1. sal', 'Jonas · i dag', 'Igangværende'],
                            ['Elinstallation, køkken', 'Mikkel · fredag', 'To Do'],
                            ['Isolering, tag', 'Forfaldt i går', 'Forfalden'],
                        ] as Array<[string, string, TaskStatus]>).map(([t, s, st]) => (
                            <div key={t} className="flex items-center gap-3 rounded-control border border-border dark:border-border-dark px-3 py-2.5">
                                <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundImage: 'linear-gradient(180deg, var(--sc-a), var(--sc-b))' }} />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{t}</span>
                                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">{s}</span>
                                </span>
                                <DemoPill tone={toneOf(STATUS_VARIANT[st])}>{statusLabel(st)}</DemoPill>
                            </div>
                        ))}
                    </div>
                )}

                {dest === 'plan' && (
                    <div className="rounded-control border border-border dark:border-border-dark p-3">
                        {['Nedrivning', 'Råhus', 'Installationer', 'Aflevering'].map((n, i) => (
                            <div key={n} className="flex items-center gap-3 py-1.5">
                                <span className="w-24 shrink-0 text-caption text-text-secondary dark:text-text-dark-secondary truncate">{n}</span>
                                <span className="relative flex-1 h-4 rounded-full bg-bg-muted dark:bg-bg-dark-muted overflow-hidden">
                                    <span
                                        className="absolute inset-y-0 rounded-full sc-reveal"
                                        style={{
                                            left: `${i * 18}%`,
                                            width: `${[34, 40, 32, 20][i]}%`,
                                            backgroundImage: 'linear-gradient(90deg, var(--sc-a), var(--sc-b))',
                                            ['--d' as string]: `${i * 90}ms`,
                                        }}
                                    />
                                </span>
                            </div>
                        ))}
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2 flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5" /> Aflevering 14. sep.
                        </p>
                    </div>
                )}

                {dest === 'okonomi' && (
                    <div className="space-y-2.5">
                        <div className="rounded-control border border-border dark:border-border-dark p-3">
                            <div className="flex items-baseline justify-between">
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Forbrug mod budget</p>
                                <p className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums">
                                    {kr(612_400)} / {kr(840_000)}
                                </p>
                            </div>
                            <DemoMeter className="mt-2" value={612_400 / 840_000} />
                        </div>
                        <div className="rounded-control bg-warning-subtle dark:bg-warning-subtle-dark p-3 flex items-start gap-2">
                            <AlertTriangleIcon className="w-4 h-4 text-warning-strong dark:text-warning shrink-0 mt-0.5" />
                            <p className="text-caption text-warning-strong dark:text-warning">
                                Posten <strong>Underleverandører</strong> er tæt på baseline.
                            </p>
                        </div>
                    </div>
                )}

                {dest === 'mere' && (
                    <div className="space-y-1.5">
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary px-1">
                            “Mere” åbner et ark med resten af sagens faner:
                        </p>
                        {active.subs.map((s) => (
                            <div key={s} className="flex items-center gap-3 rounded-control border border-border dark:border-border-dark px-3 py-2.5">
                                <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary flex-1">{s}</span>
                                <ChevronRightIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-3">
                Destinationerne følger de moduler, I har aktive — {active.subs.length === 1 ? '1 fane' : `${active.subs.length} faner`} under “{active.label}”.
            </p>
        </DemoStage>
    );
};

// ── Opgaver: kanban med de fire rigtige kolonner ─────────────────────────────

interface KanbanCard { id: number; title: string; who: string; col: number; }

const KANBAN_SEED: KanbanCard[] = [
    { id: 1, title: 'Spartling, gang', who: 'Jonas', col: 0 },
    { id: 2, title: 'Montering af køkken', who: 'Mikkel', col: 0 },
    { id: 3, title: 'Fugning, bad', who: 'Anders', col: 1 },
    { id: 4, title: 'Nedrivning, stue', who: 'Jonas', col: 2 },
];

export const KanbanDemo: React.FC = () => {
    const [cards, setCards] = useState<KanbanCard[]>(KANBAN_SEED);
    const [touched, setTouched] = useState(false);

    const advance = (id: number) => {
        setCards((cs) => cs.map((c) => (c.id === id ? { ...c, col: (c.col + 1) % KANBAN_COLUMNS.length } : c)));
        setTouched(true);
    };

    const doneIndex = KANBAN_COLUMNS.findIndex((c) => c.value === 'Udført');
    const done = cards.filter((c) => c.col === doneIndex).length;

    return (
        <DemoStage title="Opgaver · Kanban" onReset={touched ? () => { setCards(KANBAN_SEED); setTouched(false); } : undefined}>
            {/* Four columns, horizontally scrollable — as in TaskKanbanView. */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {KANBAN_COLUMNS.map((col, ci) => (
                    <div key={col.value} className="shrink-0 w-[46%] sm:w-[23%] rounded-control bg-bg-subtle dark:bg-bg-dark-muted p-2 min-h-[132px]">
                        <div className="flex items-center justify-between gap-1 mb-2">
                            <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary truncate">{col.label}</p>
                            <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary tabular-nums">
                                {cards.filter((c) => c.col === ci).length}
                            </span>
                        </div>
                        <div className="space-y-1.5">
                            {cards.filter((c) => c.col === ci).map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => advance(c.id)}
                                    aria-label={`${c.title} — flyt til næste kolonne`}
                                    className={cn(
                                        'block w-full rounded-control border bg-bg dark:bg-bg-dark-surface p-2 text-left',
                                        'shadow-card transition-all duration-200 active:scale-[0.97] animate-scale-in',
                                        col.value === 'Udført' ? 'border-success-border dark:border-success/40' : 'border-border dark:border-border-dark'
                                    )}
                                >
                                    <span className={cn(
                                        'block text-caption font-semibold leading-snug',
                                        col.value === 'Annulleret'
                                            ? 'text-text-tertiary dark:text-text-dark-tertiary line-through'
                                            : 'text-text-primary dark:text-text-dark-primary'
                                    )}>
                                        {c.title}
                                    </span>
                                    <span className="flex items-center gap-1 mt-1.5">
                                        <span
                                            className="flex w-4 h-4 items-center justify-center rounded-full text-white text-[9px] font-bold"
                                            style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}
                                        >
                                            {c.who[0]}
                                        </span>
                                        <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary truncate">{c.who}</span>
                                        {col.value === 'Udført' && <CheckCircleIcon className="w-3 h-3 text-success ml-auto" />}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <TapHint show={!touched}>Tryk på et kort for at flytte det videre</TapHint>

            <div className="mt-3 rounded-control bg-bg-subtle dark:bg-bg-dark-muted p-3">
                <div className="flex items-center justify-between">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Udført på sagen</span>
                    <span className="text-caption font-bold text-text-primary dark:text-text-dark-primary tabular-nums">
                        {done} / {cards.length}
                    </span>
                </div>
                <DemoMeter className="mt-2" value={done / cards.length} tone={done === cards.length ? 'success' : 'accent'} />
            </div>
        </DemoStage>
    );
};

// ── Tidsregistrering: den flydende timer + Gem & Stop ────────────────────────

const WEEK = ['Man', 'Tir', 'Ons', 'Tor', 'Fre'];
const BASE_HOURS = [7.5, 8, 6.5, 7, 0];

export const TimerDemo: React.FC = () => {
    const [running, setRunning] = useState(false);
    const [paused, setPaused] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [stopping, setStopping] = useState(false);
    const [activity, setActivity] = useState<string>(TIME_ACTIVITY_TYPES[2]);
    const [logged, setLogged] = useState<{ hours: number; activity: string }[]>([]);
    const [exported, setExported] = useState(false);

    useEffect(() => {
        if (!running || paused) return;
        // 1 real second = 6 simulated minutes, so the week bar visibly moves.
        const t = window.setInterval(() => setSeconds((s) => s + 360), 1000);
        return () => window.clearInterval(t);
    }, [running, paused]);

    const todayHours = BASE_HOURS[4] + seconds / 3600 + logged.reduce((a, b) => a + b.hours, 0);
    const hours = [...BASE_HOURS.slice(0, 4), todayHours];
    const total = hours.reduce((a, b) => a + b, 0);
    const max = Math.max(9, ...hours);
    const touched = running || seconds > 0 || logged.length > 0;

    const reset = () => {
        setRunning(false); setPaused(false); setSeconds(0);
        setStopping(false); setLogged([]); setExported(false);
    };
    const save = () => {
        setLogged((l) => [...l, { hours: seconds / 3600, activity }]);
        setSeconds(0); setRunning(false); setPaused(false); setStopping(false);
    };

    return (
        <DemoStage title="Tid · Uge 34" onReset={touched ? reset : undefined}>
            {/* The floating timer pill, as it docks over the app. */}
            <div className="flex justify-center py-2">
                {running ? (
                    <div className="flex items-center gap-3 rounded-full border border-white/20 bg-bg-dark px-2.5 py-2 text-white shadow-raised">
                        <span className={cn(
                            'flex w-8 h-8 items-center justify-center rounded-full',
                            paused ? 'bg-warning/20 text-warning' : 'bg-success/20'
                        )}>
                            {paused ? <PauseIcon className="w-4 h-4" /> : <span className="block w-2.5 h-2.5 rounded-full bg-success animate-pulse" />}
                        </span>
                        <span className="flex flex-col">
                            <span className={cn('font-mono font-bold text-sm leading-none tabular-nums', paused ? 'text-warning' : 'text-success')}>
                                {formatElapsed(seconds)}
                            </span>
                            <span className="text-caption uppercase tracking-wider font-medium text-text-dark-secondary leading-none mt-0.5">
                                {paused ? TIMER_UI.paused : TIMER_UI.running}
                            </span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setPaused((p) => !p)}
                            aria-label={paused ? 'Genoptag timer' : 'Sæt timer på pause'}
                            className="p-1.5 rounded-full text-text-dark-secondary hover:text-white hover:bg-white/10 transition-colors"
                        >
                            {paused ? <PlayIcon className="w-3 h-3" /> : <PauseIcon className="w-3 h-3" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setPaused(true); setStopping(true); }}
                            aria-label="Stop timer"
                            className="p-1.5 rounded-full text-text-dark-secondary hover:text-danger hover:bg-danger/20 transition-colors"
                        >
                            <span className="block w-2.5 h-2.5 bg-current rounded-[1px]" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => { setRunning(true); setPaused(false); }}
                        className="flex items-center gap-3 rounded-full border border-white/20 bg-bg-dark px-4 py-2.5 text-white shadow-raised transition-transform duration-150 active:scale-[0.97]"
                    >
                        <PlayIcon className="w-4 h-4" />
                        <span className="text-label font-semibold">{TIMER_UI.start}</span>
                    </button>
                )}
            </div>
            <p className="text-caption text-center text-text-tertiary dark:text-text-dark-tertiary">
                Timeren kan trækkes rundt og dokker i kanten, mens du bruger resten af appen.
            </p>

            <TapHint show={!touched}>Tryk “{TIMER_UI.start}” — timeren kører videre i baggrunden</TapHint>

            {/* Gem & Stop — the real stop modal's fields. */}
            {stopping && (
                <div className="mt-3 rounded-control border border-border dark:border-border-dark p-3.5 animate-slide-up">
                    <div className="rounded-card bg-brand-subtle dark:bg-brand-subtle-dark p-3 text-center">
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{TIMER_UI.total}</p>
                        <p className="text-title font-bold text-brand-primary dark:text-brand-light tabular-nums mt-0.5">
                            {(seconds / 3600).toFixed(2).replace('.', ',')} <span className="text-label font-medium text-text-secondary dark:text-text-dark-secondary">timer</span>
                        </p>
                    </div>
                    <label className="block mt-3">
                        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Aktivitet</span>
                        <select
                            value={activity}
                            onChange={(e) => setActivity(e.target.value)}
                            className="w-full min-h-11 mt-1 rounded-control border border-border-strong dark:border-border-dark-strong bg-bg dark:bg-bg-dark-surface px-3 text-body text-text-primary dark:text-text-dark-primary"
                        >
                            {TIME_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </label>
                    <DemoAction full className="mt-3" onClick={save}>{TIMER_UI.saveAndStop}</DemoAction>
                </div>
            )}

            <div className="mt-3 rounded-control bg-bg-subtle dark:bg-bg-dark-muted p-3">
                <div className="flex items-baseline justify-between">
                    <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary">Ugens timer</p>
                    <p className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums">
                        {total.toFixed(1).replace('.', ',')} t
                    </p>
                </div>
                <div className="flex items-end gap-2 h-24 mt-2">
                    {hours.map((h, i) => (
                        <div key={WEEK[i]} className="flex-1 flex flex-col items-center gap-1.5">
                            <span
                                className="w-full rounded-t-control transition-[height] duration-500 ease-out"
                                style={{
                                    height: `${Math.max(3, (h / max) * 72)}px`,
                                    backgroundImage: i === 4 ? 'linear-gradient(180deg, var(--sc-a), var(--sc-b))' : undefined,
                                    backgroundColor: i === 4 ? undefined : 'var(--color-border-strong)',
                                }}
                            />
                            <span className={cn('text-caption tabular-nums',
                                i === 4 ? 'font-bold text-text-primary dark:text-text-dark-primary' : 'text-text-tertiary dark:text-text-dark-tertiary')}>
                                {WEEK[i]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {logged.length > 0 && (
                <div className="mt-3 space-y-2 animate-slide-up">
                    {logged.map((l, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-control border border-border dark:border-border-dark px-3 py-2.5">
                            <span className="min-w-0 flex-1">
                                <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                                    [{l.activity}] {l.hours.toFixed(2).replace('.', ',')} t
                                </span>
                                <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">
                                    Villa Solbakken · registreret i dag
                                </span>
                            </span>
                        </div>
                    ))}
                    {exported ? (
                        <div className="rounded-control bg-success-subtle dark:bg-success-subtle-dark p-3 flex items-center gap-2 animate-scale-in">
                            <CheckCircleIcon className="w-4 h-4 text-success shrink-0" />
                            <p className="text-caption text-success-strong dark:text-success">
                                Excel-fil hentet — Dato, Bruger, Timer, Beskrivelse og Opgave-ID.
                            </p>
                        </div>
                    ) : (
                        <DemoAction tone="neutral" full onClick={() => setExported(true)}>
                            <DownloadIcon className="w-4 h-4" />
                            {TIMER_UI.exportExcel}
                        </DemoAction>
                    )}
                </div>
            )}
        </DemoStage>
    );
};

// ── Plan: den read-only Gantt med zoom ───────────────────────────────────────

interface GanttBar { name: string; start: number; len: number; progress: number; }

const GANTT_BARS: GanttBar[] = [
    { name: 'Villa Solbakken', start: 0, len: 11, progress: 0.68 },
    { name: 'Rækkehus, Valby', start: 4, len: 8, progress: 0.35 },
    { name: 'Tagrenovering', start: 9, len: 5, progress: 0.1 },
    { name: 'Erhverv, Amager', start: 12, len: 4, progress: 0 },
];
const WEEKS = 16;

export const GanttDemo: React.FC = () => {
    const [zoom, setZoom] = useState<string>('month');
    const [open, setOpen] = useState<string | null>(null);
    const touched = zoom !== 'month' || open !== null;
    const zoomDef = GANTT_ZOOM.find((z) => z.level === zoom)!;
    // Wider zoom = fewer columns visible; mirrors pixelsPerDay in GanttView.
    const visibleWeeks = zoom === 'week' ? 6 : zoom === 'month' ? 12 : WEEKS;

    return (
        <DemoStage
            title="Tidsplan · alle sager"
            onReset={touched ? () => { setZoom('month'); setOpen(null); } : undefined}
        >
            <div className="flex items-center gap-1.5">
                <ZoomInIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary shrink-0" />
                {GANTT_ZOOM.map((z) => (
                    <DemoChip key={z.level} active={zoom === z.level} onClick={() => setZoom(z.level)}>{z.label}</DemoChip>
                ))}
            </div>

            <TapHint show={!touched}>Skift zoom, og tryk på en bjælke for at åbne sagen</TapHint>

            <div className="mt-3 space-y-1.5">
                {GANTT_BARS.map((b) => {
                    const left = Math.min(100, (b.start / visibleWeeks) * 100);
                    const width = Math.max(6, Math.min(100 - left, (b.len / visibleWeeks) * 100));
                    return (
                        <div key={b.name} className="flex items-center gap-2">
                            <span className="w-[104px] shrink-0 text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                                {b.name}
                            </span>
                            <div className="relative flex-1 h-9 rounded-control bg-bg-subtle dark:bg-bg-dark-muted overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setOpen(b.name)}
                                    aria-label={`${b.name} — åbn sagen`}
                                    className="absolute inset-y-1 rounded-control shadow-card overflow-hidden transition-all duration-300 ease-out active:scale-[0.97]"
                                    style={{ left: `${left}%`, width: `${width}%`, backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}
                                >
                                    <span className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${b.progress * 100}%` }} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-2">
                Zoom: {zoomDef.label} · {zoomDef.pixelsPerDay} px pr. dag
            </p>

            {open && (
                <div className="mt-3 rounded-control border border-border dark:border-border-dark p-3 animate-slide-up">
                    <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">{open}</p>
                    {([
                        ['Status', 'I gang'],
                        ['Fremgang', `${Math.round((GANTT_BARS.find((b) => b.name === open)?.progress ?? 0) * 100)}%`],
                        ['Periode', '04.05.2026 - 14.09.2026'],
                    ] as Array<[string, string]>).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-caption mt-1.5">
                            <span className="text-text-secondary dark:text-text-dark-secondary">{k}:</span>
                            <span className="font-semibold text-text-primary dark:text-text-dark-primary">{v}</span>
                        </div>
                    ))}
                    <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-2">
                        Gantt-visningen er et overblik: du zoomer og åbner sager herfra. Datoerne ændrer du inde på selve sagen.
                    </p>
                </div>
            )}
        </DemoStage>
    );
};
