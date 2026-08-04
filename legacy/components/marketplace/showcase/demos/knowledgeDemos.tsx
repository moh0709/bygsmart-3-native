import React, { useState } from 'react';
import { cn } from '../../../ui';
import {
    CheckCircleIcon, DownloadIcon, FileTextIcon, ImageIcon, LinkIcon,
    SearchIcon, ShoppingCartIcon, UploadCloudIcon,
} from '../../../icons';
import { DemoAction, DemoChip, DemoPill, DemoStage, TapHint, kr } from './shared';
import { CALCULATOR_UI } from './demoFacts';

// ─────────────────────────────────────────────────────────────────────────────
// Foundation & document demos — Beregnere, Viden, Dokumenter, Rapporter.
// ─────────────────────────────────────────────────────────────────────────────

// ── Beregnere: betondæk med spild og pris ────────────────────────────────────

const Slider: React.FC<{
    label: string; value: number; min: number; max: number; step: number;
    unit: string; onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit, onChange }) => (
    <label className="block">
        <span className="flex items-baseline justify-between">
            <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{label}</span>
            <span className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums">
                {value.toString().replace('.', ',')} {unit}
            </span>
        </span>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full mt-1.5 h-6 cursor-pointer bg-transparent"
            style={{ accentColor: 'var(--sc-a)' }}
        />
    </label>
);

const CONCRETE_PRICE_PER_M3 = 1_290;

export const CalcDemo: React.FC = () => {
    const [length, setLength] = useState(6);
    const [width, setWidth] = useState(4);
    const [thickness, setThickness] = useState(0.12);
    const [waste, setWaste] = useState(0.05);
    const [sent, setSent] = useState(false);
    const touched = length !== 6 || width !== 4 || thickness !== 0.12 || waste !== 0.05 || sent;

    const net = length * width * thickness;
    const gross = net * (1 + waste);
    const reset = () => { setLength(6); setWidth(4); setThickness(0.12); setWaste(0.05); setSent(false); };

    return (
        <DemoStage title="Beregner · Betondæk" onReset={touched ? reset : undefined}>
            <div className="space-y-3">
                <Slider label="Længde" value={length} min={1} max={14} step={0.5} unit="m" onChange={setLength} />
                <Slider label="Bredde" value={width} min={1} max={10} step={0.5} unit="m" onChange={setWidth} />
                <Slider label="Tykkelse" value={thickness} min={0.05} max={0.35} step={0.01} unit="m" onChange={setThickness} />
            </div>

            <div className="mt-3">
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mb-1.5">Spild</p>
                <div className="flex gap-1.5">
                    {[0, 0.05, 0.1, 0.15].map((w) => (
                        <DemoChip key={w} active={waste === w} onClick={() => setWaste(w)}>
                            {Math.round(w * 100)} %
                        </DemoChip>
                    ))}
                </div>
            </div>

            <TapHint show={!touched}>Træk i målene — resultatet regnes om live</TapHint>

            <div
                className="mt-3 rounded-control p-4 text-white shadow-card"
                style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }}
            >
                <p className="text-caption opacity-80">Betonmængde inkl. spild</p>
                <p className="text-display tabular-nums mt-0.5">
                    {gross.toFixed(2).replace('.', ',')} <span className="text-title">m³</span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-caption opacity-90 tabular-nums">
                    <span>Netto {net.toFixed(2).replace('.', ',')} m³</span>
                    <span>Areal {(length * width).toFixed(1).replace('.', ',')} m²</span>
                    <span>Ca. {kr(gross * CONCRETE_PRICE_PER_M3)}</span>
                </div>
            </div>

            <div className="mt-3">
                {sent ? (
                    <div className="rounded-control border border-success-border dark:border-success/40 bg-success-subtle dark:bg-success-subtle-dark p-3 flex items-start gap-2.5 animate-scale-in">
                        <CheckCircleIcon className="w-5 h-5 text-success shrink-0" />
                        <p className="text-caption text-success-strong dark:text-success">
                            <strong>Indkøb oprettet.</strong> {gross.toFixed(2).replace('.', ',')} m³ beton lagt på sagen.
                            Beregningen kan også gemmes med “{CALCULATOR_UI.saveToProject}” eller hentes som PDF
                            med “{CALCULATOR_UI.exportPdf}”.
                        </p>
                    </div>
                ) : (
                    <DemoAction full onClick={() => setSent(true)}>
                        <ShoppingCartIcon className="w-4 h-4" />
                        Opret indkøb fra beregningen
                    </DemoAction>
                )}
            </div>
        </DemoStage>
    );
};

// ── Viden: opslag i reglementet ──────────────────────────────────────────────

interface Regulation { source: string; ref: string; title: string; body: string; hit: string; }

/**
 * VERIFIED EXCERPTS ONLY.
 *
 * Every paragraph number and quoted sentence below was read out of the
 * shipped BR18 full text (modules/knowledge/data/publicRegulationFullText
 * .generated.ts) on 2026-08-03. Do NOT add a paragraph here from memory:
 * an invented reglement quote in a construction app is the one error a user
 * can actually get hurt by. The real module searches the full text; this
 * demo shows a fixed, checked subset of it.
 */
const TOPICS: Record<string, Regulation[]> = {
    'Vådrum': [
        {
            source: 'BR18', ref: '§ 339', title: 'Vådrum',
            body: 'Vådrum, herunder baderum samt bryggers og WC-rum med gulvafløb, skal opfylde følgende krav: 1) Gulve og vægge skal udføres, så de kan modstå de fugtpåvirkninger og de mekaniske og kemiske påvirkninger, der normalt forekommer i vådrum. 2) Gulve og gulvbelægninger, herunder samlinger, tilslutninger, rørgennemføringer og lignende, skal være vandtætte.',
            hit: 'skal være vandtætte',
        },
        {
            source: 'BR18', ref: '§ 337', title: 'Fugt fra grund og overflade',
            body: 'Bygninger skal sikres mod indtrængning af vand fra grundvand og overfladevand. Bygninger skal desuden sikres mod opsugning af fugt fra undergrunden.',
            hit: 'opsugning af fugt fra undergrunden',
        },
    ],
    'Klimaskærm og tagvand': [
        {
            source: 'BR18', ref: '§ 338', title: 'Tæthed mod regn og smeltevand',
            body: 'Klimaskærmen skal projekteres, udføres og vedligeholdes, så der er tæthed mod indtrængen af regn og smeltevand, og så det på en forsvarlig måde kan løbe af. Tagvand skal via tagrender og/eller tagnedløb afledes til afløb.',
            hit: 'Tagvand skal via tagrender og/eller tagnedløb afledes til afløb',
        },
    ],
    'Brandtekniske installationer': [
        {
            source: 'BR18', ref: '§ 88', title: 'Brandtekniske installationer og håndslukningsudstyr',
            body: 'Brandtekniske installationer og håndslukningsudstyr, installeret i og ved bygninger, skal bidrage til bygningens brandsikkerhed. Valg af brandtekniske installationer skal ske under hensyn til behovet for, at branden detekteres på et tidligt tidspunkt i brandforløbet.',
            hit: 'detekteres på et tidligt tidspunkt',
        },
    ],
};

const TOPIC_KEYS = Object.keys(TOPICS);

/** Splits a body so the matched phrase can be highlighted. */
const highlight = (body: string, hit: string) => {
    const i = body.indexOf(hit);
    if (i < 0) return [body, '', ''] as const;
    return [body.slice(0, i), hit, body.slice(i + hit.length)] as const;
};

export const SearchDemo: React.FC = () => {
    const [query, setQuery] = useState<string | null>(null);
    const results = query ? TOPICS[query] : [];

    return (
        <DemoStage title="Viden & Reglement" onReset={query ? () => setQuery(null) : undefined}>
            <div className="flex items-center gap-2 rounded-control border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted px-3 min-h-[44px]">
                <SearchIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary shrink-0" />
                <span className={cn(
                    'text-body truncate',
                    query ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-tertiary dark:text-text-dark-tertiary'
                )}>
                    {query ?? 'Søg i BR18, SBI, DS, AB18 og AT…'}
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2.5">
                {TOPIC_KEYS.map((t) => (
                    <DemoChip key={t} active={query === t} onClick={() => setQuery(t)}>{t}</DemoChip>
                ))}
            </div>

            <TapHint show={!query}>Tryk på et emne — opslaget kører</TapHint>

            {query && (
                <div className="mt-3 space-y-2">
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary px-0.5">
                        {results.length} resultat{results.length === 1 ? '' : 'er'} · uddrag fra BR18
                    </p>
                    {results.map((r, i) => {
                        const [before, hit, after] = highlight(r.body, r.hit);
                        return (
                            <article
                                key={r.ref}
                                className="rounded-control border border-border dark:border-border-dark p-3 animate-slide-up"
                                style={{ animationDelay: `${i * 90}ms` }}
                            >
                                <div className="flex items-center gap-2">
                                    <DemoPill tone="accent">{r.source}</DemoPill>
                                    <span className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary">{r.ref}</span>
                                </div>
                                <h4 className="text-label font-bold text-text-primary dark:text-text-dark-primary mt-1.5">{r.title}</h4>
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1 leading-relaxed">
                                    {before}
                                    <mark className="rounded px-0.5 bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning font-semibold">
                                        {hit}
                                    </mark>
                                    {after}
                                </p>
                                <p className="flex items-center gap-1.5 text-caption font-semibold text-brand-primary dark:text-brand-light mt-2">
                                    <LinkIcon className="w-3 h-3" />
                                    Knyt til opgaven · del deep-link
                                </p>
                            </article>
                        );
                    })}
                    <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary px-0.5">
                        Uddrag fra bygningsreglementets fulde tekst. I appen søger du frit i hele BR18 og
                        springer til afsnittet i sin sammenhæng.
                    </p>
                </div>
            )}
        </DemoStage>
    );
};

// ── Dokumenter: revisionsstyring ─────────────────────────────────────────────

interface Revision { rev: string; date: string; note: string; }

const REV_SEED: Revision[] = [
    { rev: 'B', date: '12. jul. 2026', note: 'Vindueshuller rettet' },
    { rev: 'A', date: '3. jun. 2026', note: 'Første udgave til myndighed' },
];
const NEXT_REVS = [
    { rev: 'C', date: '2. aug. 2026', note: 'Bad flyttet, ny bærende væg' },
    { rev: 'D', date: '9. aug. 2026', note: 'Dørbredde justeret til 900 mm' },
    { rev: 'E', date: '16. aug. 2026', note: 'Kotehøjde korrigeret' },
];

export const RevisionDemo: React.FC = () => {
    const [revs, setRevs] = useState<Revision[]>(REV_SEED);
    const touched = revs.length > REV_SEED.length;

    const upload = () => {
        const next = NEXT_REVS[revs.length - REV_SEED.length];
        if (!next) return;
        setRevs((r) => [next, ...r]);
    };

    return (
        <DemoStage title="Dokumenter · Plan 1. sal" onReset={touched ? () => setRevs(REV_SEED) : undefined}>
            <div className="rounded-control border border-border dark:border-border-dark p-3">
                <div className="flex items-start gap-3">
                    <span className="flex w-11 h-11 shrink-0 items-center justify-center rounded-control bg-bg-muted dark:bg-bg-dark-muted">
                        <FileTextIcon className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" />
                    </span>
                    <div className="min-w-0">
                        <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">plan-1sal.pdf</p>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">
                            Disciplin: Arkitekt · Målestok 1:100
                        </p>
                    </div>
                </div>
            </div>

            <DemoAction full className="mt-2.5" onClick={upload} disabled={revs.length - REV_SEED.length >= NEXT_REVS.length}>
                <UploadCloudIcon className="w-4 h-4" />
                Upload ny revision
            </DemoAction>

            <TapHint show={!touched}>Upload rev. C — se stakken rykke</TapHint>

            <div className="mt-3 space-y-2">
                {revs.map((r, i) => (
                    <div
                        key={r.rev}
                        className={cn(
                            'flex items-center gap-3 rounded-control border px-3 py-2.5 transition-all duration-300',
                            i === 0
                                ? 'border-success-border dark:border-success/40 bg-success-subtle/50 dark:bg-success-subtle-dark/50 animate-scale-in'
                                : 'border-border dark:border-border-dark opacity-70'
                        )}
                    >
                        <span
                            className={cn(
                                'flex w-9 h-9 shrink-0 items-center justify-center rounded-control text-label font-bold',
                                i === 0
                                    ? 'bg-success text-white'
                                    : 'bg-bg-muted text-text-tertiary dark:bg-bg-dark-muted dark:text-text-dark-tertiary'
                            )}
                        >
                            {r.rev}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className={cn(
                                'text-label font-semibold truncate',
                                i === 0 ? 'text-text-primary dark:text-text-dark-primary' : 'text-text-secondary dark:text-text-dark-secondary'
                            )}>
                                Rev. {r.rev} — {r.note}
                            </p>
                            <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">{r.date}</p>
                        </div>
                        {i === 0 ? <DemoPill tone="success">Nyeste</DemoPill> : <DemoPill>Arkiveret</DemoPill>}
                    </div>
                ))}
            </div>

            {touched && (
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-3">
                    Rev. {revs[1].rev} mistede automatisk sit “Nyeste”-mærke. Ingen bygger efter en forældet tegning ved et uheld.
                </p>
            )}
        </DemoStage>
    );
};

// ── Rapporter: byg dokumentet ────────────────────────────────────────────────

const SECTIONS = [
    { key: 'forside', label: 'Forside med logo', pages: 1 },
    { key: 'fremdrift', label: 'Fremdrift og status', pages: 2 },
    { key: 'fotos', label: 'Fotodokumentation', pages: 4 },
    { key: 'mangler', label: 'Mangelliste', pages: 2 },
    { key: 'timer', label: 'Timeforbrug', pages: 1 },
] as const;

export const ReportDemo: React.FC = () => {
    const [on, setOn] = useState<string[]>(['forside', 'fremdrift']);
    const [generated, setGenerated] = useState(false);
    const touched = on.length !== 2 || generated;

    const toggle = (key: string) => {
        setGenerated(false);
        setOn((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
    };

    const chosen = SECTIONS.filter((s) => on.includes(s.key));
    const pages = chosen.reduce((sum, s) => sum + s.pages, 0);

    return (
        <DemoStage
            title="Rapport · Villa Solbakken"
            onReset={touched ? () => { setOn(['forside', 'fremdrift']); setGenerated(false); } : undefined}
        >
            <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1.5">
                    {SECTIONS.map((s) => {
                        const active = on.includes(s.key);
                        return (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => toggle(s.key)}
                                aria-pressed={active}
                                className={cn(
                                    'flex w-full items-center gap-2.5 rounded-control border px-3 py-2.5 min-h-[44px] text-left transition-all duration-150 active:scale-[0.99]',
                                    active
                                        ? 'border-brand-border dark:border-brand-border-dark bg-brand-subtle/60 dark:bg-brand-subtle-dark/40'
                                        : 'border-border dark:border-border-dark'
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex w-5 h-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors',
                                        active ? 'border-transparent text-white' : 'border-border-strong dark:border-border-dark-strong'
                                    )}
                                    style={active ? { backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' } : undefined}
                                >
                                    {active && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                </span>
                                <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary flex-1 truncate">
                                    {s.label}
                                </span>
                                <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary tabular-nums">
                                    {s.pages} s.
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Live preview of the document being assembled. */}
                <div className="w-[92px] shrink-0">
                    <div className="rounded-control border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-2 space-y-1.5">
                        {chosen.length === 0 && (
                            <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary text-center py-6">Tom</p>
                        )}
                        {chosen.map((s) => (
                            <div key={s.key} className="rounded-[4px] bg-bg dark:bg-bg-dark-surface border border-border dark:border-border-dark p-1.5 animate-scale-in">
                                {s.key === 'forside' && (
                                    <>
                                        <span className="block h-3 w-6 rounded-sm" style={{ backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }} />
                                        <span className="block h-1 w-12 rounded-full bg-text-tertiary/40 mt-1.5" />
                                        <span className="block h-1 w-8 rounded-full bg-text-tertiary/30 mt-1" />
                                    </>
                                )}
                                {s.key === 'fremdrift' && (
                                    <div className="flex items-end gap-0.5 h-6">
                                        {[6, 12, 9, 16, 20].map((h, i) => (
                                            <span key={i} className="flex-1 rounded-sm" style={{ height: h, backgroundImage: 'linear-gradient(180deg, var(--sc-a), var(--sc-b))' }} />
                                        ))}
                                    </div>
                                )}
                                {s.key === 'fotos' && (
                                    <div className="grid grid-cols-2 gap-0.5">
                                        {[0, 1, 2, 3].map((i) => (
                                            <span key={i} className="aspect-square rounded-sm bg-text-tertiary/25 flex items-center justify-center">
                                                <ImageIcon className="w-2.5 h-2.5 text-text-tertiary" />
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {s.key === 'mangler' && (
                                    <div className="space-y-1">
                                        {[0, 1, 2].map((i) => (
                                            <span key={i} className="flex items-center gap-1">
                                                <span className={cn('w-1.5 h-1.5 rounded-full', i === 2 ? 'bg-success' : 'bg-warning')} />
                                                <span className="h-1 flex-1 rounded-full bg-text-tertiary/30" />
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {s.key === 'timer' && (
                                    <div className="space-y-1">
                                        {[10, 7, 12].map((w, i) => (
                                            <span key={i} className="flex items-center justify-between">
                                                <span className="h-1 rounded-full bg-text-tertiary/30" style={{ width: w * 2 }} />
                                                <span className="h-1 w-3 rounded-full bg-text-tertiary/40" />
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-caption text-center text-text-secondary dark:text-text-dark-secondary mt-1.5 tabular-nums">
                        {pages} side{pages === 1 ? '' : 'r'}
                    </p>
                </div>
            </div>

            <TapHint show={!touched}>Slå afsnit til og fra — dokumentet bygger sig selv</TapHint>

            <div className="mt-3">
                {generated ? (
                    <div className="rounded-control border border-success-border dark:border-success/40 bg-success-subtle dark:bg-success-subtle-dark p-3 flex items-start gap-2.5 animate-scale-in">
                        <FileTextIcon className="w-5 h-5 text-success shrink-0" />
                        <p className="text-caption text-success-strong dark:text-success">
                            <strong>rapport-2026-118.pdf</strong> — {pages} sider med logo, CVR og firmanavn
                            hentet fra jeres firmaprofil. Klar til at sende eller gemme på sagen.
                        </p>
                    </div>
                ) : (
                    <DemoAction full onClick={() => setGenerated(true)} disabled={chosen.length === 0}>
                        <DownloadIcon className="w-4 h-4" />
                        Generér rapport
                    </DemoAction>
                )}
            </div>
        </DemoStage>
    );
};
