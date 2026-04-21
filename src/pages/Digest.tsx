import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, BatteryWarning, Trophy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";

type Snapshot = {
  key_id: string;
  snapshot_date: string;
  credits_remaining: number | null;
  provider: string;
};
type ApiKey = { id: string; key_name: string; provider: string; status: string };
type Notif = { id: string; title: string; body: string | null; created_at: string };

export default function Digest() {
  const { github } = useAuth();
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [latest, setLatest] = useState<Notif | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!github) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 8);
    const [s, k, n] = await Promise.all([
      (supabase.from as any)("key_credit_snapshots")
        .select("key_id, snapshot_date, credits_remaining, provider")
        .eq("owner_github", github.username)
        .gte("snapshot_date", since.toISOString().slice(0, 10)),
      supabase.from("api_keys").select("id, key_name, provider, status").eq("owner_github", github.username),
      supabase.from("notifications")
        .select("id, title, body, created_at")
        .eq("owner_github", github.username)
        .eq("title", "Daily digest")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setSnaps((s.data as Snapshot[]) ?? []);
    setKeys((k.data as ApiKey[]) ?? []);
    setLatest((n.data as Notif) ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [github?.username]);

  // Compute deltas: per key, sum of positive day-over-day decreases over last 7 days
  const { burnByProvider, totalBurn, topConsumers, exhausted } = useMemo(() => {
    const keyMap = new Map(keys.map((k) => [k.id, k]));
    const byKey = new Map<string, Snapshot[]>();
    for (const s of snaps) {
      const arr = byKey.get(s.key_id) ?? [];
      arr.push(s);
      byKey.set(s.key_id, arr);
    }
    const perKey: { id: string; name: string; provider: string; burn: number }[] = [];
    const byProv = new Map<string, number>();
    for (const [id, arr] of byKey) {
      arr.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      let burn = 0;
      for (let i = 1; i < arr.length; i++) {
        const p = Number(arr[i - 1].credits_remaining ?? 0);
        const c = Number(arr[i].credits_remaining ?? 0);
        if (p > c) burn += p - c;
      }
      const k = keyMap.get(id);
      const prov = arr[0]?.provider ?? k?.provider ?? "unknown";
      perKey.push({ id, name: k?.key_name ?? "(deleted)", provider: prov, burn });
      byProv.set(prov, (byProv.get(prov) ?? 0) + burn);
    }
    perKey.sort((a, b) => b.burn - a.burn);
    return {
      burnByProvider: Array.from(byProv.entries()).sort((a, b) => b[1] - a[1]),
      totalBurn: perKey.reduce((s, k) => s + k.burn, 0),
      topConsumers: perKey.filter((k) => k.burn > 0).slice(0, 5),
      exhausted: keys.filter((k) => k.status === "exhausted"),
    };
  }, [snaps, keys]);

  const regenerate = async () => {
    setGenerating(true);
    const { error } = await (supabase.rpc as any)("generate_daily_digests");
    setGenerating(false);
    if (error) toast.error(error.message);
    else { toast.success("Digest regenerated"); load(); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Digest</h1>
          <p className="text-sm text-muted-foreground">
            Last 7 days of activity for @{github?.username}
            {latest && <> · generated {timeAgo(latest.created_at)}</>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={regenerate} disabled={generating}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
          Regenerate
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading digest…</div>
      ) : (
        <>
          {/* Headline numbers */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="vault-card p-5">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Flame className="h-4 w-4 text-warning" /> 7-day burn
              </div>
              <div className="text-3xl font-semibold tabular-nums">{totalBurn.toFixed(4)}</div>
              <div className="mt-1 text-xs text-muted-foreground">credits across all keys</div>
            </div>
            <div className="vault-card p-5">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <BatteryWarning className="h-4 w-4 text-destructive" /> Exhausted
              </div>
              <div className="text-3xl font-semibold tabular-nums">{exhausted.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">of {keys.length} keys</div>
            </div>
            <div className="vault-card p-5">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Trophy className="h-4 w-4 text-primary" /> Top consumer
              </div>
              <div className="truncate text-xl font-semibold">{topConsumers[0]?.name ?? "—"}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {topConsumers[0] ? `${topConsumers[0].burn.toFixed(4)} credits` : "no burn yet"}
              </div>
            </div>
          </section>

          {/* Burn by provider */}
          <section className="vault-card p-5">
            <h2 className="mb-3 font-medium">Burn by provider</h2>
            {burnByProvider.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snapshots yet — health checks need to run for at least 2 days.</p>
            ) : (
              <div className="space-y-2">
                {burnByProvider.map(([prov, burn]) => {
                  const pct = totalBurn > 0 ? (burn / totalBurn) * 100 : 0;
                  return (
                    <div key={prov}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="capitalize">{prov}</span>
                        <span className="tabular-nums text-muted-foreground">{burn.toFixed(4)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded bg-secondary">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Top consumers */}
          <section className="vault-card p-5">
            <h2 className="mb-3 font-medium">Top consumers</h2>
            {topConsumers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No usage detected in the last 7 days.</p>
            ) : (
              <div className="divide-y divide-border">
                {topConsumers.map((k, i) => (
                  <div key={k.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-muted-foreground tabular-nums">{i + 1}.</span>
                      <div>
                        <div className="font-medium">{k.name}</div>
                        <Badge variant="outline" className="text-[10px] uppercase">{k.provider}</Badge>
                      </div>
                    </div>
                    <span className="tabular-nums text-muted-foreground">{k.burn.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Exhausted keys */}
          <section className="vault-card p-5">
            <h2 className="mb-3 font-medium">Exhausted keys</h2>
            {exhausted.length === 0 ? (
              <p className="text-sm text-muted-foreground">All keys are healthy 🎉</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {exhausted.map((k) => (
                  <Badge key={k.id} variant="outline" className="border-destructive/60 text-destructive">
                    {k.key_name} · {k.provider}
                  </Badge>
                ))}
              </div>
            )}
          </section>

          {/* Raw digest from cron */}
          {latest?.body && (
            <section className="vault-card p-5">
              <h2 className="mb-2 font-medium">Latest cron-generated digest</h2>
              <p className="text-sm text-muted-foreground">{latest.body}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
