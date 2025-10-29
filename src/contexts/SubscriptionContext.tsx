import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface SubscriptionContextType {
  subscribed: boolean;
  tier: string;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SUBSCRIPTION_PRODUCTS = {
  basic: {
    name: 'Básico',
    price: '€9.99/mes',
    priceId: 'price_1SNVunIZNGNvNT1eDLHxmlM2',
    productId: 'prod_TKAF23fhblkfJU',
    features: ['Hasta 20 matchings/mes', 'Dashboard mejorado', 'Editar criterios']
  },
  investor: {
    name: 'Inversor',
    price: '€49.99/mes',
    priceId: 'price_1SNVvAIZNGNvNT1eZt8aW9BO',
    productId: 'prod_TKAFdxpTBCEdel',
    features: ['Matchings ilimitados', 'PDFs personalizados ilimitados', '20 informes WhatsApp/mes', 'Dashboard completo']
  },
  investor_platino: {
    name: 'Inversor Premium',
    price: '€149.99/mes',
    priceId: 'price_1SNVvUIZNGNvNT1eq1p9SZ7l',
    productId: 'prod_TKAGwOzkUFemBK',
    features: ['Todo lo de Inversor', 'WhatsApp ilimitado', 'Alertas en tiempo real', 'Asesoramiento personalizado', 'Acceso API']
  }
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscribed, setSubscribed] = useState(false);
  const [tier, setTier] = useState<string>('free');
  const [productId, setProductId] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setSubscribed(false);
        setTier('free');
        setProductId(null);
        setSubscriptionEnd(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Error checking subscription:', error);
        setSubscribed(false);
        setTier('free');
        return;
      }

      setSubscribed(data.subscribed);
      setTier(data.tier || 'free');
      setProductId(data.product_id);
      setSubscriptionEnd(data.subscription_end);
    } catch (error) {
      console.error('Error in checkSubscription:', error);
      setSubscribed(false);
      setTier('free');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check subscription on mount
    checkSubscription();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setTimeout(() => {
          checkSubscription();
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setSubscribed(false);
        setTier('free');
        setProductId(null);
        setSubscriptionEnd(null);
      }
    });

    // Refresh subscription status every minute
    const interval = setInterval(() => {
      if (user) {
        checkSubscription();
      }
    }, 60000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [user]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscribed,
        tier,
        productId,
        subscriptionEnd,
        loading,
        checkSubscription
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
