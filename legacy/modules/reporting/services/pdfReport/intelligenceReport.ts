import jsPDF from 'jspdf';
import { Project, Task, PurchaseItem, ProjectBudgetSummary, ProjectBudgetCategory } from '../../../../types';
import { IntelligenceIndex, IndexFeedback } from '../../../ai';
import { BRAND, TEXT_DARK, TEXT_MUTED, ZEBRA, WARNING, DANGER, PAGE_W, PAGE_H, MARGIN, CONTENT_W, bandColor } from './theme';
import { formatNumber, formatDkk, formatDate } from './format';
import { Cursor, ensureSpace, addWrappedText, sectionHeader, drawFooters } from './primitives';
import { TableColumn, drawTable } from './table';

// ── Cover page ───────────────────────────────────────────────────────────────

const drawCover = (
  doc: jsPDF,
  project: Project,
  index: IntelligenceIndex,
  generatedBy?: string
): void => {
  // Brand color bar.
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, PAGE_W, 10, 'F');

  // Wordmark.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text('BygSmart', MARGIN, 110);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text('Intelligensrapport', MARGIN, 130);

  // Project name + metadata.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const nameLines: string[] = doc.splitTextToSize(project.name || 'Uden navn', CONTENT_W);
  let y = 210;
  nameLines.forEach(line => {
    doc.text(line, MARGIN, y);
    y += 30;
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  const metaLines = [
    project.clientName ? `Kunde: ${project.clientName}` : null,
    project.address ? `Adresse: ${project.address}` : null,
    `Periode: ${formatDate(project.startDate)} – ${formatDate(project.endDate)}`,
    `Rapportdato: ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  ].filter((l): l is string => !!l);
  metaLines.forEach(line => {
    doc.text(line, MARGIN, y);
    y += 18;
  });

  // Large grade badge.
  const color = bandColor(index.overall);
  const cx = PAGE_W / 2;
  const cy = y + 150;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.circle(cx, cy, 64, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(64);
  doc.setTextColor(255, 255, 255);
  doc.text(index.grade, cx, cy + 22, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(`${index.overall} / 100`, cx, cy + 100, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text('Samlet intelligensindeks', cx, cy + 118, { align: 'center' });

  if (generatedBy) {
    doc.setFontSize(10);
    doc.text(`Genereret af ${generatedBy}`, MARGIN, PAGE_H - 70);
  }
};

// ── Public API ───────────────────────────────────────────────────────────────

export interface IntelligenceReportParams {
  project: Project;
  tasks: Task[];
  purchases: PurchaseItem[];
  index: IntelligenceIndex;
  feedback?: IndexFeedback | null;
  generatedBy?: string;
  /** Planned-vs-actual-by-category budget section. Falls back to the single
   *  ratio sentence (project.budget.total vs. purchases) when omitted/no baseline. */
  budgetSummary?: ProjectBudgetSummary | null;
}

const BUDGET_CATEGORY_LABELS: Record<ProjectBudgetCategory, string> = {
  materials: 'Materialer',
  labor: 'Arbejdsløn',
  subcontractors: 'Underleverandører',
  other: 'Andet',
};

/**
 * Builds the full intelligence report as a vector PDF.
 * Returns the jsPDF instance — caller decides filename: `doc.save(...)`.
 */
export const generateIntelligenceReport = (params: IntelligenceReportParams): jsPDF => {
  const { project, tasks, purchases, index, feedback, generatedBy, budgetSummary } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const cursor: Cursor = { y: MARGIN };

  // 1) Cover.
  drawCover(doc, project, index, generatedBy);
  doc.addPage();
  cursor.y = MARGIN;

  // 2) Intelligence index.
  sectionHeader(doc, cursor, 'Intelligensindeks');
  addWrappedText(
    doc,
    cursor,
    `Samlet score: ${index.overall}/100 — karakter ${index.grade}. Indekset er beregnet deterministisk ud fra projektets opgaver, budget, tidsplan, dokumentation og bemanding.`,
    { size: 10, color: TEXT_MUTED, spacingAfter: 10 }
  );

  const BAR_W = 180;
  index.dimensions.forEach(dim => {
    ensureSpace(doc, cursor, 26);
    // Label + weight.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(dim.label, MARGIN, cursor.y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(`vægt ${dim.weight} %`, MARGIN + 150, cursor.y + 8);

    // Score bar (filled rects).
    const barX = MARGIN + CONTENT_W - BAR_W - 40;
    doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
    doc.rect(barX, cursor.y, BAR_W, 10, 'F');
    const color = bandColor(dim.score);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(barX, cursor.y, (BAR_W * Math.max(0, Math.min(100, dim.score))) / 100, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(String(dim.score), barX + BAR_W + 10, cursor.y + 8);
    cursor.y += 18;

    // Drivers as bullets.
    dim.drivers.forEach(driver => {
      addWrappedText(doc, cursor, driver, {
        x: MARGIN + 8,
        size: 9,
        color: TEXT_MUTED,
        bullet: true,
      });
    });
    cursor.y += 8;
  });
  cursor.y += 6;

  // 3) Recommendations.
  sectionHeader(doc, cursor, 'Anbefalinger');
  if (feedback) {
    addWrappedText(doc, cursor, feedback.summary, { size: 10, spacingAfter: 10 });

    feedback.topActions.forEach((action, i) => {
      const impactLabel =
        action.impact === 'høj' ? 'HØJ EFFEKT' : action.impact === 'lav' ? 'LAV EFFEKT' : 'MELLEM EFFEKT';
      const impactColor = action.impact === 'høj' ? DANGER : action.impact === 'lav' ? TEXT_MUTED : WARNING;
      ensureSpace(doc, cursor, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.text(`${i + 1}. ${action.title}`, MARGIN, cursor.y);
      doc.setFontSize(7);
      doc.setTextColor(impactColor[0], impactColor[1], impactColor[2]);
      doc.text(impactLabel, PAGE_W - MARGIN, cursor.y, { align: 'right' });
      cursor.y += 14;
      if (action.why) {
        addWrappedText(doc, cursor, action.why, { x: MARGIN + 14, size: 9, color: TEXT_MUTED, spacingAfter: 6 });
      }
    });

    if (feedback.risks.length > 0) {
      cursor.y += 6;
      ensureSpace(doc, cursor, 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(DANGER[0], DANGER[1], DANGER[2]);
      doc.text('Risici', MARGIN, cursor.y);
      cursor.y += 14;
      feedback.risks.forEach(risk => {
        addWrappedText(doc, cursor, risk, { x: MARGIN + 4, size: 9, bullet: true });
      });
    }
  } else {
    addWrappedText(doc, cursor, 'Ingen AI-anbefalinger tilgængelige for denne rapport.', {
      size: 10,
      color: TEXT_MUTED,
    });
  }
  cursor.y += 14;

  // 4) Tasks table.
  sectionHeader(doc, cursor, `Opgaver (${tasks.length})`);
  if (tasks.length === 0) {
    addWrappedText(doc, cursor, 'Ingen opgaver registreret på projektet.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    const taskColumns: TableColumn[] = [
      { header: 'Titel', width: 219 },
      { header: 'Status', width: 90 },
      { header: 'Ansvarlig', width: 110 },
      { header: 'Deadline', width: 80, align: 'right' },
    ];
    const taskRows = tasks.map(t => [
      t.title || '–',
      t.status,
      (t.assignees ?? []).map(a => a.name).join(', ') || '–',
      formatDate(t.dueDate),
    ]);
    drawTable(doc, cursor, taskColumns, taskRows);
  }

  // 5) Purchases table.
  sectionHeader(doc, cursor, `Indkøb (${purchases.length})`);
  if (purchases.length === 0) {
    addWrappedText(doc, cursor, 'Ingen indkøb registreret på projektet.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    const purchaseColumns: TableColumn[] = [
      { header: 'Navn', width: 199 },
      { header: 'Antal', width: 60, align: 'right' },
      { header: 'Enhed', width: 60 },
      { header: 'Pris', width: 90, align: 'right' },
      { header: 'Sum', width: 90, align: 'right' },
    ];
    const purchaseRows = purchases.map(p => [
      p.name || '–',
      formatNumber(p.quantity ?? 0),
      'stk.',
      formatDkk(p.price ?? 0),
      formatDkk((p.quantity ?? 0) * (p.price ?? 0)),
    ]);
    const total = purchases.reduce((s, p) => s + (p.quantity ?? 0) * (p.price ?? 0), 0);
    drawTable(doc, cursor, purchaseColumns, purchaseRows, ['I alt', '', '', '', formatDkk(total)]);
  }

  // 6) Budget — planned vs. actual by category when a baseline exists,
  // otherwise the legacy single ratio sentence.
  sectionHeader(doc, cursor, 'Budget');
  if (budgetSummary?.hasBaseline) {
    const budgetColumns: TableColumn[] = [
      { header: 'Kategori', width: 179 },
      { header: 'Planlagt', width: 110, align: 'right' },
      { header: 'Faktisk', width: 110, align: 'right' },
      { header: 'Forbrug', width: 100, align: 'right' },
    ];
    const actualByCategory: Record<ProjectBudgetCategory, number> = {
      materials: budgetSummary.actualPurchasesCommittedKr + budgetSummary.actualPurchasesReceivedKr,
      labor: budgetSummary.actualLaborKr,
      subcontractors: budgetSummary.actualSubcontractorsKr,
      other: 0,
    };
    const budgetRows = (Object.keys(BUDGET_CATEGORY_LABELS) as ProjectBudgetCategory[]).map(cat => {
      const planned = budgetSummary.plannedByCategory[cat];
      const actual = actualByCategory[cat];
      const pct = planned > 0 ? formatNumber((actual / planned) * 100, 0) + ' %' : '–';
      return [BUDGET_CATEGORY_LABELS[cat], formatDkk(planned), formatDkk(actual), pct];
    });
    drawTable(doc, cursor, budgetColumns, budgetRows, [
      'I alt', formatDkk(budgetSummary.plannedTotalKr), formatDkk(budgetSummary.actualTotalKr),
      formatNumber(budgetSummary.plannedTotalKr > 0 ? (budgetSummary.actualTotalKr / budgetSummary.plannedTotalKr) * 100 : 0, 0) + ' %',
    ]);
    addWrappedText(
      doc,
      cursor,
      `Resterer: ${formatDkk(budgetSummary.remainingKr)}.` +
        (budgetSummary.actualPurchasesForecastKr > 0
          ? ` Inkl. afventende indkøb (${formatDkk(budgetSummary.actualPurchasesForecastKr)}) bliver forbruget ${formatDkk(budgetSummary.forecastTotalKr)}.`
          : ''),
      { size: 9, color: TEXT_MUTED }
    );
  } else {
    const budgetTotal = project.budget?.total ?? 0;
    const purchaseTotal = purchases.reduce((s, p) => s + (p.quantity ?? 0) * (p.price ?? 0), 0);
    if (budgetTotal > 0) {
      addWrappedText(
        doc,
        cursor,
        `Budgetramme: ${formatDkk(budgetTotal)} — indkøb udgør ${formatNumber((purchaseTotal / budgetTotal) * 100, 1)} % af budgettet.`,
        { size: 9, color: TEXT_MUTED }
      );
    } else {
      addWrappedText(doc, cursor, 'Intet budget er oprettet for projektet endnu.', { size: 10, color: TEXT_MUTED });
    }
  }

  // Footer on every page (after content so the page count is final).
  drawFooters(doc);

  return doc;
};
