import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Propiedades from "./pages/Propiedades";
import Clientes from "./pages/Clientes";
import Matchings from "./pages/Matchings";
import Scraper from "./pages/Scraper";
import Metricas from "./pages/Metricas";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ClienteDashboard from "./pages/ClienteDashboard";
import ClienteSettings from "./pages/ClienteSettings";
import ClienteMetricas from "./pages/ClienteMetricas";
import LlamadasIA from "./pages/LlamadasIA";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SubscriptionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/propiedades" element={<Propiedades />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/matchings" element={<Matchings />} />
            <Route path="/scraper" element={<Scraper />} />
            <Route path="/metricas" element={<Metricas />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/cliente/dashboard" element={<ClienteDashboard />} />
            <Route path="/cliente/settings" element={<ClienteSettings />} />
            <Route path="/cliente/metricas" element={<ClienteMetricas />} />
            <Route path="/llamadas-ia" element={<LlamadasIA />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
  </QueryClientProvider>
);

export default App;
