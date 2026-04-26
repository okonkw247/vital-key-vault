import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import AuthErrorBoundary from "@/components/AuthErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import AddKey from "./pages/AddKey";
import ImportKeys from "./pages/ImportKeys";
import KeyDetail from "./pages/KeyDetail";
import Repos from "./pages/Repos";
import Integration from "./pages/Integration";
import Settings from "./pages/Settings";
import Digest from "./pages/Digest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthErrorBoundary>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/add" element={<AddKey />} />
                <Route path="/import" element={<ImportKeys />} />
                <Route path="/key/:id" element={<KeyDetail />} />
                <Route path="/repos" element={<Repos />} />
                <Route path="/integration" element={<Integration />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/digest" element={<Digest />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </AuthErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
