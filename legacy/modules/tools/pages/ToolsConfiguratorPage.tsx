
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HomeIcon,
    LayersIcon,
    BuildingIcon,
    SlidersHorizontalIcon,
    ThermometerIcon,
    MapPinIcon,
    ListIcon,
    ArrowLeftIcon,
    RefreshCwIcon,
    StarIcon
} from '../../../components/icons';
import { AppScreen, Badge, Card, ListRow } from '../../../components/ui';
import { useToolAccessContext } from '../../../contexts/ToolAccessProvider';

type IconComponent = React.FC<{ className?: string; filled?: boolean }>;

interface ConfigTool {
    label: string;
    path: string;
    icon: IconComponent;
    /** Tool-access id for Pro-gated tools (matches the catalog ids). */
    id?: string;
}

interface ConfigStep {
    id: string;
    label: string;
    icon: IconComponent;
    options: ConfigTool[];
}

// Configuration Data Structure
// Grouping the most common tools into logical workflows
const CONFIG_STEPS: ConfigStep[] = [
    {
        id: 'tag_loft',
        label: 'Tag & Loft',
        icon: HomeIcon,
        options: [
            { label: 'Beregn Tagareal', path: '/tools/areal-rumfang/tagareal', icon: MapPinIcon },
            { label: 'Taghældning', path: '/tools/lofter-tag/taghaelding', icon: SlidersHorizontalIcon },
            { label: 'Spær Dimensionering', path: '/tools/lofter-tag/spaer-estimat', icon: BuildingIcon, id: 'lofter-tag-spaer-estimat' },
            { label: 'Lægteberegner', path: '/tools/lofter-tag/laegter', icon: ListIcon },
            { label: 'Loftisolering', path: '/tools/lofter-tag/loftisolering', icon: ThermometerIcon },
            { label: 'Tagsten/Plader', path: '/tools/lofter-tag/tagmateriale', icon: LayersIcon },
            { label: 'Tagrendeberegner', path: '/tools/lofter-tag/tagrender', icon: RefreshCwIcon },
        ]
    },
    {
        id: 'vaegge',
        label: 'Vægge & Facade',
        icon: BuildingIcon,
        options: [
            { label: 'Vægareal & Maling', path: '/tools/areal-rumfang/vaegareal', icon: MapPinIcon },
            { label: 'Mursten & Blokke', path: '/tools/vaegge-skillevaegge/mursten-blokke', icon: BuildingIcon },
            { label: 'Skiftegang (Sten)', path: '/tools/vaegge-skillevaegge/skiftegang', icon: ListIcon },
            { label: 'Skeletvæg (Gips)', path: '/tools/vaegge-skillevaegge/skeletvaeg', icon: LayersIcon },
            { label: 'Vægisolering', path: '/tools/vaegge-skillevaegge/vaegisolering', icon: ThermometerIcon },
            { label: 'Bærende Væg', path: '/tools/statiske-beregninger/baerende-vaeg', icon: BuildingIcon, id: 'statiske-beregninger-baerende-vaeg' },
        ]
    },
    {
        id: 'gulv',
        label: 'Gulv & Fundament',
        icon: LayersIcon,
        options: [
            { label: 'Gulvareal', path: '/tools/areal-rumfang/gulvareal', icon: MapPinIcon },
            { label: 'Fundablokke', path: '/tools/beton-armering/fundablokke', icon: LayersIcon },
            { label: 'Betonvolumen', path: '/tools/beton-armering/betonvolumen', icon: BuildingIcon },
            { label: 'Gulvvarme', path: '/tools/vvs/gulvvarme', icon: ThermometerIcon, id: 'vvs-gulvvarme' },
            { label: 'Trægulv Mængde', path: '/tools/gulve-overflader/traegulv-maengde', icon: LayersIcon },
            { label: 'Flisemængde', path: '/tools/gulve-overflader/flisemaengde', icon: LayersIcon },
        ]
    },
    {
        id: 'teknik',
        label: 'Teknik (El/VVS)',
        icon: SlidersHorizontalIcon,
        options: [
            { label: 'Varmetab (U-værdi)', path: '/tools/energi-klima/varmetab', icon: ThermometerIcon, id: 'energi-klima-varmetab' },
            { label: 'Kabeldimension', path: '/tools/el/kabel', icon: SlidersHorizontalIcon, id: 'el-kabel' },
            { label: 'Rørdimension', path: '/tools/vvs/roerdimension', icon: SlidersHorizontalIcon, id: 'vvs-roerdimension' },
            { label: 'Ventilation', path: '/tools/hvac/ventilationsflow', icon: RefreshCwIcon, id: 'hvac-ventilationsflow' },
        ]
    },
    {
        id: 'ude',
        label: 'Udenomsarealer',
        icon: MapPinIcon,
        options: [
            { label: 'Jordudgravning', path: '/tools/udgravning-jord/jordvolumen', icon: LayersIcon },
            { label: 'Flisebelægning', path: '/tools/udenomsarealer/fliser', icon: MapPinIcon },
            { label: 'Fald på Terræn', path: '/tools/udenomsarealer/fald', icon: SlidersHorizontalIcon },
            { label: 'Hegn & Stolper', path: '/tools/udenomsarealer/hegn', icon: BuildingIcon },
        ]
    }
];

/** Small semantic icon bubble used on rows and tiles. */
const IconBubble: React.FC<{ icon: IconComponent; size?: 'sm' | 'lg' }> = ({ icon: Icon, size = 'sm' }) => (
    <span
        className={`flex items-center justify-center shrink-0 bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light ${
            size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-9 h-9 rounded-control'
        }`}
        aria-hidden="true"
    >
        <Icon className={size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} />
    </span>
);

const ToolsConfiguratorPage: React.FC = () => {
    const navigate = useNavigate();
    const { getAccess } = useToolAccessContext();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Favorites (stored by CalculationToolsPage) — pinned first on step 1.
    const [favorites] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem('bygSmart-tool-favorites') || '[]'); } catch { return []; }
    });

    const favoriteTools = useMemo(() => {
        const byPath = new Map<string, ConfigTool & { categoryLabel: string }>();
        CONFIG_STEPS.forEach(cat => cat.options.forEach(tool => {
            if (!byPath.has(tool.path)) byPath.set(tool.path, { ...tool, categoryLabel: cat.label });
        }));
        return favorites
            .map(path => byPath.get(path))
            .filter((tool): tool is ConfigTool & { categoryLabel: string } => Boolean(tool));
    }, [favorites]);

    const activeCategory = CONFIG_STEPS.find(c => c.id === selectedCategory);

    const handleCategoryClick = (id: string) => {
        setSelectedCategory(id);
    };

    const handleBack = () => {
        if (selectedCategory) {
            setSelectedCategory(null);
        } else {
            navigate('/home');
        }
    };

    /** PRO badge for tools the current user does not have access to. */
    const proBadge = (tool: ConfigTool) => {
        if (!tool.id) return undefined;
        const { allowed } = getAccess(tool.id);
        return allowed ? undefined : <Badge variant="brand">PRO</Badge>;
    };

    return (
        <AppScreen
            hasBottomNav={false}
            header={{
                title: 'Værktøj',
                subtitle: activeCategory ? activeCategory.label : 'Beregnere til byggeriet',
                leading: (
                    <button
                        type="button"
                        aria-label="Tilbage"
                        onClick={handleBack}
                        className="shrink-0 flex w-11 h-11 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors duration-150 dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                ),
            }}
        >
            {!selectedCategory ? (
                /* Step 1: Categories */
                <div className="animate-fade-in">
                    <div className="mt-2 mb-5">
                        <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Hvad skal du bygge?</h2>
                        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-0.5">
                            Vælg en kategori for at finde det rette værktøj.
                        </p>
                    </div>

                    {favoriteTools.length > 0 && (
                        <section className="mb-5">
                            <h3 className="text-caption font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-2 flex items-center gap-1.5">
                                <StarIcon filled className="w-3 h-3 text-warning" aria-hidden="true" />
                                Favoritter
                            </h3>
                            <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                                {favoriteTools.map(tool => (
                                    <ListRow
                                        key={tool.path}
                                        leading={<IconBubble icon={tool.icon} />}
                                        title={tool.label}
                                        subtitle={tool.categoryLabel}
                                        trailing={proBadge(tool)}
                                        onClick={() => navigate(tool.path)}
                                    />
                                ))}
                            </Card>
                        </section>
                    )}

                    <h3 className="text-caption font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-2">
                        Kategorier
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {CONFIG_STEPS.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleCategoryClick(cat.id)}
                                className="rounded-card bg-bg shadow-card border border-border dark:bg-bg-dark-surface dark:border-border-dark p-4 flex flex-col items-start gap-3 text-left transition-all duration-150 hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong active:scale-[0.99] min-h-28"
                            >
                                <IconBubble icon={cat.icon} size="lg" />
                                <span className="min-w-0">
                                    <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                        {cat.label}
                                    </span>
                                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">
                                        {cat.options.length} beregnere
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                /* Step 2: Specific Tools for Category */
                <div className="animate-fade-in mt-2">
                    <h3 className="text-caption font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-2">
                        {activeCategory?.label} · {activeCategory?.options.length} beregnere
                    </h3>
                    <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                        {activeCategory?.options.map(tool => (
                            <ListRow
                                key={tool.path}
                                leading={<IconBubble icon={tool.icon} />}
                                title={tool.label}
                                trailing={proBadge(tool)}
                                onClick={() => navigate(tool.path)}
                            />
                        ))}
                    </Card>
                </div>
            )}

            {/* "Alle beregnere" — always available at the bottom */}
            <section className="mt-6">
                <h3 className="text-caption font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-2">
                    Eller
                </h3>
                <Card padding="none" className="overflow-hidden">
                    <ListRow
                        leading={<IconBubble icon={ListIcon} />}
                        title="Alle beregnere"
                        subtitle="Søg og gennemse hele kataloget"
                        onClick={() => navigate('/tools/list')}
                    />
                </Card>
            </section>
        </AppScreen>
    );
};

export default ToolsConfiguratorPage;
