// ─────────────────────────────────────────────────────────────────────────────
// AI provider registry + invocation adapters + API key encryption.
//
// All provider API keys are encrypted at rest with AES-256-GCM. The 32-byte
// key is derived from process.env.AI_KEYS_SECRET via scrypt. Stored format:
// "base64(iv):base64(authTag):base64(ciphertext)". Keys only ever exist in
// plaintext in server memory at invocation time.
// ─────────────────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

// ─────────────────────────────────────────────────────────────────────────────
// Provider registry
//
// authStyle:
//   'openai-compat' — POST {baseUrl}/chat/completions with Bearer key
//   'anthropic'     — POST /v1/messages with x-api-key + anthropic-version
//   'gemini'        — @google/genai SDK
//   'cohere'        — POST {baseUrl}/v2/chat
//   'azure'         — endpoint+deployment from config, api-key header
//   'stub'          — keys can be stored, invocation adapter not yet built
//
// defaultModels are UI suggestions only — the admin can type any model string.
// configFields describe extra non-secret settings stored in the config jsonb.
// ─────────────────────────────────────────────────────────────────────────────
export const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    configFields: [],
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    authStyle: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModels: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-8'],
    configFields: [],
  },
  {
    id: 'google',
    label: 'Google (Gemini)',
    authStyle: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    configFields: [],
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    authStyle: 'azure',
    baseUrl: null,
    defaultModels: ['gpt-4.1', 'gpt-4.1-mini'],
    configFields: [
      { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://min-ressource.openai.azure.com', required: true },
      { key: 'deployment', label: 'Deployment-navn', placeholder: 'gpt-4-1-deployment', required: true },
      { key: 'apiVersion', label: 'API-version', placeholder: '2024-10-21', required: false },
    ],
  },
  {
    id: 'aws-bedrock',
    label: 'AWS Bedrock',
    authStyle: 'stub',
    baseUrl: null,
    keyLabel: 'Secret Access Key',
    defaultModels: ['anthropic.claude-sonnet-4-5', 'meta.llama4-maverick'],
    configFields: [
      { key: 'region', label: 'AWS-region', placeholder: 'eu-central-1', required: true },
      { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA…', required: true },
    ],
    stubMessage: 'Bedrock-adapter kommer snart',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModels: ['mistral-large-latest', 'mistral-small-latest'],
    configFields: [],
  },
  {
    id: 'cohere',
    label: 'Cohere',
    authStyle: 'cohere',
    baseUrl: 'https://api.cohere.ai',
    defaultModels: ['command-r-plus', 'command-r'],
    configFields: [],
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.x.ai/v1',
    defaultModels: ['grok-4', 'grok-4-mini'],
    configFields: [],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    configFields: [],
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.perplexity.ai',
    defaultModels: ['sonar', 'sonar-pro'],
    configFields: [],
  },
  {
    id: 'together',
    label: 'Together AI',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModels: ['meta-llama/Llama-4-Maverick', 'Qwen/Qwen3-72B'],
    configFields: [],
  },
  {
    id: 'groq',
    label: 'Groq',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: ['llama-4-maverick', 'qwen-qwq-32b'],
    configFields: [],
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    defaultModels: ['accounts/fireworks/models/llama-v4-maverick'],
    configFields: [],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    authStyle: 'openai-compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: ['openrouter/auto'],
    configFields: [],
  },
  {
    id: 'opencode',
    label: 'OpenCode (Zen)',
    authStyle: 'openai-compat',
    baseUrl: 'https://opencode.ai/zen/v1',
    defaultModels: [],
    configFields: [
      { key: 'endpoint', label: 'Endpoint URL (valgfri)', placeholder: 'https://opencode.ai/zen/v1', required: false },
    ],
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    authStyle: 'openai-compat',
    baseUrl: 'https://router.huggingface.co/v1',
    defaultModels: [],
    configFields: [],
  },
  {
    id: 'nvidia-nim',
    label: 'NVIDIA NIM',
    authStyle: 'openai-compat',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModels: [],
    configFields: [],
  },
  {
    id: 'ibm-watsonx',
    label: 'IBM watsonx',
    authStyle: 'stub',
    baseUrl: null,
    keyLabel: 'IBM Cloud API-nøgle',
    defaultModels: ['ibm/granite-3-8b-instruct'],
    configFields: [
      { key: 'endpoint', label: 'Region-URL', placeholder: 'https://eu-de.ml.cloud.ibm.com', required: true },
      { key: 'projectId', label: 'Project ID', placeholder: 'xxxxxxxx-xxxx-…', required: true },
    ],
    stubMessage: 'watsonx-adapter kommer snart',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModels: ['llama-4-scout', 'qwen-3-32b'],
    configFields: [],
  },
  {
    id: 'sambanova',
    label: 'SambaNova',
    authStyle: 'openai-compat',
    baseUrl: 'https://api.sambanova.ai/v1',
    defaultModels: ['Llama-4-Maverick'],
    configFields: [],
  },
];

const PROVIDER_MAP = new Map(PROVIDERS.map((p) => [p.id, p]));

export const getProviderMeta = (providerId) => PROVIDER_MAP.get(providerId) || null;

// ─────────────────────────────────────────────────────────────────────────────
// Encryption helpers — AES-256-GCM, key derived from AI_KEYS_SECRET via scrypt
// ─────────────────────────────────────────────────────────────────────────────
const SCRYPT_SALT = 'bygsmart-ai-orchestration-v1';
let cachedKey = null;
let cachedSecret = null;

const deriveKey = () => {
  const secret = process.env.AI_KEYS_SECRET;
  if (!secret) return null;
  if (cachedKey && cachedSecret === secret) return cachedKey;
  cachedKey = scryptSync(secret, SCRYPT_SALT, 32);
  cachedSecret = secret;
  return cachedKey;
};

export const hasEncryptionSecret = () => Boolean(process.env.AI_KEYS_SECRET);

export const encryptApiKey = (plaintext) => {
  const key = deriveKey();
  if (!key) {
    throw new Error('AI_KEYS_SECRET er ikke konfigureret på serveren.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

export const decryptApiKey = (stored) => {
  const key = deriveKey();
  if (!key) {
    throw new Error('AI_KEYS_SECRET er ikke konfigureret på serveren.');
  }
  const parts = String(stored).split(':');
  if (parts.length !== 3) {
    throw new Error('Ugyldigt format for krypteret nøgle.');
  }
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
};

// ─────────────────────────────────────────────────────────────────────────────
// Chain resolution — enabled configs with a stored key, sorted by priority.
// If requestedProviderId matches an eligible config it is moved to the front;
// the rest stay in priority order as the fallback chain.
// ─────────────────────────────────────────────────────────────────────────────
export const resolveChain = (configs, requestedProviderId) => {
  const eligible = (configs || [])
    .filter((c) => c && c.enabled && c.api_key_encrypted && PROVIDER_MAP.has(c.provider_id))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  if (!requestedProviderId) return eligible;

  const requested = eligible.find((c) => c.provider_id === requestedProviderId);
  if (!requested) return eligible;
  return [requested, ...eligible.filter((c) => c !== requested)];
};

// ─────────────────────────────────────────────────────────────────────────────
// Message normalization
// ─────────────────────────────────────────────────────────────────────────────
const normalizeMessages = (messages) =>
  (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof m.content === 'string' && m.content.length > 0)
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: m.content,
    }));

const splitSystem = (messages, system) => {
  const systemParts = [];
  if (typeof system === 'string' && system.trim()) systemParts.push(system.trim());
  const rest = [];
  for (const m of messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else rest.push(m);
  }
  return { systemText: systemParts.join('\n\n') || undefined, chat: rest };
};

const httpError = async (response, providerLabel) => {
  const body = await response.text().catch(() => '');
  const snippet = body ? ` — ${body.slice(0, 300)}` : '';
  const err = new Error(`${providerLabel}: HTTP ${response.status}${snippet}`);
  err.statusCode = response.status;
  return err;
};

// ─────────────────────────────────────────────────────────────────────────────
// Adapters — each returns { text, tokensIn, tokensOut }
// ─────────────────────────────────────────────────────────────────────────────
const invokeOpenAiCompat = async ({ meta, apiKey, config, model, messages, system, temperature, maxTokens }) => {
  const baseUrl = (config?.endpoint || meta.baseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error(`${meta.label}: endpoint mangler i konfigurationen.`);

  const { systemText, chat } = splitSystem(messages, system);
  const body = {
    model,
    messages: [
      ...(systemText ? [{ role: 'system', content: systemText }] : []),
      ...chat,
    ],
  };
  if (typeof temperature === 'number') body.temperature = temperature;
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await httpError(response, meta.label);

  const data = await response.json();
  return {
    text: data?.choices?.[0]?.message?.content ?? '',
    tokensIn: data?.usage?.prompt_tokens ?? null,
    tokensOut: data?.usage?.completion_tokens ?? null,
  };
};

const invokeAnthropic = async ({ meta, apiKey, model, messages, system, temperature, maxTokens }) => {
  const { systemText, chat } = splitSystem(messages, system);
  const body = {
    model,
    max_tokens: typeof maxTokens === 'number' ? maxTokens : 4096,
    messages: chat.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  };
  if (systemText) body.system = systemText;
  if (typeof temperature === 'number') body.temperature = temperature;

  const response = await fetch(`${meta.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await httpError(response, meta.label);

  const data = await response.json();
  const text = Array.isArray(data?.content)
    ? data.content.filter((block) => block?.type === 'text').map((block) => block.text).join('')
    : '';
  return {
    text,
    tokensIn: data?.usage?.input_tokens ?? null,
    tokensOut: data?.usage?.output_tokens ?? null,
  };
};

const invokeGemini = async ({ apiKey, model, messages, system, temperature, maxTokens }) => {
  const { systemText, chat } = splitSystem(messages, system);
  const client = new GoogleGenAI({ apiKey });

  const contents = chat.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const config = {};
  if (systemText) config.systemInstruction = systemText;
  if (typeof temperature === 'number') config.temperature = temperature;
  if (typeof maxTokens === 'number') config.maxOutputTokens = maxTokens;

  const response = await client.models.generateContent({
    model,
    contents,
    ...(Object.keys(config).length > 0 ? { config } : {}),
  });

  return {
    text: response?.text ?? '',
    tokensIn: response?.usageMetadata?.promptTokenCount ?? null,
    tokensOut: response?.usageMetadata?.candidatesTokenCount ?? null,
  };
};

const invokeCohere = async ({ meta, apiKey, config, model, messages, system, temperature, maxTokens }) => {
  const baseUrl = (config?.endpoint || meta.baseUrl || '').replace(/\/+$/, '');
  const { systemText, chat } = splitSystem(messages, system);
  const body = {
    model,
    messages: [
      ...(systemText ? [{ role: 'system', content: systemText }] : []),
      ...chat,
    ],
  };
  if (typeof temperature === 'number') body.temperature = temperature;
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;

  const response = await fetch(`${baseUrl}/v2/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await httpError(response, meta.label);

  const data = await response.json();
  const text = Array.isArray(data?.message?.content)
    ? data.message.content.filter((block) => block?.type === 'text').map((block) => block.text).join('')
    : '';
  return {
    text,
    tokensIn: data?.usage?.tokens?.input_tokens ?? null,
    tokensOut: data?.usage?.tokens?.output_tokens ?? null,
  };
};

const invokeAzure = async ({ meta, apiKey, config, model, messages, system, temperature, maxTokens }) => {
  const endpoint = (config?.endpoint || '').replace(/\/+$/, '');
  const deployment = config?.deployment || model;
  if (!endpoint || !deployment) {
    throw new Error('Azure OpenAI: endpoint og deployment skal udfyldes i konfigurationen.');
  }
  const apiVersion = config?.apiVersion || '2024-10-21';

  const { systemText, chat } = splitSystem(messages, system);
  const body = {
    messages: [
      ...(systemText ? [{ role: 'system', content: systemText }] : []),
      ...chat,
    ],
  };
  if (typeof temperature === 'number') body.temperature = temperature;
  if (typeof maxTokens === 'number') body.max_tokens = maxTokens;

  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await httpError(response, meta.label);

  const data = await response.json();
  return {
    text: data?.choices?.[0]?.message?.content ?? '',
    tokensIn: data?.usage?.prompt_tokens ?? null,
    tokensOut: data?.usage?.completion_tokens ?? null,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// invokeProvider — single entry point used by the routes layer.
//
// providerConfig: { provider_id, apiKey (decrypted), config (jsonb object) }
// Returns { text, tokensIn, tokensOut } or throws (stub adapters throw a
// 501-tagged error so the chain can skip them and the test endpoint can report
// a clear message).
// ─────────────────────────────────────────────────────────────────────────────
export const invokeProvider = async ({ providerConfig, model, messages, system, temperature, maxTokens }) => {
  const meta = getProviderMeta(providerConfig?.provider_id);
  if (!meta) {
    throw new Error(`Ukendt AI-udbyder: ${providerConfig?.provider_id}`);
  }

  const chosenModel = model || providerConfig?.default_model || meta.defaultModels[0];
  if (!chosenModel && meta.authStyle !== 'azure') {
    throw new Error(`${meta.label}: ingen model valgt.`);
  }

  const args = {
    meta,
    apiKey: providerConfig.apiKey,
    config: providerConfig.config || {},
    model: chosenModel,
    messages: normalizeMessages(messages),
    system,
    temperature,
    maxTokens,
  };

  switch (meta.authStyle) {
    case 'openai-compat':
      return invokeOpenAiCompat(args);
    case 'anthropic':
      return invokeAnthropic(args);
    case 'gemini':
      return invokeGemini(args);
    case 'cohere':
      return invokeCohere(args);
    case 'azure':
      return invokeAzure(args);
    case 'stub': {
      const err = new Error(meta.stubMessage || `${meta.label}-adapter kommer snart`);
      err.statusCode = 501;
      throw err;
    }
    default: {
      const err = new Error(`${meta.label}: ukendt adapter '${meta.authStyle}'.`);
      err.statusCode = 500;
      throw err;
    }
  }
};
