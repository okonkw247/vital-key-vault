import { useEffect } from "react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";

export default function Login() {
  const { session, signInWithGithub } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md vault-card p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Logo size={40} />
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

        <Button onClick={signInWithGithub} className="w-full" size="lg">
          <Github className="mr-2 h-4 w-4" />
          Continue with GitHub
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          GitHub requires the <span className="mono">repo</span> scope to scan repositories.
        </p>
      </div>
    </div>
  );
}
