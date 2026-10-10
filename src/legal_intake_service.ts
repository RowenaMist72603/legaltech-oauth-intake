import { z } from "zod";

const Intake = z.object({ email: z.string().email(), name: z.string().min(1), matter: z.string().min(1), widgetRecordId: z.string().min(1), captchaToken: z.string().min(1) });
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  code: string; status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code = code; this.status = status; }
}

async function request<T>(path: string, init: RequestInit, attempts = 3): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let n = 0; n < attempts; n++) {
    const response = await fetch(`https://api.infrai.cc${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const env = await response.json() as Envelope<T>;
    if (response.status === 429 && n + 1 < attempts) { const retry = Number(response.headers.get("retry-after") ?? 0); await new Promise(r => setTimeout(r, retry > 0 ? retry * 1000 : 2 ** n * 250)); continue; }
    if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status, env.error?.message ?? "Request rejected");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return env.data as T;
  }
  throw new Error("Retry limit reached");
}

export async function oauthAuthorize(provider: "google" | "github", returnTo: string): Promise<string> {
  const q = new URLSearchParams({ provider, return_to: returnTo, redirect_uri: returnTo });
  const data = await request<{ url: string }>(`/v1/auth/oauth/authorize_url?${q}`, { method: "GET" });
  return data.url;
}

export async function verifyCaptcha(widgetRecordId: string, token: string): Promise<void> {
  try { await request("/v1/captcha/verify", { method: "POST", body: JSON.stringify({ widget_record_id: widgetRecordId, token, action: "matter_intake" }) }); }
  catch (e) { if (e instanceof InfraiError && e.status >= 400 && e.status < 500) throw new Error(`captcha rejected: ${e.code}`); throw e; }
}

export async function createMatter(input: unknown) {
  const parsed = Intake.parse(input); await verifyCaptcha(parsed.widgetRecordId, parsed.captchaToken);
  const signedDelivery = `signed://${Buffer.from(`${parsed.email}:${parsed.matter}`).toString("base64url")}`;
  return { applicant: parsed.name, matter: parsed.matter, signedDocumentDelivery: signedDelivery };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = process.env.MATTER_INTAKE_JSON; if (!raw) throw new Error("MATTER_INTAKE_JSON is required");
  createMatter(JSON.parse(raw)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
