import React from 'react';
import type { ModuleId } from '../../../core/registry/types';

// ─────────────────────────────────────────────────────────────────────────────
// Hero art for the module landing pages — one bespoke SVG scene per module.
//
// Every scene draws on a 320×180 canvas, uses only white-alpha structure plus
// the module's accent via `var(--sc-a)` / `var(--sc-b)` (set inline by the
// caller on the .sc-stage wrapper), and is purely decorative — the wrapper
// carries aria-hidden. Motion classes come from src/index.css and are all
// neutralised by the global prefers-reduced-motion rule.
// ─────────────────────────────────────────────────────────────────────────────

const A = 'var(--sc-a)';
const B = 'var(--sc-b)';

/** Frosted panel inside a scene. */
const P: React.FC<{
    x: number; y: number; w: number; h: number; r?: number;
    fill?: string; stroke?: string; className?: string; style?: React.CSSProperties;
}> = ({ x, y, w, h, r = 8, fill = 'rgba(255,255,255,0.10)', stroke = 'rgba(255,255,255,0.22)', className, style }) => (
    <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={stroke} strokeWidth="1" className={className} style={style} />
);

/** Text-line placeholder pill. */
const L: React.FC<{ x: number; y: number; w: number; h?: number; o?: number; fill?: string }> = ({ x, y, w, h = 3, o = 0.4, fill = '#fff' }) => (
    <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} opacity={o} />
);

/** Draw-in stroke helper. */
const draw = (delay = 0): React.CSSProperties => ({ strokeDasharray: 300, animationDelay: `${delay}ms` });

const scenes: Record<ModuleId, React.ReactNode> = {
    // ── Projekter — hub med sager, fremdriftsring og tagsilhuet ──────────────
    projects: (
        <>
            <path d="M196 118 L246 84 L296 118" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" className="sc-draw" style={draw(200)} />
            <P x={20} y={30} w={160} h={120} r={12} />
            <L x={32} y={44} w={54} o={0.75} h={5} />
            {[0, 1, 2].map((i) => (
                <g key={i} transform={`translate(0 ${62 + i * 28})`}>
                    <rect x={32} y={0} width={136} height={20} rx={6} fill="#fff" opacity="0.07" />
                    <circle cx={44} cy={10} r={5} fill={A} opacity="0.9" />
                    <L x={56} y={5} w={58} o={0.55} />
                    <rect x={56} y={12} width={90} height={3} rx={1.5} fill="#fff" opacity="0.16" />
                    <rect x={56} y={12} width={[68, 40, 84][i]} height={3} rx={1.5} fill={A} />
                </g>
            ))}
            <g className="sc-float" transform="translate(246 74)">
                <circle r="30" fill="none" stroke="#fff" strokeOpacity="0.15" strokeWidth="7" />
                <circle r="30" fill="none" stroke={A} strokeWidth="7" strokeLinecap="round"
                    strokeDasharray="188" strokeDashoffset="60" transform="rotate(-90)" className="sc-draw" style={{ strokeDasharray: 188 }} />
                <text textAnchor="middle" y="6" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Inter, system-ui">68%</text>
            </g>
        </>
    ),

    // ── Opgaver — kanban med et kort i luften ────────────────────────────────
    tasks: (
        <>
            {[0, 1, 2].map((c) => (
                <g key={c} transform={`translate(${22 + c * 98} 26)`}>
                    <P x={0} y={0} w={82} h={128} r={10} fill="rgba(255,255,255,0.06)" />
                    <L x={10} y={12} w={38} o={0.6} h={4} />
                    {[0, 1].map((k) => (
                        (c === 1 && k === 0) ? null : (
                            <g key={k} transform={`translate(10 ${28 + k * 34})`}>
                                <rect width="62" height="26" rx="6" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" />
                                <L x={8} y={8} w={40} o={0.5} />
                                <rect x={8} y={15} width={22} height={3} rx={1.5} fill={c === 2 ? '#4ADE80' : A} opacity="0.9" />
                            </g>
                        )
                    ))}
                </g>
            ))}
            <path d="M104 66 Q150 34 202 62" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 4" className="sc-dash" />
            <g className="sc-float" transform="translate(140 40) rotate(-6)">
                <rect width="66" height="28" rx="7" fill="#fff" opacity="0.95" />
                <rect x={8} y={8} width={44} height={4} rx={2} fill="#0B1220" opacity="0.55" />
                <rect x={8} y={17} width={24} height={4} rx={2} fill={A} />
            </g>
        </>
    ),

    // ── Beregnere — keypad + bjælke med målsætning ───────────────────────────
    tools: (
        <>
            <P x={20} y={26} w={116} h={128} r={12} />
            <rect x={30} y={36} width={96} height={26} rx={6} fill="#0B1220" opacity="0.5" />
            <text x={118} y={54} textAnchor="end" fill={A} fontSize="15" fontWeight="700" fontFamily="Inter, system-ui">4,26 m³</text>
            {Array.from({ length: 12 }).map((_, i) => (
                <rect key={i} x={30 + (i % 3) * 33} y={70 + Math.floor(i / 3) * 21} width={28} height={16} rx={4}
                    fill="#fff" opacity={i === 7 ? 0.45 : 0.12} />
            ))}
            <g transform="translate(158 44)">
                <path d="M4 46 H136" stroke="#fff" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 3" />
                <rect x={4} y={18} width={136} height={26} rx={3} fill={A} opacity="0.35" stroke={A} strokeWidth="1.5" />
                <path d="M4 58 H140 M4 54 v8 M140 54 v8" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" className="sc-draw" style={draw(300)} />
                <text x={72} y={74} textAnchor="middle" fill="#fff" fillOpacity="0.75" fontSize="10" fontFamily="Inter, system-ui">6,00 m</text>
                {[0, 1, 2, 3].map((i) => <rect key={i} x={16 + i * 34} y={4} width={4} height={14} rx={2} fill="#fff" opacity="0.3" />)}
            </g>
        </>
    ),

    // ── Viden — paragrafark under lup ────────────────────────────────────────
    knowledge: (
        <>
            <P x={44} y={20} w={168} h={142} r={10} fill="rgba(255,255,255,0.12)" />
            <text x={60} y={48} fill={A} fontSize="24" fontWeight="700" fontFamily="Inter, system-ui">§</text>
            <L x={84} y={36} w={72} o={0.7} h={5} />
            <L x={84} y={47} w={44} o={0.35} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <L key={i} x={60} y={68 + i * 14} w={i === 3 ? 96 : [140, 122, 136, 96, 130, 108][i]} o={i === 3 ? 0.9 : 0.28} />
            ))}
            <rect x={56} y={104} width={104} height={12} rx={3} fill={A} opacity="0.28" />
            <g className="sc-float-slow" transform="translate(214 96)">
                <circle r="34" fill="rgba(255,255,255,0.10)" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.5" />
                <path d="M24 24 L46 46" stroke="#fff" strokeOpacity="0.6" strokeWidth="5" strokeLinecap="round" />
                <circle r="34" fill="none" stroke={A} strokeWidth="2.5" strokeDasharray="214" className="sc-draw" style={{ strokeDasharray: 214 }} />
            </g>
        </>
    ),

    // ── Udførelse — telefon med check-in-puls og fotostribe ──────────────────
    field: (
        <>
            <g transform="translate(38 96)">
                <circle r="30" fill={A} opacity="0.25" className="sc-ring" />
                <circle r="30" fill={A} opacity="0.2" className="sc-ring" style={{ animationDelay: '1.1s' }} />
                <path d="M0 -18 C10 -18 17 -11 17 -2 C17 10 0 24 0 24 C0 24 -17 10 -17 -2 C-17 -11 -10 -18 0 -18 Z" fill="#fff" opacity="0.9" />
                <circle cy={-2} r="6" fill={A} />
            </g>
            <g className="sc-float">
                <P x={96} y={16} w={112} h={148} r={16} fill="rgba(255,255,255,0.14)" />
                <rect x={122} y={24} width={60} height={5} rx={2.5} fill="#fff" opacity="0.3" />
                <L x={110} y={44} w={62} o={0.7} h={5} />
                <L x={110} y={56} w={44} o={0.3} />
                <rect x={108} y={72} width={88} height={30} rx={8} fill={A} />
                <text x={152} y={92} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="Inter, system-ui">Tjek ind</text>
                {[0, 1, 2].map((i) => (
                    <rect key={i} x={108 + i * 30} y={112} width={26} height={26} rx={5} fill="#fff" opacity={0.14 + i * 0.06} />
                ))}
                <circle cx={121} cy={125} r="4" fill="#fff" opacity="0.5" />
                <path d="M110 134 l8 -8 l7 7 l6 -5 l7 6" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" fill="none" />
                <L x={110} y={148} w={66} o={0.25} />
            </g>
            <g transform="translate(228 46)">
                <rect width="72" height="24" rx="12" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.24)" />
                <circle cx={14} cy={12} r="5" fill="#4ADE80" />
                <L x={26} y={10} w={34} o={0.6} />
                <rect y={34} width="72" height="24" rx="12" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.18)" />
                <circle cx={14} cy={46} r="5" fill={B} />
                <L x={26} y={44} w={28} o={0.45} />
                <rect y={68} width="72" height="24" rx="12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
                <circle cx={14} cy={80} r="5" fill="#fff" opacity="0.4" />
                <L x={26} y={78} w={38} o={0.3} />
            </g>
        </>
    ),

    // ── KS — plantegning med mangel-pins ─────────────────────────────────────
    quality: (
        <>
            <P x={18} y={22} w={176} h={136} r={10} fill="rgba(255,255,255,0.08)" />
            <g stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" fill="none">
                <path d="M32 36 H180 V144 H32 Z" className="sc-draw" style={draw(0)} />
                <path d="M106 36 V92 M32 92 H180 M106 118 V144" className="sc-draw" style={draw(250)} />
            </g>
            <rect x={36} y={40} width={66} height={48} fill={A} opacity="0.10" />
            <rect x={110} y={96} width={66} height={44} fill={B} opacity="0.10" />
            {([[70, 62, '#F97066'], [148, 70, '#FBBF50'], [64, 122, '#4ADE80']] as const).map(([px, py, c], i) => (
                <g key={i} transform={`translate(${px} ${py})`} className={i === 2 ? 'sc-float' : undefined}>
                    <circle r="11" fill={c} opacity="0.25" />
                    <circle r="7" fill={c} />
                    {i === 2 && <path d="M-3 0 l2.5 2.5 L4 -3" stroke="#0B1220" strokeWidth="2" fill="none" strokeLinecap="round" />}
                </g>
            ))}
            <g className="sc-float-slow" transform="translate(210 40)">
                <rect width="90" height="112" rx="8" fill="#fff" opacity="0.94" />
                <rect x={12} y={14} width={44} height={5} rx={2.5} fill="#0B1220" opacity="0.6" />
                {[0, 1, 2].map((i) => <rect key={i} x={12} y={28 + i * 10} width={[64, 52, 60][i]} height={3} rx={1.5} fill="#0B1220" opacity="0.2" />)}
                <rect x={12} y={62} width={30} height={26} rx={4} fill="#0B1220" opacity="0.12" />
                <rect x={48} y={62} width={30} height={26} rx={4} fill="#4ADE80" opacity="0.35" />
                <rect x={12} y={96} width={40} height={6} rx={3} fill={A} />
            </g>
        </>
    ),

    // ── Tid — stopur og ugesøjler ────────────────────────────────────────────
    time: (
        <>
            <g transform="translate(84 88)">
                <circle r="52" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                <circle r="44" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="8" />
                <circle r="44" fill="none" stroke={A} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray="276" strokeDashoffset="96" transform="rotate(-90)" className="sc-draw" style={{ strokeDasharray: 276 }} />
                <text textAnchor="middle" y="0" fill="#fff" fontSize="20" fontWeight="700" fontFamily="Inter, system-ui">6:42</text>
                <text textAnchor="middle" y="17" fill="#fff" fillOpacity="0.5" fontSize="10" fontFamily="Inter, system-ui">i dag</text>
                <rect x={-9} y={-58} width={18} height={7} rx={3} fill="#fff" opacity="0.6" />
            </g>
            <P x={168} y={34} w={134} h={112} r={12} />
            <L x={180} y={46} w={48} o={0.65} h={4} />
            {[42, 68, 54, 88, 74, 30, 12].map((h, i) => (
                <g key={i}>
                    <rect x={180 + i * 17} y={130 - h} width={10} height={h} rx={4}
                        fill={i === 3 ? A : '#fff'} opacity={i === 3 ? 1 : 0.24}
                        className="sc-reveal" style={{ ['--d' as string]: `${i * 70}ms` }} />
                    <rect x={180 + i * 17} y={134} width={10} height={2} rx={1} fill="#fff" opacity="0.18" />
                </g>
            ))}
        </>
    ),

    // ── Plan — gantt med afhængigheder ───────────────────────────────────────
    planning: (
        <>
            <P x={18} y={22} w={284} h={136} r={12} fill="rgba(255,255,255,0.07)" />
            {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={32} y1={44 + i * 24} x2={292} y2={44 + i * 24} stroke="#fff" strokeOpacity="0.08" />)}
            {([[40, 66, 0], [76, 78, 1], [120, 60, 2], [156, 92, 3], [216, 64, 4]] as const).map(([x, w, row], i) => (
                <g key={i}>
                    <rect x={x} y={34 + row * 24} width={w} height={14} rx={7}
                        fill={i === 3 ? A : 'rgba(255,255,255,0.28)'}
                        className="sc-reveal" style={{ ['--d' as string]: `${i * 110}ms` }} />
                    {i < 4 && (
                        <path d={`M${x + w} ${41 + row * 24} h8 v24 h6`} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="3 3" className="sc-dash" />
                    )}
                </g>
            ))}
            <line x1={168} y1={26} x2={168} y2={154} stroke={B} strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx={168} cy={26} r="4" fill={B} />
            <g className="sc-float" transform="translate(212 108)">
                <rect width="84" height="42" rx="8" fill="#fff" opacity="0.94" />
                <rect x={10} y={10} width={30} height={4} rx={2} fill="#0B1220" opacity="0.55" />
                <rect x={10} y={20} width={54} height={3} rx={1.5} fill="#0B1220" opacity="0.2" />
                <rect x={10} y={28} width={26} height={6} rx={3} fill="#FBBF50" />
            </g>
        </>
    ),

    // ── Dokumenter — revisionsstak ───────────────────────────────────────────
    documents: (
        <>
            <g transform="translate(52 46) rotate(-7)"><rect width="130" height="112" rx="8" fill="#fff" opacity="0.22" /></g>
            <g transform="translate(64 38) rotate(-3)"><rect width="130" height="112" rx="8" fill="#fff" opacity="0.4" /></g>
            <g className="sc-float" transform="translate(76 26)">
                <rect width="134" height="118" rx="9" fill="#fff" opacity="0.96" />
                <g stroke="#0B1220" strokeOpacity="0.22" strokeWidth="1" fill="none">
                    <path d="M14 22 H90 M14 22 V96 M90 22 V96 M14 96 H90" className="sc-draw" style={draw(0)} />
                    <path d="M14 58 H90 M52 22 V96" className="sc-draw" style={draw(300)} />
                </g>
                <rect x={20} y={28} width={26} height={24} fill={A} opacity="0.2" />
                <rect x={100} y={22} width={22} height={3} rx={1.5} fill="#0B1220" opacity="0.25" />
                <rect x={100} y={30} width={16} height={3} rx={1.5} fill="#0B1220" opacity="0.18" />
                <rect x={98} y={78} width={26} height={16} rx={4} fill={A} />
                <text x={111} y={90} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="Inter, system-ui">C</text>
                <rect x={14} y={104} width={54} height={5} rx={2.5} fill="#0B1220" opacity="0.35" />
            </g>
            <g transform="translate(228 44)">
                <rect width="72" height="22" rx="11" fill="#4ADE80" opacity="0.9" />
                <text x={36} y={15} textAnchor="middle" fill="#0B1220" fontSize="10" fontWeight="700" fontFamily="Inter, system-ui">Nyeste</text>
                <rect y={30} width="72" height="20" rx="10" fill="#fff" opacity="0.14" />
                <text x={36} y={44} textAnchor="middle" fill="#fff" fillOpacity="0.5" fontSize="9" fontFamily="Inter, system-ui">rev. B</text>
                <rect y={56} width="72" height="20" rx="10" fill="#fff" opacity="0.08" />
                <text x={36} y={70} textAnchor="middle" fill="#fff" fillOpacity="0.35" fontSize="9" fontFamily="Inter, system-ui">rev. A</text>
            </g>
        </>
    ),

    // ── Team — organisation med sæder ────────────────────────────────────────
    team: (
        <>
            <path d="M110 62 V82 M46 106 V88 H174 V106" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" className="sc-draw" style={draw(200)} />
            <g transform="translate(110 42)">
                <circle r="22" fill={A} />
                <circle cy={-6} r="7" fill="#fff" opacity="0.9" />
                <path d="M-11 14 a11 11 0 0 1 22 0" fill="#fff" opacity="0.9" />
            </g>
            {[46, 110, 174].map((x, i) => (
                <g key={x} transform={`translate(${x} 124)`} className="sc-reveal" style={{ ['--d' as string]: `${200 + i * 120}ms` }}>
                    <circle r="18" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.3)" />
                    <circle cy={-5} r="6" fill="#fff" opacity="0.75" />
                    <path d="M-9 12 a9 9 0 0 1 18 0" fill="#fff" opacity="0.75" />
                </g>
            ))}
            <P x={214} y={38} w={88} h={104} r={12} />
            <L x={226} y={50} w={40} o={0.6} h={4} />
            {[0, 1, 2, 3].map((i) => (
                <g key={i} transform={`translate(226 ${64 + i * 18})`}>
                    <circle cx={6} cy={6} r="6" fill={i < 3 ? A : 'rgba(255,255,255,0.18)'} />
                    <L x={18} y={4} w={46} o={i < 3 ? 0.5 : 0.22} />
                </g>
            ))}
            <text x={270} y={136} textAnchor="middle" fill="#fff" fillOpacity="0.45" fontSize="9" fontFamily="Inter, system-ui">3 af 4 sæder</text>
        </>
    ),

    // ── Budget — burn mod baseline ───────────────────────────────────────────
    budget: (
        <>
            <P x={18} y={22} w={190} h={136} r={12} />
            <defs>
                <linearGradient id="sc-burn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={A} stopOpacity="0.55" />
                    <stop offset="100%" stopColor={A} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d="M32 132 L64 118 L96 108 L128 84 L160 74 L192 46 L192 132 Z" fill="url(#sc-burn)" />
            <path d="M32 132 L64 118 L96 108 L128 84 L160 74 L192 46" fill="none" stroke={A} strokeWidth="2.5" strokeLinecap="round" className="sc-draw" style={draw(0)} />
            <line x1={32} y1={58} x2={192} y2={58} stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={36} y={52} fill="#fff" fillOpacity="0.5" fontSize="9" fontFamily="Inter, system-ui">baseline</text>
            <circle cx={192} cy={46} r="5" fill="#fff" />
            <circle cx={192} cy={46} r="10" fill="#fff" opacity="0.25" className="sc-ring" />
            {([['Materialer', 0.82, A], ['Timer', 0.58, B], ['UE', 1.04, '#F97066']] as const).map(([label, v, c], i) => (
                <g key={label} transform={`translate(222 ${42 + i * 38})`}>
                    <text fill="#fff" fillOpacity="0.55" fontSize="9" fontFamily="Inter, system-ui">{label}</text>
                    <rect y={8} width="76" height="8" rx="4" fill="#fff" opacity="0.14" />
                    <rect y={8} width={Math.min(76, 76 * v)} height="8" rx="4" fill={c}
                        className="sc-reveal" style={{ ['--d' as string]: `${300 + i * 140}ms` }} />
                </g>
            ))}
        </>
    ),

    // ── Indkøb — kurv, kvittering og levering ────────────────────────────────
    purchasing: (
        <>
            <g transform="translate(34 56)">
                <path d="M0 0 h12 l14 56 h58 l12 -38 H20" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx={34} cy={68} r="7" fill="#fff" opacity="0.7" />
                <circle cx={76} cy={68} r="7" fill="#fff" opacity="0.7" />
                <circle cx={92} cy={-6} r="12" fill={A} />
                <text x={92} y={-2} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="700" fontFamily="Inter, system-ui">3</text>
            </g>
            <g className="sc-float" transform="translate(150 22)">
                <path d="M0 8 a8 8 0 0 1 8 -8 h74 a8 8 0 0 1 8 8 v112 l-10 -6 l-10 6 l-10 -6 l-10 6 l-10 -6 l-10 6 l-10 -6 l-10 6 Z" fill="#fff" opacity="0.95" />
                <rect x={14} y={16} width={44} height={5} rx={2.5} fill="#0B1220" opacity="0.6" />
                {[0, 1, 2, 3].map((i) => (
                    <g key={i}>
                        <rect x={14} y={32 + i * 14} width={[38, 46, 30, 42][i]} height={3} rx={1.5} fill="#0B1220" opacity="0.2" />
                        <rect x={64} y={32 + i * 14} width={12} height={3} rx={1.5} fill="#0B1220" opacity="0.3" />
                    </g>
                ))}
                <rect x={14} y={94} width={62} height={1.5} fill="#0B1220" opacity="0.2" />
                <rect x={14} y={102} width={26} height={5} rx={2.5} fill="#0B1220" opacity="0.55" />
                <rect x={56} y={102} width={20} height={5} rx={2.5} fill={A} />
            </g>
            <g transform="translate(250 92)">
                <rect width="34" height="26" rx="4" fill="#fff" opacity="0.75" />
                <path d="M34 10 h12 l8 8 v8 h-20 Z" fill="#fff" opacity="0.55" />
                <circle cx={12} cy={30} r="5" fill="#fff" opacity="0.85" />
                <circle cx={44} cy={30} r="5" fill="#fff" opacity="0.85" />
                <rect x={-4} y={-24} width="66" height="20" rx="10" fill="#4ADE80" />
                <text x={29} y={-10} textAnchor="middle" fill="#0B1220" fontSize="9" fontWeight="700" fontFamily="Inter, system-ui">Leveret</text>
            </g>
        </>
    ),

    // ── Tilbud — tilbudsark med total og underskrift ─────────────────────────
    quotations: (
        <>
            <g transform="translate(34 20) rotate(-3)"><rect width="140" height="140" rx="9" fill="#fff" opacity="0.25" /></g>
            <g className="sc-float" transform="translate(46 18)">
                <rect width="146" height="146" rx="10" fill="#fff" opacity="0.96" />
                <rect x={16} y={18} width={54} height={6} rx={3} fill="#0B1220" opacity="0.6" />
                <rect x={16} y={30} width={34} height={3} rx={1.5} fill="#0B1220" opacity="0.25" />
                <rect x={110} y={16} width={20} height={20} rx={5} fill={A} opacity="0.25" />
                {[0, 1, 2, 3].map((i) => (
                    <g key={i} transform={`translate(16 ${48 + i * 16})`}>
                        <rect width={[62, 74, 52, 68][i]} height="3.5" rx="1.75" fill="#0B1220" opacity="0.2" />
                        <rect x={92} width={22} height="3.5" rx="1.75" fill="#0B1220" opacity="0.32" />
                    </g>
                ))}
                <line x1={16} y1={116} x2={130} y2={116} stroke="#0B1220" strokeOpacity="0.15" />
                <text x={16} y={132} fill="#0B1220" fillOpacity="0.5" fontSize="9" fontFamily="Inter, system-ui">inkl. moms</text>
                <rect x={80} y={122} width={50} height={14} rx={7} fill={A} />
                <text x={105} y={132} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="Inter, system-ui">48.750</text>
            </g>
            <g transform="translate(206 62)">
                <path d="M2 44 q16 -34 30 -6 t28 -28" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="2.5" strokeLinecap="round" className="sc-draw" style={draw(400)} />
                <line x1={0} y1={56} x2={78} y2={56} stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" />
                <text x={0} y={72} fill="#fff" fillOpacity="0.45" fontSize="9" fontFamily="Inter, system-ui">Accepteret</text>
                <rect x={0} y={-24} width="78" height="18" rx="9" fill="#4ADE80" opacity="0.9" />
                <text x={39} y={-11} textAnchor="middle" fill="#0B1220" fontSize="9" fontWeight="700" fontFamily="Inter, system-ui">Sendt</text>
            </g>
        </>
    ),

    // ── Partnere — forhandlingstråd mellem to parter ─────────────────────────
    partners: (
        <>
            <g transform="translate(38 90)">
                <circle r="24" fill={A} />
                <circle cy={-6} r="7" fill="#fff" opacity="0.9" />
                <path d="M-12 14 a12 12 0 0 1 24 0" fill="#fff" opacity="0.9" />
                <text y={44} textAnchor="middle" fill="#fff" fillOpacity="0.5" fontSize="9" fontFamily="Inter, system-ui">Dig</text>
            </g>
            <g transform="translate(282 90)">
                <circle r="24" fill={B} />
                <circle cy={-6} r="7" fill="#fff" opacity="0.9" />
                <path d="M-12 14 a12 12 0 0 1 24 0" fill="#fff" opacity="0.9" />
                <text y={44} textAnchor="middle" fill="#fff" fillOpacity="0.5" fontSize="9" fontFamily="Inter, system-ui">UE</text>
            </g>
            <path d="M64 90 H256" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="4 4" className="sc-dash" />
            <g transform="translate(78 22)">
                <rect width="96" height="30" rx="10" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.24)" />
                <text x={14} y={20} fill="#fff" fillOpacity="0.8" fontSize="12" fontWeight="600" fontFamily="Inter, system-ui">28.000 kr</text>
            </g>
            <g transform="translate(146 60)" className="sc-float">
                <rect width="102" height="30" rx="10" fill="#fff" opacity="0.94" />
                <text x={14} y={20} fill="#0B1220" fontSize="12" fontWeight="700" fontFamily="Inter, system-ui">24.500 kr</text>
            </g>
            <g transform="translate(96 128)">
                <rect width="120" height="28" rx="14" fill="#4ADE80" opacity="0.92" />
                <path d="M18 14 l5 5 l10 -11" stroke="#0B1220" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <text x={44} y={19} fill="#0B1220" fontSize="11" fontWeight="700" fontFamily="Inter, system-ui">Accepteret</text>
            </g>
        </>
    ),

    // ── Rapporter — vifte af PDF-ark med grafik ──────────────────────────────
    reporting: (
        <>
            <g transform="translate(52 42) rotate(-10)"><rect width="112" height="128" rx="8" fill="#fff" opacity="0.2" /></g>
            <g transform="translate(74 32) rotate(-5)"><rect width="112" height="128" rx="8" fill="#fff" opacity="0.38" /></g>
            <g className="sc-float" transform="translate(96 22)">
                <rect width="118" height="136" rx="9" fill="#fff" opacity="0.97" />
                <rect x={14} y={16} width={48} height={6} rx={3} fill="#0B1220" opacity="0.6" />
                <rect x={14} y={28} width={30} height={3} rx={1.5} fill="#0B1220" opacity="0.22" />
                {[34, 52, 26, 44, 60].map((h, i) => (
                    <rect key={i} x={14 + i * 16} y={96 - h} width={10} height={h} rx={3}
                        fill={i === 4 ? A : '#0B1220'} opacity={i === 4 ? 1 : 0.18}
                        className="sc-reveal" style={{ ['--d' as string]: `${200 + i * 90}ms` }} />
                ))}
                <line x1={14} y1={98} x2={104} y2={98} stroke="#0B1220" strokeOpacity="0.15" />
                <circle cx={30} cy={118} r="12" fill="none" stroke="#0B1220" strokeOpacity="0.15" strokeWidth="5" />
                <circle cx={30} cy={118} r="12" fill="none" stroke={A} strokeWidth="5" strokeDasharray="75" strokeDashoffset="26" transform="rotate(-90 30 118)" />
                <rect x={52} y={110} width={52} height={4} rx={2} fill="#0B1220" opacity="0.2" />
                <rect x={52} y={120} width={38} height={4} rx={2} fill="#0B1220" opacity="0.14" />
            </g>
            <g transform="translate(234 50)">
                <rect width="66" height="24" rx="6" fill={A} />
                <text x={33} y={16} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Inter, system-ui">PDF</text>
                <rect y={32} width="66" height="24" rx="6" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.26)" />
                <text x={33} y={48} textAnchor="middle" fill="#fff" fillOpacity="0.75" fontSize="10" fontWeight="600" fontFamily="Inter, system-ui">Excel</text>
            </g>
        </>
    ),

    // ── Kunde-portal — afgrænset vindue med læseadgang ───────────────────────
    'client-portal': (
        <>
            <P x={54} y={22} w={212} h={136} r={14} fill="rgba(255,255,255,0.10)" />
            <line x1={54} y1={48} x2={266} y2={48} stroke="#fff" strokeOpacity="0.16" />
            {[0, 1, 2].map((i) => <circle key={i} cx={70 + i * 12} cy={35} r="3.5" fill="#fff" opacity="0.3" />)}
            <g transform="translate(70 60)">
                <rect width="86" height="82" rx="8" fill="rgba(255,255,255,0.12)" />
                <L x={12} y={12} w={44} o={0.55} h={4} />
                <rect x={12} y={26} width={62} height={5} rx={2.5} fill="#fff" opacity="0.16" />
                <rect x={12} y={26} width={44} height={5} rx={2.5} fill={A} />
                <text x={12} y={50} fill="#fff" fillOpacity="0.75" fontSize="15" fontWeight="700" fontFamily="Inter, system-ui">72%</text>
                <rect x={12} y={58} width={28} height={16} rx={4} fill="#fff" opacity="0.14" />
                <rect x={44} y={58} width={28} height={16} rx={4} fill="#fff" opacity="0.14" />
            </g>
            <g transform="translate(168 60)">
                <rect width="82" height="38" rx="8" fill="rgba(255,255,255,0.12)" />
                <L x={12} y={12} w={40} o={0.45} />
                <L x={12} y={22} w={54} o={0.25} />
                <rect y={46} width="82" height="36" rx="8" fill="rgba(255,255,255,0.06)" />
                <g transform="translate(41 64)">
                    <path d="M-11 0 a11 11 0 0 1 22 0" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="2" />
                    <text y={4} textAnchor="middle" fill="#fff" fillOpacity="0.25" fontSize="8" fontFamily="Inter, system-ui">skjult</text>
                </g>
            </g>
            <g className="sc-float" transform="translate(232 116)">
                <circle r="26" fill={A} />
                <path d="M-13 0 s6 -9 13 -9 s13 9 13 9 s-6 9 -13 9 s-13 -9 -13 -9 Z" fill="none" stroke="#fff" strokeWidth="2.2" />
                <circle r="4.5" fill="#fff" />
            </g>
            <g transform="translate(20 116)">
                <rect width="62" height="22" rx="11" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.26)" />
                <rect x={13} y={9} width={9} height={7} rx={1.5} fill="#fff" opacity="0.8" />
                <path d="M17.5 9 v-3 a3 3 0 0 1 6 0 v3" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" transform="translate(-3 0)" />
                <text x={40} y={15} textAnchor="middle" fill="#fff" fillOpacity="0.7" fontSize="9" fontWeight="600" fontFamily="Inter, system-ui">Læs</text>
            </g>
        </>
    ),

    // ── AI — konstellation og svarboble ──────────────────────────────────────
    ai: (
        <>
            <g stroke="#fff" strokeOpacity="0.2" strokeWidth="1">
                <path d="M46 52 L92 96 L44 128 M92 96 L132 44 M92 96 L138 130" className="sc-draw" style={draw(0)} />
            </g>
            {([[46, 52, 5], [92, 96, 9], [44, 128, 4], [132, 44, 6], [138, 130, 5]] as const).map(([cx, cy, r], i) => (
                <circle key={i} cx={cx} cy={cy} r={r} fill={i === 1 ? A : '#fff'} opacity={i === 1 ? 1 : 0.45}
                    className={i === 1 ? 'sc-float' : undefined} />
            ))}
            <circle cx={92} cy={96} r="18" fill={A} opacity="0.25" className="sc-ring" />
            <g className="sc-float-slow" transform="translate(158 30)">
                <rect width="140" height="60" rx="14" fill="#fff" opacity="0.96" />
                <path d="M14 60 v14 l18 -14 Z" fill="#fff" opacity="0.96" />
                <rect x={16} y={16} width={82} height={5} rx={2.5} fill="#0B1220" opacity="0.55" />
                <rect x={16} y={28} width={104} height={4} rx={2} fill="#0B1220" opacity="0.2" />
                <rect x={16} y={39} width={64} height={4} rx={2} fill="#0B1220" opacity="0.2" />
                <path d="M116 12 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill={A} />
            </g>
            <g transform="translate(180 116)">
                <rect width="96" height="34" rx="17" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.24)" />
                {[0, 1, 2].map((i) => (
                    <circle key={i} cx={28 + i * 20} cy={17} r="5" fill="#fff" opacity="0.65"
                        className="sc-reveal" style={{ ['--d' as string]: `${i * 180}ms` }} />
                ))}
            </g>
        </>
    ),

    // ── AR — viewport med reticle og målsætning ──────────────────────────────
    ar: (
        <>
            <rect x={38} y={18} width={244} height={144} rx={16} fill="#050A14" opacity="0.55" stroke="rgba(255,255,255,0.2)" />
            <g stroke={A} strokeWidth="3" strokeLinecap="round" fill="none">
                <path d="M56 46 v-12 h12 M252 34 h12 v12 M264 134 v12 h-12 M68 146 h-12 v-12" />
            </g>
            <g stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" fill="none">
                <path d="M96 118 L96 62 L172 44 L172 100 Z" className="sc-draw" style={draw(0)} />
                <path d="M172 44 L232 66 L232 120 L172 100" className="sc-draw" style={draw(250)} />
                <path d="M96 118 L156 138 L232 120" className="sc-draw" style={draw(500)} />
            </g>
            <path d="M96 118 L96 62 L172 44 L172 100 Z" fill={A} opacity="0.14" />
            {([[96, 62], [172, 44], [232, 66], [96, 118], [232, 120]] as const).map(([cx, cy], i) => (
                <g key={i}>
                    <circle cx={cx} cy={cy} r="4.5" fill="#fff" />
                    {i === 1 && <circle cx={cx} cy={cy} r="12" fill="#fff" opacity="0.3" className="sc-ring" />}
                </g>
            ))}
            <rect x={38} y={18} width={244} height={3} fill={A} opacity="0.45" className="sc-scanline" />
            <g transform="translate(104 82)">
                <rect width="58" height="20" rx="10" fill="#fff" opacity="0.94" />
                <text x={29} y={14} textAnchor="middle" fill="#0B1220" fontSize="10" fontWeight="700" fontFamily="Inter, system-ui">3,80 m</text>
            </g>
            <g transform="translate(186 74)">
                <rect width="58" height="20" rx="10" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.3)" />
                <text x={29} y={14} textAnchor="middle" fill="#fff" fillOpacity="0.85" fontSize="10" fontWeight="600" fontFamily="Inter, system-ui">2,55 m</text>
            </g>
        </>
    ),

    // ── Integrationer — hub med tilkoblede tjenester ─────────────────────────
    integrations: (
        <>
            <g stroke="#fff" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="4 4" className="sc-dash">
                <path d="M160 90 L74 44 M160 90 L74 136 M160 90 L246 44 M160 90 L246 136" />
            </g>
            <g className="sc-float">
                <circle cx={160} cy={90} r="34" fill={A} />
                <circle cx={160} cy={90} r="44" fill={A} opacity="0.2" className="sc-ring" />
                <path d="M146 94 a12 12 0 0 1 3 -23 a15 15 0 0 1 28 4 a10 10 0 0 1 -2 19 Z" fill="#fff" opacity="0.95" />
            </g>
            {([[74, 44], [74, 136], [246, 44], [246, 136]] as const).map(([cx, cy], i) => (
                <g key={i} transform={`translate(${cx} ${cy})`} className="sc-reveal" style={{ ['--d' as string]: `${200 + i * 130}ms` }}>
                    <rect x={-30} y={-18} width={60} height={36} rx={10} fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.26)" />
                    <circle cx={-14} r="8" fill="#fff" opacity={0.75} />
                    <rect x={0} y={-6} width={22} height={4} rx={2} fill="#fff" opacity="0.45" />
                    <rect x={0} y={2} width={14} height={4} rx={2} fill="#fff" opacity="0.25" />
                </g>
            ))}
            <g transform="translate(122 148)">
                <rect width="76" height="22" rx="11" fill="#4ADE80" opacity="0.9" />
                <text x={38} y={15} textAnchor="middle" fill="#0B1220" fontSize="10" fontWeight="700" fontFamily="Inter, system-ui">Forbundet</text>
            </g>
        </>
    ),
};

/**
 * Decorative hero scene for a module. Draw it inside a `.sc-stage` element
 * that carries the accent custom properties.
 */
export const ModuleHeroArt: React.FC<{ moduleId: ModuleId; className?: string }> = ({ moduleId, className }) => (
    <svg
        viewBox="0 0 320 180"
        className={className}
        role="presentation"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
    >
        {scenes[moduleId]}
    </svg>
);
