/**
 * Excel export helpers (SheetJS / xlsx).
 *
 * Three entry points:
 *  - exportTaskToExcel      → Opgave | Tidsregistrering | Dokumentation
 *  - exportProjectToExcel   → Resumé | Opgave | Tidsregistrering | Dokumentation | Partnere
 *  - exportTimeEntriesToExcel → Tidsregistrering (for the time-management log view)
 *
 * All labels and date formatting use da-DK conventions.
 */

import * as XLSX from 'xlsx';
import type { Task, TimeEntry, TaskDocumentationItem, Project, PartnerInvite } from '../../../types';

export interface PartnerExportStats {
    inviteId: string;
    totalTimeLoggedHours: number;
    doneTaskCount: number;
}

// ── Formatting (da-DK) ───────────────────────────────────────────────────────

const fmtDate = (iso?: string | null): string => {
    if (!iso) return '–';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '–';
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtNum = (n: number, decimals = 2): number =>
    parseFloat(n.toFixed(decimals));

const fmtOre = (ore: number | null | undefined): string => {
    if (ore == null) return '–';
    const kr = ore / 100;
    return kr.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr.';
};

const kindLabel: Record<string, string> = {
    text: 'Note', audio: 'Lyd', link: 'Link', file: 'Fil', photo: 'Foto', report: 'Rapport',
};

// ── Utilities ────────────────────────────────────────────────────────────────

/** Set column widths based on content. */
const autoFit = (ws: XLSX.WorkSheet, rows: unknown[][]): void => {
    if (!rows.length) return;
    const widths = rows[0].map((_, ci) =>
        Math.min(60, Math.max(12, ...rows.map(r => String(r[ci] ?? '').length)))
    );
    ws['!cols'] = widths.map(w => ({ wch: w }));
};

/** Style the first row as a bold header row. */
const styleHeader = (ws: XLSX.WorkSheet, cols: number): void => {
    for (let c = 0; c < cols; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (!ws[addr]) continue;
        ws[addr].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '1E5FFF' } },
            alignment: { horizontal: 'left' },
        };
    }
};

const addSheet = (wb: XLSX.WorkBook, name: string, rows: unknown[][]): void => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    autoFit(ws, rows);
    styleHeader(ws, rows[0]?.length ?? 0);
    XLSX.utils.book_append_sheet(wb, ws, name);
};

const safeFilename = (s: string): string =>
    s.replace(/[^a-zA-Z0-9æøåÆØÅ._-]/g, '_').substring(0, 50);

// ── Export: single task ──────────────────────────────────────────────────────

export const exportTaskToExcel = (
    task: Task,
    timeEntries: TimeEntry[],
    documentation: Pick<TaskDocumentationItem, 'kind' | 'body' | 'storagePath' | 'mimeType' | 'authorName' | 'createdAt'>[],
): void => {
    const wb = XLSX.utils.book_new();

    // Sheet 1 – Opgave
    const taskRows: unknown[][] = [
        ['Felt', 'Værdi'],
        ['Titel', task.title ?? ''],
        ['Status', task.status ?? ''],
        ['Forfaldsdato', fmtDate(task.dueDate)],
        ['Ansvarlig', (task.assignees ?? []).map(a => a.name).join(', ') || '–'],
        ['Beskrivelse', task.description ?? ''],
        ['Estimerede timer', task.estimatedHours ?? 0],
        ['Milepæl', task.isMilestone ? 'Ja' : 'Nej'],
        ['Aflevering', task.handoverStatus ?? 'none'],
        ['Færdiggjort', fmtDate(task.completedAt)],
    ];
    if (task.checklist && task.checklist.length > 0) {
        taskRows.push(['', ''], ['Tjekliste', '']);
        task.checklist.forEach(item =>
            taskRows.push([item.checked ? '✓' : '○', item.text])
        );
    }
    addSheet(wb, 'Opgave', taskRows);

    // Sheet 2 – Tidsregistrering
    const totalHours = timeEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
    const timeRows: unknown[][] = [
        ['Dato', 'Medarbejder', 'Timer', 'Beskrivelse'],
        ...timeEntries.map(e => [fmtDate(e.date), e.userName ?? '', fmtNum(e.hours), e.description ?? '']),
        ['I alt', '', fmtNum(totalHours), ''],
    ];
    addSheet(wb, 'Tidsregistrering', timeRows);

    // Sheet 3 – Dokumentation
    const docRows: unknown[][] = [
        ['Type', 'Dato', 'Forfatter', 'Indhold', 'Filsti'],
        ...documentation.map(d => [
            kindLabel[d.kind] ?? d.kind,
            fmtDate(d.createdAt),
            d.authorName ?? '',
            d.body ?? '',
            d.storagePath ?? '',
        ]),
    ];
    if (docRows.length === 1) docRows.push(['Ingen dokumentation', '', '', '', '']);
    addSheet(wb, 'Dokumentation', docRows);

    XLSX.writeFile(wb, `opgave_${safeFilename(task.title)}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ── Export: full project ─────────────────────────────────────────────────────

export const exportProjectToExcel = (
    project: Project,
    tasks: Task[],
    timeEntries: TimeEntry[],
    documentation: Pick<TaskDocumentationItem, 'kind' | 'body' | 'storagePath' | 'mimeType' | 'authorName' | 'createdAt' | 'taskId'>[],
    partners: PartnerInvite[],
    partnerStats?: PartnerExportStats[],
): void => {
    const wb = XLSX.utils.book_new();

    const totalHours = timeEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
    const doneTasks = tasks.filter(t => t.status === 'Udført').length;
    const pctDone = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
    const acceptedPartners = partners.filter(p => p.status === 'accepted');
    const totalAgreedOre = acceptedPartners.reduce((s, p) => s + (p.agreedPriceOre ?? 0), 0);

    // Sheet 1 – Resumé
    const resumeRows: unknown[][] = [
        ['Felt', 'Værdi'],
        ['Projektnavn', project.name ?? ''],
        ['Projektnummer', project.projectNumber ?? ''],
        ['Kunde', project.clientName ?? ''],
        ['Status', project.status ?? ''],
        ['Adresse', project.address ?? ''],
        ['Startdato', fmtDate(project.startDate)],
        ['Slutdato', fmtDate(project.endDate)],
        ['', ''],
        ['Totaler', ''],
        ['Registrerede timer', fmtNum(totalHours)],
        ['Aftalt pris (partnere)', fmtOre(totalAgreedOre)],
        ['Opgaver i alt', tasks.length],
        ['Færdige opgaver', doneTasks],
        ['% Færdig', pctDone],
    ];
    addSheet(wb, 'Resumé', resumeRows);

    // Sheet 2 – Opgave
    const taskRows: unknown[][] = [
        ['Trin', 'Titel', 'Status', 'Forfaldsdato', 'Ansvarlig', 'Est. timer', 'Aflevering'],
        ...tasks.map(t => [
            t.step ?? '',
            t.title ?? '',
            t.status ?? '',
            fmtDate(t.dueDate),
            (t.assignees ?? []).map(a => a.name).join(', ') || '–',
            t.estimatedHours ?? 0,
            t.handoverStatus ?? 'none',
        ]),
    ];
    if (taskRows.length === 1) taskRows.push(['', 'Ingen opgaver', '', '', '', '', '']);
    addSheet(wb, 'Opgave', taskRows);

    // Sheet 3 – Tidsregistrering
    const projTotalHours = timeEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
    const timeRows: unknown[][] = [
        ['Dato', 'Medarbejder', 'Timer', 'Beskrivelse', 'Opgave ID'],
        ...timeEntries.map(e => [
            fmtDate(e.date),
            e.userName ?? '',
            fmtNum(e.hours),
            e.description ?? '',
            e.taskId ?? '',
        ]),
        ['I alt', '', fmtNum(projTotalHours), '', ''],
    ];
    if (timeRows.length === 2 && timeEntries.length === 0) timeRows.splice(1, 0, ['Ingen registreringer', '', '', '', '']);
    addSheet(wb, 'Tidsregistrering', timeRows);

    // Sheet 4 – Dokumentation
    const docRows: unknown[][] = [
        ['Type', 'Opgave ID', 'Dato', 'Forfatter', 'Indhold', 'Filsti'],
        ...documentation.map(d => [
            kindLabel[d.kind] ?? d.kind,
            d.taskId ?? '',
            fmtDate(d.createdAt),
            d.authorName ?? '',
            d.body ?? '',
            d.storagePath ?? '',
        ]),
    ];
    if (docRows.length === 1) docRows.push(['Ingen dokumentation', '', '', '', '', '']);
    addSheet(wb, 'Dokumentation', docRows);

    // Sheet 5 – Partnere
    const statsById = new Map<string, PartnerExportStats>(
        (partnerStats ?? []).map(s => [s.inviteId, s])
    );
    const partnerRows: unknown[][] = [
        ['Partner', 'Status', 'Aftalt pris', 'Antal opgaver', 'Udførte opgaver', 'Tid logget (timer)', 'Oprettet', 'Afgjort'],
        ...partners.map(p => {
            const stats = statsById.get(p.id);
            const totalTasks = p.taskCount ?? (p.taskIds?.length ?? 0);
            return [
                p.partnerName ?? p.partnerId,
                p.status,
                fmtOre(p.agreedPriceOre),
                totalTasks,
                stats?.doneTaskCount ?? '–',
                stats != null ? fmtNum(stats.totalTimeLoggedHours) : '–',
                fmtDate(p.createdAt),
                fmtDate(p.settledAt),
            ];
        }),
    ];
    if (partnerRows.length === 1) partnerRows.push(['Ingen partnere', '', '', '', '', '', '', '']);
    addSheet(wb, 'Partnere', partnerRows);

    XLSX.writeFile(wb, `projekt_${safeFilename(project.projectNumber || project.name)}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ── Export: time entries only (time-management log view) ─────────────────────

export const exportTimeEntriesToExcel = (
    timeEntries: TimeEntry[],
    projectName?: string,
): void => {
    const wb = XLSX.utils.book_new();
    const totalHours = timeEntries.reduce((s, e) => s + (e.hours ?? 0), 0);

    const timeRows: unknown[][] = [
        ['Dato', 'Medarbejder', 'Timer', 'Beskrivelse', 'Opgave ID'],
        ...timeEntries.map(e => [
            fmtDate(e.date),
            e.userName ?? '',
            fmtNum(e.hours),
            e.description ?? '',
            e.taskId ?? '',
        ]),
        ['I alt', '', fmtNum(totalHours), '', ''],
    ];
    if (timeEntries.length === 0) timeRows.splice(1, 0, ['Ingen registreringer', '', '', '', '']);
    addSheet(wb, 'Tidsregistrering', timeRows);

    const suffix = projectName ? safeFilename(projectName) + '_' : '';
    XLSX.writeFile(wb, `tidsregistrering_${suffix}${new Date().toISOString().split('T')[0]}.xlsx`);
};
