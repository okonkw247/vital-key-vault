import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const deleteAll = async () => {
    if (!github) return;
    if (deleteConfirm !== "DELETE") return;
    const { error } = await supabase.from("api_keys").delete().eq("owner_github", github.username);
    if (error) toast.error(error.message);
    else { toast.success("All keys deleted"); setDeleteOpen(false); setDeleteConfirm(""); }
  };

  const [rotating, setRotating] = useState(false);
  const rotateKeys = async () => {
    if (!github) return;
    if (!confirm("Re-encrypt all your API keys with fresh nonces? This is safe and reversible.")) return;
    setRotating(true);
    const startedAt = new Date();
    const { data, error } = await (supabase.rpc as any)("rotate_my_keys");
    setRotating(false);
    if (error) { toast.error(error.message); return; }

    const count = Number(data ?? 0);
    const { data: rows } = await supabase
      .from("api_keys")
      .select("key_name")
      .eq("owner_github", github.username)
      .order("key_name", { ascending: true });
    const names = (rows ?? []).map((r) => r.key_name);
    const summary = names.length > 4
      ? `${names.slice(0, 4).join(", ")} +${names.length - 4} more`
      : names.join(", ") || "—";

    await supabase.from("notifications").insert({
      owner_github: github.username,
      title: "Encryption rotated",
      body: `Re-encrypted ${count} key${count === 1 ? "" : "s"} at ${startedAt.toLocaleTimeString()} — ${summary}`,
    });

    toast.success(`Rotated ${count} key${count === 1 ? "" : "s"}`, {
      description: names.length ? `Re-encrypted: ${summary}` : "No keys needed rotation",
      duration: 6000,
    });
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

      <section className="vault-card p-5 space-y-3">
        <h2 className="font-medium">Encryption</h2>
        <p className="text-xs text-muted-foreground">
          Re-encrypts every one of your API keys with a fresh nonce derived from the pgsodium master key.
          Use this after any suspected exposure of an old DB dump.
        </p>
        <Button variant="outline" onClick={rotateKeys} disabled={rotating}>
          {rotating ? "Rotating…" : "Rotate encryption key"}
        </Button>
      </section>

      <section className="vault-card border-destructive/40 p-5 space-y-3">
        <h2 className="font-medium text-destructive">Danger zone</h2>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete all my keys</Button>
      </section>

      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteConfirm(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive">Delete all keys?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">This permanently removes every API key in your vault. This cannot be undone.</p>
            <Label>Type <span className="mono font-semibold text-foreground">DELETE</span> to confirm</Label>
            <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteAll} disabled={deleteConfirm !== "DELETE"}>Delete everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
