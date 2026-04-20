export function maskKey(k: string): string {
  if (!k) return "";
  const tail = k.slice(-4);
  const head = k.startsWith("sk-or-") ? "sk-or-" : k.slice(0, Math.min(3, k.length));
  return `${head}${"•".repeat(8)}${tail}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function statusColor(s: string): string {
  switch (s) {
    case "active": return "text-primary";
    case "exhausted": return "text-warning";
    case "error": return "text-destructive";
    default: return "text-muted-foreground";
  }
}

export function statusBg(s: string): string {
  switch (s) {
    case "active": return "bg-primary";
    case "exhausted": return "bg-warning";
    case "error": return "bg-destructive";
    default: return "bg-muted-foreground";
  }
}
