
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HomeIcon,
    LayersIcon,
    BuildingIcon,
    SlidersHorizontalIcon,
    ThermometerIcon,
    MapPinIcon,
    ListIcon,
    RefreshCwIcon,
    StarIcon,
    CalculatorIcon,
    SparklesIcon,
    SlidersIcon,
    FileTextIcon,
    WaveformIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    SettingsIcon,
    SearchIcon,
    ClockIcon,
    XIcon,
    CameraIcon,
    TrendingUpIcon
} from '../../../components/icons';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useToolAccessContext } from '../../../contexts/ToolAccessProvider';
import { CampaignBadge } from '../components/ProToolGate';
import { useToast } from '../../../contexts/ToastContext';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import {
    AppScreen,
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    Input,
    ListRow,
} from '../../../components/ui';

type IconComponent = React.FC<{ className?: string; filled?: boolean }>;

interface CatalogTool {
    name: string;
    path: string;
    icon: IconComponent;
    /** Tool-access id — present on Pro-gated tools. */
    id?: string;
    isNew?: boolean;
}

interface CatalogCategory {
    name: string;
    icon: IconComponent;
    subCategories: CatalogTool[];
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    'Areal & Rumfang':      'Rum-, væg- og bygningsarealer',
    'Energi & Klima':       'U-værdier, varmetab og CO₂',
    'Trapper & Adgang':     'Ligeløb, vanger og ramper',
    'Statiske Beregninger': 'Bjælker, søjler og laster',
    'Gulve & Overflader':   'Fliser, trægulv og afretning',
    'Vægge & Skillevægge':  'Mursten, gips og isolering',
    'Lofter & Tag':         'Taghældning, lægter og spær',
    'Døre & Vinduer':       'U-værdier, åbninger og fuger',
    'VVS':                  'Rør, radiatorer og gulvvarme',
    'El':                   'Kabler, sikringer og solpanel',
    'HVAC / Ventilation':   'Luftskifte, kanaler og flow',
    'Beton & Armering':     'Volumen, blanding og armering',
    'Udgravning & Jord':    'Volumen, skråning og fyld',
    'Udenomsarealer':       'Fliser, fald og hegn',
    'Geometri & Opmåling':  'AR-opmåling, vinkler og cirkler',
    'Pris & Budget':        'Budget, materialer og finansiering',
};

const FEATURED_TOOLS = [
    { name: 'Betonvolumen', path: '/tools/beton-armering/betonvolumen', category: 'Beton & Armering', emoji: '🧱' },
    { name: 'Taghældning', path: '/tools/lofter-tag/taghaelding', category: 'Lofter & Tag', emoji: '🏠' },
    { name: 'Kabeldimensionering', path: '/tools/el/kabel', category: 'El', emoji: '⚡' },
    { name: 'Flisemængde', path: '/tools/gulve-overflader/flisemaengde', category: 'Gulve & Overflader', emoji: '🪟' },
    { name: 'Luftskifte', path: '/tools/hvac/luftskifte', category: 'HVAC / Ventilation', emoji: '💨' },
    { name: '3-4-5 Vinkel', path: '/tools/geometri/pythagoras', category: 'Geometri & Opmåling', emoji: '📐' },
];

const calculatorCategories: CatalogCategory[] = [
    {
        name: 'Areal & Rumfang',
        icon: CalculatorIcon,
        subCategories: [
            { name: 'Rumareal', path: '/tools/areal-rumfang/rumareal', icon: MapPinIcon },
            { name: 'Vægareal', path: '/tools/areal-rumfang/vaegareal', icon: BuildingIcon },
            { name: 'Loftsareal', path: '/tools/areal-rumfang/loftsareal', icon: BuildingIcon },
            { name: 'Tagareal', path: '/tools/areal-rumfang/tagareal', icon: HomeIcon },
            { name: 'Gulvareal', path: '/tools/areal-rumfang/gulvareal', icon: LayersIcon },
            { name: 'Bygningsskal areal', path: '/tools/areal-rumfang/bygningsskal-areal', icon: BuildingIcon },
            { name: 'Rumfangsberegner', path: '/tools/areal-rumfang/rumfangsberegner', icon: CalculatorIcon },
            { name: 'Materialevolumen', path: '/tools/areal-rumfang/materialevolumen', icon: LayersIcon },
        ]
    },
    {
        name: 'Energi & Klima',
        icon: ThermometerIcon,
        subCategories: [
            { name: 'Varmetabsberegner (U-værdi)', path: '/tools/energi-klima/varmetab', icon: ThermometerIcon, id: 'energi-klima-varmetab' },
            { name: 'CO2-aftryk (LCA Light)', path: '/tools/energi-klima/co2', icon: SparklesIcon, id: 'energi-klima-co2' },
            { name: 'Dugpunktsberegner', path: '/tools/energi-klima/dugpunkt', icon: RefreshCwIcon, id: 'energi-klima-dugpunkt' },
        ]
    },
    {
        name: 'Trapper & Adgang',
        icon: SlidersIcon,
        subCategories: [
            { name: 'Trappeberegner (Ligeløb)', path: '/tools/trapper/ligeloeb', icon: SlidersIcon, id: 'trapper-ligeloeb' },
            { name: 'Trappevanger (Snit)', path: '/tools/trapper/vanger', icon: FileTextIcon },
            { name: 'Rampe-beregner', path: '/tools/trapper/rampe', icon: SlidersHorizontalIcon },
        ]
    },
    {
        name: 'Statiske Beregninger',
        icon: BuildingIcon,
        subCategories: [
            { name: 'Bjælkebelastning (Pro)', path: '/tools/statiske-beregninger/bjaelkebelastning', icon: WaveformIcon, id: 'statiske-beregninger-bjaelkebelastning' },
            { name: 'Søjlebelastning', path: '/tools/statiske-beregninger/soejlebelastning', icon: SlidersIcon, id: 'statiske-beregninger-soejlebelastning' },
            { name: 'Dækbelastning', path: '/tools/statiske-beregninger/daekbelastning', icon: LayersIcon, id: 'statiske-beregninger-daekbelastning' },
            { name: 'Fundament', path: '/tools/statiske-beregninger/fundament', icon: LayersIcon, id: 'statiske-beregninger-fundament' },
            { name: 'Taglast & snelast', path: '/tools/statiske-beregninger/taglast-snelast', icon: HomeIcon, id: 'statiske-beregninger-taglast-snelast' },
            { name: 'Vindlast', path: '/tools/statiske-beregninger/vindlast', icon: RefreshCwIcon, id: 'statiske-beregninger-vindlast' },
            { name: 'Bærende væg', path: '/tools/statiske-beregninger/baerende-vaeg', icon: BuildingIcon, id: 'statiske-beregninger-baerende-vaeg' },
            { name: 'Nedbøjning', path: '/tools/statiske-beregninger/nedboejning', icon: SlidersIcon, id: 'statiske-beregninger-nedboejning' },
        ]
    },
    {
        name: 'Gulve & Overflader',
        icon: LayersIcon,
        subCategories: [
            { name: 'Gulvafretning', path: '/tools/gulve-overflader/gulvafretning', icon: LayersIcon },
            { name: 'Flisemængde', path: '/tools/gulve-overflader/flisemaengde', icon: CheckCircleIcon },
            { name: 'Trægulv mængde', path: '/tools/gulve-overflader/traegulv-maengde', icon: LayersIcon },
            { name: 'Tæppe/laminat', path: '/tools/gulve-overflader/taeppe-laminat', icon: LayersIcon },
            { name: 'Gulvisolering', path: '/tools/gulve-overflader/gulvisolering', icon: LayersIcon },
        ]
    },
    {
        name: 'Vægge & Skillevægge',
        icon: LayersIcon,
        subCategories: [
            { name: 'Skiftegangsberegner', path: '/tools/vaegge-skillevaegge/skiftegang', icon: ListIcon, isNew: true },
            { name: 'Skeletvæg (Stolper)', path: '/tools/vaegge-skillevaegge/skeletvaeg', icon: SlidersHorizontalIcon },
            { name: 'Mursten/blokke', path: '/tools/vaegge-skillevaegge/mursten-blokke', icon: BuildingIcon },
            { name: 'Gipsplader', path: '/tools/vaegge-skillevaegge/gipsplader', icon: LayersIcon },
            { name: 'Puds & spartel', path: '/tools/vaegge-skillevaegge/puds-spartel', icon: LayersIcon },
            { name: 'Vægisolering', path: '/tools/vaegge-skillevaegge/vaegisolering', icon: LayersIcon },
            { name: 'Maling & grunder', path: '/tools/vaegge-skillevaegge/maling-grunder', icon: FileTextIcon },
            { name: 'Malingsestimering Pro', path: '/tools/vaegge-skillevaegge/maling-pro', icon: FileTextIcon, isNew: true },
        ]
    },
    {
        name: 'Lofter & Tag',
        icon: BuildingIcon,
        subCategories: [
            { name: 'Lægteberegner', path: '/tools/lofter-tag/laegter', icon: ListIcon, isNew: true },
            { name: 'Tagrendeberegner', path: '/tools/lofter-tag/tagrender', icon: RefreshCwIcon, isNew: true },
            { name: 'Loftplader', path: '/tools/lofter-tag/loftplader', icon: LayersIcon },
            { name: 'Loftisolering', path: '/tools/lofter-tag/loftisolering', icon: LayersIcon },
            { name: 'Tagmateriale', path: '/tools/lofter-tag/tagmateriale', icon: HomeIcon },
            { name: 'Vandtætning', path: '/tools/lofter-tag/vandtætning', icon: CheckCircleIcon },
            { name: 'Taghældning', path: '/tools/lofter-tag/taghaelding', icon: SlidersIcon },
            { name: 'Spær estimat', path: '/tools/lofter-tag/spaer-estimat', icon: BuildingIcon, id: 'lofter-tag-spaer-estimat' },
        ]
    },
    {
        name: 'Døre & Vinduer',
        icon: BuildingIcon,
        subCategories: [
            { name: 'Redningsåbning Tjek', path: '/tools/doere-vinduer/redningsaabning', icon: AlertTriangleIcon },
            { name: 'Vinduesareal', path: '/tools/doere-vinduer/vinduesareal', icon: BuildingIcon },
            { name: 'U-værdi', path: '/tools/doere-vinduer/u-vaerdi', icon: SlidersIcon },
            { name: 'Dørstørrelse', path: '/tools/doere-vinduer/doerstoerrelse', icon: BuildingIcon },
            { name: 'Fugemasse', path: '/tools/doere-vinduer/fugemasse', icon: CalculatorIcon },
        ]
    },
    {
        name: 'VVS',
        icon: SlidersHorizontalIcon,
        subCategories: [
            { name: 'Rørdimension', path: '/tools/vvs/roerdimension', icon: SlidersHorizontalIcon, id: 'vvs-roerdimension' },
            { name: 'Vandflow', path: '/tools/vvs/vandflow', icon: RefreshCwIcon, id: 'vvs-vandflow' },
            { name: 'Kedelstørrelse', path: '/tools/vvs/kedelstoerrelse', icon: SlidersHorizontalIcon },
            { name: 'Radiatorstørrelse', path: '/tools/vvs/radiatorstoerrelse', icon: SlidersHorizontalIcon },
            { name: 'Gulvvarme', path: '/tools/vvs/gulvvarme', icon: LayersIcon, id: 'vvs-gulvvarme' },
            { name: 'Afløbsfald', path: '/tools/vvs/afloebsfald', icon: SlidersIcon, id: 'vvs-afloebsfald' },
        ]
    },
    {
        name: 'El',
        icon: SettingsIcon,
        subCategories: [
            { name: 'Kabel', path: '/tools/el/kabel', icon: SettingsIcon, id: 'el-kabel' },
            { name: 'Kredsløbsbelastning', path: '/tools/el/kredslobsbelastning', icon: SettingsIcon, id: 'el-kredslobsbelastning' },
            { name: 'Sikring', path: '/tools/el/sikring', icon: SettingsIcon, id: 'el-sikring' },
            { name: 'Lyspunkter', path: '/tools/el/lyspunkter', icon: SettingsIcon, id: 'el-lyspunkter' },
            { name: 'Solpanel', path: '/tools/el/solpanel', icon: SettingsIcon, id: 'el-solpanel' },
            { name: 'Solcelle ROI', path: '/tools/el/sol-roi', icon: TrendingUpIcon, isNew: true, id: 'el-sol-roi' },
        ]
    },
    {
        name: 'HVAC / Ventilation',
        icon: RefreshCwIcon,
        subCategories: [
            { name: 'Ventilationsflow', path: '/tools/hvac/ventilationsflow', icon: RefreshCwIcon, id: 'hvac-ventilationsflow' },
            { name: 'Kanaldimension', path: '/tools/hvac/kanaldimension', icon: SlidersHorizontalIcon, id: 'hvac-kanaldimension' },
            { name: 'Luftskifte', path: '/tools/hvac/luftskifte', icon: RefreshCwIcon, id: 'hvac-luftskifte' },
            { name: 'Udsugning', path: '/tools/hvac/udsugning', icon: RefreshCwIcon, id: 'hvac-udsugning' },
        ]
    },
    {
        name: 'Beton & Armering',
        icon: LayersIcon,
        subCategories: [
            { name: 'Fundablokke', path: '/tools/beton-armering/fundablokke', icon: LayersIcon, isNew: true },
            { name: 'Blandingsforhold (Mix)', path: '/tools/beton-armering/blandingsforhold', icon: RefreshCwIcon },
            { name: 'Betonvolumen', path: '/tools/beton-armering/betonvolumen', icon: CalculatorIcon },
            { name: 'Armeringsstål', path: '/tools/beton-armering/armeringsstaal', icon: LayersIcon },
            { name: 'Forskalling', path: '/tools/beton-armering/forskalling', icon: LayersIcon },
        ]
    },
    {
        name: 'Udgravning & Jord',
        icon: LayersIcon,
        subCategories: [
            { name: 'Jordvolumen', path: '/tools/udgravning-jord/jordvolumen', icon: CalculatorIcon },
            { name: 'Udgravningsskråning', path: '/tools/udgravning-jord/skraaning', icon: SlidersIcon },
            { name: 'Tilbagefyldning', path: '/tools/udgravning-jord/tilbagefyldning', icon: LayersIcon },
        ]
    },
    {
        name: 'Udenomsarealer',
        icon: MapPinIcon,
        subCategories: [
            { name: 'Flisebelægning', path: '/tools/udenomsarealer/fliser', icon: MapPinIcon },
            { name: 'Fald på Terræn', path: '/tools/udenomsarealer/fald', icon: SlidersHorizontalIcon },
            { name: 'Hegn & Stolper', path: '/tools/udenomsarealer/hegn', icon: BuildingIcon },
        ]
    },
    {
        name: 'Geometri & Opmåling',
        icon: WaveformIcon,
        subCategories: [
            { name: 'AR Opmåling', path: '/tools/geometri/ar-opmåling', icon: CameraIcon, isNew: true },
            { name: '3-4-5 Vinkel', path: '/tools/geometri/pythagoras', icon: CalculatorIcon },
            { name: 'Cirkel & Bue', path: '/tools/geometri/cirkel', icon: RefreshCwIcon },
        ]
    },
    {
        name: 'Pris & Budget',
        icon: CalculatorIcon,
        subCategories: [
            { name: 'Projektbudget', path: '/tools/pris-budget/projektbudget', icon: CalculatorIcon, id: 'projektbudget' },
            { name: 'Materialeomkostning', path: '/tools/pris-budget/materialeomkostning', icon: CalculatorIcon, id: 'materialeomkostning' },
            { name: 'Arbejdsløn', path: '/tools/pris-budget/arbejdsloen', icon: CalculatorIcon, id: 'arbejdsloen' },
            { name: 'Finansieringsberegner', path: '/tools/pris-budget/finansiering', icon: CalculatorIcon, isNew: true, id: 'finansiering' },
        ]
    }
];

/** Caption-style section header (uppercase, DS 2.0). */
const SectionHeader: React.FC<{ icon?: React.ReactNode; title: string; meta?: string }> = ({ icon, title, meta }) => (
    <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="shrink-0 text-caption font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary flex items-center gap-1.5">
            {icon}
            {title}
        </h2>
        {meta && <span className="min-w-0 truncate text-caption text-text-tertiary dark:text-text-dark-tertiary">{meta}</span>}
    </div>
);

const CalculationToolsPage: React.FC = () => {
    const navigate = useNavigate();
    const { upgradeTo } = useSubscription();
    const { getAccess } = useToolAccessContext();
    const { showToast } = useToast();
    const [pendingProToolPath, setPendingProToolPath] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('Alle');

    // Favorites
    const [favorites, setFavorites] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('bygSmart-tool-favorites') || '[]'); } catch { return []; }
    });

    // Recents
    const [recents, setRecents] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('bygSmart-tool-recents') || '[]'); } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem('bygSmart-tool-favorites', JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => {
        localStorage.setItem('bygSmart-tool-recents', JSON.stringify(recents));
    }, [recents]);

    const toggleFavorite = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavorites(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
    };

    const handleToolClick = (path: string, id?: string) => {
        if (id) {
            const { allowed } = getAccess(id);
            if (!allowed) {
                setPendingProToolPath(path || id);
                return;
            }
        }

        // Add to recents
        const newRecents = [path, ...recents.filter(p => p !== path)].slice(0, 4);
        setRecents(newRecents);

        if (path) navigate(path);
        else showToast('Dette værktøj er under udvikling.', 'info');
    };

    // Flatten all tools for easy searching
    const allTools = useMemo(() => calculatorCategories.flatMap(cat => cat.subCategories.map(tool => ({...tool, category: cat.name}))), []);

    const favoriteTools = allTools.filter(tool => favorites.includes(tool.path));
    const recentTools = allTools.filter(tool => recents.includes(tool.path)).sort((a, b) => recents.indexOf(a.path) - recents.indexOf(b.path));

    // Filtering Logic
    const filteredCategories = useMemo(() => {
        if (activeCategoryFilter === 'Alle' && !searchTerm) return calculatorCategories;

        const lowerSearch = searchTerm.toLowerCase();

        return calculatorCategories.map(cat => {
            // If category matches filter (or All)
            const matchesCategory = activeCategoryFilter === 'Alle' || cat.name === activeCategoryFilter;

            if (!matchesCategory) return null;

            // Filter subcategories based on search
            const filteredSub = cat.subCategories.filter(sub =>
                sub.name.toLowerCase().includes(lowerSearch) ||
                cat.name.toLowerCase().includes(lowerSearch)
            );

            if (filteredSub.length > 0) {
                return { ...cat, subCategories: filteredSub };
            }
            return null;
        }).filter(Boolean) as typeof calculatorCategories;
    }, [searchTerm, activeCategoryFilter]);

    /** One catalog row: real-button ListRow + overlaid 44px favorite star. */
    const renderToolRow = (tool: CatalogTool & { category: string }) => {
        const access = tool.id ? getAccess(tool.id) : null;
        const isLocked = access ? !access.allowed : false;
        const isCampaign = access?.reason === 'campaign';
        const isFav = favorites.includes(tool.path);

        return (
            <div key={tool.path} className="relative">
                <ListRow
                    leading={
                        <span
                            className="w-9 h-9 rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light flex items-center justify-center shrink-0"
                            aria-hidden="true"
                        >
                            <tool.icon className="w-4 h-4" />
                        </span>
                    }
                    title={tool.name}
                    subtitle={tool.category}
                    trailing={
                        <>
                            {tool.isNew && !isLocked && <Badge variant="success">Ny</Badge>}
                            {isCampaign && access?.campaignUntil && <CampaignBadge campaignUntil={access.campaignUntil} />}
                            {isLocked && <Badge variant="brand">PRO</Badge>}
                            {/* Reserved space for the overlaid favorite button */}
                            <span className="w-9" aria-hidden="true" />
                        </>
                    }
                    onClick={() => handleToolClick(tool.path, tool.id)}
                />
                <button
                    type="button"
                    onClick={(e) => toggleFavorite(tool.path, e)}
                    aria-label={isFav ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
                    className={`absolute right-9 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-control transition-colors duration-150 ${
                        isFav
                            ? 'text-warning'
                            : 'text-text-tertiary hover:text-warning dark:text-text-dark-tertiary'
                    }`}
                >
                    <StarIcon filled={isFav} className="w-4 h-4" />
                </button>
            </div>
        );
    };

    const showOverviewSections = !searchTerm && activeCategoryFilter === 'Alle';

    return (
        <>
        <AppScreen
            hasBottomNav={false}
            header={{
                title: 'Alle beregnere',
                subtitle: `${allTools.length} beregnere · ${calculatorCategories.length} kategorier`,
                back: '/tools',
            }}
        >
            {/* Search */}
            <div className="relative mt-2">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none z-10" />
                <Input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Søg efter værktøj..."
                    aria-label="Søg efter værktøj"
                    className="pl-10 pr-11"
                />
                {searchTerm && (
                    <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        aria-label="Ryd søgning"
                        className="absolute right-0 top-0 w-11 h-11 flex items-center justify-center text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary transition-colors duration-150"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 md:-mx-6 md:px-6 py-3">
                <Chip selected={activeCategoryFilter === 'Alle'} onClick={() => setActiveCategoryFilter('Alle')}>
                    Alle
                </Chip>
                {calculatorCategories.map(cat => (
                    <Chip
                        key={cat.name}
                        selected={activeCategoryFilter === cat.name}
                        onClick={() => setActiveCategoryFilter(cat.name)}
                    >
                        {cat.name}
                    </Chip>
                ))}
            </div>

            <div className="space-y-6 mt-2">
                {/* ── Populære beregninger ─────────────────────────────────── */}
                {showOverviewSections && (
                    <section>
                        <SectionHeader
                            icon={<SparklesIcon className="w-3 h-3 text-brand-primary dark:text-brand-light" aria-hidden="true" />}
                            title="Populære beregninger"
                            meta="Gem til projekt og tilbud"
                        />
                        <div className="grid grid-cols-3 gap-2">
                            {FEATURED_TOOLS.map(tool => (
                                <button
                                    key={tool.path}
                                    type="button"
                                    onClick={() => handleToolClick(tool.path)}
                                    className="rounded-card bg-bg shadow-card border border-border dark:bg-bg-dark-surface dark:border-border-dark p-3 flex flex-col items-center gap-1 text-center transition-all duration-150 hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong active:scale-[0.99] min-h-20"
                                >
                                    <span className="text-2xl" aria-hidden="true">{tool.emoji}</span>
                                    <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary leading-tight">
                                        {tool.name}
                                    </span>
                                    <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary truncate w-full">
                                        {tool.category}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recents Section */}
                {showOverviewSections && recentTools.length > 0 && (
                    <section className="animate-fade-in">
                        <SectionHeader
                            icon={<ClockIcon className="w-3 h-3" aria-hidden="true" />}
                            title="Senest brugte"
                        />
                        <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                            {recentTools.map(renderToolRow)}
                        </Card>
                    </section>
                )}

                {/* Favorites Section */}
                {showOverviewSections && favoriteTools.length > 0 && (
                    <section className="animate-fade-in">
                        <SectionHeader
                            icon={<StarIcon filled className="w-3 h-3 text-warning" aria-hidden="true" />}
                            title="Favoritter"
                        />
                        <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                            {favoriteTools.map(renderToolRow)}
                        </Card>
                    </section>
                )}

                {/* Grouped catalog */}
                {filteredCategories.length > 0 ? (
                    filteredCategories.map(category => (
                        <section key={category.name}>
                            <SectionHeader
                                title={category.name}
                                meta={[CATEGORY_DESCRIPTIONS[category.name], `${category.subCategories.length} værktøjer`]
                                    .filter(Boolean)
                                    .join(' · ')}
                            />
                            <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                                {category.subCategories.map(sub => renderToolRow({ ...sub, category: category.name }))}
                            </Card>
                        </section>
                    ))
                ) : (
                    <Card padding="none">
                        <EmptyState
                            icon={<SearchIcon className="w-8 h-8" />}
                            title="Ingen værktøjer fundet"
                            description="Prøv at søge efter noget andet."
                            action={
                                searchTerm ? (
                                    <Button size="sm" variant="outline" onClick={() => setSearchTerm('')}>
                                        Ryd søgning
                                    </Button>
                                ) : undefined
                            }
                        />
                    </Card>
                )}
            </div>
        </AppScreen>
        <ConfirmDialog
            isOpen={pendingProToolPath !== null}
            title="Pro-funktion"
            message="Dette værktøj kræver Pro-abonnement. Vil du opgradere nu?"
            confirmLabel="Opgrader til Pro"
            onConfirm={() => { upgradeTo('PRO'); setPendingProToolPath(null); }}
            onCancel={() => setPendingProToolPath(null)}
        />
        </>
    );
};

export default CalculationToolsPage;
