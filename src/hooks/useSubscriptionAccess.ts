import { useSubscription } from '@/contexts/SubscriptionContext';
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers';

export type AccessFeature = 
  | 'download_reports'
  | 'dashboard_provincia' 
  | 'dashboard_distrito'
  | 'ine_data'
  | 'analisis_reforma'
  | 'alertas';

export const useSubscriptionAccess = () => {
  const { tier, subscribed } = useSubscription();
  
  const canAccess = (feature: AccessFeature): boolean => {
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    
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
  
  return {
    canAccess,
    getRequiredTier,
    tier,
    subscribed
  };
};