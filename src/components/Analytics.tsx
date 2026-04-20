import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Snapshot = {
  id: string; key_id: string; owner_github: string; provider: string;
  snapshot_date: string; credits_remaining: number | null; credits_limit: number | null; created_at: string;
};
type ApiKey = Tables<"api_keys">;

const PROVIDER_COLORS: Record<string, string> = {
  openrouter: "hsl(var(--primary))",
  groq: "hsl(38 100% 55%)",
  gemini: "hsl(210 100% 60%)",
  openai: "hsl(280 80% 65%)",
  custom: "hsl(var(--muted-foreground))",
};
function colorFor(p: string) { return PROVIDER_COLORS[p.toLowerCase()] ?? "hsl(var(--primary))"; }

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function Analytics() {
  const { github } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!github) return;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const [{ data: snaps }, { data: ks }] = await Promise.all([
        (supabase.from as any)("key_credit_snapshots").select("*")
          .eq("owner_github", github.username)
          .gte("snapshot_date", since.toISOString().slice(0, 10))
          .order("snapshot_date", { ascending: true }),
        supabase.from("api_keys").select("*").eq("owner_github", github.username),
      ]);
      setSnapshots((snaps as Snapshot[]) ?? []);
      setKeys((ks as ApiKey[]) ?? []);
      setLoading(false);
    })();
  }, [github?.username]);

  // 7-day burn per provider: per-day sum of (yesterday_remaining - today_remaining) across keys
  const burnData = useMemo(() => {
    const days = lastNDates(7);
    const providers = Array.from(new Set(snapshots.map((s) => s.provider.toLowerCase())));

    // Group: provider → keyId → date → remaining
    const byKey = new Map<string, Map<string, number | null>>();
    for (const s of snapshots) {
      const k = `${s.provider.toLowerCase()}::${s.key_id}`;
      if (!byKey.has(k)) byKey.set(k, new Map());
      byKey.get(k)!.set(s.snapshot_date as unknown as string, s.credits_remaining == null ? null : Number(s.credits_remaining));
    }

    return days.map((d, idx) => {
      const row: Record<string, any> = { date: d.slice(5) };
      for (const p of providers) row[p] = 0;
      if (idx === 0) return row;
      const prevDay = days[idx - 1];
      for (const [k, map] of byKey.entries()) {
        const provider = k.split("::")[0];
        const prev = map.get(prevDay);
        const curr = map.get(d);
        if (prev != null && curr != null && prev > curr) {
          row[provider] = (row[provider] ?? 0) + Number((prev - curr).toFixed(6));
        }
      }
      return row;
    });
  }, [snapshots]);

  const providersInBurn = useMemo(() => {
    return Array.from(new Set(snapshots.map((s) => s.provider.toLowerCase())));
  }, [snapshots]);

  // Top 5 consuming keys: sum of all positive deltas in window per key
  const topKeys = useMemo(() => {
    const byKey = new Map<string, { date: string; remaining: number | null }[]>();
    for (const s of snapshots) {
      const arr = byKey.get(s.key_id) ?? [];
      arr.push({ date: s.snapshot_date as unknown as string, remaining: s.credits_remaining == null ? null : Number(s.credits_remaining) });
      byKey.set(s.key_id, arr);
    }
    const totals: { keyId: string; consumed: number }[] = [];
    for (const [keyId, arr] of byKey.entries()) {
      arr.sort((a, b) => a.date.localeCompare(b.date));
      let sum = 0;
      for (let i = 1; i < arr.length; i++) {
        const p = arr[i - 1].remaining, c = arr[i].remaining;
        if (p != null && c != null && p > c) sum += (p - c);
      }
      if (sum > 0) totals.push({ keyId, consumed: Number(sum.toFixed(6)) });
    }
    totals.sort((a, b) => b.consumed - a.consumed);
    return totals.slice(0, 5).map((t) => {
      const k = keys.find((x) => x.id === t.keyId);
      return { name: k?.key_name ?? t.keyId.slice(0, 6), provider: k?.provider ?? "—", consumed: t.consumed };
    });
  }, [snapshots, keys]);

  // Exhaustion rate (current snapshot)
  const exhaustion = useMemo(() => {
    const total = keys.length;
    const exhausted = keys.filter((k) => k.status === "exhausted").length;
    const error = keys.filter((k) => k.status === "error").length;
    const active = keys.filter((k) => k.status === "active").length;
    const unknown = total - exhausted - error - active;
    const rate = total > 0 ? (exhausted / total) * 100 : 0;
    return {
      rate: Number(rate.toFixed(1)),
      total, exhausted, error, active, unknown,
      pie: [
        { name: "Active", value: active, color: "hsl(var(--primary))" },
        { name: "Exhausted", value: exhausted, color: "hsl(var(--warning))" },
        { name: "Error", value: error, color: "hsl(var(--destructive))" },
        { name: "Unknown", value: unknown, color: "hsl(var(--muted-foreground))" },
      ].filter((x) => x.value > 0),
    };
  }, [keys]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading analytics…</div>;
  }

  const hasBurn = burnData.some((d) => providersInBurn.some((p) => (d[p] ?? 0) > 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Analytics — last 7 days</h2>
        <Badge variant="outline" className="text-[10px]">snapshot-based</Badge>
      </div>

      <Tabs defaultValue="burn">
        <TabsList>
          <TabsTrigger value="burn">Credit burn</TabsTrigger>
          <TabsTrigger value="top">Top keys</TabsTrigger>
          <TabsTrigger value="exhaust">Exhaustion</TabsTrigger>
        </TabsList>

        <TabsContent value="burn">
          <Card className="p-4 bg-card border-border">
            {!hasBurn ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No burn data yet. Daily snapshots accumulate as health checks run — come back tomorrow.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={burnData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {providersInBurn.map((p) => (
                    <Line key={p} type="monotone" dataKey={p} stroke={colorFor(p)} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="top">
          <Card className="p-4 bg-card border-border">
            {topKeys.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">No consumption data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topKeys} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Bar dataKey="consumed" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="exhaust">
          <Card className="p-4 bg-card border-border">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center">
                <div className="text-5xl font-semibold tabular-nums text-warning">{exhaustion.rate}%</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Exhaustion rate</div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {exhaustion.exhausted} of {exhaustion.total} keys exhausted · {exhaustion.error} errored
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={exhaustion.pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {exhaustion.pie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
