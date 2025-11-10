import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import Dashboard from "./pages/Dashboard";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { ClienteProtectedRoute } from "@/components/ClienteProtectedRoute";
import Propiedades from "./pages/Propiedades";
import Clientes from "./pages/Clientes";
import Matchings from "./pages/Matchings";
import Scraper from "./pages/Scraper";
import Metricas from "./pages/Metricas";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";
import ClienteDashboard from "./pages/ClienteDashboard";
import ClienteSettings from "./pages/ClienteSettings";
import ClienteMetricas from "./pages/ClienteMetricas";
import ClienteOnboarding from "./pages/ClienteOnboarding";
import LlamadasIA from "./pages/LlamadasIA";
import MercadoCiudades from "./pages/MercadoCiudades";
import Historico from "./pages/Historico";
import Ubicaciones from "./pages/Ubicaciones";
import ReclassifyProperties from "./pages/ReclassifyProperties";
import BatchProcessing from "./pages/BatchProcessing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin/auth" element={<AdminAuth />} />
            <Route path="/dashboard" element={<AdminProtectedRoute><Dashboard /></AdminProtectedRoute>} />
            <Route path="/propiedades" element={<AdminProtectedRoute><Propiedades /></AdminProtectedRoute>} />
            <Route path="/clientes" element={<AdminProtectedRoute><Clientes /></AdminProtectedRoute>} />
            <Route path="/matchings" element={<AdminProtectedRoute><Matchings /></AdminProtectedRoute>} />
            <Route path="/scraper" element={<AdminProtectedRoute><Scraper /></AdminProtectedRoute>} />
            <Route path="/metricas" element={<AdminProtectedRoute><Metricas /></AdminProtectedRoute>} />
            <Route path="/mercado-ciudades" element={<AdminProtectedRoute><MercadoCiudades /></AdminProtectedRoute>} />
            <Route path="/historico" element={<AdminProtectedRoute><Historico /></AdminProtectedRoute>} />
            <Route path="/ubicaciones" element={<AdminProtectedRoute><Ubicaciones /></AdminProtectedRoute>} />
            <Route path="/reclassify-properties" element={<AdminProtectedRoute><ReclassifyProperties /></AdminProtectedRoute>} />
            <Route path="/batch-processing" element={<AdminProtectedRoute><BatchProcessing /></AdminProtectedRoute>} />
            <Route path="/settings" element={<AdminProtectedRoute><Settings /></AdminProtectedRoute>} />
            <Route path="/subscription" element={<AdminProtectedRoute><Subscription /></AdminProtectedRoute>} />
            <Route path="/llamadas-ia" element={<AdminProtectedRoute><LlamadasIA /></AdminProtectedRoute>} />
            <Route path="/cliente/onboarding" element={<ClienteProtectedRoute><ClienteOnboarding /></ClienteProtectedRoute>} />
            <Route path="/cliente/dashboard" element={<ClienteProtectedRoute><ClienteDashboard /></ClienteProtectedRoute>} />
            <Route path="/cliente/settings" element={<ClienteProtectedRoute><ClienteSettings /></ClienteProtectedRoute>} />
            <Route path="/cliente/metricas" element={<ClienteProtectedRoute><ClienteMetricas /></ClienteProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
