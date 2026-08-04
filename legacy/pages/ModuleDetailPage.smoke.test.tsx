// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, test, vi } from 'vitest';

// Mock the network/auth boundary so the storefront runs fully offline.
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: () => {} }) }));
vi.mock('../services/api/http', () => ({ authenticatedServerFetch: vi.fn() }));
vi.mock('../services/moduleEntitlements', () => ({
    cancelModule: vi.fn(),
    reactivateModule: vi.fn(),
}));
vi.mock('../core/entitlements/EntitlementsProvider', () => ({
    useEntitlements: () => ({
        // Locked org: every module is purchasable, which is the state that
        // renders the most UI (hero CTAs, trial button, sticky bar).
        enabledModules: new Set<string>(),
        getEntitlement: () => ({ enabled: false, source: 'none', validUntil: null }),
        hiddenModules: new Set<string>(),
        meta: null,
        isLoading: false,
        refresh: vi.fn(),
        refreshHidden: vi.fn(),
    }),
}));

import ModuleDetailPage from './ModuleDetailPage';
import { MODULE_IDS, ModuleId } from '../core/registry/types';
import { MODULE_INFO } from '../core/registry/moduleInfo';
import { MODULE_SHOWCASE } from '../core/registry/moduleShowcase';
import {
    FIELD_BAR, HANDOVER_STEPS, KANBAN_COLUMNS, PUNCH_STATUSES,
} from '../components/marketplace/showcase/demos/demoFacts';

beforeAll(() => {
    // jsdom ships no IntersectionObserver; the scroll-reveal hook needs one.
    class IO {
        constructor(private cb: IntersectionObserverCallback) {}
        observe(el: Element) {
            this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as never);
        }
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
    }
    vi.stubGlobal('IntersectionObserver', IO);
    window.scrollTo = vi.fn();
});

afterEach(cleanup);

const renderModule = (id: ModuleId) =>
    render(
        <MemoryRouter initialEntries={[`/moduler/${id}`]}>
            <Routes>
                <Route path="/moduler/:moduleId" element={<ModuleDetailPage />} />
            </Routes>
        </MemoryRouter>
    );

describe('ModuleDetailPage — storefront landing pages', () => {
    it.each(MODULE_IDS)('renders the full landing page for %s', async (id) => {
        renderModule(id);
        const showcase = MODULE_SHOWCASE[id];

        // Hero headline + every content section made it through.
        expect(screen.getByRole('heading', { level: 1, name: showcase.headline })).toBeTruthy();
        expect(screen.getAllByText(MODULE_INFO[id].name).length).toBeGreaterThan(0);
        expect(screen.getByRole('heading', { name: showcase.demoTitle })).toBeTruthy();
        // getAllBy*: some flow-step titles deliberately double as demo button
        // labels (e.g. "Tjek ind" on /moduler/field).
        expect(screen.getAllByText(showcase.features[0].title).length).toBeGreaterThan(0);
        expect(screen.getAllByText(showcase.flow[0].title).length).toBeGreaterThan(0);
        expect(screen.getAllByText(showcase.without[0]).length).toBeGreaterThan(0);
        expect(screen.getAllByText(showcase.withIt[0]).length).toBeGreaterThan(0);
        // First FAQ is open by default, so both question and answer render.
        expect(screen.getByText(showcase.faq[0].q)).toBeTruthy();
        expect(screen.getByText(showcase.faq[0].a)).toBeTruthy();

        // The lazy demo chunk resolves and mounts.
        await waitFor(() => expect(screen.getAllByText(/Nulstil|Tryk|Prøv|Start|Tjek ind|Vælg|Tilføj|Send/i).length).toBeGreaterThan(0));
    });

    it('accents each module distinctly and exposes them as CSS variables', () => {
        const seen = new Set<string>();
        for (const id of MODULE_IDS) {
            const [a, b] = MODULE_SHOWCASE[id].accent;
            expect(a).toMatch(/^#[0-9A-Fa-f]{6}$/);
            expect(b).toMatch(/^#[0-9A-Fa-f]{6}$/);
            seen.add(`${a}${b}`);
        }
        expect(seen.size).toBe(MODULE_IDS.length);
    });

    it('shows an unknown module id as not found', () => {
        render(
            <MemoryRouter initialEntries={['/moduler/ikke-et-modul']}>
                <Routes>
                    <Route path="/moduler/:moduleId" element={<ModuleDetailPage />} />
                </Routes>
            </MemoryRouter>
        );
        expect(screen.queryByRole('heading', { level: 1, name: MODULE_SHOWCASE.field.headline })).toBeNull();
    });
});

describe('interactive demos', () => {
    test('Udførelse: "Check ind" starts the timer, "Check ud" enables Færdigmeld', async () => {
        renderModule('field');
        fireEvent.click(await screen.findByRole('button', { name: FIELD_BAR.checkIn }));
        expect(await screen.findByText(FIELD_BAR.checkedIn)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: FIELD_BAR.checkOut }));
        // Handover only opens once work has been logged — HANDOVER_STEPS then appear.
        expect(await screen.findByRole('button', { name: FIELD_BAR.faerdigmeld })).toBeTruthy();
        // "Færdigmeld" appears twice on purpose — as HANDOVER_STEPS[0] in the
        // Aflevering card and as the action-bar button, exactly as in the app.
        expect(screen.getAllByText(HANDOVER_STEPS[0].title).length).toBeGreaterThanOrEqual(2);
    });

    test('KS: a pin cycles through the real PunchListItemStatus values', async () => {
        renderModule('quality');
        const pin = await screen.findByRole('button', { name: /Mangel 1 — Åben/i });
        fireEvent.click(pin);
        expect(screen.getByRole('button', { name: new RegExp(`Mangel 1 — ${PUNCH_STATUSES[1]}`) })).toBeTruthy();
    });

    test('Kunde-portal: the client view is the fixed CLIENT_TABS subset', async () => {
        renderModule('client-portal');
        fireEvent.click(await screen.findByRole('button', { name: /Bygherrens visning/i }));
        expect(await screen.findByText(/ikke synlige for bygherren/i)).toBeTruthy();
        // No tab-picker switches exist, because the app has none.
        expect(screen.queryAllByRole('switch')).toHaveLength(0);
    });

    test('Opgaver: the board renders all four real kanban columns', async () => {
        renderModule('tasks');
        for (const col of KANBAN_COLUMNS) {
            expect(await screen.findByText(col.label)).toBeTruthy();
        }
        fireEvent.click(screen.getByRole('button', { name: /Spartling, gang — flyt til næste kolonne/i }));
        expect(screen.getByText('1 / 4')).toBeTruthy();
    });

    test('Beregnere: changing a dimension recomputes the result', async () => {
        renderModule('tools');
        // 6 × 4 × 0,12 m + 5 % spild = 3,02 m³
        expect(await screen.findByText(/3,02/)).toBeTruthy();
        const sliders = screen.getAllByRole('slider');
        fireEvent.change(sliders[0], { target: { value: '12' } });
        // 12 × 4 × 0,12 m + 5 % spild = 6,05 m³
        expect(screen.getByText(/6,05/)).toBeTruthy();
    });

    test('Tilbud: adding a line recalculates subtotal, moms and total', async () => {
        renderModule('quotations');
        const add = await screen.findByRole('button', { name: /Tilføj linje/i });
        // Seed line: 1 × 12.500 → moms 3.125 → total 15.625
        expect(screen.getByText('15.625 kr')).toBeTruthy();
        fireEvent.click(add);
        // + 24 m² × 890 = 21.360 → subtotal 33.860 → total 42.325
        expect(screen.getByText('42.325 kr')).toBeTruthy();
    });
});
