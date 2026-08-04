import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseModel3D, detectInitialQuality } from './HouseModel3D';
import { BUILDING_ZONES, BUILDING_SYSTEM_GROUPS, TASKS_BY_ZONE } from '../../data/wizardCatalog';

vi.mock('./HouseExteriorSVG', () => ({
  HouseExteriorSVG: () => <div data-testid="house-svg-fallback" />,
}));

const ALL_ZONE_IDS = BUILDING_ZONES.map((zone) => zone.id);
const YDERVAEGGE = BUILDING_SYSTEM_GROUPS.find((group) => group.id === 'ydervaegge')!;

// jsdom has no WebGL, so the component renders its fallback stage — the drawer,
// the list view and every control still mount, which is what these cover.
describe('HouseModel3D', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /** jsdom has no ResizeObserver, so the stage reports its size through a stub. */
  const stubStageSize = (width: number, height: number) => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private cb: ResizeObserverCallback) {}
        observe() {
          this.cb([{ contentRect: { width, height } } as ResizeObserverEntry], this as never);
        }
        unobserve() {}
        disconnect() {}
      },
    );
  };

  it('lets the stage fill the complete available area', () => {
    render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} />);

    expect(screen.getByTestId('house-model-stage')).toHaveClass('h-full', 'min-h-0');
  });

  it('exposes every zone from the catalog to the accessible fallback', () => {
    render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} />);

    const fallback = screen.getByTestId('house-model-fallback');
    for (const zone of BUILDING_ZONES) {
      expect(within(fallback).getByRole('button', { name: zone.label })).toBeInTheDocument();
    }
  });

  it('selects every zone in a category group', () => {
    const onToggle = vi.fn();
    render(<HouseModel3D selectedZoneIds={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: YDERVAEGGE.title }));

    expect(onToggle.mock.calls.map(([id]) => id)).toEqual(YDERVAEGGE.zoneIds);
  });

  it('clears every zone when a category group is fully selected', () => {
    const onToggle = vi.fn();
    render(<HouseModel3D selectedZoneIds={YDERVAEGGE.zoneIds} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: YDERVAEGGE.title }));

    expect(onToggle.mock.calls.map(([id]) => id)).toEqual(YDERVAEGGE.zoneIds);
  });

  it('selects and clears all building zones from the drawer footer', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<HouseModel3D selectedZoneIds={[]} onToggle={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vælg alle' }));
    expect(onSelect).toHaveBeenCalledTimes(ALL_ZONE_IDS.length);

    const onClear = vi.fn();
    rerender(<HouseModel3D selectedZoneIds={ALL_ZONE_IDS} onToggle={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fravælg alle' }));
    expect(onClear).toHaveBeenCalledTimes(ALL_ZONE_IDS.length);
  });

  it('drills from category to part to task and auto-selects the zone on a task tick', () => {
    const onToggle = vi.fn();
    const onToggleTask = vi.fn();
    render(<HouseModel3D selectedZoneIds={[]} onToggle={onToggle} onToggleTask={onToggleTask} />);

    fireEvent.click(screen.getByRole('button', { name: /Vis bygningsdele i Ydervægge/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vis opgaver for Facade 1\. Sal/ }));

    const firstTask = TASKS_BY_ZONE.facade_overetage[0];
    fireEvent.click(screen.getByRole('button', { name: firstTask.label }));

    expect(onToggle).toHaveBeenCalledWith('facade_overetage');
    expect(onToggleTask).toHaveBeenCalledWith('facade_overetage', firstTask.id);
  });

  it('switches the drawer to the layer tab', () => {
    render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lag' }));

    expect(screen.getByText('Vis lag i modellen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Klimaskærm/ })).toBeInTheDocument();
  });

  it('collapses and reopens the drawer', () => {
    render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skjul bygningsdele' }));
    expect(screen.queryByTestId('house-system-drawer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vis bygningsdele' }));
    expect(screen.getByTestId('house-system-drawer')).toBeInTheDocument();
  });

  it('shows the level pills only in the plan view', () => {
    const { rerender } = render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} view="exterior" />);
    expect(screen.queryByRole('button', { name: 'K Kælder' })).not.toBeInTheDocument();

    rerender(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} view="interior" />);
    expect(screen.getByRole('button', { name: 'K Kælder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 1. sal' })).toBeInTheDocument();
  });

  it('renders the Listevisning tree and filters it by search', () => {
    render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} view="list" />);

    const list = screen.getByTestId('house-list-view');
    expect(within(list).getByText('Kategori')).toBeInTheDocument();

    fireEvent.change(within(list).getByLabelText('Søg i kategorier, bygningsdele og opgaver'), {
      target: { value: 'faskine' },
    });

    // a hit at task level keeps its ancestors visible and drills automatically
    expect(within(list).getByText('Forsyning & Infrastruktur')).toBeInTheDocument();
    expect(within(list).getByText('Regnvand & Faskine')).toBeInTheDocument();
    expect(within(list).queryByText('Tag')).not.toBeInTheDocument();
  });

  it('drills Listevisning one column at a time on a phone-width stage', () => {
    stubStageSize(358, 419);
    render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} view="list" />);

    const list = screen.getByTestId('house-list-view');
    expect(within(list).getByText('Kategori')).toBeInTheDocument();
    expect(within(list).queryByText('Bygningsdel')).not.toBeInTheDocument();

    fireEvent.click(within(list).getByText('Tag'));

    // the category column gives way to its parts, with a labelled way back
    expect(within(list).queryByText('Kategori')).not.toBeInTheDocument();
    expect(within(list).getByText('Bygningsdel')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Tag' })).toBeInTheDocument();
  });

  it('keeps the 3D drawer out of the way while Listevisning is open', () => {
    const { rerender } = render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} view="exterior" />);
    expect(screen.getByTestId('house-system-drawer')).toBeInTheDocument();

    rerender(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} view="list" />);
    expect(screen.queryByTestId('house-system-drawer')).not.toBeInTheDocument();
    expect(screen.getByTestId('house-list-view')).toBeInTheDocument();
  });

  it('persists the quality choice and mirrors it to the stage', () => {
    const setQuality = vi.fn();
    window.__houseStage = { setQuality } as unknown as Window['__houseStage'];
    render(<HouseModel3D selectedZoneIds={[]} onToggle={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Kvalitet: Høj/ }));

    expect(setQuality).toHaveBeenCalledWith('mobil');
    expect(window.localStorage.getItem('byggeapp.house3d.kvalitet')).toBe('mobil');
    expect(screen.getByRole('button', { name: /Kvalitet: Mobil/ })).toBeInTheDocument();
    delete window.__houseStage;
  });

  it('reads the persisted quality back on the next mount', () => {
    window.localStorage.setItem('byggeapp.house3d.kvalitet', 'mobil');
    expect(detectInitialQuality()).toBe('mobil');
  });
});
