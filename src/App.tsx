import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { ThemeProvider } from "next-themes";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { ClienteProtectedRoute } from "@/components/ClienteProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Propiedades = lazy(() => import("./pages/Propiedades"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Matchings = lazy(() => import("./pages/Matchings"));
const Scraper = lazy(() => import("./pages/Scraper"));
const Metricas = lazy(() => import("./pages/Metricas"));
const Settings = lazy(() => import("./pages/Settings"));
const Subscription = lazy(() => import("./pages/Subscription"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ClienteDashboard = lazy(() => import("./pages/ClienteDashboard"));
const ClienteSettings = lazy(() => import("./pages/ClienteSettings"));
const ClienteMetricas = lazy(() => import("./pages/ClienteMetricas"));
const ClienteOnboarding = lazy(() => import("./pages/ClienteOnboarding"));
const LlamadasIA = lazy(() => import("./pages/LlamadasIA"));
const MercadoCiudades = lazy(() => import("./pages/MercadoCiudades"));
const Historico = lazy(() => import("./pages/Historico"));
const Ubicaciones = lazy(() => import("./pages/Ubicaciones"));
const ReclassifyProperties = lazy(() => import("./pages/ReclassifyProperties"));
const BatchProcessing = lazy(() => import("./pages/BatchProcessing"));
const PropiedadesRaw = lazy(() => import("./pages/PropiedadesRaw"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Suspense fallback={<p role="status" className="p-10 text-center">Cargando…</p>}><Routes>
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
            <Route path="/propiedades-raw" element={<AdminProtectedRoute><PropiedadesRaw /></AdminProtectedRoute>} />
            <Route path="/settings" element={<AdminProtectedRoute><Settings /></AdminProtectedRoute>} />
            <Route path="/subscription" element={<ClienteProtectedRoute><Subscription /></ClienteProtectedRoute>} />
            <Route path="/llamadas-ia" element={<AdminProtectedRoute><LlamadasIA /></AdminProtectedRoute>} />
            <Route path="/cliente/onboarding" element={<ClienteProtectedRoute><ClienteOnboarding /></ClienteProtectedRoute>} />
            <Route path="/cliente/dashboard" element={<ClienteProtectedRoute><ClienteDashboard /></ClienteProtectedRoute>} />
            <Route path="/cliente/settings" element={<ClienteProtectedRoute><ClienteSettings /></ClienteProtectedRoute>} />
            <Route path="/cliente/metricas" element={<ClienteProtectedRoute><ClienteMetricas /></ClienteProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes></Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

