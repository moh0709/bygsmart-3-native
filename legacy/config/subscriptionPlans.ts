
import { SubscriptionTier, UserRole } from '../types';

export interface PlanLimits {
    maxActiveProjects: number;
    canInviteTeam: boolean;
    allowedRoles: UserRole[]; // Which roles can they invite?
    aiDailyLimit: number;
    advancedCalculators: boolean; // Static calculations
    financialTools: boolean; // Budget/Purchase
}

const TIER_PRIORITY: SubscriptionTier[] = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];

/** Higher of two tiers — used to overlay an admin-granted trial on the real tier. */
export const maxSubscriptionTier = (a: SubscriptionTier, b: SubscriptionTier): SubscriptionTier => {
    const ai = TIER_PRIORITY.indexOf(a);
    const bi = TIER_PRIORITY.indexOf(b);
    return TIER_PRIORITY[Math.max(ai, bi)];
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanLimits> = {
    FREE: {
        maxActiveProjects: 1,
        canInviteTeam: false,
        allowedRoles: [],
        aiDailyLimit: 5,
        advancedCalculators: false,
        financialTools: false
    },
    PRO: {
        maxActiveProjects: 5,
        canInviteTeam: true,
        allowedRoles: ['EMPLOYEE', 'CLIENT'], // Can invite Staff and Clients
        aiDailyLimit: 50,
        advancedCalculators: true,
        financialTools: true
    },
    PREMIUM: {
        maxActiveProjects: 1000, // Unlimited
        canInviteTeam: true,
        allowedRoles: ['MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT'], // Full RBAC including Subcontractors
        aiDailyLimit: 1000,
        advancedCalculators: true,
        financialTools: true
    },
    ENTERPRISE: {
        maxActiveProjects: 10000,
        canInviteTeam: true,
        allowedRoles: ['MANAGER', 'EMPLOYEE', 'EXTERNAL', 'CLIENT'],
        aiDailyLimit: 10000,
        advancedCalculators: true,
        financialTools: true
    }
};

export const PRO_TOOLS_IDS = [
    // Areal & Rumfang (cat 1)
    'rumareal',
    'vaegareal',
    'rumfangsberegner',
    // Gulve & Overflader (cat 2)
    'flisemaengde',
    'gulvisolering',
    'traegulv-maengde',
    'taeppe-laminat',
    'gulvafretning',
    // Vægge & Skillevægge (cat 3)
    'maling-grunder',
    'gipsplader',
    'puds-spartel',
    'vaegisolering',
    'mursten-blokke',
    'vaegge-skillevaegge-skeletvaeg',
    'vaegge-skillevaegge-maling-pro',
    // Lofter & Tag (cat 4)
    'loftisolering',
    'lofter-tag-laegter',
    'lofter-tag-spaer-estimat',
    'lofter-tag-loftplader',
    // Beton & Armering (cat 5)
    'beton-volumen',
    'blandingsforhold',
    'beton-armering-fundablokke',
    'beton-armering-armeringsstaal',
    'beton-armering-forskalling',
    // Udgravning & Jord (cat 6)
    'udgravning-jord-jordvolumen',
    'udgravning-jord-skraaning',
    'udgravning-jord-tilbagefyldning',
    // Udenomsarealer (cat 7)
    'udenomsarealer-fald',
    'udenomsarealer-hegn',
    'flisebelaegning',
    // Geometri (cat 8)
    'geometri-pythagoras',
    'geometri-cirkel',
    // Døre & Vinduer (cat 9)
    'doere-vinduer-redningsaabning',
    'doere-vinduer-vinduesareal',
    // Statiske Beregninger (Phase 2 Pro)
    'statiske-beregninger-bjaelkebelastning',
    'statiske-beregninger-soejlebelastning',
    // Energi & Klima (Phase 2 Pro)
    'energi-klima-varmetab',
    'energi-klima-co2',
]; // Canonical IDs from listCalculators() for tools that require Pro/Premium

// --- Presentation Data for UI (i18n ready structure) ---
export const PLAN_DETAILS: Record<SubscriptionTier, {
    label: string;
    price: string;
    period: string;
    description: string;
    color: string;
    features: { text: string; included: boolean }[];
    buttonText: string;
}> = {
    FREE: {
        label: 'Start',
        price: '0 kr.',
        period: 'for altid',
        description: 'Til gør-det-selv og små enkeltstående opgaver.',
        color: 'bg-gray-100 text-gray-800',
        buttonText: 'Nuværende',
        features: [
            { text: '1 Aktivt Projekt', included: true },
            { text: 'Basale Beregnere', included: true },
            { text: 'AI Assistent (5 beskeder/dag)', included: true },
            { text: 'Inviter Medarbejdere', included: false },
            { text: 'Økonomistyring', included: false },
            { text: 'PDF Rapporter', included: false },
        ]
    },
    PRO: {
        label: 'Mester',
        price: '199 kr.',
        period: 'pr. md. / bruger',
        description: 'Til håndværkeren med et lille team.',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        buttonText: 'Opgrader til Mester',
        features: [
            { text: '5 Aktive Projekter', included: true },
            { text: 'Statiske Beregnere (Pro)', included: true },
            { text: 'AI Assistent (50 beskeder/dag)', included: true },
            { text: 'Inviter Medarbejdere & Kunder', included: true },
            { text: 'Økonomistyring (Budget)', included: true },
            { text: 'Underentreprenør Adgang', included: false },
        ]
    },
    PREMIUM: {
        label: 'Entreprise',
        price: '499 kr.',
        period: 'pr. md. / bruger',
        description: 'Til virksomheden der styrer underentreprenører.',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        buttonText: 'Opgrader til Entreprise',
        features: [
            { text: 'Ubegrænset Projekter', included: true },
            { text: 'Alle Beregnere & Værktøjer', included: true },
            { text: 'Ubegrænset AI', included: true },
            { text: 'Fuld Team (Inviter Underentreprenører)', included: true },
            { text: 'Avanceret Økonomi & Indkøb', included: true },
            { text: 'KS & Fotodokumentation', included: true },
        ]
    },
    ENTERPRISE: {
        label: 'Koncern',
        price: 'Kontakt os',
        period: '',
        description: 'Skræddersyet løsning til større firmaer.',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        buttonText: 'Kontakt Salg',
        features: [
            { text: 'Alt i Entreprise', included: true },
            { text: 'API Integration', included: true },
            { text: 'SSO Login', included: true },
            { text: 'Dedikeret Support', included: true },
            { text: 'Eget Logo på Rapporter', included: true },
            { text: 'Egne Skabeloner', included: true },
        ]
    }
};

export const getPlanName = (tier: SubscriptionTier) => {
    return PLAN_DETAILS[tier]?.label || tier;
};
