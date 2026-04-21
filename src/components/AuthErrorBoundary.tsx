import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class AuthErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AuthErrorBoundary caught:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    try {
      // Clear any stale supabase auth tokens that may be causing the crash
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    window.location.assign("/login");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md vault-card p-8 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                The app hit an unexpected error while loading.
              </p>
            </div>
          </div>

          {this.state.error?.message && (
            <pre className="mb-4 max-h-40 overflow-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}

          <div className="space-y-2">
            <Button onClick={this.handleReload} className="w-full" size="lg">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload page
            </Button>
            <Button
              onClick={this.handleClearAndReload}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Sign out & retry
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            If this keeps happening, try clearing your browser cache or signing in with a
            different provider.
          </p>
        </div>
      </div>
    );
  }
}
