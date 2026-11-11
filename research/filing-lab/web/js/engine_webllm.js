// Engines A and B in the browser: a small language model running on this computer's graphics card
// (WebGPU) through WebLLM. The model downloads once from huggingface.co and is kept in the
// browser's storage; after that it runs offline. The note itself never leaves the page.
// Output is forced to the lab's JSON schema (grammar-constrained decoding), so the model can only
// use the allowed words for roles, activities and answers; every name, time and fact is its own.

import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { buildMessages, JSON_SCHEMA } from './llm_prompt.js';

export const BROWSER_MODELS = [
  { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Qwen3 0.6B (tiny)', download: '≈ 0.4 GB', license: 'Apache-2.0', thinking: true, defaultFor: 'A' },
  { id: 'Qwen3.5-0.8B-q4f16_1-MLC', label: 'Qwen3.5 0.8B (tiny, 2026)', download: '≈ 0.5 GB', license: 'Apache-2.0', thinking: true },
  { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', label: 'SmolLM2 360M (tiniest)', download: '≈ 0.3 GB', license: 'Apache-2.0' },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Qwen3 1.7B (small)', download: '≈ 1.0 GB', license: 'Apache-2.0', thinking: true, defaultFor: 'B' },
  { id: 'Qwen3.5-2B-q4f16_1-MLC', label: 'Qwen3.5 2B (small, 2026)', download: '≈ 1.3 GB', license: 'Apache-2.0', thinking: true },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B', download: '≈ 0.7 GB', license: 'Llama 3.2 license' },
  { id: 'Qwen3-4B-q4f16_1-MLC', label: 'Qwen3 4B (larger)', download: '≈ 2.3 GB', license: 'Apache-2.0', thinking: true }
];

export function modelInfo(id) {
  const m = BROWSER_MODELS.find(x => x.id === id) || { id, label: id };
  const rec = prebuiltAppConfig.model_list.find(x => x.model_id === id);
  return { ...m, vramMB: rec ? Math.round(rec.vram_required_MB) : null, available: !!rec };
}

export async function webgpuStatus() {
  if (!('gpu' in navigator)) return { ok: false, why: 'This browser has no WebGPU. Use Chrome or Edge (version 113 or newer).' };
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) return { ok: false, why: 'WebGPU is switched on but found no usable graphics adapter.' };
    const info = a.info || {};
    return { ok: true, adapter: [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') || 'graphics adapter found' };
  } catch (e) {
    return { ok: false, why: `WebGPU error: ${e.message}` };
  }
}

export class GpuMemoryError extends Error {
  constructor(id) {
    super(`The graphics card ran out of memory while loading ${modelInfo(id).label} (Windows reset the graphics card).`);
    this.name = 'GpuMemoryError';
  }
}

const isLoaded = engine => {
  const m = engine && engine.loadedModelIdToPipeline;
  return !m || typeof m.size !== 'number' ? true : m.size > 0;
};

export class BrowserLLM {
  constructor(id) { this.id = id; this.engine = null; this.loading = null; this.loadSeconds = null; this.backend = null; }

  async load(onProgress) {
    if (this.engine) return this.engine;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const t0 = performance.now();
      const attempt = backend => CreateMLCEngine(this.id, {
        appConfig: { ...prebuiltAppConfig, cacheBackend: backend },
        initProgressCallback: r => onProgress && onProgress(r)
      });
      // Pages opened from a file sometimes may not use the Cache API; IndexedDB is the fallback.
      const order = location.protocol === 'file:' ? ['indexeddb', 'cache'] : ['cache', 'indexeddb'];
      let lastErr;
      for (const backend of order) {
        try { this.engine = await attempt(backend); this.backend = backend; break; }
        catch (e) {
          lastErr = e;
          if (!/cache|storage|security|indexeddb|quota|opaque/i.test(String(e && (e.message || e)))) break;
        }
      }
      this.loading = null;
      if (!this.engine) throw lastErr;
      // When the graphics card runs out of memory during loading, WebLLM quietly stops and returns
      // an engine with no model inside. Catch that here instead of failing later.
      if (!isLoaded(this.engine)) { this.engine = null; throw new GpuMemoryError(this.id); }
      this.loadSeconds = +((performance.now() - t0) / 1000).toFixed(1);
      return this.engine;
    })();
    return this.loading;
  }

  async analyze(text, onProgress) {
    await this.load(onProgress);
    const info = modelInfo(this.id);
    const t0 = performance.now();
    const req = {
      messages: buildMessages(text), temperature: 0, top_p: 1, max_tokens: 700, seed: 1,
      response_format: { type: 'json_object', schema: JSON.stringify(JSON_SCHEMA) }
    };
    if (info.thinking) req.extra_body = { enable_thinking: false };
    let reply;
    try { reply = await this.engine.chat.completions.create(req); }
    catch (e) {
      if (/not loaded|device (was )?lost/i.test(String(e && e.message))) { this.engine = null; throw new GpuMemoryError(this.id); }
      throw e;
    }
    const ms = performance.now() - t0;
    const raw = reply.choices?.[0]?.message?.content ?? '';
    // Qwen3 with thinking switched off: the runtime itself puts an empty "<think></think>" in front
    // of the answer. That marker is not part of the model's answer, so it is removed before reading.
    const answer = raw.replace(/^\s*<think>[\s\S]*?<\/think>\s*/, '');
    let ir = null, error = null;
    try { ir = JSON.parse(answer); } catch (e) { error = `The model's answer was not valid JSON: ${e.message}`; }
    const u = reply.usage || {};
    return { ir, raw, ms: Math.round(ms), error, tokens_in: u.prompt_tokens, tokens_out: u.completion_tokens,
      gen_tps: u.extra?.decode_tokens_per_s ? +u.extra.decode_tokens_per_s.toFixed(1) : null };
  }

  async unload() { if (this.engine) { try { await this.engine.unload(); } catch { /* already gone */ } this.engine = null; } }
}
