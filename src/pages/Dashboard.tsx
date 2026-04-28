import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Activity, AlertTriangle, BatteryWarning, CheckCircle2, Copy, HelpCircle, Plus, RefreshCw, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { maskKey, statusBg, statusColor, timeAgo } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import Analytics from "@/components/Analytics";

type ApiKey = Tables<"api_keys">;
type Snapshot = { key_id: string; snapshot_date: string; credits_remaining: number | null };

// Linear regression forecast: fit credits_remaining ~ a + b*day_index over last 7 snapshots.
// Returns point estimate + ±1σ confidence band (in days) for credits→0.
type Forecast = { days: number; low: number; high: number; r2: number };
function forecastDays(snaps: Snapshot[], keyId: string, remaining: number | null): Forecast | null {
  if (remaining == null || remaining <= 0) return null;
  const series = snaps
    .filter((s) => s.key_id === keyId && s.credits_remaining != null)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .slice(-7);
  if (series.length < 2) return null;

  const n = series.length;
  const xs = series.map((_, i) => i);
  const ys = series.map((s) => Number(s.credits_remaining));
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    denX += (xs[i] - meanX) ** 2;
    denY += (ys[i] - meanY) ** 2;
  }
  if (denX === 0) return null;
  const slope = num / denX; // credits per day; expect negative when burning
  if (slope >= 0) return null; // not depleting
  const burn = -slope;

  // residual std error → propagate to days uncertainty
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = denY === 0 ? 1 : Math.max(0, 1 - ssRes / denY);
  const stdErr = Math.sqrt(ssRes / Math.max(1, n - 2));
  const days = remaining / burn;
  const burnLow = Math.max(burn * 0.5, burn - stdErr);
  const burnHigh = burn + stdErr;
  const high = remaining / burnLow; // slower burn → more days
  const low = remaining / burnHigh; // faster burn → fewer days
  return {
    days: Math.max(0, Math.ceil(days)),
    low: Math.max(0, Math.floor(low)),
    high: Math.max(0, Math.ceil(high)),
    r2,
  };
}

const CATEGORIES = ["All", "AI", "Storage", "Payment", "Custom"] as const;

export default function Dashboard() {
  const { github } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const load = async () => {
    if (!github) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const [{ data }, { data: snaps }] = await Promise.all([
      supabase
        .from("api_keys")
        .select("*")
        .eq("owner_github", github.username)
        .order("created_at", { ascending: false }),
      (supabase.from as any)("key_credit_snapshots")
        .select("key_id, snapshot_date, credits_remaining")
        .eq("owner_github", github.username)
        .gte("snapshot_date", since.toISOString().slice(0, 10)),
    ]);
    setKeys(data ?? []);
    setSnapshots((snaps as Snapshot[]) ?? []);
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

  // Drop selections that no longer exist in filtered/keys
  useEffect(() => {
    setSelected((prev) => {
      const valid = new Set(keys.map((k) => k.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => { if (valid.has(id)) next.add(id); else changed = true; });
      return changed ? next : prev;
    });
  }, [keys]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((k) => selected.has(k.id));
  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((k) => next.delete(k.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((k) => next.add(k.id));
        return next;
      });
    }
  };

  const bulkCheck = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    const t = toast.loading(`Checking ${ids.length} key${ids.length > 1 ? "s" : ""}…`);
    let ok = 0, fail = 0;
    await Promise.all(ids.map(async (id) => {
      const { error } = await supabase.functions.invoke("check-key-health", { body: { key_id: id } });
      if (error) fail++; else ok++;
    }));
    setBulkBusy(false);
    toast.dismiss(t);
    if (fail === 0) toast.success(`Checked ${ok} key${ok > 1 ? "s" : ""}`);
    else toast.warning(`Checked ${ok}, failed ${fail}`);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} key${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkBusy(true);
    const { error } = await supabase.from("api_keys").delete().in("id", ids);
    setBulkBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(`Deleted ${ids.length} key${ids.length > 1 ? "s" : ""}`); clearSelection(); }
  };

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

      {/* Analytics */}
      <Analytics />

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

      {/* Selection toolbar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAllFiltered} />
            <span className="text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} selected`
                : `Select all ${filtered.length}`}
            </span>
          </label>
          {selected.size > 0 && (
            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading keys…</div>
      ) : keys.length === 0 ? (
        <div className="vault-card flex flex-col items-center gap-4 py-20 text-center">
          <ShieldCheck className="text-primary" style={{ width: 80, height: 80 }} strokeWidth={1.5} />
          <div>
            <div className="text-2xl font-bold text-foreground">No keys yet</div>
            <div className="mt-1 text-sm" style={{ color: "#555" }}>Add your first API key to get started</div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => navigate("/add")}><Plus className="mr-2 h-4 w-4" />Add First Key</Button>
            <Button variant="outline" onClick={() => navigate("/import")}><Upload className="mr-2 h-4 w-4" />Bulk Import</Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="vault-card flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No keys match your search</p>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setCategory("All"); }}>Clear filters</Button>
        </div>
      ) : (
        <KeyGrid items={filtered} snapshots={snapshots} selected={selected} onToggle={toggleSelect} />
      )}

      {/* Sticky bulk-action bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearSelection} title="Clear">
                <X className="h-4 w-4" />
              </Button>
              <span className="font-medium">{selected.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={bulkCheck} disabled={bulkBusy}>
                <RefreshCw className={`mr-2 h-4 w-4 ${bulkBusy ? "animate-spin" : ""}`} />
                Check / refresh
              </Button>
              <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={bulkBusy}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating add (hidden when bulk bar visible) */}
      {selected.size === 0 && (
        <Link to="/add" className="fixed bottom-6 right-6 z-30">
          <Button size="lg" className="h-14 rounded-full px-5 shadow-xl">
            <Plus className="mr-2 h-5 w-5" />Add Key
          </Button>
        </Link>
      )}
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

function KeyGrid({ items, snapshots, selected, onToggle }: { items: ApiKey[]; snapshots: Snapshot[]; selected: Set<string>; onToggle: (id: string) => void }) {
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
              {rowItems.map((k) => <KeyCard key={k.id} k={k} snapshots={snapshots} selected={selected.has(k.id)} onToggle={() => onToggle(k.id)} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyCard({ k, snapshots, selected, onToggle }: { k: ApiKey; snapshots: Snapshot[]; selected: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const used = k.credits_limit && k.credits_remaining != null ? Math.max(0, Math.min(100, ((Number(k.credits_limit) - Number(k.credits_remaining)) / Number(k.credits_limit)) * 100)) : null;
  const isOpenRouter = k.provider.toLowerCase() === "openrouter";
  const daysLeft = isOpenRouter ? forecastDays(snapshots, k.id, k.credits_remaining == null ? null : Number(k.credits_remaining)) : null;

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
    const { data, error } = await supabase.functions.invoke("reveal-key", { body: { key_id: k.id } });
    if (error || !data?.key) { toast.error("Could not reveal key"); return; }
    await navigator.clipboard.writeText(data.key as string);
    toast.success("Copied to clipboard");
  };
  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${k.key_name}"?`)) return;
    await supabase.from("api_keys").delete().eq("id", k.id);
    toast.success("Deleted");
  };

  return (
    <div
      onClick={() => navigate(`/key/${k.id}`)}
      className={`vault-card vault-card-hover relative cursor-pointer p-4 ${selected ? "ring-1 ring-primary" : ""}`}
    >
      <div
        className="absolute left-2 top-2 z-10"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        <Checkbox checked={selected} onCheckedChange={() => onToggle()} aria-label="Select key" />
      </div>
      <div className="mb-2 flex items-start justify-between gap-2 pl-7">
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

      {isOpenRouter && k.credits_limit != null && (
        <div className="my-2">
          <Progress value={used ?? 0} className="h-1.5" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{k.credits_remaining != null ? Number(k.credits_remaining).toFixed(4) : "—"} left</span>
            <span>limit {Number(k.credits_limit).toFixed(2)}</span>
          </div>
          {daysLeft != null && (
            <div className="mt-1.5 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Forecast</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${daysLeft.days <= 3 ? "border-destructive/60 text-destructive" : daysLeft.days <= 7 ? "border-warning/60 text-warning" : "text-muted-foreground"}`}
                >
                  ~{daysLeft.days}d until empty
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>range {daysLeft.low}–{daysLeft.high}d</span>
                <span>R²&nbsp;{daysLeft.r2.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}
      {isOpenRouter && k.is_free_tier && (
        <Badge variant="outline" className="my-2 text-[10px]">Free tier</Badge>
      )}

      <div className="mono mt-2 truncate rounded bg-secondary/60 px-2 py-1 text-xs text-muted-foreground">•••• encrypted at rest ••••</div>

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
