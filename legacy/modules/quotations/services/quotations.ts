import { Quotation, QuotationLineItem, QuotationStatus, QuotationLineKind, PurchaseItem } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import type { Database } from '../../../services/database.types';

// --- QUOTATIONS ---

type QuotationRow = Database['public']['Tables']['quotations']['Row'];
type QuotationLineItemRow = Database['public']['Tables']['quotation_line_items']['Row'];

const QUOTATION_COLUMNS =
    'id, project_id, number, title, client_name, status, currency, vat_rate, valid_until, notes, subtotal, vat_total, total, created_by, created_at, updated_at';
const QUOTATION_LINE_ITEM_COLUMNS =
    'id, quotation_id, kind, description, quantity, unit, unit_price, line_total, source, created_at';

const mapQuotation = (q: QuotationRow): Quotation => ({
    id: q.id,
    projectId: q.project_id,
    number: q.number,
    title: q.title,
    clientName: q.client_name ?? '',
    status: q.status as QuotationStatus,
    currency: q.currency,
    vatRate: Number(q.vat_rate),
    validUntil: q.valid_until ?? undefined,
    notes: q.notes ?? undefined,
    subtotal: Number(q.subtotal),
    vatTotal: Number(q.vat_total),
    total: Number(q.total),
    createdBy: q.created_by,
    createdAt: q.created_at,
    updatedAt: q.updated_at,
});

const mapLineItem = (l: QuotationLineItemRow): QuotationLineItem => ({
    id: l.id,
    quotationId: l.quotation_id,
    kind: l.kind as QuotationLineKind,
    description: l.description,
    quantity: Number(l.quantity),
    unit: l.unit ?? undefined,
    unitPrice: Number(l.unit_price),
    lineTotal: Number(l.line_total),
    source: l.source ?? undefined,
    createdAt: l.created_at,
});

const computeTotals = (items: QuotationLineItem[], vatRate: number) => {
    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const vatTotal = Math.round(subtotal * vatRate) / 100;
    const total = subtotal + vatTotal;
    return { subtotal, vatTotal, total };
};

export const getQuotationsForProject = async (projectId: string): Promise<Quotation[]> => {
    const { data, error } = await supabase
        .from('quotations')
        .select(QUOTATION_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (error) { console.error('getQuotationsForProject error:', error); return []; }
    return (data ?? []).map(mapQuotation);
};

export const getQuotationById = async (id: string): Promise<Quotation | undefined> => {
    const { data: quotationData, error: qError } = await supabase
        .from('quotations')
        .select(QUOTATION_COLUMNS)
        .eq('id', id)
        .maybeSingle();
    if (qError || !quotationData) { console.error('getQuotationById error:', qError); return undefined; }

    const { data: lineData, error: lError } = await supabase
        .from('quotation_line_items')
        .select(QUOTATION_LINE_ITEM_COLUMNS)
        .eq('quotation_id', id)
        .order('created_at', { ascending: true });
    if (lError) { console.error('getQuotationById line items error:', lError); }

    const quotation = mapQuotation(quotationData);
    quotation.lineItems = (lineData ?? []).map(mapLineItem);
    return quotation;
};

export const createQuotation = async (projectId: string, data: {
    title: string;
    clientName?: string;
    currency?: string;
    vatRate?: number;
    validUntil?: string;
    notes?: string;
    createdBy: string;
}): Promise<Quotation> => {
    const projectQuotations = await getQuotationsForProject(projectId);
    const nextNumber = `TIL-${new Date().getFullYear()}-${String(projectQuotations.length + 1).padStart(3, '0')}`;

    const { data: inserted, error } = await supabase
        .from('quotations')
        .insert({
            project_id: projectId,
            number: nextNumber,
            title: data.title,
            client_name: data.clientName ?? null,
            currency: data.currency ?? 'DKK',
            vat_rate: data.vatRate ?? 25,
            valid_until: data.validUntil ?? null,
            notes: data.notes ?? null,
            created_by: data.createdBy,
            subtotal: 0,
            vat_total: 0,
            total: 0,
        })
        .select()
        .single();
    if (error) { console.error('createQuotation error:', error); throw error; }
    return mapQuotation(inserted);
};

export const updateQuotation = async (id: string, data: Partial<Pick<Quotation, 'title' | 'clientName' | 'currency' | 'vatRate' | 'validUntil' | 'notes'>>): Promise<void> => {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updates.title = data.title;
    if (data.clientName !== undefined) updates.client_name = data.clientName;
    if (data.currency !== undefined) updates.currency = data.currency;
    if (data.vatRate !== undefined) updates.vat_rate = data.vatRate;
    if (data.validUntil !== undefined) updates.valid_until = data.validUntil || null;
    if (data.notes !== undefined) updates.notes = data.notes || null;

    const { error } = await supabase.from('quotations').update(updates).eq('id', id);
    if (error) { console.error('updateQuotation error:', error); throw error; }

    if (data.vatRate !== undefined) {
        await _recomputeQuotationTotals(id);
    }
};

export const updateQuotationStatus = async (id: string, status: QuotationStatus): Promise<void> => {
    const { error } = await supabase
        .from('quotations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
    if (error) { console.error('updateQuotationStatus error:', error); throw error; }
};

export const deleteQuotation = async (id: string): Promise<void> => {
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) { console.error('deleteQuotation error:', error); throw error; }
};

const _recomputeQuotationTotals = async (quotationId: string): Promise<void> => {
    const { data: quotationData } = await supabase
        .from('quotations')
        .select('vat_rate')
        .eq('id', quotationId)
        .maybeSingle();
    if (!quotationData) return;

    const { data: items } = await supabase
        .from('quotation_line_items')
        .select('line_total')
        .eq('quotation_id', quotationId);

    const vatRate = Number(quotationData.vat_rate);
    const mapped = (items ?? []).map(i => ({ lineTotal: Number(i.line_total) } as QuotationLineItem));
    const { subtotal, vatTotal, total } = computeTotals(mapped, vatRate);

    await supabase
        .from('quotations')
        .update({ subtotal, vat_total: vatTotal, total, updated_at: new Date().toISOString() })
        .eq('id', quotationId);
};

export const addLineItem = async (quotationId: string, item: {
    kind: QuotationLineKind;
    description: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    source?: string;
}): Promise<QuotationLineItem> => {
    const lineTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    const { data, error } = await supabase
        .from('quotation_line_items')
        .insert({
            quotation_id: quotationId,
            kind: item.kind,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit ?? null,
            unit_price: item.unitPrice,
            line_total: lineTotal,
            source: item.source ?? null,
        })
        .select()
        .single();
    if (error) { console.error('addLineItem error:', error); throw error; }
    await _recomputeQuotationTotals(quotationId);
    return mapLineItem(data);
};

export const updateLineItem = async (item: QuotationLineItem): Promise<void> => {
    const lineTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    const { error } = await supabase
        .from('quotation_line_items')
        .update({
            kind: item.kind,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit ?? null,
            unit_price: item.unitPrice,
            line_total: lineTotal,
            source: item.source ?? null,
        })
        .eq('id', item.id);
    if (error) { console.error('updateLineItem error:', error); throw error; }
    await _recomputeQuotationTotals(item.quotationId);
};

export const deleteLineItem = async (id: string, quotationId: string): Promise<void> => {
    const { error } = await supabase.from('quotation_line_items').delete().eq('id', id);
    if (error) { console.error('deleteLineItem error:', error); throw error; }
    await _recomputeQuotationTotals(quotationId);
};

export const addLineItemFromPurchase = async (quotationId: string, purchase: PurchaseItem): Promise<QuotationLineItem> => {
    return addLineItem(quotationId, {
        kind: 'MATERIAL',
        description: purchase.supplier
            ? `${purchase.name} (${purchase.supplier})`
            : purchase.name,
        quantity: purchase.quantity,
        unit: 'stk',
        unitPrice: purchase.price,
        source: `purchase:${purchase.id}`,
    });
};
