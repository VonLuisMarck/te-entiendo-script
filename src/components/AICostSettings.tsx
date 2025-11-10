import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Settings, Save } from "lucide-react";

export const AICostSettings = () => {
  const [saving, setSaving] = useState(false);

  const { data: config, refetch } = useQuery({
    queryKey: ['ai-cost-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_cost_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      return data;
    }
  });

  const [formData, setFormData] = useState({
    umbral_diario_usd: config?.umbral_diario_usd || 10,
    umbral_mensual_usd: config?.umbral_mensual_usd || 200,
    umbral_por_batch_usd: config?.umbral_por_batch_usd || 2,
    notificar_ui: config?.notificar_ui ?? true,
    pausar_automatico: config?.pausar_automatico ?? false
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_cost_config')
        .update(formData)
        .eq('id', config?.id);

      if (error) throw error;

      toast.success('⚙️ Configuración guardada', {
        description: 'Los umbrales se han actualizado correctamente'
      });
      refetch();
    } catch (error: any) {
      console.error('Error guardando configuración:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuración de Umbrales
        </CardTitle>
        <CardDescription>
          Define los límites de coste que activarán alertas automáticas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="umbral-diario">Umbral Diario (USD)</Label>
            <Input
              id="umbral-diario"
              type="number"
              step="0.01"
              value={formData.umbral_diario_usd}
              onChange={(e) => setFormData({ ...formData, umbral_diario_usd: parseFloat(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Alerta cuando el coste diario supere este valor
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="umbral-mensual">Umbral Mensual (USD)</Label>
            <Input
              id="umbral-mensual"
              type="number"
              step="1"
              value={formData.umbral_mensual_usd}
              onChange={(e) => setFormData({ ...formData, umbral_mensual_usd: parseFloat(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Presupuesto máximo mensual de IA
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="umbral-batch">Umbral por Batch (USD)</Label>
            <Input
              id="umbral-batch"
              type="number"
              step="0.01"
              value={formData.umbral_por_batch_usd}
              onChange={(e) => setFormData({ ...formData, umbral_por_batch_usd: parseFloat(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Alerta si un batch individual supera este coste
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notificar-ui">Notificaciones en UI</Label>
              <p className="text-xs text-muted-foreground">
                Mostrar alertas visuales cuando se superen umbrales
              </p>
            </div>
            <Switch
              id="notificar-ui"
              checked={formData.notificar_ui}
              onCheckedChange={(checked) => setFormData({ ...formData, notificar_ui: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pausar-auto">Pausar Automáticamente</Label>
              <p className="text-xs text-muted-foreground">
                Detener procesamiento batch al superar umbral diario (próximamente)
              </p>
            </div>
            <Switch
              id="pausar-auto"
              checked={formData.pausar_automatico}
              onCheckedChange={(checked) => setFormData({ ...formData, pausar_automatico: checked })}
              disabled
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};