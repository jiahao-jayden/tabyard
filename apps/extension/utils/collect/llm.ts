// 用户自配的模型：任意 OpenAI-compatible 服务（OpenAI、DeepSeek、Ollama 等）
import { browser } from 'wxt/browser';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { z } from 'zod';

export interface ModelConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

const MODEL_KEY = 'aiModel';

export async function loadModelConfig(): Promise<ModelConfig | null> {
  const stored = (await browser.storage.local.get(MODEL_KEY))[MODEL_KEY] as Partial<ModelConfig> | undefined;
  if (!stored?.baseURL || !stored.model) return null;
  return { baseURL: stored.baseURL, apiKey: stored.apiKey ?? '', model: stored.model };
}

export function saveModelConfig(config: ModelConfig): Promise<void> {
  return browser.storage.local.set({ [MODEL_KEY]: config });
}

/** 只允许 http(s) 地址；返回规范化后的 baseURL（去掉末尾 /） */
export function parseBaseURL(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** 为模型服务的域名申请访问权限；必须在用户点击事件里调用 */
export async function requestModelPermission(baseURL: string): Promise<boolean> {
  const origins = [`${new URL(baseURL).origin}/*`];
  return (await browser.permissions.contains({ origins })) || browser.permissions.request({ origins });
}

export function createModel(config: ModelConfig) {
  const provider = createOpenAICompatible({
    name: 'custom',
    baseURL: config.baseURL,
    apiKey: config.apiKey || undefined,
  });
  return provider.chatModel(config.model);
}

const modelListSchema = z.object({ data: z.array(z.object({ id: z.string() })) });

/** OpenAI 兼容服务的标准接口：GET {baseURL}/models */
export async function fetchModels(baseURL: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`${baseURL}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = modelListSchema.parse(await res.json());
  return data.map((m) => m.id).sort((a, b) => a.localeCompare(b));
}
