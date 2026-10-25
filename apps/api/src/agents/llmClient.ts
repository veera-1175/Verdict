/**
 * Free-tier LLM client — Groq (default) with optional Gemini for master merge.
 * No Anthropic / paid APIs required.
 */

export type LlmTier = "agent" | "master";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResponse {
  text: string;
  provider: "groq" | "gemini" | "none";
  model: string;
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v === "" || v.startsWith("your_") || v.includes("placeholder");
}

export function isLlmConfigured(): boolean {
  return !isPlaceholder(process.env.GROQ_API_KEY) || !isPlaceholder(process.env.GEMINI_API_KEY);
}

export function isGroqConfigured(): boolean {
  return !isPlaceholder(process.env.GROQ_API_KEY);
}

export function isGeminiConfigured(): boolean {
  return !isPlaceholder(process.env.GEMINI_API_KEY);
}

const GROQ_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

function groqErrorShouldFallback(status: number, body: string): boolean {
  if (status === 404 || status === 429) return true;
  return status === 400 && /model|decommission|not found/i.test(body);
}

async function callGroqOnce(messages: LlmMessage[], model: string, key: string): Promise<LlmResponse> {
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: 0,
    max_tokens: 6000,
    response_format: { type: "json_object" },
  };
  if (model.includes("gpt-oss")) payload.reasoning_effort = "medium";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    const error = new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`) as Error & { status?: number; body?: string };
    error.status = res.status;
    error.body = body;
    throw error;
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  return { text, provider: "groq", model };
}

async function callGroq(messages: LlmMessage[], model: string): Promise<LlmResponse> {
  const key = process.env.GROQ_API_KEY;
  if (isPlaceholder(key)) {
    throw new Error("GROQ_API_KEY not set — get a free key at https://console.groq.com");
  }

  const models = [model, ...GROQ_MODELS.filter((candidate) => candidate !== model)];
  let lastError: Error | undefined;
  for (const candidate of models) {
    try {
      return await callGroqOnce(messages, candidate, key!);
    } catch (err) {
      const error = err as Error & { status?: number; body?: string };
      lastError = error;
      if (error.status == null || !groqErrorShouldFallback(error.status, error.body ?? error.message)) throw error;
      console.warn(`[llm] ${candidate} unavailable, trying the next model`);
    }
  }
  throw lastError ?? new Error("Groq request failed");
}

async function callGemini(prompt: string, model: string): Promise<LlmResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (isPlaceholder(key)) {
    throw new Error("GEMINI_API_KEY not set");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  return { text, provider: "gemini", model };
}

function messagesToPrompt(messages: LlmMessage[]): string {
  return messages
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join("\n\n");
}

/**
 * Agent tier: 6 parallel reviews — Groq free tier (fast, cheap).
 */
export async function callAgentLlm(messages: LlmMessage[]): Promise<LlmResponse> {
  const model = process.env.GROQ_MODEL_AGENT ?? "openai/gpt-oss-120b";
  return callGroq(messages, model);
}

/**
 * Master tier: one merge per PR — Groq larger model, or Gemini if configured.
 */
export async function callMasterLlm(messages: LlmMessage[]): Promise<LlmResponse> {
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const groqMaster = process.env.GROQ_MODEL_MASTER ?? "openai/gpt-oss-120b";

  if (process.env.LLM_MASTER_PROVIDER === "gemini" && isGeminiConfigured()) {
    return callGemini(messagesToPrompt(messages), geminiModel);
  }

  if (isGroqConfigured()) {
    return callGroq(messages, groqMaster);
  }

  if (isGeminiConfigured()) {
    return callGemini(messagesToPrompt(messages), geminiModel);
  }

  throw new Error("No LLM configured — set GROQ_API_KEY (free) and optionally GEMINI_API_KEY");
}
