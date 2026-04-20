import { useEffect, useState } from "react";
import { ArrowLeft, GitBranch, Link2, Search, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Repo = { id: number; name: string; full_name: string; description: string | null; language: string | null; updated_at: string; html_url: string };
type Detected = { providers: string[]; loading?: boolean };

export default function Repos() {
  const navigate = useNavigate();
  const { github, session } = useAuth();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [detected, setDetected] = useState<Record<string, Detected>>({});
  const [keys, setKeys] = useState<Tables<"api_keys">[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({}); // repo_name -> key_id
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ghToken = (session as any)?.provider_token;
    const load = async () => {
      setError(null);
      if (!ghToken) {
        setLoading(false);
        setError("GitHub access token not found in your session. Sign out and sign in again to grant the `repo` scope.");
        return;
      }
      try {
        const r = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
          headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" },
        });
        if (!r.ok) throw new Error(`GitHub: HTTP ${r.status}`);
        const data: Repo[] = await r.json();
        setRepos(data);
      } catch (e) {
        setError((e as Error).message);
      }
      // Load my keys + links
      if (github) {
        const [{ data: ks }, { data: ls }] = await Promise.all([
          supabase.from("api_keys").select("*").eq("owner_github", github.username),
          supabase.from("repo_key_links").select("repo_name, key_id").eq("owner_github", github.username),
        ]);
        setKeys(ks ?? []);
        const map: Record<string, string> = {};
        for (const l of ls ?? []) map[l.repo_name] = l.key_id ?? "";
        setLinks(map);
      }
      setLoading(false);
    };
    load();
  }, [session, github]);

  const scan = async (repo: Repo) => {
    const ghToken = (session as any)?.provider_token;
    if (!ghToken) return;
    setDetected((s) => ({ ...s, [repo.full_name]: { providers: [], loading: true } }));
    const fetchFile = async (path: string) => {
      const r = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${path}`, {
        headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github.raw" },
      });
      if (!r.ok) return "";
      return await r.text();
    };
    const [readme, env] = await Promise.all([fetchFile("README.md"), fetchFile(".env.example")]);
    const text = (readme + "\n" + env).toLowerCase();
    const providers = ["openrouter", "groq", "openai", "gemini", "anthropic"].filter((p) => text.includes(p));
    setDetected((s) => ({ ...s, [repo.full_name]: { providers } }));
  };

  const linkKey = async (repoName: string, keyId: string) => {
    if (!github) return;
    const { error } = await supabase.from("repo_key_links").upsert(
      { owner_github: github.username, repo_name: repoName, key_id: keyId },
      { onConflict: "owner_github,repo_name" },
    );
    if (error) { toast.error(error.message); return; }
    setLinks((s) => ({ ...s, [repoName]: keyId }));
    toast.success("Linked");
  };

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-semibold tracking-tight">GitHub Repos</h1>
      </div>

      {error && <div className="vault-card p-4 text-sm text-destructive">{error}</div>}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter repos…" className="pl-8" />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading repos…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const det = detected[r.full_name];
            const linkedKeyId = links[r.full_name];
            const linkedKey = keys.find((k) => k.id === linkedKeyId);
            return (
              <div key={r.id} className="vault-card vault-card-hover p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                      <a href={r.html_url} target="_blank" rel="noreferrer" className="truncate font-medium hover:text-primary">{r.name}</a>
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                    {r.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</div>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {r.language && <Badge variant="outline">{r.language}</Badge>}
                  <span>updated {timeAgo(r.updated_at)}</span>
                </div>

                {det?.providers && det.providers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {det.providers.map((p) => <Badge key={p} variant="secondary" className="text-[10px] uppercase">{p}</Badge>)}
                  </div>
                )}

                {linkedKey && (
                  <div className="mt-2 text-xs">
                    Linked: <span className="font-medium">{linkedKey.key_name}</span>{" "}
                    <span className="capitalize text-muted-foreground">({linkedKey.status})</span>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => scan(r)} disabled={det?.loading}>
                    {det?.loading ? "Scanning…" : "Scan"}
                  </Button>
                  <LinkKeyDialog repoName={r.full_name} keys={keys} current={linkedKeyId} onLink={linkKey} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LinkKeyDialog({ repoName, keys, current, onLink }: { repoName: string; keys: Tables<"api_keys">[]; current?: string; onLink: (repo: string, keyId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current ?? "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Link2 className="mr-1.5 h-3.5 w-3.5" />Link Key</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Link a key to {repoName}</DialogTitle></DialogHeader>
        <Select value={val} onValueChange={setVal}>
          <SelectTrigger><SelectValue placeholder="Select a key…" /></SelectTrigger>
          <SelectContent>
            {keys.map((k) => <SelectItem key={k.id} value={k.id}>{k.key_name} — {k.provider}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onLink(repoName, val); setOpen(false); }} disabled={!val}>Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
