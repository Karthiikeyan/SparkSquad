import type { AiProvider } from '../../lib/aiKeys';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** Default models per provider (small, cheap, long output). Change here only. */
export const AI_MODELS: Record<AiProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-haiku-4-5',
};

export const AI_COMPANY: Record<AiProvider, string> = {
  gemini: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

/** Why a provider call failed, without echoing anything secret. */
export class AiError extends Error {
  constructor(readonly reason: 'auth' | 'rate' | 'network' | 'server' | 'empty') {
    super(reason);
    this.name = 'AiError';
  }
}

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  read: (json: unknown) => string;
}

function get(obj: unknown, path: (string | number)[]): unknown {
  let cur = obj;
  for (const k of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

function texts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => {
      const text = p && typeof p === 'object' ? (p as { text?: unknown }).text : undefined;
      return typeof text === 'string' ? text : '';
    })
    .join('');
}

/** Builds the HTTP request for each provider's official REST API (Architecture §9). */
export function buildRequest(
  provider: AiProvider,
  key: string,
  messages: readonly ChatMessage[],
): ProviderRequest {
  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODELS.gemini}:generateContent`,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: {
        contents: messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        })),
        generationConfig: { maxOutputTokens: 32_768, temperature: 0.6 },
      },
      read: (json) => texts(get(json, ['candidates', 0, 'content', 'parts'])),
    };
  }
  if (provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: {
        model: AI_MODELS.openai,
        messages: messages.map((m) => ({ role: m.role, content: m.text })),
        max_completion_tokens: 16_000,
      },
      read: (json) => {
        const c = get(json, ['choices', 0, 'message', 'content']);
        return typeof c === 'string' ? c : '';
      },
    };
  }
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: AI_MODELS.anthropic,
      max_tokens: 16_000,
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    },
    read: (json) => texts(get(json, ['content'])),
  };
}

/** One chat round trip from the phone to the provider. */
export async function sendChat(
  provider: AiProvider,
  key: string,
  messages: readonly ChatMessage[],
  doFetch: typeof fetch = fetch,
): Promise<string> {
  const req = buildRequest(provider, key, messages);
  let res: Response;
  try {
    res = await doFetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
  } catch {
    throw new AiError('network');
  }
  if (res.status === 401 || res.status === 403) throw new AiError('auth');
  if (res.status === 429) throw new AiError('rate');
  if (!res.ok) throw new AiError('server');
  const text = req.read(await res.json().catch(() => null)).trim();
  if (!text) throw new AiError('empty');
  return text;
}
