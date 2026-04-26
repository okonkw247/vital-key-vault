import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Logo from "@/components/Logo";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const finish = (path: string) => {
      if (!cancelled) navigate(path, { replace: true });
    };

    // First, give Supabase a moment to process the URL hash/params.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) return finish("/dashboard");

      // Fallback: listen briefly for SIGNED_IN, then bail to /login.
      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === "SIGNED_IN" && s) finish("/dashboard");
      });
      const t = setTimeout(() => {
        sub.subscription.unsubscribe();
        finish("/login");
      }, 4000);
      return () => {
        clearTimeout(t);
        sub.subscription.unsubscribe();
      };
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <Logo size={56} />
      <div className="text-sm text-muted-foreground">Signing you in…</div>
    </div>
  );
}
