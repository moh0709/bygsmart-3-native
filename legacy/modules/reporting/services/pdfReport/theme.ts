// ── Layout constants (A4 portrait, pt) ───────────────────────────────────────

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 48;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const FOOTER_H = 40;
export const BOTTOM_LIMIT = PAGE_H - MARGIN - FOOTER_H;

export const BRAND: [number, number, number] = [30, 95, 255]; // #1E5FFF
export const TEXT_DARK: [number, number, number] = [17, 24, 39];
export const TEXT_MUTED: [number, number, number] = [107, 114, 128];
export const ZEBRA: [number, number, number] = [243, 244, 246];
export const LINE: [number, number, number] = [229, 231, 235];
export const SUCCESS: [number, number, number] = [22, 163, 74];
export const WARNING: [number, number, number] = [217, 119, 6];
export const DANGER: [number, number, number] = [220, 38, 38];

export const bandColor = (score: number): [number, number, number] =>
  score >= 80 ? SUCCESS : score >= 60 ? WARNING : DANGER;
