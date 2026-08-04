import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFollowUpItemsForProject, updateFollowUpItemStatus } from '../services/followUp';
import type { FollowUpItem, FollowUpCategory, FollowUpStatus, ResourceVisibility } from '../../../types';
import { navigateToAndHighlight } from '../../../utils/actions';
import {
  CheckIcon,
  ArrowUpRightIcon,
  ClipboardListIcon,
  BellIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '../../../components/icons';
import {
  Badge,
  Card,
  EmptyState,
  ListRow,
  SegmentedControl,
  SkeletonList,
  cn,
} from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';

const CategoryInfo: Record<
  FollowUpCategory,
  {
    icon: React.FC<{ className?: string }>;
    bubble: string;
    plural: string;
  }
> = {
  Opgave: {
    icon: ClipboardListIcon,
    bubble: 'bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info',
    plural: 'Opgaver',
  },
  Indkøb: {
    icon: CheckIcon,
    bubble: 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success',
    plural: 'Indkøb',
  },
  Påmindelse: {
    icon: BellIcon,
    bubble: 'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning',
    plural: 'Påmindelser',
  },
};

const STATUS_VARIANT: Record<FollowUpStatus, BadgeVariant> = {
  Afventer: 'warning',
  Igangværende: 'info',
  Forfalden: 'danger',
  Udført: 'success',
};

/** Status pill — kit Badge with dot (same anatomy as opgave-kortene). */
const StatusChip: React.FC<{ status: FollowUpStatus }> = ({ status }) => {
  const variant = STATUS_VARIANT[status];
  if (!variant) return null;
  return <Badge variant={variant} dot className="shrink-0">{status}</Badge>;
};

const ToggleSwitch: React.FC<{ id: string; checked: boolean; onChange: (checked: boolean) => void; ariaLabel?: string }> = ({
  id,
  checked,
  onChange,
  ariaLabel,
}) => (
  <div className="relative inline-flex items-center cursor-pointer">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={ariaLabel}
      title={ariaLabel}
      role="switch"
      className="sr-only peer"
    />
    <label
      htmlFor={id}
      className="relative w-11 h-6 bg-bg-muted dark:bg-bg-dark-muted rounded-full cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-brand-primary/50 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:bg-brand-primary"
    />
  </div>
);

const FollowUpTabContent: React.FC<{ projectId: string; userId?: string; resourceVisibility?: ResourceVisibility }> = ({ projectId, userId, resourceVisibility }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [activeTab, setActiveTab] = useState<'open' | 'done'>('open');
  const [autoLoad, setAutoLoad] = useState(() => {
    return localStorage.getItem(`bygSmart-autoLoad-${projectId}`) === 'true';
  });
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const data = await getFollowUpItemsForProject(projectId, userId, resourceVisibility);
    setItems(data);
    setLoading(false);
  }, [projectId, userId, resourceVisibility]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    localStorage.setItem(`bygSmart-autoLoad-${projectId}`, String(autoLoad));
  }, [autoLoad, projectId]);

  const openCount = useMemo(() => items.filter((item) => !item.isCompleted).length, [items]);
  const doneCount = useMemo(() => items.filter((item) => item.isCompleted).length, [items]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'done') {
      return items.filter((item) => item.isCompleted);
    }
    if (autoLoad) {
      return items.filter((item) => !item.isCompleted);
    }
    return items.filter((item) => item.hasReminder && !item.isCompleted);
  }, [items, autoLoad, activeTab]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
        const category = item.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<FollowUpCategory, FollowUpItem[]>);
  }, [filteredItems]);


  const handleToggleStatus = async (item: FollowUpItem) => {
    const newIsCompleted = !item.isCompleted;
    let newStatus: FollowUpStatus;
    if (newIsCompleted) {
      newStatus = 'Udført';
    } else {
      const now = new Date();
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      if (item.category === 'Opgave') {
        // updateFollowUpItemStatus sets task.status → 'Igangværende';
        // getFollowUpItemsForProject returns 'Igangværende' for that state
        newStatus = 'Igangværende';
      } else if (item.category === 'Påmindelse') {
        // is_completed → false; getFollowUpItemsForProject: overdue → 'Forfalden', else 'Afventer'
        newStatus = dueDate && dueDate < now ? 'Forfalden' : 'Afventer';
      } else {
        // Indkøb: updateFollowUpItemStatus sets purchase.status → 'Afventer'
        newStatus = 'Afventer';
      }
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, isCompleted: newIsCompleted, status: newStatus } : i
      )
    );
    await updateFollowUpItemStatus(projectId, item.id, newIsCompleted);
  };

  const handleGoToItem = (item: FollowUpItem) => {
    navigateToAndHighlight(navigate, item.originalUrl, item.originalRefId);
  };

  return (
    <div className="p-4 space-y-4 pb-24 animate-fade-in" data-ref-id="tab-content-opfølgning">
      {/* Åbne / Udførte switcher */}
      <SegmentedControl<'open' | 'done'>
        label="Skift mellem åbne og udførte emner"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { label: `Åbne (${openCount})`, value: 'open' },
          { label: `Udførte (${doneCount})`, value: 'done' },
        ]}
      />

      {activeTab === 'open' && (
        <Card padding="sm" className="flex justify-between items-center gap-3">
          <div className="min-w-0">
            <h3 className="text-label font-semibold text-text-primary dark:text-text-dark-primary">Auto-load</h3>
            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Vis alle ufærdige emner automatisk</p>
          </div>
          <ToggleSwitch id={`auto-load-${projectId}`} checked={autoLoad} onChange={setAutoLoad} ariaLabel="Auto-load opfølgninger" />
        </Card>
      )}

      {loading && <SkeletonList count={3} label="Indlæser opfølgninger…" />}

      {!loading && filteredItems.length === 0 && (
        <Card padding="none">
          {activeTab === 'done' ? (
            <EmptyState
              icon={<BellIcon className="w-8 h-8" />}
              title="Ingen udførte emner"
              description="Emner du markerer som udført, vises her."
            />
          ) : (
            <EmptyState
              icon={<BellIcon className="w-8 h-8" />}
              title="Alt er klaret!"
              description={autoLoad ? 'Der er ingen ufærdige emner.' : 'Der er ingen aktive påmindelser.'}
            />
          )}
        </Card>
      )}

      {!loading && Object.keys(groupedItems).length > 0 && (
        <div className="space-y-4">
            {(Object.keys(groupedItems) as FollowUpCategory[]).map(category => {
                const isCollapsed = collapsedCategories[category];
                const itemsInCategory = groupedItems[category];
                const categoryInfo = CategoryInfo[category];

                return (
                    <Card key={category} padding="none" className="overflow-hidden">
                        <button
                            type="button"
                            onClick={() => toggleCategory(category)}
                            title={isCollapsed ? 'Udvid kategori' : 'Skjul kategori'}
                            aria-label={`${categoryInfo.plural}: ${isCollapsed ? 'udvid kategori' : 'skjul kategori'}`}
                            aria-expanded={!isCollapsed}
                            className="w-full flex justify-between items-center gap-3 px-4 py-3 min-h-11 text-left hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors duration-150"
                        >
                            <span className="flex items-center gap-3 min-w-0">
                                <span className={cn('flex w-10 h-10 items-center justify-center rounded-control shrink-0', categoryInfo.bubble)} aria-hidden="true">
                                    <categoryInfo.icon className="w-5 h-5" />
                                </span>
                                <span className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{categoryInfo.plural}</span>
                                <Badge className="shrink-0">{itemsInCategory.length}</Badge>
                            </span>
                            {isCollapsed
                                ? <ChevronDownIcon className="w-5 h-5 shrink-0 text-text-secondary dark:text-text-dark-secondary" aria-hidden="true" />
                                : <ChevronUpIcon className="w-5 h-5 shrink-0 text-text-secondary dark:text-text-dark-secondary" aria-hidden="true" />}
                        </button>

                        {!isCollapsed && (
                            <div className="border-t border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark">
                                {itemsInCategory.map((item) => (
                                    <ListRow
                                        key={item.id}
                                        leading={
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(item)}
                                                aria-label={item.isCompleted ? 'Genåbn emne' : 'Markér som udført'}
                                                title={item.isCompleted ? 'Genåbn emne' : 'Markér som udført'}
                                                className="flex w-11 h-11 -ml-1.5 items-center justify-center rounded-full hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
                                            >
                                                <span className={cn(
                                                    'flex w-6 h-6 items-center justify-center rounded-full border-2 transition-colors duration-150',
                                                    activeTab === 'done'
                                                        ? 'bg-success border-success text-white'
                                                        : 'border-border-strong dark:border-border-dark-strong'
                                                )}>
                                                    {activeTab === 'done' && <CheckIcon className="w-4 h-4" aria-hidden="true" />}
                                                </span>
                                            </button>
                                        }
                                        title={
                                            <span className={cn(activeTab === 'done' && 'line-through text-text-secondary dark:text-text-dark-secondary')}>
                                                {item.title}
                                            </span>
                                        }
                                        subtitle={item.dueDate ? `Frist: ${new Date(item.dueDate).toLocaleDateString('da-DK')}` : undefined}
                                        trailing={
                                            <>
                                                <StatusChip status={item.status} />
                                                <button
                                                    type="button"
                                                    onClick={() => handleGoToItem(item)}
                                                    aria-label={`Åbn emne: ${item.title}`}
                                                    title="Åbn emne"
                                                    className="flex w-11 h-11 -mr-1.5 items-center justify-center rounded-full text-text-secondary hover:text-brand-primary hover:bg-bg-muted dark:text-text-dark-secondary dark:hover:text-brand-light dark:hover:bg-bg-dark-muted transition-colors duration-150"
                                                >
                                                    <ArrowUpRightIcon className="w-5 h-5" aria-hidden="true" />
                                                </button>
                                            </>
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
      )}
    </div>
  );
};

export default FollowUpTabContent;
