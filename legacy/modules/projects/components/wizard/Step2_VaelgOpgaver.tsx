/**
 * Step2_VaelgOpgaver.tsx
 * Task selection step.
 * - Zone tabs (only zones from Step 1) with task count badge
 * - Trade filter chips
 * - Bundle card (one-tap apply all tasks in bundle)
 * - Virtual task card grid (tanstack-virtual for perf with 150+ tasks)
 * - Quantity stepper per task
 * - Selected tasks drawer at bottom
 */

import React, { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Package, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Chip } from '../../../../components/ui';
import {
  getZoneById,
  getTasksForZone,
  getBundlesForZone,
  ALL_TRADES,
} from '../../data/wizardCatalog';
import type { Task, Bundle, TradeId } from '../../data/wizardCatalog';
import { runSuggestTasks } from '../../../ai';
import { useModuleGate } from '../../../../core/entitlements/ModuleGate';
import type { WizardStoreInstance } from '../../stores/wizardStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step2Props {
  store: WizardStoreInstance;
}

// Complexity label
const COMPLEXITY_LABEL: Record<number, string> = { 1: 'Simpel', 2: 'Middel', 3: 'Kompleks' };
const COMPLEXITY_COLOR: Record<number, string> = {
  1: 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success',
  2: 'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning',
  3: 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger',
};

// ─── Quantity stepper ─────────────────────────────────────────────────────────

const QuantityStepper: React.FC<{
  taskId: string;
  quantity: number;
  onChange: (qty: number) => void;
}> = ({ taskId, quantity, onChange }) => (
  <div className="flex items-center gap-1.5">
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(Math.max(1, quantity - 1)); }}
      className="relative w-7 h-7 rounded-full bg-bg-muted dark:bg-bg-dark-muted flex items-center justify-center text-text-secondary dark:text-text-dark-secondary active:bg-border dark:active:bg-border-dark transition-colors after:absolute after:-inset-2.5 after:content-['']"
      aria-label="Mindsk antal"
    >
      <Minus size={12} />
    </button>
    <span className="w-5 text-center text-label font-semibold text-text-primary dark:text-text-dark-primary">
      {quantity}
    </span>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(quantity + 1); }}
      className="relative w-7 h-7 rounded-full bg-bg-muted dark:bg-bg-dark-muted flex items-center justify-center text-text-secondary dark:text-text-dark-secondary active:bg-border dark:active:bg-border-dark transition-colors after:absolute after:-inset-2.5 after:content-['']"
      aria-label="Forøg antal"
    >
      <Plus size={12} />
    </button>
  </div>
);

// ─── Task Card ────────────────────────────────────────────────────────────────

const TaskCard: React.FC<{
  task: Task;
  zoneId: string;
  isSelected: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (qty: number) => void;
}> = ({ task, zoneId: _zoneId, isSelected, quantity, onToggle, onQuantityChange }) => (
  <motion.div
    layout="position"
    className={[
      'rounded-xl border-2 p-3 transition-colors duration-150 cursor-pointer select-none',
      isSelected
        ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10'
        : 'border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface active:bg-bg-muted dark:active:bg-bg-dark-muted',
    ].join(' ')}
    onClick={onToggle}
    role="checkbox"
    aria-checked={isSelected}
    tabIndex={0}
    onKeyDown={(e) => e.key === ' ' && onToggle()}
  >
    <div className="flex items-start gap-2">
      {/* Icon */}
      <span className="text-xl flex-none mt-0.5">{task.icon}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={[
              'text-label font-semibold leading-tight',
              isSelected
                ? 'text-brand-primary'
                : 'text-text-primary dark:text-text-dark-primary',
            ].join(' ')}
          >
            {task.label}
          </span>
          {task.isMaintenance && (
            <span className="text-caption px-1.5 py-0.5 rounded-full bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info font-medium">
              Vedl.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Trade */}
          <span className="text-caption text-text-secondary dark:text-text-dark-secondary bg-bg-muted dark:bg-bg-dark-muted px-2 py-0.5 rounded-full">
            {task.trade}
          </span>
          {/* Complexity */}
          <span className={`text-caption px-1.5 py-0.5 rounded-full font-medium ${COMPLEXITY_COLOR[task.complexity]}`}>
            {COMPLEXITY_LABEL[task.complexity]}
          </span>
          {/* Duration */}
          <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">⏱ {task.duration}</span>
        </div>
      </div>

      {/* Checkbox / quantity */}
      <div className="flex-none flex flex-col items-end gap-1.5">
        {isSelected ? (
          <>
            <div className="w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 3.5L3.8 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <QuantityStepper
              taskId={task.id}
              quantity={quantity}
              onChange={(qty) => {
                onQuantityChange(qty);
              }}
            />
          </>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-border-strong dark:border-border-dark-strong" />
        )}
      </div>
    </div>
  </motion.div>
);

// ─── Bundle Card ──────────────────────────────────────────────────────────────

const BundleCard: React.FC<{
  bundle: Bundle;
  zoneId: string;
  onApply: () => void;
  isApplied: boolean;
}> = ({ bundle, onApply, isApplied }) => (
  <motion.div
    className={[
      'rounded-xl p-3 border-2 mb-3',
      isApplied
        ? 'border-brand-primary bg-gradient-to-r from-brand-primary/10 to-brand-primary/5'
        : 'border-info-border dark:border-info/30 bg-gradient-to-r from-info-subtle to-brand-subtle dark:from-info-subtle-dark dark:to-brand-subtle-dark',
    ].join(' ')}
  >
    <div className="flex items-center gap-2">
      <Package size={16} className="text-info-strong dark:text-info flex-none" />
      <div className="flex-1 min-w-0">
        <div className="text-label font-bold text-info-strong dark:text-info">{bundle.label}</div>
        <div className="text-caption text-info-strong/80 dark:text-info/80 mt-0.5">
          {bundle.taskIds.length} opgaver inkluderet
        </div>
      </div>
      <Button size="md" variant="primary" onClick={onApply} className="flex-none">
        {isApplied ? '✓ Valgt' : 'Tilføj alle'}
      </Button>
    </div>
  </motion.div>
);

// ─── Virtual task list ────────────────────────────────────────────────────────

const VirtualTaskList: React.FC<{
  tasks: Task[];
  zoneId: string;
  selectedTaskIds: string[];
  quantities: Record<string, number>;
  onToggle: (taskId: string) => void;
  onQuantityChange: (taskId: string, qty: number) => void;
}> = ({ tasks, zoneId, selectedTaskIds, quantities, onToggle, onQuantityChange }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto"
      style={{ maxHeight: '420px' }}
    >
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((vItem) => {
          const task = tasks[vItem.index];
          const isSelected = selectedTaskIds.includes(task.id);
          return (
            <div
              key={task.id}
              data-index={vItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: vItem.start,
                left: 0,
                right: 0,
                padding: '0 0 8px 0',
              }}
            >
              <TaskCard
                task={task}
                zoneId={zoneId}
                isSelected={isSelected}
                quantity={quantities[task.id] ?? 1}
                onToggle={() => onToggle(task.id)}
                onQuantityChange={(qty) => onQuantityChange(task.id, qty)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Step2_VaelgOpgaver ───────────────────────────────────────────────────────


// ─── AI Suggestion Strip ──────────────────────────────────────────────────────

const AiSuggestionStrip: React.FC<{
  zoneId: string;
  projectTypeId: string | null;
  selectedTaskIds: string[];
  allTaskIds: string[];
  onAdd: (taskId: string) => void;
  onDismiss: () => void;
}> = ({ zoneId, projectTypeId, selectedTaskIds, allTaskIds, onAdd, onDismiss }) => {
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [added, setAdded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    runSuggestTasks({
      zoneId,
      projectTypeId: projectTypeId as never,
      selectedTaskIds,
      availableTaskIds: allTaskIds,
    }).then((res) => {
      if (cancelled) return;
      if (res.ok && res.result) {
        setSuggestions(res.result.suggestedTaskIds.filter((id) => !selectedTaskIds.includes(id)));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [zoneId, selectedTaskIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="mx-4 mb-2 px-3 py-2.5 rounded-xl bg-brand-subtle dark:bg-brand-subtle-dark border border-brand-border dark:border-brand-border-dark flex items-center gap-2">
        <svg className="w-3.5 h-3.5 animate-spin text-brand-primary flex-none" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-label text-brand-primary dark:text-brand-light">AI henter forslag...</span>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="mx-4 mb-3 px-3 py-2.5 rounded-xl bg-brand-subtle dark:bg-brand-subtle-dark border border-brand-border dark:border-brand-border-dark"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-label font-semibold text-brand-primary dark:text-brand-light flex items-center gap-1">
          <span>✨</span> AI foreslår ofte med dette
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-caption p-2 -m-2 text-brand-primary/70 dark:text-brand-light/70 hover:text-brand-primary dark:hover:text-brand-light transition-colors"
        >
          Skjul
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((taskId) => {
          const isAdded = added.has(taskId);
          return (
            <button
              type="button"
              key={taskId}
              onClick={() => {
                if (!isAdded) {
                  onAdd(taskId);
                  setAdded((prev) => new Set([...prev, taskId]));
                }
              }}
              className={[
                'text-label px-2.5 py-1.5 rounded-full border transition-colors',
                isAdded
                  ? 'bg-brand-primary border-brand-primary text-white'
                  : 'bg-bg dark:bg-brand-subtle-dark border-brand-border dark:border-brand-border-dark text-brand-primary dark:text-brand-light hover:bg-brand-subtle',
              ].join(' ')}
            >
              {isAdded ? '✓ ' : '+ '}{taskId.replace(/_/g, ' ')}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export const Step2_VaelgOpgaver: React.FC<Step2Props> = ({ store }) => {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const useStore = store;

  const selectedZones = useStore((s) => s.selectedZones);
  const selectedTasks = useStore((s) => s.selectedTasks);
  const taskQuantities = useStore((s) => s.taskQuantities);
  const activeZoneTab = useStore((s) => s.activeZoneTab);
  const { toggleTask, setTaskQuantity, applyBundle, setActiveZoneTab } = useStore.getState();

  // Active zone defaults to first selected zone
  const activeZoneId =
    activeZoneTab ?? selectedZones[0]?.zoneId ?? null;

  const activeZone = useMemo(() => getZoneById(activeZoneId ?? ''), [activeZoneId]);

  const [tradeFilter, setTradeFilter] = useState<TradeId | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showAiStrip, setShowAiStrip] = useState(true);
  const projectType = useStore((s) => s.projectType);
  // "AI foreslår ofte med dette" is an ai-module feature (runSuggestTasks) —
  // skip mounting the strip (and its fetch) when ai isn't entitled; manual
  // task selection above is unaffected.
  const aiEnabled = useModuleGate('ai');

  // Tasks for the active zone, filtered by trade
  const allTasks = useMemo(() => {
    if (!activeZone) return [];
    return getTasksForZone(activeZone.tasksKey);
  }, [activeZone]);

  const filteredTasks = useMemo(() => {
    if (!tradeFilter) return allTasks;
    return allTasks.filter((t) => t.trade === tradeFilter);
  }, [allTasks, tradeFilter]);

  // Which trades are present in this zone?
  const presentTrades = useMemo<TradeId[]>(() => {
    const set = new Set(allTasks.map((t) => t.trade));
    return ALL_TRADES.filter((tr) => set.has(tr));
  }, [allTasks]);

  // Bundles for active zone
  const bundles = useMemo(() => {
    if (!activeZone) return [];
    return getBundlesForZone(activeZone.tasksKey);
  }, [activeZone]);

  const activeSelectedTaskIds = useMemo(
    () => (activeZoneId ? selectedTasks[activeZoneId] ?? [] : []),
    [activeZoneId, selectedTasks],
  );

  const totalTasks = useMemo(
    () => Object.values(selectedTasks).reduce((n, ids) => n + ids.length, 0),
    [selectedTasks],
  );

  if (selectedZones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
        <p className="text-text-secondary dark:text-text-dark-secondary text-body">
          Du har ikke valgt nogen zoner. Gå tilbage og vælg mindst ét område.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Heading */}
      <div className="px-4 pt-6 pb-3">
        <h2 className="text-heading text-text-primary dark:text-text-dark-primary">
          Vælg opgaver
        </h2>
        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
          {totalTasks > 0 ? `${totalTasks} opgaver valgt` : 'Tilføj opgaver til hvert område'}
        </p>
      </div>

      {/* Zone tabs — scrollable horizontal row */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none flex-nowrap">
        {selectedZones.map((sel) => {
          const zone = getZoneById(sel.zoneId);
          const count = (selectedTasks[sel.zoneId] ?? []).length;
          const isActive = activeZoneId === sel.zoneId;
          return (
            <button
              type="button"
              key={sel.zoneId}
              onClick={() => setActiveZoneTab(sel.zoneId)}
              className={[
                'relative flex-none flex items-center gap-1.5 px-3 min-h-11 rounded-xl text-label font-medium whitespace-nowrap transition-colors duration-150',
                isActive
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-muted dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary',
              ].join(' ')}
            >
              <span>{zone?.icon ?? '📍'}</span>
              <span>{zone?.label ?? sel.zoneId}</span>
              {count > 0 && (
                <span
                  className={[
                    'ml-0.5 px-1.5 py-0.5 rounded-full text-caption font-bold',
                    isActive ? 'bg-white/25 text-white' : 'bg-brand-primary text-white',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeZoneId && (
        <>
          {/* Bundles */}
          {bundles.length > 0 && (
            <div className="px-4 mb-2">
              {bundles.map((bundle) => {
                const isApplied = bundle.taskIds.every((tid) =>
                  activeSelectedTaskIds.includes(tid),
                );
                return (
                  <BundleCard
                    key={bundle.id}
                    bundle={bundle}
                    zoneId={activeZoneId}
                    isApplied={isApplied}
                    onApply={() => applyBundle(activeZoneId, bundle.taskIds)}
                  />
                );
              })}
            </div>
          )}

          {/* AI suggestion strip (appears after 3+ tasks selected) */}
          <AnimatePresence>
            {aiEnabled && showAiStrip && activeSelectedTaskIds.length >= 3 && (
              <AiSuggestionStrip
                key={activeZoneId}
                zoneId={activeZoneId}
                projectTypeId={projectType}
                selectedTaskIds={activeSelectedTaskIds}
                allTaskIds={allTasks.map((t) => t.id)}
                onAdd={(taskId) => toggleTask(activeZoneId, taskId)}
                onDismiss={() => setShowAiStrip(false)}
              />
            )}
          </AnimatePresence>

          {/* Trade filter chips */}
          {presentTrades.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none flex-nowrap">
              <Chip
                selected={!tradeFilter}
                onClick={() => setTradeFilter(null)}
                className="flex-none"
              >
                Alle
              </Chip>
              {presentTrades.map((trade) => (
                <Chip
                  key={trade}
                  selected={tradeFilter === trade}
                  onClick={() => setTradeFilter(tradeFilter === trade ? null : trade)}
                  className="flex-none"
                >
                  {trade}
                </Chip>
              ))}
            </div>
          )}

          {/* Task count for current filter */}
          <div className="px-4 pb-2">
            <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">
              {filteredTasks.length} opgaver{tradeFilter ? ` (${tradeFilter})` : ''}
            </span>
          </div>

          {/* Virtual task list */}
          <div className="px-4">
            <VirtualTaskList
              tasks={filteredTasks}
              zoneId={activeZoneId}
              selectedTaskIds={activeSelectedTaskIds}
              quantities={taskQuantities}
              onToggle={(taskId) => toggleTask(activeZoneId, taskId)}
              onQuantityChange={(taskId, qty) => setTaskQuantity(taskId, qty)}
            />
          </div>
        </>
      )}

      {/* Selected tasks summary drawer */}
      {totalTasks > 0 && (
        <div className="mt-4 mx-4 rounded-xl bg-bg-subtle dark:bg-bg-dark-surface/60 border border-border dark:border-border-dark overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDrawer((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 min-h-11 text-text-primary dark:text-text-dark-primary"
          >
            <span className="text-label font-semibold">
              Valgte opgaver ({totalTasks})
            </span>
            {showDrawer ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <AnimatePresence>
            {showDrawer && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-3 max-h-48 overflow-y-auto space-y-2">
                  {Object.entries(selectedTasks).flatMap(([zoneId, taskIds]) =>
                    taskIds.map((taskId) => {
                      const zone = getZoneById(zoneId);
                      const task = getTasksForZone(zone?.tasksKey ?? '').find((t) => t.id === taskId);
                      if (!task) return null;
                      return (
                        <div
                          key={`${zoneId}:${taskId}`}
                          className="flex items-center gap-2 text-label text-text-secondary dark:text-text-dark-secondary"
                        >
                          <span>{task.icon}</span>
                          <span className="flex-1 truncate">{task.label}</span>
                          <span className="text-text-tertiary dark:text-text-dark-tertiary">{zone?.label}</span>
                        </div>
                      );
                    }),
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Step2_VaelgOpgaver;
