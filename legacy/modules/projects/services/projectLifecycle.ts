import { supabase } from '../../../services/supabaseClient';

// --- PROJECT LIFECYCLE ---

export const closeProject = async (projectId: string): Promise<void> => {
    const { error } = await supabase
        .from('projects')
        .update({ status: 'Afsluttet' })
        .eq('id', projectId);
    if (error) console.error('closeProject error:', error);
};

export const archiveProject = async (projectId: string): Promise<void> => {
    const { error } = await supabase
        .from('projects')
        .update({ status: 'ARCHIVED' })
        .eq('id', projectId);
    if (error) console.error('archiveProject error:', error);
};

export const cancelProject = async (projectId: string): Promise<void> => {
    const { error } = await supabase
        .from('projects')
        .update({ status: 'CANCELLED' })
        .eq('id', projectId);
    if (error) console.error('cancelProject error:', error);
};

export const reopenProject = async (projectId: string): Promise<void> => {
    // Only Afsluttet and ARCHIVED are reversible — CANCELLED is a terminal state.
    const { error } = await supabase
        .from('projects')
        .update({ status: 'I gang' })
        .eq('id', projectId)
        .in('status', ['Afsluttet', 'ARCHIVED']);
    if (error) {
        console.error('reopenProject error:', error);
        throw error;
    }
};
