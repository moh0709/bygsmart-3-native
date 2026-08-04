import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../../ui';
import {
    BoxIcon, CheckCircleIcon, CloudIcon, DropboxIcon, EyeIcon, FileTextIcon,
    GoogleIcon, LockIcon, OneDriveIcon, PaperclipIcon, SendIcon, SparklesIcon, UsersIcon,
} from '../../../icons';
import { DemoAction, DemoChip, DemoMeter, DemoPill, DemoStage, TapHint, kr } from './shared';
import { CLIENT_TABS, CLOUD_PROVIDERS, NEGOTIATION_UI } from './demoFacts';

// ─────────────────────────────────────────────────────────────────────────────
// People & platform demos — Team, Kunde-portal, Partnere, AI, Integrationer.
// ─────────────────────────────────────────────────────────────────────────────

// ── Team: invitation og roller ───────────────────────────────────────────────

type Role = 'Medarbejder' | 'Leder';
interface Member { name: string; email: string; role: Role; pending: boolean; }

const TEAM_SEED: Member[] = [
    { name: 'Morten Iversen', email: 'morten@byg-nord.dk', role: 'Leder', pending: false },
    { name: 'Jonas Bech', email: 'jonas@byg-nord.dk', role: 'Medarbejder', pending: false },
];
const INVITEES = [
    { name: 'Mikkel Hald', email: 'mikkel@byg-nord.dk' },
    { name: 'Sara Lund', email: 'sara@byg-nord.dk' },
    { name: 'Ali Rahimi', email: 'ali@byg-nord.dk' },
];
const SEATS = 5;

export const InviteDemo: React.FC = () => {
    const [team, setTeam] = useState<Member[]>(TEAM_SEED);
    const [role, setRole] = useState<Role>('Medarbejder');
    const touched = team.length > TEAM_SEED.length;

    const invite = () => {
        const next = INVITEES[team.length - TEAM_SEED.length];
        if (!next) return;
        setTeam((t) => [...t, { ...next, role, pending: true }]);
    };
    const accept = (email: string) => {
        setTeam((t) => t.map((m) => (m.email === email ? { ...m, pending: false } : m)));
    };

    const nextInvitee = INVITEES[team.length - TEAM_SEED.length];

    return (
        <DemoStage title="Team · Byg Nord ApS" onReset={touched ? () => { setTeam(TEAM_SEED); setRole('Medarbejder'); } : undefined}>
            <div className="rounded-control border border-border dark:border-border-dark p-3">
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Invitér på e-mail</p>
                <div className="flex items-center gap-2 rounded-control bg-bg-subtle dark:bg-bg-dark-muted px-3 min-h-[44px] mt-1.5">
                    <span className="text-body text-text-primary dark:text-text-dark-primary truncate">
                        {nextInvitee?.email ?? 'Alle invitationer sendt'}
                    </span>
                </div>
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2.5 mb-1.5">Rolle</p>
                <div className="flex gap-1.5">
                    {(['Medarbejder', 'Leder'] as Role[]).map((r) => (
                        <DemoChip key={r} active={role === r} onClick={() => setRole(r)}>{r}</DemoChip>
                    ))}
                </div>
                <DemoAction full className="mt-3" onClick={invite} disabled={!nextInvitee}>
                    <SendIcon className="w-4 h-4" />
                    Send invitation
                </DemoAction>
            </div>

            <TapHint show={!touched}>Send invitationen — sædet reserveres med det samme</TapHint>

            <div className="mt-3 space-y-2">
                {team.map((m) => (
                    <div key={m.email} className="flex items-center gap-3 rounded-control border border-border dark:border-border-dark px-3 py-2.5 animate-scale-in">
                        <span
                            className="flex w-9 h-9 shrink-0 items-center justify-center rounded-full text-white text-caption font-bold"
                            style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}
                        >
                            {m.name.split(' ').map((p) => p[0]).join('')}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{m.name}</p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary truncate">{m.role} · {m.email}</p>
                        </div>
                        {m.pending ? (
                            <button
                                type="button"
                                onClick={() => accept(m.email)}
                                className="rounded-full px-2.5 py-1.5 text-caption font-bold bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning transition-transform duration-150 active:scale-[0.96]"
                            >
                                Afventer svar
                            </button>
                        ) : (
                            <DemoPill tone="success">Aktiv</DemoPill>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-3 rounded-control bg-bg-subtle dark:bg-bg-dark-muted p-3">
                <div className="flex items-center justify-between">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary flex items-center gap-1.5">
                        <UsersIcon className="w-3.5 h-3.5" /> Sæder brugt
                    </span>
                    <span className="text-caption font-bold text-text-primary dark:text-text-dark-primary tabular-nums">
                        {team.length} af {SEATS}
                    </span>
                </div>
                <DemoMeter className="mt-2" value={team.length / SEATS} />
            </div>
        </DemoStage>
    );
};

// ── Kunde-portal: hvad ser bygherren ─────────────────────────────────────────

/**
 * NOTE: the CLIENT role resolves to a FIXED tab set — core/shell/
 * projectTabAccess.ts sends it down its own branch and projectTabAccess.test.ts
 * asserts exactly CLIENT_TABS regardless of the project's visibility setting.
 * There is no per-project tab picker, so this demo lets you switch PERSPECTIVE
 * (your view vs. the client's) rather than pretending you can configure it.
 */
export const PortalDemo: React.FC = () => {
    const [asClient, setAsClient] = useState(false);
    const ALL_TABS = ['Overblik', 'Opgaver', 'Plan', 'Økonomi', 'Dokumenter'] as const;
    const visible = asClient ? (CLIENT_TABS as readonly string[]) : ALL_TABS;

    return (
        <DemoStage title="Villa Solbakken · adgang" onReset={asClient ? () => setAsClient(false) : undefined}>
            <div className="flex gap-1.5">
                <DemoChip active={!asClient} onClick={() => setAsClient(false)}>Din visning</DemoChip>
                <DemoChip active={asClient} onClick={() => setAsClient(true)}>Bygherrens visning</DemoChip>
            </div>

            <TapHint show={!asClient}>Skift til bygherrens visning — se hvad CLIENT-rollen giver</TapHint>

            <div className="mt-3 rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-3">
                <div className="flex items-center gap-2 mb-2.5">
                    <EyeIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" />
                    <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary flex-1">
                        {asClient ? 'Sådan ser bygherren sagen' : 'Sådan ser du sagen'}
                    </p>
                    {asClient && <DemoPill><LockIcon className="w-3 h-3 mr-1" />Kun læsning</DemoPill>}
                </div>

                {/* Tab strip: the client's is a strict subset — and it is not configurable. */}
                <div className="flex gap-1 overflow-x-auto hide-scrollbar border-b border-border dark:border-border-dark mb-2.5">
                    {ALL_TABS.map((t) => {
                        const shown = visible.includes(t);
                        return (
                            <span
                                key={t}
                                className={cn(
                                    'shrink-0 px-2.5 py-2 text-caption font-semibold border-b-2 -mb-px transition-all duration-200',
                                    shown
                                        ? 'border-brand-primary text-brand-primary dark:text-brand-light'
                                        : 'border-transparent text-text-tertiary dark:text-text-dark-tertiary line-through opacity-50'
                                )}
                            >
                                {t}
                            </span>
                        );
                    })}
                </div>

                <div className="space-y-2">
                    <div className="rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-3 animate-scale-in">
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Overblik · fremdrift</p>
                        <p className="text-title text-text-primary dark:text-text-dark-primary tabular-nums">72 %</p>
                        <DemoMeter className="mt-1.5" value={0.72} />
                    </div>
                    <div className="rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-3 flex items-center gap-2.5 animate-scale-in">
                        <FileTextIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary shrink-0" />
                        <p className="text-caption text-text-primary dark:text-text-dark-primary truncate">
                            Dokumenter · statusrapport-uge-33.pdf
                        </p>
                    </div>
                    {asClient ? (
                        <div className="rounded-control bg-bg-muted dark:bg-bg-dark-muted p-3 flex items-center gap-2.5 animate-scale-in">
                            <LockIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0" />
                            <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">
                                Økonomi, opgaver og plan er ikke synlige for bygherren.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-control bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-3 animate-scale-in">
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Økonomi · forbrug mod budget</p>
                            <p className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums mt-0.5">
                                {kr(612_400)} / {kr(840_000)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-2">
                CLIENT-rollen giver et fast sæt: {CLIENT_TABS.join(' og ')}. Det kræver ingen opsætning —
                og kan heller ikke finjusteres pr. projekt.
            </p>
        </DemoStage>
    );
};

// ── Partnere: forhandling om prisen ──────────────────────────────────────────

interface Bid { from: 'you' | 'partner'; text: string; amount?: number; }

const BID_SEED: Bid[] = [
    { from: 'you', text: 'Gipsning af 1. sal, 128 m². Kan du tage den i uge 36?' },
    { from: 'partner', text: 'Tilbud', amount: 28_000 },
];
const COUNTERS = [24_500, 26_000];

export const NegotiateDemo: React.FC = () => {
    const [thread, setThread] = useState<Bid[]>(BID_SEED);
    const [accepted, setAccepted] = useState(false);
    const [round, setRound] = useState(0);
    const touched = thread.length > BID_SEED.length || accepted;

    const counter = () => {
        const amount = COUNTERS[Math.min(round, COUNTERS.length - 1)];
        setThread((t) => [
            ...t,
            { from: 'you', text: NEGOTIATION_UI.counter, amount },
            { from: 'partner', text: round === 0 ? NEGOTIATION_UI.counter : NEGOTIATION_UI.offer, amount: round === 0 ? 26_000 : amount },
        ]);
        setRound((r) => r + 1);
    };

    const last = [...thread].reverse().find((b) => b.amount !== undefined);

    return (
        <DemoStage
            title="Partner · Nord Gips ApS"
            onReset={touched ? () => { setThread(BID_SEED); setAccepted(false); setRound(0); } : undefined}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                    Opgave: Gipsning 1. sal · Villa Solbakken
                </p>
                <DemoPill tone={accepted ? 'success' : 'warning'}>{accepted ? NEGOTIATION_UI.accepted : 'Forhandling'}</DemoPill>
            </div>

            <div className="mt-3 space-y-2">
                {thread.map((b, i) => (
                    <div key={i} className={cn('flex', b.from === 'you' ? 'justify-end' : 'justify-start')}>
                        <div
                            className={cn(
                                'max-w-[80%] rounded-card px-3 py-2 animate-slide-up',
                                b.from === 'you'
                                    ? 'rounded-br-sm text-white'
                                    : 'rounded-bl-sm bg-bg-muted dark:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary'
                            )}
                            style={b.from === 'you' ? { backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' } : undefined}
                        >
                            <p className="text-caption opacity-80">{b.text}</p>
                            {b.amount !== undefined && (
                                <p className="text-heading tabular-nums mt-0.5">{kr(b.amount)}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <TapHint show={!touched}>Send et modbud — hele forløbet dokumenteres i tråden</TapHint>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <DemoAction
                    tone="neutral"
                    onClick={counter}
                    disabled={accepted || round >= COUNTERS.length}
                >
                    {NEGOTIATION_UI.newCounter}
                </DemoAction>
                <DemoAction tone="success" onClick={() => setAccepted(true)} disabled={accepted}>
                    <CheckCircleIcon className="w-4 h-4" />
                    {NEGOTIATION_UI.accept} {last?.amount !== undefined ? kr(last.amount) : ''}
                </DemoAction>
            </div>

            {accepted && last?.amount !== undefined && (
                <div className="mt-3 rounded-control border border-success-border dark:border-success/40 bg-success-subtle dark:bg-success-subtle-dark p-3 animate-scale-in">
                    <p className="text-caption text-success-strong dark:text-success">
                        <strong>Aftalt {kr(last.amount)}.</strong> {NEGOTIATION_UI.scopeNote} Tråden står som
                        dokumentation for prisforløbet.
                    </p>
                </div>
            )}
        </DemoStage>
    );
};

// ── AI: chat med projektkontekst ─────────────────────────────────────────────

const AI_PROMPTS: { q: string; a: string }[] = [
    {
        q: 'Hvad haster på Villa Solbakken?',
        a: 'Tre ting: isoleringen på taget er forfalden siden i går, gipslevering fra Stark er ikke bekræftet til uge 36, og posten Underentreprise står 4 % over baseline. Jeg vil starte med leveringen — den blokerer to opgaver.',
    },
    {
        q: 'Er vi bagud på tidsplanen?',
        a: 'Nej, men margenen er tynd. Råhus blev færdigt to dage forsinket, og den forsinkelse er endnu ikke indhentet. Aflevering holder, hvis installationerne starter senest mandag.',
    },
    {
        q: 'Hvad koster forsinkelsen?',
        a: 'En uges forskydning svarer til ca. 34.000 kr i ekstra timer og stilladsleje ud fra jeres registrerede forbrug. Det er under dagbodsgrænsen, men æder næsten hele bufferen på Materialer.',
    },
];

export const AiChatDemo: React.FC = () => {
    const [asked, setAsked] = useState<number | null>(null);
    const [typed, setTyped] = useState('');
    const [thinking, setThinking] = useState(false);
    const timers = useRef<number[]>([]);

    const clearTimers = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
    useEffect(() => clearTimers, []);

    const ask = (i: number) => {
        clearTimers();
        setAsked(i);
        setTyped('');
        setThinking(true);
        const answer = AI_PROMPTS[i].a;
        timers.current.push(window.setTimeout(() => {
            setThinking(false);
            // Reveal a few characters per frame so it reads like a live stream.
            let n = 0;
            const step = () => {
                n = Math.min(answer.length, n + 3);
                setTyped(answer.slice(0, n));
                if (n < answer.length) timers.current.push(window.setTimeout(step, 16));
            };
            step();
        }, 650));
    };

    return (
        <DemoStage
            title="AI-assistent"
            onReset={asked !== null ? () => { clearTimers(); setAsked(null); setTyped(''); setThinking(false); } : undefined}
        >
            <div className="rounded-card p-3.5 text-white rich-hero-ai rich-glow">
                <div className="flex items-center gap-2 relative">
                    <SparklesIcon className="w-4 h-4" />
                    <p className="text-label font-bold">Dagens briefing</p>
                </div>
                <p className="text-caption opacity-90 mt-1.5 relative">
                    12 °C og tørvejr til kl. 15 — godt vejr til tagarbejdet. 3 opgaver forfalder i dag,
                    og én sag har brug for din opmærksomhed.
                </p>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3">
                {AI_PROMPTS.map((p, i) => (
                    <DemoChip key={p.q} active={asked === i} onClick={() => ask(i)}>{p.q}</DemoChip>
                ))}
            </div>

            <TapHint show={asked === null}>Tryk på et spørgsmål — svaret skrives frem</TapHint>

            {asked !== null && (
                <div className="mt-3 space-y-2">
                    <div className="flex justify-end">
                        <div
                            className="max-w-[80%] rounded-card rounded-br-sm px-3 py-2 text-white animate-slide-up"
                            style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}
                        >
                            <p className="text-caption">{AI_PROMPTS[asked].q}</p>
                        </div>
                    </div>
                    <div className="flex justify-start">
                        <div className="max-w-[86%] rounded-card rounded-bl-sm bg-bg-muted dark:bg-bg-dark-muted px-3 py-2.5">
                            {thinking ? (
                                <span className="flex gap-1 py-1" aria-label="Skriver">
                                    {[0, 1, 2].map((i) => (
                                        <span
                                            key={i}
                                            className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-pulse"
                                            style={{ animationDelay: `${i * 160}ms` }}
                                        />
                                    ))}
                                </span>
                            ) : (
                                <p className="text-caption text-text-primary dark:text-text-dark-primary leading-relaxed">
                                    {typed}
                                    {typed.length < AI_PROMPTS[asked].a.length && (
                                        <span className="inline-block w-[2px] h-3 align-middle ml-0.5 bg-text-primary dark:bg-text-dark-primary animate-pulse" />
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                    <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary text-center pt-1">
                        Svaret bygger på jeres egne sager — ikke på generel viden.
                    </p>
                </div>
            )}
        </DemoStage>
    );
};

// ── Integrationer: forbind et cloud-lager ────────────────────────────────────

const PROVIDER_ICONS: Record<string, React.FC<{ className?: string }>> = {
    google: GoogleIcon, dropbox: DropboxIcon, onedrive: OneDriveIcon, box: BoxIcon,
};
/** Names + order come from CLOUD_PROVIDERS (mirrors IntegrationsSettingsSection). */
const PROVIDERS = CLOUD_PROVIDERS.map((p) => ({ key: p.id, name: p.name, Icon: PROVIDER_ICONS[p.id] }));

const CLOUD_FILES = [
    'plan-1sal-rev-C.pdf',
    'snit-A-A.dwg',
    'myndighedsansoegning.pdf',
    'facade-vest.jpg',
];

type ConnState = 'idle' | 'connecting' | 'connected';

export const ConnectDemo: React.FC = () => {
    const [provider, setProvider] = useState<string | null>(null);
    const [state, setState] = useState<ConnState>('idle');
    const [attached, setAttached] = useState<string | null>(null);
    const timer = useRef<number | null>(null);

    useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

    const connect = (key: string) => {
        if (timer.current) window.clearTimeout(timer.current);
        setProvider(key);
        setState('connecting');
        setAttached(null);
        timer.current = window.setTimeout(() => setState('connected'), 900);
    };

    const reset = () => {
        if (timer.current) window.clearTimeout(timer.current);
        setProvider(null); setState('idle'); setAttached(null);
    };

    const active = PROVIDERS.find((p) => p.key === provider);

    return (
        <DemoStage title="Indstillinger · Integrationer" onReset={provider ? reset : undefined}>
            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Forbind jeres cloud-lager</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
                {PROVIDERS.map(({ key, name, Icon }) => {
                    const isActive = provider === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => connect(key)}
                            className={cn(
                                'flex items-center gap-2.5 rounded-control border px-3 py-3 min-h-[44px] text-left transition-all duration-150 active:scale-[0.98]',
                                isActive
                                    ? 'border-brand-border dark:border-brand-border-dark bg-brand-subtle/60 dark:bg-brand-subtle-dark/40'
                                    : 'border-border dark:border-border-dark hover:bg-bg-subtle dark:hover:bg-bg-dark-muted'
                            )}
                        >
                            <Icon className="w-5 h-5 shrink-0" />
                            <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary truncate flex-1">
                                {name}
                            </span>
                            {isActive && state === 'connected' && <CheckCircleIcon className="w-4 h-4 text-success shrink-0" />}
                        </button>
                    );
                })}
            </div>

            <TapHint show={!provider}>Vælg en tjeneste — forbindelsen oprettes</TapHint>

            {state === 'connecting' && active && (
                <div className="mt-3 rounded-control border border-border dark:border-border-dark p-3.5 flex items-center gap-3 animate-slide-up">
                    <span className="w-5 h-5 rounded-full border-2 border-brand-primary border-t-transparent animate-spin shrink-0" />
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                        Åbner sikker OAuth-godkendelse hos {active.name} — BygSmart ser aldrig dit kodeord.
                    </p>
                </div>
            )}

            {state === 'connected' && active && (
                <div className="mt-3 space-y-2 animate-slide-up">
                    <div className="rounded-control border border-success-border dark:border-success/40 bg-success-subtle dark:bg-success-subtle-dark p-3 flex items-center gap-2.5">
                        <CloudIcon className="w-5 h-5 text-success shrink-0" />
                        <p className="text-caption text-success-strong dark:text-success flex-1">
                            <strong>{active.name} forbundet.</strong> Filvælgeren er nu i alle upload-flows.
                        </p>
                    </div>

                    <div className="rounded-control border border-border dark:border-border-dark overflow-hidden">
                        <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary px-3 py-2 bg-bg-subtle dark:bg-bg-dark-muted">
                            Vedhæft fra {active.name}
                        </p>
                        <div className="divide-y divide-border dark:divide-border-dark">
                            {CLOUD_FILES.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setAttached(f)}
                                    className="flex w-full items-center gap-2.5 px-3 py-2.5 min-h-[44px] text-left transition-colors hover:bg-bg-subtle dark:hover:bg-bg-dark-muted"
                                >
                                    <FileTextIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0" />
                                    <span className="text-caption text-text-primary dark:text-text-dark-primary truncate flex-1">{f}</span>
                                    {attached === f
                                        ? <DemoPill tone="success">Vedhæftet</DemoPill>
                                        : <PaperclipIcon className="w-3.5 h-3.5 text-text-tertiary dark:text-text-dark-tertiary shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </DemoStage>
    );
};
