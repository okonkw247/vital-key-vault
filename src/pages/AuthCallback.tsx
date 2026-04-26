import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const goDashboard = () => {
      if (!cancelled) navigate("/dashboard", { replace: true });
    };
    const goLogin = (msg?: string) => {
      if (cancelled) return;
      if (msg) setError(msg);
      navigate("/login", { replace: true });
    };

    // Listen first so we don't miss the SIGNED_IN event fired while
    // Supabase parses the hash token from the URL.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" && s) goDashboard();
    });

    supabase.auth
      .getSession()
      .then(({ data: { session }, error: err }) => {
        if (err) {
          goLogin(err.message);
          return;
        }
        if (session) goDashboard();
      })
      .catch((e) => goLogin(e?.message ?? "Auth failed"));

    // Safety net — if nothing happens in 6s, send them to login.
    timeoutId = window.setTimeout(() => goLogin("Sign-in timed out."), 6000);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <Logo size={56} />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing you in…
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}
