import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PROVIDERS = ["openrouter", "groq", "gemini", "openai"];

export default function Settings() {
  const { github, signOut } = useAuth();
  const [interval, setInterval] = useState("30");
  const [webhooks, setWebhooks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!github) return;
    (async () => {
      const { data } = await supabase.from("user_tokens").select("health_check_minutes, webhook_urls").eq("owner_github", github.username).maybeSingle();
      if (data) {
        setInterval(String(data.health_check_minutes ?? 30));
        setWebhooks((data.webhook_urls as Record<string, string>) ?? {});
      }
    })();
  }, [github]);

  const save = async () => {
    if (!github) return;
    setSaving(true);
    const { error } = await supabase.from("user_tokens").update({
      health_check_minutes: Number(interval),
      webhook_urls: webhooks,
    }).eq("owner_github", github.username);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const deleteAll = async () => {
    if (!github) return;
    if (!confirm("Delete ALL your keys? This cannot be undone.")) return;
    const { error } = await supabase.from("api_keys").delete().eq("owner_github", github.username);
    if (error) toast.error(error.message); else toast.success("All keys deleted");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="vault-card p-5">
        <h2 className="mb-3 font-medium">Profile</h2>
        <div className="flex items-center gap-3">
          {github?.avatar_url && <img src={github.avatar_url} alt={github.username} className="h-12 w-12 rounded-full" />}
          <div className="text-sm">
            <div className="font-medium">{github?.name || github?.username}</div>
            <div className="text-muted-foreground">@{github?.username}</div>
            {github?.email && <div className="text-muted-foreground">{github.email}</div>}
          </div>
          <Button variant="outline" className="ml-auto" onClick={signOut}>Sign out</Button>
        </div>
      </section>

      <section className="vault-card p-5 space-y-3">
        <h2 className="font-medium">Health check frequency</h2>
        <Select value={interval} onValueChange={setInterval}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="15">Every 15 minutes</SelectItem>
            <SelectItem value="30">Every 30 minutes</SelectItem>
            <SelectItem value="60">Every 60 minutes</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Per-user scheduling — your keys are checked at this exact frequency by background cron jobs (15 / 30 / 60 minute buckets).</p>
      </section>

      <section className="vault-card p-5 space-y-3">
        <h2 className="font-medium">Webhook URLs (per provider)</h2>
        <p className="text-xs text-muted-foreground">When a key fails or is exhausted, we POST {`{ key_name, provider, status, timestamp }`} to this URL.</p>
        {PROVIDERS.map((p) => (
          <div key={p} className="grid grid-cols-3 items-center gap-2">
            <Label className="capitalize">{p}</Label>
            <Input
              className="col-span-2"
              placeholder="https://your-app.com/webhook"
              value={webhooks[p] ?? ""}
              onChange={(e) => setWebhooks((s) => ({ ...s, [p]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </section>

      <section className="vault-card border-destructive/40 p-5 space-y-3">
        <h2 className="font-medium text-destructive">Danger zone</h2>
        <Button variant="destructive" onClick={deleteAll}>Delete all my keys</Button>
      </section>
    </div>
  );
}
