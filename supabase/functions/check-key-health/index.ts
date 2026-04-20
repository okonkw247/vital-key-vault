// Health check edge function. Checks one key (by id) or all keys (cron).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface HealthResult {
  status: "active" | "exhausted" | "error" | "unknown";
  credits_remaining: number | null;
  credits_limit: number | null;
  is_free_tier: boolean;
  message: string;
}

async function checkOpenRouter(apiKey: string): Promise<HealthResult> {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (r.status === 401) {
      return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: "Invalid key (401)" };
    }
    if (!r.ok) {
      return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `HTTP ${r.status}` };
    }
    const j = await r.json();
    const data = j.data ?? {};
    const usage: number = Number(data.usage ?? 0);
    const limit: number | null = data.limit === null || data.limit === undefined ? null : Number(data.limit);
    const isFree: boolean = !!data.is_free_tier;
    if (limit !== null && usage >= limit) {
      return {
        status: "exhausted",
        credits_remaining: 0,
        credits_limit: limit,
        is_free_tier: isFree,
        message: `Exhausted: ${usage.toFixed(4)} / ${limit}`,
      };
    }
    return {
      status: "active",
      credits_remaining: limit !== null ? Number((limit - usage).toFixed(6)) : null,
      credits_limit: limit,
      is_free_tier: isFree,
      message: isFree ? "Active (free tier)" : `Active: ${(limit ?? 0) - usage} remaining`,
    };
  } catch (e) {
    return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `Network: ${(e as Error).message}` };
  }
}

async function checkGroq(apiKey: string): Promise<HealthResult> {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (r.status === 200) return { status: "active", credits_remaining: null, credits_limit: null, is_free_tier: false, message: "Active" };
    if (r.status === 429) return { status: "exhausted", credits_remaining: 0, credits_limit: null, is_free_tier: false, message: "Rate limited" };
    return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `HTTP ${r.status}` };
  } catch (e) {
    return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `Network: ${(e as Error).message}` };
  }
}

async function checkGemini(apiKey: string): Promise<HealthResult> {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (r.status === 200) return { status: "active", credits_remaining: null, credits_limit: null, is_free_tier: true, message: "Active" };
    return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `HTTP ${r.status}` };
  } catch (e) {
    return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `Network: ${(e as Error).message}` };
  }
}

async function checkOpenAI(apiKey: string): Promise<HealthResult> {
  try {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    if (r.status === 200) return { status: "active", credits_remaining: null, credits_limit: null, is_free_tier: false, message: "Active" };
    if (r.status === 429) return { status: "exhausted", credits_remaining: 0, credits_limit: null, is_free_tier: false, message: "Rate limited" };
    return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `HTTP ${r.status}` };
  } catch (e) {
    return { status: "error", credits_remaining: null, credits_limit: null, is_free_tier: false, message: `Network: ${(e as Error).message}` };
  }
}

async function checkProvider(provider: string, apiKey: string): Promise<HealthResult> {
  const p = (provider || "").toLowerCase();
  if (p === "openrouter") return checkOpenRouter(apiKey);
  if (p === "groq") return checkGroq(apiKey);
  if (p === "gemini") return checkGemini(apiKey);
  if (p === "openai") return checkOpenAI(apiKey);
  return { status: "unknown", credits_remaining: null, credits_limit: null, is_free_tier: false, message: "No checker for provider" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const targetKeyId: string | undefined = body.key_id;

  let keysQ = admin.from("api_keys").select("id, owner_github, provider, api_key, key_name");
  if (targetKeyId) keysQ = keysQ.eq("id", targetKeyId);
  const { data: keys, error } = await keysQ;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let processed = 0;
  let changed = 0;
  for (const k of keys ?? []) {
    const result = await checkProvider(k.provider, k.api_key);
    processed++;

    // get current status to detect change
    const { data: prev } = await admin.from("api_keys").select("status").eq("id", k.id).single();
    const prevStatus = prev?.status;

    await admin.from("api_keys").update({
      status: result.status,
      credits_remaining: result.credits_remaining,
      credits_limit: result.credits_limit,
      is_free_tier: result.is_free_tier,
      last_checked: new Date().toISOString(),
    }).eq("id", k.id);

    const { data: ev } = await admin.from("key_events").insert({
      key_id: k.id,
      owner_github: k.owner_github,
      event_type: "checked",
      message: result.message,
    }).select("id").single();

    if (prevStatus !== result.status && (result.status === "exhausted" || result.status === "error")) {
      changed++;
      await admin.from("notifications").insert({
        owner_github: k.owner_github,
        key_id: k.id,
        event_id: ev?.id ?? null,
        title: `${k.key_name} → ${result.status}`,
        body: result.message,
      });

      // Webhook fire-and-forget
      const { data: tok } = await admin.from("user_tokens").select("webhook_urls").eq("owner_github", k.owner_github).single();
      const webhookUrls = (tok?.webhook_urls ?? {}) as Record<string, string>;
      const url = webhookUrls?.[k.provider.toLowerCase()];
      if (url) {
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key_name: k.key_name, provider: k.provider, status: result.status, timestamp: new Date().toISOString() }),
          });
        } catch (_) { /* ignore */ }
      }
    }
  }

  return new Response(JSON.stringify({ processed, changed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
