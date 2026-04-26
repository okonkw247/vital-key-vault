import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, RefreshCw, Replace } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { statusBg, statusColor, timeAgo } from "@/lib/format";

type ApiKey = Tables<"api_keys">;
type Event = Tables<"key_events">;

export default function KeyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { github } = useAuth();
  const [key, setKey] = useState<ApiKey | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [show, setShow] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [newKey, setNewKey] = useState("");

  const load = async () => {
    if (!id) return;
    const { data: k } = await supabase.from("api_keys").select("*").eq("id", id).maybeSingle();
    setKey(k as ApiKey | null);
    const { data: ev } = await supabase.from("key_events").select("*").eq("key_id", id).order("created_at", { ascending: false }).limit(100);
    setEvents((ev as Event[]) ?? []);
  };

  useEffect(() => {
    load();
    if (!id || !github) return;
    const ch = supabase
      .channel("kd-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "api_keys", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "key_events", filter: `key_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, github?.username]);

  const usedPct = useMemo(() => {
    if (!key?.credits_limit || key.credits_remaining == null) return null;
    return Math.max(0, Math.min(100, ((Number(key.credits_limit) - Number(key.credits_remaining)) / Number(key.credits_limit)) * 100));
  }, [key]);

  if (!key) return <div className="text-muted-foreground">Loading...</div>;

  const onCheck = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("check-key-health", { body: { key_id: key.id } });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Health check complete");
  };

  const onReplace = async () => {
    if (!newKey.trim()) return;
    if (key.provider === "OpenRouter" && !newKey.startsWith("sk-or-")) {
      toast.error("OpenRouter keys must start with sk-or-"); return;
    }
    const { error } = await supabase.from("api_keys").update({
      api_key: newKey.trim(), status: "unknown", credits_remaining: null, last_checked: null
    }).eq("id", key.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("key_events").insert({
      key_id: key.id, event_type: "replaced", message: "Key value replaced"
    });
    setReplaceOpen(false); setNewKey(""); setRevealed(null); setShow(false);
    supabase.functions.invoke("check-key-health", { body: { key_id: key.id } });
    toast.success("Replaced. Re-checking...");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-semibold tracking-tight">{key.key_name}</h1>
        <Badge variant="secondary">{key.provider}</Badge>
        <Badge variant="outline">{key.category}</Badge>
        <div className={`ml-auto flex items-center gap-1.5 ${statusColor(key.status)}`}>
          <span className={`status-dot ${statusBg(key.status)}`} /> <span className="capitalize">{key.status}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="vault-card p-4 md:col-span-2">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>API Key</span>
            <button
              onClick={async () => {
                if (show) { setShow(false); return; }
                if (!revealed) {
                  setRevealing(true);
                  const { data, error } = await supabase
                    .from("api_keys")
                    .select("api_key")
                    .eq("id", key.id)
                    .single();
                  setRevealing(false);
                  if (error || !data?.api_key) { toast.error("Could not reveal key"); return; }
                  setRevealed(data.api_key as string);
                }
                setShow(true);
              }}
              className="flex items-center gap-1 text-xs hover:text-foreground"
            >
              {show ? <><EyeOff className="h-3 w-3" />Hide</> : <><Eye className="h-3 w-3" />{revealing ? "Decrypting..." : "Show"}</>}
            </button>
          </div>
          <div className="mono break-all rounded-md bg-secondary/60 p-3 text-sm">
            {show && revealed ? revealed : "•".repeat(64)}
          </div>
          {key.notes && <div className="mt-3 text-sm text-muted-foreground"><span className="text-foreground">Notes:</span> {key.notes}</div>}
          <div className="mt-3 text-xs text-muted-foreground">Last checked {timeAgo(key.last_checked)}</div>
          <div className="mt-4 flex gap-2">
            <Button onClick={onCheck} disabled={busy}><RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />Check Health Now</Button>
            <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Replace className="mr-2 h-4 w-4" />Replace Key</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Replace Key</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <Label>New key value</Label>
                  <Input className="mono" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="sk-or-..." />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setReplaceOpen(false)}>Cancel</Button>
                  <Button onClick={onReplace}>Replace</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="vault-card p-4">
          <div className="mb-3 text-sm text-muted-foreground">Credits</div>
          {key.credits_limit != null ? (
            <CircularGauge percent={usedPct ?? 0} label={`${key.credits_remaining ?? 0} / ${key.credits_limit}`} />
          ) : key.is_free_tier ? (
            <div className="text-center text-sm">Free tier (rate-limited)</div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">No credit data</div>
          )}
        </div>
      </div>

      <div className="vault-card p-4">
        <div className="mb-3 font-medium">Event Log</div>
        <div className="space-y-2">
          {events.length === 0 && <div className="text-sm text-muted-foreground">No events yet</div>}
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 border-b border-border/60 pb-2 last:border-0">
              <Badge variant="outline" className="text-[10px] uppercase">{e.event_type}</Badge>
              <div className="flex-1 text-sm">{e.message}</div>
              <div className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CircularGauge({ percent, label }: { percent: number; label: string }) {
  const r = 38, c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke="hsl(var(--secondary))" strokeWidth="8" fill="none" />
        <circle
          cx="50" cy="50" r={r} stroke="hsl(var(--primary))" strokeWidth="8" fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" className="fill-foreground text-base font-semibold">{Math.round(percent)}%</text>
      </svg>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">used</div>
    </div>
  );
}