// ─────────────────────────────────────────────────────────────────────────────
// Senior-engineer validation engine for onboarding/plan review.
//
// Strategy: deterministic checks run first (fast, offline, always available),
// then a single aiChat call (feature 'onboarding-validation') asks for a
// senior engineer + project manager review in Danish. Results are merged.
// On AI failure the deterministic-only review is returned (graceful).
// ─────────────────────────────────────────────────────────────────────────────

import { aiChat } from './aiOrchestration';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlanDraftTask {
  title: string;
  quantity?: number;
  unit?: string;
  materials?: string[];
}

export interface PlanDraftPurchase {
  name: string;
  quantity: number;
  unit?: string;
  /** Unit price in øre (optional). */
  unitPriceOre?: number;
}

export interface PlanDraft {
  projectType?: string;
  description?: string;
  dimensions?: Record<string, string>;
  tasks: PlanDraftTask[];
  purchases: PlanDraftPurchase[];
}

export type ReviewSeverity = 'ok' | 'warn' | 'error';

export interface PlanReviewItem {
  /** Reference, e.g. 'task:2', 'purchase:0' or 'plan'. */
  ref: string;
  severity: ReviewSeverity;
  message: string;
  suggestion?: string;
  suggestedQuantity?: number;
}

export interface PlanReview {
  /** 0–100. */
  overallConfidence: number;
  items: PlanReviewItem[];
  missingTasks: string[];
  missingMaterials: string[];
  sequencingNotes: string[];
}

export interface QuickCheckResult {
  status: 'ok' | 'warn';
  message: string;
  suggestedRange?: string;
}

// ── Deterministic heuristics ─────────────────────────────────────────────────

const normalizeUnit = (unit?: string): string =>
  (unit ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace('m2', 'm²')
    .replace('m3', 'm³')
    .replace(/^l$/, 'liter')
    .trim();

/** Plausible quantity ranges per (normalized) unit. */
const UNIT_RANGES: Record<string, { max: number; label: string }> = {
  'm²': { max: 2000, label: 'kvadratmeter' },
  'm³': { max: 500, label: 'kubikmeter' },
  liter: { max: 1000, label: 'liter' },
  stk: { max: 50000, label: 'styk' },
  kg: { max: 20000, label: 'kilo' },
  m: { max: 5000, label: 'meter' },
  poser: { max: 500, label: 'poser' },
  ruller: { max: 200, label: 'ruller' },
  plader: { max: 1000, label: 'plader' },
  pakker: { max: 500, label: 'pakker' },
  timer: { max: 5000, label: 'timer' },
};

/** Item-name keyword → expected units + plausible max quantity per unit. */
const ITEM_PROFILES: Array<{
  keywords: string[];
  expectedUnits: string[];
  perUnitMax?: Record<string, number>;
  label: string;
}> = [
  { keywords: ['maling', 'grunder', 'primer', 'lak'], expectedUnits: ['liter', 'stk'], perUnitMax: { liter: 300, stk: 60 }, label: 'maling' },
  { keywords: ['beton', 'cement'], expectedUnits: ['m³', 'liter', 'kg', 'poser', 'stk'], perUnitMax: { 'm³': 100, kg: 10000, poser: 400 }, label: 'beton/cement' },
  { keywords: ['flise', 'fliser', 'klinke'], expectedUnits: ['stk', 'm²', 'pakker'], perUnitMax: { stk: 20000, 'm²': 1000 }, label: 'fliser' },
  { keywords: ['gips', 'gipsplade'], expectedUnits: ['stk', 'plader', 'm²'], perUnitMax: { stk: 500, 'm²': 1000 }, label: 'gipsplader' },
  { keywords: ['isolering', 'batts', 'rockwool', 'glasuld'], expectedUnits: ['stk', 'm²', 'pakker', 'ruller'], perUnitMax: { stk: 2000, 'm²': 2000 }, label: 'isolering' },
  { keywords: ['mursten', 'blokke', 'teglsten'], expectedUnits: ['stk'], perUnitMax: { stk: 50000 }, label: 'mursten' },
  { keywords: ['mørtel', 'puds', 'spartel'], expectedUnits: ['kg', 'poser', 'm³', 'liter'], perUnitMax: { kg: 5000, poser: 300 }, label: 'mørtel/puds' },
  { keywords: ['trægulv', 'planker', 'laminat', 'parket'], expectedUnits: ['m²', 'pakker', 'stk'], perUnitMax: { 'm²': 1000 }, label: 'gulv' },
  { keywords: ['vindue', 'vinduer', 'dør', 'døre'], expectedUnits: ['stk'], perUnitMax: { stk: 100 }, label: 'vinduer/døre' },
  { keywords: ['kabel', 'ledning'], expectedUnits: ['m', 'ruller'], perUnitMax: { m: 5000 }, label: 'kabel' },
  { keywords: ['fugemasse', 'silikone'], expectedUnits: ['stk', 'patroner', 'liter'], perUnitMax: { stk: 200 }, label: 'fugemasse' },
  { keywords: ['skrue', 'søm', 'beslag'], expectedUnits: ['stk', 'pakker', 'kg'], perUnitMax: { stk: 100000 }, label: 'befæstigelse' },
];

const findProfile = (name: string) => {
  const lower = name.toLowerCase();
  return ITEM_PROFILES.find((p) => p.keywords.some((k) => lower.includes(k)));
};

const checkQuantityDeterministic = (
  name: string,
  quantity: number,
  unit?: string
): { severity: ReviewSeverity; message: string; suggestion?: string } | null => {
  if (!Number.isFinite(quantity)) {
    return { severity: 'error', message: `Mængden for "${name}" er ikke et gyldigt tal.` };
  }
  if (quantity <= 0) {
    return {
      severity: 'error',
      message: `Mængden for "${name}" er ${quantity} — den skal være større end nul.`,
      suggestion: 'Angiv den faktiske mængde, før planen godkendes.',
    };
  }

  const normUnit = normalizeUnit(unit);
  const profile = findProfile(name);

  // Unit mismatch
  if (profile && normUnit && !profile.expectedUnits.includes(normUnit)) {
    return {
      severity: 'warn',
      message: `Enheden "${unit}" er usædvanlig for ${profile.label} ("${name}"). Forventet: ${profile.expectedUnits.join(', ')}.`,
      suggestion: `Tjek om enheden burde være ${profile.expectedUnits[0]}.`,
    };
  }

  // Outlier vs item profile
  const profileMax = profile?.perUnitMax?.[normUnit];
  if (profileMax !== undefined && quantity > profileMax) {
    return {
      severity: 'warn',
      message: `${quantity} ${unit ?? ''} ${profile!.label} ("${name}") virker meget højt for et typisk projekt.`,
      suggestion: `Dobbelttjek mængden — typisk under ${profileMax} ${unit ?? ''}.`,
    };
  }

  // Outlier vs generic unit range
  const unitRange = UNIT_RANGES[normUnit];
  if (unitRange && quantity > unitRange.max) {
    return {
      severity: 'warn',
      message: `${quantity} ${unit ?? ''} for "${name}" er en usædvanlig stor mængde ${unitRange.label}.`,
      suggestion: 'Dobbelttjek mængden mod projektets dimensioner.',
    };
  }

  return null;
};

const runDeterministicChecks = (draft: PlanDraft): PlanReviewItem[] => {
  const items: PlanReviewItem[] = [];

  // Purchases
  draft.purchases.forEach((purchase, i) => {
    const finding = checkQuantityDeterministic(purchase.name, purchase.quantity, purchase.unit);
    if (finding) {
      items.push({ ref: `purchase:${i}`, ...finding });
    }
    if (purchase.unitPriceOre !== undefined && purchase.unitPriceOre < 0) {
      items.push({
        ref: `purchase:${i}`,
        severity: 'error',
        message: `Prisen for "${purchase.name}" er negativ.`,
      });
    }
  });

  // Tasks with quantities
  draft.tasks.forEach((task, i) => {
    if (task.quantity !== undefined) {
      const finding = checkQuantityDeterministic(task.title, task.quantity, task.unit);
      if (finding) {
        items.push({ ref: `task:${i}`, ...finding });
      }
    }
    if (!task.title.trim()) {
      items.push({ ref: `task:${i}`, severity: 'error', message: 'Opgaven mangler en titel.' });
    }
  });

  // Duplicate purchases
  const seen = new Map<string, number>();
  draft.purchases.forEach((purchase, i) => {
    const key = purchase.name.trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) {
      items.push({
        ref: `purchase:${i}`,
        severity: 'warn',
        message: `"${purchase.name}" optræder flere gange på indkøbslisten (også som nr. ${seen.get(key)! + 1}).`,
        suggestion: 'Overvej at lægge mængderne sammen i én linje.',
      });
    } else {
      seen.set(key, i);
    }
  });

  // Duplicate tasks
  const seenTasks = new Map<string, number>();
  draft.tasks.forEach((task, i) => {
    const key = task.title.trim().toLowerCase();
    if (!key) return;
    if (seenTasks.has(key)) {
      items.push({
        ref: `task:${i}`,
        severity: 'warn',
        message: `Opgaven "${task.title}" optræder flere gange.`,
      });
    } else {
      seenTasks.set(key, i);
    }
  });

  return items;
};

const confidenceFromItems = (items: PlanReviewItem[], draft: PlanDraft): number => {
  const errors = items.filter((i) => i.severity === 'error').length;
  const warns = items.filter((i) => i.severity === 'warn').length;
  let score = 100 - errors * 20 - warns * 8;
  if (draft.tasks.length === 0) score -= 15;
  if (draft.purchases.length === 0) score -= 10;
  return Math.max(5, Math.min(100, score));
};

// ── AI JSON parsing (defensive) ──────────────────────────────────────────────

const parseAiJson = <T>(text: string): T | null => {
  try {
    let cleaned = text.trim();
    // Strip markdown fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    // Grab the outermost JSON object if extra prose surrounds it
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
};

interface AiReviewResponse {
  overallConfidence?: number;
  items?: Array<{
    ref?: string;
    severity?: string;
    message?: string;
    suggestion?: string;
    suggestedQuantity?: number;
  }>;
  missingTasks?: string[];
  missingMaterials?: string[];
  sequencingNotes?: string[];
}

const VALID_SEVERITIES: ReviewSeverity[] = ['ok', 'warn', 'error'];

const sanitizeAiItems = (raw: AiReviewResponse['items']): PlanReviewItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.message === 'string' && item.message.trim())
    .map((item) => ({
      ref: typeof item.ref === 'string' && item.ref ? item.ref : 'plan',
      severity: VALID_SEVERITIES.includes(item.severity as ReviewSeverity)
        ? (item.severity as ReviewSeverity)
        : 'warn',
      message: item.message!.trim(),
      suggestion: typeof item.suggestion === 'string' ? item.suggestion : undefined,
      suggestedQuantity:
        typeof item.suggestedQuantity === 'number' && Number.isFinite(item.suggestedQuantity)
          ? item.suggestedQuantity
          : undefined,
    }));
};

const sanitizeStringList = (raw: unknown, max = 10): string[] =>
  Array.isArray(raw)
    ? raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, max)
    : [];

// ── Main API ─────────────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `Du er en erfaren dansk byggeingeniør og projektleder, der kvalitetssikrer en projektplan før opstart.
Du modtager et udkast (projekttype, dimensioner, opgaver, indkøb) samt fund fra automatiske tjek.
Gennemgå planen kritisk: mængder vs. dimensioner og spildfaktorer, manglende opgaver/materialer, rækkefølge og afhængigheder.
Svar KUN med gyldig JSON — ingen forklarende tekst, ingen markdown.
JSON-format:
{
  "overallConfidence": <0-100>,
  "items": [{ "ref": "task:<index>" | "purchase:<index>" | "plan", "severity": "ok" | "warn" | "error", "message": "<dansk besked>", "suggestion": "<valgfrit forslag>", "suggestedQuantity": <valgfrit tal> }],
  "missingTasks": ["<opgavetitel>"],
  "missingMaterials": ["<materiale>"],
  "sequencingNotes": ["<note om rækkefølge/afhængigheder>"]
}
Alle tekster skal være på dansk. Maks 12 items, 6 missingTasks, 6 missingMaterials, 5 sequencingNotes. Vær konkret og handlingsorienteret.`;

/**
 * Full plan review: deterministic checks + one AI pass.
 * Never throws — falls back to the deterministic-only review on AI failure.
 */
export const validatePlan = async (draft: PlanDraft): Promise<PlanReview> => {
  const deterministicItems = runDeterministicChecks(draft);

  const fallback: PlanReview = {
    overallConfidence: confidenceFromItems(deterministicItems, draft),
    items: deterministicItems,
    missingTasks: [],
    missingMaterials: [],
    sequencingNotes: [],
  };

  try {
    const prompt = JSON.stringify(
      {
        projektType: draft.projectType ?? 'Ukendt',
        beskrivelse: draft.description ?? '',
        dimensioner: draft.dimensions ?? {},
        opgaver: draft.tasks.map((t, i) => ({ index: i, titel: t.title, maengde: t.quantity, enhed: t.unit, materialer: t.materials })),
        indkoeb: draft.purchases.map((p, i) => ({
          index: i,
          navn: p.name,
          maengde: p.quantity,
          enhed: p.unit,
          stykprisKr: p.unitPriceOre !== undefined ? p.unitPriceOre / 100 : undefined,
        })),
        automatiskeFund: deterministicItems.map((i) => `${i.ref}: ${i.message}`),
      },
      null,
      1
    );

    const responseText = await aiChat({
      prompt,
      system: AI_SYSTEM_PROMPT,
      feature: 'onboarding-validation',
      temperature: 0.2,
      maxTokens: 1800,
    });

    const parsed = parseAiJson<AiReviewResponse>(responseText);
    if (!parsed) return fallback;

    const aiItems = sanitizeAiItems(parsed.items);

    // Merge: deterministic findings first, then AI findings that aren't duplicates.
    const mergedItems = [...deterministicItems];
    aiItems.forEach((aiItem) => {
      const isDuplicate = mergedItems.some(
        (existing) =>
          existing.ref === aiItem.ref &&
          existing.severity === aiItem.severity &&
          existing.message.slice(0, 40) === aiItem.message.slice(0, 40)
      );
      if (!isDuplicate) mergedItems.push(aiItem);
    });

    const aiConfidence =
      typeof parsed.overallConfidence === 'number' && Number.isFinite(parsed.overallConfidence)
        ? Math.max(0, Math.min(100, Math.round(parsed.overallConfidence)))
        : null;

    return {
      overallConfidence: aiConfidence ?? fallback.overallConfidence,
      items: mergedItems,
      missingTasks: sanitizeStringList(parsed.missingTasks, 6),
      missingMaterials: sanitizeStringList(parsed.missingMaterials, 6),
      sequencingNotes: sanitizeStringList(parsed.sequencingNotes, 5),
    };
  } catch (error) {
    console.warn('validatePlan: AI review failed, returning deterministic review.', error);
    return fallback;
  }
};

// ── Quick quantity check (PurchaseFormModal chip) ────────────────────────────

const quickCheckCache = new Map<string, QuickCheckResult | null>();
const QUICK_AI_TIMEOUT_MS = 2500;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

/**
 * Fast plausibility check for a single purchase line.
 * Deterministic heuristics first; if inconclusive, a cached AI micro-check.
 * Resolves in <3s or returns null (skip — never block the form).
 */
export const quickQuantityCheck = async (
  itemName: string,
  quantity: number,
  unit?: string,
  context?: string
): Promise<QuickCheckResult | null> => {
  const name = itemName.trim();
  if (!name || !Number.isFinite(quantity)) return null;

  const cacheKey = `${name.toLowerCase()}|${quantity}|${normalizeUnit(unit)}`;
  if (quickCheckCache.has(cacheKey)) {
    return quickCheckCache.get(cacheKey) ?? null;
  }

  // 1) Deterministic verdict
  const finding = checkQuantityDeterministic(name, quantity, unit);
  if (finding) {
    const result: QuickCheckResult = {
      status: finding.severity === 'ok' ? 'ok' : 'warn',
      message: finding.message,
      suggestedRange: finding.suggestion,
    };
    quickCheckCache.set(cacheKey, result);
    return result;
  }

  // Known item profile within plausible bounds → confident OK without AI.
  if (findProfile(name)) {
    const result: QuickCheckResult = { status: 'ok', message: 'Mængden ser fornuftig ud' };
    quickCheckCache.set(cacheKey, result);
    return result;
  }

  // 2) Unknown item → cheap AI micro-check with hard timeout.
  try {
    const aiPromise = aiChat({
      prompt: `Vare: "${name}"; Mængde: ${quantity}${unit ? ` ${unit}` : ''}${context ? `; Kontekst: ${context}` : ''}`,
      system:
        'Du er byggeindkøber. Vurder om mængden er plausibel for ét byggeprojekt. Svar KUN med JSON: {"status":"ok"|"warn","message":"<kort dansk besked, maks 12 ord>","suggestedRange":"<valgfrit interval>"}',
      feature: 'onboarding-validation',
      temperature: 0,
      maxTokens: 120,
    });

    const responseText = await withTimeout(aiPromise, QUICK_AI_TIMEOUT_MS);
    if (!responseText) return null; // Timed out — skip silently

    const parsed = parseAiJson<{ status?: string; message?: string; suggestedRange?: string }>(responseText);
    if (!parsed || (parsed.status !== 'ok' && parsed.status !== 'warn') || !parsed.message) {
      return null;
    }
    const result: QuickCheckResult = {
      status: parsed.status,
      message: parsed.message,
      suggestedRange: typeof parsed.suggestedRange === 'string' ? parsed.suggestedRange : undefined,
    };
    quickCheckCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
};
