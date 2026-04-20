// Public endpoint that returns the user's current best active key for a provider.
// Decrypts api_key inside the edge function only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") || "").trim();
  const token = (url.searchParams.get("token") || "").trim();

  if (!provider || !token) {
    return new Response(JSON.stringify({ error: "provider and token are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: tok, error: tokErr } = await admin
    .from("user_tokens").select("owner_github").eq("access_token", token).maybeSingle();
  if (tokErr || !tok) {
    return new Response(JSON.stringify({ error: "Invalid access token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: keys, error } = await admin
    .from("api_keys")
    .select("api_key_encrypted, api_key_nonce, credits_remaining, status, provider")
    .eq("owner_github", tok.owner_github)
    .eq("status", "active")
    .ilike("provider", provider)
    .order("credits_remaining", { ascending: false, nullsFirst: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!keys || keys.length === 0) {
    return new Response(JSON.stringify({ error: "No active keys available for this provider" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const k = keys[0];
  const { data: plain, error: decErr } = await admin.rpc("decrypt_api_key", { ct: k.api_key_encrypted, n: k.api_key_nonce });
  if (decErr || !plain) {
    return new Response(JSON.stringify({ error: "Decryption failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({
    key: plain,
    credits_remaining: k.credits_remaining,
    status: k.status,
    provider: k.provider,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
