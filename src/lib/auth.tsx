import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type GhProfile = {
  username: string;
  avatar_url: string;
  name?: string;
  email?: string;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  github: GhProfile | null;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

function ghFromUser(u: User | null): GhProfile | null {
  if (!u) return null;
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const username = (m.user_name as string) || (m.preferred_username as string) || "";
  if (!username) return null;
  return {
    username,
    avatar_url: (m.avatar_url as string) || "",
    name: (m.full_name as string) || (m.name as string) || username,
    email: u.email ?? undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up listener BEFORE getSession to avoid race on refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    loading,
    github: ghFromUser(session?.user ?? null),
    signInWithGithub: async () => {
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "repo read:user user:email",
        },
      });
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
