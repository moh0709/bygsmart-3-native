// ─────────────────────────────────────────────────────────────────────────────
// Branded vector PDF export for calculators (A4 landscape).
//
// Text, tables, header and footer are pure jsPDF vector drawing.
// Only the calculator infographic/diagram is rasterised via html2canvas-pro
// and placed fit-to-width inside the content column.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf';
import type React from 'react';

// ── A4 landscape geometry (pt) ───────────────────────────────────────────────

const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 36;
const BOTTOM_LIMIT = PAGE_H - MARGIN - FOOTER_H;

// ── Brand palette ────────────────────────────────────────────────────────────

const BRAND: [number, number, number] = [30, 95, 255];
const TEXT_DARK: [number, number, number] = [17, 24, 39];
const TEXT_MUTED: [number, number, number] = [107, 114, 128];
const ZEBRA: [number, number, number] = [243, 244, 246];
const LINE: [number, number, number] = [229, 231, 235];
const HIGHLIGHT_BG: [number, number, number] = [231, 238, 255];
const DANGER: [number, number, number] = [220, 38, 38];

// ── da-DK formatting ─────────────────────────────────────────────────────────

const todayDk = (): string =>
  new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });

// ── Shared primitives ────────────────────────────────────────────────────────

interface Cursor {
  y: number;
  page: number;
}

const ensureSpace = (doc: jsPDF, cursor: Cursor, needed: number): void => {
  if (cursor.y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    cursor.page += 1;
    cursor.y = MARGIN;
  }
};

interface WrappedTextOptions {
  x?: number;
  maxWidth?: number;
  size?: number;
  style?: 'normal' | 'bold' | 'italic';
  color?: [number, number, number];
  lineHeight?: number;
  spacingAfter?: number;
}

const addWrappedText = (
  doc: jsPDF,
  cursor: Cursor,
  text: string,
  options: WrappedTextOptions = {}
): void => {
  const {
    x = MARGIN,
    maxWidth = CONTENT_W - (x - MARGIN),
    size = 10,
    style = 'normal',
    color = TEXT_DARK,
    lineHeight = size * 1.4,
    spacingAfter = 0,
  } = options;

  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);

  const lines: string[] = doc.splitTextToSize(text, maxWidth);
  lines.forEach(line => {
    ensureSpace(doc, cursor, lineHeight);
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(line, x, cursor.y);
    cursor.y += lineHeight;
  });
  cursor.y += spacingAfter;
};

const sectionHeader = (doc: jsPDF, cursor: Cursor, title: string): void => {
  ensureSpace(doc, cursor, 36);
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(MARGIN, cursor.y - 9, 3, 13, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(title, MARGIN + 10, cursor.y + 1);
  cursor.y += 10;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, cursor.y, MARGIN + CONTENT_W, cursor.y);
  cursor.y += 10;
};

// ── Table renderer ───────────────────────────────────────────────────────────

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

const TABLE_FONT_SIZE = 9;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 4;
const CELL_LINE_H = TABLE_FONT_SIZE * 1.3;

const drawTableHeader = (doc: jsPDF, cursor: Cursor, columns: TableColumn[]): void => {
  const h = CELL_LINE_H + CELL_PAD_Y * 2;
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(MARGIN, cursor.y, CONTENT_W, h, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setTextColor(255, 255, 255);
  let x = MARGIN;
  columns.forEach(col => {
    const tx = col.align === 'right' ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
    doc.text(col.header, tx, cursor.y + CELL_PAD_Y + TABLE_FONT_SIZE, {
      align: col.align === 'right' ? 'right' : 'left',
    });
    x += col.width;
  });
  cursor.y += h;
};

const drawTableRow = (
  doc: jsPDF,
  cursor: Cursor,
  columns: TableColumn[],
  cells: string[],
  zebra: boolean,
  bold = false,
  fillOverride?: [number, number, number] | null
): void => {
  const wrapped = columns.map((col, i) =>
    doc.splitTextToSize(cells[i] ?? '', col.width - CELL_PAD_X * 2) as string[]
  );
  const lineCount = Math.max(1, ...wrapped.map(w => w.length));
  const rowH = lineCount * CELL_LINE_H + CELL_PAD_Y * 2;

  if (cursor.y + rowH > BOTTOM_LIMIT) {
    doc.addPage();
    cursor.y = MARGIN;
    drawTableHeader(doc, cursor, columns);
  }

  const fill = fillOverride !== undefined ? fillOverride : zebra ? ZEBRA : null;
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(MARGIN, cursor.y, CONTENT_W, rowH, 'F');
  }

  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(TABLE_FONT_SIZE);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  let x = MARGIN;
  columns.forEach((col, i) => {
    wrapped[i].forEach((line, li) => {
      const tx = col.align === 'right' ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
      doc.text(line, tx, cursor.y + CELL_PAD_Y + TABLE_FONT_SIZE + li * CELL_LINE_H, {
        align: col.align === 'right' ? 'right' : 'left',
      });
    });
    x += col.width;
  });
  cursor.y += rowH;
};

const drawTable = (
  doc: jsPDF,
  cursor: Cursor,
  columns: TableColumn[],
  rows: string[][],
  highlightLast = false
): void => {
  ensureSpace(doc, cursor, (CELL_LINE_H + CELL_PAD_Y * 2) * 3);
  drawTableHeader(doc, cursor, columns);
  rows.forEach((row, i) => {
    const isLast = highlightLast && i === rows.length - 1;
    drawTableRow(doc, cursor, columns, row, i % 2 === 1, isLast, isLast ? HIGHLIGHT_BG : undefined);
  });
  cursor.y += 10;
};

// ── Page-level brand elements ────────────────────────────────────────────────

const drawPageHeader = (doc: jsPDF, toolName: string, category: string | undefined, mode: string | undefined): void => {
  // Blue top bar
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, PAGE_W, 8, 'F');

  // Wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.text('BygSmart', MARGIN, 36);

  // Tool name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text(toolName, MARGIN + 100, 36);

  // Category / mode / date
  const meta = [
    category,
    mode ? `Tilstand: ${mode}` : null,
    `Dato: ${todayDk()}`,
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text(meta, MARGIN + 100, 48);

  // Horizontal divider
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 56, PAGE_W - MARGIN, 56);
};

const drawFooters = (doc: jsPDF): void => {
  const pageCount = doc.getNumberOfPages();
  const dateText = `Genereret ${todayDk()}`;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = PAGE_H - 18;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y - 8, PAGE_W - MARGIN, y - 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(dateText, MARGIN, y);
    doc.text(`Side ${i} af ${pageCount}`, PAGE_W / 2, y, { align: 'center' });
    doc.text('BygSmart beregningsrapport', PAGE_W - MARGIN, y, { align: 'right' });
  }
};

// ── Public data types ────────────────────────────────────────────────────────

export interface CalculatorReportInput {
  label: string;
  value: string;
  unit?: string;
}

export interface CalculatorResultCard {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}

export interface CalculatorBreakdownRow {
  label: string;
  value: string;
  unit?: string;
}

export interface CalculatorStandardEntry {
  code: string;
  clause?: string;
  note?: string;
}

export interface CalculatorReportData {
  toolName: string;
  category?: string;
  mode?: string;
  inputs: CalculatorReportInput[];
  results: CalculatorResultCard[];
  breakdown?: CalculatorBreakdownRow[];
  formula?: string;
  /** Plain-text standards summary (legacy). */
  standards?: string;
  /** Structured standards list — rendered as a table in the PDF. Takes precedence over plain `standards`. */
  standardsStruktureret?: CalculatorStandardEntry[];
  /** Optional worked-through example rendered below the formula. */
  workedExample?: string;
  safetyDisclaimer?: string;
  /** ref to the infographic DOM node to capture with html2canvas-pro.
   *  Accepts both HTML wrapper elements and root SVG elements forwarded by viz components. */
  infographicRef?: React.RefObject<HTMLElement | SVGElement | null>;
}

// ── Main entry ───────────────────────────────────────────────────────────────

export const generateCalculatorReport = async (data: CalculatorReportData): Promise<jsPDF> => {
  const { toolName, category, mode, inputs, results, breakdown, formula, standards, standardsStruktureret, workedExample, safetyDisclaimer, infographicRef } = data;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const cursor: Cursor = { y: 70, page: 1 };

  // ── Page 1: header drawn once ────────────────────────────────────────────
  drawPageHeader(doc, toolName, category, mode);

  // ── Two-column layout ─────────────────────────────────────────────────────
  const COL_GAP = 24;
  const COL_W = (CONTENT_W - COL_GAP) / 2;

  // Left column cursor, right column cursor
  const leftCursor: Cursor = { y: 70, page: 1 };
  const rightCursor: Cursor = { y: 70, page: 1 };

  // ── Left: Inputs table ───────────────────────────────────────────────────
  // Section header drawn manually for two-column layout
  const drawColSectionHeader = (cCursor: Cursor, title: string, colX: number, colW: number): void => {
    ensureSpace(doc, cCursor, 30);
    doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.rect(colX, cCursor.y - 8, 3, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(title, colX + 9, cCursor.y + 1);
    cCursor.y += 9;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.5);
    doc.line(colX, cCursor.y, colX + colW, cCursor.y);
    cCursor.y += 10;
  };

  const drawColTable = (
    cCursor: Cursor,
    colX: number,
    colW: number,
    columns: TableColumn[],
    rows: string[][]
  ): void => {
    const scaledCols = columns.map(c => ({ ...c, width: (c.width / CONTENT_W) * colW }));
    const headerH = CELL_LINE_H + CELL_PAD_Y * 2;

    const drawColHeader = (): void => {
      ensureSpace(doc, cCursor, headerH);
      doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
      doc.rect(colX, cCursor.y, colW, headerH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(TABLE_FONT_SIZE);
      doc.setTextColor(255, 255, 255);
      let hx = colX;
      scaledCols.forEach(col => {
        const tx = col.align === 'right' ? hx + col.width - CELL_PAD_X : hx + CELL_PAD_X;
        doc.text(col.header, tx, cCursor.y + CELL_PAD_Y + TABLE_FONT_SIZE, {
          align: col.align === 'right' ? 'right' : 'left',
        });
        hx += col.width;
      });
      cCursor.y += headerH;
    };

    drawColHeader();

    rows.forEach((row, ri) => {
      const wrapped = scaledCols.map((col, ci) =>
        doc.splitTextToSize(row[ci] ?? '', col.width - CELL_PAD_X * 2) as string[]
      );
      const lc = Math.max(1, ...wrapped.map(w => w.length));
      const rh = lc * CELL_LINE_H + CELL_PAD_Y * 2;

      if (cCursor.y + rh > BOTTOM_LIMIT) {
        doc.addPage();
        cCursor.page += 1;
        cCursor.y = MARGIN;
        drawColHeader();
      }

      if (ri % 2 === 1) {
        doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
        doc.rect(colX, cCursor.y, colW, rh, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(TABLE_FONT_SIZE);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      let rx = colX;
      scaledCols.forEach((col, ci) => {
        wrapped[ci].forEach((line, li) => {
          const tx = col.align === 'right' ? rx + col.width - CELL_PAD_X : rx + CELL_PAD_X;
          doc.text(line, tx, cCursor.y + CELL_PAD_Y + TABLE_FONT_SIZE + li * CELL_LINE_H, {
            align: col.align === 'right' ? 'right' : 'left',
          });
        });
        rx += col.width;
      });
      cCursor.y += rh;
    });
    cCursor.y += 10;
  };

  // Left col X
  const leftX = MARGIN;
  const rightX = MARGIN + COL_W + COL_GAP;

  // Inputs table (left column)
  drawColSectionHeader(leftCursor, 'Inputparametre', leftX, COL_W);
  if (inputs.length > 0) {
    const inputCols: TableColumn[] = [
      { header: 'Parameter', width: CONTENT_W * 0.55 },
      { header: 'Værdi', width: CONTENT_W * 0.25, align: 'right' },
      { header: 'Enhed', width: CONTENT_W * 0.20 },
    ];
    const inputRows = inputs.map(inp => [inp.label, inp.value, inp.unit ?? '']);
    drawColTable(leftCursor, leftX, COL_W, inputCols, inputRows);
  }

  // Formula, worked example & standards (left column)
  if (formula || workedExample || standards || (standardsStruktureret && standardsStruktureret.length > 0)) {
    drawColSectionHeader(leftCursor, 'Formel & standarder', leftX, COL_W);
    if (formula) {
      addWrappedText(doc, leftCursor, formula, {
        x: leftX,
        maxWidth: COL_W,
        size: 9,
        style: 'italic',
        color: TEXT_DARK,
        spacingAfter: 6,
      });
    }
    if (workedExample) {
      addWrappedText(doc, leftCursor, 'Regneeksempel:', {
        x: leftX,
        maxWidth: COL_W,
        size: 8,
        style: 'bold',
        color: TEXT_MUTED,
        spacingAfter: 2,
      });
      addWrappedText(doc, leftCursor, workedExample, {
        x: leftX,
        maxWidth: COL_W,
        size: 8,
        color: TEXT_DARK,
        spacingAfter: 6,
      });
    }
    if (standardsStruktureret && standardsStruktureret.length > 0) {
      const stdCols: TableColumn[] = [
        { header: 'Kode', width: CONTENT_W * 0.35 },
        { header: 'Paragraf', width: CONTENT_W * 0.15 },
        { header: 'Note', width: CONTENT_W * 0.50 },
      ];
      const stdRows = standardsStruktureret.map(s => [s.code, s.clause ?? '—', s.note ?? '']);
      drawColTable(leftCursor, leftX, COL_W, stdCols, stdRows);
    } else if (standards) {
      addWrappedText(doc, leftCursor, standards, {
        x: leftX,
        maxWidth: COL_W,
        size: 8,
        color: TEXT_MUTED,
      });
    }
    leftCursor.y += 8;
  }

  // ── Right: Result cards then breakdown ───────────────────────────────────
  // Ensure jsPDF current page matches the right column's starting page before drawing
  doc.setPage(rightCursor.page);

  // Results cards
  drawColSectionHeader(rightCursor, 'Resultater', rightX, COL_W);
  results.forEach(card => {
    ensureSpace(doc, rightCursor, 36);
    const cardH = 34;
    const fill: [number, number, number] = card.highlight ? HIGHLIGHT_BG : ZEBRA;
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(rightX, rightCursor.y, COL_W, cardH, 'F');
    if (card.highlight) {
      doc.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
      doc.setLineWidth(0.75);
      doc.rect(rightX, rightCursor.y, COL_W, cardH, 'S');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(card.label, rightX + 8, rightCursor.y + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(card.highlight ? 15 : 13);
    doc.setTextColor(card.highlight ? BRAND[0] : TEXT_DARK[0], card.highlight ? BRAND[1] : TEXT_DARK[1], card.highlight ? BRAND[2] : TEXT_DARK[2]);
    const valText = card.unit ? `${card.value} ${card.unit}` : card.value;
    doc.text(valText, rightX + 8, rightCursor.y + 27);
    rightCursor.y += cardH + 4;
  });
  rightCursor.y += 6;

  // Breakdown table (right column)
  if (breakdown && breakdown.length > 0) {
    drawColSectionHeader(rightCursor, 'Detaljeret opgørelse', rightX, COL_W);
    const brkCols: TableColumn[] = [
      { header: 'Post', width: CONTENT_W * 0.6 },
      { header: 'Værdi', width: CONTENT_W * 0.25, align: 'right' },
      { header: 'Enhed', width: CONTENT_W * 0.15 },
    ];
    const brkRows = breakdown.map(r => [r.label, r.value, r.unit ?? '']);
    drawColTable(rightCursor, rightX, COL_W, brkCols, brkRows);
  }

  // ── Full-width: Infographic ───────────────────────────────────────────────
  // Sync to the furthest page then take the higher y within that page
  const finalColPage = Math.max(leftCursor.page, rightCursor.page);
  doc.setPage(finalColPage);
  cursor.page = finalColPage;
  if (leftCursor.page === rightCursor.page) {
    cursor.y = Math.max(leftCursor.y, rightCursor.y) + 14;
  } else {
    cursor.y = (leftCursor.page > rightCursor.page ? leftCursor.y : rightCursor.y) + 14;
  }

  if (infographicRef?.current) {
    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(infographicRef.current as unknown as HTMLElement, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const availH = BOTTOM_LIMIT - cursor.y;
      const imgW = CONTENT_W;
      const imgH = (canvas.height / canvas.width) * imgW;

      if (imgH > 0) {
        ensureSpace(doc, cursor, Math.min(imgH, availH - 10));
        const placedH = Math.min(imgH, BOTTOM_LIMIT - cursor.y);
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', MARGIN, cursor.y, imgW, placedH);
        cursor.y += placedH + 10;
      }
    } catch {
      // infographic capture optional — continue without
    }
  }

  // ── Safety disclaimer ─────────────────────────────────────────────────────
  if (safetyDisclaimer) {
    const DISC_LINE_H = 10;
    const DISC_PAD = 6;
    const DISC_TITLE_H = 16;

    doc.setFontSize(8);
    const allDisclaimerLines: string[] = doc.splitTextToSize(safetyDisclaimer, CONTENT_W - 24);

    const drawDisclaimerChunk = (lines: string[], showTitle: boolean): void => {
      const chunkH = (showTitle ? DISC_TITLE_H : 0) + lines.length * DISC_LINE_H + DISC_PAD * 2;
      const dY = cursor.y;
      doc.setFillColor(255, 243, 205);
      doc.rect(MARGIN, dY, CONTENT_W, chunkH, 'F');
      doc.setDrawColor(DANGER[0], DANGER[1], DANGER[2]);
      doc.setLineWidth(0.75);
      doc.rect(MARGIN, dY, 4, chunkH, 'F');
      let ty = dY + DISC_PAD;
      if (showTitle) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(DANGER[0], DANGER[1], DANGER[2]);
        ty += 8.5;
        doc.text('SIKKERHEDSANSVAR', MARGIN + 10, ty);
        ty += DISC_LINE_H;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      lines.forEach(line => {
        doc.text(line, MARGIN + 10, ty);
        ty += DISC_LINE_H;
      });
      cursor.y += chunkH + 6;
    };

    let remaining = [...allDisclaimerLines];
    let isFirst = true;
    while (remaining.length > 0) {
      const titleSpace = isFirst ? DISC_TITLE_H : 0;
      const available = BOTTOM_LIMIT - cursor.y - DISC_PAD * 2 - titleSpace;
      const maxLines = Math.max(1, Math.floor(available / DISC_LINE_H));
      const chunk = remaining.splice(0, maxLines);
      ensureSpace(doc, cursor, titleSpace + chunk.length * DISC_LINE_H + DISC_PAD * 2);
      drawDisclaimerChunk(chunk, isFirst);
      isFirst = false;
      if (remaining.length > 0) {
        doc.addPage();
        cursor.page += 1;
        cursor.y = MARGIN;
      }
    }
  }

  // ── Footers (must be last) ────────────────────────────────────────────────
  drawFooters(doc);

  return doc;
};

// ── Fallback: full-page landscape screenshot ──────────────────────────────────

export const generateFallbackLandscapePdf = async (
  targetRef: React.RefObject<HTMLElement | null>,
  filename: string,
): Promise<void> => {
  if (!targetRef.current) return;

  const { default: html2canvas } = await import('html2canvas-pro');
  const canvas = await html2canvas(targetRef.current, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const imgData = canvas.toDataURL('image/png');

  // Fit image width to page; tile vertically across pages if taller than one page
  const imgW = PAGE_W;
  const totalImgH = (canvas.height / canvas.width) * PAGE_W;
  let heightLeft = totalImgH;
  let position = 0;

  doc.addImage(imgData, 'PNG', 0, position, imgW, totalImgH);
  heightLeft -= PAGE_H;

  while (heightLeft > 0) {
    position -= PAGE_H;
    doc.addPage();
    doc.addImage(imgData, 'PNG', 0, position, imgW, totalImgH);
    heightLeft -= PAGE_H;
  }

  drawFooters(doc);
  doc.save(filename);
};
