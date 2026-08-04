import {
    ProjectBudgetCategory, ProjectBudgetSummary, ProjectBudgetRevision, ProjectBudgetRevisionCategoryDelta,
} from '../../../types';
import { supabase } from '../../../services/supabaseClient';

// --- PROJECT BUDGET ---
// Single source of truth for "actual spend" lives in the get_project_budget_summary
// RPC (purchases by status + labor hours×rate + subcontractor settlements).
// projects.budget stays in sync as a cached mirror for readers not yet migrated
// onto this richer summary (projectIntelligence.ts, ProjectDetailsTabContent.tsx).

export const BUDGET_CATEGORIES: ProjectBudgetCategory[] = ['materials', 'labor', 'subcontractors', 'other'];

const mapBudgetSummary = (row: {
    has_baseline: boolean;
    planned_total_kr: number;
    planned_materials_kr: number;
    planned_labor_kr: number;
    planned_subcontractors_kr: number;
    planned_other_kr: number;
    labor_rate_dkk_per_hour: number | null;
    actual_purchases_forecast_kr: number;
    actual_purchases_committed_kr: number;
    actual_purchases_received_kr: number;
    actual_labor_kr: number;
    actual_subcontractors_kr: number;
    actual_total_kr: number;
    remaining_kr: number;
    forecast_total_kr: number;
}): ProjectBudgetSummary => ({
    hasBaseline: row.has_baseline,
    plannedTotalKr: Number(row.planned_total_kr),
    plannedByCategory: {
        materials: Number(row.planned_materials_kr),
        labor: Number(row.planned_labor_kr),
        subcontractors: Number(row.planned_subcontractors_kr),
        other: Number(row.planned_other_kr),
    },
    laborRateDkkPerHour: row.labor_rate_dkk_per_hour === null ? null : Number(row.labor_rate_dkk_per_hour),
    actualPurchasesForecastKr: Number(row.actual_purchases_forecast_kr),
    actualPurchasesCommittedKr: Number(row.actual_purchases_committed_kr),
    actualPurchasesReceivedKr: Number(row.actual_purchases_received_kr),
    actualLaborKr: Number(row.actual_labor_kr),
    actualSubcontractorsKr: Number(row.actual_subcontractors_kr),
    actualTotalKr: Number(row.actual_total_kr),
    remainingKr: Number(row.remaining_kr),
    forecastTotalKr: Number(row.forecast_total_kr),
});

export const getProjectBudgetSummary = async (projectId: string): Promise<ProjectBudgetSummary | null> => {
    const { data, error } = await (supabase as any).rpc('get_project_budget_summary', { p_project_id: projectId });
    if (error) { console.error('getProjectBudgetSummary error:', error); return null; }
    return data && data.length > 0 ? mapBudgetSummary(data[0]) : null;
};

export const createProjectBudgetBaseline = async (
    projectId: string,
    categories: { category: ProjectBudgetCategory; amountKr: number; note?: string }[],
    laborRateDkk?: number
): Promise<string> => {
    const { data, error } = await (supabase as any).rpc('create_project_budget_baseline', {
        p_project_id: projectId,
        p_categories: categories.map(c => ({ category: c.category, amount_kr: c.amountKr, note: c.note ?? null })),
        p_labor_rate_dkk: laborRateDkk ?? null,
    });
    if (error) { console.error('createProjectBudgetBaseline error:', error); throw error; }
    return data as string;
};

export const createProjectBudgetRevision = async (
    projectId: string,
    reason: string,
    categoryDeltas: ProjectBudgetRevisionCategoryDelta[]
): Promise<string> => {
    const { data, error } = await (supabase as any).rpc('create_project_budget_revision', {
        p_project_id: projectId,
        p_reason: reason,
        p_category_deltas: categoryDeltas.map(d => ({ category: d.category, delta_kr: d.deltaKr })),
    });
    if (error) { console.error('createProjectBudgetRevision error:', error); throw error; }
    return data as string;
};

export const updateProjectLaborRate = async (projectId: string, rateDkk: number): Promise<void> => {
    const { error } = await (supabase as any).rpc('update_project_labor_rate', { p_project_id: projectId, p_rate_dkk: rateDkk });
    if (error) { console.error('updateProjectLaborRate error:', error); throw error; }
};

export const getProjectBudgetRevisions = async (projectId: string): Promise<ProjectBudgetRevision[]> => {
    const { data: budget, error: budgetError } = await supabase
        .from('project_budgets')
        .select('id')
        .eq('project_id', projectId)
        .maybeSingle();
    if (budgetError || !budget) {
        if (budgetError) console.error('getProjectBudgetRevisions error:', budgetError);
        return [];
    }

    const { data, error } = await supabase
        .from('project_budget_revisions')
        .select('id, revision_number, reason, total_delta_kr, created_by, created_at, project_budget_revision_categories(category, delta_kr)')
        .eq('project_budget_id', budget.id)
        .order('revision_number', { ascending: false });
    if (error) { console.error('getProjectBudgetRevisions error:', error); return []; }

    return (data ?? []).map((r: any) => ({
        id: r.id,
        revisionNumber: r.revision_number,
        reason: r.reason,
        totalDeltaKr: Number(r.total_delta_kr),
        categoryDeltas: (r.project_budget_revision_categories ?? []).map((c: any) => ({
            category: c.category as ProjectBudgetCategory,
            deltaKr: Number(c.delta_kr),
        })),
        createdBy: r.created_by,
        createdAt: r.created_at,
    }));
};

export const getTaskBudgetRates = async (projectId: string): Promise<Record<string, number>> => {
    const { data, error } = await supabase
        .from('task_budget_rates')
        .select('task_id, hourly_rate_dkk')
        .eq('project_id', projectId);
    if (error) { console.error('getTaskBudgetRates error:', error); return {}; }
    return Object.fromEntries((data ?? []).map(r => [r.task_id, Number(r.hourly_rate_dkk)]));
};

export const updateTaskHourlyRate = async (taskId: string, rateDkk: number | null): Promise<void> => {
    const { error } = await (supabase as any).rpc('update_task_hourly_rate', { p_task_id: taskId, p_rate_dkk: rateDkk });
    if (error) { console.error('updateTaskHourlyRate error:', error); throw error; }
};
