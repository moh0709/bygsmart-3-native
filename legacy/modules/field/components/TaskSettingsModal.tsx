import React, { useState } from 'react';
import type { Task } from '../../../types';
import { Alert, Button, Modal, SegmentedControl } from '../../../components/ui';
import { SettingsIcon } from '../../../components/icons';
import { setTaskDisabledTabs } from '../../tasks';
import { ReportSettingsPanel } from '../../reporting';
import { ModuleGate } from '../../../core/entitlements/ModuleGate';
import { ALWAYS_ON_TAB_IDS, WORKSPACE_TABS } from '../pages/TaskDetailPage/constants';
import type { TabId } from '../pages/TaskDetailPage/constants';

type SettingsSection = 'faner' | 'rapport';

const CONFIGURABLE_TABS = WORKSPACE_TABS.filter(t => !ALWAYS_ON_TAB_IDS.includes(t.id as TabId));

// ─── Task Settings Modal ──────────────────────────────────────────────────────
// Opened via the gear icon in TaskWorkspaceContent's header, owner/responsible
// only. "Faner" controls which tabs are visible for THIS task instance;
// "Rapport" is the existing project-wide ReportSettingsPanel, relocated here
// (it configures acceptance-report PDF sections — a project policy, not a
// per-task preference, so it stays keyed off task.projectId, not the task).

export const TaskSettingsModal: React.FC<{
    task: Task;
    onClose: () => void;
    onSaved: () => void;
}> = ({ task, onClose, onSaved }) => {
    const [section, setSection] = useState<SettingsSection>('faner');
    const [disabled, setDisabled] = useState<string[]>(task.disabledTabs ?? []);
    const [saving, setSaving] = useState(false);

    const toggle = (tabId: string) => {
        setDisabled(prev => prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setTaskDisabledTabs(task.id, disabled);
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={
                <span className="inline-flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-brand-primary" />
                    Indstillinger
                </span>
            }
            footer={
                section === 'faner' ? (
                    <>
                        <Button variant="ghost" onClick={onClose}>Annuller</Button>
                        <Button onClick={handleSave} loading={saving}>Gem</Button>
                    </>
                ) : (
                    <Button variant="outline" fullWidth onClick={onClose}>Luk</Button>
                )
            }
        >
            <div className="space-y-4">
                <SegmentedControl<SettingsSection>
                    label="Indstillingssektion"
                    value={section}
                    onChange={setSection}
                    options={[
                        { label: 'Faner', value: 'faner' },
                        { label: 'Rapport', value: 'rapport' },
                    ]}
                />

                {section === 'faner' && (
                    <div className="space-y-1">
                        <p className="mb-2 text-caption text-text-secondary dark:text-text-dark-secondary">
                            Skjul faner der ikke er relevante for denne opgave. Overblik og Chat kan ikke skjules.
                        </p>
                        {CONFIGURABLE_TABS.map(tab => (
                            <label key={tab.id} className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
                                <input
                                    type="checkbox"
                                    checked={!disabled.includes(tab.id)}
                                    onChange={() => toggle(tab.id)}
                                    className="h-5 w-5 cursor-pointer rounded border-border-strong accent-brand-primary dark:border-border-dark-strong"
                                />
                                <span className="text-label text-text-primary dark:text-text-dark-primary">{tab.label}</span>
                            </label>
                        ))}
                    </div>
                )}

                {section === 'rapport' && (
                    task.projectId ? (
                        <ModuleGate moduleId="reporting" mode="upsell">
                            <ReportSettingsPanel projectId={task.projectId} />
                        </ModuleGate>
                    ) : (
                        <Alert variant="info" title="Rapportindstillinger">
                            Rapportindstillinger er ikke tilgængelige for opgaver uden et projekt.
                        </Alert>
                    )
                )}
            </div>
        </Modal>
    );
};
