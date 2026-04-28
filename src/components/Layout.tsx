import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Settings as SettingsIcon, X } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { timeAgo } from "@/lib/format";

type EventRow = {
  id: string;
  key_id: string;
  event_type: string;
  message: string | null;
  created_at: string;
};

const READ_KEY = "axv:notif_last_read";

function eventColor(type: string) {
  const t = type.toLowerCase();
  if (t.includes("error") || t.includes("fail")) return "border-destructive/60 text-destructive";
  if (t.includes("exhaust")) return "border-warning/60 text-warning";
  if (t.includes("active") || t.includes("ok") || t.includes("check")) return "border-primary/60 text-primary";
  if (t.includes("replace") || t.includes("rotate")) return "border-secondary text-foreground";
  return "text-muted-foreground";
}

export default function Layout() {
  const { github, signOut } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [keyNames, setKeyNames] = useState<Record<string, string>>({});
  const [lastRead, setLastRead] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem(READ_KEY) : null;
    return v ? Number(v) : 0;
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!github) return;
    const load = async () => {
      const { data } = await supabase
        .from("key_events")
        .select("id, key_id, event_type, message, created_at")
        .eq("owner_github", github.username)
        .order("created_at", { ascending: false })
        .limit(20);
      const list = (data ?? []) as EventRow[];
      setEvents(list);
      const ids = Array.from(new Set(list.map((e) => e.key_id)));
      if (ids.length) {
        const { data: keys } = await supabase
          .from("api_keys")
          .select("id, key_name")
          .in("id", ids);
        const map: Record<string, string> = {};
        (keys ?? []).forEach((k: any) => { map[k.id] = k.key_name; });
        setKeyNames(map);
      }
    };
    load();
    const ch = supabase
      .channel("kev-" + github.username)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "key_events", filter: `owner_github=eq.${github.username}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [github]);

  const last24Unread = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return t >= dayAgo && t > lastRead;
    }).length;
  }, [events, lastRead]);

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem(READ_KEY, String(now));
    setLastRead(now);
  };

  const navItem = "px-3 py-1.5 rounded-md text-sm transition-colors";
  const links = (
    <>
      <NavLink to="/dashboard" end onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Dashboard</NavLink>
      <NavLink to="/repos" onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Repos</NavLink>
      <NavLink to="/integration" onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Integration</NavLink>
      <NavLink to="/digest" onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Digest</NavLink>
      <NavLink to="/settings" onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Settings</NavLink>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <Logo size={28} />
            <span className="truncate font-semibold tracking-tight">Adams X <span className="text-primary">API Vault</span></span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">{links}</nav>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {last24Unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {last24Unread > 99 ? "99+" : last24Unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="px-0">Recent activity</DropdownMenuLabel>
                  <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">Mark all read</button>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-auto">
                  {events.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No events yet</div>}
                  {events.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => navigate(`/key/${e.key_id}`)}
                      className="flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{keyNames[e.key_id] ?? "Key"}</span>
                          <Badge variant="outline" className={`text-[10px] uppercase ${eventColor(e.event_type)}`}>{e.event_type}</Badge>
                        </div>
                        {e.message && <div className="truncate text-xs text-muted-foreground">{e.message}</div>}
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              className="rounded-md p-2 text-muted-foreground hover:text-foreground md:hidden"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border p-0.5 pr-3 hover:border-primary/40">
                  {github?.avatar_url ? (
                    <img src={github.avatar_url} alt={github.username} className="h-7 w-7 rounded-full" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-secondary" />
                  )}
                  <span className="hidden text-sm sm:inline">{github?.username}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{github?.username}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}><SettingsIcon className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await signOut(); navigate("/login"); }}>
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <nav className="flex flex-col gap-1 border-t border-border px-3 py-2 md:hidden">{links}</nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
