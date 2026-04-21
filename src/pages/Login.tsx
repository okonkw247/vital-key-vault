import { useEffect } from "react";
import { Github, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { session, signInWithGithub, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (session) navigate("/", { replace: true }); }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md vault-card p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Adams X API Vault</h1>
            <p className="text-sm text-muted-foreground">Your personal API key command center</p>
          </div>
        </div>

        <div className="mb-6 space-y-2 text-sm text-muted-foreground">
          <p>• Real-time health monitoring for OpenRouter, Groq, Gemini, OpenAI</p>
          <p>• Bulk import 100k+ keys</p>
          <p>• Always serve your active key via a single endpoint</p>
        </div>

        <div className="space-y-2">
          <Button onClick={signInWithGoogle} className="w-full" size="lg">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
            </svg>
            Continue with Google
          </Button>
          <Button onClick={signInWithGithub} variant="outline" className="w-full" size="lg">
            <Github className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          GitHub requires the <span className="mono">repo</span> scope to scan repositories. If GitHub fails, use Google.
        </p>
      </div>
    </div>
  );
}
