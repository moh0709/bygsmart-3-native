import jsPDF from 'jspdf';
import { Task, TaskDocumentationItem, AcceptanceReportSettings, TaskQualityControl } from '../../../../types';
import { BRAND, TEXT_DARK, TEXT_MUTED, LINE, MARGIN, CONTENT_W, PAGE_W } from './theme';
import { Cursor, ensureSpace, addWrappedText, sectionHeader, drawFooters } from './primitives';
import { drawTable } from './table';

// ─────────────────────────────────────────────────────────────────────────────
// Task Acceptance Report (Afleveringsrapport)
// ─────────────────────────────────────────────────────────────────────────────

export interface TaskTimeEntry {
  date: string;
  hours: number;
  description?: string;
  userName: string;
}

export interface TaskSnag {
  description: string;
  deadline?: string;
}

export interface TaskAcceptanceReportParams {
  reportId: string;
  generatedAt?: string;
  task: Task;
  projectNumber?: string;
  projectName?: string;
  companyName?: string;
  cvr?: string;
  /** PNG or JPEG data URL for the Mester's company logo. */
  logoDataUrl?: string;
  mesterName: string;
  partnerName: string;
  agreedPriceOre?: number;
  timeEntries: TaskTimeEntry[];
  documentation: (Pick<TaskDocumentationItem, 'kind' | 'body' | 'authorName' | 'createdAt'> & { resolvedImageDataUrl?: string })[];
  snags?: TaskSnag[];
  qualityControls?: (TaskQualityControl & { deviationPhotoDataUrls?: string[] })[];
  /** PNG dataURL captured in-app by the worker. */
  supplierSignatureDataUrl?: string;
  supplierSignatureName?: string;
  supplierSignatureTimestamp?: string;
  /** PNG dataURL captured in-app by the Mester. */
  mesterSignatureDataUrl?: string;
  mesterSignatureName?: string;
  mesterSignatureTimestamp?: string;
  settings: AcceptanceReportSettings;
}

// ── Internal formatter ───────────────────────────────────────────────────────

const fmtOre = (ore: number): string => {
  const kr = ore / 100;
  return kr.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr.';
};

const fmtTs = (iso?: string | null): string => {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtDay = (iso?: string | null): string => {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
};

const QC_TYPE_LABEL: Record<string, string> = {
  visuel: 'Visuel',
  maaling: 'Måling',
  dokumentation: 'Dokumentation',
};

const QC_RESULT_LABEL: Record<string, string> = {
  godkendt: 'Godkendt',
  ikke_godkendt: 'Ikke godkendt',
};

// ── Acceptance report cover (simpler than intelligence cover) ────────────────

const drawAcceptanceCover = (
  doc: jsPDF,
  params: TaskAcceptanceReportParams
): void => {
  const { task, projectName, projectNumber, companyName, cvr, logoDataUrl, reportId, generatedAt, settings } = params;
  const genDate = generatedAt ? fmtTs(generatedAt) : fmtTs(new Date().toISOString());

  // Brand bar
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, PAGE_W, 10, 'F');

  // Company / BygSmart branding
  if (settings.showBranding) {
    // Logo rendered in the top-right corner when provided
    if (logoDataUrl) {
      try {
        const fmt = logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(logoDataUrl, fmt, PAGE_W - MARGIN - 80, 68, 80, 40, undefined, 'FAST');
      } catch { /* skip if logo rendering fails */ }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.text(companyName || 'BygSmart', MARGIN, 100);
    if (cvr) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
      doc.text(`CVR: ${cvr}`, MARGIN, 116);
    }
  }

  // Report type label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text('Afleveringsrapport', MARGIN, settings.showBranding ? 140 : 100);

  // Task title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  const titleLines: string[] = doc.splitTextToSize(task.title || 'Opgave', CONTENT_W);
  let y = settings.showBranding ? 200 : 160;
  titleLines.forEach(line => { doc.text(line, MARGIN, y); y += 28; });

  // Metadata lines
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  const metaLines: string[] = [];
  if (settings.showReportId) {
    metaLines.push(`Rapport-ID: ${reportId}`);
    metaLines.push(`Genereret: ${genDate}`);
    if (projectNumber) metaLines.push(`Projektnr.: ${projectNumber}`);
    if (projectName) metaLines.push(`Projekt: ${projectName}`);
  }
  metaLines.forEach(line => { doc.text(line, MARGIN, y); y += 16; });

  // Accepted stamp
  const stampY = y + 40;
  doc.setFillColor(22, 163, 74);
  doc.roundedRect(MARGIN, stampY, 130, 38, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('✓ GODKENDT', MARGIN + 65, stampY + 24, { align: 'center' });
};

// ── Signature block ──────────────────────────────────────────────────────────

const drawSignatureBlock = (
  doc: jsPDF,
  cursor: Cursor,
  label: string,
  name: string,
  timestamp: string,
  dataUrl?: string
): void => {
  ensureSpace(doc, cursor, 100);

  const sigX = MARGIN;
  const sigW = (CONTENT_W - 20) / 2;
  const sigH = 60;

  if (dataUrl) {
    try {
      doc.addImage(dataUrl, 'PNG', sigX, cursor.y, sigW, sigH, undefined, 'FAST');
    } catch {
      // If image embedding fails, draw a placeholder rect
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.rect(sigX, cursor.y, sigW, sigH);
    }
  } else {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.5);
    doc.rect(sigX, cursor.y, sigW, sigH);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text('Ingen underskrift', sigX + sigW / 2, cursor.y + sigH / 2 + 4, { align: 'center' });
  }

  cursor.y += sigH + 8;
  doc.setLineWidth(0.75);
  doc.setDrawColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.line(sigX, cursor.y, sigX + sigW, cursor.y);
  cursor.y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(label, sigX, cursor.y);
  cursor.y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(name || '–', sigX, cursor.y);
  cursor.y += 12;
  doc.text(timestamp || '–', sigX, cursor.y);
  cursor.y += 16;
};

/**
 * Generates a professional Danish afleveringsrapport (task acceptance report).
 * All section toggles are respected via `params.settings`.
 * Returns the jsPDF instance; caller decides filename via `doc.save(...)`.
 */
export const generateTaskAcceptanceReport = (params: TaskAcceptanceReportParams): jsPDF => {
  const {
    task, projectNumber, projectName, companyName, cvr,
    mesterName, partnerName, agreedPriceOre,
    timeEntries, documentation, snags, qualityControls,
    supplierSignatureDataUrl, supplierSignatureName, supplierSignatureTimestamp,
    mesterSignatureDataUrl, mesterSignatureName, mesterSignatureTimestamp,
    settings,
  } = params;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const cursor: Cursor = { y: MARGIN };

  // ── Cover ──────────────────────────────────────────────────────────────────
  drawAcceptanceCover(doc, params);
  doc.addPage();
  cursor.y = MARGIN;

  // ── 1. Parties ─────────────────────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Parter');
  const partyCols = [
    { header: 'Rolle', width: 120 },
    { header: 'Navn', width: 379 },
  ];
  drawTable(doc, cursor, partyCols, [
    ['Mester / Projektejer', mesterName || '–'],
    ['Underentreprenør', partnerName || '–'],
  ]);

  // ── 2. Opgaveomfang ─────────────────────────────────────────────────────────
  sectionHeader(doc, cursor, 'Opgaveomfang');
  addWrappedText(doc, cursor, task.title, { size: 13, style: 'bold', spacingAfter: 6 });
  if (task.description) {
    addWrappedText(doc, cursor, task.description, { size: 10, color: TEXT_MUTED, spacingAfter: 10 });
  }
  if (task.checklist && task.checklist.length > 0) {
    addWrappedText(doc, cursor, 'Tjekliste', { size: 10, style: 'bold', spacingAfter: 4 });
    task.checklist.forEach(item => {
      const mark = item.checked ? '☑' : '☐';
      addWrappedText(doc, cursor, `${mark}  ${item.text}`, {
        x: MARGIN + 8,
        size: 10,
        color: item.checked ? TEXT_MUTED : TEXT_DARK,
        spacingAfter: 2,
      });
    });
    cursor.y += 10;
  }

  // ── 3. Økonomi / VAT breakdown ─────────────────────────────────────────────
  if (settings.showVat && agreedPriceOre != null) {
    sectionHeader(doc, cursor, 'Aftalt pris & moms-specifikation');
    const exMoms = Math.round(agreedPriceOre / 1.25);
    const moms = agreedPriceOre - exMoms;
    const cols = [
      { header: 'Beskrivelse', width: 330 },
      { header: 'Beløb', width: 169, align: 'right' as const },
    ];
    drawTable(doc, cursor, cols, [
      ['Aftalt pris ekskl. moms', fmtOre(exMoms)],
      ['Moms (25%)', fmtOre(moms)],
    ], ['Aftalt pris inkl. moms', fmtOre(agreedPriceOre)]);
  }

  // ── 4. Tidsforbrug ─────────────────────────────────────────────────────────
  if (settings.showTime && timeEntries.length > 0) {
    sectionHeader(doc, cursor, 'Tidsforbrug');
    const totalHours = timeEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
    addWrappedText(doc, cursor, `Total tid brugt: ${totalHours.toLocaleString('da-DK', { maximumFractionDigits: 2 })} timer`, {
      size: 10, style: 'bold', spacingAfter: 8,
    });

    // Per-session table
    addWrappedText(doc, cursor, 'Per session', { size: 10, style: 'bold', spacingAfter: 4 });
    drawTable(doc, cursor,
      [
        { header: 'Dato', width: 100 },
        { header: 'Medarbejder', width: 180 },
        { header: 'Beskrivelse', width: 179 },
        { header: 'Timer', width: 40, align: 'right' },
      ],
      timeEntries.map(e => [
        fmtDay(e.date),
        e.userName || '–',
        e.description || '–',
        e.hours.toLocaleString('da-DK', { maximumFractionDigits: 2 }),
      ]),
      ['I alt', '', '', totalHours.toLocaleString('da-DK', { maximumFractionDigits: 2 })]
    );

    // Per-day summary
    const byDay = new Map<string, number>();
    timeEntries.forEach(e => {
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.hours);
    });
    if (byDay.size > 1) {
      addWrappedText(doc, cursor, 'Dagsoversigt', { size: 10, style: 'bold', spacingAfter: 4 });
      drawTable(doc, cursor,
        [
          { header: 'Dato', width: 200 },
          { header: 'Timer', width: 299, align: 'right' },
        ],
        Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, h]) => [
          fmtDay(date),
          h.toLocaleString('da-DK', { maximumFractionDigits: 2 }),
        ])
      );
    }
  }

  // ── 5. Dokumentation ───────────────────────────────────────────────────────
  if (settings.showDocumentation && documentation.length > 0) {
    sectionHeader(doc, cursor, 'Dokumentation');
    const photos = documentation.filter(d => d.kind === 'photo' && d.resolvedImageDataUrl);
    const nonPhotos = documentation.filter(d => d.kind !== 'report');

    if (photos.length > 0) {
      addWrappedText(doc, cursor, `Fotos (${photos.length})`, { size: 10, style: 'bold', spacingAfter: 6 });
      const THUMB_W = 120;
      const THUMB_H = 90;
      const COLS = 4;
      const GAP = 8;
      let thumbX = MARGIN;
      let thumbRowY = cursor.y;
      photos.forEach((photo, i) => {
        if (i > 0 && i % COLS === 0) {
          thumbRowY = cursor.y;
          thumbX = MARGIN;
        }
        if (i % COLS === 0) {
          ensureSpace(doc, cursor, THUMB_H + 20);
          thumbRowY = cursor.y;
          cursor.y += THUMB_H + 16;
        }
        try {
          doc.addImage(photo.resolvedImageDataUrl!, 'JPEG', thumbX, thumbRowY, THUMB_W, THUMB_H, undefined, 'FAST');
        } catch {
          doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
          doc.rect(thumbX, thumbRowY, THUMB_W, THUMB_H);
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
        doc.text(fmtDay(photo.createdAt), thumbX, thumbRowY + THUMB_H + 10);
        thumbX += THUMB_W + GAP;
      });
      cursor.y += 10;
    }

    // Other documentation entries
    const notesDocs = nonPhotos.filter(d => d.kind === 'text' || d.kind === 'link' || d.kind === 'audio' || d.kind === 'file');
    if (notesDocs.length > 0) {
      addWrappedText(doc, cursor, 'Øvrig dokumentation', { size: 10, style: 'bold', spacingAfter: 4 });
      const kindLabel: Record<string, string> = { text: 'Note', audio: 'Lyd', link: 'Link', file: 'Fil', photo: 'Foto' };
      drawTable(doc, cursor,
        [
          { header: 'Type', width: 70 },
          { header: 'Dato', width: 90 },
          { header: 'Forfatter', width: 130 },
          { header: 'Indhold', width: 209 },
        ],
        notesDocs.map(d => [
          kindLabel[d.kind] ?? d.kind,
          fmtDay(d.createdAt),
          d.authorName || '–',
          d.body ? (d.body.length > 80 ? d.body.slice(0, 77) + '…' : d.body) : '–',
        ])
      );
    }
  }

  // ── 5b. Kvalitetssikring (KS) ──────────────────────────────────────────────
  if (settings.showQualityControl) {
    sectionHeader(doc, cursor, 'Kvalitetssikring (KS)');
    if (qualityControls && qualityControls.length > 0) {
      drawTable(doc, cursor,
        [
          { header: 'Kontrolpunkt', width: 180 },
          { header: 'Type', width: 90 },
          { header: 'Krav/reference', width: 130 },
          { header: 'Resultat', width: 99 },
        ],
        qualityControls.map(qc => [
          qc.controlPoint || '–',
          qc.controlType ? (QC_TYPE_LABEL[qc.controlType] ?? qc.controlType) : '–',
          qc.requirementRef || '–',
          qc.result ? (QC_RESULT_LABEL[qc.result] ?? qc.result) : '–',
        ])
      );

      const deviations = qualityControls.filter(qc => qc.hasDeviation);
      deviations.forEach(qc => {
        addWrappedText(doc, cursor, `Afvigelse — ${qc.controlPoint || 'Kontrolpunkt'}`, {
          size: 10, style: 'bold', spacingAfter: 4,
        });
        if (qc.deviationDescription) {
          addWrappedText(doc, cursor, qc.deviationDescription, { size: 9, color: TEXT_MUTED, spacingAfter: 4 });
        }
        if (qc.correctiveAction) {
          addWrappedText(doc, cursor, `Udbedring: ${qc.correctiveAction}`, { size: 9, color: TEXT_MUTED, spacingAfter: 4 });
        }
        if (qc.deviationDeadline) {
          addWrappedText(doc, cursor, `Frist: ${fmtDay(qc.deviationDeadline)}`, { size: 9, color: TEXT_MUTED, spacingAfter: 4 });
        }
        if (qc.responsibleName) {
          addWrappedText(doc, cursor, `Ansvarlig: ${qc.responsibleName}`, { size: 9, color: TEXT_MUTED, spacingAfter: 4 });
        }

        const photos = qc.deviationPhotoDataUrls ?? [];
        if (photos.length > 0) {
          const THUMB_W = 120;
          const THUMB_H = 90;
          const COLS = 4;
          const GAP = 8;
          let thumbX = MARGIN;
          let thumbRowY = cursor.y;
          photos.forEach((dataUrl, i) => {
            if (i % COLS === 0) {
              ensureSpace(doc, cursor, THUMB_H + 20);
              thumbRowY = cursor.y;
              cursor.y += THUMB_H + 16;
              thumbX = MARGIN;
            }
            try {
              doc.addImage(dataUrl, 'JPEG', thumbX, thumbRowY, THUMB_W, THUMB_H, undefined, 'FAST');
            } catch {
              doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
              doc.rect(thumbX, thumbRowY, THUMB_W, THUMB_H);
            }
            thumbX += THUMB_W + GAP;
          });
          cursor.y += 10;
        }
        cursor.y += 6;
      });
    } else {
      addWrappedText(doc, cursor, 'Ingen kvalitetssikring registreret.', {
        size: 10, color: TEXT_MUTED, spacingAfter: 10,
      });
    }
  }

  // ── 6. Mangelliste ─────────────────────────────────────────────────────────
  if (settings.showSnagList) {
    sectionHeader(doc, cursor, 'Mangelliste (snag list)');
    if (snags && snags.length > 0) {
      drawTable(doc, cursor,
        [
          { header: 'Mangel / defekt', width: 350 },
          { header: 'Udbedringsfrist', width: 149, align: 'right' },
        ],
        snags.map(s => [s.description, s.deadline ? fmtDay(s.deadline) : '–'])
      );
    } else {
      addWrappedText(doc, cursor, 'Ingen mangler registreret ved overdragelse.', {
        size: 10, color: TEXT_MUTED, spacingAfter: 10,
      });
    }
  }

  // ── 7. Garanti & AB18 ──────────────────────────────────────────────────────
  if (settings.showWarranty) {
    sectionHeader(doc, cursor, 'Garanti & AB18');
    addWrappedText(doc, cursor,
      'Det udførte arbejde er garanteret mod fejl og mangler i overensstemmelse med AB18 (Almindelige Betingelser for arbejder og leverancer i Bygge- og Anlægsvirksomhed 2018), afsnit om mangler og reklamation.',
      { size: 10, color: TEXT_MUTED, spacingAfter: 8 }
    );
    addWrappedText(doc, cursor,
      'Garantiperioden løber i 5 år fra afleveringsdatoen for væsentlige mangler og 1 år for øvrige mangler, medmindre andet er skriftligt aftalt.',
      { size: 10, color: TEXT_MUTED, spacingAfter: 10 }
    );
  }

  // ── 8. Underskrifter ───────────────────────────────────────────────────────
  if (settings.showSignatures) {
    sectionHeader(doc, cursor, 'Digitale underskrifter');
    addWrappedText(doc, cursor,
      'Begge parter bekræfter ved nedenstående underskrifter, at opgaven er udført og godkendt i henhold til den indgåede aftale.',
      { size: 10, color: TEXT_MUTED, spacingAfter: 16 }
    );

    ensureSpace(doc, cursor, 160);

    // Side-by-side: supplier left, mester right
    const halfW = (CONTENT_W - 20) / 2;
    const rightX = MARGIN + halfW + 20;
    const startY = cursor.y;

    // Supplier signature
    if (supplierSignatureDataUrl) {
      try {
        doc.addImage(supplierSignatureDataUrl, 'PNG', MARGIN, startY, halfW, 60, undefined, 'FAST');
      } catch { /* skip */ }
    } else {
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.rect(MARGIN, startY, halfW, 60);
    }

    // Mester signature
    if (mesterSignatureDataUrl) {
      try {
        doc.addImage(mesterSignatureDataUrl, 'PNG', rightX, startY, halfW, 60, undefined, 'FAST');
      } catch { /* skip */ }
    } else {
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.rect(rightX, startY, halfW, 60);
    }

    cursor.y = startY + 60 + 8;
    doc.setDrawColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, cursor.y, MARGIN + halfW, cursor.y);
    doc.line(rightX, cursor.y, rightX + halfW, cursor.y);
    cursor.y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text('Underentreprenør', MARGIN, cursor.y);
    doc.text('Mester / Projektejer', rightX, cursor.y);
    cursor.y += 14;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(supplierSignatureName || partnerName || '–', MARGIN, cursor.y);
    doc.text(mesterSignatureName || mesterName || '–', rightX, cursor.y);
    cursor.y += 12;
    doc.text(fmtTs(supplierSignatureTimestamp), MARGIN, cursor.y);
    doc.text(fmtTs(mesterSignatureTimestamp), rightX, cursor.y);
    cursor.y += 20;
  }

  drawFooters(doc);
  return doc;
};
