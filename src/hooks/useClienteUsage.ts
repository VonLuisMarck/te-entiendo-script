import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';

export interface UsageStats {
  matchings: {
    used: number;
    limit: number | null;
    percentage: number;
  };
  analisisReforma: {
    used: number;
    limit: number | null;
    percentage: number;
  };
  proximoReset: string | null;
}

export const useClienteUsage = () => {
  const { tier } = useSubscription();
  
  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente-usage'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await supabase
        .from('clientes')
        .select('matchings_usados_mes, estimaciones_reforma_mes, fecha_reset_matchings')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  const tierConfig = SUBSCRIPTION_TIERS[tier];
  const matchingsLimit = tierConfig.limits.matchings;
  const analisisReformaLimit = tierConfig.limits.analisisReforma;

  const matchingsUsed = cliente?.matchings_usados_mes || 0;
  const analisisReformaUsed = cliente?.estimaciones_reforma_mes || 0;

  const usageStats: UsageStats = {
    matchings: {
      used: matchingsUsed,
      limit: matchingsLimit,
      percentage: matchingsLimit ? (matchingsUsed / matchingsLimit) * 100 : 0,
    },
    analisisReforma: {
      used: analisisReformaUsed,
      limit: analisisReformaLimit,
      percentage: analisisReformaLimit ? (analisisReformaUsed / analisisReformaLimit) * 100 : 0,
    },
    proximoReset: cliente?.fecha_reset_matchings || null,
  };

  const isNearLimit = (percentage: number) => percentage >= 80;
  const isAtLimit = (used: number, limit: number | null) => 
    limit !== null && used >= limit;

  return {
    usageStats,
    isLoading,
    isNearLimit,
    isAtLimit,
    tier,
  };
};
