import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, LogOut, Settings as SettingsIcon } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
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

type Notif = { id: string; title: string; body: string | null; read: boolean; created_at: string };

export default function Layout() {
  const { github, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!github) return;
    const load = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, read, created_at")
        .eq("owner_github", github.username)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifs(data ?? []);
      setUnread((data ?? []).filter((n) => !n.read).length);
    };
    load();
    const ch = supabase
      .channel("notifs-" + github.username)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `owner_github=eq.${github.username}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [github]);

  const markAllRead = async () => {
    if (!github) return;
    await supabase.from("notifications").update({ read: true }).eq("owner_github", github.username).eq("read", false);
  };

  const markOneRead = async (id: string) => {
    if (!github) return;
    // Optimistic
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const navItem = "px-3 py-1.5 rounded-md text-sm transition-colors";
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold tracking-tight">Adams X <span className="text-primary">API Vault</span></span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/dashboard" end className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Dashboard</NavLink>
            <NavLink to="/repos" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Repos</NavLink>
            <NavLink to="/integration" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Integration</NavLink>
            <NavLink to="/digest" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Digest</NavLink>
            <NavLink to="/settings" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Settings</NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="px-0">Notifications</DropdownMenuLabel>
                  <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground">Mark all read</button>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-auto">
                  {notifs.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet</div>}
                  {notifs.map((n) => (
                    <div
                      key={n.id}
                      className={`group flex items-start gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-0 ${!n.read ? "bg-secondary/40" : ""}`}
                    >
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{n.title}</div>
                        {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</div>
                      </div>
                      {!n.read && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markOneRead(n.id); }}
                          className="shrink-0 self-center text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                          title="Mark as read"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

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

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1.5 md:hidden">
          <NavLink to="/dashboard" end className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary" : "text-muted-foreground"}`}>Dashboard</NavLink>
          <NavLink to="/repos" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary" : "text-muted-foreground"}`}>Repos</NavLink>
          <NavLink to="/integration" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary" : "text-muted-foreground"}`}>Integration</NavLink>
          <NavLink to="/digest" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary" : "text-muted-foreground"}`}>Digest</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `${navItem} ${isActive ? "bg-secondary" : "text-muted-foreground"}`}>Settings</NavLink>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
