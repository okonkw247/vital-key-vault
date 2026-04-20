// Authenticated endpoint to decrypt and reveal a single key (for the owner).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const meta = (userData.user.user_metadata ?? {}) as Record<string, any>;
  const owner = meta.user_name || meta.preferred_username;
  if (!owner) {
    return new Response(JSON.stringify({ error: "No GitHub username on profile" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const keyId: string | undefined = body.key_id;
  if (!keyId) return new Response(JSON.stringify({ error: "key_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row, error } = await admin.from("api_keys").select("api_key_encrypted, api_key_nonce, owner_github").eq("id", keyId).maybeSingle();
  if (error || !row) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (row.owner_github !== owner) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: plain, error: decErr } = await admin.rpc("decrypt_api_key", { ct: row.api_key_encrypted, n: row.api_key_nonce });
  if (decErr) return new Response(JSON.stringify({ error: decErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  return new Response(JSON.stringify({ key: plain }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
