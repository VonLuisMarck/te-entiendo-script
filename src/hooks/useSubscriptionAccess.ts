import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AccessFeature = 
  | 'download_reports'
  | 'dashboard_provincia' 
  | 'dashboard_distrito'
  | 'ine_data'
  | 'analisis_reforma'
  | 'alertas';

export const useSubscriptionAccess = () => {
  const { tier, subscribed } = useSubscription();
  const tierConfig = SUBSCRIPTION_TIERS[tier];

  const { data: cliente } = useQuery({
    queryKey: ['cliente-limits'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('clientes')
        .select('matchings_usados_mes, estimaciones_reforma_mes')
        .eq('user_id', user.id)
        .single();

      return data;
    },
  });
  
  const canAccess = (feature: AccessFeature): boolean => {
    
    switch (feature) {
      case 'download_reports':
        return tierConfig.limits.descargas === true;
      
      case 'dashboard_provincia':
        return ['investor', 'investor_platino'].includes(tier);
      
      case 'dashboard_distrito':
        return tier === 'investor_platino';
      
      case 'ine_data':
        return tierConfig.limits.accesoINE === true;
      
      case 'analisis_reforma':
        return tier !== 'free';
      
      case 'alertas':
        return tierConfig.limits.alertas === true;
      
      default:
        return false;
    }
  };
  
  const getRequiredTier = (feature: AccessFeature): string => {
    switch (feature) {
      case 'download_reports':
      case 'dashboard_provincia':
      case 'ine_data':
        return 'Inversor';
      
      case 'dashboard_distrito':
        return 'Inversor Platino';
      
      case 'analisis_reforma':
      case 'alertas':
        return 'Básico';
      
      default:
        return 'Básico';
    }
  };
  
  const canUseMatchings = (): boolean => {
    const matchingsLimit = tierConfig.limits.matchings;
    if (matchingsLimit === null) return true; // Ilimitado
    if (!cliente) return false;
    return cliente.matchings_usados_mes < matchingsLimit;
  };

  const canUseAnalisisReforma = (): boolean => {
    const analisisLimit = tierConfig.limits.analisisReforma;
    if (analisisLimit === null) return true; // Ilimitado
    if (analisisLimit === 0) return false; // No disponible
    if (!cliente) return false;
    return cliente.estimaciones_reforma_mes < analisisLimit;
  };

  return {
    canAccess,
    getRequiredTier,
    canUseMatchings,
    canUseAnalisisReforma,
    tier,
    subscribed
  };
};