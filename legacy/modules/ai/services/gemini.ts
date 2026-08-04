import { getScreenContext } from '../../../utils/introspection';
import { fileToDataUrl } from '../../../utils/fileUtils';
import { supabase } from '../../../services/supabaseClient';
import { ChecklistItem } from '../../../types';

const GEMINI_ENDPOINT = '/api/gemini';
const AI_CHAT_ENDPOINT = '/api/ai/chat';

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

// Client-side soft guard; server-side quota enforcement is the source of truth.
let requestCount = 0;
const RATE_LIMIT_MINUTE = 15;
let resetTime = Date.now() + 60_000;

const checkRateLimit = () => {
  const now = Date.now();
  if (now > resetTime) {
    requestCount = 0;
    resetTime = now + 60_000;
  }
  if (requestCount >= RATE_LIMIT_MINUTE) {
    console.warn('Rate limit warning: approaching local minute budget');
  }
  requestCount++;
};

interface GeminiGenerateContentRequest {
  model: string;
  contents: unknown;
  config?: Record<string, unknown>;
}

interface GeminiProxyResponse {
  text?: string;
  functionCalls?: unknown[];
  candidates?: unknown[];
  error?: string;
  details?: string;
}

const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

const callGemini = async (
  payload: GeminiGenerateContentRequest
): Promise<GeminiProxyResponse> => {
  checkRateLimit();

  const accessToken = await getAccessToken();
  const authHeader: Record<string, string> = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};

  // Multimodal calls (image inlineData) still go to Gemini directly —
  // the AI orchestration layer doesn't support images yet.
  const hasImages =
    Array.isArray(payload.contents) &&
    (payload.contents as unknown[]).some(
      (item) => item != null && typeof item === 'object' && 'inlineData' in (item as object)
    );

  if (hasImages) {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as GeminiProxyResponse;
    if (!response.ok) {
      if (response.status === 429) throw new QuotaExceededError(data.error || 'Kvote overskredet.');
      throw new Error(data.details || data.error || 'AI service unavailable');
    }
    return data;
  }

  // Text-only calls → route through the admin-configured AI provider chain.
  let prompt: string;
  if (typeof payload.contents === 'string') {
    prompt = payload.contents;
  } else if (Array.isArray(payload.contents)) {
    prompt = (payload.contents as unknown[])
      .map((item) => {
        if (item != null && typeof item === 'object' && 'text' in (item as object)) {
          return String((item as Record<string, unknown>).text);
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  } else {
    prompt = String(payload.contents);
  }

  const response = await fetch(AI_CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify({ prompt, feature: 'gemini-compat' }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    if (response.status === 429) throw new QuotaExceededError(data.error || 'Kvote overskredet.');
    throw new Error(data.error || data.details || `AI service unavailable (${response.status})`);
  }

  return { text: data.text };
};

const parseJsonSafe = <T>(raw: string | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

// --- Interfaces ---
export interface ProjectMaterialAnalysis {
  zoneId: string;
  componentIds: string[];
  projectData: {
    name: string;
    address: string;
    description: string;
    startDate: string;
    endDate: string;
    buildingYear: string;
    floors: string;
    hasBasement: boolean;
    hasTerrace: boolean;
  };
  suggestedTasks: {
    title: string;
    description: string;
    estimatedHours: number;
  }[];
  suggestedPurchases: {
    name: string;
    quantity: number;
    unit: string;
    details: string;
  }[];
}

export interface AiProjectPlan {
  tasks: {
    title: string;
    description: string;
    estimatedHours: number;
  }[];
  shoppingList: {
    name: string;
    quantity: number;
    details: string;
  }[];
}

export interface AISuggestedRegulation {
  id: string;
  title: string;
  description: string;
}

export interface HandoverReportContent {
  executiveSummary: string;
  projectFlow: string;
  statusOverview: string;
  unfinishedTasks: { task: string; impact: string }[];
  finalConclusion: string;
}

export interface AiExplanationContent {
  explanation: string;
  checklist: string[];
  requirements: string[];
  tags: string[];
}

export interface AiReviewRisk {
  severity: 'high' | 'medium' | 'low' | 'success';
  category: 'Sikkerhed' | 'Tid' | 'Materialer' | 'Budget' | 'Lovgivning' | 'Generelt';
  title: string;
  message: string;
}

// --- API Functions ---
export const generateDailyBriefing = async (userName?: string): Promise<string> => {
  try {
    const greeting = userName
      ? `Generate a short, encouraging daily briefing for ${userName}, a construction manager in Danish. Address them by first name. Focus on safety and progress.`
      : 'Generate a short, encouraging daily briefing for a construction manager in Danish. Focus on safety and progress.';

    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: greeting,
    });
    return response.text || 'Godmorgen! Husk sikkerheden i dag.';
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return 'Godmorgen! Klar til en ny dag?';
  }
};

export const generateAdvancedBriefing = async (userName?: string): Promise<string> => {
  try {
    const greeting = userName
      ? `Generate a detailed daily briefing for ${userName}, a construction manager in Danish. Address them by first name. Use Markdown with headers. Include sections for 'Vejret', 'Fokusområder', 'Sikkerhed', and 'Motivation'.`
      : "Generate a detailed daily briefing for a construction manager in Danish. Use Markdown with headers. Include sections for 'Vejret', 'Fokusområder', 'Sikkerhed', and 'Motivation'.";

    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: greeting,
    });
    return response.text || 'Kunne ikke generere udvidet briefing.';
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return 'Fejl ved generering af briefing.';
  }
};

export const generateRegulationExplanation = async (
  title: string,
  snippet: string,
  body: string
): Promise<AiExplanationContent> => {
  const prompt = `Forklar følgende bygningsreglement i et letforståeligt sprog for en håndværker.
Titel: ${title}
Uddrag: ${snippet}
Tekst: ${body}

Output JSON format:
{
  "explanation": "Kort forklaring",
  "checklist": ["Punkt 1", "Punkt 2"],
  "requirements": ["Krav 1"],
  "tags": ["Tag1", "Tag2"]
}`;

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            explanation: { type: 'string' },
            checklist: { type: 'array', items: { type: 'string' } },
            requirements: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    });

    return parseJsonSafe<AiExplanationContent>(response.text, {
      explanation: 'Kunne ikke generere forklaring.',
      checklist: [],
      requirements: [],
      tags: [],
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    console.error('AI Error:', error);
    return {
      explanation: 'Kunne ikke generere forklaring.',
      checklist: [],
      requirements: [],
      tags: [],
    };
  }
};

export const verifyRegulationExplanation = async (
  _regulation: unknown,
  _explanation: unknown
): Promise<{ is_correct: boolean; reasoning: string }> => {
  const reg = _regulation as { title?: string; snippet?: string; body_html?: string };
  const exp = _explanation as {
    explanation?: string;
    checklist?: string[];
    requirements?: string[];
  };

  const bodyText = (reg.body_html || '').replace(/<[^>]+>/g, '');
  const prompt = `Sammenlign følgende bygningsreglement med den AI-genererede forklaring og afgør om forklaringen er korrekt.

Reglement titel: ${reg.title || ''}
Reglement uddrag: ${reg.snippet || ''}
Reglement tekst: ${bodyText}

AI forklaring: ${exp.explanation || ''}
AI tjekliste: ${(exp.checklist || []).join(', ')}
AI krav: ${(exp.requirements || []).join(', ')}

Returner JSON: { "is_correct": boolean, "reasoning": "string" }`;

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    return parseJsonSafe<{ is_correct: boolean; reasoning: string }>(response.text, {
      is_correct: false,
      reasoning: 'Verifikation mislykkedes.',
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return {
      is_correct: false,
      reasoning: 'Verifikation mislykkedes.',
    };
  }
};

export const findRelevantRegulationsForTask = async (
  taskTitle: string,
  taskDescription: string
): Promise<AISuggestedRegulation[]> => {
  const prompt = `Find relevante bygningsreglementer (BR18) for denne opgave:
Titel: ${taskTitle}
Beskrivelse: ${taskDescription}

Returner JSON liste: [{ "id": "string", "title": "string", "description": "string" }]`;

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    return parseJsonSafe<AISuggestedRegulation[]>(response.text, []);
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return [];
  }
};

export const analyzeProjectMaterial = async (
  description: string,
  files: File[]
): Promise<ProjectMaterialAnalysis> => {
  const prompt = `Analyser følgende projektbeskrivelse og generer en struktureret plan.
Beskrivelse: ${description}
Output JSON matching ProjectMaterialAnalysis interface.`;

  const contents: unknown[] = [];
  for (const file of files) {
    const base64 = await fileToDataUrl(file);
    const data = base64.split(',')[1];
    contents.push({ inlineData: { mimeType: file.type, data } });
  }
  contents.push({ text: prompt });

  const response = await callGemini({
    model: 'gemini-2.5-flash',
    contents,
    config: { responseMimeType: 'application/json' },
  });

  const parsed = parseJsonSafe<Partial<ProjectMaterialAnalysis>>(response.text, {});
  return {
    zoneId: parsed.zoneId || 'roof',
    componentIds: parsed.componentIds || [],
    projectData: parsed.projectData || {
      name: '',
      address: '',
      description: '',
      startDate: '',
      endDate: '',
      buildingYear: '',
      floors: '',
      hasBasement: false,
      hasTerrace: false,
    },
    suggestedTasks: parsed.suggestedTasks || [],
    suggestedPurchases: parsed.suggestedPurchases || [],
  };
};

export const generateProjectPlan = async (
  name: string,
  description: string,
  files: File[]
): Promise<AiProjectPlan> => {
  const prompt = `Lav en projektplan for "${name}": ${description}.
Output JSON: { "tasks": [{ "title": "", "description": "", "estimatedHours": 0 }], "shoppingList": [{ "name": "", "quantity": 0, "details": "" }] }`;

  const contents: unknown[] = [];
  for (const file of files) {
    const base64 = await fileToDataUrl(file);
    const data = base64.split(',')[1];
    contents.push({ inlineData: { mimeType: file.type, data } });
  }
  contents.push({ text: prompt });

  const response = await callGemini({
    model: 'gemini-2.5-flash',
    contents,
    config: { responseMimeType: 'application/json' },
  });

  return parseJsonSafe<AiProjectPlan>(response.text, { tasks: [], shoppingList: [] });
};

export const handleUserMessage = async (
  text: string,
  _history: unknown[],
  _contextId: string,
  _navigate: unknown,
  attachment?: File
): Promise<{ text: string; attachment?: { type: 'image'; dataUrl: string } }> => {
  const screenContext = getScreenContext();
  let prompt = `User said: ${text}. Screen context: ${screenContext}. Answer in Danish.`;
  const contents: unknown[] = [];

  if (attachment) {
    const base64 = await fileToDataUrl(attachment);
    const data = base64.split(',')[1];
    contents.push({ inlineData: { mimeType: attachment.type, data } });
    prompt = `Analyze this image. ${prompt}`;
  }
  contents.push({ text: prompt });

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents,
    });
    return { text: response.text || 'Jeg forstod ikke det.' };
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    const message =
      error instanceof Error ? error.message : 'Beklager, jeg kan ikke svare lige nu.';
    return { text: message };
  }
};

export const searchRegulationsWithAI = async (
  query: string
): Promise<AISuggestedRegulation[]> => {
  const prompt = `Find relevante bygningsreglementer for søgningen: "${query}". Return JSON array.`;
  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    return parseJsonSafe<AISuggestedRegulation[]>(response.text, []);
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return [];
  }
};

export const optimizeTaskWithAI = async (
  title: string,
  description: string
): Promise<{ newTitle: string; newDescription: string }> => {
  const prompt = `Optimer denne opgavebeskrivelse for en håndværker.
Titel: ${title}
Beskrivelse: ${description}
Output JSON: { "newTitle": "...", "newDescription": "..." }`;

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    return parseJsonSafe(response.text, {
      newTitle: title,
      newDescription: description,
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return { newTitle: title, newDescription: description };
  }
};

export const reviewProjectPlan = async (
  _projectDetails: unknown,
  _tasks: unknown[],
  _purchases: unknown[],
  _totalPrice: number,
  _totalHours: number
): Promise<{
  score: number;
  risks: AiReviewRisk[];
  fieldStatus: Record<string, { status: 'pass' | 'fail' | 'question'; message: string }>;
}> => {
  const details = _projectDetails as Record<string, unknown>;
  const prompt = `Analyser følgende byggeprojekt og giv en risikovurdering.

Projekt detaljer:
- Navn: ${details.name || ''}
- Adresse: ${details.address || ''}
- Datoer: ${details.startDate || ''} - ${details.endDate || ''}
- Beskrivelse: ${details.description || ''}

Opgaver:
${JSON.stringify(_tasks.map((t: unknown) => {
  const task = t as Record<string, unknown>;
  return { title: task.title, status: task.status, estimatedHours: task.estimatedHours, dueDate: task.dueDate };
}))}

Indkøb:
${JSON.stringify(_purchases.map((p: unknown) => {
  const purchase = p as Record<string, unknown>;
  return { name: purchase.name, quantity: purchase.quantity, estimatedPrice: purchase.estimatedPrice };
}))}

Total pris: ${_totalPrice}
Total timer: ${_totalHours}

Returner JSON:
{
  "score": number (0-100),
  "risks": [{ "severity": "high|medium|low|success", "category": "Sikkerhed|Tid|Materialer|Budget|Lovgivning|Generelt", "title": "string", "message": "string" }],
  "fieldStatus": { "fieldKey": { "status": "pass|fail|question", "message": "string" } }
}`;

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    return parseJsonSafe(response.text, {
      score: 85,
      risks: [],
      fieldStatus: {},
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return { score: 85, risks: [], fieldStatus: {} };
  }
};

export const evaluateProjectDeadline = async (
  project: { name: string },
  _tasks: unknown[],
  _logs: unknown[],
  _purchases: unknown[]
): Promise<{
  probability: number;
  status: string;
  analysis: string;
  key_risks: string[];
}> => {
  const prompt = `Evaluate if project "${project.name}" will meet deadline. Output JSON: { "probability": number, "status": "string", "analysis": "string", "key_risks": ["string"] }`;

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    return parseJsonSafe(response.text, {
      probability: 0,
      status: 'Error',
      analysis: 'AI Error',
      key_risks: [],
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return { probability: 0, status: 'Error', analysis: 'AI Error', key_risks: [] };
  }
};

export const generateHandoverReport = async (
  project: { name: string },
  _tasks: unknown[],
  _logs: unknown[],
  _team: unknown[]
): Promise<HandoverReportContent> => {
  const prompt = `Generer en overdragelsesrapport for "${project.name}". Output JSON matching HandoverReportContent interface.`;

  const response = await callGemini({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });

  return parseJsonSafe<HandoverReportContent>(response.text, {
    executiveSummary: '',
    projectFlow: '',
    statusOverview: '',
    unfinishedTasks: [],
    finalConclusion: '',
  });
};

export const generateChecklistFromDescription = async (
  title: string,
  description: string
): Promise<ChecklistItem[]> => {
  const prompt = `Generer en praktisk dansk bygge-tjekliste for følgende opgave.
Titel: ${title}
Beskrivelse: ${description}

Returner JSON liste med 3-8 konkrete, handlingsorienterede punkter: [{ "text": "string" }]`;

  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const items = parseJsonSafe<{ text: string }[]>(response.text, []);
    return items.filter(i => i?.text).map(item => ({
      id: crypto.randomUUID(),
      text: item.text,
      checked: false,
      ruleRef: '',
      ruleId: '',
    }));
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return [];
  }
};

export const generateStrictTaskSummary = async (
  title: string,
  description: string
): Promise<string> => {
  const prompt = `Summarize this task strictly for a contract in Danish: ${title} - ${description}`;
  try {
    const response = await callGemini({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || 'Ingen beskrivelse.';
  } catch (error) {
    if (error instanceof QuotaExceededError) throw error;
    return 'Fejl i resume.';
  }
};