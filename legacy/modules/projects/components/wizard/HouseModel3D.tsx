/**
 * HouseModel3D.tsx
 * Host for the `<house-stage>` custom element (house3d/house-scene.js).
 *
 * The scene itself is framework-free three.js so it never fights React
 * re-renders; this file is the bridge: it pushes state in through the stage's
 * setters and listens for `housestage:*` events coming back out. Everything
 * around the stage — the "Vælg bygningsdele" drawer, the Lag tab, the level
 * pills, the controls and the Listevisning tree — lives here.
 *
 * See docs/HOUSE_MODEL_HANDOFF.md for the scene contract and zone table.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILDING_SYSTEM_GROUPS,
  BUILDING_ZONES,
  MODEL_LAYERS,
  MODEL_LEVELS,
  TASKS_BY_ZONE,
  getBuildingZoneById,
  type ModelLevelId,
} from '../../data/wizardCatalog';
import { HouseExteriorSVG } from './HouseExteriorSVG';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageView = 'exterior' | 'interior' | 'list';
type QualityId = 'hoj' | 'mobil';
type LightId = 'nat' | 'dag';
type ViewModeId = 'orbit' | 'pan' | 'grid';
type PanelTabId = 'dele' | 'lag';

interface HouseStageElement extends HTMLElement {
  scene?: unknown;
  quality?: QualityId;
  setSelected(ids: string[]): void;
  setHover(zoneId: string | null): void;
  flashMarker(zoneId: string): void;
  resetView(): void;
  setAutoRotate(on: boolean): void;
  setLighting(mode: LightId): void;
  setViewMode(mode: ViewModeId): void;
  setStageMode(mode: 'udvendig' | 'plan', level: ModelLevelId): void;
  setLayer(layerId: string): void;
  setQuality(quality: QualityId): void;
  enterRoom(index: number): void;
  exitRoom(): void;
}

declare global {
  interface Window {
    __houseStage?: HouseStageElement;
  }
}

export interface HouseModel3DProps {
  selectedZoneIds: string[];
  onToggle: (zoneId: string) => void;
  /** zoneId → selected task ids. Optional so the stage still works read-only. */
  selectedTasks?: Record<string, string[]>;
  onToggleTask?: (zoneId: string, taskId: string) => void;
  /** Which of the three step tabs is active. Owned by the step, not the stage. */
  view?: StageView;
}

interface StageEventDetail {
  zoneId?: string;
  x?: number;
  y?: number;
  index?: number;
  room?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUALITY_STORAGE_KEY = 'byggeapp.house3d.kvalitet';
/** Below this stage height the drawer collapses to a single reopen button. */
const COMPACT_STAGE_HEIGHT = 420;
/**
 * Below this stage width the reference's desktop control bar cannot fit: the
 * light pills and the tool buttons run off the edge on a phone. Narrow drops the
 * labels, hides the orbit/pan/grid group (touch pans with two fingers anyway)
 * and turns the quality tick into an icon button.
 */
const NARROW_STAGE_WIDTH = 560;

const ALL_ZONE_IDS = BUILDING_ZONES.map((zone) => zone.id);

const VIEW_MODES: { id: ViewModeId; title: string; icon: string }[] = [
  { id: 'orbit', title: 'Drej', icon: 'M12 3.5a8.5 8.5 0 1 0 8.5 8.5M12 8v4.5l3.5 2' },
  { id: 'pan', title: 'Panorér', icon: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0v4.5a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-5-5V13a1.5 1.5 0 0 1 2.5-1' },
  { id: 'grid', title: 'Vis grid', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
];

const LIGHT_MODES: { id: LightId; label: string; title: string; icon: string }[] = [
  { id: 'nat', label: 'Aften', title: 'Aftenlys med varmt indeklima', icon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z' },
  { id: 'dag', label: 'Dagslys', title: 'Dagslys over hele modellen', icon: 'M12 5V3M12 21v-2M5 12H3M21 12h-2M6.4 6.4 5 5M19 19l-1.4-1.4M17.6 6.4 19 5M5 19l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
];

const PANEL_TABS: { id: PanelTabId; label: string; icon: string }[] = [
  { id: 'dele', label: 'Dele', icon: 'M4 5.5h7v7H4zM13 5.5h7v7h-7zM4 14.5h7v5H4zM13 14.5h7v5h-7z' },
  { id: 'lag', label: 'Lag', icon: 'M12 3 3 7.5l9 4.5 9-4.5L12 3M3 12.5l9 4.5 9-4.5M3 17l9 4.5 9-4.5' },
];

const ICON_HELP = 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M9.8 9.3a2.2 2.2 0 1 1 3.2 2c-.7.5-1 1-1 1.9M12 16.6h.01';
const ICON_CUBE = 'M12 3.2 3.5 7.6v8.8L12 20.8l8.5-4.4V7.6ZM3.5 7.6 12 12m0 0 8.5-4.4M12 12v8.8';
const ICON_RESET = 'M4 9V4.5m0 4.5h4.5M4 9a8 8 0 1 1 2.6 8.8';
const ICON_CHEVRON_DOWN = 'm6 9 6 6 6-6';
const ICON_CHEVRON_RIGHT = 'm9 6 6 6-6 6';
const ICON_CHECK = 'm5 13 4 4 10-10';
const ICON_CLOSE = 'M18 6 6 18M6 6l12 12';
const ICON_ARROW_LEFT = 'M19 12H5m6-7-7 7 7 7';
const ICON_ARROW_RIGHT = 'M5 12h14m-6-7 7 7-7 7';
const ICON_SEARCH = 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 21 21';
const ICON_ENTER_ROOM = 'M4 20V9.5l8-6 8 6V20M10 20v-6h4v6';
const ICON_PANEL = 'M4 5.5h7v7H4zM13 5.5h7v7h-7zM4 14.5h7v5H4zM13 14.5h7v5h-7z';
const ICON_QUALITY = 'M4.5 17.5a8.5 8.5 0 1 1 15 0M12 12.5l4-4';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): string => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(',');
};

const tasksFor = (zoneId: string) => TASKS_BY_ZONE[zoneId] ?? [];

export const detectInitialQuality = (): QualityId => {
  if (typeof window === 'undefined') return 'hoj';
  try {
    const stored = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    if (stored === 'hoj' || stored === 'mobil') return stored;
  } catch {
    /* private mode */
  }
  const coarse = window.matchMedia?.('(pointer: coarse)').matches === true;
  const small = Math.min(window.innerWidth, window.innerHeight) <= 700;
  const lowMemory = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
  return (coarse && small) || lowMemory ? 'mobil' : 'hoj';
};

const supportsWebGl = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  // Probe the constructors first: jsdom has neither, and calling getContext
  // there logs a "not implemented" error before returning null.
  if (!('WebGL2RenderingContext' in window) && !('WebGLRenderingContext' in window)) return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

const Glyph: React.FC<{ d: string; size?: number; width?: number; className?: string }> = ({
  d,
  size = 18,
  width = 1.8,
  className,
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

const CheckBox: React.FC<{ checked: boolean; partial?: boolean; size: number }> = ({
  checked,
  partial = false,
  size,
}) => (
  <span
    className="flex shrink-0 items-center justify-center rounded-[5px] border-[1.6px] text-white"
    style={{
      width: size,
      height: size,
      background: checked ? '#2563eb' : 'transparent',
      borderColor: checked || partial ? '#3b82f6' : 'rgba(148,180,220,0.32)',
    }}
    aria-hidden="true"
  >
    {checked ? (
      <Glyph d={ICON_CHECK} size={Math.round(size * 0.62)} width={3.2} />
    ) : partial ? (
      <span className="h-[2.4px] w-[9px] rounded-sm bg-[#60a5fa]" />
    ) : null}
  </span>
);

// ─── Building parts drawer ────────────────────────────────────────────────────

interface DrawerProps {
  selectedZoneIds: string[];
  selectedTasks: Record<string, string[]>;
  onToggleZone: (zoneId: string) => void;
  onToggleTask: (zoneId: string, taskId: string) => void;
  onToggleGroup: (zoneIds: string[]) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onHover: (zoneId: string | null) => void;
  panelTab: PanelTabId;
  onPanelTab: (tab: PanelTabId) => void;
  layer: string;
  onLayer: (layerId: string) => void;
  compact: boolean;
  onClose: () => void;
}

const BuildingPartsDrawer: React.FC<DrawerProps> = ({
  selectedZoneIds,
  selectedTasks,
  onToggleZone,
  onToggleTask,
  onToggleGroup,
  onSelectAll,
  onSelectNone,
  onHover,
  panelTab,
  onPanelTab,
  layer,
  onLayer,
  compact,
  onClose,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});

  const isSelected = useCallback(
    (zoneId: string) => selectedZoneIds.includes(zoneId),
    [selectedZoneIds],
  );

  const taskCount = useMemo(
    () => Object.values(selectedTasks).reduce((sum, ids) => sum + ids.length, 0),
    [selectedTasks],
  );

  return (
    <aside
      data-testid="house-system-drawer"
      className="pointer-events-auto absolute right-4 top-4 z-30 flex w-[292px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[14px] border border-[rgba(96,165,250,0.24)] bg-[rgba(10,20,34,0.9)] shadow-[0_22px_50px_rgba(3,8,16,0.55)] backdrop-blur-[9px]"
      style={{ maxHeight: compact ? 'calc(100% - 16px)' : 'min(470px, calc(100% - 76px))' }}
    >
      <div className="flex-none border-b border-[rgba(148,180,220,0.1)] px-[15px] pb-2.5 pt-[13px]">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 text-[15px] font-semibold tracking-[-0.01em] text-[#e8eef6]">
            {panelTab === 'lag' ? 'Vis lag i modellen' : 'Vælg bygningsdele'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[rgba(148,180,220,0.1)] text-[#a8bdd4] before:absolute before:-inset-2.5 before:content-[''] hover:text-white"
            aria-label="Skjul bygningsdele"
          >
            <Glyph d={ICON_CLOSE} size={13} width={2.6} />
          </button>
        </div>
        {!compact && (
          <div className="mt-[3px] text-[11.5px] text-[#8ba2bd]">
            {panelTab === 'lag'
              ? 'Vælg et lag for at se husets opbygning'
              : 'Klik på en del i modellen eller åbn en kategori'}
          </div>
        )}
        <div className="mt-[9px] grid grid-cols-2 gap-[5px] rounded-[9px] bg-[rgba(148,180,220,0.08)] p-[3px]">
          {PANEL_TABS.map((tab) => {
            const active = panelTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onPanelTab(tab.id)}
                aria-pressed={active}
                className={[
                  'flex items-center justify-center gap-1.5 rounded-[7px] text-[12px] font-semibold transition-colors',
                  // icon-only in compact mode, so give it a real touch target
                  compact ? 'h-11' : 'h-[26px]',
                ].join(' ')}
                style={{
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#ffffff' : '#9db2c9',
                }}
              >
                <Glyph d={tab.icon} size={13} width={1.9} />
                {!compact && <span>{tab.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-1 pt-1.5">
        {panelTab === 'dele' &&
          BUILDING_SYSTEM_GROUPS.map((group) => {
            const selectedCount = group.zoneIds.filter(isSelected).length;
            const groupChecked = selectedCount === group.zoneIds.length;
            const groupPartial = selectedCount > 0 && !groupChecked;
            const expanded = Boolean(expandedGroups[group.id]);
            const rgb = hexToRgb(group.color);

            return (
              <div key={group.id} className="mb-0.5">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleGroup(group.zoneIds)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onToggleGroup(group.zoneIds);
                    }
                  }}
                  onMouseEnter={() => onHover(group.zoneIds[0])}
                  onMouseLeave={() => onHover(null)}
                  aria-pressed={groupChecked}
                  aria-label={group.title}
                  className="flex cursor-pointer items-center gap-[11px] rounded-[10px] p-2 hover:bg-[rgba(96,165,250,0.09)]"
                >
                  <span
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border"
                    style={{ background: `rgba(${rgb},0.13)`, borderColor: `rgba(${rgb},0.4)`, color: group.color }}
                  >
                    <Glyph d={group.icon} size={18} width={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#e8eef6]">
                      {group.title}
                    </span>
                    <span className="block truncate text-[11px] text-[#89a0bb]">{group.desc}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedGroups((prev) => ({ ...prev, [group.id]: !prev[group.id] }));
                    }}
                    aria-label={`${expanded ? 'Skjul' : 'Vis'} bygningsdele i ${group.title}`}
                    aria-expanded={expanded}
                    className="relative flex h-5 w-5 items-center justify-center text-[#7d93ac] before:absolute before:-inset-3 before:content-[''] hover:text-white"
                  >
                    <Glyph
                      d={ICON_CHEVRON_DOWN}
                      size={13}
                      width={2.2}
                      className={expanded ? 'rotate-180' : undefined}
                    />
                  </button>
                  <CheckBox checked={groupChecked} partial={groupPartial} size={19} />
                </div>

                {expanded && (
                  <div className="flex flex-col gap-0.5 pb-2 pl-[46px] pr-1.5 pt-0.5">
                    {group.zoneIds.map((zoneId) => {
                      const zone = getBuildingZoneById(zoneId);
                      if (!zone) return null;
                      const on = isSelected(zoneId);
                      const tasks = tasksFor(zoneId);
                      const picked = selectedTasks[zoneId]?.length ?? 0;
                      const zoneOpen = Boolean(expandedZones[zoneId]);

                      return (
                        <div key={zoneId}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => onToggleZone(zoneId)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onToggleZone(zoneId);
                              }
                            }}
                            onMouseEnter={() => onHover(zoneId)}
                            onMouseLeave={() => onHover(null)}
                            aria-pressed={on}
                            aria-label={zone.label}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-[7px] py-1.5 hover:bg-[rgba(96,165,250,0.1)]"
                            style={{ background: on ? 'rgba(37,99,235,0.14)' : 'transparent' }}
                          >
                            <span
                              className="h-[7px] w-[7px] shrink-0 rounded-full"
                              style={{ background: zone.highlightColor }}
                            />
                            <span
                              className="min-w-0 flex-1 truncate text-[12px]"
                              style={{ color: on ? '#dce8f6' : '#a3b6cc' }}
                            >
                              {zone.label}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedZones((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }));
                              }}
                              aria-label={`${zoneOpen ? 'Skjul' : 'Vis'} opgaver for ${zone.label}`}
                              aria-expanded={zoneOpen}
                              className="relative flex items-center gap-[3px] rounded-[5px] px-1 py-px before:absolute before:-inset-2.5 before:content-['']"
                              style={{ color: picked ? '#60a5fa' : '#6d829a' }}
                            >
                              <span className="text-[10px] font-bold tracking-[0.03em]">
                                {picked ? `${picked}/${tasks.length}` : String(tasks.length)}
                              </span>
                              <Glyph
                                d={ICON_CHEVRON_DOWN}
                                size={11}
                                width={2.4}
                                className={zoneOpen ? 'rotate-180' : undefined}
                              />
                            </button>
                            <CheckBox checked={on} size={15} />
                          </div>

                          {zoneOpen && (
                            <div className="flex flex-col gap-px pb-[7px] pl-[15px] pr-1 pt-[3px]">
                              {tasks.map((task) => {
                                const taskOn = selectedTasks[zoneId]?.includes(task.id) ?? false;
                                return (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => onToggleTask(zoneId, task.id)}
                                    aria-pressed={taskOn}
                                    className="flex min-h-8 items-center gap-2 rounded-[7px] px-[7px] py-[5px] text-left hover:bg-[rgba(96,165,250,0.09)]"
                                    style={{ background: taskOn ? 'rgba(37,99,235,0.12)' : 'transparent' }}
                                  >
                                    <CheckBox checked={taskOn} size={13} />
                                    <span
                                      className="min-w-0 flex-1 text-[11.5px] leading-[1.25]"
                                      style={{ color: taskOn ? '#dce8f6' : '#9db2c9' }}
                                    >
                                      {task.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {panelTab === 'lag' && (
          <div className="flex flex-col gap-0.5">
            {MODEL_LAYERS.map((entry) => {
              const active = layer === entry.id;
              const rgb = hexToRgb(entry.color);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onLayer(entry.id)}
                  aria-pressed={active}
                  className="flex min-h-11 items-center gap-[11px] rounded-[10px] p-2 text-left hover:bg-[rgba(96,165,250,0.09)]"
                  style={{ background: active ? 'rgba(37,99,235,0.16)' : 'transparent' }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border"
                    style={{ background: `rgba(${rgb},0.13)`, borderColor: `rgba(${rgb},0.4)`, color: entry.color }}
                  >
                    <Glyph d={entry.icon} size={17} width={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[12.5px] font-semibold"
                      style={{ color: active ? '#eaf1f9' : '#c3d3e6' }}
                    >
                      {entry.label}
                    </span>
                    <span className="block truncate text-[10.5px] text-[#89a0bb]">{entry.desc}</span>
                  </span>
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.6px]"
                    style={{ borderColor: active ? '#3b82f6' : 'rgba(148,180,220,0.32)' }}
                    aria-hidden="true"
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!compact && (
        <div className="flex flex-none items-center justify-between gap-2 border-t border-[rgba(148,180,220,0.1)] px-[13px] py-2">
          <span className="text-[11.5px] text-[#8ba2bd]">
            {panelTab === 'lag'
              ? layer === 'alle'
                ? 'Alle lag vises'
                : 'Ét lag vist'
              : `${selectedZoneIds.length}/${ALL_ZONE_IDS.length} dele · ${taskCount} opgaver`}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="text-[11.5px] font-semibold text-[#60a5fa] hover:text-[#93c5fd]"
            >
              Vælg alle
            </button>
            <button
              type="button"
              onClick={onSelectNone}
              className="text-[11.5px] font-semibold text-[#7d93ac] hover:text-[#c3d3e6]"
            >
              Fravælg alle
            </button>
          </span>
        </div>
      )}
    </aside>
  );
};

// ─── Listevisning (sideways configurator tree) ────────────────────────────────

interface ListRowProps {
  name: string;
  sub?: string;
  active?: boolean;
  checked: boolean;
  partial?: boolean;
  count?: string;
  drill?: boolean;
  onSelect: () => void;
  onCheck: () => void;
}

const ListRow: React.FC<ListRowProps> = ({
  name,
  sub,
  active = false,
  checked,
  partial = false,
  count,
  drill = false,
  onSelect,
  onCheck,
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    }}
    className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[9px] px-[9px] py-[7px] hover:bg-[rgba(96,165,250,0.09)]"
    style={{ background: active ? 'rgba(37,99,235,0.16)' : 'transparent' }}
  >
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onCheck();
      }}
      aria-label={`${checked ? 'Fravælg' : 'Vælg'} ${name}`}
      aria-pressed={checked}
      className="relative flex shrink-0 items-center before:absolute before:-inset-3 before:content-['']"
    >
      <CheckBox checked={checked} partial={partial} size={18} />
    </button>
    <span className="min-w-0 flex-1">
      <span
        className="block truncate text-[12.5px]"
        style={{ color: active ? '#eaf1f9' : '#c3d3e6', fontWeight: active ? 650 : 500 }}
      >
        {name}
      </span>
      {sub && <span className="block truncate text-[10.5px] text-[#89a0bb]">{sub}</span>}
    </span>
    {count && <span className="shrink-0 text-[10px] font-bold text-[#60a5fa]">{count}</span>}
    {drill && (
      <span className="shrink-0" style={{ color: active ? '#93c5fd' : '#5c7285' }}>
        <Glyph d={ICON_CHEVRON_RIGHT} size={12} width={2.4} />
      </span>
    )}
  </div>
);

const ListColumn: React.FC<React.PropsWithChildren<{ title: string; empty: boolean; hint: string }>> = ({
  title,
  empty,
  hint,
  children,
}) => (
  <div className="flex min-h-0 min-w-0 flex-col border-r border-[rgba(148,180,220,0.09)]">
    <div className="flex-none px-3.5 pb-2 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#6d829a]">
      {title}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2.5">
      {children}
      {empty && <div className="px-[9px] py-2.5 text-[11.5px] leading-[1.4] text-[#6d829a]">{hint}</div>}
    </div>
  </div>
);

interface ListViewProps {
  /** Phone-width stage: one column at a time instead of the three-column tree. */
  narrow: boolean;
  selectedZoneIds: string[];
  selectedTasks: Record<string, string[]>;
  onToggleZone: (zoneId: string) => void;
  onToggleTask: (zoneId: string, taskId: string) => void;
  onToggleGroup: (zoneIds: string[]) => void;
  onSelectNone: () => void;
}

const ListView: React.FC<ListViewProps> = ({
  narrow,
  selectedZoneIds,
  selectedTasks,
  onToggleZone,
  onToggleTask,
  onToggleGroup,
  onSelectNone,
}) => {
  const [search, setSearch] = useState('');
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const hit = useCallback((text: string) => !query || text.toLowerCase().includes(query), [query]);

  const zoneHit = useCallback(
    (zoneId: string) => {
      const zone = getBuildingZoneById(zoneId);
      if (!zone) return false;
      return hit(zone.label) || hit(zone.sublabel) || tasksFor(zoneId).some((task) => hit(task.label));
    },
    [hit],
  );

  const categories = useMemo(
    () => BUILDING_SYSTEM_GROUPS.filter((group) => hit(group.title) || hit(group.desc) || group.zoneIds.some(zoneHit)),
    [hit, zoneHit],
  );

  // Progressive disclosure: a column only opens once its parent is chosen —
  // a search drills automatically, otherwise the hit would stay hidden.
  // Auto-drilling on a search keeps a deep hit visible in the three-column tree.
  // On a phone only one column shows, so it would hide the matches instead.
  const autoDrill = Boolean(query) && !narrow;
  const activeCat = categories.find((group) => group.id === activeCatId) ?? (autoDrill ? categories[0] : undefined);
  const zones = activeCat ? activeCat.zoneIds.filter(zoneHit) : [];
  const activeZone = zones.includes(activeZoneId ?? '') ? activeZoneId : autoDrill ? zones[0] : null;
  const tasks = activeZone
    ? tasksFor(activeZone).filter(
        (task) => !query || hit(task.label) || hit(getBuildingZoneById(activeZone)?.label ?? ''),
      )
    : [];

  const totalSelectedTasks = Object.values(selectedTasks).reduce((sum, ids) => sum + ids.length, 0);
  const columns = narrow ? '1fr' : activeZone ? '1fr 1fr 1.15fr' : activeCat ? '1fr 1.2fr' : '1fr';
  const level = activeZone ? 2 : activeCat ? 1 : 0;
  const showColumn = (index: number) => !narrow || level === index;

  return (
    <div data-testid="house-list-view" className="absolute inset-0 z-20 flex flex-col bg-[#08111c]">
      <div className="flex flex-none items-center gap-3 border-b border-[rgba(148,180,220,0.1)] px-4 py-3">
        <div className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[rgba(148,180,220,0.16)] bg-[rgba(148,180,220,0.07)] px-3">
          <span className="shrink-0 text-[#7d93ac]">
            <Glyph d={ICON_SEARCH} size={15} width={1.9} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Søg i kategorier, bygningsdele og opgaver"
            aria-label="Søg i kategorier, bygningsdele og opgaver"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[#e8eef6] outline-none placeholder:text-[#6d829a]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Ryd søgning"
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-[rgba(148,180,220,0.12)] text-[#a8bdd4]"
            >
              <Glyph d={ICON_CLOSE} size={11} width={2.8} />
            </button>
          )}
        </div>
        <span className="hidden shrink-0 text-[11.5px] text-[#8ba2bd] sm:inline">
          {selectedZoneIds.length}/{ALL_ZONE_IDS.length} dele · {totalSelectedTasks} opgaver
        </span>
        <button
          type="button"
          onClick={onSelectNone}
          className="flex h-[34px] shrink-0 items-center rounded-[9px] border border-[rgba(148,180,220,0.16)] bg-[rgba(148,180,220,0.08)] px-3 text-[12px] font-semibold text-[#a8bdd4] hover:border-[rgba(96,165,250,0.5)] hover:text-[#dce8f6]"
        >
          Fravælg alle
        </button>
      </div>

      {narrow && level > 0 && (
        <button
          type="button"
          onClick={() => (level === 2 ? setActiveZoneId(null) : setActiveCatId(null))}
          className="flex min-h-11 flex-none items-center gap-2 border-b border-[rgba(148,180,220,0.09)] px-4 text-left"
        >
          <span className="text-[#93c5fd]">
            <Glyph d={ICON_ARROW_LEFT} size={16} width={2} />
          </span>
          <span className="truncate text-[12.5px] font-semibold text-[#dce8f6]">
            {level === 2 ? getBuildingZoneById(activeZone ?? '')?.label : activeCat?.title}
          </span>
        </button>
      )}

      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: columns, gridTemplateRows: 'minmax(0, 1fr)' }}
      >
        {showColumn(0) && (
        <ListColumn title="Kategori" empty={categories.length === 0} hint="Ingen kategorier matcher søgningen.">
          {categories.map((group) => {
            const selectedCount = group.zoneIds.filter((id) => selectedZoneIds.includes(id)).length;
            return (
              <ListRow
                key={group.id}
                name={group.title}
                sub={group.desc}
                active={activeCat?.id === group.id}
                checked={selectedCount === group.zoneIds.length}
                partial={selectedCount > 0 && selectedCount < group.zoneIds.length}
                count={selectedCount > 0 ? `${selectedCount}/${group.zoneIds.length}` : undefined}
                drill
                onSelect={() => {
                  setActiveCatId(group.id);
                  setActiveZoneId(null);
                }}
                onCheck={() => onToggleGroup(group.zoneIds)}
              />
            );
          })}
        </ListColumn>
        )}

        {activeCat && showColumn(1) && (
          <ListColumn title="Bygningsdel" empty={zones.length === 0} hint="Ingen bygningsdele matcher søgningen.">
            {zones.map((zoneId) => {
              const zone = getBuildingZoneById(zoneId);
              if (!zone) return null;
              const picked = selectedTasks[zoneId]?.length ?? 0;
              return (
                <ListRow
                  key={zoneId}
                  name={zone.label}
                  sub={zone.sublabel}
                  active={activeZone === zoneId}
                  checked={selectedZoneIds.includes(zoneId)}
                  partial={picked > 0}
                  count={picked > 0 ? `${picked}/${tasksFor(zoneId).length}` : undefined}
                  drill
                  onSelect={() => setActiveZoneId(zoneId)}
                  onCheck={() => onToggleZone(zoneId)}
                />
              );
            })}
          </ListColumn>
        )}

        {activeZone && showColumn(2) && (
          <ListColumn title="Opgaver" empty={tasks.length === 0} hint="Ingen opgaver matcher søgningen.">
            {tasks.map((task) => {
              const on = selectedTasks[activeZone]?.includes(task.id) ?? false;
              return (
                <ListRow
                  key={task.id}
                  name={task.label}
                  checked={on}
                  onSelect={() => onToggleTask(activeZone, task.id)}
                  onCheck={() => onToggleTask(activeZone, task.id)}
                />
              );
            })}
          </ListColumn>
        )}
      </div>
    </div>
  );
};

// ─── HouseModel3D ─────────────────────────────────────────────────────────────

export const HouseModel3D: React.FC<HouseModel3DProps> = ({
  selectedZoneIds,
  onToggle,
  selectedTasks = {},
  onToggleTask,
  view = 'exterior',
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HouseStageElement | null>(null);
  const lastStageRef = useRef<HouseStageElement | null>(null);
  const layerKeyRef = useRef<string | null>(null);
  const viewKeyRef = useRef<string | null>(null);
  const compactRef = useRef(false);

  const [webgl] = useState(supportsWebGl);
  const [sceneReady, setSceneReady] = useState(0);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [roomMenu, setRoomMenu] = useState<{ index: number; room: string; x: number; y: number } | null>(null);
  const [insideRoom, setInsideRoom] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [compact, setCompact] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTabId>('dele');
  const [layer, setLayer] = useState('alle');
  const [level, setLevel] = useState<ModelLevelId>('stue');
  const [light, setLight] = useState<LightId>('nat');
  const [viewMode, setViewMode] = useState<ViewModeId>('orbit');
  const [autoRotate, setAutoRotate] = useState(false);
  const [quality, setQuality] = useState<QualityId>(detectInitialQuality);
  const [helpOpen, setHelpOpen] = useState(false);

  const planMode = view === 'interior';
  // Listevisning is a full-stage picker: the drawer, the level pills and the
  // orbit controls all belong to the 3D view and must not float over it.
  const listMode = view === 'list';

  // ── Load the scene module once, then mount the custom element ──────────────
  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;

    import('./house3d/house-scene.js')
      .then(() => {
        if (cancelled || !hostRef.current || stageRef.current) return;
        const element = document.createElement('house-stage') as HouseStageElement;
        element.style.cssText = 'display:block;width:100%;height:100%';
        hostRef.current.appendChild(element);
        stageRef.current = element;
      })
      .catch(() => {
        /* falls back to the SVG picker */
      });

    return () => {
      cancelled = true;
      stageRef.current?.remove();
      stageRef.current = null;
    };
  }, [webgl]);

  // ── Stage → host events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!webgl) return;

    const rectOf = () => hostRef.current?.getBoundingClientRect();
    // `ready` fires again after a quality switch: treat it as "re-apply everything"
    const handleReady = () => {
      lastStageRef.current = null;
      const stage = window.__houseStage;
      if (stage?.quality) setQuality((prev) => (stage.quality === prev ? prev : stage.quality!));
      setSceneReady((token) => token + 1);
    };
    const handleHover = (event: Event) => {
      const detail = (event as CustomEvent<StageEventDetail>).detail;
      const rect = rectOf();
      setHoveredZoneId(detail.zoneId ?? null);
      if (rect && detail.x != null && detail.y != null) {
        setHoverPoint({ x: detail.x - rect.left, y: detail.y - rect.top });
      }
    };
    const handleToggle = (event: Event) => {
      const zoneId = (event as CustomEvent<StageEventDetail>).detail.zoneId;
      if (zoneId) onToggle(zoneId);
    };
    const handleLongPress = (event: Event) => {
      const detail = (event as CustomEvent<StageEventDetail>).detail;
      const rect = rectOf();
      if (detail.index == null || !detail.room || !rect) return;
      setRoomMenu({
        index: detail.index,
        room: detail.room,
        x: (detail.x ?? 0) - rect.left,
        y: (detail.y ?? 0) - rect.top,
      });
    };
    const handleRoom = (event: Event) => {
      const detail = (event as CustomEvent<StageEventDetail | null>).detail;
      setInsideRoom(detail?.room ?? null);
      setRoomMenu(null);
    };

    window.addEventListener('housestage:ready', handleReady);
    window.addEventListener('housestage:hover', handleHover);
    window.addEventListener('housestage:toggle', handleToggle);
    window.addEventListener('housestage:longpress', handleLongPress);
    window.addEventListener('housestage:room', handleRoom);
    if (window.__houseStage) setSceneReady((token) => token + 1);

    return () => {
      window.removeEventListener('housestage:ready', handleReady);
      window.removeEventListener('housestage:hover', handleHover);
      window.removeEventListener('housestage:toggle', handleToggle);
      window.removeEventListener('housestage:longpress', handleLongPress);
      window.removeEventListener('housestage:room', handleRoom);
    };
  }, [webgl, onToggle]);

  // ── Collapse the drawer on a short stage, per the drawer contract ──────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.height <= 0) return;
      setNarrow(rect.width < NARROW_STAGE_WIDTH);
      const next = rect.height < COMPACT_STAGE_HEIGHT;
      if (next === compactRef.current) return;
      compactRef.current = next;
      setCompact(next);
      setPanelOpen(!next);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // ── Host → stage ───────────────────────────────────────────────────────────
  useEffect(() => {
    const stage = window.__houseStage;
    if (!stage?.scene) return;

    stage.setSelected(selectedZoneIds);
    stage.setHover(hoveredZoneId);
    stage.setLighting(light);
    stage.setAutoRotate(autoRotate);
    stage.setViewMode(viewMode);

    const fresh = stage !== lastStageRef.current;
    if (fresh) lastStageRef.current = stage;

    if (fresh || layerKeyRef.current !== layer) {
      layerKeyRef.current = layer;
      stage.setLayer(layer);
    }

    // Only move the camera when the view actually changes, so the user keeps
    // control of rotate and zoom inside a level.
    const wanted = planMode ? 'plan' : 'udvendig';
    const key = `${wanted}|${level}`;
    if (fresh || viewKeyRef.current !== key) {
      viewKeyRef.current = key;
      stage.setStageMode(wanted, level);
    }
  }, [selectedZoneIds, hoveredZoneId, light, autoRotate, viewMode, layer, level, planMode, sceneReady]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const flash = useCallback((zoneId: string) => window.__houseStage?.flashMarker(zoneId), []);

  const handleToggleZone = useCallback(
    (zoneId: string) => {
      if (!selectedZoneIds.includes(zoneId)) flash(zoneId);
      onToggle(zoneId);
    },
    [flash, onToggle, selectedZoneIds],
  );

  const handleToggleGroup = useCallback(
    (zoneIds: string[]) => {
      const allSelected = zoneIds.every((zoneId) => selectedZoneIds.includes(zoneId));
      if (!allSelected) flash(zoneIds[0]);
      for (const zoneId of zoneIds) {
        const isSelected = selectedZoneIds.includes(zoneId);
        if (allSelected === isSelected) onToggle(zoneId);
      }
    },
    [flash, onToggle, selectedZoneIds],
  );

  const handleToggleTask = useCallback(
    (zoneId: string, taskId: string) => {
      if (!selectedZoneIds.includes(zoneId)) {
        flash(zoneId);
        onToggle(zoneId);
      }
      onToggleTask?.(zoneId, taskId);
    },
    [flash, onToggle, onToggleTask, selectedZoneIds],
  );

  const handleSelectAll = useCallback(() => {
    for (const zoneId of ALL_ZONE_IDS) {
      if (!selectedZoneIds.includes(zoneId)) onToggle(zoneId);
    }
  }, [onToggle, selectedZoneIds]);

  const handleSelectNone = useCallback(() => {
    for (const zoneId of selectedZoneIds) onToggle(zoneId);
  }, [onToggle, selectedZoneIds]);

  const handleQuality = useCallback(() => {
    const next: QualityId = quality === 'hoj' ? 'mobil' : 'hoj';
    setQuality(next);
    window.__houseStage?.setQuality(next);
    try {
      window.localStorage.setItem(QUALITY_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }, [quality]);

  const hoveredZone = hoveredZoneId ? getBuildingZoneById(hoveredZoneId) : undefined;

  const hint = insideRoom
    ? `Du er inde i ${insideRoom} — drej for at se rundt, tryk Tilbage`
    : planMode
    ? 'Vælg etage til venstre — zoom og drej planen med musen'
    : 'Venstre træk drejer · højre træk eller to fingre flytter · hold for at gå ind i rummet';

  const stageBackground =
    light === 'dag'
      ? 'radial-gradient(120% 90% at 58% 22%, #2f5679 0%, #1d3a56 40%, #14283c 100%)'
      : 'radial-gradient(120% 90% at 62% 30%, #0f2033 0%, #091524 45%, #060d16 100%)';

  return (
    <div
      ref={hostRef}
      data-testid="house-model-stage"
      className="relative h-full min-h-0 overflow-hidden rounded-2xl"
      style={{ background: stageBackground }}
    >
      {!webgl && (
        <div
          data-testid="house-model-fallback"
          className="absolute inset-0 overflow-y-auto p-5"
        >
          <HouseExteriorSVG
            selectedZoneIds={selectedZoneIds}
            onToggle={handleToggleZone}
            className="mx-auto max-h-[380px] w-full max-w-2xl"
          />
          <p className="mt-3 text-center text-sm text-slate-400">
            3D-visning er ikke tilgængelig på denne enhed. Du kan stadig vælge alle bygningsdele.
          </p>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2 pb-4">
            {BUILDING_ZONES.map((zone) => {
              const on = selectedZoneIds.includes(zone.id);
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => handleToggleZone(zone.id)}
                  aria-pressed={on}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                  style={{
                    borderColor: on ? '#3b82f6' : 'rgba(148,180,220,0.28)',
                    background: on ? 'rgba(37,99,235,0.18)' : 'transparent',
                    color: on ? '#dce8f6' : '#a3b6cc',
                  }}
                >
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: zone.highlightColor }} />
                  {zone.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Level pills — plan view only */}
      {planMode && !listMode && !insideRoom && !roomMenu && (
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-2">
          <div className="flex gap-[5px] rounded-xl border border-[rgba(148,180,220,0.14)] bg-[rgba(10,20,34,0.88)] p-[5px]">
            {MODEL_LEVELS.map((entry) => {
              const active = level === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setLevel(entry.id)}
                  aria-pressed={active}
                  className="flex items-center gap-2 rounded-[9px] px-3 py-2 hover:bg-[rgba(96,165,250,0.12)]"
                  style={{ background: active ? 'rgba(37,99,235,0.9)' : 'transparent' }}
                >
                  <span
                    className="text-[10.5px] font-bold tracking-[0.06em]"
                    style={{ color: active ? 'rgba(255,255,255,0.72)' : '#6d829a' }}
                  >
                    {entry.num}
                  </span>
                  <span
                    className="text-[12.5px] font-semibold"
                    style={{ color: active ? '#ffffff' : '#a3b6cc' }}
                  >
                    {entry.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="max-w-[230px] rounded-[9px] border border-[rgba(148,180,220,0.12)] bg-[rgba(10,20,34,0.8)] px-[11px] py-[7px] text-[11.5px] text-[#8ba2bd]">
            Tag og etager over den valgte plan er skjult. Zoom med hjulet.
          </p>
        </div>
      )}

      {/* Inside-room state */}
      {insideRoom && !listMode && (
        <button
          type="button"
          onClick={() => window.__houseStage?.exitRoom()}
          className="absolute left-4 top-4 z-30 flex h-11 items-center gap-2.5 rounded-xl border border-[rgba(96,165,250,0.32)] bg-[rgba(10,20,34,0.92)] pl-[13px] pr-4 shadow-[0_12px_28px_rgba(3,8,16,0.5)] hover:border-[rgba(96,165,250,0.7)]"
        >
          <span className="text-[#93c5fd]">
            <Glyph d={ICON_ARROW_LEFT} size={18} width={2} />
          </span>
          <span className="text-[13px] font-semibold text-[#dce8f6]">Tilbage</span>
          <span className="text-[12px] text-[#8ba2bd]">· {insideRoom}</span>
        </button>
      )}

      {/* Long-press room menu */}
      {roomMenu && !listMode && (
        <div
          className="absolute z-40 w-[212px] -translate-x-1/2 -translate-y-[118%] rounded-xl border border-[rgba(96,165,250,0.3)] bg-[rgba(11,22,38,0.97)] p-1.5 shadow-[0_18px_40px_rgba(3,8,16,0.62)]"
          style={{ left: roomMenu.x, top: roomMenu.y }}
        >
          <div className="px-[9px] pb-1.5 pt-[7px] text-[10.5px] font-bold uppercase tracking-[0.07em] text-[#6d829a]">
            {roomMenu.room}
          </div>
          <button
            type="button"
            onClick={() => {
              window.__houseStage?.enterRoom(roomMenu.index);
              setRoomMenu(null);
            }}
            className="flex min-h-10 w-full items-center gap-2.5 rounded-[9px] px-[9px] py-2 hover:bg-[rgba(96,165,250,0.12)]"
          >
            <span className="text-[#93c5fd]">
              <Glyph d={ICON_ENTER_ROOM} size={17} width={1.9} />
            </span>
            <span className="text-[13px] font-semibold text-[#eaf1f9]">Gå ind i rummet</span>
          </button>
          <button
            type="button"
            onClick={() => setRoomMenu(null)}
            className="flex min-h-9 w-full items-center gap-2.5 rounded-[9px] px-[9px] py-1.5 hover:bg-[rgba(148,180,220,0.1)]"
          >
            <span className="text-[#8ba2bd]">
              <Glyph d={ICON_CLOSE} size={15} width={2.4} />
            </span>
            <span className="text-[12.5px] text-[#a8bdd4]">Annullér</span>
          </button>
        </div>
      )}

      {/* Drawer */}
      {listMode ? null : panelOpen ? (
        <BuildingPartsDrawer
          selectedZoneIds={selectedZoneIds}
          selectedTasks={selectedTasks}
          onToggleZone={handleToggleZone}
          onToggleTask={handleToggleTask}
          onToggleGroup={handleToggleGroup}
          onSelectAll={handleSelectAll}
          onSelectNone={handleSelectNone}
          onHover={setHoveredZoneId}
          panelTab={panelTab}
          onPanelTab={setPanelTab}
          layer={layer}
          onLayer={setLayer}
          compact={compact}
          onClose={() => setPanelOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Vis bygningsdele"
          className="absolute right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(96,165,250,0.28)] bg-[rgba(10,20,34,0.9)] text-[#93c5fd] shadow-[0_12px_28px_rgba(3,8,16,0.5)]"
        >
          <Glyph d={ICON_PANEL} size={20} />
        </button>
      )}

      {/* Hover card */}
      {hoveredZone && !listMode && (
        <div
          className="pointer-events-none absolute z-40 w-[210px] -translate-x-1/2 -translate-y-[118%] rounded-xl border border-[rgba(96,165,250,0.3)] bg-[rgba(11,22,38,0.96)] px-3.5 py-[13px] shadow-[0_18px_40px_rgba(3,8,16,0.6)]"
          style={{ left: hoverPoint.x, top: hoverPoint.y }}
        >
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold tracking-[-0.01em] text-[#eaf1f9]">
                {hoveredZone.label}
              </div>
              <div className="mt-[3px] text-[11.5px] leading-[1.35] text-[#93a9c2]">{hoveredZone.sublabel}</div>
            </div>
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[rgba(96,165,250,0.16)] text-[#93c5fd]">
              <Glyph d={ICON_ARROW_RIGHT} size={14} width={2.1} />
            </span>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        hidden={listMode}
        className={[
          'absolute z-20 flex items-center gap-3',
          narrow ? 'inset-x-3 bottom-3 justify-end gap-2' : 'inset-x-5 bottom-5 flex-wrap',
        ].join(' ')}
      >
        {!narrow && (
        <div className="flex gap-1.5 rounded-[14px] border border-[rgba(148,180,220,0.14)] bg-[rgba(10,20,34,0.86)] p-1.5">
          {VIEW_MODES.map((mode) => {
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                title={mode.title}
                aria-label={mode.title}
                aria-pressed={active}
                className="flex h-[38px] w-11 items-center justify-center rounded-[10px]"
                style={{
                  background: active ? 'rgba(37,99,235,0.9)' : 'transparent',
                  color: active ? '#ffffff' : '#8ba2bd',
                }}
              >
                <Glyph d={mode.icon} size={18} />
              </button>
            );
          })}
        </div>
        )}

        <p className="pointer-events-none hidden min-w-0 flex-1 justify-center overflow-hidden lg:flex">
          <span className="max-w-full truncate rounded-full bg-[rgba(8,16,28,0.6)] px-3.5 py-1.5 text-[13px] text-[#94aac2]">
            {hint}
          </span>
        </p>

        <div className={narrow ? 'flex items-center gap-1.5' : 'ml-auto flex items-center gap-2.5'}>
          {!narrow && (
          <button
            type="button"
            onClick={handleQuality}
            title={
              quality === 'hoj'
                ? 'Fuld kvalitet — slå fra for bedre ydelse på mobil'
                : 'Mobil-tilstand — lettere teksturer, skygger og lys'
            }
            aria-pressed={quality === 'hoj'}
            className="flex items-center gap-2 rounded-[9px] border px-3 py-2"
            style={{
              background: quality === 'hoj' ? 'rgba(37,99,235,0.16)' : 'rgba(24,40,64,0.85)',
              borderColor: quality === 'hoj' ? 'rgba(96,165,250,0.45)' : 'rgba(148,180,220,0.16)',
            }}
          >
            <CheckBox checked={quality === 'hoj'} size={16} />
            <span
              className="text-[12px] font-semibold"
              style={{ color: quality === 'hoj' ? '#dce8f6' : '#a8bdd4' }}
            >
              Kvalitet: {quality === 'hoj' ? 'Høj' : 'Mobil'}
            </span>
          </button>
          )}

          <div className="flex gap-1 rounded-full border border-[rgba(148,180,220,0.16)] bg-[rgba(10,20,34,0.88)] p-1">
            {LIGHT_MODES.map((mode) => {
              const active = light === mode.id;
              const color = active ? (mode.id === 'dag' ? '#fbbf24' : '#ffffff') : '#8ba2bd';
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setLight(mode.id)}
                  title={mode.title}
                  aria-label={mode.label}
                  aria-pressed={active}
                  className={[
                    'flex items-center justify-center gap-[7px] rounded-full',
                    narrow ? 'min-h-11 min-w-11' : 'px-[13px] py-[7px]',
                  ].join(' ')}
                  style={{
                    background: active
                      ? mode.id === 'dag'
                        ? 'rgba(251,191,36,0.18)'
                        : 'rgba(37,99,235,0.85)'
                      : 'transparent',
                    color,
                  }}
                >
                  <Glyph d={mode.icon} size={15} />
                  {!narrow && <span className="text-[12px] font-semibold">{mode.label}</span>}
                </button>
              );
            })}
          </div>

          {[
            // On a narrow stage the labelled Kvalitet pill does not fit, so it
            // joins the tool row as an icon toggle.
            ...(narrow
              ? [{
                  title: `Kvalitet: ${quality === 'hoj' ? 'Høj' : 'Mobil'}`,
                  icon: ICON_QUALITY,
                  active: quality === 'hoj',
                  onClick: handleQuality,
                }]
              : []),
            { title: 'Hjælp', icon: ICON_HELP, active: false, onClick: () => setHelpOpen(true) },
            {
              title: autoRotate ? 'Stop rotation' : 'Auto-rotér',
              icon: ICON_CUBE,
              active: autoRotate,
              onClick: () => setAutoRotate((value) => !value),
            },
            {
              title: 'Nulstil visning',
              icon: ICON_RESET,
              active: false,
              onClick: () => window.__houseStage?.resetView(),
            },
          ].map((tool) => (
            <button
              key={tool.title}
              type="button"
              onClick={tool.onClick}
              title={tool.title}
              aria-label={tool.title}
              className={[
                'flex items-center justify-center rounded-full border border-[rgba(148,180,220,0.16)] hover:border-[rgba(96,165,250,0.55)]',
                narrow ? 'h-11 w-11' : 'h-[42px] w-[42px]',
              ].join(' ')}
              style={{
                background: tool.active ? 'rgba(37,99,235,0.2)' : 'rgba(10,20,34,0.86)',
                color: tool.active ? '#60a5fa' : '#8ba2bd',
              }}
            >
              <Glyph d={tool.icon} size={18} />
            </button>
          ))}
        </div>
      </div>

      {/* Listevisning */}
      {view === 'list' && (
        <ListView
          narrow={narrow}
          selectedZoneIds={selectedZoneIds}
          selectedTasks={selectedTasks}
          onToggleZone={handleToggleZone}
          onToggleTask={handleToggleTask}
          onToggleGroup={handleToggleGroup}
          onSelectNone={handleSelectNone}
        />
      )}

      {helpOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm">
          <div className="relative max-w-sm rounded-2xl border border-white/10 bg-[#111e2d] p-6 text-slate-200 shadow-2xl">
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Luk hjælp"
            >
              <Glyph d={ICON_CLOSE} size={18} width={2.2} />
            </button>
            <h3 className="text-base font-bold text-white">Udforsk 3D-modellen</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Træk med én finger for at dreje huset. Hold to fingre nede for at flytte kameraet, og knib for at
              zoome. Tryk direkte på en bygningsdel for at vælge den — eller hold fingeren nede på et rum i
              planvisningen for at gå ind i det.
            </p>
          </div>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {hoveredZone ? `${hoveredZone.label}: ${hoveredZone.sublabel}` : 'Ingen bygningsdel fremhævet'}
      </span>
    </div>
  );
};

export default HouseModel3D;
