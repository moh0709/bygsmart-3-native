import jsPDF from 'jspdf';
import { MARGIN, CONTENT_W, BRAND, ZEBRA, TEXT_DARK, BOTTOM_LIMIT } from './theme';
import { Cursor, ensureSpace } from './primitives';

// ── Table renderer with zebra rows + page breaks ─────────────────────────────

export interface TableColumn {
  header: string;
  /** Width in pt; widths should sum to CONTENT_W. */
  width: number;
  align?: 'left' | 'right';
}

export const TABLE_FONT_SIZE = 9;
export const CELL_PAD_X = 6;
export const CELL_PAD_Y = 5;
export const CELL_LINE_H = TABLE_FONT_SIZE * 1.3;

export const drawTableHeader = (doc: jsPDF, cursor: Cursor, columns: TableColumn[]): void => {
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

export interface TableRowOptions {
  bold?: boolean;
  fill?: [number, number, number] | null;
}

export const drawTableRow = (
  doc: jsPDF,
  cursor: Cursor,
  columns: TableColumn[],
  cells: string[],
  zebra: boolean,
  options: TableRowOptions = {}
): void => {
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(TABLE_FONT_SIZE);

  const wrapped = columns.map((col, i) =>
    doc.splitTextToSize(cells[i] ?? '', col.width - CELL_PAD_X * 2) as string[]
  );
  const lineCount = Math.max(1, ...wrapped.map(w => w.length));
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
export const drawTable = (
  doc: jsPDF,
  cursor: Cursor,
  columns: TableColumn[],
  rows: string[][],
  totalRow?: string[]
): void => {
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
