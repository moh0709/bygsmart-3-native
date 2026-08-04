import { AcceptanceReportSettings } from '../../../../types';
import { supabase } from '../../../../services/supabaseClient';

// ---------------------------------------------------------------------------
// REPORT SETTINGS
// ---------------------------------------------------------------------------

const DEFAULT_REPORT_SETTINGS: AcceptanceReportSettings = {
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

export const getReportSettings = async (projectId: string): Promise<AcceptanceReportSettings> => {
    const { data, error } = await supabase
        .from('projects')
        .select('acceptance_report_settings')
        .eq('id', projectId)
        .single();
    if (error || !data) return { ...DEFAULT_REPORT_SETTINGS };
    const raw = (data as any).acceptance_report_settings;
    if (!raw) return { ...DEFAULT_REPORT_SETTINGS };
    return { ...DEFAULT_REPORT_SETTINGS, ...raw } as AcceptanceReportSettings;
};

/** Only owner/manager may save settings (enforced by RLS on projects). */
export const saveReportSettings = async (
    projectId: string,
    settings: AcceptanceReportSettings
): Promise<void> => {
    const { error } = await supabase
        .from('projects')
        .update({ acceptance_report_settings: settings as any } as any)
        .eq('id', projectId);
    if (error) {
        console.error('saveReportSettings error:', error);
        throw new Error(error.message);
    }
};
