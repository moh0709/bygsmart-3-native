/**
 * Step1_VaelgOmraade.tsx
 * Zone selection step, built around the 3D house model (house3d/house-scene.js).
 *
 * Three views over the same state:
 *   Udvendig     — orbit the model, click parts
 *   Indvendig    — plan cut per level, long-press a room to walk in
 *   Listevisning — sideways configurator tree (kategori → bygningsdel → opgaver)
 *
 * The tab id is persisted in the wizard store as `activeAreaTab`; the legacy
 * `apartment` value now means Listevisning, so the persistence shape is unchanged.
 */

import React, { useMemo } from 'react';
import { HouseModel3D, type StageView } from './HouseModel3D';
import { getZoneById } from '../../data/wizardCatalog';
import type { WizardStoreInstance } from '../../stores/wizardStore';

interface Step1Props {
  store: WizardStoreInstance;
}

type AreaTab = 'exterior' | 'interior' | 'apartment';

const AREA_TABS: { id: AreaTab; label: string; view: StageView }[] = [
  { id: 'exterior', label: 'Udvendig', view: 'exterior' },
  { id: 'interior', label: 'Indvendig', view: 'interior' },
  { id: 'apartment', label: 'Listevisning', view: 'list' },
];

export const Step1_VaelgOmraade: React.FC<Step1Props> = ({ store }) => {
  const useStore = store;
  const activeAreaTab = useStore((s) => s.activeAreaTab);
  const selectedZones = useStore((s) => s.selectedZones);
  const selectedTasks = useStore((s) => s.selectedTasks);
  const { setActiveAreaTab, toggleZone, toggleTask } = useStore.getState();

  const selectedZoneIds = useMemo(() => selectedZones.map((zone) => zone.zoneId), [selectedZones]);
  const view = AREA_TABS.find((tab) => tab.id === activeAreaTab)?.view ?? 'exterior';

  return (
    <div className="dark flex h-full min-h-0 flex-col bg-[#060c14]">
      <h2 className="sr-only">Vælg bygningsdele</h2>

      {/* View tabs */}
      <div className="grid flex-none grid-cols-3 gap-3.5 px-4 pb-3.5 pt-4 md:px-6">
        {AREA_TABS.map((tab) => {
          const active = activeAreaTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveAreaTab(tab.id)}
              aria-pressed={active}
              className="flex h-11 items-center justify-center rounded-[10px] border text-[14px] font-semibold transition-colors"
              style={{
                background: active ? '#2563eb' : 'rgba(19,32,50,0.75)',
                borderColor: active ? '#2563eb' : 'rgba(148,180,220,0.14)',
                color: active ? '#ffffff' : '#a8bdd4',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Stage */}
      <div className="min-h-0 flex-1 px-4 md:px-6">
        <HouseModel3D
          selectedZoneIds={selectedZoneIds}
          onToggle={(zoneId) => toggleZone(zoneId)}
          selectedTasks={selectedTasks}
          onToggleTask={(zoneId, taskId) => toggleTask(zoneId, taskId)}
          view={view}
        />
      </div>

      {/* Selection recap */}
      {selectedZoneIds.length > 0 && (
        <div className="flex flex-none items-center gap-2.5 px-4 pt-3 md:px-6">
          <span className="shrink-0 text-[11.5px] font-semibold tracking-[0.03em] text-[#8ba2bd]">
            I projektet ({selectedZoneIds.length})
          </span>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {selectedZoneIds.map((zoneId) => {
              const zone = getZoneById(zoneId);
              const taskCount = selectedTasks[zoneId]?.length ?? 0;
              return (
                <button
                  key={zoneId}
                  type="button"
                  onClick={() => toggleZone(zoneId)}
                  title="Fjern fra projektet"
                  aria-label={`Fjern ${zone?.label ?? zoneId} fra projektet`}
                  className="flex h-7 shrink-0 items-center gap-[7px] rounded-full border border-[rgba(96,165,250,0.28)] bg-[rgba(37,99,235,0.14)] px-2.5 hover:bg-[rgba(37,99,235,0.24)]"
                >
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: zone?.highlightColor ?? '#60a5fa' }}
                  />
                  <span className="whitespace-nowrap text-[11.5px] text-[#dce8f6]">
                    {zone?.label ?? zoneId}
                  </span>
                  {taskCount > 0 && (
                    <span className="text-[10px] font-bold text-[#93c5fd]">{taskCount} opg.</span>
                  )}
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#8ba2bd" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              for (const zoneId of selectedZoneIds) toggleZone(zoneId);
            }}
            className="shrink-0 text-[11.5px] font-semibold text-[#7d93ac] hover:text-[#c3d3e6]"
          >
            Ryd alle
          </button>
        </div>
      )}
    </div>
  );
};

export default Step1_VaelgOmraade;
