import type { RegulationCategory } from '../../types';
import type { SearchResultItem, SearchSourceContribution } from '../../core/registry/types';
import { AlertTriangleIcon, BuildingIcon, CheckCircleIcon, FileTextIcon, LayersIcon } from '../../components/icons';

// BR18 topic chips — moved verbatim from the pre-slot SearchPage.
const BR18_FILTERS = [
    'Brand', 'Konstruktion', 'Energi', 'Lydforhold', 'Fugt',
    'Ventilation', 'Adgangsforhold', 'Installationer',
    'Bærende konstruktioner', 'Vådrum', 'Afløb', 'Generelt',
];

// The regulations service (and the ~1.3 MB static catalog behind it) must stay
// out of the root bundle — manifests are imported eagerly by the registry, so
// search() pulls the service in on demand instead.
const searchCategory = (category: RegulationCategory) =>
    async (query: string, filters: string[]): Promise<SearchResultItem[]> => {
        const { searchRegulations } = await import('./services/regulations');
        const results = await searchRegulations(query, filters, category);
        return results.map((regulation) => ({
            id: regulation.id,
            title: regulation.title,
            snippet: regulation.snippet,
            badge: regulation.category,
            reference: regulation.section_ref,
            tags: regulation.tags.slice(0, 2),
            to: `/regulation/${regulation.id}`,
        }));
    };

// Source ids double as ?cat= deep-link values — they keep the historical
// RegulationCategory ids so pre-slot search links keep working.
export const REGULATION_SEARCH_SOURCES: SearchSourceContribution[] = [
    { id: 'BR18', label: 'BR18', icon: BuildingIcon, order: 10, filters: BR18_FILTERS, search: searchCategory('BR18') },
    { id: 'SBI', label: 'SBi-anvisninger', icon: LayersIcon, order: 20, search: searchCategory('SBI') },
    { id: 'DS', label: 'DS Standarder', icon: CheckCircleIcon, order: 30, search: searchCategory('DS') },
    { id: 'AB18', label: 'Jura (AB18)', icon: FileTextIcon, order: 40, search: searchCategory('AB18') },
    { id: 'AT', label: 'Arbejdsmiljø', icon: AlertTriangleIcon, order: 50, search: searchCategory('AT') },
];
