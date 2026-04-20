import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Papa from "papaparse";
import { ArrowLeft, FileText, Upload as UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = { key_name: string; api_key: string; provider: string; category: string; notes?: string };

export default function ImportKeys() {
  const { github } = useAuth();
  const navigate = useNavigate();
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);

  const handleFile = (file: File) => {
    Papa.parse<Row>(file, {
      header: true, skipEmptyLines: true,
      complete: (r) => {
        const rows = (r.data as any[])
          .map((x) => ({
            key_name: String(x.key_name ?? "").trim(),
            api_key: String(x.api_key ?? "").trim(),
            provider: String(x.provider ?? "OpenRouter").trim() || "OpenRouter",
            category: String(x.category ?? "AI").trim() || "AI",
            notes: x.notes ? String(x.notes) : undefined,
          }))
          .filter((x) => x.api_key);
        setCsvRows(rows);
        toast.success(`${rows.length} rows detected`);
      },
      error: (e) => toast.error(e.message),
    });
  };

  const pasteRows = (): Row[] => {
    return pasteText.split("\n").map((l) => l.trim()).filter(Boolean).map((api_key, i) => ({
      key_name: `OpenRouter Key #${i + 1}`,
      api_key, provider: "OpenRouter", category: "AI",
    }));
  };

  const runImport = async (rows: Row[]) => {
    if (!github) return;
    if (rows.length === 0) { toast.error("Nothing to import"); return; }

    setImporting(true); setProgress(0);

    // Validate (OpenRouter must start with sk-or-)
    const valid: Row[] = [];
    let invalid = 0;
    for (const r of rows) {
      if (r.provider.toLowerCase() === "openrouter" && !r.api_key.startsWith("sk-or-")) { invalid++; continue; }
      if (!r.api_key) { invalid++; continue; }
      valid.push(r);
    }

    // Existing keys (dedup)
    const { data: existing } = await supabase.from("api_keys").select("api_key").eq("owner_github", github.username);
    const existingSet = new Set((existing ?? []).map((x) => x.api_key));
    const seen = new Set<string>();
    const toInsert = valid.filter((r) => {
      if (existingSet.has(r.api_key) || seen.has(r.api_key)) return false;
      seen.add(r.api_key); return true;
    });
    const skipped = valid.length - toInsert.length;

    let inserted = 0;
    const BATCH = 100;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH).map((r) => ({
        owner_github: github.username,
        key_name: r.key_name || `${r.provider} Key`,
        api_key: r.api_key, provider: r.provider, category: r.category, notes: r.notes ?? null,
      }));
      const { error, data } = await supabase.from("api_keys").insert(chunk).select("id");
      if (!error && data) {
        inserted += data.length;
        // Log added events in batch
        await supabase.from("key_events").insert(data.map((d) => ({
          key_id: d.id, owner_github: github.username, event_type: "added", message: "Bulk imported",
        })));
      }
      setProgress(Math.round(((i + chunk.length) / toInsert.length) * 100));
    }

    setImporting(false);
    toast.success(`${inserted} imported, ${skipped} duplicates, ${invalid} invalid`);
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk Import</h1>
      </div>

      <Tabs defaultValue="csv">
        <TabsList>
          <TabsTrigger value="csv"><FileText className="mr-1.5 h-4 w-4" />CSV Upload</TabsTrigger>
          <TabsTrigger value="paste"><UploadIcon className="mr-1.5 h-4 w-4" />Paste Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="space-y-3">
          <label
            htmlFor="csv"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            className="vault-card flex cursor-pointer flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground hover:border-primary/40"
          >
            <UploadIcon className="h-6 w-6" />
            <div><span className="text-foreground font-medium">Click to upload</span> or drag & drop CSV</div>
            <div className="text-xs">Columns: key_name, api_key, provider, category, notes</div>
            <input id="csv" type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>

          {csvRows.length > 0 && (
            <div className="vault-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="text-sm">Total detected: <strong>{csvRows.length}</strong></span>
                <Button onClick={() => runImport(csvRows)} disabled={importing}>Import {csvRows.length}</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Name</th><th className="px-4 py-2">Provider</th><th className="px-4 py-2">Category</th><th className="px-4 py-2">Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="px-4 py-2">{r.key_name}</td>
                        <td className="px-4 py-2">{r.provider}</td>
                        <td className="px-4 py-2">{r.category}</td>
                        <td className="mono px-4 py-2 text-xs text-muted-foreground">{r.api_key.slice(0, 12)}…{r.api_key.slice(-4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="paste" className="space-y-3">
          <Textarea
            rows={12} className="mono"
            placeholder={"sk-or-...\nsk-or-...\nsk-or-..."}
            value={pasteText} onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={() => runImport(pasteRows())} disabled={importing || !pasteText.trim()}>
              Import {pasteRows().length} keys
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {importing && (
        <div className="vault-card p-4">
          <div className="mb-2 text-sm text-muted-foreground">Importing… {progress}%</div>
          <Progress value={progress} />
        </div>
      )}
    </div>
  );
}
