import { Regulation, RegulationCategory } from '../../../types';
import { STATIC_REGULATION_CATALOG } from '../data/regulationCatalog';
import { supabase } from '../../../services/supabaseClient';
import { REGULATION_COLUMNS, RegulationRow } from '../../../services/api/columns';

// --- REGULATIONS ---

export const mapRegulation = (r: RegulationRow): Regulation => ({
    id: r.id,
    title: r.title,
    chapter: r.chapter ?? '',
    section_ref: r.section_ref ?? '',
    snippet: r.snippet ?? '',
    body_html: r.body_html ?? '',
    effective_from: r.effective_from ?? '',
    tags: (r.tags as unknown as string[]) ?? [],
    version: r.version ?? '',
    source_url: r.source_url ?? '',
    category: r.category as RegulationCategory,
});

export const mergeRegulations = (databaseRows: Regulation[], fallbackRows: Regulation[]): Regulation[] => {
    const byId = new Map<string, Regulation>();
    fallbackRows.forEach((row) => byId.set(row.id, row));
    databaseRows.forEach((row) => byId.set(row.id, row));
    return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title, 'da'));
};

export const filterStaticRegulations = (
    query: string,
    filters: string[],
    category: RegulationCategory
): Regulation[] => {
    const normalizedQuery = query.trim().toLocaleLowerCase('da-DK');

    return STATIC_REGULATION_CATALOG.filter((regulation) => {
        if (regulation.category !== category) return false;

        if (filters.length > 0 && !filters.some((filter) => regulation.tags.includes(filter))) {
            return false;
        }

        if (!normalizedQuery) return true;

        const haystack = [
            regulation.title,
            regulation.chapter,
            regulation.section_ref,
            regulation.snippet,
            regulation.body_html.replace(/<[^>]+>/g, ' '),
            regulation.tags.join(' '),
        ]
            .join(' ')
            .toLocaleLowerCase('da-DK');

        return haystack.includes(normalizedQuery);
    });
};

export const searchRegulations = async (query: string, filters: string[], category: RegulationCategory): Promise<Regulation[]> => {
    let q = supabase
        .from('regulations')
        .select(REGULATION_COLUMNS)
        .eq('category', category);

    if (query) {
        q = q.or(`title.ilike.%${query}%,snippet.ilike.%${query}%,body_html.ilike.%${query}%`);
    }

    const { data, error } = await q;
    const staticResults = filterStaticRegulations(query, filters, category);

    if (error) {
        console.error('searchRegulations error:', error);
        return staticResults;
    }

    let results = (data ?? []).map(mapRegulation);

    if (filters.length > 0) {
        results = results.filter(r =>
            filters.some(f => r.tags.includes(f))
        );
    }

    return mergeRegulations(results, staticResults);
};

export const getRegulationById = async (id: string): Promise<Regulation | undefined> => {
    const { data, error } = await supabase
        .from('regulations')
        .select(REGULATION_COLUMNS)
        .eq('id', id)
        .maybeSingle();
    const fallback = STATIC_REGULATION_CATALOG.find((regulation) => regulation.id === id);

    if (error) {
        console.error('getRegulationById error:', error);
        return fallback;
    }
    if (!data) return fallback;
    return mapRegulation(data);
};
