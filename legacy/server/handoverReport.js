// ─────────────────────────────────────────────────────────────────────────────
// Server-side handover report (OVERDRAGELSESRAPPORT) PDF generator (Phase 3).
//
// Pure jsPDF vector drawing — no html2canvas, no DOM. Drawing primitives are
// ported verbatim from services/pdfReport.ts (translated to plain JS). The
// report is scoped to a single departing member and respects their project
// visibility level (see server/handoverData.js).
//
// jsPDF's built-in helvetica uses WinAnsi encoding which covers Danish æ/ø/å.
// ─────────────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';

export { gatherHandoverData } from './handoverData.js';

// ── Layout constants (A4 portrait, pt) ───────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 40;
const BOTTOM_LIMIT = PAGE_H - MARGIN - FOOTER_H;

const BRAND = [30, 95, 255]; // #1E5FFF
const TEXT_DARK = [17, 24, 39];
const TEXT_MUTED = [107, 114, 128];
const ZEBRA = [243, 244, 246];
const LINE = [229, 231, 235];

// ── Formatting (da-DK) ───────────────────────────────────────────────────────

const formatNumber = (n, decimals = 0) =>
  (Number(n) || 0).toLocaleString('da-DK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const formatDate = (value) => {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Visibility labels ─────────────────────────────────────────────────────────

const visibilityLabel = (vis) => {
  switch (vis) {
    case 'all': return 'Fuld adgang';
    case 'some': return 'Udvidet adgang (uden økonomi)';
    case 'standard': return 'Standard adgang';
    case 'none': return 'Begrænset adgang (egne opgaver)';
    default: return 'Ukendt adgang';
  }
};

// ── Role labels (project role: OWNER / MANAGER / EMPLOYEE) ─────────────────────

const roleLabel = (role) => {
  switch (role) {
    case 'OWNER': return 'Ejer';
    case 'MANAGER': return 'Projektleder';
    case 'EMPLOYEE': return 'Medarbejder';
    // Fall back to the staff/partner resource kind if that is all we have.
    case 'staff': return 'Medarbejder';
    case 'partner': return 'Underleverandør';
    default: return role || 'Ukendt rolle';
  }
};

// Mirrors the allowedTabs mapping in pages/ProjectDetailPage.tsx.
const accessAreas = (vis) => {
  switch (vis) {
    case 'all':
      return ['Overblik', 'Opgaver', 'Tid & Plan', 'Indkøb', 'Opfølgning', 'Punch List', 'Påmindelser', 'Dokumenter', 'Detaljer'];
    case 'some':
      return ['Overblik', 'Opgaver', 'Tid & Plan', 'Opfølgning', 'Punch List', 'Påmindelser', 'Dokumenter', 'Detaljer'];
    case 'standard':
      return ['Overblik', 'Opgaver', 'Punch List', 'Opfølgning', 'Påmindelser', 'Tid & Plan', 'Dokumenter', 'Detaljer'];
    case 'none':
      return ['Opgaver', 'Punch List'];
    default:
      return [];
  }
};

// ── Cursor + primitives (ported from services/pdfReport.ts) ──────────────────

const ensureSpace = (doc, cursor, needed) => {
  if (cursor.y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    cursor.y = MARGIN;
  }
};

/** Word-wrapped text with automatic page breaks. Returns lines drawn. */
const addWrappedText = (doc, cursor, text, options = {}) => {
  const {
    x = MARGIN,
    maxWidth = CONTENT_W - (x - MARGIN),
    size = 10,
    style = 'normal',
    color = TEXT_DARK,
    lineHeight = size * 1.4,
    bullet = false,
    spacingAfter = 0,
  } = options;

  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);

  const indent = bullet ? 10 : 0;
  const lines = doc.splitTextToSize(text, maxWidth - indent);
  lines.forEach((line, i) => {
    ensureSpace(doc, cursor, lineHeight);
    // Re-apply font after potential page break (defensive).
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    if (bullet && i === 0) {
      doc.text('•', x, cursor.y);
    }
    doc.text(line, x + indent, cursor.y);
    cursor.y += lineHeight;
  });
  cursor.y += spacingAfter;
  return lines.length;
};

const sectionHeader = (doc, cursor, title) => {
  ensureSpace(doc, cursor, 40);
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(MARGIN, cursor.y - 9, 4, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(title, MARGIN + 12, cursor.y + 2);
  cursor.y += 12;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, cursor.y, MARGIN + CONTENT_W, cursor.y);
  cursor.y += 14;
};

// ── Table renderer with zebra rows + page breaks ─────────────────────────────

const TABLE_FONT_SIZE = 9;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 5;
const CELL_LINE_H = TABLE_FONT_SIZE * 1.3;

const drawTableHeader = (doc, cursor, columns) => {
  const h = CELL_LINE_H + CELL_PAD_Y * 2;
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(MARGIN, cursor.y, CONTENT_W, h, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setTextColor(255, 255, 255);
  let x = MARGIN;
  columns.forEach((col) => {
    const tx = col.align === 'right' ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
    doc.text(col.header, tx, cursor.y + CELL_PAD_Y + TABLE_FONT_SIZE, {
      align: col.align === 'right' ? 'right' : 'left',
    });
    x += col.width;
  });
  cursor.y += h;
};

const drawTableRow = (doc, cursor, columns, cells, zebra, options = {}) => {
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(TABLE_FONT_SIZE);

  const wrapped = columns.map((col, i) =>
    doc.splitTextToSize(cells[i] ?? '', col.width - CELL_PAD_X * 2)
  );
  const lineCount = Math.max(1, ...wrapped.map((w) => w.length));
  const rowH = lineCount * CELL_LINE_H + CELL_PAD_Y * 2;

  if (cursor.y + rowH > BOTTOM_LIMIT) {
    // Row doesn't fit — break the page and repeat the table header first.
    doc.addPage();
    cursor.y = MARGIN;
    drawTableHeader(doc, cursor, columns);
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(TABLE_FONT_SIZE);
  }

  const fill = options.fill ?? (zebra ? ZEBRA : null);
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(MARGIN, cursor.y, CONTENT_W, rowH, 'F');
  }

  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  let x = MARGIN;
  columns.forEach((col, i) => {
    const lines = wrapped[i];
    lines.forEach((line, li) => {
      const tx = col.align === 'right' ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
      doc.text(line, tx, cursor.y + CELL_PAD_Y + TABLE_FONT_SIZE + li * CELL_LINE_H, {
        align: col.align === 'right' ? 'right' : 'left',
      });
    });
    x += col.width;
  });
  cursor.y += rowH;
};

/** Zebra table with header repeated after page breaks. */
const drawTable = (doc, cursor, columns, rows, totalRow) => {
  ensureSpace(doc, cursor, (CELL_LINE_H + CELL_PAD_Y * 2) * 3);
  drawTableHeader(doc, cursor, columns);

  rows.forEach((row, i) => {
    drawTableRow(doc, cursor, columns, row, i % 2 === 1);
  });

  if (totalRow) {
    drawTableRow(doc, cursor, columns, totalRow, false, { bold: true, fill: [231, 238, 255] });
  }
  cursor.y += 12;
};

// ── Footer on every page ─────────────────────────────────────────────────────

const drawFooters = (doc, generatedAt) => {
  const pageCount = doc.getNumberOfPages();
  const genDate = generatedAt ? new Date(generatedAt) : new Date();
  const dateText = `Genereret ${genDate.toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = PAGE_H - 30;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y - 10, PAGE_W - MARGIN, y - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(dateText, MARGIN, y);
    doc.text(`Side ${i} af ${pageCount}`, PAGE_W / 2, y, { align: 'center' });
    doc.text('Genereret af BYG SMART', PAGE_W - MARGIN, y, { align: 'right' });
  }
};

// ── Cover page ───────────────────────────────────────────────────────────────

const drawHandoverCover = (doc, { project, member, generatedAt }) => {
  const genDate = generatedAt ? new Date(generatedAt) : new Date();

  // Brand color bar.
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, PAGE_W, 10, 'F');

  // Left: title + sub-wordmark.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text('OVERDRAGELSESRAPPORT', MARGIN, 100);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text('BYG SMART Construction', MARGIN, 118);

  // Right: project name + date.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(project.name || 'Uden navn', PAGE_W - MARGIN, 100, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(`Dato: ${genDate.toLocaleDateString('da-DK')}`, PAGE_W - MARGIN, 116, { align: 'right' });

  // Divider under header.
  doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.setLineWidth(2);
  doc.line(MARGIN, 132, PAGE_W - MARGIN, 132);

  // Project-detail grid (2 columns).
  const cursor = { y: 168 };
  const detailRows = [
    ['Bygherre', project.clientName || '–'],
    ['Projekt ID', project.projectNumber || '–'],
    ['Adresse', project.address || '–'],
    ['Periode', `${formatDate(project.startDate)} — ${formatDate(project.endDate)}`],
  ];
  const colW = (CONTENT_W - 24) / 2;
  for (let i = 0; i < detailRows.length; i += 2) {
    const left = detailRows[i];
    const right = detailRows[i + 1];
    const rowY = cursor.y;
    const drawCell = (label, value, x) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
      doc.text(label.toUpperCase(), x, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      const valLines = doc.splitTextToSize(value, colW);
      doc.text(valLines, x, rowY + 14);
    };
    drawCell(left[0], left[1], MARGIN);
    if (right) drawCell(right[0], right[1], MARGIN + colW + 24);
    cursor.y += 44;
  }

  // Member info block.
  cursor.y += 12;
  doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
  doc.rect(MARGIN, cursor.y, CONTENT_W, 96, 'F');
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(MARGIN, cursor.y, 4, 96, 'F');

  let infoY = cursor.y + 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(`Rapport for: ${member.name || '–'}`, MARGIN + 16, infoY);
  infoY += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  if (member.email) {
    doc.text(member.email, MARGIN + 16, infoY);
    infoY += 16;
  }
  doc.text(`Rolle: ${roleLabel(member.role ?? member.kind)}`, MARGIN + 16, infoY);
  infoY += 16;
  doc.text(`Synlighed: ${visibilityLabel(member.visibility)}`, MARGIN + 16, infoY);
  infoY += 16;
  doc.text(`Tilknyttet: ${formatDate(member.joinedAt)}`, MARGIN + 16, infoY);
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds the scoped handover report PDF for a departing member.
 *
 * @param {object} args
 * @param {object} args.project   payload.project (from gatherHandoverData)
 * @param {object} args.member    payload.member
 * @param {object} args.data      the full payload from gatherHandoverData
 * @param {string} [args.generatedAt] ISO timestamp; defaults to now
 * @returns {Promise<Buffer>} PDF bytes
 */
export async function generateHandoverReportPdf({ project, member, data, generatedAt }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const vis = data.visibility;

  // ── Cover ──────────────────────────────────────────────────────────────────
  drawHandoverCover(doc, { project, member, generatedAt });
  doc.addPage();
  const cursor = { y: MARGIN };

  // ── Resumé ───────────────────────────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Resumé');
  addWrappedText(
    doc,
    cursor,
    `${member.name || 'Medlemmet'} var tilknyttet projektet "${project.name}" som ${roleLabel(member.role ?? member.kind)} med adgangsniveauet "${visibilityLabel(vis)}".`,
    { size: 10, color: TEXT_MUTED, spacingAfter: 4 }
  );
  if (member.joinedAt) {
    addWrappedText(doc, cursor, `Tilknyttet projektet siden ${formatDate(member.joinedAt)}.`, {
      size: 10,
      color: TEXT_MUTED,
      spacingAfter: 8,
    });
  }
  const areas = accessAreas(vis);
  if (areas.length > 0) {
    addWrappedText(doc, cursor, 'Medlemmet havde adgang til følgende områder:', {
      size: 10,
      style: 'bold',
      spacingAfter: 4,
    });
    areas.forEach((area) => {
      addWrappedText(doc, cursor, area, { x: MARGIN + 4, size: 9, color: TEXT_MUTED, bullet: true });
    });
  }
  cursor.y += 14;

  // ── Mit bidrag — Opgaver ─────────────────────────────────────────────────────
  sectionHeader(doc, cursor, `Mit bidrag — Opgaver (${data.ownTasks.length})`);
  if (data.ownTasks.length === 0) {
    addWrappedText(doc, cursor, 'Ingen opgaver registreret.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    drawTable(
      doc,
      cursor,
      [
        { header: 'Titel', width: 309 },
        { header: 'Status', width: 100 },
        { header: 'Deadline', width: 90, align: 'right' },
      ],
      data.ownTasks.map((t) => [t.title || '–', t.status || '–', formatDate(t.dueDate)])
    );
  }

  // ── Mit bidrag — Tidsforbrug ─────────────────────────────────────────────────
  sectionHeader(doc, cursor, `Mit bidrag — Tidsforbrug (${data.timeEntries.length})`);
  if (data.timeEntries.length === 0) {
    addWrappedText(doc, cursor, 'Ingen tidsregistreringer fundet.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    const totalHours = data.timeEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
    drawTable(
      doc,
      cursor,
      [
        { header: 'Dato', width: 100 },
        { header: 'Timer', width: 60, align: 'right' },
        { header: 'Beskrivelse', width: 339 },
      ],
      data.timeEntries.map((e) => [formatDate(e.date), formatNumber(e.hours, 2), e.description || '–']),
      ['I alt', formatNumber(totalHours, 2), '']
    );
  }

  // ── Mit bidrag — Dokumentation ───────────────────────────────────────────────
  sectionHeader(doc, cursor, `Mit bidrag — Dokumentation (${data.documentation.length})`);
  if (data.documentation.length === 0) {
    addWrappedText(doc, cursor, 'Ingen dokumentation registreret.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    const kindLabel = { text: 'Note', audio: 'Lyd', link: 'Link', file: 'Fil', photo: 'Foto', report: 'Rapport' };
    drawTable(
      doc,
      cursor,
      [
        { header: 'Type', width: 80 },
        { header: 'Beskrivelse / Indhold', width: 329 },
        { header: 'Dato', width: 90, align: 'right' },
      ],
      data.documentation.map((d) => [
        kindLabel[d.kind] ?? d.kind ?? '–',
        d.body ? (d.body.length > 120 ? d.body.slice(0, 117) + '…' : d.body) : '–',
        formatDate(d.createdAt),
      ])
    );
  }

  // ── Mit bidrag — Kvalitetssikring ────────────────────────────────────────────
  const qualityControls = Array.isArray(data.qualityControls) ? data.qualityControls : [];
  sectionHeader(doc, cursor, `Mit bidrag — Kvalitetssikring (${qualityControls.length})`);
  if (qualityControls.length === 0) {
    addWrappedText(doc, cursor, 'Ingen kvalitetssikring registreret.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    const qcTypeLabel = { visuel: 'Visuel', maaling: 'Måling', dokumentation: 'Dokumentation' };
    const qcResultLabel = { godkendt: 'Godkendt', ikke_godkendt: 'Ikke godkendt' };
    drawTable(
      doc,
      cursor,
      [
        { header: 'Kontrolpunkt', width: 160 },
        { header: 'Type', width: 80 },
        { header: 'Krav/ref.', width: 110 },
        { header: 'Resultat', width: 90, align: 'right' },
        { header: 'Afvigelse', width: 59, align: 'right' },
      ],
      qualityControls.map((qc) => [
        qc.controlPoint || '–',
        qc.controlType ? (qcTypeLabel[qc.controlType] ?? qc.controlType) : '–',
        qc.requirementRef || '–',
        qc.result ? (qcResultLabel[qc.result] ?? qc.result) : '–',
        qc.hasDeviation ? 'Ja' : 'Nej',
      ])
    );

    // Follow-up rows for controls with a registered deviation — the main
    // table only has room for a Ja/Nej marker, but the handover recipient
    // needs the actual deviation text, corrective action, deadline and
    // responsible person to act on it.
    const deviations = qualityControls.filter((qc) => qc.hasDeviation);
    if (deviations.length > 0) {
      addWrappedText(doc, cursor, 'Afvigelser — detaljer', {
        size: 10,
        style: 'bold',
        spacingAfter: 4,
      });
      deviations.forEach((qc, i) => {
        ensureSpace(doc, cursor, 20);
        addWrappedText(doc, cursor, qc.controlPoint || 'Kontrolpunkt', {
          size: 9,
          style: 'bold',
          color: TEXT_DARK,
          spacingAfter: 2,
        });
        if (qc.deviationDescription) {
          addWrappedText(doc, cursor, `Afvigelse: ${qc.deviationDescription}`, {
            x: MARGIN + 4,
            size: 9,
            color: TEXT_MUTED,
          });
        }
        if (qc.correctiveAction) {
          addWrappedText(doc, cursor, `Udbedring: ${qc.correctiveAction}`, {
            x: MARGIN + 4,
            size: 9,
            color: TEXT_MUTED,
          });
        }
        if (qc.deviationDeadline) {
          addWrappedText(doc, cursor, `Frist: ${formatDate(qc.deviationDeadline)}`, {
            x: MARGIN + 4,
            size: 9,
            color: TEXT_MUTED,
          });
        }
        if (qc.responsibleName) {
          addWrappedText(doc, cursor, `Ansvarlig: ${qc.responsibleName}`, {
            x: MARGIN + 4,
            size: 9,
            color: TEXT_MUTED,
          });
        }
        cursor.y += i === deviations.length - 1 ? 0 : 6;
      });
      cursor.y += 12;
    }
  }

  // ── Mit bidrag — Check-ins ───────────────────────────────────────────────────
  sectionHeader(doc, cursor, `Mit bidrag — Check-ins (${data.checkIns.length})`);
  if (data.checkIns.length === 0) {
    addWrappedText(doc, cursor, 'Ingen check-ins registreret.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    drawTable(
      doc,
      cursor,
      [
        { header: 'Opgave-ID', width: 219 },
        { header: 'Check-ind', width: 140 },
        { header: 'Check-ud', width: 140, align: 'right' },
      ],
      data.checkIns.map((c) => [c.taskId || '–', formatDate(c.checkedInAt), formatDate(c.checkedOutAt)])
    );
  }

  // ── Mit bidrag — Kommentarer ─────────────────────────────────────────────────
  const comments = Array.isArray(data.comments) ? data.comments : [];
  sectionHeader(doc, cursor, `Mit bidrag — Kommentarer (${comments.length})`);
  if (comments.length === 0) {
    addWrappedText(doc, cursor, 'Ingen kommentarer registreret.', { size: 10, color: TEXT_MUTED });
    cursor.y += 10;
  } else {
    const sourceLabel = { task: 'Opgave', documentation: 'Dokumentation' };
    drawTable(
      doc,
      cursor,
      [
        { header: 'Kilde', width: 90 },
        { header: 'Kommentar', width: 319 },
        { header: 'Tidspunkt', width: 90, align: 'right' },
      ],
      comments.map((c) => [
        sourceLabel[c.source] ?? c.source ?? '–',
        c.text ? (c.text.length > 160 ? c.text.slice(0, 157) + '…' : c.text) : '–',
        c.timeLabel || formatDate(c.createdAt),
      ])
    );
  }

  // ── Statusoversigt (vis !== 'none') ──────────────────────────────────────────
  if (data.projectStatusOverview) {
    const o = data.projectStatusOverview;
    sectionHeader(doc, cursor, 'Statusoversigt');
    drawTable(
      doc,
      cursor,
      [
        { header: 'Måling', width: 349 },
        { header: 'Antal', width: 150, align: 'right' },
      ],
      [
        ['Opgaver i alt', formatNumber(o.total)],
        ['Udført', formatNumber(o.done)],
        ['Igangværende', formatNumber(o.inProgress)],
        ['Forfaldne', formatNumber(o.overdue)],
      ]
    );
  }

  // ── Mit bidrag — Indkøb ──────────────────────────────────────────────────────
  // The member's *own* assigned purchases are a personal contribution and are
  // rendered for any visibility level (project-wide budget stays gated elsewhere).
  if (Array.isArray(data.ownPurchases)) {
    sectionHeader(doc, cursor, `Mit bidrag — Indkøb (${data.ownPurchases.length})`);
    if (data.ownPurchases.length === 0) {
      addWrappedText(doc, cursor, 'Ingen indkøb registreret.', { size: 10, color: TEXT_MUTED });
      cursor.y += 10;
    } else {
      const total = data.ownPurchases.reduce((s, p) => s + (p.quantity ?? 0) * (p.price ?? 0), 0);
      drawTable(
        doc,
        cursor,
        [
          { header: 'Navn', width: 239 },
          { header: 'Antal', width: 60, align: 'right' },
          { header: 'Pris', width: 100, align: 'right' },
          { header: 'Sum', width: 100, align: 'right' },
        ],
        data.ownPurchases.map((p) => [
          p.name || '–',
          formatNumber(p.quantity),
          `${formatNumber(p.price, 2)} kr.`,
          `${formatNumber((p.quantity ?? 0) * (p.price ?? 0), 2)} kr.`,
        ]),
        ['I alt', '', '', `${formatNumber(total, 2)} kr.`]
      );
    }
  }

  // Footer on every page (last, so the page count is final).
  drawFooters(doc, generatedAt);

  return Buffer.from(doc.output('arraybuffer'));
}
