import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSlot } from '../core/registry/hooks';
import type { SearchResultItem } from '../core/registry/types';
import { SearchIcon, LayersIcon, FileTextIcon } from '../components/icons';
import { AppScreen, Badge, Card, Chip, EmptyState, Input, SkeletonList, Tabs } from '../components/ui';

/**
 * Kernel-hosted search shell (BYG 3.0 searchSources slot, Phase 7 W1).
 *
 * Renders whatever the active modules contribute as search sources — the
 * source tabs, optional per-source filter chips and the generic result list.
 * The regulation search that used to be hard-coded here now lives in
 * modules/knowledge. The ?cat= URL param keeps its historical name (and the
 * knowledge source ids keep the old RegulationCategory values) so pre-slot
 * deep links keep working.
 */
const SearchPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const sources = useSlot('searchSources');

    const searchParams = new URLSearchParams(location.search);
    const queryFromUrl = searchParams.get('q') || '';
    const defaultSourceId = sources[0]?.id ?? '';
    const sourceFromUrl = searchParams.get('cat') || defaultSourceId;

    const [inputValue, setInputValue] = useState(queryFromUrl);
    const [activeSourceId, setActiveSourceId] = useState(sourceFromUrl);
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);

    const activeSource = sources.find(s => s.id === activeSourceId) ?? sources[0];

    // Sync input value from URL (e.g., on initial load, back/forward)
    useEffect(() => {
        if (queryFromUrl !== inputValue) {
            setInputValue(queryFromUrl);
        }
        if (sourceFromUrl !== activeSourceId) {
            setActiveSourceId(sourceFromUrl);
        }
    }, [queryFromUrl, sourceFromUrl]);

    // Debounce input changes and update URL
    useEffect(() => {
        const handler = setTimeout(() => {
            if (inputValue !== queryFromUrl || activeSourceId !== sourceFromUrl) {
                const params = new URLSearchParams();
                if (inputValue) params.set('q', inputValue);
                if (activeSourceId !== defaultSourceId) params.set('cat', activeSourceId);
                navigate(`/search?${params.toString()}`, { replace: true });
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [inputValue, activeSourceId, queryFromUrl, sourceFromUrl, defaultSourceId, navigate]);

    // Perform search when URL or filters change
    useEffect(() => {
        if (!activeSource) return;
        let cancelled = false;
        const performSearch = async () => {
            setLoading(true);
            try {
                const data = await activeSource.search(inputValue, activeFilters);
                if (!cancelled) setResults(data);
            } catch (error) {
                console.error('searchSources search error:', error);
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        performSearch();
        return () => { cancelled = true; };
    }, [inputValue, activeFilters, activeSource]);

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // This ensures pressing Enter commits the search to browser history
        const params = new URLSearchParams();
        if (inputValue) params.set('q', inputValue);
        if (activeSourceId !== defaultSourceId) params.set('cat', activeSourceId);
        navigate(`/search?${params.toString()}`);
    };

    const toggleFilter = (filter: string) => {
        setActiveFilters(prev =>
            prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
        );
    };

    const handleSourceChange = (sourceId: string) => {
        setActiveSourceId(sourceId);
        setActiveFilters([]); // Reset filters when changing source
    };

    return (
        <AppScreen
            hasBottomNav={false}
            header={{ title: 'Søg', subtitle: 'Videnscenter', back: '/home' }}
        >
            <div className="space-y-4">
                {/* Source scopes */}
                {sources.length > 0 && (
                    <Tabs
                        aria-label="Vælg videnskilde"
                        value={activeSource?.id ?? ''}
                        onChange={(id) => handleSourceChange(id)}
                        className="-mx-4 px-4"
                        tabs={sources.map(source => ({
                            id: source.id,
                            label: (
                                <span className="inline-flex items-center gap-1.5">
                                    {source.icon && <source.icon className="w-4 h-4" aria-hidden="true" />}
                                    {source.label}
                                </span>
                            ),
                        }))}
                    />
                )}

                {/* Search input */}
                <form onSubmit={handleSearchSubmit} className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none z-[1]" aria-hidden="true" />
                    <Input
                        type="search"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={activeSource ? `Søg i ${activeSource.label}…` : 'Søg…'}
                        aria-label={activeSource ? `Søg i ${activeSource.label}` : 'Søg'}
                        className="pl-10"
                        data-ref-id="search-input"
                    />
                </form>

                {/* Per-source filter chips (e.g. BR18 topics) */}
                {activeSource?.filters && activeSource.filters.length > 0 && (
                    <div
                        role="group"
                        aria-label="Filtrér efter emne"
                        className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1"
                        data-ref-id="search-filters-list"
                    >
                        {activeSource.filters.map(filter => (
                            <Chip
                                key={filter}
                                selected={activeFilters.includes(filter)}
                                onClick={() => toggleFilter(filter)}
                                className="shrink-0 min-h-11"
                                data-ref-id={`search-filter-${filter.replace(/[^a-zA-Z0-9]/g, '-')}`}
                            >
                                {filter}
                            </Chip>
                        ))}
                    </div>
                )}

                {/* Results */}
                <div data-ref-id="search-results-list">
                    {loading && <SkeletonList count={3} label="Søger…" />}

                    {!loading && results.length > 0 && (
                        <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                            {results.map(res => (
                                <button
                                    key={res.id}
                                    type="button"
                                    onClick={() => navigate(res.to)}
                                    data-ref-id={`search-result-${res.id}`}
                                    className="block w-full min-h-11 px-4 py-3 text-left transition-colors duration-150 hover:bg-bg-subtle active:bg-bg-muted dark:hover:bg-bg-dark-muted/50 dark:active:bg-bg-dark-muted"
                                >
                                    <span className="flex items-start justify-between gap-2">
                                        <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                            {res.title}
                                        </span>
                                        {res.badge && <Badge variant="brand" className="shrink-0 uppercase">{res.badge}</Badge>}
                                    </span>
                                    {res.snippet && (
                                        <span className="block text-caption text-text-secondary dark:text-text-dark-secondary line-clamp-2 mt-1">
                                            {res.snippet}
                                        </span>
                                    )}
                                    {(res.reference || (res.tags && res.tags.length > 0)) && (
                                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                                            {res.reference && (
                                                <Badge>
                                                    <FileTextIcon className="w-3 h-3" aria-hidden="true" />
                                                    {res.reference}
                                                </Badge>
                                            )}
                                            {(res.tags ?? []).map(tag => (
                                                <span key={tag} className="inline-flex items-center gap-1 text-caption text-text-tertiary dark:text-text-dark-tertiary">
                                                    <LayersIcon className="w-3 h-3" aria-hidden="true" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </Card>
                    )}

                    {!loading && results.length === 0 && (
                        <Card padding="none">
                            <EmptyState
                                icon={<SearchIcon />}
                                title={
                                    sources.length === 0
                                        ? 'Ingen søgekilder aktive'
                                        : inputValue
                                            ? `Ingen resultater for "${inputValue}"`
                                            : 'Ingen resultater fundet'
                                }
                                description={
                                    sources.length === 0
                                        ? 'Ingen aktive moduler bidrager med søgning.'
                                        : 'Prøv at søge efter noget andet eller skift kategori.'
                                }
                            />
                        </Card>
                    )}
                </div>
            </div>
        </AppScreen>
    );
};

export default SearchPage;
