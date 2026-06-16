// AI Providers - BYOK (Bring Your Own Key) configuration
// Direct REST API calls from mobile, no backend needed

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek';

export interface AIModel {
  id: string;
  label: string;
  description: string;
}

export interface ProviderConfig {
  id: AIProvider;
  name: string;
  icon: string; // ionicon name
  color: string;
  apiKeyUrl: string;
  apiKeyHelp: string;
  apiKeyPattern: string; // human readable
  models: AIModel[];
}

export const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    icon: 'sparkles',
    color: '#10A37F',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    apiKeyHelp: 'Obtené tu API key en platform.openai.com/api-keys',
    apiKeyPattern: 'Empieza con sk-...',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Rápido y económico' },
      { id: 'gpt-4o', label: 'GPT-4o', description: 'Inteligente y multimodal' },
      { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Profundo y preciso' },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    icon: 'leaf',
    color: '#D97706',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyHelp: 'Obtené tu API key en console.anthropic.com',
    apiKeyPattern: 'Empieza con sk-ant-...',
    models: [
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', description: 'Veloz y eficiente' },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Equilibrado' },
      { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', description: 'Máxima calidad' },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    icon: 'logo-google',
    color: '#4285F4',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    apiKeyHelp: 'Obtené tu API key en aistudio.google.com',
    apiKeyPattern: 'Cadena alfanumérica de Google AI Studio',
    models: [
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Última generación' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Rápido y económico' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', description: 'Avanzado' },
    ],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'flash',
    color: '#5B5BD6',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    apiKeyHelp: 'Obtené tu API key en platform.deepseek.com',
    apiKeyPattern: 'Empieza con sk-...',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat', description: 'Conversacional general' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Razonamiento avanzado' },
    ],
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatResult {
  text: string;
  error?: string;
}

/**
 * Send a chat request to the selected provider using BYOK.
 * Returns the assistant's text response.
 */
export async function chatWithAI(params: {
  provider: AIProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: AIChatMessage[];
}): Promise<AIChatResult> {
  const { provider, apiKey, model, systemPrompt, history } = params;

  if (!apiKey || apiKey.trim().length < 8) {
    return { text: '', error: 'API key no configurada' };
  }

  try {
    switch (provider) {
      case 'openai':
        return await callOpenAICompat(
          'https://api.openai.com/v1/chat/completions',
          apiKey,
          model,
          systemPrompt,
          history
        );
      case 'deepseek':
        return await callOpenAICompat(
          'https://api.deepseek.com/v1/chat/completions',
          apiKey,
          model,
          systemPrompt,
          history
        );
      case 'anthropic':
        return await callAnthropic(apiKey, model, systemPrompt, history);
      case 'gemini':
        return await callGemini(apiKey, model, systemPrompt, history);
      default:
        return { text: '', error: 'Proveedor no soportado' };
    }
  } catch (error: any) {
    console.error('AI chat error:', error);
    return {
      text: '',
      error: error?.message || 'No se pudo conectar con el proveedor',
    };
  }
}

// ===== OpenAI / DeepSeek (compatible format) =====
async function callOpenAICompat(
  url: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: AIChatMessage[]
): Promise<AIChatResult> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401) {
      return { text: '', error: 'API key inválida. Verifica en ajustes.' };
    }
    if (res.status === 429) {
      return { text: '', error: 'Límite de uso alcanzado. Intenta más tarde.' };
    }
    return { text: '', error: parseErrMsg(errText) || `Error ${res.status}` };
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim() || '';
  return { text };
}

// ===== Anthropic Claude =====
async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: AIChatMessage[]
): Promise<AIChatResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true', // required for direct mobile/browser
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 401) {
      return { text: '', error: 'API key inválida. Verifica en ajustes.' };
    }
    if (res.status === 429) {
      return { text: '', error: 'Límite de uso alcanzado.' };
    }
    return { text: '', error: parseErrMsg(errText) || `Error ${res.status}` };
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text?.trim() || '';
  return { text };
}

// ===== Google Gemini =====
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  history: AIChatMessage[]
): Promise<AIChatResult> {
  const contents = history.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    if (res.status === 400 && errText.includes('API key')) {
      return { text: '', error: 'API key inválida. Verifica en ajustes.' };
    }
    if (res.status === 401 || res.status === 403) {
      return { text: '', error: 'API key inválida o sin permisos.' };
    }
    if (res.status === 429) {
      return { text: '', error: 'Límite de uso alcanzado.' };
    }
    return { text: '', error: parseErrMsg(errText) || `Error ${res.status}` };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  return { text };
}

function parseErrMsg(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error || '';
  } catch {
    return raw.slice(0, 200);
  }
}
