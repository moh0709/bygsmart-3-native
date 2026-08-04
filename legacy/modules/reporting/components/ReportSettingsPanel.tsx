import React, { useState, useEffect } from 'react';
import type { AcceptanceReportSettings } from '../../../types';
import { getReportSettings, saveReportSettings } from '../../field';
import { useToast } from '../../../contexts/ToastContext';
import { SlidersIcon } from '../../../components/icons';

interface Props {
    projectId: string;
}

const SECTIONS: { key: keyof AcceptanceReportSettings; label: string; description: string }[] = [
    { key: 'showBranding',       label: 'Firmabranding (navn, CVR)',        description: 'Firma-/bygherrenavn og CVR-nummer øverst på rapporten' },
    { key: 'showReportId',       label: 'Rapport-ID, dato & projektnr.',    description: 'Sporbarhed: unikt ID, genereringsdato og projektnummer' },
    { key: 'showVat',            label: 'Aftalt pris + moms-specifikation', description: 'Aftalt pris med ekskl./inkl. moms-opbygning' },
    { key: 'showTime',           label: 'Tidsforbrug (session + pr. dag)',   description: 'Samlet tid, per-session-tabel og dagsoversigt' },
    { key: 'showDocumentation',  label: 'Dokumentation (med fotos)',         description: 'Fotothumbnails og dokumentationsreferencer' },
    { key: 'showSnagList',       label: 'Mangelliste',                       description: 'Registrerede fejl/mangler ved overdragelse' },
    { key: 'showWarranty',       label: 'Garanti & AB18-tekst',              description: 'Standard garantiafsnit med reference til AB18' },
    { key: 'showSignatures',     label: 'Digitale underskrifter',            description: 'Indlejrede underskrifter fra begge parter' },
    { key: 'showQualityControl', label: 'Kvalitetssikring (KS)',             description: 'KS-kontroller, resultater og registrerede afvigelser med fotos' },
];

const DEFAULT_SETTINGS: AcceptanceReportSettings = {
    showBranding: true,
    showReportId: true,
    showVat: true,
    showTime: true,
    showDocumentation: true,
    showSnagList: true,
    showWarranty: true,
    showSignatures: true,
    showQualityControl: true,
};

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
    <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${on ? 'bg-brand-primary' : 'bg-gray-300'}`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${on ? 'translate-x-6' : 'translate-x-1'}`}
        />
    </button>
);

const ReportSettingsPanel: React.FC<Props> = ({ projectId }) => {
    const { showToast } = useToast();
    const [settings, setSettings] = useState<AcceptanceReportSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getReportSettings(projectId).then(s => {
            if (!cancelled) { setSettings(s); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, [projectId]);

    const toggle = (key: keyof AcceptanceReportSettings) =>
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveReportSettings(projectId, settings);
            showToast('Rapportindstillinger gemt', 'success');
        } catch (err: any) {
            showToast(err?.message ?? 'Kunne ikke gemme indstillinger', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-card border border-gray-200 p-5 max-w-lg">
            <div className="flex items-center gap-2.5 mb-1">
                <SlidersIcon className="w-5 h-5 text-brand-primary flex-shrink-0" />
                <h3 className="font-bold text-base text-text-primary">Indstillinger for afleveringsrapport</h3>
            </div>
            <p className="text-xs text-text-secondary mb-5">
                Kun synlig for mester / projektejer · Gælder hele projektet
            </p>

            <div className="space-y-1">
                {SECTIONS.map(({ key, label, description }) => (
                    <div
                        key={key}
                        className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0"
                    >
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text-primary leading-snug">{label}</p>
                            <p className="text-xs text-text-secondary mt-0.5 leading-snug">{description}</p>
                        </div>
                        <div className="flex-shrink-0 mt-0.5">
                            <Toggle on={settings[key]} onChange={() => toggle(key)} />
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="mt-5 w-full py-2.5 bg-brand-primary text-white rounded-xl font-bold text-sm disabled:opacity-60 hover:bg-blue-600 transition-colors"
            >
                {saving ? 'Gemmer...' : 'Gem indstillinger'}
            </button>
        </div>
    );
};

export default ReportSettingsPanel;
