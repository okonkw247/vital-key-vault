import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROVIDERS = ["OpenRouter", "Groq", "Gemini", "OpenAI", "Custom"];
const CATEGORIES = ["AI", "Storage", "Payment", "Custom"];

export default function AddKey() {
  const { github } = useAuth();
  const navigate = useNavigate();
  const [keyName, setKeyName] = useState("");
  const [provider, setProvider] = useState("OpenRouter");
  const [category, setCategory] = useState("AI");
  const [apiKey, setApiKey] = useState("");
  const [notes, setNotes] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!github) return;
    if (!keyName.trim() || !apiKey.trim()) { toast.error("Name and key are required"); return; }
    if (provider === "OpenRouter" && !apiKey.startsWith("sk-or-")) {
      toast.error("OpenRouter keys must start with sk-or-"); return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("api_keys").insert({
      owner_github: github.username,
      key_name: keyName.trim(),
      api_key: apiKey.trim(),
      provider, category,
      notes: notes.trim() || null,
    }).select("id").single();
    if (error) { toast.error(error.message); setSaving(false); return; }

    await supabase.from("key_events").insert({
      key_id: data.id, owner_github: github.username, event_type: "added", message: `Added ${provider} key`,
    });
    // Fire health check (don't await)
    supabase.functions.invoke("check-key-health", { body: { key_id: data.id } });
    toast.success("Key added");
    navigate("/");
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Add API Key</h1>
      <form onSubmit={onSubmit} className="vault-card space-y-5 p-6">
        <div className="space-y-2">
          <Label>Key Name</Label>
          <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="My OpenRouter prod key" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={provider === "OpenRouter" ? "sk-or-..." : "sk-..."}
              className="mono pr-10"
              required
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate("/")}>Cancel</Button>
          <Button type="submit" disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save & check"}</Button>
        </div>
      </form>
    </div>
  );
}
