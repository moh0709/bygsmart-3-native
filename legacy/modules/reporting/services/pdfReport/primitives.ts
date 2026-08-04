import jsPDF from 'jspdf';
import { BOTTOM_LIMIT, MARGIN, CONTENT_W, BRAND, TEXT_DARK, LINE, PAGE_H, PAGE_W, TEXT_MUTED } from './theme';

// ── Cursor + primitives ──────────────────────────────────────────────────────

export interface Cursor {
  y: number;
}

export const ensureSpace = (doc: jsPDF, cursor: Cursor, needed: number): void => {
  if (cursor.y + needed > BOTTOM_LIMIT) {
    doc.addPage();
    cursor.y = MARGIN;
  }
};

export interface WrappedTextOptions {
  x?: number;
  maxWidth?: number;
  size?: number;
  style?: 'normal' | 'bold' | 'italic';
  color?: [number, number, number];
  lineHeight?: number;
  /** Prefix the first line with a bullet and indent subsequent lines. */
  bullet?: boolean;
  spacingAfter?: number;
}

/** Word-wrapped text with automatic page breaks. Returns lines drawn. */
export const addWrappedText = (
  doc: jsPDF,
  cursor: Cursor,
  text: string,
  options: WrappedTextOptions = {}
): number => {
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
  const lines: string[] = doc.splitTextToSize(text, maxWidth - indent);
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

export const sectionHeader = (doc: jsPDF, cursor: Cursor, title: string): void => {
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

// ── Footer on every page ─────────────────────────────────────────────────────

export const drawFooters = (doc: jsPDF): void => {
  const pageCount = doc.getNumberOfPages();
  const dateText = `Genereret ${new Date().toLocaleDateString('da-DK', {
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
    doc.text('Genereret af BygSmart', PAGE_W - MARGIN, y, { align: 'right' });
  }
};
