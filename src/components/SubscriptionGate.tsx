import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Crown, Zap } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSubscriptionAccess, AccessFeature } from '@/hooks/useSubscriptionAccess';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGateProps {
  feature: AccessFeature;
  children: ReactNode;
  blur?: boolean;
  showPreview?: boolean;
}

export const SubscriptionGate = ({ 
  feature, 
  children, 
  blur = true,
  showPreview = false
}: SubscriptionGateProps) => {
  const navigate = useNavigate();
  const { canAccess, getRequiredTier } = useSubscriptionAccess();
  const { upgradeUrl } = useSubscription();
  
  const hasAccess = canAccess(feature);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  const requiredTier = getRequiredTier(feature);
  
  const handleUpgrade = async () => {
    navigate('/cliente/dashboard');
  };
  
  const getFeatureDescription = () => {
    switch (feature) {
      case 'download_reports':
        return {
          title: 'Descargas de Informes',
          description: 'Descarga informes en PDF, Excel y CSV con análisis completo de mercado',
          icon: <Crown className="h-12 w-12 text-primary" />
        };
      case 'dashboard_provincia':
        return {
          title: 'Dashboard por Provincia',
          description: 'Accede a métricas detalladas por provincia: €/m², rentabilidad, datos INE',
          icon: <Zap className="h-12 w-12 text-primary" />
        };
      case 'dashboard_distrito':
        return {
          title: 'Dashboard por Distrito',
          description: 'Análisis granular por distrito con heatmaps y predicciones IA',
          icon: <Crown className="h-12 w-12 text-primary" />
        };
      case 'ine_data':
        return {
          title: 'Datos Macro (INE)',
          description: 'Población, renta media, desempleo y más datos socioeconómicos',
          icon: <Zap className="h-12 w-12 text-primary" />
        };
      default:
        return {
          title: 'Función Premium',
          description: 'Actualiza tu plan para acceder a esta función',
          icon: <Lock className="h-12 w-12 text-primary" />
        };
    }
  };
  
  const featureInfo = getFeatureDescription();
  
  return (
    <div className="relative">
      {showPreview && blur && (
        <div className={blur ? 'blur-sm pointer-events-none select-none' : ''}>
          {children}
        </div>
      )}
      
      <Card className={`${showPreview && blur ? 'absolute inset-0' : ''} border-2 border-primary/20 bg-background/95 backdrop-blur-sm`}>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
          <div className="mb-4">
            {featureInfo.icon}
          </div>
          
          <h3 className="text-2xl font-bold mb-2">{featureInfo.title}</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            {featureInfo.description}
          </p>
          
          <div className="bg-muted px-4 py-2 rounded-lg mb-6">
            <p className="text-sm font-medium">
              Requiere plan: <span className="text-primary font-bold">{requiredTier}</span>
            </p>
          </div>
          
          <Button 
            onClick={handleUpgrade} 
            size="lg"
            className="gap-2"
          >
            <Crown className="h-5 w-5" />
            Actualizar Plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};