import { Building2, Users, Search, BarChart3, MapPin, FileText, LogOut, Settings, Archive } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import homelyLogo from "@/assets/homely-logo.png";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Propiedades", url: "/propiedades", icon: Building2 },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Matchings", url: "/matchings", icon: Search },
  { title: "Scraper", url: "/scraper", icon: FileText },
  { title: "Métricas", url: "/metricas", icon: BarChart3 },
  { title: "Mercado", url: "/mercado-ciudades", icon: MapPin },
  { title: "Ubicaciones", url: "/ubicaciones", icon: MapPin },
  { title: "Histórico", url: "/historico", icon: Archive },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate("/auth");
  };

  return (
    <Sidebar className={isCollapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center gap-3 border-b">
          <img src={homelyLogo} alt="Homely" className="h-8 w-8 object-contain" />
          {!isCollapsed && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Homely
            </h1>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 border-t space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Ajustes</span>}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span className="ml-2">Salir</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
