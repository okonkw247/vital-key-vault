import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Activity, AlertTriangle, BatteryWarning, CheckCircle2, Copy, HelpCircle, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { maskKey, statusBg, statusColor, timeAgo } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type ApiKey = Tables<"api_keys">;

const CATEGORIES = ["All", "AI", "Storage", "Payment", "Custom"] as const;

export default function Dashboard() {
  const { github } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("All");

  const load = async () => {
    if (!github) return;
    setLoading(true);
    const { data } = await supabase
      .from("api_keys")
      .select("*")
      .eq("owner_github", github.username)
      .order("created_at", { ascending: false });
    setKeys(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!github) return;
    const ch = supabase
      .channel("keys-" + github.username)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "api_keys", filter: `owner_github=eq.${github.username}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [github?.username]);

  const stats = useMemo(() => {
    const s = { total: keys.length, active: 0, exhausted: 0, error: 0, unknown: 0 };
    for (const k of keys) {
      if (k.status === "active") s.active++;
      else if (k.status === "exhausted") s.exhausted++;
      else if (k.status === "error") s.error++;
      else s.unknown++;
    }
    return s;
  }, [keys]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return keys.filter((k) => {
      if (category !== "All" && k.category !== category) return false;
      if (!q) return true;
      return (
        k.key_name.toLowerCase().includes(q) ||
        k.provider.toLowerCase().includes(q)
      );
    });
  }, [keys, search, category]);

  return (
    <div className="space-y-6 pb-20">
      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<Activity className="h-4 w-4" />} label="Total" value={stats.total} accent="text-foreground" />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Active" value={stats.active} accent="text-primary" />
        <StatCard icon={<BatteryWarning className="h-4 w-4" />} label="Exhausted" value={stats.exhausted} accent="text-warning" />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Errors" value={stats.error} accent="text-destructive" />
        <StatCard icon={<HelpCircle className="h-4 w-4" />} label="Unknown" value={stats.unknown} accent="text-muted-foreground" />
      </section>

      {/* Filters */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={category} onValueChange={(v) => setCategory(v as any)}>
          <TabsList>
            {CATEGORIES.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="flex flex-1 items-center gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search keys or providers…" className="pl-8" />
          </div>
          <Button variant="outline" onClick={() => navigate("/import")}><Upload className="mr-2 h-4 w-4" />Bulk Import</Button>
        </div>
      </section>

      {/* List */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading keys…</div>
      ) : filtered.length === 0 ? (
        <div className="vault-card flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-muted-foreground">No keys yet. Add your first one.</p>
          <Button onClick={() => navigate("/add")}><Plus className="mr-2 h-4 w-4" />Add Key</Button>
        </div>
      ) : (
        <KeyGrid items={filtered} />
      )}

      {/* Floating add */}
      <Link to="/add" className="fixed bottom-6 right-6 z-30">
        <Button size="lg" className="h-14 rounded-full px-5 shadow-xl">
          <Plus className="mr-2 h-5 w-5" />Add Key
        </Button>
      </Link>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="vault-card p-4">
      <div className={`mb-2 flex items-center gap-2 text-xs ${accent}`}>
        {icon}<span className="uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}

function KeyGrid({ items }: { items: ApiKey[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const computeCols = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(3);
      else if (w >= 640) setCols(2);
      else setCols(1);
    };
    computeCols();
    window.addEventListener("resize", computeCols);
    return () => window.removeEventListener("resize", computeCols);
  }, []);

  const rowCount = Math.ceil(items.length / cols);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-280px)] overflow-auto rounded-xl">
      <div style={{ height: rowVirtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {rowVirtualizer.getVirtualItems().map((vRow) => {
          const start = vRow.index * cols;
          const rowItems = items.slice(start, start + cols);
          return (
            <div
              key={vRow.key}
              className="grid gap-3 px-0.5 pb-3"
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                transform: `translateY(${vRow.start}px)`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {rowItems.map((k) => <KeyCard key={k.id} k={k} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyCard({ k }: { k: ApiKey }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const used = k.credits_limit && k.credits_remaining != null ? Math.max(0, Math.min(100, ((Number(k.credits_limit) - Number(k.credits_remaining)) / Number(k.credits_limit)) * 100)) : null;

  const onCheck = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    const { error } = await supabase.functions.invoke("check-key-health", { body: { key_id: k.id } });
    setBusy(false);
    if (error) toast.error("Check failed: " + error.message);
    else toast.success("Health check complete");
  };
  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(k.api_key);
    toast.success("Copied to clipboard");
  };
  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${k.key_name}"?`)) return;
    await supabase.from("api_keys").delete().eq("id", k.id);
    toast.success("Deleted");
  };

  return (
    <div onClick={() => navigate(`/key/${k.id}`)} className="vault-card vault-card-hover cursor-pointer p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{k.key_name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] uppercase">{k.provider}</Badge>
            <Badge variant="outline" className="text-[10px] uppercase">{k.category}</Badge>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${statusColor(k.status)}`}>
          <span className={`status-dot ${statusBg(k.status)}`} />
          <span className="capitalize">{k.status}</span>
        </div>
      </div>

      {k.provider.toLowerCase() === "openrouter" && k.credits_limit != null && (
        <div className="my-2">
          <Progress value={used ?? 0} className="h-1.5" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{k.credits_remaining != null ? Number(k.credits_remaining).toFixed(4) : "—"} left</span>
            <span>limit {Number(k.credits_limit).toFixed(2)}</span>
          </div>
        </div>
      )}
      {k.provider.toLowerCase() === "openrouter" && k.is_free_tier && (
        <Badge variant="outline" className="my-2 text-[10px]">Free tier</Badge>
      )}

      <div className="mono mt-2 truncate rounded bg-secondary/60 px-2 py-1 text-xs text-muted-foreground">{maskKey(k.api_key)}</div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>checked {timeAgo(k.last_checked)}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCheck} disabled={busy} title="Check">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCopy} title="Copy"><Copy className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}
