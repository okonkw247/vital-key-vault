import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-active-key`;

export default function Integration() {
  const { github } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  const load = async () => {
    if (!github) return;
    const { data } = await supabase.from("user_tokens").select("access_token").eq("owner_github", github.username).maybeSingle();
    setToken(data?.access_token ?? null);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [github?.username]);

  const regen = async () => {
    if (!github) return;
    if (!confirm("Regenerate access token? Existing integrations will stop working.")) return;
    const newTok = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("user_tokens").update({ access_token: newTok }).eq("owner_github", github.username);
    if (error) { toast.error(error.message); return; }
    setToken(newTok); toast.success("Token regenerated");
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  const url = token ? `${FUNC_URL}?provider=openrouter&token=${token}` : "";
  const nextSnippet = `// Next.js / React
const r = await fetch("${url}");
const { key, credits_remaining, status } = await r.json();
// use \`key\` as Authorization Bearer for OpenRouter`;

  const jsSnippet = `fetch("${url}")
  .then(r => r.json())
  .then(({ key }) => console.log("active key:", key));`;

  const nodeSnippet = `import https from "node:https";
https.get("${url}", (res) => {
  let body = "";
  res.on("data", (c) => body += c);
  res.on("end", () => console.log(JSON.parse(body)));
});`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Integration API</h1>
      <p className="text-sm text-muted-foreground">Use this endpoint in any of your projects to always get your current active key at runtime.</p>

      <div className="vault-card p-5">
        <div className="mb-2 text-sm text-muted-foreground">Your access token</div>
        <div className="flex items-center gap-2">
          <code className="mono flex-1 truncate rounded bg-secondary/60 px-3 py-2 text-sm">{token ?? "—"}</code>
          <Button variant="outline" size="icon" onClick={() => token && copy(token)}><Copy className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={regen} title="Regenerate"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="vault-card p-5">
        <div className="mb-2 text-sm text-muted-foreground">Endpoint</div>
        <div className="mono break-all rounded bg-secondary/60 p-3 text-sm">
          GET {FUNC_URL}?provider=openrouter&token=YOUR_TOKEN
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Response: <span className="mono">{`{ key, credits_remaining, status, provider }`}</span>
        </div>
      </div>

      <div className="vault-card p-5">
        <Tabs defaultValue="next">
          <TabsList>
            <TabsTrigger value="next">Next.js</TabsTrigger>
            <TabsTrigger value="js">Plain JS</TabsTrigger>
            <TabsTrigger value="node">Node.js</TabsTrigger>
          </TabsList>
          <TabsContent value="next"><CodeBlock code={nextSnippet} /></TabsContent>
          <TabsContent value="js"><CodeBlock code={jsSnippet} /></TabsContent>
          <TabsContent value="node"><CodeBlock code={nodeSnippet} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="mono overflow-x-auto rounded-md bg-secondary/60 p-3 text-xs leading-relaxed">{code}</pre>
      <Button size="icon" variant="ghost" className="absolute right-1 top-1 h-7 w-7" onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied"); }}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
