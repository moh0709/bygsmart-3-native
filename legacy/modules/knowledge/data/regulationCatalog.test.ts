import { describe, expect, it } from 'vitest';
import {
  STATIC_REGULATION_CATALOG,
  STATIC_REGULATION_CATEGORIES,
} from './regulationCatalog';

describe('static regulation catalog', () => {
  it('has entries for every Videnscenter category', () => {
    for (const category of STATIC_REGULATION_CATEGORIES) {
      expect(
        STATIC_REGULATION_CATALOG.some((regulation) => regulation.category === category),
        `missing category ${category}`
      ).toBe(true);
    }
  });

  it('contains the complete BR18 chapter index', () => {
    const br18ChapterIds = new Set(
      STATIC_REGULATION_CATALOG.filter((regulation) => regulation.category === 'BR18').map(
        (regulation) => regulation.id
      )
    );

    for (let chapter = 1; chapter <= 35; chapter += 1) {
      expect(br18ChapterIds.has(`br18-kap${chapter}`), `missing BR18 chapter ${chapter}`).toBe(
        true
      );
    }
  });

  it('keeps catalog entries source-linked and searchable', () => {
    for (const regulation of STATIC_REGULATION_CATALOG) {
      expect(regulation.source_url).toMatch(/^https:\/\//);
      expect(regulation.title.length).toBeGreaterThan(5);
      expect(regulation.snippet.length).toBeGreaterThan(20);
      expect(regulation.tags.length).toBeGreaterThan(0);
    }
  });

  it('includes full public text for BR18, AB18, and core Arbejdstilsynet entries', () => {
    const byId = new Map(STATIC_REGULATION_CATALOG.map((regulation) => [regulation.id, regulation]));

    expect(byId.get('br18-kap1')?.body_html).toContain('Bygningsreglementet gælder');
    expect(byId.get('ab18-aftalegrundlag')?.body_html).toContain('Almindelige betingelser');
    expect(byId.get('at-bygge-anlaeg')?.body_html).toContain('Bekendtgørelse om bygge- og anlægsarbejde');
  });
});
